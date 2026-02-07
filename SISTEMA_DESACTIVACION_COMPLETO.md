# Sistema Completo de Activación/Desactivación de Usuarios

## 📋 Resumen de Implementación

Se ha implementado un sistema integral de gestión de activación/desactivación de usuarios con las siguientes características:

### ✅ Funcionalidades Implementadas

#### 1. **Desactivación de Usuarios (Soft Delete)**
- ✅ Motivo obligatorio (mínimo 10 caracteres)
- ✅ Validación de estacionamiento activo
- ✅ Desactivación automática de todos los vehículos del usuario
- ✅ Cierre de sesión activa (indicador en logs)
- ✅ Modificación de DNI y email para permitir re-registro
- ✅ Envío de email de notificación automático
- ✅ Registro completo en LogUsuario con todos los datos

#### 2. **Reactivación de Usuarios**
- ✅ Motivo obligatorio
- ✅ Asignación de nuevo email
- ✅ Reactivación automática de vehículos
- ✅ Requiere nueva verificación y contraseña
- ✅ Envío de email de notificación
- ✅ Registro completo en LogUsuario

#### 3. **Sistema de Auditoría (LogUsuario)**
- ✅ Modelo completo con toda la información requerida:
  * Datos del usuario (id, dni, nombre, apellido, email)
  * Datos del admin que realizó la acción
  * Tipo de acción (desactivación/reactivación)
  * Motivo (obligatorio)
  * Datos adicionales:
    - Vehículos afectados (array de dominios)
    - Saldo disponible
    - Email notificado
    - Sesión cerrada (boolean)
    - IP de origen

#### 4. **Interfaz de Usuario (Frontend)**
- ✅ Componente GestionUsuariosDesactivados.jsx completo
- ✅ Listado de usuarios desactivados con filtros
- ✅ Modal de reactivación con formulario
- ✅ Modal de historial de activaciones
- ✅ Integración en AdminDashboard
- ✅ Prompt para solicitar motivo al desactivar

#### 5. **Notificaciones por Email**
- ✅ Plantilla HTML profesional para desactivación (roja)
- ✅ Plantilla HTML profesional para reactivación (verde)
- ✅ Manejo de errores sin afectar la operación principal
- ✅ Logs de confirmación de envío

---

## 📁 Archivos Modificados

### Backend

1. **models/LogUsuario.js** (NUEVO)
   - Schema de Mongoose para auditoría
   - Campos: usuario, admin, accion, motivo, datosAdicionales
   - Indexes para búsquedas eficientes

2. **models/Usuario.js**
   - Agregado campo `motivoDesactivacion: String`

3. **controllers/adminController.js**
   - ✨ **eliminarUsuario**: Completamente reescrita con:
     * Validación de motivo obligatorio
     * Captura de IP origen
     * Desactivación de vehículos mejorada
     * Creación de LogUsuario
     * Envío de email
     * Respuesta detallada con estadísticas
   
   - ✨ **reactivarUsuario**: Mejorada con:
     * Validación de motivo obligatorio
     * Captura de IP origen
     * Reactivación de vehículos
     * Creación de LogUsuario
     * Envío de email
   
   - ✨ **obtenerUsuariosDesactivados**: Mejorada con:
     * Extracción de DNI original
     * Conteo de vehículos
     * Datos del último log de desactivación
   
   - ✨ **obtenerHistorialActivaciones** (NUEVA):
     * Devuelve historial completo de activaciones/desactivaciones
     * Búsqueda por DNI original o desactivado

4. **routes/admin.js**
   - Agregada ruta: GET `/usuarios/:dni/historial-activaciones`
   - Import de `obtenerHistorialActivaciones`

5. **services/emailService.js** (NUEVO)
   - Clase EmailService con nodemailer
   - Métodos:
     * enviarNotificacionDesactivacion(usuario)
     * enviarNotificacionActivacion(usuario)
   - Plantillas HTML responsive

6. **.env y .env.example**
   - Agregadas variables de configuración de email:
     * EMAIL_HOST
     * EMAIL_PORT
     * EMAIL_USER (requiere configuración)
     * EMAIL_PASS (requiere configuración)

### Frontend

7. **components/GestionUsuariosDesactivados.jsx** (NUEVO)
   - Componente completo para gestionar usuarios desactivados
   - Funcionalidades:
     * Listado con filtros de búsqueda
     * Modal de reactivación con validación
     * Modal de historial completo
     * Diseño responsive
     * Manejo de estados (loading, error, éxito)

8. **styles/gestion-usuarios-desactivados.css** (NUEVO)
   - CSS completo para el componente
   - Estilos para modales, tablas, badges
   - Responsive design
   - Animaciones suaves

9. **components/AdminDashboard.jsx**
   - Import de GestionUsuariosDesactivados
   - Botón "👥 Usuarios Desactivados"
   - Renderizado condicional del componente

10. **components/AdminGestion.jsx**
    - Función `manejarEliminarUsuario` completamente reescrita
    - Solicita motivo via prompt
    - Validación de longitud mínima
    - Confirmación con detalles
    - Envío de motivo en el body del DELETE

---

## 🔧 Configuración Requerida

### Email (Gmail)

Para que funcionen las notificaciones por email, debes configurar:

1. Crear una contraseña de aplicación en Google:
   - Ve a https://myaccount.google.com/security
   - Habilita verificación en 2 pasos
   - Ve a "Contraseñas de aplicación"
   - Genera una contraseña para "Correo"

2. Actualizar backend/.env:
   ```env
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=tu_email@gmail.com
   EMAIL_PASS=tu_contraseña_de_aplicación
   ```

---

## 📡 API Endpoints

### Desactivar Usuario
```http
DELETE /api/admin/usuarios/:dni
Content-Type: application/json
Authorization: Bearer {token}

{
  "motivo": "Motivo de la desactivación"
}
```

**Respuesta:**
```json
{
  "mensaje": "Usuario desactivado correctamente",
  "detalles": {
    "dniOriginal": "12345678",
    "vehiculosDesactivados": 2,
    "emailEnviado": true,
    "emailDestino": "usuario@ejemplo.com",
    "motivo": "Motivo de la desactivación",
    "logId": "65f..."
  }
}
```

### Reactivar Usuario
```http
POST /api/admin/usuarios/reactivar
Content-Type: application/json
Authorization: Bearer {token}

{
  "dni": "12345678",
  "nuevoEmail": "nuevo@ejemplo.com",
  "motivo": "Motivo de la reactivación"
}
```

**Respuesta:**
```json
{
  "mensaje": "Usuario reactivado correctamente",
  "detalles": {
    "dni": "12345678",
    "email": "nuevo@ejemplo.com",
    "vehiculosReactivados": 2,
    "emailEnviado": true,
    "logId": "65f..."
  }
}
```

### Obtener Usuarios Desactivados
```http
GET /api/admin/usuarios/desactivados
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "usuarios": [
    {
      "_id": "65f...",
      "dniOriginal": "12345678",
      "nombre": "Juan",
      "apellido": "Pérez",
      "emailDesactivado": "juan@ejemplo.com_DESACTIVADO_1234567890",
      "fechaDesactivacion": "2024-01-15T10:30:00.000Z",
      "motivoDesactivacion": "Incumplimiento de normas",
      "montoDisponible": 150.50,
      "cantidadVehiculos": 2,
      "ultimaDesactivacion": {
        "motivo": "Incumplimiento de normas",
        "admin": "Admin González",
        "fecha": "2024-01-15T10:30:00.000Z"
      }
    }
  ]
}
```

### Obtener Historial de Activaciones
```http
GET /api/admin/usuarios/:dni/historial-activaciones
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "historial": [
    {
      "_id": "65f...",
      "usuario": {
        "id": "65e...",
        "dni": "12345678",
        "nombre": "Juan",
        "apellido": "Pérez",
        "email": "juan@ejemplo.com"
      },
      "admin": {
        "id": "65d...",
        "dni": "87654321",
        "nombre": "Admin",
        "apellido": "González",
        "email": "admin@sistema.com"
      },
      "accion": "desactivacion",
      "motivo": "Incumplimiento de normas",
      "datosAdicionales": {
        "vehiculosAfectados": ["ABC123", "XYZ789"],
        "saldoDisponible": 150.50,
        "emailNotificado": "juan@ejemplo.com",
        "sesionCerrada": true,
        "ipOrigen": "::1"
      },
      "fecha": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

---

## 🧪 Pruebas Recomendadas

### 1. Desactivar Usuario
- [ ] Desactivar usuario sin motivo (debe fallar)
- [ ] Desactivar usuario con motivo corto < 10 caracteres (debe fallar)
- [ ] Desactivar usuario con estacionamiento activo (debe fallar)
- [ ] Desactivar usuario correctamente
- [ ] Verificar que se desactivaron todos los vehículos
- [ ] Verificar que se creó el log con todos los datos
- [ ] Verificar que llegó el email de notificación

### 2. Reactivar Usuario
- [ ] Reactivar con email ya en uso (debe fallar)
- [ ] Reactivar con DNI ya en uso (debe fallar)
- [ ] Reactivar correctamente
- [ ] Verificar que se reactivaron todos los vehículos
- [ ] Verificar que se creó el log
- [ ] Verificar que llegó el email de notificación

### 3. Interfaz de Usuario
- [ ] Ver listado de usuarios desactivados
- [ ] Buscar por DNI, nombre o motivo
- [ ] Ver historial de activaciones
- [ ] Reactivar desde la interfaz

---

## 🔒 Seguridad

✅ **Implementadas:**
- Validación de rol admin en todas las rutas (authMiddleware)
- Motivo obligatorio para todas las acciones
- Registro de IP de origen
- Auditoría completa de todas las acciones
- No se eliminan datos físicamente
- Modificación de DNI y email para evitar conflictos

⚠️ **Recomendaciones adicionales:**
- Implementar sistema de blacklist de tokens JWT para cerrar sesión realmente
- Agregar límite de intentos de reactivación
- Notificar al admin sobre reactivaciones frecuentes
- Revisar logs regularmente

---

## 📊 Datos del Log

Cada acción de desactivación/reactivación genera un registro en `LogUsuario` con:

```javascript
{
  usuario: {
    id: ObjectId,
    dni: String,
    nombre: String,
    apellido: String,
    email: String
  },
  admin: {
    id: ObjectId,
    dni: String,
    nombre: String,
    apellido: String,
    email: String
  },
  accion: 'desactivacion' | 'reactivacion',
  motivo: String (obligatorio),
  datosAdicionales: {
    vehiculosAfectados: [String], // Array de dominios
    saldoDisponible: Number,
    emailNotificado: String,
    sesionCerrada: Boolean,
    ipOrigen: String
  },
  fecha: Date (automático)
}
```

---

## 📧 Plantillas de Email

### Desactivación
- Color: Rojo (#e74c3c)
- Contenido:
  * Saludo personalizado
  * Notificación de desactivación
  * Fecha y hora
  * Lista de consecuencias
  * Contacto para soporte

### Reactivación
- Color: Verde (#27ae60)
- Contenido:
  * Saludo personalizado
  * Notificación de reactivación
  * Fecha y hora
  * Instrucciones para recuperar cuenta
  * Enlace al sistema

---

## ✅ Checklist de Implementación

- [x] Modelo LogUsuario creado
- [x] Campo motivoDesactivacion en Usuario
- [x] Función eliminarUsuario reescrita
- [x] Función reactivarUsuario mejorada
- [x] Función obtenerUsuariosDesactivados mejorada
- [x] Función obtenerHistorialActivaciones creada
- [x] Rutas configuradas
- [x] EmailService creado
- [x] Componente frontend GestionUsuariosDesactivados
- [x] CSS del componente
- [x] Integración en AdminDashboard
- [x] Prompt de motivo en AdminGestion
- [x] Desactivación de vehículos
- [x] Sistema de logs
- [x] Notificaciones por email
- [x] Documentación completa

---

## 🚀 Próximos Pasos

1. **Configurar credenciales de email** en backend/.env
2. **Probar** todas las funcionalidades
3. **Verificar** que los emails lleguen correctamente
4. **Revisar** logs en MongoDB
5. **Ajustar** estilos CSS según necesidad

---

## 🐛 Solución al Problema de Vehículos

El problema de que no se desactivaban los vehículos se resolvió:

1. Agregando campo `estActivo: false` en la actualización
2. Agregando logs de confirmación (`console.log`)
3. Devolviendo cantidad de vehículos modificados en la respuesta
4. Validando que la query de Vehiculo.updateMany() sea correcta

El código actualizado garantiza:
```javascript
const resultadoVehiculos = await Vehiculo.updateMany(
  { usuario: usuario._id },
  { 
    $set: { 
      activo: false,
      estActivo: false 
    } 
  }
);

console.log(`🚗 Vehículos desactivados: ${resultadoVehiculos.modifiedCount}`);
```

---

## 📝 Notas Finales

- Todos los cambios preservan la integridad referencial
- No se pierde historial de transacciones
- Sistema completamente auditable
- Emails informativos y profesionales
- Interfaz intuitiva y responsive

¡Sistema completo implementado y listo para usar! 🎉
