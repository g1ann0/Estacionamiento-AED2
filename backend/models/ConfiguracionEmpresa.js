const mongoose = require('mongoose');

const configuracionEmpresaSchema = new mongoose.Schema({
  // Datos básicos de la empresa
  razonSocial: {
    type: String,
    required: true,
    trim: true
  },
  cuit: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: function(v) {
        // Validar formato CUIT: XX-XXXXXXXX-X
        return /^\d{2}-\d{8}-\d{1}$/.test(v);
      },
      message: 'CUIT debe tener el formato XX-XXXXXXXX-X'
    }
  },
  inicioActividades: {
    type: Date,
    required: true
  },
  
  // Domicilio fiscal
  domicilio: {
    calle: {
      type: String,
      required: true,
      trim: true
    },
    numero: {
      type: String,
      required: true,
      trim: true
    },
    piso: {
      type: String,
      trim: true
    },
    departamento: {
      type: String,
      trim: true
    },
    localidad: {
      type: String,
      required: true,
      trim: true
    },
    provincia: {
      type: String,
      required: true,
      trim: true
    },
    codigoPostal: {
      type: String,
      required: true,
      trim: true
    }
  },

  // Condición tributaria
  condicionIva: {
    type: String,
    required: true,
    enum: [
      'IVA Responsable Inscripto',
      'IVA Responsable no Inscripto', 
      'IVA no Responsable',
      'IVA Sujeto Exento',
      'Consumidor Final',
      'Responsable Monotributo',
      'Sujeto no Categorizado'
    ],
    default: 'IVA Responsable Inscripto'
  },

  // Configuración de facturación
  puntoVenta: {
    type: String,
    required: true,
    default: '00001',
    validate: {
      validator: function(v) {
        return /^\d{5}$/.test(v);
      },
      message: 'Punto de venta debe tener 5 dígitos'
    }
  },

  // Datos de contacto
  contacto: {
    telefono: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      validate: {
        validator: function(v) {
          return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: 'Email debe tener un formato válido'
      }
    },
    sitioWeb: {
      type: String,
      trim: true
    }
  },

  // Configuración ARCA específica
  arca: {
    // Certificado digital para facturación electrónica
    certificadoDigital: {
      activo: {
        type: Boolean,
        default: false
      },
      fechaVencimiento: Date,
      alias: String
    },
    
    // Configuración de CAE (Código de Autorización Electrónica)
    cae: {
      solicitudAutomatica: {
        type: Boolean,
        default: true
      },
      validezDias: {
        type: Number,
        default: 10,
        min: 1,
        max: 10
      }
    },

    // Límites de anulación
    limitesAnulacion: {
      diasMaximos: {
        type: Number,
        default: 15,
        min: 1,
        max: 15
      },
      requiereMotivo: {
        type: Boolean,
        default: true
      }
    }
  },

  // Configuración de numeración
  numeracion: {
    proximoNumero: {
      type: Number,
      default: 1,
      min: 1
    },
    reinicioAnual: {
      type: Boolean,
      default: false
    }
  },

  // Metadatos
  activa: {
    type: Boolean,
    default: true
  },
  fechaCreacion: {
    type: Date,
    default: Date.now
  },
  fechaActualizacion: {
    type: Date,
    default: Date.now
  },
  actualizadoPor: {
    dni: String,
    nombre: String,
    apellido: String
  }
});

// Middleware para actualizar fechaActualizacion
configuracionEmpresaSchema.pre('save', function(next) {
  this.fechaActualizacion = new Date();
  next();
});

// Método para obtener domicilio completo
configuracionEmpresaSchema.methods.getDomicilioCompleto = function() {
  let domicilio = `${this.domicilio.calle} ${this.domicilio.numero}`;
  
  if (this.domicilio.piso) {
    domicilio += `, Piso ${this.domicilio.piso}`;
  }
  
  if (this.domicilio.departamento) {
    domicilio += `, Depto ${this.domicilio.departamento}`;
  }
  
  domicilio += `, ${this.domicilio.localidad}, ${this.domicilio.provincia} (${this.domicilio.codigoPostal})`;
  
  return domicilio;
};

// Método estático para obtener configuración activa
configuracionEmpresaSchema.statics.obtenerConfiguracionActiva = async function() {
  return await this.findOne({ activa: true });
};

// Método para validar CUIT
configuracionEmpresaSchema.methods.validarCuit = function() {
  const cuit = this.cuit.replace(/-/g, '');
  const multiplicadores = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  
  let suma = 0;
  for (let i = 0; i < 10; i++) {
    suma += parseInt(cuit[i]) * multiplicadores[i];
  }
  
  const resto = suma % 11;
  const digitoVerificador = resto < 2 ? resto : 11 - resto;
  
  return parseInt(cuit[10]) === digitoVerificador;
};

module.exports = mongoose.model('ConfiguracionEmpresa', configuracionEmpresaSchema);
