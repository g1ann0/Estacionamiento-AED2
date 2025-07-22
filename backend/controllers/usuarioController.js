const Usuario = require('../models/Usuario');
const Comprobante = require('../models/Comprobante');
const Transaccion = require('../models/Transaccion');
const { v4: uuidv4 } = require('uuid');  // para generar nroComprobante único

// Registrar un nuevo usuario
const registrarUsuario = async (req, res) => {
  try {
    const nuevoUsuario = new Usuario(req.body);
    await nuevoUsuario.save();
    res.status(201).json({ mensaje: 'Usuario registrado correctamente', usuario: nuevoUsuario });
  } catch (error) {
    res.status(400).json({ mensaje: 'Error al registrar usuario', error });
  }
};

// Recargar saldo a un usuario
const recargarUsuario = async (req, res) => {
  try {
    const { dni, montoAcreditar } = req.body;

    // 1. Buscar usuario por DNI
    const usuario = await Usuario.findOne({ dni });
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    // 2. Calcular nuevo saldo y guardar
    usuario.montoDisponible += montoAcreditar;
    await usuario.save();

    // 3. Crear comprobante
    const nroComprobante = uuidv4().slice(0, 8); // ej. 'a1b2c3d4'
    const comprobante = new Comprobante({
      usuario: {
        dni: usuario.dni,
        nombre: usuario.nombre,
        apellido: usuario.apellido
      },
      montoAcreditado: montoAcreditar,
      montoDisponible: usuario.montoDisponible,
      vehiculos: usuario.vehiculos.map(v => v.dominio),
      nroComprobante
    });
    await comprobante.save();

    // 4. Crear transacción
    const transaccion = new Transaccion({
      usuarioDNI: usuario.dni,
      montoAcreditado: montoAcreditar,
      montoResultante: usuario.montoDisponible,
      tipo: 'recarga',
      comprobanteId: comprobante._id
    });
    await transaccion.save();

    // 5. Responder con el comprobante
    res.status(201).json({
      mensaje: 'Recarga realizada correctamente',
      comprobante
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al recargar saldo', error });
  }
};

module.exports = {
  registrarUsuario,
  recargarUsuario
};
