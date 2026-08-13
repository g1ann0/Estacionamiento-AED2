const Vehiculo = require('../models/Vehiculo');
const Usuario = require('../models/Usuario');
const Estacionamiento = require('../models/Estacionamiento');

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

// Lo único que el dueño de un vehículo puede escribir sobre él.
//
// Antes el cuerpo del request entraba entero al update (`{ ...datosActualizados }`), y el
// documento tiene campos que no son del cliente: `usuario` (a quién pertenece — se lo podía
// regalar a otra cuenta, o robárselo), `sucursalId`, y sobre todo `estActivo`, que es la
// marca de "está adentro de la playa". Poniéndola en false a mano, el auto quedaba libre para
// volver a entrar sin haber salido nunca; poniéndola en true, el ingreso legítimo chocaba
// contra el guard de doble ingreso. El estado de la estadía lo maneja estadiaService, no el
// formulario de "editar mi auto".
const CAMPOS_EDITABLES = ['tipo', 'marca', 'modelo', 'año'];

const soloCamposEditables = (datos = {}) =>
  Object.fromEntries(
    Object.entries(datos).filter(([clave]) => CAMPOS_EDITABLES.includes(clave))
  );

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

    const datos = { ...soloCamposEditables(nuevoVehiculo), dominio: dominioNormalizado, usuario: usuario._id };
    const vehiculo = existente
      ? await Vehiculo.findOneAndUpdate({ _id: existente._id }, datos, { returnDocument: 'after' })
      : await Vehiculo.create(datos);

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

    // Pertenencia ya verificada por requireOwnership('dni') en la ruta.
    // Un vehículo que está adentro no se borra: la estadía activa lo referencia por dominio y
    // borrarlo dejaba un cobro pendiente apuntando a un auto que ya no existe en el catálogo.
    const dominioNormalizado = String(dominio).toUpperCase();
    const adentro = await Estacionamiento.exists({ vehiculoDominio: dominioNormalizado, estado: 'activo' });
    if (adentro) {
      return res.status(409).json({ mensaje: 'El vehículo está dentro de la playa. Primero registrá la salida.' });
    }

    const resultado = await Vehiculo.deleteOne({ dominio: dominioNormalizado, usuario: usuario._id });
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
      { dominio: String(dominio).toUpperCase(), usuario: usuario._id },
      soloCamposEditables(datosActualizados),
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
