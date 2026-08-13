const Comprobante = require('../models/Comprobante');
const Usuario = require('../models/Usuario');
const Vehiculo = require('../models/Vehiculo');
const Transaccion = require('../models/Transaccion');
const AuditLog = require('../models/AuditLog');
const Estacionamiento = require('../models/Estacionamiento');
const auditoriaService = require('../services/auditoriaService');
const { aTexto, escaparRegex, regexContiene, paginar, totalPaginas } = require('../utils/consultas');

// La auditoría de saldos y vehículos vive en AuditLog (antes en LogSaldo y LogVehiculo).
// Las pantallas que consumen estos historiales esperan todavía la forma vieja, así que se
// traduce en la lectura en vez de sostener dos modelos solo por el formato de respuesta.
const aFormaHistorialSaldo = (registro) => ({
  _id: registro._id,
  usuarioAfectado: registro.afectado,
  saldoAnterior: registro.datosAnteriores?.saldo ?? null,
  saldoNuevo: registro.datosNuevos?.saldo ?? null,
  diferencia: registro.datosNuevos?.diferencia ?? null,
  tipoOperacion: registro.accion.replace('saldo_', ''),
  modificadoPor: registro.actor,
  fechaModificacion: registro.fecha,
  motivo: registro.motivo || '',
  ip: registro.ip || '',
  observaciones: registro.datosNuevos?.observaciones || ''
});

const aFormaHistorialVehiculo = (registro) => ({
  _id: registro._id,
  vehiculo: registro.datosNuevos ?? registro.datosAnteriores ?? { dominio: registro.entidadId },
  tipoOperacion: registro.accion.replace('vehiculo_', ''),
  propietarioNuevo: registro.afectado,
  propietarioAnterior: registro.datosAnteriores?.propietario ?? null,
  cambiosRealizados: registro.datosNuevos ?? null,
  modificadoPor: registro.actor,
  fechaModificacion: registro.fecha,
  motivo: registro.motivo || '',
  ip: registro.ip || ''
});
const { generarFacturaPorComprobante } = require('./facturaController');

// Obtener todos los comprobantes pendientes
const obtenerComprobantesPendientes = async (req, res) => {
  try {
    const comprobantes = await Comprobante.find({ 
      estado: 'pendiente' 
    }).sort({ fecha: -1 });

    res.json({ comprobantes });
  } catch (error) {
    console.error('Error al obtener comprobantes:', error);
    res.status(500).json({ mensaje: 'Error al obtener comprobantes pendientes' });
  }
};

// Obtener todos los comprobantes con filtros
const obtenerTodosLosComprobantes = async (req, res) => {
  try {
    const { estado, fechaDesde, fechaHasta, busqueda, ordenPor = 'fecha', orden = 'desc' } = req.query;

    // Construir filtros
    let filtros = {};

    // Filtro por estado
    if (estado && estado !== 'todos') {
      filtros.estado = estado;
    }

    // Filtro por rango de fechas
    if (fechaDesde || fechaHasta) {
      filtros.fecha = {};
      if (fechaDesde) {
        filtros.fecha.$gte = new Date(fechaDesde);
      }
      if (fechaHasta) {
        const fechaFin = new Date(fechaHasta);
        fechaFin.setHours(23, 59, 59, 999); // Incluir todo el día
        filtros.fecha.$lte = fechaFin;
      }
    }

    // Filtro por búsqueda (número de comprobante o DNI). El término se escapa: sin eso, lo que
    // el admin escribe en el buscador se ejecuta como expresión regular contra la colección.
    if (aTexto(busqueda).trim() !== '') {
      const termino = escaparRegex(aTexto(busqueda).trim());
      filtros.$or = [
        { nroComprobante: { $regex: termino, $options: 'i' } },
        { 'usuario.dni': { $regex: termino, $options: 'i' } },
        { 'usuario.nombre': { $regex: termino, $options: 'i' } },
        { 'usuario.apellido': { $regex: termino, $options: 'i' } }
      ];
    }

    // Configurar ordenamiento
    const ordenamientos = {
      fecha: { fecha: orden === 'desc' ? -1 : 1 },
      monto: { montoAcreditado: orden === 'desc' ? -1 : 1 },
      estado: { estado: orden === 'desc' ? -1 : 1 },
      comprobante: { nroComprobante: orden === 'desc' ? -1 : 1 }
    };

    const ordenamiento = ordenamientos[ordenPor] || { fecha: -1 };

    // Calcular skip para paginación
    const { pagina, limite, salto: skip } = paginar(req.query, { porDefecto: 50 });

    // Obtener comprobantes con paginación
    const [comprobantes, total] = await Promise.all([
      Comprobante.find(filtros)
        .sort(ordenamiento)
        .skip(skip)
        .limit(limite),
      Comprobante.countDocuments(filtros)
    ]);

    // Calcular estadísticas
    const estadisticas = await Comprobante.aggregate([
      { $match: filtros },
      {
        $group: {
          _id: null,
          totalMonto: { $sum: '$montoAcreditado' },
          pendientes: {
            $sum: { $cond: [{ $eq: ['$estado', 'pendiente'] }, 1, 0] }
          },
          aprobados: {
            $sum: { $cond: [{ $eq: ['$estado', 'aprobado'] }, 1, 0] }
          },
          rechazados: {
            $sum: { $cond: [{ $eq: ['$estado', 'rechazado'] }, 1, 0] }
          }
        }
      }
    ]);

    const stats = estadisticas[0] || {
      totalMonto: 0,
      pendientes: 0,
      aprobados: 0,
      rechazados: 0
    };

    res.json({
      success: true,
      comprobantes,
      paginacion: { total, pagina, limite, totalPaginas: totalPaginas(total, limite) },
      estadisticas: stats,
      filtros: {
        estado,
        fechaDesde,
        fechaHasta,
        busqueda,
        ordenPor,
        orden
      }
    });

  } catch (error) {
    console.error('Error al obtener comprobantes:', error);
    res.status(500).json({ 
      success: false,
      mensaje: 'Error al obtener comprobantes' 
    });
  }
};

// Validar un comprobante
const validarComprobante = async (req, res) => {
  try {
    const { nroComprobante } = req.params;
    const adminDni = req.usuario.dni; // DNI del admin que aprueba
    
    // Buscar el comprobante
    const comprobante = await Comprobante.findOne({ nroComprobante });
    if (!comprobante) {
      return res.status(404).json({ mensaje: 'Comprobante no encontrado' });
    }

    // Verificar que esté pendiente
    if (comprobante.estado !== 'pendiente') {
      return res.status(400).json({ mensaje: 'Este comprobante ya ha sido procesado' });
    }

    // Buscar el usuario
    const usuario = await Usuario.findOne({ dni: comprobante.usuario.dni });
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    // Actualizar saldo del usuario
    usuario.montoDisponible = (usuario.montoDisponible || 0) + comprobante.montoAcreditado;
    await usuario.save();

    // Actualizar estado del comprobante
    comprobante.estado = 'aprobado';
    await comprobante.save();

    await auditoriaService.registrar({
      entidad: 'Comprobante',
      entidadId: comprobante._id,
      accion: 'aprobar_comprobante',
      usuarioId: req.usuarioActual?._id ?? null,
      usuarioDni: adminDni,
      datosNuevos: { nroComprobante, montoAcreditado: comprobante.montoAcreditado, usuarioDni: usuario.dni }
    });

    // Generar factura automáticamente
    let facturaGenerada = null;
    try {
      facturaGenerada = await generarFacturaPorComprobante(nroComprobante, adminDni);
      console.log(`Factura generada: ${facturaGenerada.nroFactura}`);
    } catch (facturaError) {
      console.error('Error al generar factura:', facturaError);
      // No fallar la validación si hay error en la factura
    }

    res.json({ 
      mensaje: 'Comprobante aprobado exitosamente',
      montoDisponible: usuario.montoDisponible,
      facturaGenerada: facturaGenerada ? {
        nroFactura: facturaGenerada.nroFactura,
        total: facturaGenerada.total
      } : null
    });
  } catch (error) {
    console.error('Error al validar comprobante:', error);
    res.status(500).json({ mensaje: 'Error al validar comprobante' });
  }
};

// Rechazar un comprobante
const rechazarComprobante = async (req, res) => {
  try {
    const { nroComprobante } = req.params;
    
    const comprobante = await Comprobante.findOne({ nroComprobante });
    if (!comprobante) {
      return res.status(404).json({ mensaje: 'Comprobante no encontrado' });
    }

    if (comprobante.estado !== 'pendiente') {
      return res.status(400).json({ mensaje: 'Este comprobante ya ha sido procesado' });
    }

    // Buscar si existe una factura relacionada con este comprobante
    const Factura = require('../models/Factura');
    const facturaRelacionada = await Factura.findOne({
      'comprobanteRelacionado.nroComprobante': nroComprobante
    });

    // Rechazar el comprobante
    comprobante.estado = 'rechazado';
    await comprobante.save();

    await auditoriaService.registrar({
      entidad: 'Comprobante',
      entidadId: comprobante._id,
      accion: 'rechazar_comprobante',
      usuarioId: req.usuarioActual?._id ?? null,
      usuarioDni: req.usuario.dni,
      datosNuevos: { nroComprobante }
    });

    let mensajeFactura = '';
    
    // Si existe una factura relacionada, también anularla
    if (facturaRelacionada && facturaRelacionada.estado !== 'anulada') {
      // Verificar si aún está dentro del período de anulación ARCA (15 días)
      const fechaEmision = new Date(facturaRelacionada.fechaEmision);
      const fechaActual = new Date();
      const diferenciaDias = Math.floor((fechaActual - fechaEmision) / (1000 * 60 * 60 * 24));

      if (diferenciaDias <= 15) {
        facturaRelacionada.estado = 'anulada';
        facturaRelacionada.motivoAnulacion = `Anulación automática por rechazo del comprobante ${nroComprobante}`;
        facturaRelacionada.fechaAnulacion = new Date();
        await facturaRelacionada.save();
        
        mensajeFactura = ` La factura ${facturaRelacionada.nroFactura} también fue anulada automáticamente.`;
      } else {
        mensajeFactura = ` ATENCIÓN: Existe una factura asociada (${facturaRelacionada.nroFactura}) que no pudo ser anulada automáticamente porque han transcurrido más de 15 días desde su emisión (${diferenciaDias} días). Deberá ser anulada manualmente según procedimientos ARCA.`;
      }
    }

    res.json({ 
      mensaje: `Comprobante rechazado exitosamente.${mensajeFactura}`,
      facturaAfectada: facturaRelacionada ? {
        nroFactura: facturaRelacionada.nroFactura,
        estadoAnulacion: facturaRelacionada.estado,
        puedeAnularse: facturaRelacionada ? Math.floor((new Date() - new Date(facturaRelacionada.fechaEmision)) / (1000 * 60 * 60 * 24)) <= 15 : false
      } : null
    });
  } catch (error) {
    console.error('Error al rechazar comprobante:', error);
    res.status(500).json({ mensaje: 'Error al rechazar comprobante' });
  }
};

// Obtener todos los usuarios activos
const obtenerTodosLosUsuarios = async (req, res) => {
  try {
    const usuarios = await Usuario.find({ activo: true })
      .select('-password')  // Excluir contraseñas
      .sort({ fechaRegistro: -1 }); // Ordenar por fecha de registro (más recientes primero)

    res.json({ usuarios });
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ mensaje: 'Error al obtener usuarios' });
  }
};

// Obtener todos los vehículos
const obtenerTodosLosVehiculos = async (req, res) => {
  try {
    const vehiculos = await Vehiculo.find({})
      .populate('usuario', 'nombre apellido dni asociado _id')  // Incluir datos del usuario incluyendo asociado
      .sort({ dominio: 1 });

    // Transformar los datos para incluir la información del usuario
    const vehiculosConUsuario = vehiculos.map(vehiculo => ({
      _id: vehiculo._id,
      dominio: vehiculo.dominio,
      tipo: vehiculo.tipo,
      marca: vehiculo.marca,
      modelo: vehiculo.modelo,
      año: vehiculo.año,
      fechaRegistro: vehiculo.createdAt, // Agregar fecha de registro
      usuario: vehiculo.usuario ? vehiculo.usuario._id : null, // ID del usuario
      propietario: vehiculo.usuario ? {
        nombre: vehiculo.usuario.nombre,
        apellido: vehiculo.usuario.apellido,
        dni: vehiculo.usuario.dni,
        asociado: vehiculo.usuario.asociado, // Agregar el campo asociado
        _id: vehiculo.usuario._id
      } : null
    }));

    res.json({ vehiculos: vehiculosConUsuario });
  } catch (error) {
    console.error('Error al obtener vehículos:', error);
    res.status(500).json({ mensaje: 'Error al obtener vehículos' });
  }
};

// Modificar usuario (admin)
const modificarUsuario = async (req, res) => {
  try {
    const { dni } = req.params;
    const { nombre, apellido, email, rol, asociado, montoDisponible, motivo } = req.body;
    const adminDni = req.usuario.dni; // Del middleware de auth

    // Buscar el usuario
    const usuario = await Usuario.findOne({ dni });
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    // Buscar datos del admin que modifica
    const adminModificador = await Usuario.findOne({ dni: adminDni }).select('-password');
    if (!adminModificador) {
      return res.status(400).json({ mensaje: 'Administrador no encontrado' });
    }

    // Verificar si el email ya está en uso por otro usuario
    if (email && email !== usuario.email) {
      const emailExistente = await Usuario.findOne({ 
        email, 
        dni: { $ne: dni } 
      });
      if (emailExistente) {
        return res.status(400).json({ mensaje: 'El email ya está en uso por otro usuario' });
      }
    }

    // Guardar saldo anterior para el log
    const saldoAnterior = usuario.montoDisponible || 0;
    let logSaldo = null;

    // Actualizar campos
    if (nombre) usuario.nombre = nombre;
    if (apellido) usuario.apellido = apellido;
    if (email) usuario.email = email;
    // El enum del modelo tiene tres roles desde la Etapa 1: dejar 'operador' fuera de esta
    // lista hacía que el cambio de rol a cajero se ignorara en silencio desde esta pantalla.
    if (rol && ['cliente', 'admin', 'operador'].includes(rol)) usuario.rol = rol;
    if (typeof asociado === 'boolean') usuario.asociado = asociado;
    
    // Si se modifica el saldo, crear log
    if (typeof montoDisponible === 'number' && montoDisponible !== saldoAnterior) {
      // `typeof number` deja pasar NaN, Infinity y los negativos. Un saldo NaN rompe todas las
      // cuentas río abajo sin decir por qué, y un saldo negativo es una deuda que el sistema
      // no sabe cobrar: el cliente entra igual y el número se hace más chico.
      if (!Number.isFinite(montoDisponible) || montoDisponible < 0) {
        return res.status(400).json({ mensaje: 'El saldo debe ser un número mayor o igual a 0' });
      }
      if (!motivo || motivo.trim() === '') {
        return res.status(400).json({
          mensaje: 'El motivo es obligatorio cuando se modifica el saldo'
        });
      }

      usuario.montoDisponible = montoDisponible;
      const diferencia = montoDisponible - saldoAnterior;

      logSaldo = { diferencia };
      await auditoriaService.registrar({
        entidad: auditoriaService.ENTIDADES.USUARIO,
        entidadId: usuario.dni,
        accion: diferencia > 0 ? 'saldo_ajuste_admin' : 'saldo_correccion',
        usuarioId: adminModificador._id,
        actor: auditoriaService.persona(adminModificador),
        afectado: auditoriaService.persona(usuario),
        ip: req.ip || '',
        datosAnteriores: { saldo: saldoAnterior },
        datosNuevos: { saldo: montoDisponible, diferencia },
        motivo: motivo.trim()
      });
    }

    await usuario.save();

    // Devolver usuario actualizado sin contraseña
    const usuarioActualizado = usuario.toObject();
    delete usuarioActualizado.password;

    const respuesta = { 
      mensaje: 'Usuario actualizado correctamente',
      usuario: usuarioActualizado
    };

    if (logSaldo) {
      respuesta.cambioSaldo = {
        anterior: saldoAnterior,
        nuevo: montoDisponible,
        diferencia: logSaldo.diferencia
      };
    }

    res.json(respuesta);
  } catch (error) {
    console.error('Error al modificar usuario:', error);
    res.status(500).json({ mensaje: 'Error al modificar usuario' });
  }
};

// Desactivar usuario (admin) - No eliminamos físicamente
const eliminarUsuario = async (req, res) => {
  try {
    const { dni } = req.params;

    // Buscar el usuario
    const usuario = await Usuario.findOne({ dni });
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    // Verificar que no sea un admin
    if (usuario.rol === 'admin') {
      return res.status(400).json({ mensaje: 'No se puede desactivar un usuario administrador' });
    }

    // Verificar si ya está desactivado
    if (!usuario.activo) {
      return res.status(400).json({ mensaje: 'El usuario ya está desactivado' });
    }

    // Generar identificadores únicos para evitar conflictos en re-registros
    const timestamp = Date.now();
    const dniDesactivado = `${dni}_DESACTIVADO_${timestamp}`;
    const emailDesactivado = `${usuario.email}_DESACTIVADO_${timestamp}`;

    // Desactivar el usuario y limpiar datos sensibles
    usuario.activo = false;
    usuario.fechaDesactivacion = new Date();
    usuario.dni = dniDesactivado;
    usuario.email = emailDesactivado;
    usuario.tokenVerificacion = null;
    usuario.tokenRecuperacion = null;
    usuario.fechaTokenRecuperacion = null;

    await usuario.save();

    res.json({ 
      mensaje: 'Usuario desactivado correctamente. El DNI y email están disponibles para nuevos registros.',
      dniOriginal: dni
    });
  } catch (error) {
    console.error('Error al desactivar usuario:', error);
    res.status(500).json({ mensaje: 'Error al desactivar usuario' });
  }
};

// Obtener usuarios desactivados
const obtenerUsuariosDesactivados = async (req, res) => {
  try {
    const usuarios = await Usuario.find({ activo: false })
      .select('-password')  // Excluir contraseñas
      .sort({ fechaDesactivacion: -1 }); // Ordenar por fecha de desactivación

    res.json({ usuarios });
  } catch (error) {
    console.error('Error al obtener usuarios desactivados:', error);
    res.status(500).json({ mensaje: 'Error al obtener usuarios desactivados' });
  }
};

// Reactivar usuario
const reactivarUsuario = async (req, res) => {
  try {
    const { dni, nuevoEmail } = req.body;

    // Buscar el usuario desactivado por su DNI original
    const usuario = await Usuario.findOne({ 
      dni: { $regex: `^${dni}_DESACTIVADO_` },
      activo: false 
    });

    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario desactivado no encontrado' });
    }

    // Verificar que el nuevo email no esté en uso
    const emailExistente = await Usuario.findOne({ 
      email: nuevoEmail,
      activo: true 
    });

    if (emailExistente) {
      return res.status(400).json({ mensaje: 'El email ya está en uso por otro usuario activo' });
    }

    // Verificar que el DNI original no esté en uso
    const dniExistente = await Usuario.findOne({ 
      dni: dni,
      activo: true 
    });

    if (dniExistente) {
      return res.status(400).json({ mensaje: 'El DNI ya está en uso por otro usuario activo' });
    }

    // Reactivar el usuario
    usuario.activo = true;
    usuario.dni = dni; // Restaurar DNI original
    usuario.email = nuevoEmail; // Asignar nuevo email
    usuario.fechaDesactivacion = null;
    usuario.verificado = false; // Requerir nueva verificación
    usuario.tokenVerificacion = null;
    usuario.password = null; // Requerir nueva contraseña

    await usuario.save();

    res.json({ 
      mensaje: 'Usuario reactivado correctamente. Deberá completar el proceso de verificación nuevamente.',
      usuario: {
        dni: usuario.dni,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        email: usuario.email
      }
    });
  } catch (error) {
    console.error('Error al reactivar usuario:', error);
    res.status(500).json({ mensaje: 'Error al reactivar usuario' });
  }
};

// Agregar vehículo (admin)
const agregarVehiculoAdmin = async (req, res) => {
  try {
    const { usuarioDni, dominio, tipo, marca, modelo, año, motivo } = req.body;
    const adminDni = req.usuario.dni; // Del middleware de auth

    // Validar campos requeridos
    if (!usuarioDni || !dominio || !tipo || !marca || !modelo || !año) {
      return res.status(400).json({ 
        mensaje: 'Todos los campos son requeridos (usuarioDni, dominio, tipo, marca, modelo, año)' 
      });
    }

    if (!motivo || motivo.trim() === '') {
      return res.status(400).json({ 
        mensaje: 'El motivo es obligatorio para agregar un vehículo' 
      });
    }

    // Buscar el usuario
    const usuario = await Usuario.findOne({ dni: usuarioDni });
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    // Buscar datos del admin que modifica
    const adminModificador = await Usuario.findOne({ dni: adminDni }).select('-password');
    if (!adminModificador) {
      return res.status(400).json({ mensaje: 'Administrador no encontrado' });
    }

    // Verificar si ya existe un vehículo con ese dominio
    const vehiculoExistente = await Vehiculo.findOne({
      dominio: dominio.toUpperCase()
    });
    
    if (vehiculoExistente) {
      return res.status(400).json({ 
        mensaje: 'Ya existe un vehículo con ese dominio' 
      });
    }

    // Crear el nuevo vehículo
    const vehiculo = new Vehiculo({
      usuario: usuario._id,
      dominio: dominio.toUpperCase(),
      tipo: tipo.toLowerCase(),
      marca,
      modelo,
      año
    });

    await vehiculo.save();

    // Asegurar que el usuario tenga el array de vehículos inicializado
    if (!usuario.vehiculos) {
      usuario.vehiculos = [];
    }

    // Agregar el vehículo al array del usuario también
    usuario.vehiculos.push({
      dominio: dominio.toUpperCase(),
      tipo: tipo.toLowerCase(),
      marca,
      modelo,
      año
    });
    await usuario.save();

    await auditoriaService.registrar({
      entidad: auditoriaService.ENTIDADES.VEHICULO,
      entidadId: vehiculo.dominio,
      accion: 'vehiculo_crear',
      usuarioId: adminModificador._id,
      actor: auditoriaService.persona(adminModificador),
      afectado: auditoriaService.persona(usuario),
      ip: req.ip || '',
      datosAnteriores: null,
      datosNuevos: {
        dominio: vehiculo.dominio,
        tipo: vehiculo.tipo,
        marca: vehiculo.marca,
        modelo: vehiculo.modelo,
        año: vehiculo.año
      },
      motivo: motivo.trim()
    });

    res.status(201).json({ 
      mensaje: 'Vehículo agregado correctamente',
      vehiculo: {
        _id: vehiculo._id,
        dominio: vehiculo.dominio,
        tipo: vehiculo.tipo,
        marca: vehiculo.marca,
        modelo: vehiculo.modelo,
        año: vehiculo.año,
        propietario: {
          nombre: usuario.nombre,
          apellido: usuario.apellido,
          dni: usuario.dni,
          _id: usuario._id
        }
      },
      logId: logVehiculo._id
    });

  } catch (error) {
    console.error('Error al agregar vehículo:', error);
    res.status(500).json({ mensaje: 'Error al agregar vehículo' });
  }
};

// Modificar vehículo (admin)
const modificarVehiculoAdmin = async (req, res) => {
  try {
    const { dominio } = req.params;
    const { nuevoDominio, tipo, marca, modelo, año, usuarioDni, motivo } = req.body;
    const adminDni = req.usuario.dni; // Del middleware de auth

    // Verificar que el motivo esté presente
    if (!motivo || motivo.trim() === '') {
      return res.status(400).json({ 
        mensaje: 'El motivo es obligatorio para modificar un vehículo' 
      });
    }

    // Buscar datos del admin que modifica
    const adminModificador = await Usuario.findOne({ dni: adminDni }).select('-password');
    if (!adminModificador) {
      return res.status(400).json({ mensaje: 'Administrador no encontrado' });
    }

    // Buscar el vehículo actual
    const vehiculoActual = await Vehiculo.findOne({ dominio: dominio.toUpperCase() })
      .populate('usuario', 'nombre apellido dni asociado _id email');
    
    if (!vehiculoActual) {
      return res.status(404).json({ mensaje: 'Vehículo no encontrado' });
    }

    // Verificar que el vehículo tenga un usuario asociado
    if (!vehiculoActual.usuario) {
      return res.status(400).json({ mensaje: 'El vehículo no tiene un usuario propietario válido' });
    }

    // Guardar datos originales para el log
    const datosOriginales = {
      dominio: vehiculoActual.dominio,
      tipo: vehiculoActual.tipo,
      marca: vehiculoActual.marca,
      modelo: vehiculoActual.modelo,
      año: vehiculoActual.año,
      propietario: {
        dni: vehiculoActual.usuario.dni,
        nombre: vehiculoActual.usuario.nombre,
        apellido: vehiculoActual.usuario.apellido,
        email: vehiculoActual.usuario.email
      }
    };

    // Si se cambia el dominio, verificar que no exista
    if (nuevoDominio && nuevoDominio.toUpperCase() !== dominio.toUpperCase()) {
      const existeVehiculo = await Vehiculo.findOne({ 
        dominio: nuevoDominio.toUpperCase() 
      });
      
      if (existeVehiculo) {
        return res.status(400).json({ 
          mensaje: 'Ya existe un vehículo con ese dominio' 
        });
      }
    }

    // Si se cambia el usuario propietario
    let nuevoUsuario = vehiculoActual.usuario;
    let huboCambioPropietario = false;
    
    if (usuarioDni && usuarioDni !== vehiculoActual.usuario.dni) {
      nuevoUsuario = await Usuario.findOne({ dni: usuarioDni });
      if (!nuevoUsuario) {
        return res.status(404).json({ mensaje: 'El nuevo usuario propietario no existe' });
      }
      huboCambioPropietario = true;

      // Remover el vehículo del usuario anterior
      const usuarioAnterior = await Usuario.findById(vehiculoActual.usuario._id);
      if (usuarioAnterior && usuarioAnterior.vehiculos) {
        usuarioAnterior.vehiculos = usuarioAnterior.vehiculos.filter(
          v => v.dominio.toUpperCase() !== dominio.toUpperCase()
        );
        await usuarioAnterior.save();
      }
    }

    // Preparar cambios realizados para el log
    const cambiosRealizados = {};
    if (nuevoDominio && nuevoDominio.toUpperCase() !== vehiculoActual.dominio) {
      cambiosRealizados.dominio = {
        anterior: vehiculoActual.dominio,
        nuevo: nuevoDominio.toUpperCase()
      };
    }
    if (tipo && tipo.toLowerCase() !== vehiculoActual.tipo) {
      cambiosRealizados.tipo = {
        anterior: vehiculoActual.tipo,
        nuevo: tipo.toLowerCase()
      };
    }
    if (marca && marca !== vehiculoActual.marca) {
      cambiosRealizados.marca = {
        anterior: vehiculoActual.marca,
        nuevo: marca
      };
    }
    if (modelo && modelo !== vehiculoActual.modelo) {
      cambiosRealizados.modelo = {
        anterior: vehiculoActual.modelo,
        nuevo: modelo
      };
    }
    if (año && año !== vehiculoActual.año) {
      cambiosRealizados.año = {
        anterior: vehiculoActual.año,
        nuevo: año
      };
    }

    // Actualizar el vehículo
    const dominioFinal = nuevoDominio ? nuevoDominio.toUpperCase() : vehiculoActual.dominio;
    vehiculoActual.dominio = dominioFinal;
    if (tipo) vehiculoActual.tipo = tipo.toLowerCase();
    if (marca) vehiculoActual.marca = marca;
    if (modelo) vehiculoActual.modelo = modelo;
    if (año) vehiculoActual.año = año;
    vehiculoActual.usuario = nuevoUsuario._id;

    await vehiculoActual.save();

    // Asegurar que el usuario tenga el array de vehículos inicializado
    if (!nuevoUsuario.vehiculos) {
      nuevoUsuario.vehiculos = [];
    }

    // Actualizar/agregar en el array de vehículos del usuario (nuevo o actual)
    const vehiculoIndex = nuevoUsuario.vehiculos.findIndex(
      v => v.dominio.toUpperCase() === dominio.toUpperCase()
    );

    const vehiculoData = {
      dominio: dominioFinal,
      tipo: vehiculoActual.tipo,
      marca: vehiculoActual.marca,
      modelo: vehiculoActual.modelo,
      año: vehiculoActual.año
    };

    if (vehiculoIndex === -1) {
      nuevoUsuario.vehiculos.push(vehiculoData);
    } else {
      nuevoUsuario.vehiculos[vehiculoIndex] = vehiculoData;
    }

    await nuevoUsuario.save();

    // Determinar tipo de operación para el log
    let tipoOperacion = 'modificar';
    if (huboCambioPropietario) {
      tipoOperacion = 'cambio_propietario';
    }

    await auditoriaService.registrar({
      entidad: auditoriaService.ENTIDADES.VEHICULO,
      entidadId: vehiculoActual.dominio,
      accion: `vehiculo_${tipoOperacion}`,
      usuarioId: adminModificador._id,
      actor: auditoriaService.persona(adminModificador),
      afectado: auditoriaService.persona(nuevoUsuario),
      ip: req.ip || '',
      datosAnteriores: {
        dominio: vehiculoActual.dominio,
        tipo: vehiculoActual.tipo,
        marca: vehiculoActual.marca,
        modelo: vehiculoActual.modelo,
        año: vehiculoActual.año,
        propietario: huboCambioPropietario ? datosOriginales.propietario : undefined
      },
      datosNuevos: {
        ...cambiosRealizados,
        propietario: auditoriaService.persona(nuevoUsuario)
      },
      motivo: motivo.trim()
    });

    res.json({ 
      mensaje: 'Vehículo actualizado correctamente',
      vehiculo: {
        _id: vehiculoActual._id,
        dominio: vehiculoActual.dominio,
        tipo: vehiculoActual.tipo,
        marca: vehiculoActual.marca,
        modelo: vehiculoActual.modelo,
        año: vehiculoActual.año,
        propietario: {
          nombre: nuevoUsuario.nombre,
          apellido: nuevoUsuario.apellido,
          dni: nuevoUsuario.dni,
          _id: nuevoUsuario._id
        }
      },
      logId: logVehiculo._id
    });

  } catch (error) {
    console.error('Error al modificar vehículo:', error);
    res.status(500).json({ mensaje: 'Error al modificar vehículo' });
  }
};

// Eliminar vehículo (admin)
const eliminarVehiculoAdmin = async (req, res) => {
  try {
    const { dominio } = req.params;
    const { motivo } = req.body;
    const adminDni = req.usuario.dni; // Del middleware de auth

    // Verificar que el motivo esté presente
    if (!motivo || motivo.trim() === '') {
      return res.status(400).json({ 
        mensaje: 'El motivo es obligatorio para eliminar un vehículo' 
      });
    }

    // Buscar datos del admin que elimina
    const adminModificador = await Usuario.findOne({ dni: adminDni }).select('-password');
    if (!adminModificador) {
      return res.status(400).json({ mensaje: 'Administrador no encontrado' });
    }
    
    // Buscar el vehículo
    const vehiculo = await Vehiculo.findOne({ dominio: dominio.toUpperCase() })
      .populate('usuario', 'nombre apellido dni asociado _id email');

    if (!vehiculo) {
      return res.status(404).json({ mensaje: 'Vehículo no encontrado' });
    }

    // Con el auto adentro, borrarlo del catálogo deja la estadía activa —que todavía hay que
    // cobrar— apuntando a una patente que ya no existe.
    const adentro = await Estacionamiento.exists({ vehiculoDominio: vehiculo.dominio, estado: 'activo' });
    if (adentro) {
      return res.status(409).json({ mensaje: 'El vehículo está dentro de la playa. Registrá la salida antes de eliminarlo.' });
    }

    // Guardar datos para el log antes de eliminar
    const datosVehiculo = {
      dominio: vehiculo.dominio,
      tipo: vehiculo.tipo,
      marca: vehiculo.marca,
      modelo: vehiculo.modelo,
      año: vehiculo.año
    };

    // vehiculo.usuario puede ser null desde Etapa 2 (vehículo de cliente ocasional/caja).
    const datosPropietario = vehiculo.usuario ? {
      dni: vehiculo.usuario.dni,
      nombre: vehiculo.usuario.nombre,
      apellido: vehiculo.usuario.apellido,
      email: vehiculo.usuario.email
    } : null;

    // Remover del array de vehículos del usuario (solo si tiene uno)
    if (vehiculo.usuario) {
      const usuario = await Usuario.findById(vehiculo.usuario._id);
      if (usuario && usuario.vehiculos) {
        usuario.vehiculos = usuario.vehiculos.filter(
          v => v.dominio.toUpperCase() !== dominio.toUpperCase()
        );
        await usuario.save();
      }
    }

    // Eliminar el vehículo
    await Vehiculo.deleteOne({ _id: vehiculo._id });

    await auditoriaService.registrar({
      entidad: auditoriaService.ENTIDADES.VEHICULO,
      entidadId: datosVehiculo.dominio,
      accion: 'vehiculo_eliminar',
      usuarioId: adminModificador._id,
      actor: auditoriaService.persona(adminModificador),
      afectado: datosPropietario,
      ip: req.ip || '',
      datosAnteriores: datosVehiculo,
      datosNuevos: null,
      motivo: motivo.trim()
    });

    res.json({ mensaje: 'Vehículo eliminado correctamente' });

  } catch (error) {
    console.error('Error al eliminar vehículo:', error);
    res.status(500).json({ mensaje: 'Error al eliminar vehículo' });
  }
};

// Obtener historial de cambios de saldo
const obtenerHistorialSaldos = async (req, res) => {
  try {
    const { usuarioDni } = req.query;
    
    const filtro = { accion: { $regex: '^saldo_' } };
    if (usuarioDni) filtro['afectado.dni'] = usuarioDni;

    const { pagina, limite, salto: skip } = paginar(req.query, { porDefecto: 50 });

    const [registros, total] = await Promise.all([
      AuditLog.find(filtro).sort({ fecha: -1 }).skip(skip).limit(limite).lean(),
      AuditLog.countDocuments(filtro)
    ]);

    res.json({
      success: true,
      historial: registros.map(aFormaHistorialSaldo),
      pagination: {
        total,
        pagina: parseInt(pagina),
        limite: parseInt(limite),
        totalPaginas: Math.ceil(total / parseInt(limite))
      }
    });
  } catch (error) {
    console.error('Error al obtener historial de saldos:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error interno del servidor'
    });
  }
};

// Obtener estadísticas de cambios de saldo
const obtenerEstadisticasSaldos = async (req, res) => {
  try {
    const soloSaldos = { accion: { $regex: '^saldo_' } };
    const totalCambios = await AuditLog.countDocuments(soloSaldos);

    const cambiosPorTipo = await AuditLog.aggregate([
      { $match: soloSaldos },
      {
        $group: {
          _id: { $replaceOne: { input: '$accion', find: 'saldo_', replacement: '' } },
          cantidad: { $sum: 1 },
          montoTotal: { $sum: '$datosNuevos.diferencia' },
          ultimoCambio: { $max: '$fecha' }
        }
      }
    ]);

    const cambiosPorAdmin = await AuditLog.aggregate([
      { $match: soloSaldos },
      {
        $group: {
          _id: '$actor.dni',
          nombre: { $first: '$actor.nombre' },
          apellido: { $first: '$actor.apellido' },
          cantidad: { $sum: 1 },
          montoTotalModificado: { $sum: { $abs: '$datosNuevos.diferencia' } },
          ultimoCambio: { $max: '$fecha' }
        }
      },
      { $sort: { cantidad: -1 } },
      { $limit: 10 }
    ]);

    const resumenMontos = await AuditLog.aggregate([
      { $match: soloSaldos },
      {
        $group: {
          _id: null,
          totalAumentado: {
            $sum: { $cond: [{ $gt: ['$datosNuevos.diferencia', 0] }, '$datosNuevos.diferencia', 0] }
          },
          totalDisminuido: {
            $sum: { $cond: [{ $lt: ['$datosNuevos.diferencia', 0] }, { $abs: '$datosNuevos.diferencia' }, 0] }
          },
          diferenciaNeta: { $sum: '$datosNuevos.diferencia' }
        }
      }
    ]);
    
    res.json({
      success: true,
      estadisticas: {
        totalCambios,
        cambiosPorTipo,
        cambiosPorAdmin,
        resumenMontos: resumenMontos[0] || {
          totalAumentado: 0,
          totalDisminuido: 0,
          diferenciaNeta: 0
        }
      }
    });
  } catch (error) {
    console.error('Error al obtener estadísticas de saldos:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error interno del servidor'
    });
  }
};

// Obtener historial de cambios de vehículos
const obtenerHistorialVehiculos = async (req, res) => {
  try {
    const { dominio, tipoOperacion, usuarioDni } = req.query;
    
    const filtro = { accion: { $regex: '^vehiculo_' } };

    if (dominio) {
      filtro.entidadId = regexContiene(aTexto(dominio).toUpperCase());
    }

    if (tipoOperacion) {
      filtro.accion = `vehiculo_${tipoOperacion}`;
    }

    if (usuarioDni) {
      filtro.$or = [
        { 'afectado.dni': usuarioDni },
        { 'datosAnteriores.propietario.dni': usuarioDni }
      ];
    }

    const { pagina, limite, salto: skip } = paginar(req.query, { porDefecto: 50 });

    const [registros, total] = await Promise.all([
      AuditLog.find(filtro).sort({ fecha: -1 }).skip(skip).limit(limite).lean(),
      AuditLog.countDocuments(filtro)
    ]);

    res.json({
      success: true,
      historial: registros.map(aFormaHistorialVehiculo),
      pagination: {
        total,
        pagina: parseInt(pagina),
        limite: parseInt(limite),
        totalPaginas: Math.ceil(total / parseInt(limite))
      }
    });
  } catch (error) {
    console.error('Error al obtener historial de vehículos:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error interno del servidor'
    });
  }
};

// Obtener estadísticas de cambios de vehículos
const obtenerEstadisticasVehiculos = async (req, res) => {
  try {
    const soloVehiculos = { accion: { $regex: '^vehiculo_' } };
    const totalCambios = await AuditLog.countDocuments(soloVehiculos);

    const cambiosPorTipo = await AuditLog.aggregate([
      { $match: soloVehiculos },
      {
        $group: {
          _id: { $replaceOne: { input: '$accion', find: 'vehiculo_', replacement: '' } },
          cantidad: { $sum: 1 },
          ultimoCambio: { $max: '$fecha' }
        }
      }
    ]);

    const cambiosPorAdmin = await AuditLog.aggregate([
      { $match: soloVehiculos },
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
      { $limit: 10 }
    ]);

    const vehiculosPorTipo = await AuditLog.aggregate([
      { $match: soloVehiculos },
      {
        $group: {
          // El tipo puede venir en los datos nuevos (alta/modificación) o en los anteriores
          // (eliminación), según la operación.
          _id: { $ifNull: ['$datosNuevos.tipo', '$datosAnteriores.tipo'] },
          cantidad: { $sum: 1 }
        }
      }
    ]);
    
    res.json({
      success: true,
      estadisticas: {
        totalCambios,
        cambiosPorTipo,
        cambiosPorAdmin,
        vehiculosPorTipo
      }
    });
  } catch (error) {
    console.error('Error al obtener estadísticas de vehículos:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error interno del servidor'
    });
  }
};

// Obtener ingresos al estacionamiento con filtros
const obtenerIngresos = async (req, res) => {
  try {
    const { 
      fechaDesde, 
      fechaHasta, 
      dominio, 
      dniPropietario,
      porton,
      tipoVehiculo
    } = req.query;
    
    let filtro = { tipo: 'ingreso' };
    
    // Filtros de fecha
    if (fechaDesde || fechaHasta) {
      filtro.fechaHora = {};
      if (fechaDesde) {
        filtro.fechaHora.$gte = new Date(fechaDesde);
      }
      if (fechaHasta) {
        const hasta = new Date(fechaHasta);
        hasta.setHours(23, 59, 59, 999); // Incluir todo el día
        filtro.fechaHora.$lte = hasta;
      }
    }
    
    // Filtro por dominio del vehículo
    if (dominio) {
      filtro['vehiculo.dominio'] = regexContiene(aTexto(dominio).toUpperCase());
    }
    
    // Filtro por DNI del propietario
    if (dniPropietario) {
      filtro['propietario.dni'] = dniPropietario;
    }
    
    // Filtro por portón
    if (porton) {
      filtro.porton = porton;
    }
    
    // Filtro por tipo de vehículo
    if (tipoVehiculo) {
      filtro['vehiculo.tipo'] = tipoVehiculo;
    }
    
    const { pagina, limite, salto: skip } = paginar(req.query, { porDefecto: 50 });
    
    const total = await Transaccion.countDocuments(filtro);
    const ingresos = await Transaccion.find(filtro)
      .populate('usuario', 'dni nombre apellido activo')
      .sort({ fechaHora: -1 })
      .skip(skip)
      .limit(limite);
    
    // Acá se descartaban las transacciones cuyo usuario no estuviera activo. Desde que existe
    // el cliente ocasional (Etapa 2) esas transacciones tienen `usuario: null`, así que el
    // panel de ingresos escondía todo lo que entra por caja — que es la mayoría del
    // movimiento de una playa. Y el total se calculaba sobre la página ya filtrada, con lo
    // cual la paginación siempre decía "una sola página".
    res.json({
      success: true,
      ingresos,
      pagination: { total, pagina, limite, totalPaginas: totalPaginas(total, limite) }
    });
  } catch (error) {
    console.error('Error al obtener ingresos:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error interno del servidor'
    });
  }
};

// Obtener egresos del estacionamiento con filtros
const obtenerEgresos = async (req, res) => {
  try {
    const { 
      fechaDesde, 
      fechaHasta, 
      dominio, 
      dniPropietario,
      porton,
      tipoVehiculo
    } = req.query;
    
    let filtro = { tipo: 'salida' };
    
    // Filtros de fecha
    if (fechaDesde || fechaHasta) {
      filtro.fechaHora = {};
      if (fechaDesde) {
        filtro.fechaHora.$gte = new Date(fechaDesde);
      }
      if (fechaHasta) {
        const hasta = new Date(fechaHasta);
        hasta.setHours(23, 59, 59, 999); // Incluir todo el día
        filtro.fechaHora.$lte = hasta;
      }
    }
    
    // Filtro por dominio del vehículo
    if (dominio) {
      filtro['vehiculo.dominio'] = regexContiene(aTexto(dominio).toUpperCase());
    }
    
    // Filtro por DNI del propietario
    if (dniPropietario) {
      filtro['propietario.dni'] = dniPropietario;
    }
    
    // Filtro por portón
    if (porton) {
      filtro.porton = porton;
    }
    
    // Filtro por tipo de vehículo
    if (tipoVehiculo) {
      filtro['vehiculo.tipo'] = tipoVehiculo;
    }
    
    const { pagina, limite, salto: skip } = paginar(req.query, { porDefecto: 50 });
    
    const total = await Transaccion.countDocuments(filtro);
    const egresos = await Transaccion.find(filtro)
      .populate('usuario', 'dni nombre apellido activo')
      .sort({ fechaHora: -1 })
      .skip(skip)
      .limit(limite);
    
    // Mismo caso que en ingresos: filtrar por usuario activo dejaba fuera del panel todos los
    // egresos de clientes ocasionales, y el total de la paginación salía de la página filtrada.
    res.json({
      success: true,
      egresos,
      pagination: { total, pagina, limite, totalPaginas: totalPaginas(total, limite) }
    });
  } catch (error) {
    console.error('Error al obtener egresos:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error interno del servidor'
    });
  }
};

// Obtener estadísticas de ingresos/egresos
const obtenerEstadisticasTransacciones = async (req, res) => {
  try {
    const { fechaDesde, fechaHasta } = req.query;
    
    let filtroFecha = {};
    if (fechaDesde || fechaHasta) {
      filtroFecha.fechaHora = {};
      if (fechaDesde) {
        filtroFecha.fechaHora.$gte = new Date(fechaDesde);
      }
      if (fechaHasta) {
        const hasta = new Date(fechaHasta);
        hasta.setHours(23, 59, 59, 999);
        filtroFecha.fechaHora.$lte = hasta;
      }
    }
    
    // Estadísticas generales
    const totalIngresos = await Transaccion.countDocuments({ 
      tipo: 'ingreso', 
      ...filtroFecha 
    });
    
    const totalEgresos = await Transaccion.countDocuments({ 
      tipo: 'salida', 
      ...filtroFecha 
    });
    
    const vehiculosActualmente = totalIngresos - totalEgresos;
    
    // Ingresos totales por día
    const ingresosPorDia = await Transaccion.aggregate([
      { $match: { tipo: 'ingreso', ...filtroFecha } },
      {
        $group: {
          _id: {
            año: { $year: '$fechaHora' },
            mes: { $month: '$fechaHora' },
            dia: { $dayOfMonth: '$fechaHora' }
          },
          cantidad: { $sum: 1 }
        }
      },
      { $sort: { '_id.año': -1, '_id.mes': -1, '_id.dia': -1 } },
      { $limit: 30 }
    ]);
    
    // Distribución por portón
    const porPorton = await Transaccion.aggregate([
      { $match: filtroFecha },
      {
        $group: {
          _id: { 
            porton: '$porton',
            tipo: '$tipo'
          },
          cantidad: { $sum: 1 }
        }
      }
    ]);
    
    // Distribución por tipo de vehículo
    const porTipoVehiculo = await Transaccion.aggregate([
      { $match: filtroFecha },
      {
        $group: {
          _id: {
            tipoVehiculo: '$vehiculo.tipo',
            tipo: '$tipo'
          },
          cantidad: { $sum: 1 }
        }
      }
    ]);
    
    // Recaudación total (solo egresos tienen monto)
    const recaudacionTotal = await Transaccion.aggregate([
      { $match: { tipo: 'salida', ...filtroFecha } },
      {
        $group: {
          _id: null,
          totalRecaudado: { $sum: '$montoTotal' },
          promedioEstadia: { $avg: '$duracionHorasReal' }
        }
      }
    ]);
    
    res.json({
      success: true,
      estadisticas: {
        resumen: {
          totalIngresos,
          totalEgresos,
          vehiculosActualmente,
          totalRecaudado: recaudacionTotal[0]?.totalRecaudado || 0,
          promedioEstadia: recaudacionTotal[0]?.promedioEstadia || 0
        },
        ingresosPorDia,
        distribucion: {
          porPorton,
          porTipoVehiculo
        }
      }
    });
  } catch (error) {
    console.error('Error al obtener estadísticas de transacciones:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error interno del servidor'
    });
  }
};

module.exports = {
  obtenerComprobantesPendientes,
  obtenerTodosLosComprobantes,
  validarComprobante,
  rechazarComprobante,
  obtenerTodosLosUsuarios,
  obtenerTodosLosVehiculos,
  modificarUsuario,
  eliminarUsuario,
  obtenerUsuariosDesactivados,
  reactivarUsuario,
  agregarVehiculoAdmin,
  modificarVehiculoAdmin,
  eliminarVehiculoAdmin,
  obtenerHistorialSaldos,
  obtenerEstadisticasSaldos,
  obtenerHistorialVehiculos,
  obtenerEstadisticasVehiculos,
  obtenerIngresos,
  obtenerEgresos,
  obtenerEstadisticasTransacciones,
  obtenerHistorialConfiguracion: require('./configuracionEmpresaController').obtenerHistorialConfiguracion,
  obtenerEstadisticasConfiguracion: require('./configuracionEmpresaController').obtenerEstadisticasConfiguracion
};
