# 📚 Guía de Buenas Prácticas - Sistema de Estacionamiento

## 🎯 Principios Generales

Este documento describe las buenas prácticas, convenciones de código y estándares aplicados en el proyecto.

## 🏗️ Arquitectura MVC

### Modelo (Model)

**Ubicación:** `backend/models/`

**Responsabilidades:**
- Definir esquemas de datos con Mongoose
- Validaciones a nivel de modelo
- Métodos de instancia y estáticos
- Hooks (pre/post)

**Buenas prácticas:**

```javascript
/**
 * @fileoverview Modelo de Usuario
 * @description Define el esquema y comportamiento de los usuarios del sistema
 */

const mongoose = require('mongoose');

/**
 * Esquema de Usuario
 * @typedef {Object} Usuario
 * @property {string} email - Email único del usuario
 * @property {string} password - Contraseña hasheada
 * @property {string} nombre - Nombre del usuario
 * @property {string} apellido - Apellido del usuario
 * @property {string} dni - DNI único
 * @property {number} saldo - Saldo disponible
 * @property {string} rol - Rol del usuario (admin/usuario)
 * @property {boolean} activo - Estado del usuario
 */
const usuarioSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'El email es requerido'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Email inválido']
  },
  // ... resto del esquema
}, {
  timestamps: true, // Agrega createdAt y updatedAt automáticamente
  collection: 'usuarios'
});

// Índices para mejorar performance
usuarioSchema.index({ email: 1 });
usuarioSchema.index({ dni: 1 });

// Método de instancia
usuarioSchema.methods.verificarPassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

// Método estático
usuarioSchema.statics.buscarPorDNI = function(dni) {
  return this.findOne({ dni, activo: true });
};

module.exports = mongoose.model('Usuario', usuarioSchema);
```

### Vista (View)

**Ubicación:** `frontend/src/components/`

**Responsabilidades:**
- Renderizar interfaz de usuario
- Manejar eventos del usuario
- Mostrar datos recibidos del controlador
- Validación básica de formularios

**Buenas prácticas:**

```javascript
/**
 * @fileoverview Componente de Login
 * @description Formulario de autenticación de usuarios
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../services/authService';

/**
 * Componente de Login
 * @component
 * @returns {JSX.Element} Formulario de login
 */
const Login = () => {
  // Estados
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();

  /**
   * Maneja el envío del formulario
   * @param {Event} e - Evento del formulario
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await login(formData);
      localStorage.setItem('token', response.token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.mensaje || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="login-form">
      {/* JSX del formulario */}
    </form>
  );
};

export default Login;
```

### Controlador (Controller)

**Ubicación:** `backend/controllers/`

**Responsabilidades:**
- Procesar peticiones HTTP
- Validar datos de entrada
- Invocar lógica de negocio
- Formatear respuestas
- Manejo de errores

**Buenas prácticas:**

```javascript
/**
 * @fileoverview Controlador de autenticación
 * @description Maneja las operaciones de login, registro y recuperación de contraseña
 */

const Usuario = require('../models/Usuario');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

/**
 * Inicia sesión de usuario
 * 
 * @async
 * @function login
 * @param {Object} req - Objeto de petición de Express
 * @param {Object} req.body - Cuerpo de la petición
 * @param {string} req.body.email - Email del usuario
 * @param {string} req.body.password - Contraseña del usuario
 * @param {Object} res - Objeto de respuesta de Express
 * @returns {Object} Respuesta JSON con token y datos del usuario
 * 
 * @example
 * POST /api/auth/login
 * {
 *   "email": "usuario@ejemplo.com",
 *   "password": "password123"
 * }
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validaciones
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        mensaje: 'Email y contraseña son requeridos'
      });
    }

    // Buscar usuario
    const usuario = await Usuario.findOne({ email, activo: true });
    if (!usuario) {
      return res.status(401).json({
        success: false,
        mensaje: 'Credenciales inválidas'
      });
    }

    // Verificar contraseña
    const passwordValido = await usuario.verificarPassword(password);
    if (!passwordValido) {
      return res.status(401).json({
        success: false,
        mensaje: 'Credenciales inválidas'
      });
    }

    // Generar token JWT
    const token = jwt.sign(
      { 
        id: usuario._id, 
        email: usuario.email,
        rol: usuario.rol 
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Respuesta exitosa
    res.status(200).json({
      success: true,
      mensaje: 'Login exitoso',
      token,
      usuario: {
        id: usuario._id,
        email: usuario.email,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        rol: usuario.rol,
        saldo: usuario.saldo
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error al iniciar sesión'
    });
  }
};

module.exports = { login };
```

## 🧹 Clean Code

### Nombres Descriptivos

**❌ Mal:**
```javascript
const d = new Date();
const usr = await User.find();
const x = saldo * 0.1;
```

**✅ Bien:**
```javascript
const fechaActual = new Date();
const usuarios = await Usuario.find();
const descuento = saldo * 0.1;
```

### Funciones Pequeñas y Específicas

**❌ Mal:**
```javascript
async function procesarEstacionamiento(req, res) {
  // 200 líneas de código haciendo muchas cosas
}
```

**✅ Bien:**
```javascript
async function iniciarEstacionamiento(req, res) {
  const vehiculo = await validarVehiculo(req.body.dominio);
  const usuario = await validarUsuario(req.body.dni);
  const saldo = await verificarSaldo(usuario);
  const estacionamiento = await crearEstacionamiento(vehiculo, usuario);
  return enviarRespuesta(res, estacionamiento);
}
```

### Evitar Números Mágicos

**❌ Mal:**
```javascript
if (usuario.saldo < 100) {
  // ...
}
```

**✅ Bien:**
```javascript
const SALDO_MINIMO_REQUERIDO = 100;

if (usuario.saldo < SALDO_MINIMO_REQUERIDO) {
  // ...
}
```

### Comentarios Útiles

**❌ Mal:**
```javascript
// Incrementar i
i++;

// Obtener usuario
const usuario = await Usuario.findById(id);
```

**✅ Bien:**
```javascript
/**
 * Incrementa el contador de intentos fallidos de login
 * Se resetea después de 24 horas o login exitoso
 */
usuario.intentosFallidos++;

/**
 * Busca el usuario en la base de datos
 * Lanza error si no existe o está inactivo
 */
const usuario = await Usuario.findById(id);
if (!usuario || !usuario.activo) {
  throw new Error('Usuario no encontrado');
}
```

## 🔒 Seguridad

### 1. Validación de Entrada

```javascript
// Siempre validar datos de entrada
const { email, password } = req.body;

if (!email || !password) {
  return res.status(400).json({ mensaje: 'Datos incompletos' });
}

// Validar formato de email
const emailRegex = /^\S+@\S+\.\S+$/;
if (!emailRegex.test(email)) {
  return res.status(400).json({ mensaje: 'Email inválido' });
}
```

### 2. Hash de Contraseñas

```javascript
// Nunca guardar contraseñas en texto plano
const bcrypt = require('bcryptjs');

// Al crear usuario
const salt = await bcrypt.genSalt(10);
usuario.password = await bcrypt.hash(password, salt);

// Al verificar
const esValida = await bcrypt.compare(passwordIngresada, usuario.password);
```

### 3. Tokens JWT

```javascript
// Usar secreto fuerte y expiración
const token = jwt.sign(
  { id: usuario._id },
  process.env.JWT_SECRET, // Guardar en .env, nunca hardcodear
  { expiresIn: '7d' }
);
```

### 4. Sanitización

```javascript
// Limpiar datos antes de guardar
const sanitizeHtml = require('sanitize-html');

usuario.nombre = sanitizeHtml(req.body.nombre, {
  allowedTags: [],
  allowedAttributes: {}
});
```

## 📝 Manejo de Errores

### Try-Catch en Async/Await

```javascript
async function obtenerUsuario(req, res) {
  try {
    const usuario = await Usuario.findById(req.params.id);
    
    if (!usuario) {
      return res.status(404).json({
        success: false,
        mensaje: 'Usuario no encontrado'
      });
    }
    
    res.json({ success: true, usuario });
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error al obtener usuario'
    });
  }
}
```

### Middleware de Errores

```javascript
// Usar middleware centralizado
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    mensaje: err.message || 'Error interno del servidor'
  });
});
```

## 🌐 API RESTful

### Convenciones de Nombres

```
GET    /api/usuarios          - Obtener todos los usuarios
GET    /api/usuarios/:id      - Obtener un usuario específico
POST   /api/usuarios          - Crear un usuario
PUT    /api/usuarios/:id      - Actualizar un usuario
DELETE /api/usuarios/:id      - Eliminar un usuario
```

### Códigos de Estado HTTP

```javascript
200 - OK (éxito general)
201 - Created (recurso creado)
204 - No Content (éxito sin contenido)
400 - Bad Request (datos inválidos)
401 - Unauthorized (no autenticado)
403 - Forbidden (no autorizado)
404 - Not Found (recurso no encontrado)
500 - Internal Server Error (error del servidor)
```

### Respuestas Consistentes

```javascript
// Éxito
{
  "success": true,
  "mensaje": "Operación exitosa",
  "data": { /* datos */ }
}

// Error
{
  "success": false,
  "mensaje": "Descripción del error",
  "errores": [ /* detalles */ ]
}
```

## 🎨 Frontend

### Estructura de Componentes

```javascript
// Componentes funcionales con hooks
import React, { useState, useEffect } from 'react';

const MiComponente = ({ prop1, prop2 }) => {
  // Estados
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  // Efectos
  useEffect(() => {
    cargarDatos();
  }, []);

  // Funciones
  const cargarDatos = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/data');
      const data = await response.json();
      setData(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Renderizado
  if (loading) return <div>Cargando...</div>;

  return (
    <div className="mi-componente">
      {data.map(item => (
        <div key={item.id}>{item.nombre}</div>
      ))}
    </div>
  );
};

export default MiComponente;
```

### CSS Modular

```css
/* Usar BEM (Block Element Modifier) */
.card {
  /* Bloque */
}

.card__header {
  /* Elemento */
}

.card--destacada {
  /* Modificador */
}
```

### Responsive Design

```css
/* Mobile first */
.contenedor {
  width: 100%;
  padding: 10px;
}

/* Tablet */
@media (min-width: 768px) {
  .contenedor {
    width: 750px;
    padding: 15px;
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .contenedor {
    width: 1000px;
    padding: 20px;
  }
}
```

## 🗄️ Base de Datos

### Nombres de Colecciones

```javascript
// Plural, minúsculas
usuarios
vehiculos
transacciones
comprobantes
```

### Índices

```javascript
// Crear índices para campos frecuentemente consultados
usuarioSchema.index({ email: 1 });
usuarioSchema.index({ dni: 1 });
usuarioSchema.index({ createdAt: -1 });

// Índices compuestos
estacionamientoSchema.index({ vehiculoDominio: 1, estado: 1 });
```

### Poblado (Populate)

```javascript
// Evitar N+1 queries
const transacciones = await Transaccion
  .find()
  .populate('usuario', 'nombre apellido dni')
  .populate('vehiculo', 'dominio marca modelo');
```

## 📊 Performance

### Paginación

```javascript
const page = parseInt(req.query.page) || 1;
const limit = parseInt(req.query.limit) || 10;
const skip = (page - 1) * limit;

const usuarios = await Usuario
  .find()
  .limit(limit)
  .skip(skip)
  .sort({ createdAt: -1 });

const total = await Usuario.countDocuments();

res.json({
  usuarios,
  pagina: page,
  totalPaginas: Math.ceil(total / limit),
  total
});
```

### Caching

```javascript
// Cachear resultados que no cambian frecuentemente
const cache = new Map();

async function obtenerPrecios() {
  if (cache.has('precios')) {
    return cache.get('precios');
  }

  const precios = await Precio.find();
  cache.set('precios', precios);
  
  // Limpiar cache después de 1 hora
  setTimeout(() => cache.delete('precios'), 3600000);
  
  return precios;
}
```

## 🧪 Testing

### Endpoints de Testing

```javascript
// Usar datos de prueba consistentes
const testUser = {
  email: 'test@ejemplo.com',
  password: 'Test123!',
  nombre: 'Test',
  apellido: 'Usuario',
  dni: '12345678'
};

// Limpiar después de cada test
afterEach(async () => {
  await Usuario.deleteMany({ email: testUser.email });
});
```

## 📦 Git

### Commits

```bash
# Formato: tipo(alcance): descripción

feat(auth): agregar recuperación de contraseña
fix(vehiculos): corregir validación de dominio
docs(api): actualizar documentación de endpoints
refactor(usuarios): optimizar consulta de saldo
style(frontend): mejorar responsive en móviles
test(auth): agregar tests de login
chore(deps): actualizar dependencias
```

### Branches

```bash
main              # Producción
develop           # Desarrollo
feature/nombre    # Nueva funcionalidad
fix/nombre        # Corrección de bug
hotfix/nombre     # Corrección urgente en producción
```

## 🚀 Despliegue

### Variables de Entorno

```bash
# NUNCA commitear .env
# Siempre usar .env.example como plantilla

# Producción debe tener:
NODE_ENV=production
JWT_SECRET=clave_super_segura_generada_aleatoriamente
MONGODB_URI=mongodb+srv://...
```

### Logs

```javascript
// Usar niveles de log apropiados
console.log('Información general');
console.info('Información importante');
console.warn('Advertencia');
console.error('Error');

// En producción, usar servicio de logs (Winston, Bunyan, etc.)
```

---

## ✅ Checklist de Calidad

Antes de hacer commit/push:

- [ ] El código sigue las convenciones del proyecto
- [ ] Hay comentarios JSDoc en funciones complejas
- [ ] No hay código comentado innecesario
- [ ] No hay console.log de debugging
- [ ] Las variables tienen nombres descriptivos
- [ ] Se manejan todos los errores posibles
- [ ] Las respuestas tienen formato consistente
- [ ] Se validaron los datos de entrada
- [ ] El código es responsive (frontend)
- [ ] Se probó manualmente la funcionalidad
- [ ] La documentación está actualizada

---

**Fecha de última actualización:** 7 de febrero de 2026
