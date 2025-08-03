# 🎯 Sistema de Tarifas Personalizadas - Documentación

## 📋 Descripción General

El sistema de tarifas personalizadas permite a los administradores asignar tarifas específicas a usuarios individuales, además de mantener las tarifas por defecto según el tipo de usuario (asociado/no asociado).

## 🏗️ Arquitectura

### Modelo de Usuario (Actualizado)
```javascript
{
  // ... campos existentes ...
  tarifaAsignada: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'ConfiguracionPrecio',
    default: null 
  }
}
```

### Lógica de Prioridad de Tarifas
1. **Tarifa Específica Asignada**: Si el usuario tiene una tarifa específica, se usa esta
2. **Tarifa por Tipo**: Si no tiene tarifa específica, se usa la tarifa según asociado/no asociado
3. **Tarifa por Defecto**: Valores fijos como fallback (250/500)

## 🔧 Funcionalidades Implementadas

### Backend

#### 1. Controlador de Usuarios (`usuarioController.js`)
- ✅ `obtenerTodosUsuarios()`: Lista usuarios con tarifas pobladas
- ✅ `actualizarUsuario()`: Permite asignar/cambiar tarifas
- ✅ `obtenerTarifasDisponibles()`: Lista todas las tarifas activas

#### 2. Controlador de Estacionamiento (`estacionamientoController.js`)
- ✅ `obtenerTarifa()`: Función mejorada que considera tarifas específicas
- ✅ Consultas con `.populate()` para cargar tarifas asignadas

#### 3. Rutas (`/api/usuarios`)
```javascript
GET    /                      // Obtener todos los usuarios
PUT    /:dni                  // Actualizar usuario (incluye tarifa)
GET    /tarifas/disponibles   // Obtener tarifas disponibles
```

### Frontend

#### 1. Servicio Admin (`adminGestionService.js`)
- ✅ `obtenerTarifasDisponibles()`: Obtiene tarifas para el selector

#### 2. Componente AdminGestion
- ✅ Visualización de tarifa asignada en lista de usuarios
- ✅ Selector de tarifa en formulario de edición
- ✅ Estado para manejar tarifas disponibles

## 📦 Scripts de Migración

### 1. Migración de Usuarios Existentes
```bash
npm run migrate:tarifas
```
**Funcionalidad:**
- Asigna tarifas automáticamente basadas en estado de asociado
- Crea tarifas por defecto si no existen
- Maneja errores y proporciona logging detallado

### 2. Rollback (Si es necesario)
```bash
npm run migrate:rollback-tarifas
```

### 3. Verificación del Sistema
```bash
npm run verify:tarifas
```

## 🎨 Interfaz de Usuario

### Lista de Usuarios
```
Usuario: Juan Pérez (12345678)
Email: juan@email.com
Asociado: Sí
Tarifa: Asociado - $1500/hora
Saldo: $500
```

### Formulario de Edición
```
Tarifa Asignada: [Dropdown]
├── Sin tarifa específica
├── Asociado - $1500/hora (Tarifa preferencial)
└── Público General - $2000/hora (Tarifa estándar)
```

## 🔍 Cómo Usar

### Para Administradores

1. **Acceder a Gestión de Usuarios**
   - Ir a AdminGestion → Vista Usuarios

2. **Editar Usuario**
   - Click en "Modificar" en el usuario deseado
   - Seleccionar tarifa en el dropdown "Tarifa Asignada"
   - Guardar cambios

3. **Crear Nuevas Tarifas**
   - Usar la gestión de precios existente
   - Las nuevas tarifas aparecerán automáticamente en el selector

### Para el Sistema

1. **Cálculo de Precios**
   - El sistema automáticamente usa la tarifa asignada
   - Fallback a tarifas por defecto si no hay asignación específica

2. **Logging**
   - Se registra qué tarifa se usa para cada transacción
   - Facilita auditoría y resolución de problemas

## 📊 Casos de Uso

### Caso 1: Usuario VIP
```
Usuario: Empleado especial
Asociado: No
Tarifa Asignada: "VIP - $1000/hora"
Resultado: Paga $1000/hora (menos que tarifa normal de no asociado)
```

### Caso 2: Usuario con Descuento Temporal
```
Usuario: Cliente promocional
Asociado: No  
Tarifa Asignada: "Promoción - $1200/hora"
Resultado: Tarifa promocional en lugar de estándar
```

### Caso 3: Usuario Sin Tarifa Específica
```
Usuario: Cliente regular
Asociado: Sí
Tarifa Asignada: null
Resultado: Usa tarifa por defecto de asociado ($1500/hora)
```

## 🐛 Resolución de Problemas

### Error: "Tarifa no encontrada"
**Causa:** Tarifa asignada fue eliminada o desactivada
**Solución:** Sistema automáticamente usa tarifa por defecto

### Error: "No se pueden cargar tarifas"
**Causa:** Problema de conexión o permisos
**Solución:** Verificar conectividad y ejecutar `npm run verify:tarifas`

### Usuarios sin Tarifa Después de Migración
**Solución:** 
```bash
npm run migrate:tarifas  # Re-ejecutar migración
npm run verify:tarifas   # Verificar resultado
```

## 🔒 Consideraciones de Seguridad

1. **Autorización**: Solo administradores pueden asignar tarifas
2. **Validación**: Se valida que las tarifas existan y estén activas
3. **Auditoría**: Los cambios se registran en logs

## 🚀 Próximos Pasos

1. **Historial de Cambios**: Registrar cambios de tarifas por usuario
2. **Tarifas Temporales**: Tarifas con fecha de vencimiento
3. **Notificaciones**: Alertar cuando se cambia tarifa de usuario
4. **Reportes**: Dashboard con uso de tarifas personalizadas

## 📝 Notas de Migración

- ✅ Usuarios existentes migrados automáticamente
- ✅ Compatibilidad hacia atrás mantenida
- ✅ Sistema de fallback robusto implementado
- ✅ Logging completo para debugging

---

**Última actualización:** 3 de agosto de 2025  
**Versión:** 1.0  
**Estado:** ✅ Implementado y Probado
