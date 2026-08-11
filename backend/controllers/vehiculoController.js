const Vehiculo = require('../models/Vehiculo');
const Usuario = require('../models/Usuario');

// El catálogo de vehículos vive SOLO en la colección Vehiculo.
//
// Antes convivía con un array embebido `Usuario.vehiculos[]` que había que mantener a mano en
// paralelo: cada alta escribía en los dos lados, cada baja borraba en los dos, y cuando se
// desincronizaban —que pasaba— aparecían duplicados. La prueba de que no funcionaba era que
// este mismo archivo tenía un endpoint `limpiarDuplicadosVehiculos` cuyo único trabajo era
// reparar la basura que la duplicación generaba. Ese endpoint desapareció junto con el array.

const aVistaVehiculo = (vehiculo) => ({
  dominio: vehiculo.dominio,
  tipo: vehiculo.tipo,
  marca: vehiculo.marca,
  modelo: vehiculo.modelo,
  año: vehiculo.año
});

const agregarVehiculo = async (req, res) => {
  try {
    const { dni, nuevoVehiculo } = req.body;

    if (!dni || !nuevoVehiculo) {
      return res.status(400).json({ mensaje: 'Faltan datos requeridos' });
    }

    // marca/modelo/año son opcionales (ver models/Vehiculo.js): un vehículo se identifica por
    // su dominio y su tipo, el resto es información complementaria.
    const { dominio, tipo } = nuevoVehiculo;
    if (!dominio || !tipo) {
      return res.status(400).json({ mensaje: 'El dominio y el tipo son obligatorios' });
    }

    const usuario = await Usuario.findOne({ dni });
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    if (!usuario.verificado) {
      return res.status(400).json({ mensaje: 'El usuario no está verificado' });
    }

    if (req.usuario.dni !== dni && req.usuario.rol !== 'admin') {
      return res.status(403).json({ mensaje: 'No tenés permiso para agregar vehículos a este usuario' });
    }

    const dominioNormalizado = dominio.toUpperCase();

    // El vehículo puede existir sin dueño si entró alguna vez como ocasional por caja: en ese
    // caso se le asigna el propietario en vez de rechazar el alta.
    const existente = await Vehiculo.findOne({ dominio: dominioNormalizado });
    if (existente && existente.usuario) {
      return res.status(400).json({ mensaje: 'Ya existe un vehículo con ese dominio' });
    }

    const vehiculo = existente
      ? await Vehiculo.findOneAndUpdate(
          { _id: existente._id },
          { ...nuevoVehiculo, dominio: dominioNormalizado, usuario: usuario._id },
          { returnDocument: 'after' }
        )
      : await Vehiculo.create({ ...nuevoVehiculo, dominio: dominioNormalizado, usuario: usuario._id });

    return res.status(200).json({
      mensaje: 'Vehículo agregado correctamente',
      vehiculo: aVistaVehiculo(vehiculo)
    });

  } catch (error) {
    console.error('Error al crear vehículo:', error);
    return res.status(500).json({
      mensaje: 'Error al agregar el vehículo',
      error: error.message
    });
  }
};

const obtenerVehiculosPorUsuario = async (req, res) => {
  try {
    const { dni } = req.params;
    const usuario = await Usuario.findOne({ dni });

    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    // El índice único de `dominio` garantiza que no puede haber repetidos: ya no hace falta
    // deduplicar en memoria como cuando la fuente era el array.
    const vehiculos = await Vehiculo.find({ usuario: usuario._id }).sort({ dominio: 1 }).lean();

    res.json(vehiculos.map(aVistaVehiculo));
  } catch (error) {
    console.error('Error al obtener vehículos:', error);
    res.status(500).json({
      mensaje: 'Error al obtener vehículos',
      error: error.message
    });
  }
};

const eliminarVehiculo = async (req, res) => {
  try {
    const { dni, dominio } = req.params;

    const usuario = await Usuario.findOne({ dni });
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    // Pertenencia ya verificada por requireOwnership('dni') en la ruta
    const resultado = await Vehiculo.deleteOne({ dominio: dominio.toUpperCase(), usuario: usuario._id });
    if (resultado.deletedCount === 0) {
      return res.status(404).json({ mensaje: 'Vehículo no encontrado' });
    }

    res.json({ mensaje: 'Vehículo eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar vehículo:', error);
    res.status(500).json({
      mensaje: 'Error al eliminar el vehículo',
      error: error.message
    });
  }
};

const modificarVehiculo = async (req, res) => {
  try {
    const { dni, dominio } = req.params;
    const datosActualizados = req.body;

    const usuario = await Usuario.findOne({ dni });
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    // Pertenencia ya verificada por requireOwnership('dni') en la ruta
    const vehiculo = await Vehiculo.findOneAndUpdate(
      { dominio: dominio.toUpperCase(), usuario: usuario._id },
      { ...datosActualizados },
      { returnDocument: 'after' }
    );

    if (!vehiculo) {
      return res.status(404).json({ mensaje: 'Vehículo no encontrado' });
    }

    res.json({
      mensaje: 'Vehículo actualizado correctamente',
      vehiculo: aVistaVehiculo(vehiculo)
    });
  } catch (error) {
    console.error('Error al modificar vehículo:', error);
    res.status(500).json({
      mensaje: 'Error al modificar el vehículo',
      error: error.message
    });
  }
};

module.exports = {
  agregarVehiculo,
  obtenerVehiculosPorUsuario,
  eliminarVehiculo,
  modificarVehiculo
};
