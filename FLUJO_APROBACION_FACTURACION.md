# Flujo de Aprobación y Facturación Electrónica

## Descripción General

Este documento describe el flujo completo desde que un usuario genera un comprobante hasta que el administrador lo aprueba y se genera automáticamente la factura electrónica con AFIP/ARCA.

## Flujo Completo

```
1. USUARIO genera comprobante
   └─> Estado: "pendiente"
   
2. ADMIN revisa comprobante
   └─> Puede aprobar o rechazar
   
3a. Si RECHAZA:
    └─> Estado: "rechazado"
    └─> Se guarda observaciones
    └─> FIN
    
3b. Si APRUEBA:
    └─> Estado: "aprobado"
    └─> Se determina tipo de factura (A o B) según condición IVA
    └─> Se genera CAE en AFIP
    └─> Se crea Factura en BD
    └─> Se vincula comprobante con factura
    └─> FIN
```

## Cambios Implementados

### 1. Modelo Usuario
Se agregaron campos fiscales para determinar el tipo de factura:

```javascript
{
  cuit: String,                    // CUIT del cliente (opcional)
  condicionIVA: {
    type: String,
    enum: [
      'Responsable Inscripto',
      'Responsable no Inscripto',
      'Exento',
      'Monotributo',
      'Consumidor Final'
    ],
    default: 'Consumidor Final'
  }
}
```

### 2. Modelo Comprobante
Se agregaron campos para trackear la aprobación y factura generada:

```javascript
{
  estado: {
    type: String,
    enum: ['pendiente', 'aprobado', 'rechazado'],
    default: 'pendiente'
  },
  facturaGenerada: {
    nroFactura: String,
    cae: String,
    fechaEmision: Date,
    tipoComprobante: Number,
    tipoComprobanteDescripcion: String
  },
  aprobadoPor: {
    dni: String,
    nombre: String,
    apellido: String,
    fecha: Date
  },
  observaciones: String
}
```

### 3. Modelo Factura
Se actualizó la relación con el comprobante:

```javascript
{
  comprobanteRelacionado: {
    nroComprobante: String,
    fecha: Date,
    monto: Number
  }
}
```

## Lógica de Determinación de Tipo de Factura

La función `determinarTipoComprobante` en `afipFacturacionService.js` determina automáticamente el tipo de factura según:

### Emisor: Responsable Inscripto
- **Cliente RI** → **Factura A** (código 1) - Discrimina IVA
- **Cliente Monotributo/CF** → **Factura B** (código 6) - IVA incluido
- **Cliente Exento** → **Factura C** (código 11) - Sin IVA

### Emisor: Monotributo
- **Cualquier cliente** → **Factura B** (código 6) o **Factura C** (código 11)

### Tabla de Tipos de Comprobante AFIP
```
1  = Factura A
6  = Factura B
11 = Factura C
81 = Tique Factura A
82 = Tique Factura B
```

## Endpoints API

### Aprobar Comprobante
```http
PUT /api/comprobantes/:nroComprobante/aprobar
```

**Headers:**
```
Authorization: Bearer {token_admin}
Content-Type: application/json
```

**Body:**
```json
{
  "estado": "aprobado",
  "observaciones": "Comprobante verificado y aprobado",
  "puntoVenta": 1
}
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "mensaje": "Comprobante aprobado y factura generada exitosamente",
  "comprobante": {
    "nroComprobante": "COMP-1234567890",
    "estado": "aprobado",
    "facturaGenerada": {
      "nroFactura": "00001-00000123",
      "cae": "12345678901234",
      "fechaEmision": "2026-02-03T...",
      "tipoComprobante": 6,
      "tipoComprobanteDescripcion": "Factura B"
    },
    "aprobadoPor": {
      "dni": "12345678",
      "nombre": "Juan",
      "apellido": "Admin",
      "fecha": "2026-02-03T..."
    }
  },
  "factura": {
    "nroFactura": "00001-00000123",
    "cae": "12345678901234",
    "tipoComprobante": "Factura B",
    "importeTotal": 5000
  }
}
```

### Rechazar Comprobante
```http
PUT /api/comprobantes/:nroComprobante/aprobar
```

**Body:**
```json
{
  "estado": "rechazado",
  "observaciones": "Datos incorrectos en el comprobante"
}
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "mensaje": "Comprobante rechazado",
  "comprobante": {
    "nroComprobante": "COMP-1234567890",
    "estado": "rechazado",
    "aprobadoPor": {
      "dni": "12345678",
      "nombre": "Juan",
      "apellido": "Admin",
      "fecha": "2026-02-03T..."
    },
    "observaciones": "Datos incorrectos en el comprobante"
  }
}
```

## Ejemplos de Uso

### Ejemplo 1: Cliente Consumidor Final (más común)

**Datos del Cliente:**
```javascript
{
  dni: "38456789",
  nombre: "María",
  apellido: "González",
  condicionIVA: "Consumidor Final",
  cuit: null
}
```

**Comprobante:**
```javascript
{
  nroComprobante: "COMP-1707340456789",
  montoAcreditado: 10000
}
```

**Admin aprueba → Se genera:**
- **Tipo:** Factura B (código 6)
- **IVA:** Incluido en el precio
- **Documento:** DNI 38456789
- **Importe Neto:** $10000
- **IVA:** $0 (incluido)
- **Total:** $10000

### Ejemplo 2: Cliente Responsable Inscripto

**Datos del Cliente:**
```javascript
{
  dni: "20345678",
  nombre: "Empresa",
  apellido: "SRL",
  condicionIVA: "Responsable Inscripto",
  cuit: "30712345678"
}
```

**Comprobante:**
```javascript
{
  nroComprobante: "COMP-1707340456790",
  montoAcreditado: 12100
}
```

**Admin aprueba → Se genera:**
- **Tipo:** Factura A (código 1)
- **IVA:** Discriminado
- **Documento:** CUIT 30712345678
- **Importe Neto:** $10000
- **IVA 21%:** $2100
- **Total:** $12100

### Ejemplo 3: Cliente Monotributo

**Datos del Cliente:**
```javascript
{
  dni: "25678901",
  nombre: "Pedro",
  apellido: "Martínez",
  condicionIVA: "Monotributo",
  cuit: "20256789011"
}
```

**Comprobante:**
```javascript
{
  nroComprobante: "COMP-1707340456791",
  montoAcreditado: 5000
}
```

**Admin aprueba → Se genera:**
- **Tipo:** Factura B (código 6)
- **IVA:** Incluido
- **Documento:** CUIT 20256789011
- **Importe Neto:** $5000
- **IVA:** $0 (incluido)
- **Total:** $5000

## Validaciones Implementadas

### En la Aprobación:
1. ✅ Verificar que el usuario sea admin
2. ✅ Verificar que el comprobante exista
3. ✅ Verificar que el comprobante esté pendiente
4. ✅ Verificar que el cliente exista
5. ✅ Verificar que la configuración de empresa esté completa
6. ✅ Verificar que no exista factura previa para el comprobante

### En la Generación de Factura:
1. ✅ Determinar tipo de comprobante según condición IVA
2. ✅ Calcular montos correctamente (neto, IVA, total)
3. ✅ Obtener CAE de AFIP
4. ✅ Guardar factura con todos los datos obligatorios
5. ✅ Vincular factura con comprobante
6. ✅ Actualizar estado del comprobante

## Errores Comunes y Soluciones

### Error: "No tiene permisos para aprobar comprobantes"
**Causa:** El usuario no es admin  
**Solución:** Asegurarse de que el token sea de un usuario con rol 'admin'

### Error: "Comprobante no encontrado o no está aprobado"
**Causa:** El comprobante no existe o ya fue procesado  
**Solución:** Verificar el número de comprobante y su estado

### Error: "Ya existe una factura emitida para este comprobante"
**Causa:** Se intentó facturar dos veces el mismo comprobante  
**Solución:** Verificar el estado del comprobante antes de aprobar

### Error: "Configuración de empresa no encontrada"
**Causa:** No se configuró la empresa en la BD  
**Solución:** Completar la configuración en `/api/configuracion-empresa`

### Error: "Error al generar factura electrónica en AFIP"
**Causa:** Problema con la conexión o credenciales de AFIP  
**Solución:** Verificar certificados y configuración AFIP

## Cumplimiento Normativo

Este flujo cumple con:

- ✅ **RG 1415/03** - Régimen de Emisión de Comprobantes Electrónicos
- ✅ **RG 2485/08** - Comprobantes Electrónicos Originales
- ✅ **RG 2904/10** - Factura Electrónica
- ✅ **RG 4290/18** - Facturación Electrónica Obligatoria

### Requisitos AFIP Implementados:
- ✅ CAE obligatorio para cada factura
- ✅ Numeración correlativa
- ✅ Validación de CUIT/DNI
- ✅ Discriminación correcta de IVA según tipo de factura
- ✅ Almacenamiento de fecha de vencimiento de CAE
- ✅ Trazabilidad completa (quién aprobó, cuándo, observaciones)

## Próximos Pasos Recomendados

1. **Frontend:** Crear interfaz para que admin apruebe/rechace comprobantes
2. **Notificaciones:** Enviar email al cliente cuando se genere la factura
3. **PDF:** Generar PDF de la factura con formato AFIP
4. **Reportes:** Dashboard de comprobantes pendientes para admin
5. **Búsqueda:** Filtros para buscar comprobantes por estado, fecha, cliente
