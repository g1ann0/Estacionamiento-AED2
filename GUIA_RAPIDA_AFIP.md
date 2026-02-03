# ⚡ GUÍA RÁPIDA - CONFIGURACIÓN AFIP

## 🎯 PASOS PARA EMPEZAR (Modo Testing)

### 1. Configurar Variables de Entorno

Editar `backend/.env` y agregar:

```env
# AFIP - Modo Testing (Homologación)
AFIP_CUIT=20409378472
AFIP_PRODUCTION=false
```

### 2. Reiniciar el Servidor

```bash
cd backend
npm start
```

Deberías ver en la consola:
```
✅ AFIP SDK inicializado correctamente
   Modo: HOMOLOGACIÓN (TESTING)
   CUIT: 20409378472
   Certificado: No configurado (modo TEST)
```

### 3. Configurar Datos de la Empresa

Acceder como admin y configurar en:
`Panel Admin > Configuración de Empresa`

**Datos mínimos obligatorios:**
- Razón Social: `ESTACIONAMIENTO TEST S.A.`
- CUIT: `20409378472` (mismo del .env)
- Domicilio: `Av. Test 1234, CABA`
- Condición IVA: `Responsable Inscripto`
- Punto de Venta: `1`

### 4. Probar la Integración

#### Verificar Estado de AFIP
```bash
curl http://localhost:3000/api/facturas-electronicas/afip/estado \
  -H "Authorization: Bearer {token_admin}"
```

**Respuesta esperada:**
```json
{
  "success": true,
  "afip": {
    "online": true,
    "appServer": "OK",
    "dbServer": "OK",
    "authServer": "OK"
  }
}
```

#### Crear Factura de Prueba

1. Aprobar un comprobante de pago en el sistema
2. Llamar al endpoint:

```bash
curl -X POST http://localhost:3000/api/facturas-electronicas/crear \
  -H "Authorization: Bearer {token_admin}" \
  -H "Content-Type: application/json" \
  -d '{
    "comprobanteId": "COMP-00000001",
    "tipoComprobante": 82,
    "puntoVenta": 1
  }'
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "mensaje": "Factura electrónica creada y autorizada por AFIP exitosamente",
  "factura": {
    "nroFactura": "00001-00000001",
    "cae": "72041234567890",
    "caeFechaVencimiento": "20260212",
    "tipoComprobante": "Tique Factura B",
    "importeTotal": 5000
  }
}
```

---

## 🔄 MIGRAR A PRODUCCIÓN

### 1. Obtener Certificados de AFIP

1. Ingresar a https://www.afip.gob.ar con Clave Fiscal
2. Ir a "Administrador de Relaciones de Clave Fiscal"
3. Seleccionar "Nueva Relación"
4. Buscar "Factura Electrónica - Servicio wsfe"
5. Generar certificado y descargar

### 2. Convertir Certificado

```bash
openssl x509 -in certificado.crt -out afip_cert.pem -outform PEM
```

### 3. Guardar Archivos

Crear carpeta `backend/certs/` y guardar:
- `afip_cert.pem`
- `afip_private_key.key`

### 4. Actualizar .env

```env
# AFIP - Modo Producción
AFIP_CUIT=20123456789  # TU CUIT REAL
AFIP_PRODUCTION=true
AFIP_CERT_PATH=./certs/afip_cert.pem
AFIP_KEY_PATH=./certs/afip_private_key.key
```

### 5. Reiniciar y Verificar

```bash
npm start
```

Consola debe mostrar:
```
✅ AFIP SDK inicializado correctamente
   Modo: PRODUCCIÓN
   CUIT: 20123456789
   Certificado: Configurado
```

---

## 🧪 TESTING RÁPIDO

### Script de Prueba (Node.js)

Crear `backend/test-afip.js`:

```javascript
const afipConfig = require('./config/afip');

async function test() {
  try {
    const afip = afipConfig.getInstance();
    const status = await afip.ElectronicBilling.getServerStatus();
    console.log('✅ AFIP Online:', status);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

test();
```

Ejecutar:
```bash
node test-afip.js
```

---

## ❗ TROUBLESHOOTING RÁPIDO

| Error | Solución |
|-------|----------|
| `CUIT no configurado` | Agregar `AFIP_CUIT` en `.env` |
| `Certificado no encontrado` | Cambiar a testing: `AFIP_PRODUCTION=false` |
| `Token inválido` | Renovar certificado en AFIP |
| `Punto de venta no habilitado` | Habilitar en AFIP web |
| `CAE duplicado` | Verificar numeración correlativa |

---

## 📞 SOPORTE

- **Documentación Completa:** Ver `INTEGRACION_AFIP_COMPLETA.md`
- **AFIP Ayuda:** 0800-999-2347
- **Web AFIP:** https://www.afip.gob.ar

---

**¡Listo! El sistema está configurado para facturación electrónica.**
