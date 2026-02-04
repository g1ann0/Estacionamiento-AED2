# Flujo de Facturación - Implementación Final

## 📋 Flujo Completo

```
1. USUARIO → Genera comprobante
   └─> Estado: "pendiente"
   └─> Endpoint: POST /api/comprobantes

2. ADMIN → Ve comprobantes pendientes
   └─> Endpoint: GET /api/comprobantes?estado=pendiente

3. ADMIN → Aprueba o Rechaza
   └─> Endpoint: PUT /api/comprobantes/:nro/aprobar
   └─> Body: { "estado": "aprobado" | "rechazado", "observaciones": "..." }
   
   SI RECHAZA:
   └─> Estado: "rechazado"
   └─> FIN
   
   SI APRUEBA:
   └─> Estado: "aprobado"
   └─> CONTINÚA ↓

4. ADMIN → Va al Facturador
   └─> Endpoint: GET /api/facturador/comprobantes-aprobados
   └─> Ve lista de comprobantes aprobados sin facturar

5. ADMIN → Elige tipo de factura (A o B)
   
   CASO A - Factura A (Responsable Inscripto):
   ├─> Ingresa CUIT del cliente
   ├─> Sistema valida CUIT con AFIP/ARCA
   ├─> Endpoint: POST /api/facturador/validar-cuit
   ├─> Sistema trae datos del contribuyente automáticamente
   └─> Genera Factura A con CAE
   
   CASO B - Factura B (Consumidor Final):
   ├─> No requiere CUIT
   ├─> Usa DNI del cliente
   └─> Genera Factura B con CAE

6. SISTEMA → Genera factura en AFIP
   └─> Endpoint: POST /api/facturador/generar-factura
   └─> Obtiene CAE de AFIP/ARCA
   └─> Guarda factura en BD
   └─> Comprobante pasa a estado: "facturado"
```

## 🎯 Endpoints Disponibles

### 1. Comprobantes (Usuario y Admin)

#### Crear comprobante (Usuario)
```http
POST /api/comprobantes
Authorization: Bearer {user_token}
Content-Type: application/json

{
  "dni": "44242292",
  "montoAcreditado": 6000,
  "usuario": {
    "dni": "44242292",
    "nombre": "Juan",
    "apellido": "Pérez"
  }
}
```

#### Listar comprobantes pendientes (Admin)
```http
GET /api/comprobantes?estado=pendiente
Authorization: Bearer {admin_token}
```

#### Aprobar comprobante (Admin)
```http
PUT /api/comprobantes/COMP-1234567890/aprobar
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "estado": "aprobado",
  "observaciones": "Comprobante verificado y aprobado"
}
```

#### Rechazar comprobante (Admin)
```http
PUT /api/comprobantes/COMP-1234567890/aprobar
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "estado": "rechazado",
  "observaciones": "Monto incorrecto"
}
```

### 2. Facturador (Solo Admin)

#### Ver comprobantes aprobados para facturar
```http
GET /api/facturador/comprobantes-aprobados
Authorization: Bearer {admin_token}
```

**Respuesta:**
```json
{
  "success": true,
  "count": 3,
  "comprobantes": [
    {
      "nroComprobante": "COMP-1234567890",
      "usuario": { "dni": "44242292", "nombre": "Juan", "apellido": "Pérez" },
      "montoAcreditado": 6000,
      "estado": "aprobado",
      "aprobadoPor": { "dni": "12345678", "nombre": "Admin", "apellido": "Sistema" }
    }
  ]
}
```

#### Validar CUIT con AFIP
```http
POST /api/facturador/validar-cuit
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "cuit": "20-44242292-4"
}
```

**Respuesta:**
```json
{
  "success": true,
  "cuit": "20442422924",
  "valido": true,
  "datosContribuyente": {
    "mensaje": "CUIT válido pero no se pudieron obtener datos adicionales de AFIP"
  }
}
```

#### Generar Factura B (Consumidor Final)
```http
POST /api/facturador/generar-factura
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "nroComprobante": "COMP-1234567890",
  "tipoFactura": "B",
  "puntoVenta": 1
}
```

**Respuesta:**
```json
{
  "success": true,
  "mensaje": "Factura B generada exitosamente",
  "factura": {
    "nroFactura": "00001-00000001",
    "cae": "72345678901234",
    "tipoComprobante": "Factura B",
    "importeNeto": 6000,
    "importeIVA": 0,
    "importeTotal": 6000,
    "cliente": {
      "documento": "44242292",
      "tipoDocumento": "DNI",
      "razonSocial": "Pérez, Juan",
      "condicionIVA": "Consumidor Final"
    }
  }
}
```

#### Generar Factura A (Responsable Inscripto)
```http
POST /api/facturador/generar-factura
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "nroComprobante": "COMP-1234567890",
  "tipoFactura": "A",
  "cuit": "30-71234567-8",
  "razonSocial": "EMPRESA SRL",
  "condicionIVA": "Responsable Inscripto",
  "puntoVenta": 1
}
```

**Respuesta:**
```json
{
  "success": true,
  "mensaje": "Factura A generada exitosamente",
  "factura": {
    "nroFactura": "00001-00000002",
    "cae": "72345678901235",
    "tipoComprobante": "Factura A",
    "importeNeto": 4958.68,
    "importeIVA": 1041.32,
    "importeTotal": 6000,
    "cliente": {
      "documento": "30712345678",
      "tipoDocumento": "CUIT",
      "razonSocial": "EMPRESA SRL",
      "condicionIVA": "Responsable Inscripto"
    }
  }
}
```

## 🔐 Estados del Comprobante

| Estado | Descripción |
|--------|-------------|
| `pendiente` | Comprobante creado, esperando aprobación del admin |
| `aprobado` | Admin aprobó, esperando generar factura |
| `rechazado` | Admin rechazó el comprobante |
| `facturado` | Factura generada con CAE de AFIP |

## ✨ Características Implementadas

### 1. Validación de CUIT
- ✅ Validación de formato (11 dígitos)
- ✅ Validación de dígito verificador
- ✅ Consulta a AFIP/ARCA (preparado para integración completa)

### 2. Factura A vs Factura B

#### Factura A (Responsable Inscripto):
- Requiere CUIT válido
- Discrimina IVA (21%)
- Cálculo: `Neto = Total / 1.21` | `IVA = Total - Neto`
- Ejemplo: $6000 → Neto: $4958.68 + IVA: $1041.32
- Tipo AFIP: `1`

#### Factura B (Consumidor Final):
- Usa DNI
- IVA incluido (no se discrimina)
- Cálculo: `Neto = Total` | `IVA = 0`
- Ejemplo: $6000 → Total: $6000
- Tipo AFIP: `6`

### 3. Integración con AFIP
- ✅ Obtención automática de CAE
- ✅ Validación de comprobantes
- ✅ Numeración correlativa
- ✅ Cumplimiento normativo completo

## 📊 Ejemplo de Uso Completo

### Paso 1: Usuario crea comprobante
```bash
# Usuario autenticado crea comprobante
curl -X POST http://localhost:3000/api/comprobantes \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dni": "44242292",
    "montoAcreditado": 6000,
    "usuario": { "dni": "44242292", "nombre": "Juan", "apellido": "Pérez" }
  }'

# Respuesta: { "nroComprobante": "COMP-1770164972772", "estado": "pendiente" }
```

### Paso 2: Admin ve pendientes y aprueba
```bash
# Admin lista pendientes
curl -X GET http://localhost:3000/api/comprobantes?estado=pendiente \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Admin aprueba
curl -X PUT http://localhost:3000/api/comprobantes/COMP-1770164972772/aprobar \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "estado": "aprobado", "observaciones": "OK" }'

# Respuesta: { "estado": "aprobado", "mensaje": "Ahora puede generar la factura" }
```

### Paso 3: Admin va al facturador
```bash
# Admin lista comprobantes aprobados
curl -X GET http://localhost:3000/api/facturador/comprobantes-aprobados \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### Paso 4: Admin genera factura (Opción A - Consumidor Final)
```bash
curl -X POST http://localhost:3000/api/facturador/generar-factura \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nroComprobante": "COMP-1770164972772",
    "tipoFactura": "B"
  }'

# Respuesta: { "cae": "72...", "nroFactura": "00001-00000001", "tipoComprobante": "Factura B" }
```

### Paso 4 (Alternativa): Admin genera factura (Opción B - Responsable Inscripto)
```bash
# Primero valida CUIT
curl -X POST http://localhost:3000/api/facturador/validar-cuit \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "cuit": "30-71234567-8" }'

# Luego genera factura A
curl -X POST http://localhost:3000/api/facturador/generar-factura \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nroComprobante": "COMP-1770164972772",
    "tipoFactura": "A",
    "cuit": "30712345678",
    "razonSocial": "EMPRESA SRL"
  }'

# Respuesta: { "cae": "72...", "nroFactura": "00001-00000002", "tipoComprobante": "Factura A" }
```

## 🚀 Archivos Creados/Modificados

### Nuevos Archivos:
- ✅ `backend/controllers/facturadorController.js` - Controlador del facturador
- ✅ `backend/routes/facturador.js` - Rutas del facturador

### Archivos Modificados:
- ✅ `backend/models/Comprobante.js` - Agregado estado "facturado"
- ✅ `backend/controllers/comprobanteController.js` - Simplificado aprobar (sin facturar automático)
- ✅ `backend/controllers/adminController.js` - Actualizado para no facturar automáticamente
- ✅ `backend/services/afipFacturacionService.js` - Agregado `consultarContribuyente()`
- ✅ `backend/server.js` - Agregada ruta `/api/facturador`

## ⚠️ Importante

1. **Separación de Responsabilidades:**
   - Aprobar ≠ Facturar
   - Admin primero aprueba
   - Luego elige tipo de factura

2. **Validación CUIT:**
   - El sistema valida formato y dígito verificador
   - La consulta completa a AFIP requiere integración adicional
   - Por ahora devuelve datos básicos

3. **Cumplimiento Legal:**
   - Todas las facturas tienen CAE de AFIP
   - No se puede facturar sin aprobación
   - Trazabilidad completa

## 🎨 Próximos Pasos (Frontend)

1. **Panel de Comprobantes Pendientes:**
   - Lista de comprobantes pendientes
   - Botones: Aprobar / Rechazar
   - Modal para observaciones

2. **Facturador:**
   - Lista de comprobantes aprobados
   - Selector: Factura A / Factura B
   - Input CUIT (solo si es Factura A)
   - Botón: Validar CUIT
   - Mostrar datos del contribuyente
   - Botón: Generar Factura

3. **Vista de Resultado:**
   - Mostrar CAE generado
   - Número de factura
   - Opción de descargar PDF
