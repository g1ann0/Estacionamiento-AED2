const mongoose = require('mongoose');

const LogConfiguracionEmpresaSchema = new mongoose.Schema({
  // Referencia al usuario que realizó el cambio
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  
  // Información del usuario para auditoría
  usuarioInfo: {
    dni: { type: String, required: true },
    nombre: { type: String, required: true },
    apellido: { type: String, required: true },
    email: { type: String, required: true }
  },

  // Tipo de operación realizada
  tipoOperacion: {
    type: String,
    enum: ['crear', 'actualizar', 'eliminar'],
    required: true
  },

  // Configuración anterior (para modificaciones)
  configuracionAnterior: {
    nombre: String,
    direccion: String,
    telefono: String,
    email: String,
    cuit: String,
    condicionIva: String,
    logo: String,
    numeroFactura: Number,
    numeroRecibo: Number
  },

  // Configuración nueva (después del cambio)
  configuracionNueva: {
    nombre: String,
    direccion: String,
    telefono: String,
    email: String,
    cuit: String,
    condicionIva: String,
    logo: String,
    numeroFactura: Number,
    numeroRecibo: Number
  },

  // Campos específicos que fueron modificados
  camposModificados: [{
    campo: String,
    valorAnterior: mongoose.Schema.Types.Mixed,
    valorNuevo: mongoose.Schema.Types.Mixed
  }],

  // Información adicional
  motivo: {
    type: String,
    default: ''
  },

  // IP del usuario (si está disponible)
  ipUsuario: {
    type: String,
    default: ''
  },

  // Metadatos
  fecha: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Índices para optimizar consultas
LogConfiguracionEmpresaSchema.index({ fecha: -1 });
LogConfiguracionEmpresaSchema.index({ usuario: 1, fecha: -1 });
LogConfiguracionEmpresaSchema.index({ tipoOperacion: 1, fecha: -1 });

// Método estático para crear un log
LogConfiguracionEmpresaSchema.statics.crearLog = async function(datos) {
  try {
    const log = new this(datos);
    await log.save();
    return log;
  } catch (error) {
    console.error('Error al crear log de configuración empresa:', error);
    throw error;
  }
};

// Método estático para obtener historial
LogConfiguracionEmpresaSchema.statics.obtenerHistorial = async function(filtros = {}, limite = 50) {
  try {
    const query = {};
    
    if (filtros.usuario) {
      query.usuario = filtros.usuario;
    }
    
    if (filtros.tipoOperacion) {
      query.tipoOperacion = filtros.tipoOperacion;
    }
    
    if (filtros.fechaDesde || filtros.fechaHasta) {
      query.fecha = {};
      if (filtros.fechaDesde) {
        query.fecha.$gte = new Date(filtros.fechaDesde);
      }
      if (filtros.fechaHasta) {
        query.fecha.$lte = new Date(filtros.fechaHasta);
      }
    }

    return await this.find(query)
      .populate('usuario', 'dni nombre apellido email')
      .sort({ fecha: -1 })
      .limit(limite);
  } catch (error) {
    console.error('Error al obtener historial de configuración empresa:', error);
    throw error;
  }
};

module.exports = mongoose.model('LogConfiguracionEmpresa', LogConfiguracionEmpresaSchema);
