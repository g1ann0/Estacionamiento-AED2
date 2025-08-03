// controllers/authController.js
const Usuario = require('../models/Usuario');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');

// Configuramos nodemailer (podés cambiar esto con tu propio mail SMTP)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'giancastellino44@gmail.com', // reemplazar con tu email
    pass: 'kyhdqanmmzijvbao'    // usar contraseña de app generada desde Gmail
  }
});

// REGISTRO - Paso 1: crear usuario y enviar correo de verificacion
const registrarConEmail = async (req, res) => {
  try {
    const { dni, nombre, apellido, email } = req.body;

    // Verificamos que el email no esté en uso por un usuario activo
    const existente = await Usuario.findOne({ email, activo: true });
    if (existente) {
      return res.status(400).json({ mensaje: 'Ya existe un usuario activo con ese email' });
    }

    // Verificamos que el DNI no esté en uso por un usuario activo
    const dniExistente = await Usuario.findOne({ dni, activo: true });
    if (dniExistente) {
      return res.status(400).json({ mensaje: 'Ya existe un usuario activo con ese DNI' });
    }

    // Si es el primer usuario activo => admin, si no => cliente
    const totalUsuarios = await Usuario.countDocuments({ activo: true });
    const rol = totalUsuarios === 0 ? 'admin' : 'cliente';

    // Generar token de verificación
    const tokenVerificacion = uuidv4();
    console.log('Generando nuevo token:', tokenVerificacion);

    const nuevoUsuario = new Usuario({
      dni,
      nombre,
      apellido,
      email,
      tokenVerificacion, // Aseguramos que el token se guarde
      verificado: false,
      rol
    });

    const usuarioGuardado = await nuevoUsuario.save();
    console.log('Usuario guardado con token:', usuarioGuardado.tokenVerificacion);
    // Link para el frontend (puerto 3001) - Esta URL debe coincidir con donde está corriendo tu aplicación React
    const link = `http://localhost:3001/setear-password?token=${tokenVerificacion}`;

    try {
      await transporter.sendMail({
        from: 'Estacionamiento <giancastellino44@gmail.com>',
        to: email,
        subject: 'Confirmá tu correo electrónico',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2c3e50;">¡Bienvenido al Sistema de Estacionamiento!</h2>
            <p>Hola ${nombre},</p>
            <p>Gracias por registrarte. Para completar tu registro, necesitás:</p>
            <ol>
              <li>Hacer clic en el enlace de abajo</li>
              <li>Establecer tu contraseña</li>
              <li>Iniciar sesión con tu email y la nueva contraseña</li>
            </ol>
            <p style="margin: 20px 0;">
              <a href="${link}" 
                 style="background-color: #3498db; 
                        color: white; 
                        padding: 10px 20px; 
                        text-decoration: none; 
                        border-radius: 5px;">
                Activar mi cuenta
              </a>
            </p>
            <p style="color: #7f8c8d; font-size: 0.9em;">
              Si no podés hacer clic en el botón, copiá y pegá este enlace en tu navegador:
              <br>
              ${link}
            </p>
          </div>`
      });
    } catch (mailError) {
      console.error('Error al enviar mail:', mailError);
      // Podés acá hacer algo extra, como enviar notificación a admin o loggear
    }

    res.status(201).json({ mensaje: 'Usuario registrado. Verificá tu correo electrónico.' });

  } catch (error) {
    console.error('Error al registrar usuario:', error);
    res.status(500).json({ mensaje: 'Error al registrar usuario con email', error });
  }
};


const confirmarEmail = async (req, res) => {
  try {
    const { token } = req.params;
    
    if (!token) {
      return res.status(400).json({
        mensaje: 'No se proporcionó token de verificación'
      });
    }

    const usuario = await Usuario.findOne({ 
      tokenVerificacion: token,
      verificado: false,  // Solo usuarios no verificados
      activo: true  // Solo usuarios activos
    });

    if (!usuario) {
      return res.status(404).json({
        mensaje: 'Token inválido o expirado'
      });
    }

    return res.status(200).json({
      mensaje: 'Token válido. Por favor, establece tu contraseña.',
      dni: usuario.dni
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      mensaje: 'Error interno del servidor'
    });
  }
};

const setearPassword = async (req, res) => {
  try {
    const { token, password, dni } = req.body;

    if (!token || !password || !dni) {
      return res.status(400).json({
        mensaje: 'Faltan datos requeridos'
      });
    }

    // Verificar si el usuario existe, tiene el token correcto, no está verificado y está activo
    const usuario = await Usuario.findOne({ 
      tokenVerificacion: token,
      dni: dni,
      verificado: false,
      activo: true
    });

    if (!usuario) {
      return res.status(404).json({
        mensaje: 'Token inválido, usuario no encontrado o cuenta ya verificada'
      });
    }

    // Hash de la contraseña y actualización del usuario
    const hash = await bcrypt.hash(password, 10);
    
    usuario.password = hash;
    usuario.verificado = true;
    usuario.tokenVerificacion = undefined; // Limpiamos el token
    
    await usuario.save();

    // No generamos token JWT aquí, el usuario deberá hacer login
    return res.status(200).json({
      mensaje: 'Contraseña establecida correctamente. Por favor, inicia sesión.',
      success: true
    });

  } catch (error) {
    console.error('Error en setearPassword:', error);
    return res.status(500).json({
      mensaje: 'Error interno del servidor'
    });
  }
};



// Paso 4: Login con email y contraseña
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const usuario = await Usuario.findOne({ email, activo: true });
    if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado o inactivo' });
    if (!usuario.verificado) return res.status(401).json({ mensaje: 'Correo no verificado' });

    const esValida = await bcrypt.compare(password, usuario.password);
    if (!esValida) return res.status(401).json({ mensaje: 'Contraseña incorrecta' });

    const token = jwt.sign({
      id: usuario._id,
      dni: usuario.dni,
      rol: usuario.rol,
      nombre: usuario.nombre,
      email: usuario.email
    }, process.env.JWT_SECRET, { expiresIn: '2h' });

    res.status(200).json({
      mensaje: 'Login exitoso',
      token,
      usuario: {
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        rol: usuario.rol,
        email: usuario.email,
        dni: usuario.dni
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ mensaje: 'Error en login', error });
  }
};

// RECUPERAR CONTRASEÑA - Paso 1: solicitar reset de contraseña
const solicitarRecuperacionPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ mensaje: 'Email es requerido' });
    }

    // Verificar que el usuario existe, está verificado y activo
    const usuario = await Usuario.findOne({ 
      email,
      verificado: true,  // Solo usuarios ya verificados pueden recuperar contraseña
      activo: true  // Solo usuarios activos
    });

    if (!usuario) {
      // Por seguridad, siempre respondemos OK aunque el email no exista
      return res.status(200).json({ 
        mensaje: 'Si el email existe, recibirás un enlace para recuperar tu contraseña' 
      });
    }

    // Generar token de recuperación
    const tokenRecuperacion = uuidv4();
    
    // Guardamos el token en el usuario
    usuario.tokenRecuperacion = tokenRecuperacion;
    usuario.fechaTokenRecuperacion = new Date();
    await usuario.save();

    // Link para recuperar contraseña
    const link = `http://localhost:3001/recuperar-password?token=${tokenRecuperacion}`;

    try {
      await transporter.sendMail({
        from: 'Estacionamiento <giancastellino44@gmail.com>',
        to: email,
        subject: 'Recuperar contraseña - Sistema de Estacionamiento',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2c3e50;">Recuperar Contraseña</h2>
            <p>Hola ${usuario.nombre},</p>
            <p>Recibimos una solicitud para recuperar tu contraseña.</p>
            <p>Si fuiste vos quien hizo esta solicitud, hacé clic en el enlace de abajo para crear una nueva contraseña:</p>
            <p style="margin: 20px 0;">
              <a href="${link}" 
                 style="background-color: #e74c3c; 
                        color: white; 
                        padding: 10px 20px; 
                        text-decoration: none; 
                        border-radius: 5px;">
                Recuperar mi contraseña
              </a>
            </p>
            <p style="color: #7f8c8d; font-size: 0.9em;">
              Si no podés hacer clic en el botón, copiá y pegá este enlace en tu navegador:
              <br>
              ${link}
            </p>
            <p style="color: #e74c3c; font-size: 0.9em;">
              <strong>Importante:</strong> Si no solicitaste este cambio, ignorá este mensaje. Tu contraseña actual seguirá siendo válida.
            </p>
          </div>`
      });
    } catch (mailError) {
      console.error('Error al enviar mail de recuperación:', mailError);
    }

    res.status(200).json({ 
      mensaje: 'Si el email existe, recibirás un enlace para recuperar tu contraseña' 
    });

  } catch (error) {
    console.error('Error al solicitar recuperación:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

// RECUPERAR CONTRASEÑA - Paso 2: validar token de recuperación
const validarTokenRecuperacion = async (req, res) => {
  try {
    const { token } = req.params;
    
    if (!token) {
      return res.status(400).json({
        mensaje: 'No se proporcionó token de recuperación'
      });
    }

    const usuario = await Usuario.findOne({ 
      tokenRecuperacion: token,
      verificado: true,
      activo: true
    });

    if (!usuario) {
      return res.status(404).json({
        mensaje: 'Token inválido o expirado'
      });
    }

    // Verificar que el token no sea muy viejo (ej: máximo 1 hora)
    const tiempoLimite = new Date();
    tiempoLimite.setHours(tiempoLimite.getHours() - 1);
    
    if (usuario.fechaTokenRecuperacion < tiempoLimite) {
      return res.status(400).json({
        mensaje: 'Token expirado. Solicita un nuevo enlace de recuperación.'
      });
    }

    return res.status(200).json({
      mensaje: 'Token válido. Puedes establecer tu nueva contraseña.',
      email: usuario.email
    });

  } catch (error) {
    console.error('Error al validar token:', error);
    res.status(500).json({
      mensaje: 'Error interno del servidor'
    });
  }
};

// RECUPERAR CONTRASEÑA - Paso 3: establecer nueva contraseña
const restablecerPassword = async (req, res) => {
  try {
    const { token, nuevaPassword } = req.body;

    if (!token || !nuevaPassword) {
      return res.status(400).json({
        mensaje: 'Token y nueva contraseña son requeridos'
      });
    }

    if (nuevaPassword.length < 6) {
      return res.status(400).json({
        mensaje: 'La contraseña debe tener al menos 6 caracteres'
      });
    }

    const usuario = await Usuario.findOne({ 
      tokenRecuperacion: token,
      verificado: true,
      activo: true
    });

    if (!usuario) {
      return res.status(404).json({
        mensaje: 'Token inválido o expirado'
      });
    }

    // Verificar que el token no sea muy viejo
    const tiempoLimite = new Date();
    tiempoLimite.setHours(tiempoLimite.getHours() - 1);
    
    if (usuario.fechaTokenRecuperacion < tiempoLimite) {
      return res.status(400).json({
        mensaje: 'Token expirado. Solicita un nuevo enlace de recuperación.'
      });
    }

    // Hashear la nueva contraseña
    const saltRounds = 10;
    const passwordHasheada = await bcrypt.hash(nuevaPassword, saltRounds);

    // Actualizar contraseña y limpiar tokens
    usuario.password = passwordHasheada;
    usuario.tokenRecuperacion = undefined;
    usuario.fechaTokenRecuperacion = undefined;
    
    await usuario.save();

    res.status(200).json({
      mensaje: 'Contraseña restablecida exitosamente. Ya puedes iniciar sesión.'
    });

  } catch (error) {
    console.error('Error al restablecer contraseña:', error);
    res.status(500).json({
      mensaje: 'Error interno del servidor'
    });
  }
};

module.exports = {
  registrarConEmail,
  confirmarEmail,
  setearPassword,
  login,
  solicitarRecuperacionPassword,
  validarTokenRecuperacion,
  restablecerPassword
};