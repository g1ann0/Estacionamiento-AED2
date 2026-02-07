# ========================================
# Dockerfile - Frontend React
# ========================================

# Etapa 1: Build
FROM node:16-alpine AS builder

LABEL maintainer="EstacionGian <info@estaciongian.com>"
LABEL description="Sistema de Estacionamiento - Frontend React"

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm ci

# Copiar el código fuente
COPY . .

# Construir la aplicación para producción
RUN npm run build

# Etapa 2: Producción
FROM nginx:alpine

# Copiar archivos compilados desde la etapa de build
COPY --from=builder /app/build /usr/share/nginx/html

# Copiar configuración personalizada de nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Exponer puerto 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# Comando por defecto de nginx
CMD ["nginx", "-g", "daemon off;"]
