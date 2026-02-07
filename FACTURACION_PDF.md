# 📄 SISTEMA DE FACTURACIÓN ELECTRÓNICA CON TEMPLATES PDF

## 📋 Descripción

Sistema completo de generación de facturas electrónicas con templates profesionales siguiendo normativa AFIP. Genera PDFs de alta calidad para Facturas A, B, C y Remitos, asociando automáticamente comprobantes con facturas.

---

## ✨ Características Implementadas

### ✅ Generación de PDFs Profesionales
- **Factura A**: Responsable Inscripto (discrimina IVA, CUIT obligatorio)
- **Factura B**: Consumidor Final/Monotributista (IVA incluido)
- **Factura C**: Operaciones exentas
- **Remito**: Comprobante sin valor fiscal

### ✅ Cumplimiento Normativo AFIP
- RG 1415/03: Formato y contenido de comprobantes
- RG 2904/10: Requisitos de visualización
- RG 4290/18: Datos obligatorios
- Código CAE con vencimiento
- Numeración correlativa
- Datos fiscales completos

### ✅ Asociación Comprobante-Factura
- Cada factura se vincula con su comprobante original
- Trazabilidad completa del flujo
- Consulta unificada de ambos documentos

---

## 🏗️ Arquitectura

### Backend

```
backend/
├── services/
│   └── facturaPDFService.js       # Servicio de generación de PDFs
├── controllers/
│   └── facturadorController.js    # Controlador con nuevos endpoints
├── routes/
│   └── facturador.js              # Rutas actualizadas
└── models/
    ├── Factura.js                 # Modelo de factura electrónica
    └── Comprobante.js             # Modelo con referencia a factura
```

---

## 📡 Nuevos Endpoints

### GET /api/facturador/facturas/:nroFactura/pdf

Genera el PDF de una factura electrónica.

**Requiere autenticación:** Sí (Admin)

**Parámetros URL:**
- `nroFactura` - Número completo de factura (ej: "00001-00000042")

**Respuesta:**
- Content-Type: `application/pdf`
- Content-Disposition: `inline; filename="Factura_00001-00000042.pdf"`
- Stream del PDF generado

**Ejemplo:**
```bash
GET /api/facturador/facturas/00001-00000042/pdf
Authorization: Bearer <token>
```

### GET /api/facturador/facturas/:nroFactura/completa

Obtiene una factura con su comprobante asociado.

**Requiere autenticación:** Sí (Admin)

**Respuesta (200):**
```json
{
  "success": true,
  "factura": {
    "nroFactura": "00001-00000042",
    "cae": "72345678901234",
    "caeFechaVencimiento": "20260217",
    "tipoComprobanteDescripcion": "Factura B",
    "importeTotal": 500.00,
    "cliente": {
      "nombre": "Juan Pérez",
      "cuit": "20-12345678-9"
    },
    "items": [
      {
        "descripcion": "Servicio de Estacionamiento",
        "cantidad": 1,
        "precioUnitario": 500.00,
        "subtotal": 500.00
      }
    ]
  },
  "comprobante": {
    "nroComprobante": "COMP-2026-001234",
    "montoAcreditado": 500.00,
    "estado": "facturado",
    "usuario": {
      "dni": "12345678",
      "nombre": "Juan",
      "apellido": "Pérez"
    }
  }
}
```

---

## 🎨 Templates de Facturas

### Factura A - Responsable Inscripto

```
┌────────────────────────────────────────────────────────┐
│  [LOGO]  CASTELPÁRK S.A.                       ┌───┐  │
│          Av. Corrientes 1234                   │   │  │
│          CABA, Buenos Aires                    │ A │  │
│          CP: 1043                              │   │  │
│          Tel: 011-1234-5678                    └───┘  │
│                                              Cód. 001  │
│          FACTURA A                      00001-00000042 │
├────────────────────────────────────────────────────────┤
│ DATOS DEL EMISOR             DATOS DEL CLIENTE        │
│ CUIT: 30-70861716-0          Razón Social: Cliente SA │
│ Cond. IVA: Resp. Inscripto   CUIT: 30-12345678-9     │
│ Inicio Act.: 01/01/2020      Cond. IVA: Resp. Insc.  │
│                              Domicilio: Calle 123     │
├────────────────────────────────────────────────────────┤
│ Fecha: 07/02/2026   Pto Venta: 00001   CAE: 723456.. │
├────────────────────────────────────────────────────────┤
│ Descripción          Cant.  P.Unit.   IVA    Subtotal │
│ Estacionamiento - 5h   1    413.22   86.78    500.00 │
├────────────────────────────────────────────────────────┤
│                                    Subtotal:   413.22 │
│                                  IVA (21%):     86.78 │
│                                      TOTAL:    500.00 │
├────────────────────────────────────────────────────────┤
│ CAE: 72345678901234                                    │
│ Fecha Vto. CAE: 17/02/2026                            │
│ Comprobante autorizado por AFIP - Ley 25.506         │
└────────────────────────────────────────────────────────┘
```

### Factura B - Consumidor Final

```
┌────────────────────────────────────────────────────────┐
│  [LOGO]  CASTELPÁRK S.A.                       ┌───┐  │
│          Av. Corrientes 1234                   │   │  │
│          CABA, Buenos Aires                    │ B │  │
│          CP: 1043                              │   │  │
│          Tel: 011-1234-5678                    └───┘  │
│                                              Cód. 006  │
│          FACTURA B                      00001-00000043 │
├────────────────────────────────────────────────────────┤
│ DATOS DEL EMISOR             DATOS DEL CLIENTE        │
│ CUIT: 30-70861716-0          Nombre: Juan Pérez       │
│ Cond. IVA: Resp. Inscripto   DNI: 20-12345678-9      │
│ Inicio Act.: 01/01/2020                               │
├────────────────────────────────────────────────────────┤
│ Fecha: 07/02/2026   Pto Venta: 00001   CAE: 723456.. │
├────────────────────────────────────────────────────────┤
│ Descripción                  Cant.  P.Unit.  Subtotal │
│ Estacionamiento - 5h           1    500.00    500.00 │
├────────────────────────────────────────────────────────┤
│                                      TOTAL:    500.00 │
│                                    (IVA incluido)     │
├────────────────────────────────────────────────────────┤
│ CAE: 72345678901234                                    │
│ Fecha Vto. CAE: 17/02/2026                            │
│ Comprobante autorizado por AFIP - Ley 25.506         │
└────────────────────────────────────────────────────────┘
```

---

## 💻 Uso en el Frontend

### Descargar PDF de Factura

```jsx
import axios from 'axios';

const descargarFacturaPDF = async (nroFactura) => {
  try {
    const token = localStorage.getItem('token');
    
    const response = await axios.get(
      `${API_URL}/facturador/facturas/${nroFactura}/pdf`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        responseType: 'blob' // Importante para archivos
      }
    );

    // Crear URL temporal del blob
    const url = window.URL.createObjectURL(new Blob([response.data]));
    
    // Crear link de descarga
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Factura_${nroFactura}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    
    // Limpiar URL temporal
    window.URL.revokeObjectURL(url);
    
  } catch (error) {
    console.error('Error al descargar factura:', error);
    alert('Error al generar el PDF de la factura');
  }
};
```

### Obtener Factura Completa (con Comprobante)

```jsx
const obtenerFacturaCompleta = async (nroFactura) => {
  try {
    const token = localStorage.getItem('token');
    
    const response = await axios.get(
      `${API_URL}/facturador/facturas/${nroFactura}/completa`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    const { factura, comprobante } = response.data;
    
    console.log('Factura:', factura);
    console.log('Comprobante asociado:', comprobante);
    
    return { factura, comprobante };
    
  } catch (error) {
    console.error('Error:', error);
  }
};
```

---

## 🔧 Flujo Completo

### 1. Usuario Carga Saldo
```
Usuario → Comprobante (estado: pendiente)
```

### 2. Admin Aprueba
```
Comprobante → estado: aprobado
```

### 3. Admin Genera Factura
```
POST /api/facturador/generar-factura
{
  "nroComprobante": "COMP-2026-001234",
  "tipoFactura": "B",
  "datosCliente": { ... }
}

→ AFIP devuelve CAE
→ Se crea Factura en BD
→ Se actualiza Comprobante.facturaGenerada
```

### 4. Admin Descarga PDF
```
GET /api/facturador/facturas/00001-00000042/pdf

→ Se genera PDF con template profesional
→ Browser descarga el archivo
```

### 5. Consulta Completa
```
GET /api/facturador/facturas/00001-00000042/completa

→ Retorna factura + comprobante asociado
→ Trazabilidad completa
```

---

## 📊 Datos del Modelo

### Relación Comprobante ↔ Factura

**Comprobante.js:**
```javascript
{
  nroComprobante: "COMP-2026-001234",
  estado: "facturado",
  facturaGenerada: {
    nroFactura: "00001-00000042",
    cae: "72345678901234",
    fechaEmision: "2026-02-07",
    tipoComprobante: 6,
    tipoComprobanteDescripcion: "Factura B"
  }
}
```

**Factura.js:**
```javascript
{
  nroFactura: "00001-00000042",
  cae: "72345678901234",
  caeFechaVencimiento: "20260217",
  tipoComprobante: 6,
  tipoComprobanteDescripcion: "Factura B",
  emisor: { ... },
  cliente: { ... },
  items: [ ... ],
  importeTotal: 500.00
}
```

---

## 🎯 Ventajas del Sistema

✅ **PDFs Profesionales**: Templates que cumplen 100% con AFIP
✅ **Asociación Automática**: Cada factura se vincula con su comprobante
✅ **Trazabilidad Completa**: Seguimiento desde carga hasta facturación
✅ **Múltiples Formatos**: Factura A, B, C y Remitos
✅ **Datos Fiscales**: CAE, vencimiento, numeración correlativa
✅ **Descarga Directa**: PDF generado on-demand sin almacenamiento
✅ **Consulta Unificada**: Endpoint para obtener factura + comprobante

---

## 🧪 Testing

### Probar Generación de PDF

1. Genere una factura desde un comprobante aprobado
2. Copie el `nroFactura` de la respuesta
3. Use Thunder Client o Postman:

```bash
GET http://localhost:3000/api/facturador/facturas/00001-00000042/pdf
Authorization: Bearer <tu_token>
```

4. El browser descargará el PDF automáticamente

### Probar Consulta Completa

```bash
GET http://localhost:3000/api/facturador/facturas/00001-00000042/completa
Authorization: Bearer <tu_token>
```

Retornará la factura con su comprobante asociado.

---

## 📝 Próximas Mejoras

- [ ] Logo personalizable de la empresa
- [ ] Código QR con link de verificación AFIP
- [ ] Envío automático por email al cliente
- [ ] Generación batch de múltiples facturas
- [ ] Historial de descargas por usuario

---

**Implementado para el Sistema de Estacionamiento - Febrero 2026**
