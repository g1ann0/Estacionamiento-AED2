# 🧪 CERTIFICADO DE HOMOLOGACIÓN AFIP/ARCA

## 📋 Requisitos Previos

Para generar el certificado de homologación necesitas:

1. ✅ **Clave Fiscal AFIP** (nivel 3 o superior)
2. ✅ **CUIT de la empresa**
3. ✅ **OpenSSL instalado** en tu PC
4. ✅ **Acceso al sitio de homologación de AFIP**

---

## 🔧 PASO 1: Instalar OpenSSL (si no lo tienes)

### Windows:
1. Descargar de: https://slproweb.com/products/Win32OpenSSL.html
2. Instalar: **Win64 OpenSSL v3.x.x Light**
3. Agregar a PATH del sistema:
   - `C:\Program Files\OpenSSL-Win64\bin`

### Verificar instalación:
```bash
openssl version
```
Debe mostrar: `OpenSSL 3.x.x`

---

## 🔑 PASO 2: Generar Clave Privada y CSR

Abre **PowerShell** o **Git Bash** como administrador:

```bash
# Navegar a la carpeta de certificados
cd backend/certs

# 1. Generar clave privada RSA de 2048 bits
openssl genrsa -out afip_homologacion.key 2048

# 2. Generar CSR (Certificate Signing Request)
openssl req -new -key afip_homologacion.key -out afip_homologacion.csr
```

### Al ejecutar el CSR, te pedirá datos:

```
Country Name (2 letter code) []:AR
State or Province Name []:Buenos Aires
Locality Name []:CABA
Organization Name []:ESTACIONAMIENTO SEGURO SA
Organizational Unit Name []:IT
Common Name []:20409378472          ← TU CUIT
Email Address []:admin@tuempresa.com
```

**💡 IMPORTANTE:**
- **Common Name:** Debe ser tu CUIT (ej: `20409378472`)
- **Organization:** Razón social de tu empresa
- **Email:** Email válido

**Dejar en blanco:**
- A challenge password
- An optional company name

### Archivos generados:
```
backend/certs/
├── afip_homologacion.key    ← Clave privada (GUARDAR)
└── afip_homologacion.csr    ← CSR para subir a AFIP
```

---

## 🌐 PASO 3: Solicitar Certificado en AFIP Homologación

### Opción A: Con Clave Fiscal (Recomendado)

1. **Ingresar a AFIP con Clave Fiscal:**
   - URL: https://auth.afip.gob.ar/contribuyente_/login.xhtml

2. **Ir a "Administrador de Relaciones de Clave Fiscal"**
   - Menú → Sistema Registral → Administrador de Relaciones

3. **Nueva Relación:**
   - Click en "Nueva Relación"
   - Buscar servicio: **"wsfe"** (Web Service Facturación Electrónica)
   - Seleccionar: **"wsfe - Servicio de Facturación Electrónica"**

4. **Adherirse al Servicio:**
   - Aceptar términos y condiciones
   - Confirmar adhesión

5. **Generar Certificado:**
   - En "Administrador de Certificados Digitales"
   - Click "Generar nuevo certificado"
   - Seleccionar servicio: **wsfe**

6. **Subir CSR:**
   - Abrir el archivo `afip_homologacion.csr` con Notepad
   - Copiar TODO el contenido (incluye `-----BEGIN CERTIFICATE REQUEST-----`)
   - Pegarlo en el campo de texto de AFIP
   - Click "Generar"

7. **Descargar Certificado:**
   - AFIP procesará y mostrará el certificado
   - Click "Descargar" o copiar el contenido
   - Guardar como: `afip_homologacion.crt`

### Opción B: Ambiente de Testing (Sin trámites)

Para pruebas rápidas, AFIP provee certificados de ejemplo:

**⚠️ NOTA:** Estos son para testing básico, NO para homologación real.

---

## 📦 PASO 4: Convertir Certificado a Formato PEM

```bash
# En backend/certs/
openssl x509 -in afip_homologacion.crt -out afip_homologacion_cert.pem -outform PEM
```

### Resultado:
```
backend/certs/
├── afip_homologacion.key           ← Clave privada
├── afip_homologacion.csr           ← CSR (ya no se necesita)
├── afip_homologacion.crt           ← Certificado original
└── afip_homologacion_cert.pem      ← Certificado en PEM ✓
```

---

## ⚙️ PASO 5: Configurar el Sistema

### Opción 1: Renombrar archivos (más simple)

```bash
cd backend/certs
mv afip_homologacion_cert.pem afip_cert.pem
mv afip_homologacion.key afip_private_key.key
```

### Opción 2: Actualizar .env

Editar `backend/.env`:

```env
# AFIP - Homologación con Certificado
AFIP_CUIT=20409378472                              # TU CUIT
AFIP_PRODUCTION=false                              # Modo homologación
AFIP_CERT_PATH=./certs/afip_homologacion_cert.pem # Certificado
AFIP_KEY_PATH=./certs/afip_homologacion.key       # Clave privada
```

---

## ✅ PASO 6: Verificar que Funciona

### 1. Reiniciar el servidor:
```bash
cd backend
npm start
```

### 2. Verificar en consola:
```
✅ AFIP SDK inicializado correctamente
   Modo: HOMOLOGACIÓN
   CUIT: 20409378472
   Certificado: Configurado ✓
```

### 3. Probar estado AFIP:
```bash
# Con curl o Postman
GET http://localhost:3000/api/facturas-electronicas/afip/estado
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
  },
  "ambiente": "homologacion"
}
```

### 4. Probar desde el Frontend:
1. Login como admin
2. Ir a "📄 Facturador AFIP"
3. Debe mostrar: **✅ AFIP Online**

---

## 🆘 Troubleshooting

### ❌ Error: "openssl no se reconoce"

**Solución:**
1. Instalar OpenSSL desde https://slproweb.com/products/Win32OpenSSL.html
2. Agregar a PATH: `C:\Program Files\OpenSSL-Win64\bin`
3. Reiniciar PowerShell

### ❌ Error: "CSR inválido"

**Verificar:**
- Common Name debe ser el CUIT (sin guiones)
- El archivo .csr se copió completo (incluye BEGIN/END)
- No hay espacios extra al copiar

**Regenerar:**
```bash
openssl req -new -key afip_homologacion.key -out afip_homologacion.csr
```

### ❌ Error: "Certificado vencido"

Los certificados de homologación vencen. **Renovar:**
1. Usar el mismo `.key` existente
2. Generar nuevo CSR
3. Solicitar nuevo certificado en AFIP
4. Reemplazar el `.pem`

### ❌ Error: "CUIT no coincide"

El CUIT en `.env` debe ser el mismo que usaste en el Common Name del CSR.

### ❌ Error: "No autorizado para wsfe"

**Solución:**
1. Verificar adhesión a wsfe en AFIP
2. Esperar 24-48 hs después de adherirse
3. Contactar soporte AFIP: 0800-999-2347

---

## 🔄 Diferencias: Homologación vs Producción

| Característica | Homologación | Producción |
|---------------|--------------|------------|
| **Ambiente AFIP** | Testing | Real |
| **CAE generados** | Prueba (no válidos) | Válidos legalmente |
| **Certificado** | Específico para testing | Certificado oficial |
| **CUIT** | Puede ser de prueba | Debe ser real |
| **Facturación** | No impacta impuestos | Declaración real |
| **Renovación** | Más flexible | Proceso formal |

---

## 📝 Checklist Completo

- [ ] OpenSSL instalado y funcionando
- [ ] Clave Fiscal AFIP activa
- [ ] Adhesión a servicio wsfe en AFIP
- [ ] Clave privada generada (`afip_homologacion.key`)
- [ ] CSR generado con CUIT correcto
- [ ] CSR subido a AFIP
- [ ] Certificado descargado de AFIP
- [ ] Certificado convertido a PEM
- [ ] Archivos copiados a `backend/certs/`
- [ ] `.env` configurado correctamente
- [ ] Servidor reiniciado
- [ ] Estado AFIP verificado (online)
- [ ] Factura de prueba generada exitosamente

---

## 📞 Contactos AFIP

- **Web:** https://www.afip.gob.ar
- **Teléfono:** 0800-999-2347
- **Homologación:** https://wswhomo.afip.gov.ar (ambiente de testing)
- **Documentación:** https://www.afip.gob.ar/ws/documentacion/ws-facturacion-electronica.asp

---

## 💡 Tips Importantes

1. **Guardar la clave privada (.key) en lugar seguro** - Es irrecuperable si se pierde
2. **Hacer backup de los certificados** - En USB cifrado o cloud privado
3. **Anotar la fecha de vencimiento** - Renovar antes de que expire
4. **Probar primero en homologación** - Antes de pasar a producción
5. **No mezclar certificados** - Homologación ≠ Producción

---

## 🎯 Resumen Rápido

```bash
# 1. Generar clave y CSR
cd backend/certs
openssl genrsa -out afip_homologacion.key 2048
openssl req -new -key afip_homologacion.key -out afip_homologacion.csr
# Common Name = TU_CUIT

# 2. Ir a AFIP → Subir CSR → Descargar certificado

# 3. Convertir a PEM
openssl x509 -in afip_homologacion.crt -out afip_cert.pem -outform PEM

# 4. Renombrar clave
mv afip_homologacion.key afip_private_key.key

# 5. Configurar .env
# AFIP_CUIT=TU_CUIT
# AFIP_PRODUCTION=false
# AFIP_CERT_PATH=./certs/afip_cert.pem
# AFIP_KEY_PATH=./certs/afip_private_key.key

# 6. Reiniciar servidor
cd ..
npm start
```

---

**¡Listo para facturar en homologación! 🚀**
