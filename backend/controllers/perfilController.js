// controllers/perfilController.js
const Usuario = require('../models/Usuario');
const bcrypt = require('bcrypt');

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

// FUNCIÓN DESHABILITADA - Agregar vehículo se hace desde Dashboard
// Agregar vehículo al perfil
/*
const agregarVehiculo = async (req, res) => {
  try {
    const { dominio, tipo, marca, modelo, año } = req.body;

    if (!dominio || !tipo || !marca || !modelo || !año) {
      return res.status(400).json({ mensaje: 'Todos los campos del vehículo son requeridos' });
    }

    const usuario = await Usuario.findById(req.usuario.id);
    
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    // Verificar que el dominio no exista ya en el usuario
    const vehiculoExistente = usuario.vehiculos.find(v => v.dominio.toLowerCase() === dominio.toLowerCase());
    
    if (vehiculoExistente) {
      return res.status(400).json({ mensaje: 'Ya tienes un vehículo registrado con ese dominio' });
    }

    // Verificar que el dominio no exista en ningún otro usuario activo
    const dominioEnOtroUsuario = await Usuario.findOne({
      'vehiculos.dominio': { $regex: new RegExp(`^${dominio}$`, 'i') },
      _id: { $ne: req.usuario.id },
      activo: true
    });

    if (dominioEnOtroUsuario) {
      return res.status(400).json({ mensaje: 'Ese dominio ya está registrado por otro usuario' });
    }

    // Agregar vehículo
    const nuevoVehiculo = {
      dominio: dominio.toUpperCase(),
      tipo: tipo.toLowerCase(),
      marca: marca.trim(),
      modelo: modelo.trim(),
      año: año.toString()
    };

    usuario.vehiculos.push(nuevoVehiculo);
    await usuario.save();

    res.json({
      mensaje: 'Vehículo agregado exitosamente',
      vehiculo: nuevoVehiculo
    });

  } catch (error) {
    console.error('Error al agregar vehículo:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};
*/

// FUNCIÓN DESHABILITADA - Eliminar vehículo se hace desde Dashboard
// Eliminar vehículo del perfil
/*
const eliminarVehiculo = async (req, res) => {
  try {
    const { vehiculoId } = req.params;

    const usuario = await Usuario.findById(req.usuario.id);
    
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    // Encontrar y eliminar el vehículo
    const vehiculoIndex = usuario.vehiculos.findIndex(v => v._id.toString() === vehiculoId);
    
    if (vehiculoIndex === -1) {
      return res.status(404).json({ mensaje: 'Vehículo no encontrado' });
    }

    const vehiculoEliminado = usuario.vehiculos[vehiculoIndex];
    usuario.vehiculos.splice(vehiculoIndex, 1);
    await usuario.save();

    res.json({
      mensaje: 'Vehículo eliminado exitosamente',
      vehiculoEliminado: vehiculoEliminado.dominio
    });

  } catch (error) {
    console.error('Error al eliminar vehículo:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};
*/

module.exports = {
  obtenerPerfil,
  actualizarDatosBasicos,
  cambiarContrasena
};
