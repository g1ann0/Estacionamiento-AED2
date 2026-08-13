// controllers/perfilController.js
const Usuario = require('../models/Usuario');
const bcrypt = require('bcryptjs');

// Obtener datos del perfil del usuario
const obtenerPerfil = async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.usuario.id).select('-password -tokenVerificacion -tokenRecuperacion');
    
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    res.json({
      mensaje: 'Perfil obtenido exitosamente',
      usuario
    });

  } catch (error) {
    console.error('Error al obtener perfil:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

// Actualizar datos básicos del perfil (nombre, apellido)
const actualizarDatosBasicos = async (req, res) => {
  try {
    const { nombre, apellido } = req.body;

    if (!nombre || !apellido) {
      return res.status(400).json({ mensaje: 'Nombre y apellido son requeridos' });
    }

    const usuario = await Usuario.findById(req.usuario.id);
    
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    // Actualizar solo los campos permitidos
    usuario.nombre = nombre.trim();
    usuario.apellido = apellido.trim();
    
    await usuario.save();

    // Retornar usuario sin campos sensibles
    const usuarioActualizado = await Usuario.findById(req.usuario.id).select('-password -tokenVerificacion -tokenRecuperacion');

    res.json({
      mensaje: 'Datos actualizados exitosamente',
      usuario: usuarioActualizado
    });

  } catch (error) {
    console.error('Error al actualizar datos básicos:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

// Cambiar contraseña
const cambiarContrasena = async (req, res) => {
  try {
    const { contrasenaActual, nuevaContrasena } = req.body;

    if (!contrasenaActual || !nuevaContrasena) {
      return res.status(400).json({ mensaje: 'Contraseña actual y nueva contraseña son requeridas' });
    }

    if (nuevaContrasena.length < 6) {
      return res.status(400).json({ mensaje: 'La nueva contraseña debe tener al menos 6 caracteres' });
    }

    const usuario = await Usuario.findById(req.usuario.id);
    
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    // Verificar contraseña actual
    const contrasenaValida = await bcrypt.compare(contrasenaActual, usuario.password);
    
    if (!contrasenaValida) {
      return res.status(400).json({ mensaje: 'La contraseña actual es incorrecta' });
    }

    // Verificar que la nueva contraseña sea diferente
    const mismaNueva = await bcrypt.compare(nuevaContrasena, usuario.password);
    
    if (mismaNueva) {
      return res.status(400).json({ mensaje: 'La nueva contraseña debe ser diferente a la actual' });
    }

    // Hashear nueva contraseña
    const saltRounds = 10;
    const nuevaContrasenaHasheada = await bcrypt.hash(nuevaContrasena, saltRounds);

    // Actualizar contraseña
    usuario.password = nuevaContrasenaHasheada;
    await usuario.save();

    res.json({
      mensaje: 'Contraseña cambiada exitosamente'
    });

  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

// El alta y la baja de vehículos viven en vehiculoController: el perfil solo maneja los
// datos de la persona. Acá quedaban las dos funciones comentadas de cuando los vehículos eran
// un array embebido en Usuario — un modelo que ya no existe.

module.exports = {
  obtenerPerfil,
  actualizarDatosBasicos,
  cambiarContrasena
};
