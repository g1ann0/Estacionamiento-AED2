/**
 * @fileoverview Servidor principal del Sistema de Estacionamiento
 * @description Implementa la arquitectura MVC con Express.js y MongoDB
 * @author Sistema de Estacionamiento
 * @version 1.0.0
 * @license MIT
 */

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const { obtenerIPLocal, mostrarInfoRed } = require('./utils/networkUtils');
const logger = require('./utils/logger');
const requestLogger = require('./middlewares/requestLogger');
require('dotenv').config();

// Inicialización de la aplicación Express
const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Escuchar en todas las interfaces de red para acceso local
const LOCAL_IP = obtenerIPLocal();

/**
 * ===================================
 * MIDDLEWARES GLOBALES
 * ===================================
 */

/**
 * Configuración de CORS (Cross-Origin Resource Sharing)
 * Permite peticiones desde el frontend y dispositivos móviles en la red local
 */
app.use(cors({
  origin: function (origin, callback) {
    // Permitir requests sin origin (como mobile apps, Postman, Thunder Client)
    if (!origin) return callback(null, true);
    
    // Lista de orígenes permitidos en desarrollo
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
      // También permitir cualquier IP local en el rango 192.168.x.x, 10.x.x.x o 172.16-31.x.x
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

// Parser de JSON para body de peticiones
app.use(express.json());

// Parser de datos de formularios URL-encoded
app.use(express.urlencoded({ extended: true }));

// Middleware de logging de peticiones HTTP
// DEBE IR ANTES DE LAS RUTAS para capturar todas las peticiones
app.use(requestLogger);

/**
 * ===================================
 * IMPORTACIÓN DE RUTAS (Modelo-Vista-Controlador)
 * ===================================
 */

// Autenticación y gestión de usuarios
const authRoutes = require('./routes/auth');
const usuarioRoutes = require('./routes/usuarios');
const perfilRoutes = require('./routes/perfil');

// Gestión de vehículos y estacionamiento
const vehiculosRoutes = require('./routes/vehiculos');
const estacionamientoRoutes = require('./routes/estacionamiento');
const estacionamientoEstadoRoutes = require('./routes/estacionamientoEstado');

// Transacciones y comprobantes
const transaccionesRoutes = require('./routes/transacciones');
const comprobantesRoutes = require('./routes/comprobantes');

// Facturación AFIP
const facturadorRoutes = require('./routes/facturador');
const afipRoutes = require('./routes/afip');

// Administración
const adminRoutes = require('./routes/admin');
const auditoriaRoutes = require('./routes/auditoria');
const preciosRoutes = require('./routes/precios');
const configuracionEmpresaRoutes = require('./routes/configuracionEmpresa');

// SEO y Analytics
const seoRoutes = require('./routes/seo');
const analyticsRoutes = require('./routes/analytics');

/**
 * ===================================
 * RUTAS PÚBLICAS
 * ===================================
 */

/**
 * Ruta de prueba - Health check del servidor
 * @route GET /
 * @returns {string} Mensaje de confirmación del servidor
 */
app.get('/', (req, res) => {
  res.send('Servidor funcionando 🚀');
});

/**
 * ===================================
 * REGISTRO DE RUTAS DE LA API
 * ===================================
 */

// Autenticación (Login, registro, recuperación de contraseña)
app.use('/api/auth', authRoutes);

// Gestión de usuarios
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/perfil', perfilRoutes);

// Gestión de vehículos
app.use('/api/vehiculos', vehiculosRoutes);

// Gestión de estacionamiento
app.use('/api/estacionamiento', estacionamientoRoutes);
app.use('/api/estacionamiento-estado', estacionamientoEstadoRoutes);

// Transacciones y comprobantes
app.use('/api/transacciones', transaccionesRoutes);
app.use('/api/comprobantes', comprobantesRoutes);

// Facturación electrónica AFIP
app.use('/api/facturador', facturadorRoutes);

// Servicios AFIP (consulta padrón, validaciones)
app.use('/api/afip', afipRoutes);

// Administración (requiere rol admin)
app.use('/api/admin', adminRoutes);
app.use('/api/admin', auditoriaRoutes);

// Configuración de precios y empresa
app.use('/api/precios', preciosRoutes);
app.use('/api/configuracion-empresa', configuracionEmpresaRoutes);

// Rutas de SEO y Analytics
app.use('/', seoRoutes);
app.use('/api/analytics', analyticsRoutes);

/**
 * ===================================
 * MANEJO DE RUTAS NO ENCONTRADAS
 * ===================================
 */

/**
 * Middleware para capturar rutas de API no encontradas
 * Debe estar después de todas las rutas de la API
 */
app.use('/api/*', (req, res) => {
  res.status(404).json({ 
    success: false,
    mensaje: 'Ruta de API no encontrada',
    ruta: req.originalUrl
  });
});

/**
 * ===================================
 * SERVIR FRONTEND EN PRODUCCIÓN
 * ===================================
 */

// Servir archivos estáticos del frontend en producción
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/build')));
  
  /**
   * Para cualquier otra ruta que no sea de la API, enviar el index.html
   * Esto permite que React Router maneje las rutas del frontend (SPA)
   */
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../frontend/build', 'index.html'));
  });
}

/**
 * ===================================
 * MIDDLEWARE DE MANEJO DE ERRORES
 * ===================================
 */

// Middleware centralizado para manejo de errores
const errorHandler = require('./middlewares/errorHandler');
app.use(errorHandler);

/**
 * ===================================
 * CONEXIÓN A BASE DE DATOS
 * ===================================
 */

/**
 * Conecta a MongoDB usando Mongoose
 * Inicializa los datos por defecto del sistema después de la conexión
 */
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(async () => {
  logger.logSuccess('Conectado a MongoDB', { 
    database: process.env.MONGODB_URI?.split('@')[1] || 'mongodb' 
  });
  
  // Inicializar datos por defecto del sistema (precios, configuración, etc.)
  const { inicializarDatosPorDefecto } = require('./utils/seedData');
  await inicializarDatosPorDefecto();
})
.catch((err) => {
  logger.logError('Error de conexión a MongoDB', err);
  process.exit(1);
});

/**
 * ===================================
 * INICIAR SERVIDOR
 * ===================================
 */

/**
 * Inicia el servidor Express en el puerto y host especificados
 * Muestra información de red para acceso desde diferentes dispositivos
 */
app.listen(PORT, HOST, () => {
  logger.logSuccess('Servidor iniciado correctamente', {
    port: PORT,
    host: HOST,
    localIP: LOCAL_IP,
    environment: process.env.NODE_ENV || 'development'
  });
  mostrarInfoRed(PORT);
});
