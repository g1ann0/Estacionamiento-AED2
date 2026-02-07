# 📊 Sistema de Logging - Guía Completa

## Introducción

Este sistema implementa **logging detallado** de todas las operaciones del backend usando **Winston**, una librería de logging profesional para Node.js.

### Características

✅ **Logs automáticos de HTTP**: Todas las peticiones se registran con método, URL, status code y tiempo de respuesta  
✅ **Rotación de archivos**: Los logs se rotan diariamente para no consumir espacio infinito  
✅ **Niveles de log**: error, warn, info, debug  
✅ **Formato legible**: Timestamps, colores en consola, JSON estructurado en archivos  
✅ **Metadata contextual**: Usuario autenticado, IP, parámetros de petición  

---

## Arquitectura

### Componentes

```
backend/
├── utils/
│   └── logger.js              # Configuración de Winston
├── middlewares/
│   └── requestLogger.js       # Middleware de HTTP logging
├── server.js                  # Integración del middleware
└── logs/                      # Directorio de logs (auto-creado)
    ├── combined.log          # Todos los logs
    └── error.log             # Solo errores
```

### Flujo de Logging

```
1. Petición HTTP llega al servidor
          ↓
2. requestLogger intercepta (middleware)
          ↓
3. Se registra timestamp de inicio
          ↓
4. Petición procesada por controladores
          ↓
5. Response enviado al cliente
          ↓
6. requestLogger calcula tiempo de respuesta
          ↓
7. Log completo se guarda con logger.logRequest()
```

---

## Configuración

### 1. Instalación de Dependencias

```bash
cd backend
npm install winston winston-daily-rotate-file
```

### 2. Variables de Entorno

En `.env`:

```env
# Nivel de logging
LOG_LEVEL=info        # error | warn | info | debug

# Entorno
NODE_ENV=development  # development | production
```

### 3. Integración en server.js

```javascript
const logger = require('./utils/logger');
const requestLogger = require('./middlewares/requestLogger');

// IMPORTANTE: Agregar ANTES de las rutas
app.use(requestLogger);

// Después de las rutas
app.use(routes);
```

---

## Uso del Logger

### 1. Logging Automático de HTTP (Ya configurado)

Todas las peticiones se loguean automáticamente:

```
2024-01-15 10:30:45 [INFO]: POST /api/auth/login - 200 - 145ms
  {
    "ip": "192.168.1.100",
    "userAgent": "Mozilla/5.0...",
    "description": "Inicio de sesión",
    "message": "🟢 ÉXITO"
  }
```

### 2. Logging Manual en Controladores

En cualquier controlador:

```javascript
const logger = require('../utils/logger');

// Operación exitosa
logger.logSuccess('Usuario creado correctamente', {
  userId: nuevoUsuario._id,
  email: nuevoUsuario.email
});

// Error de negocio
logger.logError('Error al crear usuario', error, {
  email: req.body.email,
  rol: req.body.rol
});

// Advertencia
logger.logWarning('Intento de login con email no verificado', {
  email: req.body.email
});
```

### 3. Niveles de Log

```javascript
// ERROR - Errores críticos
logger.error('Error al conectar a MongoDB', { error: err.message });

// WARN - Advertencias importantes
logger.warn('Usuario intentó acceder sin permisos', { userId: '123' });

// INFO - Información general (default)
logger.info('Servidor iniciado correctamente', { port: 3000 });

// DEBUG - Información de depuración
logger.debug('Query ejecutada', { query: 'SELECT * FROM users' });
```

---

## Ejemplos de Logs por Operación

### Login Exitoso

```
2024-01-15 10:30:45 [INFO]: POST /api/auth/login - 200 - 145ms
{
  "ip": "192.168.1.100",
  "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
  "method": "POST",
  "url": "/api/auth/login",
  "statusCode": 200,
  "responseTime": 145,
  "description": "Inicio de sesión",
  "message": "🟢 ÉXITO"
}
```

### Error de Autenticación

```
2024-01-15 10:32:10 [WARN]: POST /api/auth/login - 401 - 50ms
{
  "ip": "192.168.1.100",
  "method": "POST",
  "url": "/api/auth/login",
  "statusCode": 401,
  "responseTime": 50,
  "description": "Inicio de sesión",
  "message": "🟡 ERROR DEL CLIENTE"
}
```

### Inicio de Estacionamiento

```
2024-01-15 10:35:20 [INFO]: POST /api/estacionamiento/iniciar - 201 - 320ms
{
  "ip": "192.168.1.100",
  "userId": "65a3b1c9f8d4e2a3c1b5d6e7",
  "userEmail": "usuario@example.com",
  "userRole": "cliente",
  "params": {
    "patenteId": "65a3b1c9f8d4e2a3c1b5d6e8"
  },
  "method": "POST",
  "url": "/api/estacionamiento/iniciar",
  "statusCode": 201,
  "responseTime": 320,
  "description": "Inicio de estacionamiento",
  "message": "🟢 ÉXITO"
}
```

### Error del Servidor

```
2024-01-15 10:40:15 [ERROR]: GET /api/usuarios - 500 - 1500ms
{
  "ip": "192.168.1.100",
  "userId": "65a3b1c9f8d4e2a3c1b5d6e7",
  "userEmail": "admin@example.com",
  "userRole": "admin",
  "method": "GET",
  "url": "/api/usuarios",
  "statusCode": 500,
  "responseTime": 1500,
  "description": "Consulta de usuarios",
  "message": "🔴 ERROR DEL SERVIDOR"
}

Error al consultar usuarios: MongoError: Connection timeout
  at Connection.connect (/app/node_modules/mongodb/lib/connection.js:123)
  at Database.connect (/app/node_modules/mongoose/lib/database.js:456)
```

---

## Visualización de Logs

### 1. En Desarrollo (Consola)

Los logs aparecen automáticamente en la consola con colores:

```bash
# Iniciar servidor
npm start

# Verás en consola:
10:30:45 info: POST /api/auth/login - 200 - 145ms
{
  description: 'Inicio de sesión',
  message: '🟢 ÉXITO'
}
```

### 2. En Archivos

```bash
# Ver todos los logs
tail -f backend/logs/combined.log

# Ver solo errores
tail -f backend/logs/error.log

# Últimas 100 líneas
tail -n 100 backend/logs/combined.log

# Buscar logs de un usuario específico
grep "usuario@example.com" backend/logs/combined.log

# Windows PowerShell
Get-Content backend/logs/combined.log -Wait -Tail 50
```

### 3. Con Docker

```bash
# Logs del contenedor
docker-compose logs -f backend

# Logs desde el archivo (dentro del contenedor)
docker-compose exec backend tail -f /app/logs/combined.log
```

---

## Filtrado y Análisis

### Buscar Errores

```bash
# Errores de las últimas 24 horas
grep "ERROR" backend/logs/combined.log | grep "$(date +%Y-%m-%d)"

# Errores de un endpoint específico
grep "POST /api/auth/login" backend/logs/combined.log | grep "ERROR"
```

### Análisis de Performance

```bash
# Peticiones que tardaron más de 1 segundo
grep -o "responseTime.*" backend/logs/combined.log | grep -E "[0-9]{4,}"

# Top 10 endpoints más lentos
grep "responseTime" backend/logs/combined.log | sort -t: -k2 -nr | head -10
```

### Estadísticas por Status Code

```bash
# Contar por status code
grep "statusCode" backend/logs/combined.log | cut -d: -f2 | cut -d, -f1 | sort | uniq -c

# Ejemplo de salida:
#  450 200
#   23 201
#   12 400
#    5 401
#    2 500
```

---

## Formato de Logs

### Estructura JSON

Cada log tiene la siguiente estructura:

```json
{
  "timestamp": "2024-01-15 10:30:45",
  "level": "info",
  "message": "POST /api/auth/login - 200 - 145ms",
  "service": "estacionamiento-api",
  "method": "POST",
  "url": "/api/auth/login",
  "statusCode": 200,
  "responseTime": 145,
  "ip": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "userId": "65a3b1c9f8d4e2a3c1b5d6e7",
  "userEmail": "usuario@example.com",
  "userRole": "cliente",
  "description": "Inicio de sesión",
  "message": "🟢 ÉXITO"
}
```

### Campos

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| `timestamp` | Fecha y hora del log | `2024-01-15 10:30:45` |
| `level` | Nivel de severidad | `info`, `warn`, `error` |
| `message` | Mensaje principal | `POST /api/auth/login - 200 - 145ms` |
| `method` | Método HTTP | `GET`, `POST`, `PUT`, `DELETE` |
| `url` | URL de la petición | `/api/auth/login` |
| `statusCode` | Código de estado HTTP | `200`, `400`, `500` |
| `responseTime` | Tiempo de respuesta en ms | `145` |
| `ip` | IP del cliente | `192.168.1.100` |
| `userAgent` | User agent del navegador | `Mozilla/5.0...` |
| `userId` | ID del usuario (si autenticado) | `65a3b1c9...` |
| `userEmail` | Email del usuario | `usuario@example.com` |
| `userRole` | Rol del usuario | `cliente`, `admin` |
| `description` | Descripción de la operación | `Inicio de sesión` |
| `params` | Parámetros de URL | `{ "patenteId": "..." }` |
| `query` | Query string | `{ "page": 1 }` |

---

## Configuración Avanzada

### 1. Rotación de Logs Diaria

Ya configurado en `logger.js`:

```javascript
const DailyRotateFile = require('winston-daily-rotate-file');

new DailyRotateFile({
  filename: 'logs/application-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',      // Máximo 20MB por archivo
  maxFiles: '14d',     // Mantener 14 días
  zippedArchive: true  // Comprimir archivos antiguos
})
```

### 2. Niveles por Entorno

```javascript
// En .env
# Desarrollo
LOG_LEVEL=debug

# Producción
LOG_LEVEL=error
```

### 3. Logs a Servicios Externos

Agregar transports para servicios como **Loggly**, **Papertrail**, **CloudWatch**:

```javascript
const { Loggly } = require('winston-loggly-bulk');

logger.add(new Loggly({
  token: process.env.LOGGLY_TOKEN,
  subdomain: 'tu-subdomain',
  tags: ['estacionamiento', 'production'],
  json: true
}));
```

---

## Monitoreo en Producción

### 1. Alertas de Errores

Configurar alertas para errores críticos:

```javascript
// En logger.js
logger.on('error', (error) => {
  // Enviar email/SMS/Slack
  notificarEquipo(error);
});
```

### 2. Dashboard de Logs

Herramientas recomendadas:

- **ELK Stack** (Elasticsearch, Logstash, Kibana)
- **Grafana Loki**
- **Datadog**
- **New Relic**

### 3. Métricas Clave a Monitorear

- ⏱️ **Response Time promedio**: Debe ser < 500ms
- ❌ **Error Rate**: % de peticiones con status 5xx
- 📊 **Request Rate**: Peticiones por minuto
- 👥 **Usuarios activos**: Logins únicos por hora

---

## Troubleshooting

### Logs no aparecen en archivos

1. Verificar que existe el directorio `backend/logs/`
2. Verificar permisos de escritura
3. Verificar que `LOG_LEVEL` permite el nivel de log

### Archivos de log muy grandes

1. Verificar configuración de rotación
2. Reducir `LOG_LEVEL` en producción
3. Ajustar `maxSize` y `maxFiles`

### Performance degradado por logs

1. Usar logs asíncronos (Winston ya lo hace)
2. Reducir metadata en producción
3. Considerar sampling (loguear solo % de peticiones)

---

## Mejores Prácticas

✅ **Loguear contexto suficiente** pero no datos sensibles (passwords, tokens)  
✅ **Usar niveles apropiados**: INFO para operaciones normales, ERROR para fallos  
✅ **Incluir IDs de correlación** para rastrear requests complejos  
✅ **Rotar logs regularmente** para no llenar el disco  
✅ **Monitorear logs en producción** con alertas automáticas  
❌ **No loguear datos personales** sin consentimiento (GDPR/CCPA)  
❌ **No loguear demasiado** en producción (performance)  

---

## Recursos

- [Winston Documentation](https://github.com/winstonjs/winston)
- [Best Practices for Logging](https://www.loggly.com/blog/logging-best-practices/)
- [Node.js Logging Guide](https://betterstack.com/community/guides/logging/how-to-install-setup-and-use-winston-and-morgan-to-log-node-js-applications/)

---

**Última actualización**: 2024  
**Versión de Winston**: 3.x
