# 🔍 SISTEMA DE CONSULTA DE PADRÓN AFIP/ARCA

## 📋 Descripción

Sistema integrado para consultar automáticamente los datos fiscales de contribuyentes registrados en AFIP/ARCA mediante su CUIT. Permite autocompletar formularios de clientes sin necesidad de carga manual de datos.

---

## ✨ Características

- ✅ **Consulta automática de CUIT** en el padrón de AFIP
- ✅ **Autocompletado de datos fiscales**:
  - Razón Social / Nombre
  - Condición frente al IVA
  - Domicilio fiscal completo
  - Provincia y localidad
  - Código postal
  - Actividades económicas
  - Estado del contribuyente
- ✅ **Validación de CUIT** con dígito verificador
- ✅ **Interfaz modal reutilizable**
- ✅ **Integración transparente** en cualquier formulario
- ✅ **Soporte para certificados de homologación y producción**

---

## 🏗️ Arquitectura

### Backend

```
backend/
├── services/
│   └── afipPadronService.js      # Servicio de consulta AFIP
├── controllers/
│   └── afipController.js          # Controlador de endpoints
├── routes/
│   └── afip.js                    # Rutas de la API
└── config/
    └── afip.js                    # Configuración AFIP (ya existente)
```

### Frontend

```
frontend/src/
├── components/
│   ├── ConsultaCUITModal.jsx      # Modal de búsqueda
│   └── EjemploFormularioCliente.jsx  # Ejemplo de uso
├── services/
│   └── afipService.js             # Cliente HTTP para AFIP
└── styles/
    └── ConsultaCUITModal.css      # Estilos del modal
```

---

## 🚀 Instalación

### 1. Prerequisitos

- Certificado digital AFIP (.crt y .key) para producción
- CUIT de la empresa configurado
- Servicio web habilitado en AFIP

### 2. Configuración

Los certificados ya están configurados en:
```
backend/certs/
├── afip_cert.pem              # Certificado X.509
├── afip_private_key.key       # Clave privada
└── CASTELPÁRK_3aa96322902da3ea.crt  # Certificado de producción
```

El sistema está listo para usar con el certificado de homologación existente.

---

## 📡 API Endpoints

### POST /api/afip/consultar-cuit

Consulta datos de un CUIT en el padrón de AFIP.

**Requiere autenticación:** Sí (Bearer Token)

**Body:**
```json
{
  "cuit": "30-70861716-0"
}
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "data": {
    "cuit": "30708617160",
    "razonSocial": "EMPRESA DE EJEMPLO S.A.",
    "condicionIVA": "Responsable Inscripto",
    "domicilioFiscal": "AV CORRIENTES 1234",
    "provincia": "CIUDAD AUTONOMA BUENOS AIRES",
    "localidad": "CAPITAL FEDERAL",
    "codigoPostal": "C1043AAZ",
    "actividades": [
      {
        "codigo": "631100",
        "descripcion": "SERVICIOS DE ESTACIONAMIENTO",
        "orden": 1
      }
    ],
    "estado": "Activo"
  }
}
```

**Respuesta de error (404):**
```json
{
  "success": false,
  "error": "CUIT no encontrado en el padrón de AFIP"
}
```

### POST /api/afip/validar-cuit

Valida formato de CUIT sin consultar AFIP.

**Requiere autenticación:** No

**Body:**
```json
{
  "cuit": "20-44242292-4"
}
```

**Respuesta (200):**
```json
{
  "success": true,
  "data": {
    "cuit": "20-44242292-4",
    "valido": true
  }
}
```

---

## 💻 Uso en el Frontend

### Integración Básica

```jsx
import React, { useState } from 'react';
import ConsultaCUITModal from './components/ConsultaCUITModal';

const MiFormulario = () => {
  const [modalAbierto, setModalAbierto] = useState(false);
  const [datosCliente, setDatosCliente] = useState({});

  const handleDatosAFIP = (datosAFIP) => {
    // Autocompletar formulario con datos de AFIP
    setDatosCliente({
      ...datosCliente,
      cuit: datosAFIP.cuit,
      razonSocial: datosAFIP.razonSocial,
      condicionIVA: datosAFIP.condicionIVA,
      domicilio: datosAFIP.domicilioFiscal,
      provincia: datosAFIP.provincia,
      localidad: datosAFIP.localidad,
      codigoPostal: datosAFIP.codigoPostal
    });
  };

  return (
    <>
      <button onClick={() => setModalAbierto(true)}>
        🔍 Buscar en ARCA
      </button>

      <ConsultaCUITModal
        isOpen={modalAbierto}
        onClose={() => setModalAbierto(false)}
        onDatosObtenidos={handleDatosAFIP}
      />
    </>
  );
};
```

### Uso Directo del Servicio

```jsx
import afipService from './services/afipService';

// Consultar CUIT
const consultarCUIT = async (cuit) => {
  try {
    const resultado = await afipService.consultarCUIT(cuit);
    
    if (resultado.success) {
      console.log('Datos:', resultado.data);
      // Usar datos...
    } else {
      console.error('Error:', resultado.error);
    }
  } catch (error) {
    console.error('Error al consultar:', error);
  }
};

// Validar CUIT
const validarCUIT = async (cuit) => {
  try {
    const resultado = await afipService.validarCUIT(cuit);
    console.log('CUIT válido:', resultado.data.valido);
  } catch (error) {
    console.error('Error:', error);
  }
};
```

---

## 🎨 Componente ConsultaCUITModal

### Props

| Prop | Tipo | Requerido | Descripción |
|------|------|-----------|-------------|
| `isOpen` | boolean | Sí | Controla si el modal está visible |
| `onClose` | function | Sí | Callback al cerrar el modal |
| `onDatosObtenidos` | function | Sí | Callback con los datos obtenidos de AFIP |

### Ejemplo Completo

Ver archivo: [EjemploFormularioCliente.jsx](frontend/src/components/EjemploFormularioCliente.jsx)

---

## 🔧 Configuración AFIP

### Modo Homologación (Testing)

El sistema ya está configurado para usar el entorno de homologación de AFIP con certificados de prueba.

```env
AFIP_CUIT=tu_cuit_empresa
AFIP_PRODUCTION=false
AFIP_CERT_PATH=certs/afip_cert.pem
AFIP_KEY_PATH=certs/afip_private_key.key
```

### Modo Producción

Para usar el sistema en producción:

```env
AFIP_CUIT=tu_cuit_empresa
AFIP_PRODUCTION=true
AFIP_CERT_PATH=certs/CASTELPÁRK_3aa96322902da3ea.crt
AFIP_KEY_PATH=certs/afip_private_key.key
```

---

## 📊 Mapeo de Condiciones IVA

El servicio mapea automáticamente las condiciones de AFIP al sistema:

| AFIP | Sistema |
|------|---------|
| IVA Responsable Inscripto | Responsable Inscripto |
| Responsable Monotributo | Monotributista |
| IVA Exento | Exento |
| Consumidor Final | Consumidor Final |
| Responsable No Inscripto | No Responsable |

---

## 🧪 Testing

### Probar endpoint desde Thunder Client / Postman

```bash
POST http://localhost:3000/api/afip/consultar-cuit
Authorization: Bearer <tu_token>
Content-Type: application/json

{
  "cuit": "30-70861716-0"
}
```

### CUITs de prueba

Para testing en homologación:

- **30-70861716-0** - Empresa de ejemplo (Responsable Inscripto)
- **20-44242292-4** - Persona física (CUIL)
- **27-12345678-9** - Persona femenina (CUIL)

---

## 🐛 Troubleshooting

### Error: "Certificado AFIP no encontrado"

**Solución:** Verificar que los archivos de certificado existan en `backend/certs/`

```bash
ls backend/certs/
# Debe mostrar: afip_cert.pem y afip_private_key.key
```

### Error: "CUIT no encontrado en el padrón de AFIP"

**Causas posibles:**
1. El CUIT no existe o está mal escrito
2. Dígito verificador incorrecto
3. Contribuyente dado de baja

### Error: "Error al conectar con AFIP"

**Soluciones:**
1. Verificar conexión a internet
2. Verificar que el servicio de AFIP esté disponible
3. Revisar logs del servidor: `backend/logs/combined-YYYY-MM-DD.log`

---

## 📝 Logs

El sistema registra todas las consultas a AFIP:

```
backend/logs/
├── combined-2026-02-07.log    # Log general
├── error-2026-02-07.log       # Solo errores
└── http-requests-2026-02-07.log  # Peticiones HTTP
```

Ejemplo de log exitoso:
```
2026-02-07 14:30:15 [INFO] Consultando CUIT 30-70861716-0 en padrón AFIP
2026-02-07 14:30:16 [SUCCESS] ✅ CUIT 30-70861716-0 encontrado: EMPRESA DE EJEMPLO S.A.
```

---

## 🔒 Seguridad

- ✅ Autenticación requerida para consultar CUIT
- ✅ Certificados digitales protegidos
- ✅ Validación de formato de CUIT
- ✅ Logging de todas las operaciones
- ✅ CORS configurado para red local

---

## 📚 Referencias

- [AFIP - Padrón de Contribuyentes](https://www.afip.gob.ar/)
- [RG 3358/12 - Consulta de Padrón](https://www.afip.gob.ar/regimenes-de-informacion/ws_sr_padron_a13.asp)
- [@afipsdk/afip.js Documentation](https://github.com/AfipSDK/afip.js)

---

## 🚀 Próximos pasos

1. **Probar el sistema** con un CUIT real en homologación
2. **Integrar el modal** en formularios existentes (configuración empresa, facturación)
3. **Configurar certificado de producción** cuando esté listo para el lanzamiento

---

## ✅ Checklist de Implementación

- [x] Servicio backend de consulta AFIP
- [x] Endpoints REST configurados
- [x] Servicio frontend para HTTP calls
- [x] Modal reutilizable con diseño moderno
- [x] Documentación completa
- [x] Ejemplo de uso en formulario
- [ ] Testing con certificado de homologación
- [ ] Integración en formularios existentes
- [ ] Despliegue en producción

---

## 💡 Soporte

Para dudas o problemas, revisar:
1. Esta documentación
2. Logs del servidor en `backend/logs/`
3. Consola del navegador (F12)
4. Archivo de ejemplo: `EjemploFormularioCliente.jsx`

---

**Desarrollado para el Sistema de Estacionamiento - Febrero 2026**
