# 🔑 GENERAR TU PROPIA CLAVE PRIVADA

## ⚡ Comando Rápido

Abre **PowerShell** o **Git Bash** y ejecuta:

```bash
cd backend/certs
openssl genrsa -out afip_private_key.key 2048
```

✅ **¡Listo!** Tendrás tu clave privada en `backend/certs/afip_private_key.key`

---

## 📋 Paso a Paso Completo

### 1️⃣ Verificar que tienes OpenSSL

```bash
openssl version
```

**Si no está instalado:**
- Windows: https://slproweb.com/products/Win32OpenSSL.html
- Descargar: **Win64 OpenSSL v3.x.x Light**

### 2️⃣ Navegar a la carpeta de certificados

```bash
cd backend/certs
```

### 3️⃣ Generar la clave privada

```bash
# Clave RSA de 2048 bits (estándar AFIP)
openssl genrsa -out afip_private_key.key 2048
```

**El archivo generado tendrá este formato:**
```
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA3xK9L...
(muchas líneas de texto codificado)
...vUm8jNXQ==
-----END RSA PRIVATE KEY-----
```

### 4️⃣ Ver el contenido (opcional)

```bash
cat afip_private_key.key
```

o abrir con Notepad:
```bash
notepad afip_private_key.key
```

---

## 🔐 Variantes de Seguridad

### Opción Básica (2048 bits) - Recomendado para AFIP
```bash
openssl genrsa -out afip_private_key.key 2048
```

### Opción con Mayor Seguridad (4096 bits)
```bash
openssl genrsa -out afip_private_key.key 4096
```

### Opción con Contraseña (Encriptada)
```bash
openssl genrsa -aes256 -out afip_private_key.key 2048
```
Te pedirá una contraseña. **Guárdala bien**, la necesitarás cada vez que uses la clave.

---

## 📝 Generar TODO lo Necesario para AFIP

### Script Completo (Copiar y Pegar)

```bash
# Ir a la carpeta
cd backend/certs

# 1. Generar clave privada
openssl genrsa -out afip_private_key.key 2048

# 2. Generar CSR (Certificate Signing Request)
openssl req -new -key afip_private_key.key -out afip.csr

# 3. Ver el CSR generado (para subir a AFIP)
cat afip.csr
```

### Al generar el CSR te preguntará:

```
Country Name (2 letter code) []:AR
State or Province Name []:Buenos Aires
Locality Name []:CABA
Organization Name []:TU RAZON SOCIAL
Organizational Unit Name []:Sistemas
Common Name (CUIT) []:20123456789        ← TU CUIT SIN GUIONES
Email Address []:tu@email.com

A challenge password []:                 ← DEJAR EN BLANCO
An optional company name []:             ← DEJAR EN BLANCO
```

**💡 IMPORTANTE:**
- **Common Name** = Tu CUIT (ej: `20409378472`)
- **No pongas contraseña** en el CSR (dejar en blanco)

---

## 📦 Archivos que Tendrás

Después de ejecutar los comandos:

```
backend/certs/
├── afip_private_key.key    ← Tu clave privada (NUNCA compartir)
├── afip.csr                ← Para subir a AFIP
└── README.md
```

---

## 🌐 Siguiente Paso: Obtener Certificado de AFIP

### 1. Copiar el CSR
```bash
cat afip.csr
```

Copiar TODO el contenido (incluye BEGIN y END):
```
-----BEGIN CERTIFICATE REQUEST-----
MIICijCCAXICAQAwRTELMAkGA1UEBhMCQVUxEzARBgNVBAgMClNvbWUtU3RhdGUx
...
-----END CERTIFICATE REQUEST-----
```

### 2. Ir a AFIP
1. https://auth.afip.gob.ar (con Clave Fiscal)
2. "Administrador de Relaciones de Clave Fiscal"
3. Adherirse a **"wsfe"** (Facturación Electrónica)
4. "Generar Certificado Digital"
5. Pegar el contenido del CSR
6. Click "Generar"
7. Descargar el certificado (.crt)

### 3. Convertir certificado descargado a PEM
```bash
openssl x509 -in certificado_afip.crt -out afip_cert.pem -outform PEM
```

---

## ✅ Resultado Final

```
backend/certs/
├── afip_private_key.key    ← Clave privada
├── afip_cert.pem           ← Certificado de AFIP
├── afip.csr                ← CSR (ya no se necesita)
└── README.md
```

---

## ⚙️ Configurar en .env

```env
AFIP_CUIT=20123456789
AFIP_PRODUCTION=false
AFIP_CERT_PATH=./certs/afip_cert.pem
AFIP_KEY_PATH=./certs/afip_private_key.key
```

---

## 🔒 Seguridad - MUY IMPORTANTE

### ✅ HACER:
- ✅ Guardar `afip_private_key.key` en lugar seguro
- ✅ Hacer backup en USB cifrado
- ✅ NUNCA subir a Git (ya está en .gitignore)
- ✅ No compartir por email/WhatsApp
- ✅ Tener permisos restrictivos en el archivo

### ❌ NUNCA:
- ❌ Compartir la clave privada
- ❌ Subirla a GitHub/repositorios públicos
- ❌ Enviarla por email/mensajería
- ❌ Dejarla en carpetas públicas

---

## 🔄 Si Perdiste la Clave Privada

**No se puede recuperar.** Debes:

1. Generar una nueva clave privada
2. Generar nuevo CSR
3. Solicitar nuevo certificado en AFIP
4. Reemplazar los archivos

```bash
# Generar todo de nuevo
cd backend/certs
openssl genrsa -out afip_private_key.key 2048
openssl req -new -key afip_private_key.key -out afip.csr
# Subir nuevo CSR a AFIP
```

---

## 🎯 Resumen - Comandos Rápidos

```bash
# Todo en uno
cd backend/certs

# Generar clave
openssl genrsa -out afip_private_key.key 2048

# Generar CSR
openssl req -new -key afip_private_key.key -out afip.csr

# Ver CSR para copiar
cat afip.csr

# Después de obtener certificado de AFIP, convertir:
openssl x509 -in certificado_afip.crt -out afip_cert.pem -outform PEM
```

---

## 📞 Ayuda

- **Verificar clave generada:**
  ```bash
  openssl rsa -in afip_private_key.key -check
  ```

- **Ver información de la clave:**
  ```bash
  openssl rsa -in afip_private_key.key -text -noout
  ```

- **Permisos restrictivos (Linux/Mac):**
  ```bash
  chmod 600 afip_private_key.key
  ```

---

**¡Tu clave privada está lista! 🔑**

**Siguiente paso:** Ver [CERTIFICADO_HOMOLOGACION_AFIP.md](CERTIFICADO_HOMOLOGACION_AFIP.md) para obtener el certificado.
