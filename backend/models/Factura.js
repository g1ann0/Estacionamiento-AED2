const mongoose = require('mongoose');
const ConfiguracionEmpresa = require('./ConfiguracionEmpresa');

const facturaSchema = new mongoose.Schema({
  // Datos obligatorios ARCA
  nroFactura: {
    type: String,
    required: true,
    unique: true
  },
  tipoComprobante: {
    type: String,
    enum: ['ticket', 'factura_b', 'factura_c'],
    default: 'ticket'
  },
  fechaEmision: {
    type: Date,
    default: Date.now,
    required: true
  },
  
  // Datos del emisor (estacionamiento)
  emisor: {
    razonSocial: {
      type: String,
      required: true,
      default: 'ESTACIONAMIENTO AE2'
    },
    cuit: {
      type: String,
      required: true,
      default: '20-12345678-9' // Cambiar por el CUIT real
    },
    domicilio: {
      type: String,
      required: true,
      default: 'Av. Corrientes 1234, CABA'
    },
    condicionIva: {
      type: String,
      required: true,
      default: 'Responsable Inscripto'
    }
  },
  
  // Datos del cliente
  cliente: {
    dni: {
      type: String,
      required: true
    },
    nombre: {
      type: String,
      required: true
    },
    apellido: {
      type: String,
      required: true
    },
    email: String,
    condicionIva: {
      type: String,
      default: 'Consumidor Final'
    }
  },
  
  // Concepto facturado
  concepto: {
    descripcion: {
      type: String,
      required: true,
      default: 'Recarga de saldo - Servicio de estacionamiento'
    },
    cantidad: {
      type: Number,
      required: true,
      default: 1
    },
    precioUnitario: {
      type: Number,
      required: true
    },
    subtotal: {
      type: Number,
      required: true
    }
  },
  
  // Totales
  subtotal: {
    type: Number,
    required: true
  },
  iva: {
    porcentaje: {
      type: Number,
      default: 21 // IVA 21%
    },
    monto: {
      type: Number,
      default: 0
    }
  },
  total: {
    type: Number,
    required: true
  },
  
  // Relación con comprobante
  comprobanteRelacionado: {
    nroComprobante: {
      type: String,
      required: true
    },
    fechaComprobante: {
      type: Date,
      required: true
    }
  },
  
  // Estado
  estado: {
    type: String,
    enum: ['emitida', 'anulada'],
    default: 'emitida'
  },
  
  // Metadata
  generadaPor: {
    dni: String,
    nombre: String,
    apellido: String
  },
  
  // Para PDF
  archivoPDF: {
    nombre: String,
    ruta: String,
    generado: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true
});

// Índices para búsqueda eficiente
facturaSchema.index({ nroFactura: 1 });
facturaSchema.index({ 'cliente.dni': 1 });
facturaSchema.index({ 'comprobanteRelacionado.nroComprobante': 1 });
facturaSchema.index({ fechaEmision: -1 });

// Método para generar número de factura
facturaSchema.statics.generarNumeroFactura = async function() {
  try {
    // Obtener configuración de empresa
    const configuracion = await ConfiguracionEmpresa.obtenerConfiguracionActiva();
    
    if (!configuracion) {
      throw new Error('No hay configuración de empresa establecida');
    }
    
    const puntoVenta = configuracion.puntoVenta;
    const proximoNumero = configuracion.numeracion.proximoNumero;
    
    // Incrementar contador en la configuración
    configuracion.numeracion.proximoNumero = proximoNumero + 1;
    await configuracion.save();
    
    return `${puntoVenta}-${proximoNumero.toString().padStart(8, '0')}`;
  } catch (error) {
    console.error('Error al generar número de factura:', error);
    // Fallback al método anterior
    const ultimaFactura = await this.findOne({}, {}, { sort: { 'nroFactura': -1 } });
    
    if (!ultimaFactura) {
      return '00001-00000001'; // Primer número
    }
    
    // Extraer número actual y incrementar
    const partes = ultimaFactura.nroFactura.split('-');
    const puntoVenta = partes[0];
    const numero = parseInt(partes[1]) + 1;
    
    return `${puntoVenta}-${numero.toString().padStart(8, '0')}`;
  }
};

// Método para calcular totales
facturaSchema.methods.calcularTotales = function() {
  this.subtotal = this.concepto.subtotal;
  
  // Para consumidor final, generalmente no se discrimina IVA
  if (this.cliente.condicionIva === 'Consumidor Final') {
    this.iva.monto = 0;
    this.total = this.subtotal;
  } else {
    this.iva.monto = this.subtotal * (this.iva.porcentaje / 100);
    this.total = this.subtotal + this.iva.monto;
  }
};

module.exports = mongoose.model('Factura', facturaSchema);
