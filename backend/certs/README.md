# 📁 Carpeta de Certificados AFIP

## 📄 Archivos Requeridos

Coloca aquí tus certificados AFIP en formato **PEM**:

### 1. Certificado X.509 (archivo .pem)
- **Nombre sugerido:** `afip_cert.pem`
- **Descripción:** Certificado público de AFIP

### 2. Clave Privada (archivo .key)
- **Nombre sugerido:** `afip_private_key.key`
- **Descripción:** Clave privada asociada al certificado

---

## 🔐 Cómo Obtener los Certificados de AFIP

### Opción 1: Para Testing (Sin Certificados)
Si estás en **modo HOMOLOGACIÓN**, NO necesitas certificados.

Solo configura en `backend/.env`:
```env
AFIP_CUIT=20409378472
AFIP_PRODUCTION=false
```

### Opción 2: Para Producción (Con Certificados)

#### Paso 1: Generar Certificado en AFIP
1. Ingresa a **https://www.afip.gob.ar** con Clave Fiscal
2. Ir a **"Administrador de Relaciones de Clave Fiscal"**
3. Click en **"Nueva Relación"**
4. Buscar servicio: **"Factura Electrónica - wsfe"**
5. Completar datos y generar certificado
6. **Descargar** el certificado (.crt o .cer)

#### Paso 2: Generar Clave Privada (si no la tienes)
```bash
# Generar clave privada RSA de 2048 bits
openssl genrsa -out afip_private_key.key 2048
```

#### Paso 3: Generar CSR (Certificate Signing Request)
```bash
openssl req -new -key afip_private_key.key -out afip.csr
```

Completar datos:
- **Country Name (C):** AR
- **State (ST):** Tu provincia
- **Locality (L):** Tu ciudad
- **Organization (O):** Razón social de tu empresa
- **Common Name (CN):** Tu CUIT
- **Email:** Email de contacto

#### Paso 4: Subir CSR a AFIP
1. En AFIP, sube el archivo `afip.csr`
2. AFIP procesará y te dará el certificado firmado
3. Descarga el certificado (ejemplo: `certificado_afip.crt`)

#### Paso 5: Convertir a Formato PEM
```bash
# Convertir certificado a PEM
openssl x509 -in certificado_afip.crt -out afip_cert.pem -outform PEM
```

#### Paso 6: Colocar Archivos en esta Carpeta
```
backend/certs/
├── afip_cert.pem          ← Certificado en formato PEM
└── afip_private_key.key   ← Clave privada
```

---

## ⚙️ Configuración en .env

Una vez que tengas los archivos, configura en `backend/.env`:

```env
# AFIP - Producción
AFIP_CUIT=20123456789              # Tu CUIT real
AFIP_PRODUCTION=true               # Modo producción
AFIP_CERT_PATH=./certs/afip_cert.pem         # Ruta al certificado
AFIP_KEY_PATH=./certs/afip_private_key.key   # Ruta a la clave
```

---

## 🔒 Seguridad

### ⚠️ IMPORTANTE:
- **NUNCA** subas estos archivos a Git/GitHub
- **NUNCA** compartas tus certificados
- Guarda copias de seguridad en lugar seguro
- Los certificados tienen fecha de vencimiento (renovar antes)

### Protección con .gitignore
Esta carpeta ya está protegida en `.gitignore`:
```
backend/certs/*.pem
backend/certs/*.key
backend/certs/*.crt
backend/certs/*.cer
```

Solo se subirá este archivo README.md

---

## ✅ Verificar que Funciona

### 1. Reiniciar el servidor
```bash
cd backend
npm start
```

### 2. Buscar en la consola
**Modo Testing (sin certificados):**
```
✅ AFIP SDK inicializado correctamente
   Modo: HOMOLOGACIÓN (TESTING)
   CUIT: 20409378472
   Certificado: No configurado (modo TEST)
```

**Modo Producción (con certificados):**
```
✅ AFIP SDK inicializado correctamente
   Modo: PRODUCCIÓN
   CUIT: 20123456789
   Certificado: Configurado ✓
```

### 3. Probar endpoint
```bash
# Desde Postman o curl
GET http://localhost:3000/api/facturas-electronicas/afip/estado
Authorization: Bearer {tu_token}
```

Respuesta esperada:
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

## 🆘 Troubleshooting

### Error: "Certificado no encontrado"
**Solución:**
- Verificar que los archivos existan en `backend/certs/`
- Verificar que las rutas en `.env` sean correctas
- Verificar permisos de lectura de los archivos

### Error: "Token inválido"
**Solución:**
- El certificado puede estar vencido
- Renovar certificado en AFIP
- Verificar que el CUIT coincida con el del certificado

### Error: "Wrong format"
**Solución:**
- Asegurarse que los archivos estén en formato PEM
- Convertir con `openssl` si es necesario

---

## 📞 Ayuda AFIP
- **Web:** https://www.afip.gob.ar
- **Teléfono:** 0800-999-2347
- **Email:** cac@afip.gob.ar

---

## 📚 Documentación Relacionada

- Ver `GUIA_RAPIDA_AFIP.md` para setup completo
- Ver `INTEGRACION_AFIP_COMPLETA.md` para detalles técnicos
