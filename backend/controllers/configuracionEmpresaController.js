const ConfiguracionEmpresa = require('../models/ConfiguracionEmpresa');
const LogConfiguracionEmpresa = require('../models/LogConfiguracionEmpresa');
const Usuario = require('../models/Usuario');

// Obtener configuración actual
const obtenerConfiguracion = async (req, res) => {
  try {
    let configuracion = await ConfiguracionEmpresa.obtenerConfiguracionActiva();
    
    if (!configuracion) {
      // Si no existe configuración, crear una por defecto
      configuracion = new ConfiguracionEmpresa({
        razonSocial: 'Mi Empresa S.A.',
        cuit: '30-12345678-9',
        inicioActividades: new Date(),
        domicilio: {
          calle: 'Av. Ejemplo',
          numero: '123',
          localidad: 'Buenos Aires',
          provincia: 'Buenos Aires',
          codigoPostal: '1000'
        },
        condicionIva: 'IVA Responsable Inscripto',
        puntoVenta: '00001',
        actualizadoPor: {
          dni: req.usuario.dni,
          nombre: req.usuario.nombre,
          apellido: req.usuario.apellido
        }
      });
      
      await configuracion.save();
    }

    res.json({
      success: true,
      configuracion
    });

  } catch (error) {
    console.error('Error al obtener configuración:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error al obtener configuración de empresa'
    });
  }
};

// Actualizar configuración
const actualizarConfiguracion = async (req, res) => {
  try {
    const datosConfiguracion = req.body;
    
    // Obtener información del usuario que realiza el cambio
    const usuario = await Usuario.findById(req.usuario.id).select('dni nombre apellido email');
    if (!usuario) {
      return res.status(404).json({
        success: false,
        mensaje: 'Usuario no encontrado'
      });
    }

    // Validar CUIT si se proporciona
    if (datosConfiguracion.cuit) {
      const cuitRegex = /^\d{2}-\d{8}-\d{1}$/;
      if (!cuitRegex.test(datosConfiguracion.cuit)) {
        return res.status(400).json({
          success: false,
          mensaje: 'CUIT debe tener el formato XX-XXXXXXXX-X'
        });
      }
    }

    // Validar punto de venta
    if (datosConfiguracion.puntoVenta) {
      const puntoVentaRegex = /^\d{5}$/;
      if (!puntoVentaRegex.test(datosConfiguracion.puntoVenta)) {
        return res.status(400).json({
          success: false,
          mensaje: 'Punto de venta debe tener exactamente 5 dígitos'
        });
      }
    }

    // Obtener configuración anterior para el log
    const configuracionAnterior = await ConfiguracionEmpresa.obtenerConfiguracionActiva();
    
    // Agregar datos de quien actualiza
    datosConfiguracion.actualizadoPor = {
      dni: req.usuario.dni,
      nombre: req.usuario.nombre,
      apellido: req.usuario.apellido
    };

    let configuracion;
    let tipoOperacion;
    let camposModificados = [];
    
    if (configuracionAnterior) {
      // Identificar campos modificados
      for (const [campo, valorNuevo] of Object.entries(datosConfiguracion)) {
        const valorAnterior = configuracionAnterior[campo];
        
        // Comparar valores (considerando objetos anidados)
        if (JSON.stringify(valorAnterior) !== JSON.stringify(valorNuevo)) {
          camposModificados.push({
            campo,
            valorAnterior,
            valorNuevo
          });
        }
      }
      
      // Actualizar configuración existente
      Object.assign(configuracionAnterior, datosConfiguracion);
      configuracion = configuracionAnterior;
      tipoOperacion = 'actualizar';
      await configuracion.save();
    } else {
      // Crear nueva configuración
      configuracion = new ConfiguracionEmpresa(datosConfiguracion);
      tipoOperacion = 'crear';
      await configuracion.save();
      
      // Para creación, todos los campos son "nuevos"
      camposModificados = Object.entries(datosConfiguracion).map(([campo, valor]) => ({
        campo,
        valorAnterior: null,
        valorNuevo: valor
      }));
    }

    // Crear log de la operación
    try {
      await LogConfiguracionEmpresa.crearLog({
        usuario: usuario._id,
        usuarioInfo: {
          dni: usuario.dni,
          nombre: usuario.nombre,
          apellido: usuario.apellido,
          email: usuario.email
        },
        tipoOperacion,
        configuracionAnterior: configuracionAnterior ? configuracionAnterior.toObject() : null,
        configuracionNueva: configuracion.toObject(),
        camposModificados,
        motivo: datosConfiguracion.motivo || `${tipoOperacion === 'crear' ? 'Creación' : 'Actualización'} de configuración de empresa`,
        ipUsuario: req.ip || req.connection.remoteAddress || ''
      });
    } catch (logError) {
      console.error('Error al crear log de configuración empresa:', logError);
      // No fallar la operación principal por error en el log
    }

    // Validar CUIT usando el método del modelo
    if (!configuracion.validarCuit()) {
      return res.status(400).json({
        success: false,
        mensaje: 'El CUIT ingresado no es válido según el algoritmo de verificación'
      });
    }

    res.json({
      success: true,
      mensaje: 'Configuración actualizada correctamente',
      configuracion
    });

  } catch (error) {
    console.error('Error al actualizar configuración:', error);
    
    if (error.name === 'ValidationError') {
      const errores = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        mensaje: 'Errores de validación',
        errores
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        mensaje: 'El CUIT ya está registrado en el sistema'
      });
    }

    res.status(500).json({
      success: false,
      mensaje: 'Error al actualizar configuración de empresa'
    });
  }
};

// Validar configuración para facturación
const validarConfiguracionFacturacion = async (req, res) => {
  try {
    const configuracion = await ConfiguracionEmpresa.obtenerConfiguracionActiva();
    
    if (!configuracion) {
      return res.status(404).json({
        success: false,
        mensaje: 'No hay configuración de empresa establecida'
      });
    }

    const errores = [];
    const advertencias = [];

    // Validaciones obligatorias
    if (!configuracion.razonSocial || configuracion.razonSocial.trim() === '') {
      errores.push('Razón social es obligatoria');
    }

    if (!configuracion.cuit) {
      errores.push('CUIT es obligatorio');
    } else if (!configuracion.validarCuit()) {
      errores.push('CUIT no es válido');
    }

    if (!configuracion.inicioActividades) {
      errores.push('Fecha de inicio de actividades es obligatoria');
    }

    if (!configuracion.domicilio.calle || !configuracion.domicilio.numero || 
        !configuracion.domicilio.localidad || !configuracion.domicilio.provincia) {
      errores.push('Domicilio fiscal incompleto');
    }

    if (!configuracion.condicionIva) {
      errores.push('Condición de IVA es obligatoria');
    }

    // Validaciones recomendadas
    if (!configuracion.contacto.telefono) {
      advertencias.push('Se recomienda agregar un teléfono de contacto');
    }

    if (!configuracion.contacto.email) {
      advertencias.push('Se recomienda agregar un email de contacto');
    }

    if (!configuracion.arca.certificadoDigital.activo) {
      advertencias.push('Certificado digital no configurado para facturación electrónica');
    }

    const esValida = errores.length === 0;

    res.json({
      success: true,
      esValida,
      errores,
      advertencias,
      configuracion
    });

  } catch (error) {
    console.error('Error al validar configuración:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error al validar configuración de empresa'
    });
  }
};

// Obtener próximo número de factura
const obtenerProximoNumero = async (req, res) => {
  try {
    const configuracion = await ConfiguracionEmpresa.obtenerConfiguracionActiva();
    
    if (!configuracion) {
      return res.status(404).json({
        success: false,
        mensaje: 'No hay configuración de empresa establecida'
      });
    }

    const proximoNumero = configuracion.numeracion.proximoNumero;
    const puntoVenta = configuracion.puntoVenta;
    
    res.json({
      success: true,
      proximoNumero,
      puntoVenta,
      formatoCompleto: `${puntoVenta}-${proximoNumero.toString().padStart(8, '0')}`
    });

  } catch (error) {
    console.error('Error al obtener próximo número:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error al obtener próximo número de factura'
    });
  }
};

// Obtener historial de cambios de configuración
const obtenerHistorialConfiguracion = async (req, res) => {
  try {
    const { 
      usuario, 
      tipoOperacion, 
      fechaDesde, 
      fechaHasta, 
      limite = 50,
      pagina = 1
    } = req.query;

    const filtros = {};
    
    if (usuario) {
      filtros.usuario = usuario;
    }
    
    if (tipoOperacion) {
      filtros.tipoOperacion = tipoOperacion;
    }
    
    if (fechaDesde || fechaHasta) {
      if (fechaDesde) filtros.fechaDesde = fechaDesde;
      if (fechaHasta) filtros.fechaHasta = fechaHasta;
    }

    const skip = (parseInt(pagina) - 1) * parseInt(limite);
    
    // Obtener logs con paginación
    const logs = await LogConfiguracionEmpresa.find(
      filtros.usuario ? { usuario: filtros.usuario } : {},
      null,
      {
        skip,
        limit: parseInt(limite),
        sort: { fecha: -1 }
      }
    ).populate('usuario', 'dni nombre apellido email activo');

    // Filtrar por otros criterios si es necesario
    let logsFiltrados = logs;
    
    if (filtros.tipoOperacion) {
      logsFiltrados = logs.filter(log => log.tipoOperacion === filtros.tipoOperacion);
    }
    
    if (filtros.fechaDesde || filtros.fechaHasta) {
      logsFiltrados = logs.filter(log => {
        const fechaLog = new Date(log.fecha);
        let cumpleFiltro = true;
        
        if (filtros.fechaDesde) {
          cumpleFiltro = cumpleFiltro && fechaLog >= new Date(filtros.fechaDesde);
        }
        
        if (filtros.fechaHasta) {
          cumpleFiltro = cumpleFiltro && fechaLog <= new Date(filtros.fechaHasta);
        }
        
        return cumpleFiltro;
      });
    }

    // Contar total para paginación
    const total = await LogConfiguracionEmpresa.countDocuments(
      filtros.usuario ? { usuario: filtros.usuario } : {}
    );

    res.json({
      success: true,
      logs: logsFiltrados,
      pagination: {
        total,
        pagina: parseInt(pagina),
        limite: parseInt(limite),
        totalPaginas: Math.ceil(total / parseInt(limite))
      }
    });

  } catch (error) {
    console.error('Error al obtener historial de configuración:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error al obtener historial de configuración de empresa'
    });
  }
};

// Obtener estadísticas de logs de configuración
const obtenerEstadisticasConfiguracion = async (req, res) => {
  try {
    const { fechaDesde, fechaHasta } = req.query;
    
    const filtroFecha = {};
    if (fechaDesde || fechaHasta) {
      filtroFecha.fecha = {};
      if (fechaDesde) filtroFecha.fecha.$gte = new Date(fechaDesde);
      if (fechaHasta) filtroFecha.fecha.$lte = new Date(fechaHasta);
    }

    // Estadísticas por tipo de operación
    const operacionesPorTipo = await LogConfiguracionEmpresa.aggregate([
      { $match: filtroFecha },
      {
        $group: {
          _id: '$tipoOperacion',
          cantidad: { $sum: 1 }
        }
      }
    ]);

    // Estadísticas por usuario
    const operacionesPorUsuario = await LogConfiguracionEmpresa.aggregate([
      { $match: filtroFecha },
      {
        $group: {
          _id: {
            usuario: '$usuario',
            dni: '$usuarioInfo.dni',
            nombre: '$usuarioInfo.nombre',
            apellido: '$usuarioInfo.apellido'
          },
          cantidad: { $sum: 1 },
          ultimaOperacion: { $max: '$fecha' }
        }
      },
      { $sort: { cantidad: -1 } }
    ]);

    // Campos más modificados
    const camposMasModificados = await LogConfiguracionEmpresa.aggregate([
      { $match: filtroFecha },
      { $unwind: '$camposModificados' },
      {
        $group: {
          _id: '$camposModificados.campo',
          cantidad: { $sum: 1 }
        }
      },
      { $sort: { cantidad: -1 } },
      { $limit: 10 }
    ]);

    // Total de operaciones
    const totalOperaciones = await LogConfiguracionEmpresa.countDocuments(filtroFecha);

    res.json({
      success: true,
      estadisticas: {
        totalOperaciones,
        operacionesPorTipo,
        operacionesPorUsuario,
        camposMasModificados
      }
    });

  } catch (error) {
    console.error('Error al obtener estadísticas de configuración:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error al obtener estadísticas de configuración de empresa'
    });
  }
};

module.exports = {
  obtenerConfiguracion,
  actualizarConfiguracion,
  validarConfiguracionFacturacion,
  obtenerProximoNumero,
  obtenerHistorialConfiguracion,
  obtenerEstadisticasConfiguracion
};
