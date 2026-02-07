# 🔄 Sistema de Activación/Desactivación de Usuarios

## 📋 Descripción General

Este sistema implementa **soft delete** (eliminación lógica) en lugar de eliminación física de datos, manteniendo la integridad histórica y permitiendo la reactivación de cuentas.

## ✨ Características Implementadas

### 1. **Desactivación de Usuarios**
- ✅ Cambio de estado `activo: false`
- ✅ Desactivación automática de vehículos asociados
- ✅ Protección: No permite desactivar con estacionamiento activo
- ✅ Protección: No permite desactivar administradores
- ✅ Notificación automática por email
- ✅ Preservación de datos históricos

### 2. **Reactivación de Usuarios**
- ✅ Restauración de cuenta con nuevo email
- ✅ Reactivación automática de vehículos
- ✅ Notificación automática por email
- ✅ Requiere nueva verificación de cuenta

### 3. **Notificaciones por Email**
- ✅ Email HTML responsive
- ✅ Mensaje personalizado por usuario
- ✅ Información detallada del cambio
- ✅ No bloquea la operación si falla el envío

## 🎯 Casos de Uso

### Historia de Usuario 1: Desactivar Usuario
```
Como admin del sistema
Quiero poder desactivar un usuario
Para que no pueda acceder al sistema sin perder su historial

Criterios de aceptación:
✅ El usuario no puede ingresar al sistema
✅ Sus vehículos quedan desactivados
✅ Recibe un email notificándole
✅ Su historial se mantiene intacto
✅ El DNI queda disponible para nuevos registros
```

### Historia de Usuario 2: Reactivar Usuario
```
Como admin del sistema
Quiero poder reactivar un usuario desactivado
Para que vuelva a usar el sistema

Criterios de aceptación:
✅ El usuario puede volver a acceder
✅ Sus vehículos se reactivan
✅ Recibe un email de bienvenida
✅ Debe verificar su cuenta nuevamente
```

## 🔧 Implementación Técnica

### Modelos Modificados

#### Usuario.js
```javascript
{
  activo: { type: Boolean, default: true },
  fechaDesactivacion: { type: Date }
}
```

#### Vehiculo.js
```javascript
{
  activo: { type: Boolean, default: true }
}
```

### Endpoints

#### POST /api/admin/usuarios/:dni/desactivar
**Desactiva un usuario y sus vehículos**

Respuesta exitosa:
```json
{
  "mensaje": "Usuario y sus vehículos desactivados correctamente.",
  "dniOriginal": "44242232",
  "emailEnviado": "usuario@example.com"
}
```

Errores posibles:
- 404: Usuario no encontrado
- 400: Usuario ya desactivado
- 400: Usuario es administrador
- 400: Tiene estacionamiento activo

#### POST /api/admin/usuarios/reactivar
**Reactiva un usuario y sus vehículos**

Body:
```json
{
  "dni": "44242232",
  "nuevoEmail": "nuevoemail@example.com"
}
```

Respuesta exitosa:
```json
{
  "mensaje": "Usuario y sus vehículos reactivados correctamente.",
  "usuario": {
    "dni": "44242232",
    "nombre": "Juan",
    "apellido": "Pérez",
    "email": "nuevoemail@example.com"
  }
}
```

### Servicio de Email

#### emailService.js

**Métodos disponibles:**
- `enviarNotificacionDesactivacion(usuario)`
- `enviarNotificacionActivacion(usuario)`

**Características:**
- Templates HTML responsive
- Manejo de errores sin bloqueo
- Personalización por usuario
- Logs detallados

## 📧 Configuración de Email

### 1. Variables de Entorno

Agregar al `.env`:
```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=tu_email@gmail.com
EMAIL_PASS=tu_contraseña_de_aplicacion
```

### 2. Gmail - Obtener Contraseña de Aplicación

1. Ve a tu cuenta de Google
2. Seguridad → Verificación en 2 pasos
3. Contraseñas de aplicaciones
4. Genera una nueva contraseña
5. Úsala en `EMAIL_PASS`

### 3. Otros Proveedores

**Outlook:**
```env
EMAIL_HOST=smtp-mail.outlook.com
EMAIL_PORT=587
```

**Yahoo:**
```env
EMAIL_HOST=smtp.mail.yahoo.com
EMAIL_PORT=587
```

## 🔒 Seguridad

### Protecciones Implementadas

1. **No elimina admins:** Valida rol antes de desactivar
2. **Verifica estacionamiento activo:** No desactiva si tiene vehículo estacionado
3. **Evita duplicados:** Modifica DNI/email de desactivados con timestamp
4. **Requiere re-verificación:** Usuario reactivado debe verificar email
5. **Email único:** Al reactivar requiere email no usado

### Flujo de Datos Sensibles

```
Usuario Original:
dni: "44242232"
email: "juan@example.com"

↓ DESACTIVACIÓN

Usuario Desactivado:
dni: "44242232_DESACTIVADO_1707331200000"
email: "juan@example.com_DESACTIVADO_1707331200000"
activo: false

↓ REACTIVACIÓN

Usuario Reactivado:
dni: "44242232"
email: "nuevoemail@example.com"
activo: true
```

## 📊 Base de Datos

### Consultas Importantes

**Ver usuarios desactivados:**
```javascript
await Usuario.find({ activo: false })
  .select('-password')
  .sort({ fechaDesactivacion: -1 });
```

**Buscar usuario desactivado por DNI:**
```javascript
await Usuario.findOne({ 
  dni: { $regex: `^${dni}_DESACTIVADO_` },
  activo: false 
});
```

**Filtrar solo usuarios activos:**
```javascript
await Usuario.find({ activo: true });
```

## 🧪 Testing

### Prueba Manual - Desactivar Usuario

1. Login como admin
2. Ir a Gestión de Usuarios
3. Seleccionar usuario a desactivar
4. Click en "Desactivar"
5. Verificar:
   - ✅ Usuario no puede hacer login
   - ✅ Vehículos desactivados
   - ✅ Email recibido

### Prueba Manual - Reactivar Usuario

1. Ir a Usuarios Desactivados
2. Seleccionar usuario
3. Click en "Reactivar"
4. Ingresar nuevo email
5. Verificar:
   - ✅ Usuario puede hacer login (después de verificar)
   - ✅ Vehículos reactivados
   - ✅ Email de bienvenida recibido

## ⚠️ Notas Importantes

1. **Historial se mantiene:** Todas las transacciones, comprobantes y logs permanecen
2. **DNI liberado:** El DNI queda disponible para nuevos registros
3. **Email único en reactivación:** Requiere email diferente al original
4. **No afecta facturación:** Las facturas emitidas siguen siendo válidas
5. **Logs completos:** Todas las operaciones quedan registradas

## 🎨 Frontend (Próximo paso)

### Componentes a modificar:
- `ListadosAdmin.jsx` - Botones activar/desactivar
- `AdminGestion.jsx` - Vista de usuarios desactivados
- Agregar iconos de estado (activo/inactivo)
- Agregar confirmaciones modales

## 📞 Soporte

Para problemas con:
- **Emails no enviados:** Verificar configuración SMTP y credenciales
- **Error al desactivar:** Verificar que no tenga estacionamiento activo
- **Error al reactivar:** Verificar que email sea único

---

**Versión:** 1.0.0  
**Fecha:** 7 de febrero de 2026  
**Autor:** Sistema de Estacionamiento
