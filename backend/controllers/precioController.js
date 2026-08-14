const ConfiguracionPrecio = require('../models/ConfiguracionPrecio');
const AuditLog = require('../models/AuditLog');
const Usuario = require('../models/Usuario');
const auditoriaService = require('../services/auditoriaService');
const { TIPOS_TARIFA_AUTOMATICA } = require('../utils/tiposTarifa');

// La auditoría de precios se guarda en AuditLog (antes en el modelo LogPrecio). El frontend
// que consume el historial espera todavía la forma vieja, así que se traduce en la lectura
// en vez de arrastrar el modelo entero solo por el formato de respuesta.
const ACCIONES_PRECIO = ['precio_creacion', 'precio_modificacion', 'precio_eliminacion'];

const TIPOS_VEHICULO = ['todos', 'auto', 'moto'];
const HORA_VALIDA = /^([01]?\d|2[0-3]):[0-5]\d$/;

// Reglas de cobro que llegan del formulario de tarifas. Todas son opcionales: lo que no viene
// conserva el comportamiento histórico —hora entera, sin recargos ni tope—, así que una tarifa
// creada como siempre sigue cobrando como siempre.
//
// Se validan acá y no en el modelo porque el mensaje importa: "la fracción debe estar entre 1 y
// 1440 minutos" se puede leer en el mostrador; un error de validación de Mongoose, no.
const normalizarReglas = (cuerpo = {}) => {
  const tipoVehiculo = cuerpo.tipoVehiculo ?? 'todos';
  if (!TIPOS_VEHICULO.includes(tipoVehiculo)) {
    return { error: `tipoVehiculo inválido. Debe ser uno de: ${TIPOS_VEHICULO.join(', ')}` };
  }

  const fraccionMinutos = cuerpo.fraccionMinutos == null || cuerpo.fraccionMinutos === ''
    ? 60
    : Number(cuerpo.fraccionMinutos);
  if (!Number.isFinite(fraccionMinutos) || fraccionMinutos < 1 || fraccionMinutos > 1440) {
    return { error: 'La fracción de cobro debe ser un número entre 1 y 1440 minutos' };
  }

  const topeDiario = cuerpo.topeDiario == null || cuerpo.topeDiario === '' ? null : Number(cuerpo.topeDiario);
  if (topeDiario !== null && (!Number.isFinite(topeDiario) || topeDiario < 0)) {
    return { error: 'El tope diario debe ser un número mayor o igual a 0, o quedar vacío' };
  }

  const porcentaje = (valor) => {
    if (valor == null || valor === '') return 0;
    const numero = Number(valor);
    return Number.isFinite(numero) && numero >= 0 ? numero : null;
  };

  const recargosEntrada = cuerpo.recargos ?? {};
  const nocturno = porcentaje(recargosEntrada.nocturno?.porcentaje);
  const finDeSemana = porcentaje(recargosEntrada.finDeSemana?.porcentaje);
  const feriado = porcentaje(recargosEntrada.feriado?.porcentaje);
  if (nocturno === null || finDeSemana === null || feriado === null) {
    return { error: 'Los recargos deben ser porcentajes mayores o iguales a 0' };
  }

  const desde = recargosEntrada.nocturno?.desde ?? '22:00';
  const hasta = recargosEntrada.nocturno?.hasta ?? '06:00';
  if (nocturno > 0 && (!HORA_VALIDA.test(desde) || !HORA_VALIDA.test(hasta))) {
    return { error: 'El horario nocturno debe tener el formato HH:MM (por ejemplo 22:00)' };
  }

  return {
    tipoVehiculo,
    fraccionMinutos,
    topeDiario,
    recargos: {
      nocturno: { porcentaje: nocturno, desde, hasta },
      finDeSemana: { porcentaje: finDeSemana },
      feriado: { porcentaje: feriado }
    }
  };
};

const aFormaHistorialPrecio = (registro) => ({
  _id: registro._id,
  tipoUsuario: registro.entidadId,
  precioAnterior: registro.datosAnteriores?.precioPorHora ?? null,
  precioNuevo: registro.datosNuevos?.precioPorHora ?? null,
  descripcionAnterior: registro.datosAnteriores?.descripcion ?? '',
  descripcionNueva: registro.datosNuevos?.descripcion ?? '',
  modificadoPor: registro.actor ?? { dni: registro.usuarioDni, nombre: '', apellido: '', email: '' },
  fechaModificacion: registro.fecha,
  motivo: registro.motivo || '',
  ip: registro.ip || ''
});

// Obtener todas las configuraciones de precios
const obtenerPrecios = async (req, res) => {
  try {
    const precios = await ConfiguracionPrecio.find();
    
    // Si no existen configuraciones, crear las por defecto
    if (precios.length === 0) {
      const preciosDefault = [
        {
          tipoUsuario: 'asociado',
          precioPorHora: 250,
          descripcion: 'Precio por hora para usuarios asociados',
          actualizadoPor: 'Sistema'
        },
        {
          tipoUsuario: 'no_asociado',
          precioPorHora: 500,
          descripcion: 'Precio por hora para usuarios no asociados',
          actualizadoPor: 'Sistema'
        }
      ];
      
      await ConfiguracionPrecio.insertMany(preciosDefault);
      const nuevosPrecios = await ConfiguracionPrecio.find();
      
      return res.json({
        success: true,
        precios: nuevosPrecios
      });
    }
    
    res.json({
      success: true,
      precios
    });
  } catch (error) {
    console.error('Error al obtener precios:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error interno del servidor'
    });
  }
};

// Actualizar precio específico
const actualizarPrecio = async (req, res) => {
  try {
    const { tipoUsuario } = req.params;
    const { precioPorHora, descripcion, motivo } = req.body;
    const { dni } = req.usuario; // Del middleware de auth

    // Reglas de cobro (tipo de vehículo, fracción, tope diario y recargos). Se validan y se
    // normalizan acá: son las que después decide `tarifaEngine`, y un valor absurdo —fracción
    // 0, recargo negativo— no se ve hasta que alguien cobra mal.
    const reglas = normalizarReglas(req.body);
    if (reglas.error) {
      return res.status(400).json({ success: false, mensaje: reglas.error });
    }

    // Se puede editar cualquiera de las dos tarifas automáticas, o cualquier tarifa con nombre
    // que ya exista. Lo que no se puede es "actualizar" una que nunca se creó: antes, la lista
    // de tipos válidos estaba hardcodeada y arrastraba nombres de prueba.
    const esAutomatica = TIPOS_TARIFA_AUTOMATICA.includes(tipoUsuario);
    const existe = esAutomatica || await ConfiguracionPrecio.exists({ tipoUsuario });
    if (!existe) {
      return res.status(404).json({
        success: false,
        mensaje: `No existe una tarifa "${tipoUsuario}". Creála antes de modificarla.`
      });
    }

    // Validar precio
    if (!precioPorHora || precioPorHora < 0) {
      return res.status(400).json({
        success: false,
        mensaje: 'El precio debe ser un número mayor o igual a 0'
      });
    }

    // Obtener datos del usuario que modifica
    const usuarioModificador = await Usuario.findOne({ dni }).select('-password');
    if (!usuarioModificador) {
      return res.status(400).json({
        success: false,
        mensaje: 'Usuario no encontrado'
      });
    }


    // Obtener configuración actual para el log
    const configuracionActual = await ConfiguracionPrecio.findOne({ tipoUsuario, tipoVehiculo: reglas.tipoVehiculo });

    // Buscar y actualizar o crear si no existe
    const precioActualizado = await ConfiguracionPrecio.findOneAndUpdate(
      { tipoUsuario, tipoVehiculo: reglas.tipoVehiculo },
      {
        precioPorHora: Number(precioPorHora),
        descripcion: descripcion || '',
        fechaActualizacion: new Date(),
        actualizadoPor: dni,
        tipoVehiculo: reglas.tipoVehiculo,
        fraccionMinutos: reglas.fraccionMinutos,
        topeDiario: reglas.topeDiario,
        recargos: reglas.recargos
      },
      {
        returnDocument: 'after',
        upsert: true
      }
    );

    await auditoriaService.registrar({
      entidad: auditoriaService.ENTIDADES.PRECIO,
      entidadId: tipoUsuario,
      accion: configuracionActual ? 'precio_modificacion' : 'precio_creacion',
      usuarioId: usuarioModificador._id,
      actor: auditoriaService.persona(usuarioModificador),
      ip: req.ip || '',
      datosAnteriores: {
        precioPorHora: configuracionActual ? configuracionActual.precioPorHora : null,
        descripcion: configuracionActual ? configuracionActual.descripcion : ''
      },
      datosNuevos: { precioPorHora: Number(precioPorHora), descripcion: descripcion || '', ...reglas },
      motivo: motivo || ''
    });

    res.json({
      success: true,
      mensaje: `Precio para ${tipoUsuario.replace('_', ' ')} actualizado correctamente`,
      precio: precioActualizado
    });
  } catch (error) {
    console.error('Error al actualizar precio:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      mensaje: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Obtener precio específico por tipo de usuario
const obtenerPrecioPorTipo = async (req, res) => {
  try {
    const { tipoUsuario } = req.params;
    
    const precio = await ConfiguracionPrecio.findOne({ tipoUsuario });
    
    if (!precio) {
      // Crear precio por defecto si no existe
      const precioDefault = tipoUsuario === 'asociado' ? 250 : 500;
      const nuevoPrecio = new ConfiguracionPrecio({
        tipoUsuario,
        precioPorHora: precioDefault,
        descripcion: `Precio por hora para usuarios ${tipoUsuario.replace('_', ' ')}`,
        actualizadoPor: 'Sistema'
      });
      
      await nuevoPrecio.save();
      
      return res.json({
        success: true,
        precio: nuevoPrecio
      });
    }
    
    res.json({
      success: true,
      precio
    });
  } catch (error) {
    console.error('Error al obtener precio por tipo:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error interno del servidor'
    });
  }
};

// Obtener historial de cambios de precios
const obtenerHistorialPrecios = async (req, res) => {
  try {
    const { tipoUsuario, limite = 50, pagina = 1 } = req.query;
    
    const filtro = { accion: { $in: ACCIONES_PRECIO } };
    if (tipoUsuario && TIPOS_TARIFA_AUTOMATICA.includes(tipoUsuario)) {
      filtro.entidadId = tipoUsuario;
    }

    const skip = (parseInt(pagina) - 1) * parseInt(limite);

    const [registros, total] = await Promise.all([
      AuditLog.find(filtro).sort({ fecha: -1 }).skip(skip).limit(parseInt(limite)).lean(),
      AuditLog.countDocuments(filtro)
    ]);

    res.json({
      success: true,
      historial: registros.map(aFormaHistorialPrecio),
      pagination: {
        total,
        pagina: parseInt(pagina),
        limite: parseInt(limite),
        totalPaginas: Math.ceil(total / parseInt(limite))
      }
    });
  } catch (error) {
    console.error('Error al obtener historial de precios:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error interno del servidor'
    });
  }
};

// Obtener estadísticas de cambios de precios
const obtenerEstadisticasPrecios = async (req, res) => {
  try {
    // Todas las agregaciones corren ahora sobre AuditLog, filtradas por las acciones de precio.
    const soloPrecios = { accion: { $in: ACCIONES_PRECIO } };
    const totalCambios = await AuditLog.countDocuments(soloPrecios);

    // Estadísticas por tipo de tarifa (el tipo vive en entidadId)
    const cambiosPorTipo = await AuditLog.aggregate([
      { $match: soloPrecios },
      { $group: { _id: '$entidadId', cantidad: { $sum: 1 }, ultimoCambio: { $max: '$fecha' } } },
      { $sort: { cantidad: -1 } }
    ]);

    // El tipo de operación ya es explícito en la acción; antes había que deducirlo de qué
    // campo venía en null.
    const operacionesPorTipo = await AuditLog.aggregate([
      { $match: soloPrecios },
      { $group: { _id: { $replaceOne: { input: '$accion', find: 'precio_', replacement: '' } }, cantidad: { $sum: 1 } } }
    ]);

    // Administradores más activos
    const cambiosPorUsuario = await AuditLog.aggregate([
      { $match: soloPrecios },
      {
        $group: {
          _id: '$actor.dni',
          nombre: { $first: '$actor.nombre' },
          apellido: { $first: '$actor.apellido' },
          cantidad: { $sum: 1 },
          ultimoCambio: { $max: '$fecha' }
        }
      },
      { $sort: { cantidad: -1 } },
      { $limit: 5 }
    ]);

    // Actividad reciente (últimos 30 días)
    const fechaHace30Dias = new Date();
    fechaHace30Dias.setDate(fechaHace30Dias.getDate() - 30);

    const actividadReciente = await AuditLog.countDocuments({
      ...soloPrecios,
      fecha: { $gte: fechaHace30Dias }
    });

    // Cambios por mes (últimos 6 meses)
    const cambiosPorMes = await AuditLog.aggregate([
      {
        $match: {
          ...soloPrecios,
          fecha: { $gte: new Date(new Date().setMonth(new Date().getMonth() - 6)) }
        }
      },
      {
        $group: {
          _id: { año: { $year: '$fecha' }, mes: { $month: '$fecha' } },
          cantidad: { $sum: 1 }
        }
      },
      { $sort: { '_id.año': 1, '_id.mes': 1 } }
    ]);
    
    res.json({
      success: true,
      estadisticas: {
        totalCambios,
        actividadReciente,
        cambiosPorTipo,
        operacionesPorTipo,
        cambiosPorUsuario,
        cambiosPorMes
      }
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error interno del servidor'
    });
  }
};

// Crear nueva configuración de precio
const crearPrecio = async (req, res) => {
  try {
    const { tipoUsuario, precioPorHora, descripcion } = req.body;
    const { dni } = req.usuario; // Del middleware de auth

    // Validar datos requeridos
    if (!tipoUsuario || !precioPorHora) {
      return res.status(400).json({
        success: false,
        mensaje: 'El tipo de usuario y precio por hora son obligatorios'
      });
    }

    // Validar que el tipo de usuario no esté vacío y sea válido
    if (tipoUsuario.trim().length === 0) {
      return res.status(400).json({
        success: false,
        mensaje: 'El tipo de usuario no puede estar vacío'
      });
    }

    // Una tarifa con nombre propio es válida, pero no se aplica sola: hay que asignársela a un
    // cliente. Solo `asociado` y `no_asociado` se resuelven automáticamente (ver utils/tiposTarifa).
    const requiereAsignacion = !TIPOS_TARIFA_AUTOMATICA.includes(tipoUsuario.trim().toLowerCase());

    // Validar precio
    if (precioPorHora < 0) {
      return res.status(400).json({
        success: false,
        mensaje: 'El precio debe ser un número mayor o igual a 0'
      });
    }

    const reglas = normalizarReglas(req.body);
    if (reglas.error) {
      return res.status(400).json({ success: false, mensaje: reglas.error });
    }

    // La unicidad es por tipo de cliente Y tipo de vehículo: "asociado / moto" y
    // "asociado / auto" son dos tarifas distintas y legítimas.
    const precioExistente = await ConfiguracionPrecio.findOne({
      tipoUsuario: tipoUsuario.trim().toLowerCase(),
      tipoVehiculo: reglas.tipoVehiculo
    });

    if (precioExistente) {
      return res.status(400).json({
        success: false,
        mensaje: reglas.tipoVehiculo === 'todos'
          ? 'Ya existe una configuración de precio para este tipo de usuario'
          : `Ya existe una tarifa de ${reglas.tipoVehiculo} para este tipo de usuario`
      });
    }

    // Obtener datos del usuario que crea
    const usuarioCreador = await Usuario.findOne({ dni }).select('-password');
    if (!usuarioCreador) {
      return res.status(400).json({
        success: false,
        mensaje: 'Usuario no encontrado'
      });
    }

    // Crear nueva configuración de precio
    const nuevoPrecio = new ConfiguracionPrecio({
      tipoUsuario: tipoUsuario.trim().toLowerCase(),
      precioPorHora: Number(precioPorHora),
      descripcion: descripcion || '',
      actualizadoPor: dni,
      fechaCreacion: new Date(),
      fechaActualizacion: new Date(),
      tipoVehiculo: reglas.tipoVehiculo,
      fraccionMinutos: reglas.fraccionMinutos,
      topeDiario: reglas.topeDiario,
      recargos: reglas.recargos
    });

    await nuevoPrecio.save();

    await auditoriaService.registrar({
      entidad: auditoriaService.ENTIDADES.PRECIO,
      entidadId: nuevoPrecio.tipoUsuario,
      accion: 'precio_creacion',
      usuarioId: usuarioCreador._id,
      actor: auditoriaService.persona(usuarioCreador),
      ip: req.ip || '',
      datosAnteriores: null,
      datosNuevos: { precioPorHora: nuevoPrecio.precioPorHora, descripcion: nuevoPrecio.descripcion },
      motivo: 'Creación de nueva configuración de precio'
    });

    res.status(201).json({
      success: true,
      mensaje: requiereAsignacion
        ? `Tarifa "${nuevoPrecio.tipoUsuario}" creada. No se aplica sola: asignásela a los clientes que corresponda.`
        : 'Configuración de precio creada exitosamente',
      requiereAsignacion,
      precio: nuevoPrecio
    });
  } catch (error) {
    console.error('Error al crear precio:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error interno del servidor'
    });
  }
};

// Eliminar configuración de precio
const eliminarPrecio = async (req, res) => {
  try {
    const { tipoUsuario } = req.params;
    const { dni } = req.usuario; // Del middleware de auth

    // Verificar que no sea un tipo básico (asociado o no_asociado)
    if (tipoUsuario === 'asociado' || tipoUsuario === 'no_asociado') {
      return res.status(400).json({
        success: false,
        mensaje: 'No se pueden eliminar las configuraciones básicas de precios'
      });
    }

    // Obtener datos del usuario que elimina
    const usuarioEliminador = await Usuario.findOne({ dni }).select('-password');
    if (!usuarioEliminador) {
      return res.status(400).json({
        success: false,
        mensaje: 'Usuario no encontrado'
      });
    }

    // Buscar la configuración de precio
    const configuracionPrecio = await ConfiguracionPrecio.findOne({ tipoUsuario });
    
    if (!configuracionPrecio) {
      return res.status(404).json({
        success: false,
        mensaje: 'Configuración de precio no encontrada'
      });
    }

    // Se audita antes de borrar, para que el registro conserve el valor que se pierde.
    await auditoriaService.registrar({
      entidad: auditoriaService.ENTIDADES.PRECIO,
      entidadId: configuracionPrecio.tipoUsuario,
      accion: 'precio_eliminacion',
      usuarioId: usuarioEliminador._id,
      actor: auditoriaService.persona(usuarioEliminador),
      ip: req.ip || '',
      datosAnteriores: {
        precioPorHora: configuracionPrecio.precioPorHora,
        descripcion: configuracionPrecio.descripcion
      },
      datosNuevos: null,
      motivo: 'Eliminación de configuración de precio'
    });

    // Eliminar la configuración
    await ConfiguracionPrecio.findOneAndDelete({ tipoUsuario });

    res.json({
      success: true,
      mensaje: 'Configuración de precio eliminada exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar precio:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error interno del servidor'
    });
  }
};

module.exports = {
  obtenerPrecios,
  crearPrecio,
  actualizarPrecio,
  eliminarPrecio,
  obtenerPrecioPorTipo,
  obtenerHistorialPrecios,
  obtenerEstadisticasPrecios
};
