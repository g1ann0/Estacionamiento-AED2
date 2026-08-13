// controllers/authController.js
const Usuario = require('../models/Usuario');
const { randomUUID } = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// El transporte vive en services/mailService.js desde que el comprobante de estadía también
// se manda por mail: una sola configuración SMTP para todo el sistema.
const { transporter } = require('../services/mailService');
const { aTexto } = require('../utils/consultas');

// Los valores que entran a una consulta de autenticación se fuerzan a texto. El middleware
// global ya rechaza los operadores de Mongo; esto es el cinturón además del tirante, en el
// único lugar del sistema donde una consulta que se amplía de más significa entrar como otro.
const texto = (valor) => aTexto(valor).trim();

// Dónde vive el frontend. Estaba escrito a mano como `http://localhost:3001` dentro de cada
// mail: en cuanto el sistema deja la notebook del desarrollador, los links de verificación y
// de recuperación apuntan a la máquina de quien recibe el correo, y no funcionan.
const urlApp = () => (process.env.APP_URL || 'http://localhost:3001').replace(/\/+$/, '');
// El remitente también estaba fijo en el código, apuntando a una cuenta personal.
const remitente = () => process.env.SMTP_FROM || `Estacionamiento <${process.env.SMTP_USER || 'no-reply@estacionamiento.local'}>`;

// Mínimo de contraseña, igual en los tres caminos que la fijan (alta, recuperación y cambio
// desde el perfil). Antes `setearPassword` no validaba nada: se podía crear una cuenta con la
// contraseña "a".
const LARGO_MINIMO_PASSWORD = 6;

// REGISTRO - Paso 1: crear usuario y enviar correo de verificacion
const registrarConEmail = async (req, res) => {
  try {
    const { nombre, apellido } = req.body;
    const dni = texto(req.body?.dni);
    const email = texto(req.body?.email);

    if (!dni || !email) {
      return res.status(400).json({ mensaje: 'DNI y email son obligatorios' });
    }

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
    const tokenVerificacion = randomUUID();

    const nuevoUsuario = new Usuario({
      dni,
      nombre,
      apellido,
      email,
      tokenVerificacion, // Aseguramos que el token se guarde
      verificado: false,
      rol
    });

    await nuevoUsuario.save();
    const link = `${urlApp()}/setear-password?token=${tokenVerificacion}`;

    try {
      await transporter.sendMail({
        from: remitente(),
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
    // El objeto de error no vuelve al cliente: traía rutas, nombres de campos y a veces el
    // documento entero. Queda en el log del servidor, que es donde sirve.
    console.error('Error al registrar usuario:', error);
    res.status(500).json({ mensaje: 'Error al registrar usuario con email' });
  }
};


const confirmarEmail = async (req, res) => {
  try {
    const token = texto(req.params?.token);

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
    const { password } = req.body ?? {};
    const token = texto(req.body?.token);
    const dni = texto(req.body?.dni);

    if (!token || !password || !dni) {
      return res.status(400).json({
        mensaje: 'Faltan datos requeridos'
      });
    }

    if (typeof password !== 'string' || password.length < LARGO_MINIMO_PASSWORD) {
      return res.status(400).json({
        mensaje: `La contraseña debe tener al menos ${LARGO_MINIMO_PASSWORD} caracteres`
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
    const { password } = req.body ?? {};
    const email = texto(req.body?.email);
    const usuario = await Usuario.findOne({ email, activo: true });

    // Mismo mensaje y mismo código para "no existe" y "contraseña incorrecta". Antes el
    // primero devolvía 404 y el segundo 401, así que el login contestaba gratis la pregunta
    // "¿esta persona tiene cuenta acá?" — que es el primer paso de cualquier ataque dirigido.
    const credencialesInvalidas = () => res.status(401).json({ mensaje: 'Email o contraseña incorrectos' });

    if (!usuario || !usuario.password) return credencialesInvalidas();
    if (!usuario.verificado) return res.status(401).json({ mensaje: 'Correo no verificado' });

    const esValida = await bcrypt.compare(String(password ?? ''), usuario.password);
    if (!esValida) return credencialesInvalidas();

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
    res.status(500).json({ mensaje: 'Error en login' });
  }
};

// RECUPERAR CONTRASEÑA - Paso 1: solicitar reset de contraseña
const solicitarRecuperacionPassword = async (req, res) => {
  try {
    const email = texto(req.body?.email);

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
    const tokenRecuperacion = randomUUID();
    
    // Guardamos el token en el usuario
    usuario.tokenRecuperacion = tokenRecuperacion;
    usuario.fechaTokenRecuperacion = new Date();
    await usuario.save();

    // Link para recuperar contraseña
    const link = `${urlApp()}/recuperar-password?token=${tokenRecuperacion}`;

    try {
      await transporter.sendMail({
        from: remitente(),
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
    const token = texto(req.params?.token);

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
    
    // Sin fecha, el token se considera vencido. Con la comparación sola, un `undefined` daba
    // `false` —o sea "no venció"— y ese token vivía para siempre.
    if (!usuario.fechaTokenRecuperacion || usuario.fechaTokenRecuperacion < tiempoLimite) {
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
// Este era el agujero más grave del sistema. `token` entraba a la consulta tal cual venía del
// cuerpo, así que `{"token": {"$ne": null}}` no buscaba un token: encontraba al primer usuario
// con cualquier token de recuperación vivo y le cambiaba la contraseña. Toma de cuenta sin
// conocer un solo dato de la víctima. Ahora el valor se fuerza a texto acá, y el middleware
// global rechaza el operador antes incluso de llegar.
const restablecerPassword = async (req, res) => {
  try {
    const { nuevaPassword } = req.body ?? {};
    const token = texto(req.body?.token);

    if (!token || !nuevaPassword) {
      return res.status(400).json({
        mensaje: 'Token y nueva contraseña son requeridos'
      });
    }

    if (typeof nuevaPassword !== 'string' || nuevaPassword.length < LARGO_MINIMO_PASSWORD) {
      return res.status(400).json({
        mensaje: `La contraseña debe tener al menos ${LARGO_MINIMO_PASSWORD} caracteres`
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
    
    // Sin fecha, el token se considera vencido. Con la comparación sola, un `undefined` daba
    // `false` —o sea "no venció"— y ese token vivía para siempre.
    if (!usuario.fechaTokenRecuperacion || usuario.fechaTokenRecuperacion < tiempoLimite) {
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