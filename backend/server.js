const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const { obtenerIPLocal, mostrarInfoRed } = require('./utils/networkUtils');
require('dotenv').config();

const REQUERIDAS = ['JWT_SECRET', 'MONGODB_URI'];
const faltantes = REQUERIDAS.filter((clave) => !process.env[clave]);
if (faltantes.length > 0) {
  console.error(`❌ Faltan variables de entorno requeridas: ${faltantes.join(', ')}. Ver backend/.env.example.`);
  process.exit(1);
}
if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
  console.warn('⚠️  SMTP_USER/SMTP_PASS no configurados: el envío de emails (verificación, recuperación de contraseña) va a fallar.');
}

const app = express();
// Parser de query "simple": no anida `?campo[$ne]=x` en un objeto, así que un operador de
// Mongo no puede entrar por la URL. Es el default de Express 5, pero se fija acá de forma
// explícita porque de eso depende una defensa, no un detalle de formato.
app.set('query parser', 'simple');
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Escuchar en todas las interfaces de red
const LOCAL_IP = obtenerIPLocal();

// Middlewares
app.use(cors({
  origin: function (origin, callback) {
    // Permitir requests sin origin (como mobile apps o Postman)
    if (!origin) return callback(null, true);

    // Lista de orígenes permitidos. Los de red local cubren el uso en la playa; el dominio de
    // producción entra por CORS_ORIGINS (separados por coma), porque antes no había forma de
    // sumarlo sin editar este archivo — y una lista que no incluye al frontend real termina
    // "arreglándose" abriendo el CORS a cualquiera.
    const allowedOrigins = [
      'http://localhost:3001',
      `http://${LOCAL_IP}:3001`,
      'http://localhost:3000',
      `http://${LOCAL_IP}:3000`,
      'http://127.0.0.1:3001',
      'http://127.0.0.1:3000',
      ...(process.env.CORS_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean)
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
// Límite de tamaño del cuerpo: el default de Express es 100kb, pero explicitarlo deja escrito
// que ningún endpoint de esta API recibe documentos grandes (no hay subida de archivos).
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Antes de cualquier ruta: ningún operador de MongoDB entra por el request (ver el middleware
// para el caso concreto de toma de cuenta que cierra).
app.use(require('./middlewares/sanitizarConsulta'));

// Cabeceras de seguridad mínimas, sin dependencias: la API devuelve JSON y PDFs, no hay razón
// para que un navegador adivine tipos, muestre esto en un iframe ajeno o filtre el referrer.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

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
const turnosRoutes = require('./routes/turnos');
const cajasRoutes = require('./routes/cajas');
const estadiasRoutes = require('./routes/estadias');
const comprobantesEstadiaRoutes = require('./routes/comprobantesEstadia');
const sucursalesRoutes = require('./routes/sucursales');
const reportesRoutes = require('./routes/reportes');
const feriadosRoutes = require('./routes/feriados');

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
app.use('/api/admin/auditoria', auditoriaRoutes);
app.use('/api/precios', preciosRoutes);
app.use('/api/facturas', facturasRoutes);
app.use('/api/configuracion-empresa', configuracionEmpresaRoutes);
app.use('/api/perfil', perfilRoutes);
app.use('/api/turnos', turnosRoutes);
app.use('/api/cajas', cajasRoutes);
app.use('/api/estadias', estadiasRoutes);
app.use('/api/comprobantes-estadia', comprobantesEstadiaRoutes);
app.use('/api/sucursales', sucursalesRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/feriados', feriadosRoutes);

// Rutas SEO (superficie pública: home, login, registro)
app.use('/', seoRoutes);

// Middleware para manejar rutas de API no encontradas
// Express 5 cambió el motor de rutas (path-to-regexp v8): '/api/*' ya no es un patrón válido.
// Montado sobre '/api' y después de todos los routers, cumple la misma función de 404 de API
// sin depender de la sintaxis de comodines.
app.use('/api', (req, res) => {
  res.status(404).json({ mensaje: 'Ruta de API no encontrada' });
});

// Servir archivos estáticos del frontend en producción
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('../frontend/build'));
}

// Para cualquier otra ruta que no sea de la API, enviar el index.html: el frontend maneja
// sus propias rutas. En Express 5 el comodín tiene que ir nombrado ('*splat'); el '*' pelado
// que aceptaba Express 4 ahora hace fallar el arranque.
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../frontend/build', 'index.html'));
});

// Middleware de manejo de errores
const errorHandler = require('./middlewares/errorHandler');
app.use(errorHandler);

// Conexión a MongoDB. `useNewUrlParser`/`useUnifiedTopology` dejaron de existir: el driver
// moderno los rechaza como opciones desconocidas y la conexión fallaba en el arranque.
mongoose.connect(process.env.MONGODB_URI)
.then(async () => {
  console.log('✅ Conectado a MongoDB');
  
  // Inicializar datos por defecto del sistema
  const { inicializarDatosPorDefecto } = require('./utils/seedData');
  await inicializarDatosPorDefecto();

  // Worker de facturación electrónica. Arranca solo si ARCA está configurado; si no, avisa por
  // qué no y los comprobantes se siguen emitiendo como ticket no fiscal.
  require('./services/arca/worker').iniciar();
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
