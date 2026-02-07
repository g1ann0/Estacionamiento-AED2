# 🚗 Sistema de Gestión de Estacionamiento

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-16+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18+-blue.svg)](https://reactjs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-5+-brightgreen.svg)](https://www.mongodb.com/)

Sistema integral de gestión de estacionamiento con facturación electrónica AFIP, desarrollado con arquitectura MVC siguiendo las mejores prácticas de ingeniería web.

## 📋 Tabla de Contenidos

- [Características](#características)
- [Arquitectura](#arquitectura)
- [Tecnologías](#tecnologías)
- [Requisitos Previos](#requisitos-previos)
- [Instalación](#instalación)
- [Configuración](#configuración)
- [Docker](#docker)
- [Logging](#logging)
- [Analytics](#analytics)
- [Uso](#uso)
- [API Documentation](#api-documentation)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Testing](#testing)
- [Despliegue](#despliegue)
- [Contribución](#contribución)
- [Licencia](#licencia)

## ✨ Características

### Funcionalidades Principales

- 🔐 **Autenticación y Autorización**
  - Registro de usuarios con confirmación por email
  - Login con JWT
  - Recuperación de contraseña
  - Roles de usuario (admin/usuario)

- 🚗 **Gestión de Vehículos**
  - Alta, baja y modificación de vehículos
  - Asociación de vehículos a usuarios
  - Historial de cambios (auditoría)

- 🅿️ **Control de Estacionamiento**
  - Registro de entrada y salida
  - Cálculo automático de tarifas
  - Sistema de precios por tipo de usuario
  - Descuento de saldo automático

- 💰 **Gestión Financiera**
  - Recargas de saldo
  - Comprobantes de pago
  - Validación por administrador
  - Historial de transacciones

- 🧾 **Facturación Electrónica AFIP**
  - Integración con Web Services AFIP
  - Generación de facturas A y B
  - CAE (Código de Autorización Electrónica)
  - Validación de CUIT

- 📊 **Panel de Administración**
  - Dashboard con estadísticas
  - Gestión de usuarios y vehículos
  - Auditoría completa del sistema
  - Reportes y métricas

- � **Docker & DevOps**
  - Contenedores para backend, frontend y MongoDB
  - Docker Compose para orquestación
  - Configuración de producción lista
  - Escalabilidad horizontal

- 📋 **Logging Avanzado**
  - Winston para logs estructurados
  - Rotación diaria de archivos
  - Niveles de log (error, warn, info, debug)
  - Tracking de todas las peticiones HTTP

- 📊 **Google Analytics Integration**
  - Tracking de eventos personalizados
  - Métricas de usuario y engagement
  - Análisis de conversión
  - Dashboard de métricas en tiempo real

- 🔍 **SEO y Performance**
  - Sitemap.xml automático
  - Web Vitals monitoring
  - Error tracking
  - Performance metrics

## 🏗️ Arquitectura

El proyecto sigue el patrón **Modelo-Vista-Controlador (MVC)** con las siguientes capas:

```
┌─────────────────────────────────────────────────────────┐
│                     FRONTEND (Vista)                     │
│              React 18 + React Router 7                  │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP/REST API
┌────────────────────┴────────────────────────────────────┐
│                  BACKEND (Controlador)                   │
│                   Express.js + Node.js                   │
├──────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  Routes  │  │Controllers│ │Middlewares│              │
│  └──────────┘  └──────────┘  └──────────┘              │
└────────────────────┬────────────────────────────────────┘
                     │ Mongoose ODM
┌────────────────────┴────────────────────────────────────┐
│                   MODELO (Base de Datos)                 │
│                       MongoDB                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ Usuarios │  │ Vehículos│  │Transacc. │  ...         │
│  └──────────┘  └──────────┘  └──────────┘              │
└──────────────────────────────────────────────────────────┘
```

### Principios de Diseño

- ✅ **Separación de Responsabilidades**: MVC estricto
- ✅ **Clean Code**: Código legible y mantenible
- ✅ **DRY**: Don't Repeat Yourself
- ✅ **SOLID**: Principios de diseño orientado a objetos
- ✅ **RESTful API**: Endpoints siguiendo estándares REST
- ✅ **Escalabilidad**: Arquitectura preparada para crecer
- ✅ **Reutilización**: Componentes y funciones reutilizables

## 🛠️ Tecnologías

### Backend

- **Runtime**: Node.js 16+
- **Framework**: Express.js 4.18
- **Base de Datos**: MongoDB 5+ con Mongoose 7
- **Autenticación**: JWT (jsonwebtoken)
- **Seguridad**: bcryptjs, cors, helmet
- **Facturación**: @afipsdk/afip.js
- **PDFs**: pdfkit

### Frontend

- **Framework**: React 18
- **Routing**: React Router 7
- **SEO**: React Helmet Async
- **Performance**: Web Vitals
- **Build**: React Scripts 5
- **PWA**: Workbox

### DevOps y Herramientas

- **Containerización**: Docker, Docker Compose
- **Logging**: Winston, winston-daily-rotate-file
- **Analytics**: Google Analytics 4 (react-ga4)
- **Control de Versiones**: Git
- **Package Manager**: npm
- **Testing**: Postman / Thunder Client
- **Linting**: ESLint
- **Entornos**: dotenv

## 📦 Requisitos Previos

- Node.js >= 16.0.0
- MongoDB >= 5.0
- npm >= 8.0.0
- Git

## 🚀 Instalación

### 1. Clonar el Repositorio

```bash
git clone https://github.com/tu-usuario/Estacionamiento-AED2.git
cd Estacionamiento-AED2
```

### 2. Instalar Dependencias del Backend

```bash
cd backend
npm install
```

### 3. Instalar Dependencias del Frontend

```bash
cd ../frontend
npm install
```

### 4. Configurar Variables de Entorno

```bash
cd ../backend
cp .env.example .env
```

Editar el archivo `.env` con tus configuraciones:

```env
# Base de datos
MONGODB_URI=mongodb://localhost:27017/estacionamiento_db

# Seguridad
JWT_SECRET=tu_clave_secreta_muy_segura_aqui

# Servidor
PORT=3000
NODE_ENV=development

# AFIP (opcional para facturación)
AFIP_CUIT=30123456789
AFIP_PRODUCTION=false
```

### 5. Inicializar Base de Datos

```bash
npm run setup:init
```

## ⚙️ Configuración

### MongoDB

#### Instalación Local

**Windows:**
1. Descargar MongoDB Community Server desde [mongodb.com](https://www.mongodb.com/try/download/community)
2. Instalar con configuración por defecto
3. MongoDB se ejecutará como servicio en `mongodb://localhost:27017`

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get install mongodb
sudo systemctl start mongodb
```

**macOS:**
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

#### MongoDB Atlas (Cloud)

1. Crear cuenta en [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Crear cluster gratuito
3. Configurar acceso de red (IP Whitelist)
4. Obtener connection string
5. Actualizar `MONGODB_URI` en `.env`

### AFIP - Facturación Electrónica (Opcional)

Para habilitar la facturación electrónica:

1. **Obtener CUIT de la empresa**
2. **Generar certificado digital**:
   ```bash
   cd backend/certs
   node generar-clave.js
   node generar-csr.js
   ```
3. **Solicitar certificado en AFIP**:
   - Ingresar a [AFIP](https://www.afip.gob.ar)
   - Ir a "Administrador de Relaciones de Clave Fiscal"
   - Solicitar certificado con el CSR generado
4. **Configurar .env**:
   ```env
   AFIP_CUIT=30123456789
   AFIP_PRODUCTION=false
   AFIP_CERT_PATH=./certs/afip.crt
   AFIP_KEY_PATH=./certs/afip.key
   ```

Ver [Instrucciones detalladas](backend/certs/README.md)

## 🐳 Docker

El proyecto incluye configuración completa de Docker para desarrollo y producción.

### Inicio Rápido con Docker

```bash
# 1. Configurar variables de entorno
cp .env.docker .env
# Editar .env con tus valores

# 2. Levantar servicios
docker-compose up --build

# 3. Acceder a la aplicación
# Frontend: http://localhost
# Backend: http://localhost:3000
# MongoDB: localhost:27017
```

### Comandos Docker Útiles

```bash
# Ver logs en tiempo real
docker-compose logs -f

# Reiniciar servicios
docker-compose restart

# Detener servicios
docker-compose down

# Limpiar volúmenes (⚠️ borra datos)
docker-compose down -v
```

Ver [Guía completa de Docker](DOCKER.md)

## 📋 Logging

Sistema de logging profesional con Winston.

### Características

- ✅ Logs automáticos de todas las peticiones HTTP
- ✅ Rotación diaria de archivos
- ✅ Niveles: error, warn, info, debug
- ✅ Metadata contextual (usuario, IP, tiempos de respuesta)

### Ver Logs

```bash
# En desarrollo (consola)
npm run dev

# En archivos
tail -f backend/logs/combined.log
tail -f backend/logs/error.log

# Con Docker
docker-compose logs -f backend
```

Ejemplo de log:

```
2024-01-15 10:30:45 [INFO]: POST /api/auth/login - 200 - 145ms
{
  "description": "Inicio de sesión",
  "message": "🟢 ÉXITO",
  "userId": "65a3b1c9...",
  "userEmail": "usuario@example.com"
}
```

Ver [Guía completa de Logging](LOGGING.md)

## 📊 Analytics

Integración con Google Analytics 4 para métricas de uso.

### Configuración

1. Crear propiedad en [Google Analytics](https://analytics.google.com/)
2. Obtener Measurement ID (formato: `G-XXXXXXXXXX`)
3. Configurar en `frontend/.env`:
   ```env
   REACT_APP_GA_TRACKING_ID=G-XXXXXXXXXX
   ```

### Eventos Trackeados

- ✅ Login / Logout / Registro
- ✅ Inicio y finalización de estacionamiento
- ✅ Alta/Baja/Modificación de vehículos
- ✅ Recargas de saldo
- ✅ Generación de facturas
- ✅ Errores de API

Ver [Guía completa de Analytics](ANALYTICS.md)

## 🎮 Uso

### Modo Desarrollo

#### Iniciar Backend

```bash
cd backend
npm run dev
```

El servidor estará disponible en `http://localhost:3000`

#### Iniciar Frontend

```bash
cd frontend
npm start
```

La aplicación web estará disponible en `http://localhost:3001`

#### Acceso desde Dispositivos Móviles (Red Local)

El servidor backend se configura automáticamente para escuchar en todas las interfaces de red:

```bash
# Al iniciar el backend, verás:
✅ Servidor iniciado correctamente
🌐 INFORMACIÓN DE RED:
   IP Local detectada: 192.168.1.100
   Servidor Backend: http://192.168.1.100:3000
   Acceso desde otros dispositivos: http://192.168.1.100:3000
```

Desde tu móvil en la misma red WiFi, accede a:
- Backend API: `http://192.168.1.100:3000`
- Frontend: `http://192.168.1.100:3001`

### Modo Producción

#### Build del Frontend

```bash
cd frontend
npm run build
```

#### Iniciar en Producción

```bash
cd backend
NODE_ENV=production npm start
```

### Scripts Disponibles

#### Backend

```bash
npm start              # Iniciar servidor en producción
npm run dev            # Iniciar servidor en desarrollo (nodemon)
npm run setup:init     # Inicializar base de datos con datos por defecto
npm run setup:reset    # Resetear base de datos
npm run setup:demo     # Cargar datos de demostración
npm run seo:optimize   # Optimizar SEO
npm run seo:sitemap    # Generar sitemap.xml
```

#### Frontend

```bash
npm start              # Iniciar en desarrollo
npm run build          # Compilar para producción
npm run serve          # Servir build de producción
npm run analyze        # Analizar tamaño del bundle
npm run lighthouse     # Ejecutar auditoría Lighthouse
```

## 📖 API Documentation

La documentación completa de la API está disponible en:

📄 **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)**

### Endpoints Principales

| Módulo | Endpoint Base | Descripción |
|--------|---------------|-------------|
| Autenticación | `/api/auth` | Login, registro, recuperación |
| Usuarios | `/api/usuarios` | Gestión de usuarios |
| Vehículos | `/api/vehiculos` | CRUD de vehículos |
| Estacionamiento | `/api/estacionamiento` | Control entrada/salida |
| Transacciones | `/api/transacciones` | Historial de movimientos |
| Comprobantes | `/api/comprobantes` | Comprobantes de pago |
| Facturación | `/api/facturador` | Facturación AFIP |
| Admin | `/api/admin` | Panel de administración |
| Precios | `/api/precios` | Configuración de tarifas |
| Perfil | `/api/perfil` | Datos del usuario |

### Colección de Postman

Importa la colección completa desde:
- [Descargar colección Postman](./docs/postman_collection.json) *(Próximamente)*

## 📁 Estructura del Proyecto

```
Estacionamiento-AED2/
├── backend/                    # Servidor Node.js
│   ├── certs/                  # Certificados AFIP
│   ├── config/                 # Configuraciones
│   │   ├── afip.js
│   │   ├── auth.js
│   │   └── db.js
│   ├── controllers/            # Lógica de negocio
│   │   ├── adminController.js
│   │   ├── authController.js
│   │   ├── comprobanteController.js
│   │   ├── estacionamientoController.js
│   │   ├── facturadorController.js
│   │   ├── perfilController.js
│   │   ├── precioController.js
│   │   ├── transaccionController.js
│   │   ├── usuarioController.js
│   │   └── vehiculoController.js
│   ├── middlewares/            # Middlewares personalizados
│   │   ├── authMiddleware.js
│   │   └── errorHandler.js
│   ├── models/                 # Modelos de Mongoose
│   │   ├── Comprobante.js
│   │   ├── ConfiguracionEmpresa.js
│   │   ├── ConfiguracionPrecio.js
│   │   ├── Estacionamiento.js
│   │   ├── Factura.js
│   │   ├── LogConfiguracionEmpresa.js
│   │   ├── LogPrecio.js
│   │   ├── LogSaldo.js
│   │   ├── LogVehiculo.js
│   │   ├── Transaccion.js
│   │   ├── Usuario.js
│   │   └── Vehiculo.js
│   ├── routes/                 # Definición de rutas
│   │   ├── admin.js
│   │   ├── analytics.js
│   │   ├── auditoria.js
│   │   ├── auth.js
│   │   ├── comprobantes.js
│   │   ├── configuracionEmpresa.js
│   │   ├── estacionamiento.js
│   │   ├── estacionamientoEstado.js
│   │   ├── facturador.js
│   │   ├── perfil.js
│   │   ├── precios.js
│   │   ├── seo.js
│   │   ├── transacciones.js
│   │   ├── usuarios.js
│   │   └── vehiculos.js
│   ├── scripts/                # Scripts de mantenimiento
│   ├── services/               # Servicios externos
│   │   └── afipFacturacionService.js
│   ├── utils/                  # Utilidades
│   │   ├── errorResponse.js
│   │   ├── fechaArgentina.js
│   │   ├── networkUtils.js
│   │   └── seedData.js
│   ├── .env.example            # Plantilla de variables de entorno
│   ├── package.json
│   └── server.js               # Punto de entrada
│
├── frontend/                   # Aplicación React
│   ├── public/
│   │   ├── index.html
│   │   ├── manifest.json
│   │   ├── robots.txt
│   │   └── sitemap.xml
│   ├── src/
│   │   ├── components/         # Componentes React
│   │   ├── config/             # Configuración frontend
│   │   ├── context/            # Context API (AuthContext)
│   │   ├── services/           # Servicios API
│   │   ├── styles/             # Estilos CSS
│   │   ├── utils/              # Utilidades frontend
│   │   ├── App.js
│   │   ├── index.js
│   │   └── sw.js               # Service Worker (PWA)
│   ├── package.json
│   └── config-overrides.js
│
├── API_DOCUMENTATION.md        # Documentación completa de la API
├── README.md                   # Este archivo
└── package.json                # Dependencias raíz (opcional)
```

## 🧪 Testing

### Testing Manual con Postman

1. Importar la colección de Postman
2. Configurar variables de entorno:
   - `baseUrl`: `http://localhost:3000/api`
   - `token`: (se obtiene tras login)
3. Ejecutar endpoints en orden:
   - Registro → Confirmar Email → Login
   - Obtener token y guardar en variable
   - Probar endpoints protegidos

### Ejemplos de Testing

#### Registro de Usuario

```bash
POST http://localhost:3000/api/auth/registrar-con-email
Content-Type: application/json

{
  "email": "test@ejemplo.com",
  "nombre": "Test",
  "apellido": "Usuario",
  "dni": "12345678"
}
```

#### Login

```bash
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "email": "test@ejemplo.com",
  "password": "password123"
}
```

#### Obtener Perfil (Requiere Token)

```bash
GET http://localhost:3000/api/perfil
Authorization: Bearer <tu_token_jwt>
```

## 🌐 Despliegue

### Vercel (Frontend)

```bash
cd frontend
npm install -g vercel
vercel
```

### Heroku (Backend)

```bash
cd backend
heroku create estacionamiento-backend
heroku addons:create mongolab
git push heroku main
```

### Railway (Full Stack)

1. Crear cuenta en [Railway](https://railway.app)
2. Conectar repositorio de GitHub
3. Configurar variables de entorno
4. Deploy automático

### Docker (Próximamente)

```bash
docker-compose up
```

## 🤝 Contribución

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

### Guía de Estilo

- Seguir las convenciones de código existentes
- Comentar código complejo
- Actualizar documentación si es necesario
- Escribir mensajes de commit descriptivos

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver archivo `LICENSE` para más detalles.

## 👥 Autores

- **Equipo de Desarrollo** - *Trabajo inicial*

## 🙏 Agradecimientos

- AFIP por la documentación de Web Services
- Comunidad de Node.js y React
- Todos los contribuidores del proyecto

## 📞 Soporte

Para reportar bugs o solicitar features:
- Crear un [Issue](https://github.com/tu-usuario/Estacionamiento-AED2/issues)
- Contactar al equipo de desarrollo

---

**Hecho con ❤️ en Argentina**
