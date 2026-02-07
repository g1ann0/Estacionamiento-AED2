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
    required: [true, 'CUIT es obligatorio'],
    unique: true,
    trim: true,
    validate: {
      validator: function(v) {
        // Validar formato CUIT/CUIL: XX-XXXXXXXX-X (acepta 20, 23, 24, 27, 30, 33, 34)
        if (!/^\d{2}-\d{8}-\d{1}$/.test(v)) {
          return false;
        }
        
        // Validar dígito verificador
        const cuitLimpio = v.replace(/-/g, '');
        const multiplicadores = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
        
        let suma = 0;
        for (let i = 0; i < 10; i++) {
          suma += parseInt(cuitLimpio[i]) * multiplicadores[i];
        }
        
        const resto = suma % 11;
        const digitoVerificador = resto === 0 ? 0 : resto === 1 ? 9 : 11 - resto;
        
        return parseInt(cuitLimpio[10]) === digitoVerificador;
      },
      message: 'CUIT/CUIL inválido. Verificá el número y el dígito verificador'
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
    type: Number,
    required: [true, 'Punto de venta es obligatorio'],
    default: 1,
    min: [1, 'Punto de venta debe ser mayor a 0'],
    max: [99999, 'Punto de venta no puede exceder 99999']
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

  // Numeración de comprobantes
  proximoNumero: {
    type: Number,
    default: 1,
    min: 1
  },
  reinicioAnual: {
    type: Boolean,
    default: false
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

// Método para obtener punto de venta formateado (00001 - 99999)
configuracionEmpresaSchema.methods.getPuntoVentaFormateado = function() {
  return this.puntoVenta.toString().padStart(5, '0');
};

module.exports = mongoose.model('ConfiguracionEmpresa', configuracionEmpresaSchema);