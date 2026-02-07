# 🐳 Guía de Docker - Sistema de Estacionamiento

## Índice
1. [Introducción](#introducción)
2. [Prerequisitos](#prerequisitos)
3. [Arquitectura de Contenedores](#arquitectura-de-contenedores)
4. [Configuración](#configuración)
5. [Comandos Básicos](#comandos-básicos)
6. [Desarrollo con Docker](#desarrollo-con-docker)
7. [Producción](#producción)
8. [Troubleshooting](#troubleshooting)
9. [Mejores Prácticas](#mejores-prácticas)

---

## Introducción

Este proyecto utiliza **Docker** y **Docker Compose** para orquestar tres servicios principales:

- 🗄️ **MongoDB**: Base de datos NoSQL
- ⚙️ **Backend**: API REST con Node.js/Express
- 🌐 **Frontend**: Aplicación React con Nginx

### Ventajas de usar Docker

✅ **Consistencia**: Mismo entorno en desarrollo y producción  
✅ **Aislamiento**: Cada servicio en su propio contenedor  
✅ **Escalabilidad**: Fácil replicación y balanceo de carga  
✅ **Portabilidad**: "Funciona en mi máquina" → "Funciona en todas las máquinas"  
✅ **Despliegue rápido**: Levantar toda la infraestructura en segundos

---

## Prerequisitos

### Software Requerido

1. **Docker Desktop** (Windows/Mac) o **Docker Engine** (Linux)
   - Descargar desde: https://www.docker.com/products/docker-desktop
   - Versión mínima: Docker 20.10+
   - Docker Compose viene incluido en Docker Desktop

2. **Git** (para clonar el repositorio)

### Verificar Instalación

```bash
# Verificar Docker
docker --version
# Salida esperada: Docker version 20.10.x

# Verificar Docker Compose
docker-compose --version
# Salida esperada: Docker Compose version v2.x.x

# Verificar que Docker está corriendo
docker info
```

---

## Arquitectura de Contenedores

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Network                        │
│                  (estacionamiento-net)                   │
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   MongoDB   │  │   Backend   │  │  Frontend   │    │
│  │             │  │             │  │             │    │
│  │  Puerto:    │  │  Puerto:    │  │  Puerto:    │    │
│  │  27017      │◄─│  3000       │◄─│  80         │    │
│  │             │  │             │  │             │    │
│  │  Volumen:   │  │  Volumen:   │  │  Build:     │    │
│  │  mongo-data │  │  logs/      │  │  Multi-stage│    │
│  │             │  │  facturas/  │  │             │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Servicios

#### 1. MongoDB (`mongodb`)
- **Imagen**: `mongo:5`
- **Puerto**: `27017:27017`
- **Volumen**: `mongo-data` (persistencia de datos)
- **Variables de entorno**: `MONGO_INITDB_ROOT_USERNAME`, `MONGO_INITDB_ROOT_PASSWORD`

#### 2. Backend (`backend`)
- **Imagen**: Custom (construida desde `./backend/Dockerfile`)
- **Puerto**: `3000:3000`
- **Volúmenes**: 
  - `./backend/logs` (logs de aplicación)
  - `./backend/facturas_pdf` (facturas generadas)
- **Depende de**: `mongodb`
- **Health Check**: Verifica endpoint `/api/auth/verificar` cada 30s

#### 3. Frontend (`frontend`)
- **Imagen**: Custom multi-stage (build + nginx)
- **Puerto**: `80:80`
- **Depende de**: `backend`
- **Health Check**: Verifica conexión HTTP cada 30s

---

## Configuración

### 1. Variables de Entorno

Crea el archivo `.env` en la raíz del proyecto basándote en `.env.docker`:

```bash
# Copiar template
cp .env.docker .env

# Editar con tus valores
# Windows PowerShell
notepad .env

# Linux/Mac
nano .env
```

**Variables críticas a configurar:**

```env
# MongoDB
MONGO_INITDB_ROOT_USERNAME=admin
MONGO_INITDB_ROOT_PASSWORD=tu_password_seguro_aqui

# MongoDB URI para el backend
MONGODB_URI=mongodb://admin:tu_password_seguro_aqui@mongodb:27017/estacionamiento?authSource=admin

# JWT
JWT_SECRET=clave_secreta_jwt_muy_segura_cambiar_en_produccion

# Frontend - URL del backend
REACT_APP_API_URL=http://localhost:3000

# Google Analytics (opcional)
REACT_APP_GA_TRACKING_ID=G-XXXXXXXXXX

# AFIP (Facturación Argentina)
AFIP_CUIT=tu_cuit_aqui
AFIP_PUNTO_VENTA=1
```

### 2. Estructura de Archivos Docker

```
proyecto/
├── docker-compose.yml          # Orquestación de servicios
├── .env                        # Variables de entorno (NO SUBIR A GIT)
├── .env.docker                 # Template de variables
├── .dockerignore               # Archivos a ignorar en build
├── backend/
│   ├── Dockerfile             # Imagen del backend
│   ├── package.json
│   └── ...
└── frontend/
    ├── Dockerfile             # Imagen del frontend (multi-stage)
    ├── nginx.conf            # Configuración de Nginx
    ├── package.json
    └── ...
```

---

## Comandos Básicos

### Iniciar el Proyecto

```bash
# Construir imágenes y levantar servicios
docker-compose up --build

# Modo detached (segundo plano)
docker-compose up -d

# Ver logs en tiempo real
docker-compose logs -f

# Ver logs de un servicio específico
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mongodb
```

### Detener el Proyecto

```bash
# Detener servicios (mantiene volúmenes)
docker-compose down

# Detener y eliminar volúmenes (⚠️ BORRA DATOS DE BD)
docker-compose down -v

# Detener y eliminar imágenes también
docker-compose down --rmi all
```

### Gestión de Servicios

```bash
# Ver estado de los servicios
docker-compose ps

# Reiniciar un servicio específico
docker-compose restart backend

# Reconstruir un servicio específico
docker-compose build backend
docker-compose up -d backend

# Ejecutar comando en un contenedor
docker-compose exec backend npm install winston
docker-compose exec mongodb mongosh
```

### Logs y Debugging

```bash
# Ver logs de todos los servicios
docker-compose logs

# Últimas 100 líneas del backend
docker-compose logs --tail=100 backend

# Seguir logs en tiempo real con timestamps
docker-compose logs -f -t backend

# Entrar a un contenedor (shell interactivo)
docker-compose exec backend sh
docker-compose exec mongodb mongosh

# Ver recursos utilizados
docker stats
```

---

## Desarrollo con Docker

### Hot Reload en Desarrollo

Para desarrollo local con recarga automática, modifica `docker-compose.yml`:

```yaml
backend:
  volumes:
    - ./backend:/app
    - /app/node_modules  # No sobrescribir node_modules
  command: npm run dev  # Usar nodemon para hot reload
```

### Instalar Dependencias

```bash
# Backend
docker-compose exec backend npm install nombre-paquete

# Reconstruir si hay cambios en package.json
docker-compose build backend
docker-compose up -d backend
```

### Acceder a MongoDB

```bash
# Shell de MongoDB
docker-compose exec mongodb mongosh

# Conectarse a la BD específica
mongosh "mongodb://admin:password@localhost:27017/estacionamiento?authSource=admin"

# Importar datos
docker-compose exec -T mongodb mongosh < backup.json
```

### Ver Logs de la Aplicación

Los logs del backend se guardan en:
- `backend/logs/combined.log` - Todos los logs
- `backend/logs/error.log` - Solo errores

```bash
# Seguir logs de la aplicación
tail -f backend/logs/combined.log

# En Windows PowerShell
Get-Content backend/logs/combined.log -Wait
```

---

## Producción

### Build Optimizado

```bash
# Producción con optimizaciones
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# O configurar NODE_ENV
NODE_ENV=production docker-compose up --build -d
```

### Consideraciones de Producción

#### 1. Seguridad

```yaml
# docker-compose.prod.yml
services:
  backend:
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=error  # Solo errores en producción
    restart: always
    
  mongodb:
    volumes:
      - mongo-data:/data/db
    restart: always
    # NO exponer puerto 27017 públicamente
```

#### 2. Escalado Horizontal

```bash
# Escalar backend a 3 instancias
docker-compose up -d --scale backend=3

# Requiere configurar load balancer (nginx, traefik)
```

#### 3. Backups de MongoDB

```bash
# Crear backup
docker-compose exec -T mongodb mongodump --archive > backup-$(date +%Y%m%d).archive

# Restaurar backup
docker-compose exec -T mongodb mongorestore --archive < backup-20240101.archive
```

#### 4. Volúmenes en Producción

```yaml
volumes:
  mongo-data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /mnt/data/mongodb  # Disco persistente
```

---

## Troubleshooting

### Problema: Contenedores no inician

```bash
# Ver logs detallados
docker-compose logs

# Verificar configuración
docker-compose config

# Limpiar todo y empezar de nuevo
docker-compose down -v
docker-compose up --build
```

### Problema: Puerto ya en uso

```bash
# Ver qué proceso usa el puerto 3000
netstat -ano | findstr :3000   # Windows
lsof -i :3000                   # Linux/Mac

# Cambiar puerto en docker-compose.yml
ports:
  - "3001:3000"  # Puerto externo:Puerto interno
```

### Problema: MongoDB no conecta

```bash
# Verificar que MongoDB está corriendo
docker-compose ps mongodb

# Ver logs de MongoDB
docker-compose logs mongodb

# Probar conexión manual
docker-compose exec backend node -e "const mongoose = require('mongoose'); mongoose.connect(process.env.MONGODB_URI).then(() => console.log('OK')).catch(console.error)"
```

### Problema: Cambios no se reflejan

```bash
# Reconstruir sin caché
docker-compose build --no-cache backend

# Forzar recreación
docker-compose up -d --force-recreate backend
```

### Problema: Espacio en disco

```bash
# Limpiar contenedores detenidos
docker container prune

# Limpiar imágenes no usadas
docker image prune -a

# Limpiar todo (⚠️ CUIDADO)
docker system prune -a --volumes
```

### Problema: Permisos (Linux)

```bash
# Agregar usuario al grupo docker
sudo usermod -aG docker $USER

# Logout y login para aplicar cambios
```

---

## Mejores Prácticas

### 1. `.dockerignore`

Siempre incluir archivos innecesarios:

```
node_modules
npm-debug.log
.git
.env
*.log
coverage
.vscode
```

### 2. Multi-Stage Builds

El frontend usa multi-stage para optimizar tamaño:

```dockerfile
# Stage 1: Build
FROM node:16-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production
FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
```

### 3. Health Checks

Configurar health checks para monitoreo:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/api/auth/verificar"]
  interval: 30s
  timeout: 10s
  retries: 3
```

### 4. Variables de Entorno

- ✅ Usar `.env` para configuración local
- ✅ Nunca subir `.env` a git
- ✅ Documentar variables en `.env.docker`
- ❌ No hardcodear secretos en Dockerfiles

### 5. Volúmenes

```yaml
volumes:
  # Named volume (persistente)
  - mongo-data:/data/db
  
  # Bind mount (desarrollo)
  - ./backend/logs:/app/logs
  
  # Anonymous volume (evitar sobrescritura)
  - /app/node_modules
```

### 6. Logs

```bash
# Configurar log driver
services:
  backend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

---

## Recursos Adicionales

### Documentación Oficial
- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose](https://docs.docker.com/compose/)
- [Dockerfile Best Practices](https://docs.docker.com/develop/dev-best-practices/)

### Comandos de Referencia Rápida

```bash
# Build
docker-compose build
docker-compose build --no-cache

# Start
docker-compose up
docker-compose up -d
docker-compose up --build

# Stop
docker-compose down
docker-compose stop

# Logs
docker-compose logs -f
docker-compose logs -f <service>

# Execute
docker-compose exec <service> <command>

# Scale
docker-compose up -d --scale <service>=<count>

# Clean
docker system prune -a
```

---

## Contacto y Soporte

Para problemas relacionados con Docker en este proyecto:

1. Verificar logs: `docker-compose logs`
2. Consultar esta documentación
3. Revisar issues en el repositorio
4. Contactar al equipo de desarrollo

---

**Última actualización**: 2024
**Versión de Docker**: 20.10+
**Versión de Docker Compose**: v2+
