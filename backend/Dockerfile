# ========================================
# Dockerfile - Backend Node.js
# ========================================

# Imagen base de Node.js 16 LTS (Long Term Support)
FROM node:16-alpine

# Instalar dependencias del sistema necesarias para bcrypt y otras librerías
RUN apk add --no-cache python3 make g++

# Información del mantenedor
LABEL maintainer="EstacionGian <info@estaciongian.com>"
LABEL description="Sistema de Estacionamiento - Backend API"

# Crear directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias primero (para aprovechar cache de Docker)
COPY package*.json ./

# Instalar dependencias de producción
RUN npm ci --only=production

# Copiar el resto del código
COPY . .

# Crear directorio para PDFs si no existe
RUN mkdir -p facturas_pdf

# Exponer el puerto del servidor
EXPOSE 3000

# Variables de entorno por defecto (se pueden sobrescribir)
ENV NODE_ENV=production
ENV PORT=3000

# Usuario no privilegiado para mayor seguridad
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Cambiar permisos de los directorios necesarios
RUN chown -R nodejs:nodejs /app

# Cambiar a usuario no root
USER nodejs

# Health check - Verificar que el servidor esté funcionando
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Comando para iniciar la aplicación
CMD ["node", "server.js"]
