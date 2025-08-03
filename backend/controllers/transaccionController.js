const Transaccion = require('../models/Transaccion');
const Vehiculo = require('../models/Vehiculo');
const Usuario = require('../models/Usuario');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Obtener todas las transacciones
// @route   GET /api/transacciones
// @access  Private
const obtenerTransacciones = async (req, res, next) => {
  try {
    const { id } = req.usuario; // Usar ID del usuario en lugar de DNI

    // Buscar transacciones del usuario activo
    const transacciones = await Transaccion.find({
      usuario: id
    })
    .populate('usuario', 'dni nombre apellido activo')
    .sort('-fechaHora');

    // Filtrar solo transacciones de usuarios activos
    const transaccionesActivas = transacciones.filter(t => 
      t.usuario && t.usuario.activo === true
    );

    console.log('Transacciones encontradas:', transaccionesActivas.length);

    res.status(200).json({
      success: true,
      transacciones: transaccionesActivas
    });
  } catch (error) {
    console.error('Error al obtener transacciones:', error);
    next(error);
  }
};

// @desc    Crear una nueva transacción de ingreso
// @route   POST /api/transacciones/ingreso
// @access  Private
const crearTransaccionIngreso = async (req, res, next) => {
  try {
    const { vehiculoDominio, porton, usuario } = req.body;

    // Buscar el vehículo por dominio
    const vehiculo = await Vehiculo.findOne({ dominio: vehiculoDominio })
      .populate('propietario', 'nombre apellido dni asociado');
    
    if (!vehiculo) {
      return next(new ErrorResponse('Vehículo no encontrado', 404));
    }

    // Crear la transacción con todos los datos necesarios
    const transaccion = await Transaccion.create({
      tipo: 'ingreso',
      vehiculo: {
        dominio: vehiculo.dominio,
        marca: vehiculo.marca,
        modelo: vehiculo.modelo,
        tipo: vehiculo.tipo
      },
      propietario: {
        dni: vehiculo.propietario.dni,
        nombre: vehiculo.propietario.nombre,
        apellido: vehiculo.propietario.apellido
      },
      porton,
      fechaHora: new Date(),
      tarifa: vehiculo.propietario.asociado ? 250 : 500,
      montoTotal: 0,
      estado: 'activo'
    });

    res.status(201).json({
      success: true,
      data: transaccion
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Registrar salida de vehículo
// @route   PUT /api/transacciones/:transaccionId/salida
// @access  Private
const registrarSalida = async (req, res, next) => {
  try {
    const { transaccionId } = req.params;
    
    // Buscar la transacción de ingreso activa
    const transaccionIngreso = await Transaccion.findOne({
      _id: transaccionId,
      tipo: 'ingreso',
      estado: 'activo'
    });
    
    if (!transaccionIngreso) {
      return next(new ErrorResponse('Transacción de ingreso no encontrada o ya finalizada', 404));
    }

    // Calcular duración y monto
    const fechaSalida = new Date();
    const duracionMs = fechaSalida - transaccionIngreso.fechaHora;
    const duracionHoras = Math.ceil(duracionMs / (1000 * 60 * 60));
    const montoTotal = duracionHoras * transaccionIngreso.tarifa;

    // Formatear duración para mostrar
    const horas = Math.floor(duracionMs / (1000 * 60 * 60));
    const minutos = Math.floor((duracionMs % (1000 * 60 * 60)) / (1000 * 60));
    const duracionFormateada = `${horas}h ${minutos}m`;

    // Actualizar la transacción de ingreso
    transaccionIngreso.estado = 'finalizado';
    transaccionIngreso.montoTotal = montoTotal;
    transaccionIngreso.duracion = duracionFormateada;
    await transaccionIngreso.save();

    // Crear transacción de salida
    const transaccionSalida = await Transaccion.create({
      tipo: 'salida',
      vehiculo: transaccionIngreso.vehiculo,
      propietario: transaccionIngreso.propietario,
      porton: transaccionIngreso.porton,
      fechaHora: fechaSalida,
      tarifa: transaccionIngreso.tarifa,
      montoTotal,
      duracion: duracionFormateada,
      estado: 'finalizado'
    });

    res.status(200).json({
      success: true,
      data: {
        ingreso: transaccionIngreso,
        salida: transaccionSalida,
        duracionHoras,
        montoTotal
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  obtenerTransacciones,
  crearTransaccionIngreso,
  registrarSalida
};
