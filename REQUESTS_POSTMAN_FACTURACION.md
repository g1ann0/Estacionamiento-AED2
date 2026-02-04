# Colección de Requests - Flujo de Aprobación y Facturación

## Variables de Entorno
```json
{
  "BASE_URL": "http://localhost:5000/api",
  "ADMIN_TOKEN": "token_del_admin_aqui",
  "USER_TOKEN": "token_del_usuario_aqui"
}
```

---

## 1. Listar Todos los Comprobantes (Admin)

**Endpoint:** `GET {{BASE_URL}}/comprobantes`

**Headers:**
```
Authorization: Bearer {{ADMIN_TOKEN}}
```

**Respuesta:**
```json
{
  "success": true,
  "count": 15,
  "comprobantes": [...]
}
```

---

## 2. Listar Comprobantes Pendientes (Admin)

**Endpoint:** `GET {{BASE_URL}}/comprobantes?estado=pendiente`

**Headers:**
```
Authorization: Bearer {{ADMIN_TOKEN}}
```

**Respuesta:**
```json
{
  "success": true,
  "count": 3,
  "comprobantes": [
    {
      "_id": "...",
      "nroComprobante": "COMP-1707340456789",
      "usuario": {
        "dni": "38456789",
        "nombre": "María",
        "apellido": "González"
      },
      "montoAcreditado": 10000,
      "montoDisponible": 15000,
      "vehiculos": ["ABC123"],
      "estado": "pendiente",
      "fecha": "2026-02-03T10:30:00.000Z"
    }
  ]
}
```

---

## 3. Aprobar Comprobante - Cliente Consumidor Final

**Endpoint:** `PUT {{BASE_URL}}/comprobantes/COMP-1707340456789/aprobar`

**Headers:**
```
Authorization: Bearer {{ADMIN_TOKEN}}
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

**Respuesta Exitosa:**
```json
{
  "success": true,
  "mensaje": "Comprobante aprobado y factura generada exitosamente",
  "comprobante": {
    "nroComprobante": "COMP-1707340456789",
    "estado": "aprobado",
    "facturaGenerada": {
      "nroFactura": "00001-00000001",
      "cae": "72345678901234",
      "fechaEmision": "2026-02-03T14:25:30.000Z",
      "tipoComprobante": 6,
      "tipoComprobanteDescripcion": "Factura B"
    },
    "aprobadoPor": {
      "dni": "12345678",
      "nombre": "Juan",
      "apellido": "Admin",
      "fecha": "2026-02-03T14:25:30.000Z"
    },
    "observaciones": "Comprobante verificado y aprobado"
  },
  "factura": {
    "nroFactura": "00001-00000001",
    "cae": "72345678901234",
    "tipoComprobante": "Factura B",
    "importeTotal": 10000
  }
}
```

---

## 4. Aprobar Comprobante - Cliente Responsable Inscripto

**Endpoint:** `PUT {{BASE_URL}}/comprobantes/COMP-1707340456790/aprobar`

**Headers:**
```
Authorization: Bearer {{ADMIN_TOKEN}}
Content-Type: application/json
```

**Body:**
```json
{
  "estado": "aprobado",
  "observaciones": "Cliente verificado - Responsable Inscripto",
  "puntoVenta": 1
}
```

**Respuesta Exitosa:**
```json
{
  "success": true,
  "mensaje": "Comprobante aprobado y factura generada exitosamente",
  "comprobante": {
    "nroComprobante": "COMP-1707340456790",
    "estado": "aprobado",
    "facturaGenerada": {
      "nroFactura": "00001-00000002",
      "cae": "72345678901235",
      "fechaEmision": "2026-02-03T14:30:00.000Z",
      "tipoComprobante": 1,
      "tipoComprobanteDescripcion": "Factura A"
    },
    "aprobadoPor": {
      "dni": "12345678",
      "nombre": "Juan",
      "apellido": "Admin",
      "fecha": "2026-02-03T14:30:00.000Z"
    }
  },
  "factura": {
    "nroFactura": "00001-00000002",
    "cae": "72345678901235",
    "tipoComprobante": "Factura A",
    "importeTotal": 12100
  }
}
```

**Nota:** Para este caso el cliente debe tener:
```json
{
  "cuit": "30712345678",
  "condicionIVA": "Responsable Inscripto"
}
```

---

## 5. Rechazar Comprobante

**Endpoint:** `PUT {{BASE_URL}}/comprobantes/COMP-1707340456791/aprobar`

**Headers:**
```
Authorization: Bearer {{ADMIN_TOKEN}}
Content-Type: application/json
```

**Body:**
```json
{
  "estado": "rechazado",
  "observaciones": "El monto no coincide con el depósito bancario"
}
```

**Respuesta Exitosa:**
```json
{
  "success": true,
  "mensaje": "Comprobante rechazado",
  "comprobante": {
    "nroComprobante": "COMP-1707340456791",
    "estado": "rechazado",
    "aprobadoPor": {
      "dni": "12345678",
      "nombre": "Juan",
      "apellido": "Admin",
      "fecha": "2026-02-03T14:35:00.000Z"
    },
    "observaciones": "El monto no coincide con el depósito bancario"
  }
}
```

---

## 6. Actualizar Datos Fiscales de Usuario

**Endpoint:** `PUT {{BASE_URL}}/usuarios/38456789`

**Headers:**
```
Authorization: Bearer {{ADMIN_TOKEN}}
Content-Type: application/json
```

**Body - Cliente Responsable Inscripto:**
```json
{
  "cuit": "30712345678",
  "condicionIVA": "Responsable Inscripto"
}
```

**Body - Cliente Monotributo:**
```json
{
  "cuit": "20345678901",
  "condicionIVA": "Monotributo"
}
```

**Body - Cliente Consumidor Final:**
```json
{
  "cuit": null,
  "condicionIVA": "Consumidor Final"
}
```

**Respuesta Exitosa:**
```json
{
  "mensaje": "Usuario actualizado correctamente",
  "usuario": {
    "dni": "38456789",
    "nombre": "María",
    "apellido": "González",
    "email": "maria@email.com",
    "cuit": "30712345678",
    "condicionIVA": "Responsable Inscripto",
    "asociado": false,
    "tarifaAsignada": null,
    "montoDisponible": 15000
  }
}
```

---

## 7. Consultar Comprobante Específico (Usuario)

**Endpoint:** `GET {{BASE_URL}}/comprobantes/COMP-1707340456789`

**Headers:**
```
Authorization: Bearer {{USER_TOKEN}}
```

**Respuesta:**
```json
{
  "success": true,
  "comprobante": {
    "nroComprobante": "COMP-1707340456789",
    "usuario": {
      "dni": "38456789",
      "nombre": "María",
      "apellido": "González"
    },
    "montoAcreditado": 10000,
    "montoDisponible": 15000,
    "estado": "aprobado",
    "fecha": "2026-02-03T10:30:00.000Z",
    "facturaGenerada": {
      "nroFactura": "00001-00000001",
      "cae": "72345678901234",
      "fechaEmision": "2026-02-03T14:25:30.000Z",
      "tipoComprobante": 6,
      "tipoComprobanteDescripcion": "Factura B"
    }
  }
}
```

---

## 8. Listar Mis Comprobantes (Usuario)

**Endpoint:** `GET {{BASE_URL}}/comprobantes`

**Headers:**
```
Authorization: Bearer {{USER_TOKEN}}
```

**Respuesta:**
```json
{
  "success": true,
  "count": 5,
  "comprobantes": [
    {
      "nroComprobante": "COMP-1707340456789",
      "montoAcreditado": 10000,
      "estado": "aprobado",
      "fecha": "2026-02-03T10:30:00.000Z",
      "facturaGenerada": {
        "nroFactura": "00001-00000001",
        "cae": "72345678901234"
      }
    },
    {
      "nroComprobante": "COMP-1707340456788",
      "montoAcreditado": 5000,
      "estado": "pendiente",
      "fecha": "2026-02-02T15:20:00.000Z"
    }
  ]
}
```

---

## Errores Comunes

### Error 403 - Sin permisos
```json
{
  "success": false,
  "error": "No tiene permisos para aprobar comprobantes"
}
```
**Solución:** Usar token de admin

### Error 400 - Comprobante ya procesado
```json
{
  "success": false,
  "mensaje": "El comprobante ya fue aprobado"
}
```
**Solución:** Verificar el estado del comprobante primero

### Error 400 - Factura ya existe
```json
{
  "success": false,
  "mensaje": "Ya existe una factura emitida para este comprobante",
  "facturaExistente": {
    "nroFactura": "00001-00000001",
    "cae": "72345678901234"
  }
}
```
**Solución:** El comprobante ya fue facturado, no se puede facturar de nuevo

### Error 404 - Cliente no encontrado
```json
{
  "success": false,
  "mensaje": "Cliente no encontrado"
}
```
**Solución:** Verificar que el DNI del comprobante corresponda a un usuario existente

### Error 500 - Error con AFIP
```json
{
  "success": false,
  "mensaje": "Error al generar factura electrónica en AFIP: [detalle del error]"
}
```
**Solución:** Verificar configuración de AFIP, certificados y conexión

---

## Flujo Completo de Testing

### Paso 1: Preparar Usuario
```http
PUT {{BASE_URL}}/usuarios/38456789
{
  "cuit": "30712345678",
  "condicionIVA": "Responsable Inscripto"
}
```

### Paso 2: Crear Comprobante (como usuario)
```http
POST {{BASE_URL}}/comprobantes
{
  "dni": "38456789",
  "montoAcreditado": 12100,
  "usuario": {
    "dni": "38456789",
    "nombre": "María",
    "apellido": "González"
  }
}
```

### Paso 3: Listar Pendientes (como admin)
```http
GET {{BASE_URL}}/comprobantes?estado=pendiente
```

### Paso 4: Aprobar (como admin)
```http
PUT {{BASE_URL}}/comprobantes/[NRO_COMPROBANTE]/aprobar
{
  "estado": "aprobado",
  "observaciones": "OK",
  "puntoVenta": 1
}
```

### Paso 5: Verificar Factura (como usuario)
```http
GET {{BASE_URL}}/comprobantes/[NRO_COMPROBANTE]
```

---

## Casos de Prueba

### Caso 1: Consumidor Final - Factura B
- Cliente sin CUIT
- condicionIVA: "Consumidor Final"
- Resultado: Factura B (código 6)
- IVA: Incluido

### Caso 2: Responsable Inscripto - Factura A
- Cliente con CUIT
- condicionIVA: "Responsable Inscripto"
- Resultado: Factura A (código 1)
- IVA: Discriminado

### Caso 3: Monotributo - Factura B
- Cliente con CUIT
- condicionIVA: "Monotributo"
- Resultado: Factura B (código 6)
- IVA: Incluido

### Caso 4: Exento - Factura C
- Cliente con CUIT o DNI
- condicionIVA: "Exento"
- Resultado: Factura C (código 11)
- IVA: Sin IVA
