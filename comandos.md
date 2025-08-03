# COMANDOS Y SCRIPTS DEL SISTEMA DE ESTACIONAMIENTO

---

## COMANDOS PRINCIPALES DE DESARROLLO

### **Instalación Inicial**
```bash
# Instalar dependencias del backend
cd backend
npm install

# Instalar dependencias del frontend
cd ../frontend
npm install
```

### **Ejecución del Sistema**
```bash
# Ejecutar backend (Puerto 3000)
cd backend
npm start
# o en modo desarrollo con nodemon:
npm run dev

# Ejecutar frontend (Puerto 3001)
cd frontend
npm start
```

### **Build para Producción**
```bash
# Construir frontend para producción
cd frontend
npm run build

# El frontend compilado se guarda en frontend/build/
```

---

## SCRIPTS DE BASE DE DATOS (Backend)

### **Setup y Configuración Inicial**
```bash
cd backend

# Configurar sistema completo (primera vez)
node scripts/setupSystem.js

# Limpiar completamente la base de datos
node scripts/limpiarBaseDatos.js

# Limpiar solo datos de prueba
node scripts/clean.js
```

### **Migraciones y Mantenimiento**
```bash
# Migrar transacciones existentes
node scripts/migracionTransacciones.js

# Migrar usuarios a estado activo
node scripts/migracionUsuariosActivos.js
```

---

## COMANDOS DE TESTING

### **Backend Testing**
```bash
cd backend

# Ejecutar test de perfil de usuario
node testPerfil.js

# Ejecutar test de recuperación de contraseña
node testRecuperacion.js
```

### **Frontend Testing**
```bash
cd frontend

# Ejecutar todos los tests del frontend
npm test

# Ejecutar tests con coverage
npm run test:coverage

# También disponible archivo batch:
test-frontend.bat
```

---

## COMANDOS DE DESARROLLO Y DEBUG

### **Logs y Monitoreo**
```bash
# Ver logs del backend en tiempo real
cd backend
npm run logs

# Verificar estado de la base de datos
node -e "
const mongoose = require('mongoose');
require('./config/db');
mongoose.connection.on('connected', () => {
  console.log('✅ Base de datos conectada');
  process.exit(0);
});
"
```

### **Verificar Configuración**
```bash
# Verificar variables de entorno
cd backend
node -e "
console.log('Puerto:', process.env.PORT || 3000);
console.log('MongoDB:', process.env.MONGODB_URI || 'mongodb://localhost:27017/estacionamiento');
console.log('JWT Secret:', process.env.JWT_SECRET ? '✅ Configurado' : '❌ No configurado');
"
```

---

## SCRIPTS ESPECÍFICOS DEL SISTEMA

### **Gestión de Usuarios**
```bash
# Crear usuario administrador
node -e "
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Usuario = require('./models/Usuario');
require('./config/db');

async function crearAdmin() {
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const admin = new Usuario({
    dni: '00000000',
    nombre: 'Administrador',
    apellido: 'Sistema',
    email: 'admin@estacionamiento.com',
    password: hashedPassword,
    rol: 'admin',
    asociado: true
  });
  await admin.save();
  console.log('✅ Admin creado');
  process.exit(0);
}
crearAdmin().catch(console.error);
"
```

### **Gestión de Precios**
```bash
# Configurar precios iniciales
node -e "
const mongoose = require('mongoose');
const ConfiguracionPrecio = require('./models/ConfiguracionPrecio');
require('./config/db');

async function configurarPrecios() {
  await ConfiguracionPrecio.findOneAndUpdate(
    { tipoUsuario: 'asociado' },
    { precioPorHora: 250, activo: true },
    { upsert: true }
  );
  await ConfiguracionPrecio.findOneAndUpdate(
    { tipoUsuario: 'no_asociado' },
    { precioPorHora: 500, activo: true },
    { upsert: true }
  );
  console.log('✅ Precios configurados');
  process.exit(0);
}
configurarPrecios().catch(console.error);
"
```

---

## COMANDOS DE MANTENIMIENTO

### **Backup y Restauración**
```bash
# Crear backup de MongoDB
mongodump --db estacionamiento --out ./backups/$(date +%Y%m%d_%H%M%S)

# Restaurar backup
mongorestore --db estacionamiento ./backups/[FECHA]/estacionamiento/
```

### **Limpieza de Logs**
```bash
# Limpiar logs antiguos (más de 30 días)
find ./logs -name "*.log" -type f -mtime +30 -delete

# Rotar logs manualmente
node -e "
const fs = require('fs');
const logFile = './logs/sistema.log';
if (fs.existsSync(logFile)) {
  const fecha = new Date().toISOString().split('T')[0];
  fs.renameSync(logFile, \`./logs/sistema_\${fecha}.log\`);
  console.log('✅ Log rotado');
}
"
```

### **Verificar Integridad de Datos**
```bash
# Verificar usuarios sin vehículos
node -e "
const mongoose = require('mongoose');
const Usuario = require('./models/Usuario');
const Vehiculo = require('./models/Vehiculo');
require('./config/db');

async function verificarIntegridad() {
  const usuarios = await Usuario.find({ activo: true });
  for (let usuario of usuarios) {
    const vehiculos = await Vehiculo.find({ usuarioDni: usuario.dni });
    console.log(\`Usuario \${usuario.dni}: \${vehiculos.length} vehículos\`);
  }
  process.exit(0);
}
verificarIntegridad().catch(console.error);
"
```

---

## COMANDOS DE DESARROLLO RÁPIDO

### **Reinicio Completo del Sistema**
```bash
# Script completo para reiniciar todo
#!/bin/bash
echo "🔄 Reiniciando sistema completo..."

# Parar procesos
pkill -f "node.*server.js"
pkill -f "npm.*start"

# Limpiar base de datos
cd backend
node scripts/limpiarBaseDatos.js

# Setup inicial
node scripts/setupSystem.js

# Iniciar backend
npm run dev &

# Esperar un poco
sleep 3

# Iniciar frontend
cd ../frontend
npm start &

echo "✅ Sistema reiniciado completamente"
```

### **Verificación Rápida del Estado**
```bash
# Script para verificar que todo funciona
#!/bin/bash
echo "🔍 Verificando estado del sistema..."

# Verificar backend
curl -s http://localhost:3000/api/health && echo "✅ Backend OK" || echo "❌ Backend Error"

# Verificar frontend
curl -s http://localhost:3001 > /dev/null && echo "✅ Frontend OK" || echo "❌ Frontend Error"

# Verificar MongoDB
mongosh --eval "db.adminCommand('ping')" --quiet && echo "✅ MongoDB OK" || echo "❌ MongoDB Error"
```

---

## COMANDOS ÚTILES DE MONGODB

### **Consultas Directas**
```bash
# Conectar a MongoDB
mongosh estacionamiento

# Ver colecciones
show collections

# Contar documentos
db.usuarios.countDocuments()
db.vehiculos.countDocuments()
db.estacionamientos.countDocuments()

# Ver usuarios activos
db.usuarios.find({activo: true}).pretty()

# Ver estacionamientos activos
db.estacionamientos.find({activo: true}).pretty()

# Ver comprobantes pendientes
db.comprobantes.find({estado: "pendiente"}).pretty()
```

### **Operaciones de Limpieza**
```bash
# Eliminar todos los estacionamientos
db.estacionamientos.deleteMany({})

# Eliminar comprobantes rechazados
db.comprobantes.deleteMany({estado: "rechazado"})

# Resetear saldos de usuarios
db.usuarios.updateMany({}, {$set: {montoDisponible: 0}})
```

---

## NOTAS IMPORTANTES

- **Puerto Backend**: 3000 (configurable en .env)
- **Puerto Frontend**: 3001 (desarrollo) / 80 (producción)
- **Base de Datos**: MongoDB en puerto 27017
- **Logs**: Se guardan en `backend/logs/`
- **Backups**: Recomendado diario con mongodump
- **Variables de Entorno**: Configurar en `backend/.env`

### **Variables de Entorno Requeridas (.env)**
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/estacionamiento
JWT_SECRET=tu_secret_muy_seguro_aqui
NODE_ENV=development
REACT_APP_API_URL=http://localhost:3000/api
REACT_APP_SITE_URL=http://localhost:3001
```

---

## OPTIMIZACIONES SEO IMPLEMENTABLES

### **1. Configurar React Router para URLs amigables**
```bash
cd frontend

# Instalar dependencias para SEO
npm install react-helmet-async react-router-dom

# Configurar rutas sin hash
# En App.js cambiar HashRouter por BrowserRouter
```

### **2. Implementar metadatos dinámicos**
```bash
# Agregar componente SEO a cada página
# frontend/src/components/SEO.jsx
cat > src/components/SEO.jsx << 'EOF'
import { Helmet } from 'react-helmet-async';

const SEO = ({ title, description, keywords, canonical }) => (
  <Helmet>
    <title>{title} | Sistema de Estacionamiento</title>
    <meta name="description" content={description} />
    <meta name="keywords" content={keywords} />
    <link rel="canonical" href={canonical} />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:type" content="website" />
  </Helmet>
);
export default SEO;
EOF
```

### **3. Crear sitemap.xml automático**
```bash
cd backend

# Generar sitemap dinámico
node -e "
const fs = require('fs');
const sitemap = \`<?xml version='1.0' encoding='UTF-8'?>
<urlset xmlns='http://www.sitemaps.org/schemas/sitemap/0.9'>
  <url>
    <loc>https://tu-dominio.com/</loc>
    <lastmod>\${new Date().toISOString()}</lastmod>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://tu-dominio.com/login</loc>
    <lastmod>\${new Date().toISOString()}</lastmod>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://tu-dominio.com/register</loc>
    <lastmod>\${new Date().toISOString()}</lastmod>
    <priority>0.8</priority>
  </url>
</urlset>\`;
fs.writeFileSync('public/sitemap.xml', sitemap);
console.log('✅ Sitemap generado');
"
```

### **4. Configurar robots.txt**
```bash
cd frontend/public

# Crear robots.txt optimizado
cat > robots.txt << 'EOF'
User-agent: *
Allow: /
Allow: /login
Allow: /register
Disallow: /dashboard
Disallow: /admin
Sitemap: https://tu-dominio.com/sitemap.xml
EOF
```

### **5. Implementar PWA (Progressive Web App)**
```bash
cd frontend

# Agregar service worker para PWA
npm install workbox-webpack-plugin

# Configurar manifest.json mejorado
cat > public/manifest.json << 'EOF'
{
  "short_name": "Estacionamiento",
  "name": "Sistema de Gestión de Estacionamiento",
  "description": "Plataforma digital para gestión de estacionamientos universitarios",
  "icons": [
    {
      "src": "favicon.ico",
      "sizes": "64x64 32x32 24x24 16x16",
      "type": "image/x-icon"
    }
  ],
  "start_url": ".",
  "display": "standalone",
  "theme_color": "#000000",
  "background_color": "#ffffff",
  "categories": ["productivity", "utilities"]
}
EOF
```

### **6. Optimizar performance**
```bash
# Analizar bundle size
cd frontend
npm run build
npx bundle-analyzer build/static/js/*.js

# Implementar lazy loading
# En componentes principales:
# const Dashboard = lazy(() => import('./components/Dashboard'));
```

### **7. Configurar HTTPS para producción**
```bash
# Instalar certificado SSL (Let's Encrypt)
sudo apt install certbot nginx
sudo certbot --nginx -d tu-dominio.com

# Configurar redirección HTTP -> HTTPS
```
