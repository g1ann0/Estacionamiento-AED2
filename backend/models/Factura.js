const mongoose = require('mongoose');
const ConfiguracionEmpresa = require('./ConfiguracionEmpresa');

/**
 * MODELO DE FACTURA ELECTRÓNICA - CUMPLIMIENTO NORMATIVO AFIP/ARCA
 * 
 * MARCOS LEGALES:
 * - RG 1415/03: Régimen de Emisión de Comprobantes Electrónicos Originales
 * - RG 2485/08: Comprobantes Electrónicos Originales
 * - RG 2904/10: Factura Electrónica
 * - RG 4290/18: Facturación Electrónica Obligatoria
 * 
 * CAMPOS OBLIGATORIOS SEGÚN AFIP:
 * - CAE (Código de Autorización Electrónica) - OBLIGATORIO
 * - CAE Fecha de Vencimiento - OBLIGATORIO
 * - Punto de Venta - OBLIGATORIO
 * - Tipo de Comprobante - OBLIGATORIO
 * - Número de Comprobante - OBLIGATORIO (correlativo)
 * - CUIT Emisor - OBLIGATORIO
 * - Condición IVA Emisor - OBLIGATORIO
 * - Datos del Cliente - OBLIGATORIO
 * - Montos discriminados - OBLIGATORIO
 */

const facturaSchema = new mongoose.Schema({
  // ========== DATOS DE AFIP (OBLIGATORIOS) ==========
  
  // CAE: Código de Autorización Electrónica emitido por AFIP
  // REQUISITO LEGAL CRÍTICO: Sin CAE la factura NO es válida
  cae: {
    type: String,
    required: true,
    index: true
  },
  
  // Fecha de vencimiento del CAE (generalmente 10 días)
  // REQUISITO LEGAL: Debe almacenarse obligatoriamente
  caeFechaVencimiento: {
    type: String, // Formato YYYYMMDD como lo devuelve AFIP
    required: true
  },
  
  // Punto de venta autorizado por AFIP
  puntoVenta: {
    type: Number,
    required: true,
    min: 1,
    max: 9998
  },
  
  // Tipo de comprobante según tabla AFIP
  // Ej: 1=Factura A, 6=Factura B, 11=Factura C, 82=Tique B
  tipoComprobante: {
    type: Number,
    required: true,
    validate: {
      validator: function(v) {
        // Validar que sea un tipo válido según AFIP
        const tiposValidos = [1,2,3,6,7,8,11,12,13,51,52,53,81,82,83];
        return tiposValidos.includes(v);
      },
      message: props => `${props.value} no es un tipo de comprobante válido según AFIP`
    }
  },
  
  // Descripción del tipo de comprobante (Factura A, B, C, etc.)
  tipoComprobanteDescripcion: {
    type: String,
    required: true
  },
  
  // Número de comprobante (debe ser correlativo)
  // REQUISITO LEGAL: Numeración correlativa obligatoria
  numeroComprobante: {
    type: Number,
    required: true,
    min: 1
  },
  
  // Número completo para visualización (PPPPP-NNNNNNNN)
  nroFactura: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Concepto del comprobante según AFIP
  // 1 = Productos, 2 = Servicios, 3 = Productos y Servicios
  concepto: {
    type: Number,
    required: true,
    enum: [1, 2, 3],
    default: 2 // Servicios (estacionamiento)
  },
  
  // ========== DATOS DEL EMISOR (ESTACIONAMIENTO) ==========
  
  emisor: {
    razonSocial: {
      type: String,
      required: true
    },
    // CUIT del emisor - OBLIGATORIO según normativa
    cuit: {
      type: String,
      required: true,
      validate: {
        validator: function(v) {
          // Validar formato CUIT (11 dígitos)
          return /^\d{11}$/.test(v.replace(/-/g, ''));
        },
        message: 'CUIT debe tener 11 dígitos'
      }
    },
    domicilio: {
      calle: String,
      numero: String,
      localidad: String,
      provincia: String,
      codigoPostal: String,
      domicilioCompleto: {
        type: String,
        required: true
      }
    },
    // Condición frente al IVA - OBLIGATORIO
    condicionIva: {
      type: String,
      required: true,
      enum: [
        'Responsable Inscripto',
        'Responsable no Inscripto',
        'Exento',
        'Monotributo',
        'Consumidor Final'
      ]
    },
    ingresosBrutos: String,
    inicioActividades: Date
  },
  
  // ========== DATOS DEL CLIENTE ==========
  
  cliente: {
    // Tipo de documento según tabla AFIP
    // 80=CUIT, 86=CUIL, 96=DNI, etc.
    tipoDocumento: {
      type: Number,
      required: true,
      default: 96 // DNI
    },
    tipoDocumentoDescripcion: {
      type: String,
      default: 'DNI'
    },
    // Número de documento sin guiones ni puntos
    numeroDocumento: {
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
    razonSocial: String, // Para empresas
    email: String,
    domicilio: String,
    condicionIva: {
      type: String,
      required: true,
      default: 'Consumidor Final',
      enum: [
        'Responsable Inscripto',
        'Responsable no Inscripto',
        'Exento',
        'Monotributo',
        'Consumidor Final'
      ]
    }
  },
  
  // ========== FECHAS ==========
  
  fechaEmision: {
    type: Date,
    required: true,
    default: Date.now
  },
  
  // Para servicios, fecha desde y hasta del servicio prestado
  fechaServicioDesde: {
    type: Date
  },
  
  fechaServicioHasta: {
    type: Date
  },
  
  fechaVencimientoPago: {
    type: Date
  },
  
  // ========== CONCEPTOS/ITEMS FACTURADOS ==========
  
  items: [{
    descripcion: {
      type: String,
      required: true
    },
    cantidad: {
      type: Number,
      required: true,
      min: 0
    },
    unidadMedida: {
      type: String,
      default: 'unidades'
    },
    precioUnitario: {
      type: Number,
      required: true,
      min: 0
    },
    alicuotaIVA: {
      type: Number,
      default: 21
    },
    importeIVA: {
      type: Number,
      default: 0
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0
    }
  }],
  
  // ========== IMPORTES (SEGÚN ESTRUCTURA AFIP) ==========
  
  // Importe neto gravado
  importeNeto: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Importe total de IVA
  importeIVA: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  
  // Desglose de IVA por alícuota
  detalleIVA: [{
    alicuota: {
      type: Number,
      required: true
    },
    baseImponible: {
      type: Number,
      required: true
    },
    importe: {
      type: Number,
      required: true
    }
  }],
  
  // Importe total no gravado
  importeNoGravado: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Importe exento
  importeExento: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Otros tributos (percepciones, retenciones, etc.)
  otrosTributos: [{
    descripcion: String,
    baseImponible: Number,
    alicuota: Number,
    importe: Number
  }],
  
  // Importe total del comprobante
  importeTotal: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Moneda (siempre PES para pesos argentinos en mercado interno)
  moneda: {
    codigo: {
      type: String,
      default: 'PES'
    },
    cotizacion: {
      type: Number,
      default: 1
    }
  },
  
  // ========== RELACIÓN CON COMPROBANTE DE PAGO ==========
  
  comprobanteRelacionado: {
    nroComprobante: String,
    fechaComprobante: Date,
    tipo: String
  },
  
  // ========== ESTADO Y CONTROL ==========
  
  estado: {
    type: String,
    enum: ['emitida', 'anulada', 'pendiente'],
    default: 'emitida'
  },
  
  // Si fue anulada, guardar motivo y CAE de nota de crédito
  anulacion: {
    fecha: Date,
    motivo: String,
    notaCreditoCAE: String,
    notaCreditoNumero: String
  },
  
  // ========== DATOS ADICIONALES ==========
  
  observaciones: String,
  
  // Usuario que generó la factura
  generadaPor: {
    dni: String,
    nombre: String,
    apellido: String,
    rol: String
  },
  
  // Datos para auditoría
  respuestaAFIP: {
    type: mongoose.Schema.Types.Mixed
  },
  
  // ========== PDF Y QR ==========
  
  archivoPDF: {
    nombre: String,
    ruta: String,
    generado: {
      type: Boolean,
      default: false
    }
  },
  
  // URL de verificación con QR de AFIP
  urlVerificacionAFIP: String
  
}, {
  timestamps: true
});

// ========== ÍNDICES PARA BÚSQUEDA EFICIENTE ==========

// Índice único en CAE (crítico para auditorías)
facturaSchema.index({ cae: 1 }, { unique: true });

// Índice compuesto para búsqueda de comprobantes
facturaSchema.index({ puntoVenta: 1, tipoComprobante: 1, numeroComprobante: 1 }, { unique: true });

// Índice en número de factura completo
facturaSchema.index({ nroFactura: 1 });

// Índice en cliente
facturaSchema.index({ 'cliente.numeroDocumento': 1 });

// Índice en fecha de emisión
facturaSchema.index({ fechaEmision: -1 });

// Índice en estado
facturaSchema.index({ estado: 1 });

// ========== MÉTODOS ESTÁTICOS ==========

/**
 * Genera el número de factura completo en formato PPPPP-NNNNNNNN
 * REQUISITO LEGAL: Formato según normativa AFIP
 */
facturaSchema.statics.generarNumeroFacturaCompleto = function(puntoVenta, numeroComprobante) {
  const pvFormatted = puntoVenta.toString().padStart(5, '0');
  const numFormatted = numeroComprobante.toString().padStart(8, '0');
  return `${pvFormatted}-${numFormatted}`;
};

/**
 * Obtiene la última factura de un punto de venta y tipo
 */
facturaSchema.statics.obtenerUltimaFactura = async function(puntoVenta, tipoComprobante) {
  return await this.findOne({ 
    puntoVenta, 
    tipoComprobante,
    estado: { $ne: 'anulada' }
  }).sort({ numeroComprobante: -1 });
};

/**
 * Valida que el CAE no esté duplicado
 */
facturaSchema.statics.validarCAEUnico = async function(cae) {
  const existe = await this.findOne({ cae });
  return !existe;
};

// ========== MÉTODOS DE INSTANCIA ==========

/**
 * Calcula todos los importes de la factura
 * REQUISITO LEGAL: Cálculos correctos según normativa AFIP
 */
facturaSchema.methods.calcularImportes = function() {
  let totalNeto = 0;
  let totalIVA = 0;
  
  // Calcular por cada item
  this.items.forEach(item => {
    const neto = item.cantidad * item.precioUnitario;
    const iva = neto * (item.alicuotaIVA / 100);
    
    item.importeIVA = parseFloat(iva.toFixed(2));
    item.subtotal = parseFloat(neto.toFixed(2));
    
    totalNeto += neto;
    totalIVA += iva;
  });
  
  // Establecer importes principales
  this.importeNeto = parseFloat(totalNeto.toFixed(2));
  this.importeIVA = parseFloat(totalIVA.toFixed(2));
  this.importeTotal = parseFloat((totalNeto + totalIVA).toFixed(2));
  
  // Agrupar IVA por alícuota para detalleIVA
  const ivasPorAlicuota = {};
  this.items.forEach(item => {
    const alicuota = item.alicuotaIVA;
    if (!ivasPorAlicuota[alicuota]) {
      ivasPorAlicuota[alicuota] = {
        alicuota: alicuota,
        baseImponible: 0,
        importe: 0
      };
    }
    ivasPorAlicuota[alicuota].baseImponible += item.subtotal;
    ivasPorAlicuota[alicuota].importe += item.importeIVA;
  });
  
  this.detalleIVA = Object.values(ivasPorAlicuota).map(iva => ({
    alicuota: iva.alicuota,
    baseImponible: parseFloat(iva.baseImponible.toFixed(2)),
    importe: parseFloat(iva.importe.toFixed(2))
  }));
};

/**
 * Verifica si el CAE está vencido
 */
facturaSchema.methods.caeEstaVencido = function() {
  if (!this.caeFechaVencimiento) return true;
  
  // Convertir fecha de AFIP (YYYYMMDD) a Date
  const year = parseInt(this.caeFechaVencimiento.substring(0, 4));
  const month = parseInt(this.caeFechaVencimiento.substring(4, 6)) - 1;
  const day = parseInt(this.caeFechaVencimiento.substring(6, 8));
  const fechaVto = new Date(year, month, day);
  
  return new Date() > fechaVto;
};

/**
 * Genera el texto del QR para verificación en AFIP
 */
facturaSchema.methods.generarDatosQR = function() {
  return {
    ver: 1,
    fecha: this.fechaEmision.toISOString().split('T')[0].replace(/-/g, ''),
    cuit: this.emisor.cuit.replace(/-/g, ''),
    ptoVta: this.puntoVenta,
    tipoCmp: this.tipoComprobante,
    nroCmp: this.numeroComprobante,
    importe: this.importeTotal,
    moneda: this.moneda.codigo,
    ctz: this.moneda.cotizacion,
    tipoDocRec: this.cliente.tipoDocumento,
    nroDocRec: this.cliente.numeroDocumento,
    tipoCodAut: 'E',
    codAut: this.cae
  };
};

/**
 * Valida que la factura cumple con requisitos mínimos legales
 */
facturaSchema.methods.validarCumplimientoLegal = function() {
  const errores = [];
  
  // Validar CAE
  if (!this.cae) {
    errores.push('Falta CAE (Código de Autorización Electrónica)');
  }
  
  // Validar fecha vencimiento CAE
  if (!this.caeFechaVencimiento) {
    errores.push('Falta fecha de vencimiento del CAE');
  }
  
  // Validar CUIT emisor
  if (!this.emisor.cuit || !/^\d{11}$/.test(this.emisor.cuit.replace(/-/g, ''))) {
    errores.push('CUIT del emisor inválido');
  }
  
  // Validar importes
  if (this.importeTotal <= 0) {
    errores.push('Importe total debe ser mayor a cero');
  }
  
  // Validar que tenga items
  if (!this.items || this.items.length === 0) {
    errores.push('La factura debe tener al menos un item');
  }
  
  return {
    valido: errores.length === 0,
    errores: errores
  };
};

// ========== HOOKS (MIDDLEWARE) ==========

// Antes de guardar, validar cumplimiento legal
facturaSchema.pre('save', function(next) {
  const validacion = this.validarCumplimientoLegal();
  if (!validacion.valido) {
    return next(new Error(`Factura no cumple requisitos legales: ${validacion.errores.join(', ')}`));
  }
  next();
});

module.exports = mongoose.model('Factura', facturaSchema);
