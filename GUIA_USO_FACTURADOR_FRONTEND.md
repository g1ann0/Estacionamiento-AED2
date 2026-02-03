# 🎨 GUÍA DE USO - FACTURADOR ELECTRÓNICO (Frontend)

## 📍 Acceso al Facturador

### Desde el Menú Principal (Navbar)
1. Click en el menú hamburguesa (☰)
2. Seleccionar **"📄 Facturador AFIP"**

### Desde el Panel de Administración
1. En AdminDashboard verás el botón **"📄 Facturador AFIP"** (color verde)
2. Click para acceder directamente

---

## 🚀 Cómo Generar una Factura Electrónica

### Paso 1: Acceder al Facturador
- URL: `http://localhost:3001/admin/facturador`
- Solo accesible para usuarios **Admin**

### Paso 2: Verificar Estado AFIP
En la parte superior verás el estado de AFIP:
- ✅ **AFIP Online** → Puedes facturar
- ❌ **AFIP Offline** → No se pueden generar facturas

### Paso 3: Seleccionar Comprobante
**Panel Izquierdo: "Comprobantes Aprobados sin Facturar"**

Verás listados todos los comprobantes que:
- ✅ Están **aprobados**
- ❌ **NO tienen** factura generada

Cada comprobante muestra:
- Número de comprobante
- Importe
- Usuario y vehículo
- Fecha de emisión

**👉 Click en un comprobante para seleccionarlo**

### Paso 4: Configurar la Factura
**Panel Derecho: "Generar Factura Electrónica"**

Una vez seleccionado el comprobante, completa:

#### ✅ Tipo de Comprobante (Obligatorio)
Opciones disponibles:
- **82 - Tique Factura B** → Para Consumidor Final (sin CUIT)
- **81 - Tique Factura A** → Para Responsable Inscripto (con CUIT)
- **11 - Factura C**
- **6 - Factura B**
- **1 - Factura A**

💡 **Tip:** Para estacionamientos, lo más común es **Tique Factura B (82)**

#### ✅ Punto de Venta (Obligatorio)
- Seleccionar de la lista (por defecto: `1`)
- Debe estar habilitado en AFIP

#### 📝 Observaciones (Opcional)
- Campo de texto libre
- Agregar notas adicionales sobre la factura

### Paso 5: Generar la Factura
1. Click en **"📄 Generar Factura Electrónica"**
2. Esperar procesamiento (aparecerá spinner)
3. Ver mensaje de confirmación con:
   - ✅ CAE (Código de Autorización Electrónica)
   - Número de factura

### Paso 6: Resultado
**Mensaje exitoso:**
```
✅ Factura electrónica generada exitosamente
CAE: 72041234567890
Nro: 00001-00000001
```

El comprobante desaparece de la lista (ya tiene factura generada).

---

## 📊 Ver Facturas Generadas

### Acceso
- **Menú:** "📊 Facturas Electrónicas"
- **URL:** `http://localhost:3001/admin/facturas-electronicas`

### Funcionalidades

#### 📈 Estadísticas en el Header
- **Total Facturas:** Cantidad emitidas
- **Total Facturado:** Suma en pesos
- **Con CAE:** Facturas autorizadas
- **CAE Vencidos:** Facturas con CAE expirado

#### 🔍 Filtros Disponibles
- **Buscar:** Por número, CAE, usuario
- **Desde/Hasta:** Rango de fechas
- **Tipo Comprobante:** Filtrar por tipo
- **Estado:** Emitida / CAE Vencido

#### 📋 Tabla de Facturas
Columnas:
- Nro. Factura
- CAE (código de autorización)
- Fecha Emisión
- Vencimiento CAE
- Tipo de Comprobante
- Usuario
- Importe
- Estado
- Acciones (Ver detalle / Descargar PDF)

#### 👁️ Ver Detalle
**Click en el ícono 👁️**

Modal con información completa:
- ℹ️ **Información General:** Nro, Tipo, Punto de Venta, Fecha
- 🏛️ **Datos AFIP:** CAE, Vencimiento, Estado
- 👤 **Cliente:** Nombre, Email, CUIT
- 💰 **Importes:** Neto, IVA detallado, Total
- 📝 **Observaciones:** Notas adicionales

#### 📥 Descargar PDF
**Click en el ícono 📥**
- Descarga automática del PDF
- Nombre: `factura-{id}.pdf`
- Incluye código QR (si está implementado)

---

## 🎨 Elementos Visuales

### 🟢 Indicadores de Estado
- **Verde:** AFIP Online, Facturas emitidas
- **Rojo:** AFIP Offline, CAE vencidos
- **Azul:** Comprobante seleccionado
- **Gris:** Comprobantes sin seleccionar

### 📦 Cards de Comprobantes
- **Borde gris:** Estado normal
- **Borde azul + fondo celeste:** Seleccionado
- **Hover:** Borde azul con sombra

### 💰 Formato de Importes
- Moneda: `$5.000,00` (formato argentino)
- Destacados en **verde** para importes totales

---

## ⚠️ Mensajes y Alertas

### ✅ Éxito
```
✅ Factura electrónica generada exitosamente
CAE: 72041234567890
Nro: 00001-00000001
```

### ❌ Errores Comunes

#### "Debe seleccionar un comprobante"
**Solución:** Click en un comprobante de la lista izquierda

#### "Debe seleccionar el tipo de comprobante"
**Solución:** Elegir un tipo del dropdown

#### "AFIP no está disponible"
**Solución:** 
- Verificar que AFIP esté online
- Revisar configuración en `.env`
- Ver logs del backend

#### "Error al obtener comprobantes"
**Solución:**
- Verificar conexión con backend
- Revisar que el servidor esté corriendo
- Comprobar token de autenticación

---

## 🔄 Flujo Completo

```
┌─────────────────────────────────┐
│  Comprobante Creado y Aprobado  │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  Aparece en "Comprobantes sin   │
│  Facturar" del Facturador       │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  Admin selecciona comprobante   │
│  + Elige tipo de comprobante    │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  Click "Generar Factura"        │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  Backend solicita CAE a AFIP    │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  AFIP retorna CAE + Vencimiento │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  Factura guardada en BD con CAE │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  Factura visible en "Facturas   │
│  Electrónicas"                  │
└─────────────────────────────────┘
```

---

## 🎯 Casos de Uso

### Caso 1: Usuario Consumidor Final
1. Comprobante aprobado → Facturador
2. Seleccionar comprobante
3. Tipo: **82 - Tique Factura B**
4. Generar → ✅ Listo

### Caso 2: Usuario Responsable Inscripto
1. Comprobante aprobado → Facturador
2. Seleccionar comprobante
3. Tipo: **81 - Tique Factura A**
4. Punto de Venta: **1**
5. Generar → ✅ Listo

### Caso 3: Revisar Facturas del Mes
1. Ir a "Facturas Electrónicas"
2. Filtros → Desde: `01/02/2026`, Hasta: `28/02/2026`
3. Ver listado completo
4. Descargar PDFs necesarios

---

## 🔧 Troubleshooting Frontend

### Botón "Generar" Deshabilitado
**Causas:**
- ❌ AFIP Offline
- ❌ No hay comprobante seleccionado
- ❌ Procesando solicitud

### Comprobantes no Aparecen
**Verificar:**
1. Que existan comprobantes **aprobados**
2. Que NO tengan factura ya generada
3. Conexión con backend (F12 → Network)

### PDF no se Descarga
**Solución:**
- Verificar endpoint en backend
- Revisar permisos de descarga del navegador
- Ver consola (F12) para errores

---

## 🌐 URLs de Navegación

| Ruta | Descripción |
|------|-------------|
| `/admin/facturador` | Generar facturas electrónicas |
| `/admin/facturas-electronicas` | Ver listado de facturas |
| `/admin` | Panel principal admin |
| `/admin/gestion` | Gestión completa |

---

## 📱 Responsive

### Desktop (> 1024px)
- Layout de 2 columnas (comprobantes + formulario)
- Tabla completa con todas las columnas

### Tablet (768px - 1024px)
- Layout de 1 columna (apilado)
- Tabla con scroll horizontal

### Mobile (< 768px)
- Componentes apilados verticalmente
- Cards de comprobantes en lista vertical
- Tabla con scroll y fuente reducida

---

## 💡 Tips y Mejores Prácticas

1. **Verificar AFIP Online** antes de procesar muchas facturas
2. **Revisar CAE Vencidos** periódicamente
3. **Usar filtros** para buscar facturas específicas
4. **Descargar PDFs** para respaldo
5. **Revisar estadísticas** para control de facturación

---

**¡Listo para facturar! 🚀**
