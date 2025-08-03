const ConfiguracionPrecio = require('../models/ConfiguracionPrecio');
const LogPrecio = require('../models/LogPrecio');
const Usuario = require('../models/Usuario');

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

    // Validar que el tipo de usuario sea válido
    if (!['asociado', 'no_asociado'].includes(tipoUsuario)) {
      return res.status(400).json({
        success: false,
        mensaje: 'Tipo de usuario inválido'
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
    const configuracionActual = await ConfiguracionPrecio.findOne({ tipoUsuario });
    
    // Buscar y actualizar o crear si no existe
    const precioActualizado = await ConfiguracionPrecio.findOneAndUpdate(
      { tipoUsuario },
      {
        precioPorHora: Number(precioPorHora),
        descripcion: descripcion || '',
        fechaActualizacion: new Date(),
        actualizadoPor: dni
      },
      { 
        new: true, 
        upsert: true 
      }
    );

    // Crear entrada en el log de cambios
    const logEntry = new LogPrecio({
      tipoUsuario,
      precioAnterior: configuracionActual ? configuracionActual.precioPorHora : 0,
      precioNuevo: Number(precioPorHora),
      descripcionAnterior: configuracionActual ? configuracionActual.descripcion : '',
      descripcionNueva: descripcion || '',
      modificadoPor: {
        dni: usuarioModificador.dni,
        nombre: usuarioModificador.nombre,
        apellido: usuarioModificador.apellido,
        email: usuarioModificador.email
      },
      motivo: motivo || '',
      ip: req.ip || req.connection.remoteAddress || ''
    });

    await logEntry.save();

    res.json({
      success: true,
      mensaje: `Precio para ${tipoUsuario.replace('_', ' ')} actualizado correctamente`,
      precio: precioActualizado,
      logId: logEntry._id
    });
  } catch (error) {
    console.error('Error al actualizar precio:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error interno del servidor'
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
    
    const filtro = tipoUsuario && ['asociado', 'no_asociado'].includes(tipoUsuario) 
      ? { tipoUsuario } 
      : {};
    
    const skip = (parseInt(pagina) - 1) * parseInt(limite);
    
    const historial = await LogPrecio.find(filtro)
      .sort({ fechaModificacion: -1 })
      .limit(parseInt(limite))
      .skip(skip);
    
    const total = await LogPrecio.countDocuments(filtro);
    
    res.json({
      success: true,
      historial,
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
    const totalCambios = await LogPrecio.countDocuments();
    
    // Estadísticas por tipo de usuario con mejor formato
    const cambiosPorTipo = await LogPrecio.aggregate([
      {
        $group: {
          _id: '$tipoUsuario',
          cantidad: { $sum: 1 },
          ultimoCambio: { $max: '$fechaModificacion' }
        }
      },
      { $sort: { cantidad: -1 } }
    ]);
    
    // Estadísticas por tipo de operación
    const operacionesPorTipo = await LogPrecio.aggregate([
      {
        $addFields: {
          tipoOperacion: {
            $cond: {
              if: { $and: [{ $eq: ['$precioAnterior', null] }, { $ne: ['$precioNuevo', null] }] },
              then: 'creacion',
              else: {
                $cond: {
                  if: { $and: [{ $ne: ['$precioAnterior', null] }, { $eq: ['$precioNuevo', null] }] },
                  then: 'eliminacion',
                  else: 'modificacion'
                }
              }
            }
          }
        }
      },
      {
        $group: {
          _id: '$tipoOperacion',
          cantidad: { $sum: 1 }
        }
      }
    ]);
    
    // Administradores más activos
    const cambiosPorUsuario = await LogPrecio.aggregate([
      {
        $group: {
          _id: '$modificadoPor.dni',
          nombre: { $first: '$modificadoPor.nombre' },
          apellido: { $first: '$modificadoPor.apellido' },
          cantidad: { $sum: 1 },
          ultimoCambio: { $max: '$fechaModificacion' }
        }
      },
      { $sort: { cantidad: -1 } },
      { $limit: 5 }
    ]);

    // Actividad reciente (últimos 30 días)
    const fechaHace30Dias = new Date();
    fechaHace30Dias.setDate(fechaHace30Dias.getDate() - 30);
    
    const actividadReciente = await LogPrecio.countDocuments({
      fechaModificacion: { $gte: fechaHace30Dias }
    });

    // Cambios por mes (últimos 6 meses)
    const cambiosPorMes = await LogPrecio.aggregate([
      {
        $match: {
          fechaModificacion: { 
            $gte: new Date(new Date().setMonth(new Date().getMonth() - 6))
          }
        }
      },
      {
        $group: {
          _id: {
            año: { $year: '$fechaModificacion' },
            mes: { $month: '$fechaModificacion' }
          },
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

    // Validar precio
    if (precioPorHora < 0) {
      return res.status(400).json({
        success: false,
        mensaje: 'El precio debe ser un número mayor o igual a 0'
      });
    }

    // Verificar que no exista ya un precio para este tipo de usuario
    const precioExistente = await ConfiguracionPrecio.findOne({ 
      tipoUsuario: tipoUsuario.trim().toLowerCase() 
    });
    
    if (precioExistente) {
      return res.status(400).json({
        success: false,
        mensaje: 'Ya existe una configuración de precio para este tipo de usuario'
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
      fechaActualizacion: new Date()
    });

    await nuevoPrecio.save();

    // Crear entrada en el log de cambios
    const logEntry = new LogPrecio({
      tipoUsuario: nuevoPrecio.tipoUsuario,
      precioAnterior: null,
      precioNuevo: nuevoPrecio.precioPorHora,
      descripcionAnterior: '',
      descripcionNueva: nuevoPrecio.descripcion,
      motivo: 'Creación de nueva configuración de precio',
      modificadoPor: {
        dni: usuarioCreador.dni,
        nombre: usuarioCreador.nombre,
        apellido: usuarioCreador.apellido,
        email: usuarioCreador.email
      },
      ip: req.ip || req.connection.remoteAddress || '',
      fechaModificacion: new Date()
    });

    await logEntry.save();

    res.status(201).json({
      success: true,
      mensaje: 'Configuración de precio creada exitosamente',
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

    // Crear entrada en el log antes de eliminar
    const logEntry = new LogPrecio({
      tipoUsuario: configuracionPrecio.tipoUsuario,
      precioAnterior: configuracionPrecio.precioPorHora,
      precioNuevo: null,
      descripcionAnterior: configuracionPrecio.descripcion,
      descripcionNueva: '',
      motivo: 'Eliminación de configuración de precio',
      modificadoPor: {
        dni: usuarioEliminador.dni,
        nombre: usuarioEliminador.nombre,
        apellido: usuarioEliminador.apellido,
        email: usuarioEliminador.email
      },
      ip: req.ip || req.connection.remoteAddress || '',
      fechaModificacion: new Date()
    });

    await logEntry.save();

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
