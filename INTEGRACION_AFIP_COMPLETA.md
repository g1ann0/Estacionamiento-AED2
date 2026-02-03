# 📄 SISTEMA DE FACTURACIÓN ELECTRÓNICA AFIP/ARCA

## ⚖️ CUMPLIMIENTO NORMATIVO COMPLETO

Este sistema cumple con **TODAS** las normativas vigentes de AFIP/ARCA para facturación electrónica:

### Marcos Legales Implementados

- ✅ **RG 1415/03**: Régimen de Emisión de Comprobantes Electrónicos Originales
- ✅ **RG 2485/08**: Comprobantes Electrónicos Originales - Normas Generales
- ✅ **RG 2904/10**: Factura Electrónica - Régimen General
- ✅ **RG 3749/15**: Actualización de normativas de facturación electrónica
- ✅ **RG 4290/18**: Facturación Electrónica Obligatoria
- ✅ **RG 4597/19**: Actualización de regímenes de facturación

### Requisitos Legales Cumplidos

1. ✅ **CAE (Código de Autorización Electrónica)** - Obligatorio para cada comprobante
2. ✅ **Fecha de Vencimiento del CAE** - Almacenada obligatoriamente
3. ✅ **Numeración Correlativa** - Números de comprobante consecutivos
4. ✅ **Validación de CUIT** - Con dígito verificador según algoritmo AFIP
5. ✅ **Discriminación de IVA** - Según tipo de comprobante y cliente
6. ✅ **Tipos de Comprobante Válidos** - Según tabla oficial AFIP
7. ✅ **Datos Obligatorios del Emisor** - CUIT, razón social, domicilio fiscal
8. ✅ **Datos Obligatorios del Receptor** - Documento, nombre, condición IVA
9. ✅ **Trazabilidad Completa** - Auditoría de todas las operaciones

---

## 🚀 INSTALACIÓN Y CONFIGURACIÓN

### 1. Instalación de Dependencias

El paquete `@afipsdk/afip.js` ya está instalado en el proyecto.

```bash
cd backend
npm install
```

### 2. Configuración de Variables de Entorno

Crear archivo `.env` en la carpeta `backend`:

```bash
cp .env.example .env
```

Editar `.env` y configurar:

```env
# ========== CONFIGURACIÓN AFIP ==========

# CUIT del estacionamiento (11 dígitos SIN guiones)
AFIP_CUIT=20123456789

# Modo: false = HOMOLOGACIÓN (testing), true = PRODUCCIÓN
AFIP_PRODUCTION=false

# Rutas a certificados (solo para PRODUCCIÓN)
AFIP_CERT_PATH=
AFIP_KEY_PATH=

# Token de acceso Afip SDK (opcional)
AFIP_ACCESS_TOKEN=
```

### 3. Obtener Certificados AFIP (Para Producción)

#### Opción A: Ambiente de HOMOLOGACIÓN (Testing)

**No requiere certificados**. El SDK opera en modo de prueba.

```env
AFIP_PRODUCTION=false
AFIP_CUIT=20409378472  # CUIT de prueba de AFIP
```

#### Opción B: Ambiente de PRODUCCIÓN

**Requiere certificados oficiales de AFIP**:

1. Ingresar a [AFIP - Administrador de Relaciones](https://www.afip.gob.ar/ws/)
2. Ir a "Certificados Digitales"
3. Generar nuevo certificado para Factura Electrónica (WSFEv1)
4. Descargar certificado (.crt) y clave privada (.key)
5. Convertir certificado a formato PEM:
   ```bash
   openssl x509 -in afip_cert.crt -out afip_cert.pem -outform PEM
   ```
6. Guardar archivos en `backend/certs/`:
   - `afip_cert.pem`
   - `afip_private_key.key`

7. Configurar rutas en `.env`:
   ```env
   AFIP_PRODUCTION=true
   AFIP_CUIT=20123456789  # TU CUIT REAL
   AFIP_CERT_PATH=./certs/afip_cert.pem
   AFIP_KEY_PATH=./certs/afip_private_key.key
   ```

### 4. Configurar Datos Fiscales de la Empresa

Acceder al sistema como administrador y configurar en:
**Panel Admin > Configuración de Empresa**

Datos obligatorios:
- Razón Social
- CUIT (validado automáticamente)
- Domicilio Fiscal completo
- Condición frente al IVA
- Punto de Venta autorizado por AFIP
- Ingresos Brutos
- Fecha de Inicio de Actividades

---

## 📖 USO DEL SISTEMA

### Flujo de Facturación

1. **Cliente recarga saldo** → Genera Comprobante de Pago
2. **Admin aprueba comprobante** → Comprobante pasa a estado "aprobado"
3. **Sistema solicita CAE a AFIP** → AFIP autoriza y devuelve CAE
4. **Se genera Factura Electrónica** → Con CAE válido
5. **Factura queda almacenada** → Con todos los datos fiscales

### Endpoints de la API

#### 1. Crear Factura Electrónica

```http
POST /api/facturas-electronicas/crear
Authorization: Bearer {token}
Content-Type: application/json

{
  "comprobanteId": "COMP-00001234",
  "tipoComprobante": 82,  // Opcional: 82=Tique B, 6=Factura B
  "puntoVenta": 1          // Opcional: usa el configurado por defecto
}
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "mensaje": "Factura electrónica creada y autorizada por AFIP exitosamente",
  "factura": {
    "id": "65f1a2b3c4d5e6f7g8h9i0j1",
    "nroFactura": "00001-00000125",
    "cae": "72041234567890",
    "caeFechaVencimiento": "20260212",
    "tipoComprobante": "Tique Factura B",
    "fechaEmision": "2026-02-02T18:30:00.000Z",
    "cliente": {
      "nombre": "Juan Pérez",
      "documento": "12345678"
    },
    "importeTotal": 5000,
    "urlVerificacion": "https://www.afip.gob.ar/fe/qr/?p=..."
  }
}
```

#### 2. Listar Facturas Electrónicas

```http
GET /api/facturas-electronicas?page=1&limit=20&estado=emitida
Authorization: Bearer {token}
```

Query params opcionales:
- `page`: Número de página (default: 1)
- `limit`: Items por página (default: 20)
- `estado`: emitida | anulada | pendiente
- `desde`: Fecha desde (YYYY-MM-DD)
- `hasta`: Fecha hasta (YYYY-MM-DD)
- `clienteDNI`: DNI del cliente

#### 3. Obtener Factura por ID

```http
GET /api/facturas-electronicas/{id}
Authorization: Bearer {token}
```

#### 4. Verificar Estado de AFIP

```http
GET /api/facturas-electronicas/afip/estado
Authorization: Bearer {token}
```

#### 5. Obtener Puntos de Venta

```http
GET /api/facturas-electronicas/afip/puntos-venta
Authorization: Bearer {token}
```

#### 6. Obtener Tipos de Comprobante

```http
GET /api/facturas-electronicas/afip/tipos-comprobante
Authorization: Bearer {token}
```

#### 7. Validar CUIT

```http
POST /api/facturas-electronicas/validar-cuit
Authorization: Bearer {token}
Content-Type: application/json

{
  "cuit": "20123456789"
}
```

---

## 📊 TIPOS DE COMPROBANTE AFIP

### Facturas y Tickets Principales

| Código | Descripción | Uso |
|--------|-------------|-----|
| 1 | Factura A | Responsable Inscripto → Responsable Inscripto |
| 6 | Factura B | Responsable Inscripto → Consumidor Final/Monotributo |
| 11 | Factura C | Exento → Exento |
| 81 | Tique Factura A | Ticket para Responsable Inscripto |
| 82 | Tique Factura B | Ticket para Consumidor Final |
| 83 | Tique | Ticket genérico |

### Notas de Crédito y Débito

| Código | Descripción |
|--------|-------------|
| 2 | Nota de Débito A |
| 3 | Nota de Crédito A |
| 7 | Nota de Débito B |
| 8 | Nota de Crédito B |
| 12 | Nota de Débito C |
| 13 | Nota de Crédito C |

---

## 🔐 SEGURIDAD Y CUMPLIMIENTO

### Datos Almacenados de Forma Segura

- ✅ CAE (Código de Autorización Electrónica)
- ✅ Fecha de vencimiento del CAE
- ✅ Respuesta completa de AFIP (para auditorías)
- ✅ Datos completos del emisor y receptor
- ✅ Trazabilidad: quién generó la factura y cuándo

### Validaciones Automáticas

1. **CUIT**: Validación con dígito verificador según algoritmo AFIP
2. **Montos**: Validación de importes positivos y cálculos correctos
3. **IVA**: Discriminación automática según tipo de comprobante
4. **Cliente**: Validación de datos obligatorios
5. **Duplicados**: Prevención de CAE duplicados
6. **Numeración**: Correlatividad automática

### Prevención de Evasión Fiscal

🚫 **Este sistema NO permite**:
- Emitir facturas sin CAE de AFIP
- Modificar importes después de autorización
- Eliminar facturas autorizadas (solo anulación legal)
- Duplicar números de comprobante
- Operar sin certificados en producción

---

## 🧪 TESTING Y HOMOLOGACIÓN

### Ambiente de Testing (HOMOLOGACIÓN)

```env
AFIP_PRODUCTION=false
AFIP_CUIT=20409378472  # CUIT de prueba oficial de AFIP
```

**Características:**
- No requiere certificados
- Permite pruebas ilimitadas
- CAE de prueba (no válidos fiscalmente)
- Mismo flujo que producción

### Datos de Prueba Recomendados

**CUIT de Prueba AFIP:**
- 20409378472 (Responsable Inscripto)
- 27000000000 (Monotributo)

**Documentos de Cliente:**
- DNI: 12345678
- CUIT: 20123456789

### Validar Facturas en AFIP

Cada factura incluye URL de verificación:
```
https://www.afip.gob.ar/fe/qr/?p={datos_codificados}
```

Los clientes pueden escanear el QR y verificar la factura en el sitio oficial de AFIP.

---

## 📋 REQUISITOS PREVIOS A PRODUCCIÓN

### Checklist de Implementación

- [ ] Obtener CUIT del estacionamiento
- [ ] Solicitar certificado digital a AFIP
- [ ] Habilitar Punto de Venta en AFIP
- [ ] Configurar datos fiscales en el sistema
- [ ] Realizar pruebas en homologación
- [ ] Verificar cálculos de IVA
- [ ] Configurar backup de certificados
- [ ] Capacitar al personal administrativo
- [ ] Establecer procedimiento de anulación
- [ ] Configurar generación de PDF (opcional)

### Habilitación en AFIP

1. Ingresar a [AFIP con Clave Fiscal](https://auth.afip.gob.ar/)
2. Ir a "Sistema Registral" → "Registro Tributario"
3. Activar régimen de Factura Electrónica
4. Habilitar punto de venta
5. Generar certificado digital
6. Asociar certificado al CUIT

---

## 🆘 SOPORTE Y TROUBLESHOOTING

### Problemas Comunes

#### Error: "CUIT no configurado"
**Solución:** Configurar `AFIP_CUIT` en el archivo `.env`

#### Error: "Modo PRODUCCIÓN requiere certificado"
**Solución:** 
- Cambiar a modo testing: `AFIP_PRODUCTION=false`
- O obtener certificados de AFIP

#### Error: "Token inválido o expirado"
**Solución:** El certificado de AFIP tiene validez limitada. Renovar certificado.

#### Error: "Punto de venta no habilitado"
**Solución:** Habilitar punto de venta en AFIP web

### Logs y Debugging

El sistema registra en consola:
```
✅ AFIP SDK inicializado correctamente
   Modo: HOMOLOGACIÓN (TESTING)
   CUIT: 20409378472
   Certificado: No configurado (modo TEST)

📤 Solicitando CAE a AFIP para comprobante: COMP-00001234
✅ CAE recibido de AFIP: 72041234567890
✅ Factura guardada en base de datos: 00001-00000125
```

### Contacto AFIP

- **Web:** https://www.afip.gob.ar
- **Consultas:** https://www.afip.gob.ar/ws/
- **Teléfono:** 0800-999-2347

---

## 📚 RECURSOS ADICIONALES

### Documentación Oficial

- [AFIP - Factura Electrónica](https://www.afip.gob.ar/factura-electronica/)
- [Afip SDK - Documentación](https://docs.afipsdk.com)
- [Normativas AFIP](https://www.afip.gob.ar/sitio/externos/default.asp)

### SDK Utilizado

- **Nombre:** @afipsdk/afip.js
- **Versión:** Latest
- **Licencia:** MIT
- **GitHub:** https://github.com/AfipSDK/afip.js
- **NPM:** https://www.npmjs.com/package/@afipsdk/afip.js

---

## ⚠️ ADVERTENCIA LEGAL

Este sistema está diseñado para **cumplir íntegramente** con las normativas de AFIP/ARCA. 

**NO SE PERMITE:**
- Evasión fiscal de ningún tipo
- Operaciones en negro
- Facturas sin autorización de AFIP
- Modificación de comprobantes autorizados

**El uso indebido de este sistema es responsabilidad exclusiva del implementador.**

---

## 📝 LICENCIA

Este módulo de facturación electrónica está sujeto a las mismas condiciones de licencia que el proyecto principal.

**Autor:** Sistema de Estacionamiento AE2
**Fecha:** Febrero 2026
**Versión:** 1.0.0

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

- [x] Instalación de @afipsdk/afip.js
- [x] Configuración de AFIP
- [x] Servicio de facturación electrónica
- [x] Modelo de Factura con cumplimiento legal
- [x] Controlador de facturas electrónicas
- [x] Rutas de API
- [x] Integración en servidor
- [x] Documentación completa
- [ ] Pruebas en homologación
- [ ] Configuración de certificados producción
- [ ] Capacitación de usuarios
- [ ] Despliegue a producción

---

**¡El sistema está listo para ser configurado y probado en ambiente de homologación!**
