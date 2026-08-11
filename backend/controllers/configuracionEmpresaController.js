const ConfiguracionEmpresa = require('../models/ConfiguracionEmpresa');
const AuditLog = require('../models/AuditLog');
const Usuario = require('../models/Usuario');
const auditoriaService = require('../services/auditoriaService');

// La auditoría de la configuración de empresa vive en AuditLog (antes en el modelo
// LogConfiguracionEmpresa). Se traduce a la forma vieja en la lectura para no romper la
// pantalla que la consume.
const aFormaLogEmpresa = (registro) => ({
  _id: registro._id,
  usuario: registro.usuarioId,
  usuarioInfo: registro.actor,
  tipoOperacion: registro.accion.replace('empresa_', ''),
  configuracionAnterior: registro.datosAnteriores ?? null,
  configuracionNueva: registro.datosNuevos?.configuracion ?? null,
  camposModificados: registro.datosNuevos?.camposModificados ?? [],
  fecha: registro.fecha,
  motivo: registro.motivo || '',
  ipUsuario: registro.ip || ''
});

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

    // auditoriaService ya absorbe sus propios errores: registrar la auditoría nunca puede
    // hacer fallar el guardado de la configuración.
    await auditoriaService.registrar({
      entidad: auditoriaService.ENTIDADES.EMPRESA,
      entidadId: configuracion._id,
      accion: `empresa_${tipoOperacion}`,
      usuarioId: usuario._id,
      actor: auditoriaService.persona(usuario),
      ip: req.ip || '',
      datosAnteriores: configuracionAnterior ? configuracionAnterior.toObject() : null,
      datosNuevos: { configuracion: configuracion.toObject(), camposModificados },
      motivo: datosConfiguracion.motivo || `${tipoOperacion === 'crear' ? 'Creación' : 'Actualización'} de configuración de empresa`
    });

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

    // Todos los filtros van ahora a la consulta, no a un filtrado en memoria posterior: antes
    // se traía una página y se la recortaba en Node, así que el total y la página no
    // coincidían con lo filtrado.
    const consulta = { accion: { $regex: '^empresa_' } };
    if (filtros.usuario) consulta.usuarioId = filtros.usuario;
    if (filtros.tipoOperacion) consulta.accion = `empresa_${filtros.tipoOperacion}`;
    if (filtros.fechaDesde || filtros.fechaHasta) {
      consulta.fecha = {};
      if (filtros.fechaDesde) consulta.fecha.$gte = new Date(filtros.fechaDesde);
      if (filtros.fechaHasta) consulta.fecha.$lte = new Date(filtros.fechaHasta);
    }

    const [registros, total] = await Promise.all([
      AuditLog.find(consulta).sort({ fecha: -1 }).skip(skip).limit(parseInt(limite)).lean(),
      AuditLog.countDocuments(consulta)
    ]);

    res.json({
      success: true,
      logs: registros.map(aFormaLogEmpresa),
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

    const soloEmpresa = { ...filtroFecha, accion: { $regex: '^empresa_' } };

    // Estadísticas por tipo de operación
    const operacionesPorTipo = await AuditLog.aggregate([
      { $match: soloEmpresa },
      {
        $group: {
          _id: { $replaceOne: { input: '$accion', find: 'empresa_', replacement: '' } },
          cantidad: { $sum: 1 }
        }
      }
    ]);

    // Estadísticas por usuario
    const operacionesPorUsuario = await AuditLog.aggregate([
      { $match: soloEmpresa },
      {
        $group: {
          _id: {
            usuario: '$usuarioId',
            dni: '$actor.dni',
            nombre: '$actor.nombre',
            apellido: '$actor.apellido'
          },
          cantidad: { $sum: 1 },
          ultimaOperacion: { $max: '$fecha' }
        }
      },
      { $sort: { cantidad: -1 } }
    ]);

    // Campos más modificados
    const camposMasModificados = await AuditLog.aggregate([
      { $match: soloEmpresa },
      { $unwind: '$datosNuevos.camposModificados' },
      {
        $group: {
          _id: '$datosNuevos.camposModificados.campo',
          cantidad: { $sum: 1 }
        }
      },
      { $sort: { cantidad: -1 } },
      { $limit: 10 }
    ]);

    // Total de operaciones
    const totalOperaciones = await AuditLog.countDocuments(soloEmpresa);

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
