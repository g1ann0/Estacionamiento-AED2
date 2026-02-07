# 📊 Google Analytics - Guía de Integración

## Introducción

Este sistema integra **Google Analytics 4 (GA4)** para rastrear métricas de uso, comportamiento de usuarios y rendimiento de la aplicación.

### Características

✅ **Tracking automático de páginas**: Cada navegación se registra  
✅ **Eventos personalizados**: Login, estacionamiento, recargas, facturación  
✅ **Datos de usuario**: ID, rol, email (anónimo)  
✅ **Métricas de performance**: Tiempos de carga, respuesta de API  
✅ **Manejo de errores**: Excepciones y errores registrados  
✅ **Compatible con GDPR**: Sin PII (Personally Identifiable Information) por defecto

---

## Configuración

### 1. Crear Propiedad en Google Analytics

1. Ve a [Google Analytics](https://analytics.google.com/)
2. Crear cuenta → Crear propiedad → **GA4**
3. Configurar:
   - **Nombre**: Sistema de Estacionamiento
   - **Zona horaria**: Argentina (GMT-3)
   - **Moneda**: ARS (Peso Argentino)
4. Obtener **Measurement ID**: Formato `G-XXXXXXXXXX`

### 2. Configurar Variables de Entorno

En `frontend/.env`:

```env
# Google Analytics 4 Tracking ID
REACT_APP_GA_TRACKING_ID=G-XXXXXXXXXX

# Opcional: Backend API URL
REACT_APP_API_URL=http://localhost:3000
```

**⚠️ IMPORTANTE**: No subir `.env` a git. El Tracking ID puede ser público pero es mejor mantenerlo privado.

### 3. Verificar Instalación

1. Iniciar aplicación: `npm start`
2. Abrir consola de desarrollador
3. Buscar: `✅ Google Analytics inicializado: G-XXXXXXXXXX`
4. En Google Analytics → Tiempo Real → Ver actividad en vivo

---

## Arquitectura

### Componentes

```
frontend/
├── src/
│   ├── services/
│   │   └── analytics.js          # Servicio de Analytics
│   ├── App.js                     # Inicialización y PageTracker
│   └── components/
│       ├── Login.js              # trackEvent en login
│       ├── Dashboard.js          # trackEvent en acciones
│       └── ...
```

### Flujo de Tracking

```
1. App.js inicializa GA al cargar
          ↓
2. PageTracker monitorea cambios de ruta (React Router)
          ↓
3. Cada cambio de página → trackPageView()
          ↓
4. Componentes disparan eventos → trackEvent()
          ↓
5. Datos enviados a Google Analytics
          ↓
6. Visualización en dashboard de GA
```

---

## Uso en Componentes

### 1. Tracking de Eventos (Recomendado)

Usa los **eventos predefinidos** en `AnalyticsEvents`:

```javascript
import { AnalyticsEvents } from '../services/analytics';

// En Login.js - después de login exitoso
const handleLogin = async (e) => {
  e.preventDefault();
  try {
    const response = await login(email, password);
    
    // 📊 Registrar evento de login
    AnalyticsEvents.LOGIN(email);
    
    navigate('/dashboard');
  } catch (error) {
    console.error(error);
  }
};
```

### 2. Eventos Personalizados

Si necesitas eventos no predefinidos:

```javascript
import { trackEvent } from '../services/analytics';

// Evento personalizado
trackEvent({
  category: 'Configuración',
  action: 'Cambio de tarifa',
  label: 'Tarifa nocturna',
  value: 50
});
```

### 3. Tracking de Errores

```javascript
import { trackException } from '../services/analytics';

try {
  await fetchData();
} catch (error) {
  // 📊 Registrar excepción
  trackException(`Error al cargar datos: ${error.message}`, false);
  
  // Mostrar mensaje al usuario
  setError(error.message);
}
```

---

## Eventos Predefinidos

### Autenticación

```javascript
// Login exitoso
AnalyticsEvents.LOGIN(email);

// Logout
AnalyticsEvents.LOGOUT();

// Registro de nuevo usuario
AnalyticsEvents.REGISTER(email);
```

### Estacionamiento

```javascript
// Iniciar estacionamiento
AnalyticsEvents.START_PARKING(patente);

// Finalizar estacionamiento
AnalyticsEvents.END_PARKING(patente, duracionMinutos, costoTotal);
```

### Vehículos

```javascript
// Alta de vehículo
AnalyticsEvents.ADD_VEHICLE(patente);

// Modificación
AnalyticsEvents.EDIT_VEHICLE(patente);

// Baja
AnalyticsEvents.DELETE_VEHICLE(patente);
```

### Transacciones

```javascript
// Recarga de saldo
AnalyticsEvents.RECHARGE_BALANCE(monto);

// Subir comprobante
AnalyticsEvents.UPLOAD_RECEIPT(monto);
```

### Facturación

```javascript
// Generar factura AFIP
AnalyticsEvents.GENERATE_INVOICE(tipoComprobante, monto);
```

### Errores

```javascript
// Error de API
AnalyticsEvents.API_ERROR(endpoint, statusCode);

// Error de validación
AnalyticsEvents.VALIDATION_ERROR(campoConError);
```

---

## Ejemplos de Implementación

### Login Component

```javascript
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { AnalyticsEvents } from '../services/analytics';

function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const response = await login(email, password);
      
      // 📊 Tracking exitoso
      AnalyticsEvents.LOGIN(email);
      
      // Redirigir según rol
      if (response.rol === 'admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      // 📊 Tracking de error
      AnalyticsEvents.API_ERROR('/api/auth/login', error.response?.status || 500);
      
      setError('Credenciales incorrectas');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* ... */}
    </form>
  );
}
```

### Dashboard Component

```javascript
import React, { useState, useEffect } from 'react';
import { AnalyticsEvents } from '../services/analytics';

function Dashboard() {
  const iniciarEstacionamiento = async (patenteId) => {
    try {
      const response = await estacionamientoService.iniciar(patenteId);
      
      // 📊 Tracking de inicio
      AnalyticsEvents.START_PARKING(response.vehiculo.patente);
      
      setMensaje({ type: 'success', text: 'Estacionamiento iniciado' });
    } catch (error) {
      // 📊 Tracking de error
      AnalyticsEvents.API_ERROR('/api/estacionamiento/iniciar', error.response?.status);
      
      setMensaje({ type: 'error', text: error.message });
    }
  };

  const finalizarEstacionamiento = async (estacionamientoId) => {
    try {
      const response = await estacionamientoService.finalizar(estacionamientoId);
      
      // 📊 Tracking de finalización con métricas
      AnalyticsEvents.END_PARKING(
        response.vehiculo.patente,
        response.duracionMinutos,
        response.costoTotal
      );
      
      setMensaje({ type: 'success', text: `Costo total: $${response.costoTotal}` });
    } catch (error) {
      AnalyticsEvents.API_ERROR('/api/estacionamiento/finalizar', error.response?.status);
      setMensaje({ type: 'error', text: error.message });
    }
  };

  return (
    <div>
      {/* ... */}
    </div>
  );
}
```

### Transacciones Component

```javascript
import { AnalyticsEvents } from '../services/analytics';

const handleRecargar = async () => {
  try {
    await usuarioService.recargarSaldo(monto);
    
    // 📊 Tracking de recarga
    AnalyticsEvents.RECHARGE_BALANCE(parseFloat(monto));
    
    setMensaje({ type: 'success', text: 'Recarga pendiente de aprobación' });
  } catch (error) {
    AnalyticsEvents.API_ERROR('/api/usuarios/recargar', error.response?.status);
    setMensaje({ type: 'error', text: error.message });
  }
};

const handleSubirComprobante = async (file) => {
  try {
    const formData = new FormData();
    formData.append('comprobante', file);
    formData.append('monto', monto);
    
    await comprobanteService.subir(formData);
    
    // 📊 Tracking de carga de comprobante
    AnalyticsEvents.UPLOAD_RECEIPT(parseFloat(monto));
    
    setMensaje({ type: 'success', text: 'Comprobante subido correctamente' });
  } catch (error) {
    AnalyticsEvents.API_ERROR('/api/comprobantes', error.response?.status);
    setMensaje({ type: 'error', text: error.message });
  }
};
```

---

## Visualización en Google Analytics

### 1. Tiempo Real

**Analytics → Informes → Tiempo Real**

- Usuarios activos ahora
- Páginas vistas en los últimos 30 minutos
- Eventos disparados
- Ubicación geográfica

### 2. Eventos

**Analytics → Informes → Interacción → Eventos**

Ver todos los eventos personalizados:
- `Autenticación` → `Inicio de sesión`
- `Estacionamiento` → `Iniciar`, `Finalizar`
- `Vehículos` → `Alta`, `Modificación`, `Baja`
- `Transacciones` → `Recarga de saldo`

### 3. Páginas

**Analytics → Informes → Interacción → Páginas y pantallas**

- Páginas más visitadas
- Tiempo promedio en página
- Tasa de rebote
- Flujo de navegación

### 4. Usuarios

**Analytics → Informes → Usuario → Datos demográficos**

- Usuarios nuevos vs recurrentes
- Ubicación geográfica
- Dispositivos (móvil, desktop, tablet)
- Navegadores

### 5. Conversiones

Configurar objetivos en GA:

1. **Analytics → Administrar → Eventos → Crear evento**
2. Ejemplos de conversiones:
   - `completar_registro`: Usuario completa registro
   - `primera_recarga`: Primera recarga de saldo
   - `estacionamiento_finalizado`: Estacionamiento completado

---

## Métricas Clave para el Negocio

### 1. Engagement

```
Métrica: Usuarios activos diarios (DAU)
Objetivo: > 100 usuarios/día

Métrica: Sesiones promedio por usuario
Objetivo: > 3 sesiones/semana

Métrica: Duración de sesión
Objetivo: > 5 minutos
```

### 2. Conversión

```
Métrica: Tasa de registro
Objetivo: 10% de visitantes se registran

Métrica: Tasa de activación
Objetivo: 80% de registrados realizan primera recarga

Métrica: Usuarios activos
Objetivo: 60% de registrados usan el sistema mensualmente
```

### 3. Retención

```
Métrica: Tasa de retención día 1
Objetivo: 40% vuelve al día siguiente

Métrica: Tasa de retención día 7
Objetivo: 20% vuelve a la semana

Métrica: Tasa de retención día 30
Objetivo: 10% sigue activo al mes
```

### 4. Monetización

```
Métrica: Ingreso promedio por usuario (ARPU)
Cálculo: Total facturado / Total usuarios activos

Métrica: Valor de vida del cliente (LTV)
Cálculo: ARPU × Meses promedio como cliente

Métrica: Transacciones por usuario
Objetivo: > 10 estacionamientos/mes
```

---

## Reportes Personalizados

### 1. Crear Reporte de Estacionamientos

1. **Analytics → Explorar → Crear exploración**
2. **Configurar**:
   - Dimensiones: `event_category`, `event_action`, `event_label`
   - Métricas: `event_count`, `event_value`
   - Filtros: `event_category = 'Estacionamiento'`
3. **Guardar** como "Análisis de Estacionamiento"

### 2. Reporte de Facturación

```
Dimensiones:
- event_category = 'Facturación'
- event_label (tipo de comprobante)

Métricas:
- event_count (cantidad de facturas)
- event_value (monto total facturado)
```

### 3. Reporte de Errores

```
Dimensiones:
- event_category = 'Error'
- event_label (endpoint + status code)

Métricas:
- event_count (cantidad de errores)

Orden:
- Descendente por event_count
```

---

## Privacidad y GDPR

### 1. Datos NO Recopilados

❌ Contraseñas  
❌ Tokens de autenticación  
❌ Números de tarjeta de crédito  
❌ DNI completo  
❌ Dirección exacta

### 2. Datos Recopilados

✅ Email (hasheado en GA4)  
✅ ID de usuario (UUID anónimo)  
✅ Rol (cliente, admin)  
✅ Acciones realizadas (login, estacionamiento, etc.)  
✅ Patentes de vehículos  
✅ Montos de transacciones

### 3. Anonimización

En `analytics.js` ya configurado:

```javascript
ReactGA.initialize(TRACKING_ID, {
  gaOptions: {
    anonymize_ip: true,        // Anonimizar IPs
    client_storage: 'none',    // No cookies de terceros
  }
});
```

### 4. Opt-Out

Implementar opción de opt-out:

```javascript
// En componente de configuración de privacidad
const handleOptOut = () => {
  window['ga-disable-' + TRACKING_ID] = true;
  localStorage.setItem('ga-opt-out', 'true');
};
```

---

## Debugging

### 1. Modo Debug

En `.env`:

```env
# Activar debug de GA
REACT_APP_GA_DEBUG=true
```

En consola verás:

```
✅ Google Analytics inicializado: G-XXXXXXXXXX
📊 GA Pageview: /dashboard Panel de Control
📊 GA Event: { category: 'Autenticación', action: 'Inicio de sesión', label: 'user@example.com' }
```

### 2. Google Analytics Debugger

Extensión de Chrome para ver eventos en tiempo real:

1. Instalar [Google Analytics Debugger](https://chrome.google.com/webstore/detail/google-analytics-debugger/)
2. Activar extensión
3. Abrir DevTools → Console
4. Ver eventos GA detallados

### 3. Verificar Eventos

```javascript
// En componente de prueba
import { trackEvent } from '../services/analytics';

useEffect(() => {
  trackEvent({
    category: 'Test',
    action: 'Component Mounted',
    label: 'Dashboard'
  });
}, []);
```

---

## Performance

### 1. Lazy Loading

GA4 se carga de forma asíncrona, no bloquea el render inicial.

### 2. Batching

Eventos se envían en lotes, no uno por uno:

```javascript
// Los eventos se agrupan automáticamente
AnalyticsEvents.LOGIN(email);
AnalyticsEvents.START_PARKING(patente);
AnalyticsEvents.RECHARGE_BALANCE(monto);
// → Se envía 1 sola petición con 3 eventos
```

### 3. Network Waterfall

Verificar que GA no afecta performance:

1. DevTools → Network
2. Filtrar por `google-analytics` o `gtag`
3. Verificar que carga en paralelo, no en serie

---

## Mejores Prácticas

✅ **Nombrar eventos consistentemente**: Usa `Categoría` en español, `Acción` como verbo  
✅ **Incluir valores monetarios**: En eventos de facturación y recargas  
✅ **No trackear PII**: Nunca enviar contraseñas, DNI, etc.  
✅ **Usar eventos predefinidos**: Más fácil de mantener  
✅ **Probar en desarrollo**: Verificar con GA Debugger  
✅ **Documentar eventos**: Mantener lista de eventos en README  

❌ **No trackear excesivamente**: Solo eventos relevantes para negocio  
❌ **No bloquear render**: Analytics debe ser asíncrono  
❌ **No confiar solo en analytics**: Tener logs de backend también  

---

## Recursos

- [Google Analytics 4 Documentation](https://developers.google.com/analytics/devguides/collection/ga4)
- [react-ga4 Library](https://github.com/PriceRunner/react-ga4)
- [GA4 Event Parameters](https://developers.google.com/analytics/devguides/collection/ga4/event-parameters)
- [GDPR Compliance for GA](https://support.google.com/analytics/answer/9019185)

---

## Roadmap

### Próximas Mejoras

- [ ] **Embudos de conversión**: Registro → Primera recarga → Primer estacionamiento
- [ ] **Cohortes de usuarios**: Análisis de retención por cohorte
- [ ] **A/B Testing**: Probar variantes de UI
- [ ] **Integración con BigQuery**: Exportar datos para análisis avanzado
- [ ] **Dashboards personalizados**: Looker Studio con métricas clave

---

**Última actualización**: 2024  
**Versión de GA**: Google Analytics 4 (GA4)  
**Librería**: react-ga4 ^2.0.0
