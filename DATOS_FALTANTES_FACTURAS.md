# DATOS FALTANTES EN FACTURAS - GUÍA DE CONFIGURACIÓN

## ✅ Cambios Realizados en el PDF

Se corrigieron todos los campos que mostraban "undefined":
- Validación de campos opcionales con optional chaining
- Manejo de nombres de campos según el modelo real
- Corrección de superposición de textos

## 📋 DATOS QUE FALTAN Y CÓMO AGREGARLOS

### 1. **Domicilio Detallado del Emisor**

**Estado Actual:**
- Solo se guarda `domicilio` (string completo) en ConfiguracionEmpresa
- El PDF necesita: calle, numero, localidad, provincia, codigoPostal

**Solución Implementada:**
- El PDF ahora usa `domicilioCompleto` si existe
- Si no, intenta usar campos separados

**Para Mejorar (Opcional):**
Actualizar el modelo `ConfiguracionEmpresa` para incluir campos separados:

```javascript
domicilioFiscal: {
  calle: String,
  numero: String,
  piso: String,
  depto: String,
  localidad: String,
  provincia: String,
  codigoPostal: String,
  domicilioCompleto: String // Autocalculado
}
```

**Ubicación:** `backend/models/ConfiguracionEmpresa.js`

---

### 2. **Datos de Contacto del Emisor**

**Estado Actual:**
- NO existe el campo `contacto` en el modelo Factura
- El PDF intenta acceder a `emisor.contacto.telefono` y `emisor.contacto.email`

**Solución Implementada:**
- El PDF ahora usa optional chaining (`?.`)
- Si no existen, simplemente no los muestra

**Para Agregar:**

**Opción A) Agregar a ConfiguracionEmpresa:**
```javascript
contacto: {
  telefono: {
    type: String,
    required: false
  },
  email: {
    type: String,
    required: false,
    match: [/^\S+@\S+\.\S+$/, 'Email inválido']
  },
  web: String
}
```

**Opción B) Incluir al generar la factura:**
En `facturadorController.js`, al crear la factura, agregar:

```javascript
emisor: {
  razonSocial: configEmpresa.razonSocial,
  cuit: configEmpresa.cuit,
  domicilio: {
    domicilioCompleto: configEmpresa.domicilio
  },
  condicionIva: condicionIvaEmisor,
  // AGREGAR ESTO:
  contacto: {
    telefono: configEmpresa.telefono || '',
    email: configEmpresa.email || ''
  }
}
```

---

### 3. **Inicio de Actividades e Ingresos Brutos**

**Estado Actual:**
- `inicioActividades` NO está en el modelo ConfiguracionEmpresa
- `ingresosBrutos` SÍ existe en ConfiguracionEmpresa pero NO se pasa a la factura

**Solución Implementada:**
- El PDF valida si existen antes de mostrarlos

**Para Agregar:**

**En ConfiguracionEmpresa.js:**
```javascript
inicioActividades: {
  type: Date,
  required: false,
  // Ejemplo: new Date('2020-01-15')
},
ingresosBrutos: {
  type: String, // Número de inscripción
  required: false
}
```

**En facturadorController.js** al crear la factura:
```javascript
emisor: {
  razonSocial: configEmpresa.razonSocial,
  cuit: configEmpresa.cuit,
  domicilio: {
    domicilioCompleto: configEmpresa.domicilio
  },
  condicionIva: condicionIvaEmisor,
  // AGREGAR:
  inicioActividades: configEmpresa.inicioActividades,
  ingresosBrutos: configEmpresa.ingresosBrutos
}
```

---

### 4. **Items de Factura - Campos Faltantes**

**Estado Actual:**
Los items se crean con:
- ✅ descripcion
- ✅ cantidad
- ✅ precioUnitario
- ✅ alicuotaIVA
- ❌ importeIVA (se calcula pero no se guarda correctamente)
- ❌ subtotal

**Solución Implementada:**
- El PDF calcula `subtotal` si no existe: `precioUnitario * cantidad`
- El PDF usa valores por defecto si faltan

**Para Mejorar:**
En `facturadorController.js`, al crear items:

```javascript
items: [{
  descripcion: `Acreditación de saldo - Comprobante ${nroComprobante}`,
  cantidad: 1,
  precioUnitario: comprobante.montoAcreditado,
  alicuotaIVA: tipoFactura === 'A' ? 21 : 0,
  // CALCULAR EXPLÍCITAMENTE:
  importeIVA: tipoFactura === 'A' ? (comprobante.montoAcreditado * 0.21 / 1.21) : 0,
  subtotal: comprobante.montoAcreditado
}]
```

---

## 🔧 ACCIONES INMEDIATAS RECOMENDADAS

### 1. Actualizar ConfiguracionEmpresa (RECOMENDADO)

Agregar estos campos a la interfaz de "Configuración de Empresa":

```javascript
// En el formulario de configuración
{
  // Campos existentes...
  razonSocial: String,
  cuit: String,
  domicilio: String,
  
  // AGREGAR:
  telefono: String,
  email: String,
  web: String,
  inicioActividades: Date,
  ingresosBrutos: String
}
```

### 2. Actualizar Generación de Factura

Modificar `facturadorController.js` línea ~295:

```javascript
emisor: {
  razonSocial: configEmpresa.razonSocial,
  cuit: configEmpresa.cuit,
  domicilio: {
    domicilioCompleto: configEmpresa.domicilio,
    // Si tienes campos separados:
    calle: configEmpresa.domicilioFiscal?.calle,
    numero: configEmpresa.domicilioFiscal?.numero,
    localidad: configEmpresa.domicilioFiscal?.localidad,
    provincia: configEmpresa.domicilioFiscal?.provincia,
    codigoPostal: configEmpresa.domicilioFiscal?.codigoPostal
  },
  condicionIva: condicionIvaEmisor,
  inicioActividades: configEmpresa.inicioActividades,
  ingresosBrutos: configEmpresa.ingresosBrutos,
  contacto: {
    telefono: configEmpresa.telefono,
    email: configEmpresa.email
  }
}
```

### 3. Script de Migración de Datos

Si ya tienes facturas generadas, puedes crear un script para completar datos:

```javascript
// backend/scripts/completarDatosFacturas.js
const Factura = require('../models/Factura');
const ConfiguracionEmpresa = require('../models/ConfiguracionEmpresa');

async function completarDatos() {
  const config = await ConfiguracionEmpresa.findOne();
  
  await Factura.updateMany(
    { 'emisor.contacto': { $exists: false } },
    {
      $set: {
        'emisor.contacto': {
          telefono: config.telefono || '',
          email: config.email || ''
        },
        'emisor.inicioActividades': config.inicioActividades,
        'emisor.ingresosBrutos': config.ingresosBrutos
      }
    }
  );
  
  console.log('Datos completados');
}
```

---

## 📝 RESUMEN DE ESTADO

### ✅ CORREGIDO (No muestra "undefined" ahora)
- Campos de contacto (telefono, email)
- Domicilio del emisor (usa domicilioCompleto)
- Inicio de actividades
- Ingresos brutos
- Items (calcula valores faltantes)
- Totales (usa fallbacks)
- Cliente (maneja campos opcionales)

### ⚠️ DATOS QUE DEBERÍAS AGREGAR
1. **telefono** en ConfiguracionEmpresa
2. **email** en ConfiguracionEmpresa
3. **inicioActividades** en ConfiguracionEmpresa
4. **Actualizar facturadorController** para incluir estos campos al crear facturas

### 🎯 PRÓXIMOS PASOS
1. Actualizar modelo ConfiguracionEmpresa
2. Actualizar formulario frontend de configuración
3. Modificar generación de facturas para incluir nuevos campos
4. Ejecutar script de migración (opcional)

---

## 📌 NOTA IMPORTANTE

Los PDFs ahora se generan correctamente SIN mostrar "undefined". Los datos faltantes simplemente NO se muestran en el PDF.

Para que se muestren, debes:
1. Agregar los campos a ConfiguracionEmpresa
2. Cargar los datos desde el panel de administración
3. Las nuevas facturas incluirán automáticamente esos datos
