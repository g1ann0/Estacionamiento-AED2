# 📋 UBICACIÓN DE CERTIFICADOS AFIP/ARCA

## 📍 Dónde colocar los certificados

### Estructura de Carpetas
```
backend/
├── certs/                          ← AQUÍ van los certificados
│   ├── afip_cert.pem              ← Certificado AFIP (formato PEM)
│   ├── afip_private_key.key       ← Clave privada
│   └── README.md                   ← Instrucciones detalladas
├── .env                            ← Configuración
└── config/
    └── afip.js                     ← Lee los certificados automáticamente
```

---

## 🚀 Configuración Rápida

### OPCIÓN 1: Testing (SIN Certificados) ✅ RECOMENDADO PARA EMPEZAR

Edita `backend/.env`:
```env
AFIP_CUIT=20409378472
AFIP_PRODUCTION=false
```

✅ **¡Listo! Ya puedes facturar en modo testing**

---

### OPCIÓN 2: Producción (CON Certificados)

#### Paso 1: Obtener Certificados de AFIP

**En el sitio de AFIP:**
1. Ingresa a https://www.afip.gob.ar con Clave Fiscal
2. "Administrador de Relaciones de Clave Fiscal"
3. "Nueva Relación" → Buscar "wsfe" (Factura Electrónica)
4. Generar certificado
5. Descargar archivo `.crt` o `.cer`

#### Paso 2: Generar Clave Privada

**En terminal (Windows PowerShell o Git Bash):**
```bash
# Si tienes OpenSSL instalado
openssl genrsa -out afip_private_key.key 2048
```

**Si no tienes OpenSSL:**
- Descargar: https://slproweb.com/products/Win32OpenSSL.html
- Instalar versión "Win64 OpenSSL v3.x.x Light"

#### Paso 3: Convertir Certificado a PEM

```bash
cd backend/certs
openssl x509 -in certificado_descargado.crt -out afip_cert.pem -outform PEM
```

#### Paso 4: Colocar Archivos en la Carpeta

**Copiar a `backend/certs/`:**
```
backend/certs/
├── afip_cert.pem          ← Tu certificado convertido
└── afip_private_key.key   ← Tu clave privada
```

#### Paso 5: Configurar .env

Edita `backend/.env`:
```env
AFIP_CUIT=20123456789              # TU CUIT REAL
AFIP_PRODUCTION=true               # Modo producción
AFIP_CERT_PATH=./certs/afip_cert.pem
AFIP_KEY_PATH=./certs/afip_private_key.key
```

#### Paso 6: Reiniciar Servidor

```bash
cd backend
npm start
```

**Verificar en consola:**
```
✅ AFIP SDK inicializado correctamente
   Modo: PRODUCCIÓN
   CUIT: 20123456789
   Certificado: Configurado ✓
```

---

## 🔒 Seguridad

### ⚠️ MUY IMPORTANTE:

1. **NUNCA** subas los certificados a Git/GitHub
2. Los archivos `.pem` y `.key` están protegidos en `.gitignore`
3. Haz backup en lugar SEGURO (USB cifrado, cloud privado)
4. No compartas los certificados por email/WhatsApp

### Protección Automática

El archivo `.gitignore` YA protege:
```gitignore
backend/certs/*.pem
backend/certs/*.key
backend/certs/*.crt
backend/certs/*.cer
```

Solo se sube el `README.md` de la carpeta `certs/`

---

## ✅ Cómo Saber si Funciona

### 1. Ver Consola del Servidor

**Testing (sin certificados):**
```
✅ AFIP SDK inicializado correctamente
   Modo: HOMOLOGACIÓN (TESTING)
   CUIT: 20409378472
   Certificado: No configurado (modo TEST)
```

**Producción (con certificados):**
```
✅ AFIP SDK inicializado correctamente
   Modo: PRODUCCIÓN
   CUIT: 20123456789
   Certificado: Configurado ✓
```

### 2. Probar desde el Frontend

1. Login como admin
2. Ir a "📄 Facturador AFIP"
3. Ver indicador en la esquina:
   - ✅ **AFIP Online** → Todo OK
   - ❌ **AFIP Offline** → Revisar config

### 3. Probar desde API

```bash
# Con Postman o curl
GET http://localhost:3000/api/facturas-electronicas/afip/estado
Authorization: Bearer {tu_token}
```

Respuesta:
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

---

## 🆘 Problemas Comunes

### ❌ Error: "Certificado no encontrado"

**Verificar:**
1. Archivos en `backend/certs/`
2. Nombres correctos: `afip_cert.pem` y `afip_private_key.key`
3. Rutas en `.env` correctas

**Solución rápida:**
```bash
# Ver archivos en la carpeta
cd backend/certs
dir
```

### ❌ Error: "Token inválido"

**Causas:**
- Certificado vencido
- CUIT no coincide con el certificado
- Servicio wsfe no habilitado en AFIP

**Solución:**
- Renovar certificado en AFIP
- Verificar que el CUIT sea el correcto

### ❌ Error: "Wrong format"

**Causa:** Certificado no está en formato PEM

**Solución:**
```bash
openssl x509 -in certificado.crt -out afip_cert.pem -outform PEM
```

---

## 📚 Más Información

- **Instrucciones detalladas:** Ver `backend/certs/README.md`
- **Configuración completa:** Ver `GUIA_RAPIDA_AFIP.md`
- **Documentación técnica:** Ver `INTEGRACION_AFIP_COMPLETA.md`

---

## 🎯 Resumen

**Para TESTING (empezar ahora):**
```env
# backend/.env
AFIP_CUIT=20409378472
AFIP_PRODUCTION=false
```
✅ Sin certificados necesarios

**Para PRODUCCIÓN:**
```
1. Obtener certificado de AFIP
2. Convertir a PEM
3. Copiar a backend/certs/
4. Configurar .env con AFIP_PRODUCTION=true
5. Reiniciar servidor
```

---

**¿Necesitas ayuda?** Consulta `backend/certs/README.md` para detalles completos.
