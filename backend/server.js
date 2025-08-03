const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const { obtenerIPLocal, mostrarInfoRed } = require('./utils/networkUtils');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Escuchar en todas las interfaces de red
const LOCAL_IP = obtenerIPLocal();

// Middlewares
app.use(cors({
  origin: function (origin, callback) {
    // Permitir requests sin origin (como mobile apps o Postman)
    if (!origin) return callback(null, true);
    
    // Lista de orígenes permitidos
    const allowedOrigins = [
      'http://localhost:3001',
      `http://${LOCAL_IP}:3001`,
      'http://localhost:3000',
      `http://${LOCAL_IP}:3000`,
      'http://127.0.0.1:3001',
      'http://127.0.0.1:3000'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      // También permitir cualquier IP local en el rango 192.168.x.x o 10.x.x.x
      const localNetworkRegex = /^http:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+):300[01]$/;
      if (localNetworkRegex.test(origin)) {
        callback(null, true);
      } else {
        callback(new Error('No permitido por CORS'));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas principales
const authRoutes = require('./routes/auth');
const usuarioRoutes = require('./routes/usuarios');
const vehiculosRoutes = require('./routes/vehiculos');
const estacionamientoRoutes = require('./routes/estacionamiento');
const estacionamientoEstadoRoutes = require('./routes/estacionamientoEstado');
const transaccionesRoutes = require('./routes/transacciones');
const comprobantesRoutes = require('./routes/comprobantes');
const adminRoutes = require('./routes/admin');
const auditoriaRoutes = require('./routes/auditoria');
const preciosRoutes = require('./routes/precios');
const facturasRoutes = require('./routes/facturas');
const configuracionEmpresaRoutes = require('./routes/configuracionEmpresa');
const perfilRoutes = require('./routes/perfil');
const seoRoutes = require('./routes/seo');
const analyticsRoutes = require('./routes/analytics');

// Ruta de prueba
app.get('/', (req, res) => {
  res.send('Servidor funcionando 🚀');
});

// Registrar rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/vehiculos', vehiculosRoutes);
app.use('/api/transacciones', transaccionesRoutes);
app.use('/api/comprobantes', comprobantesRoutes);
app.use('/api/estacionamiento', estacionamientoRoutes);
app.use('/api/estacionamiento-estado', estacionamientoEstadoRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin', auditoriaRoutes);
app.use('/api/precios', preciosRoutes);
app.use('/api/facturas', facturasRoutes);
app.use('/api/configuracion-empresa', configuracionEmpresaRoutes);
app.use('/api/perfil', perfilRoutes);

// Rutas SEO y Analytics
app.use('/', seoRoutes);
app.use('/api/analytics', analyticsRoutes);

// Middleware para manejar rutas de API no encontradas
app.use('/api/*', (req, res) => {
  res.status(404).json({ mensaje: 'Ruta de API no encontrada' });
});

// Servir archivos estáticos del frontend en producción
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('../frontend/build'));
}

// Para cualquier otra ruta que no sea de la API, enviar el index.html
// Esto permite que el frontend maneje sus propias rutas
app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../frontend/build', 'index.html'));
});

// Middleware de manejo de errores
const errorHandler = require('./middlewares/errorHandler');
app.use(errorHandler);

// Conexión a MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(async () => {
  console.log('✅ Conectado a MongoDB');
  
  // Inicializar datos por defecto del sistema
  const { inicializarDatosPorDefecto } = require('./utils/seedData');
  await inicializarDatosPorDefecto();
})
.catch((err) => console.error('❌ Error de conexión a MongoDB:', err));

// Ruta de prueba
app.get('/', (req, res) => {
  res.send('Servidor funcionando 🚀');
});

// Servidor
app.listen(PORT, HOST, () => {
  console.log(`✅ Servidor iniciado correctamente`);
  mostrarInfoRed(PORT);
});
