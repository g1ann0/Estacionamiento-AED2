const Usuario = require('../models/Usuario');
const Comprobante = require('../models/Comprobante');
const Transaccion = require('../models/Transaccion');
const ConfiguracionPrecio = require('../models/ConfiguracionPrecio');
const { v4: uuidv4 } = require('uuid');  // para generar nroComprobante único


// Recargar saldo a un usuario
const recargarUsuario = async (req, res) => {
  try {
    const { dni, monto } = req.body;

    // Validar que el monto sea un número válido
    const montoAcreditar = parseFloat(monto);
    if (isNaN(montoAcreditar) || montoAcreditar <= 0) {
      return res.status(400).json({ mensaje: 'El monto debe ser un número válido mayor a 0' });
    }

    const usuario = await Usuario.findOne({ dni, activo: true });
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado o inactivo' });
    }

    // Asegurarse de que montoDisponible sea un número válido
    const montoActual = parseFloat(usuario.montoDisponible) || 0;
    usuario.montoDisponible = montoActual + montoAcreditar;
    await usuario.save();

    const nroComprobante = uuidv4().slice(0, 8);
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

    // Las recargas se registran como comprobantes, no como transacciones de estacionamiento
    // ya que son operaciones financieras, no movimientos de vehículos

    res.status(201).json({
      mensaje: 'Recarga realizada correctamente',
      comprobante
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al recargar saldo', error });
  }
};

// Agregar vehículo a usuario existente
const agregarVehiculo = async (req, res) => {
  try {
    const { dni, nuevoVehiculo } = req.body;
    
    // Imprimir los datos recibidos para diagnóstico
    console.log('Datos recibidos:', {
      dni,
      nuevoVehiculo
    });

    const usuario = await Usuario.findOne({ dni, activo: true });
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado o inactivo' });
    }

    // Validar que nuevoVehiculo existe
    if (!nuevoVehiculo) {
      return res.status(400).json({
        mensaje: 'No se recibieron los datos del vehículo',
        datosRecibidos: req.body
      });
    }

    // Validar cada campo individualmente
    const camposFaltantes = [];
    if (!nuevoVehiculo.dominio) camposFaltantes.push('dominio');
    if (!nuevoVehiculo.tipo) camposFaltantes.push('tipo');
    if (!nuevoVehiculo.marca) camposFaltantes.push('marca');
    if (!nuevoVehiculo.modelo) camposFaltantes.push('modelo');
    if (!nuevoVehiculo.año) camposFaltantes.push('año');

    if (camposFaltantes.length > 0) {
      return res.status(400).json({
        mensaje: 'Campos requeridos faltantes',
        camposFaltantes: camposFaltantes
      });
    }

    const Vehiculo = require('../models/Vehiculo');
    
    // Verificar si ya existe un vehículo con ese dominio
    const vehiculoExistente = await Vehiculo.findOne({
      dominio: nuevoVehiculo.dominio.toUpperCase()
    });
    
    if (vehiculoExistente) {
      return res.status(400).json({ 
        mensaje: 'Este vehículo ya está registrado' 
      });
    }

    // Crear el nuevo vehículo
    const vehiculo = new Vehiculo({
      usuario: usuario._id,
      dominio: nuevoVehiculo.dominio.toUpperCase(),
      tipo: nuevoVehiculo.tipo.toLowerCase(),
      marca: nuevoVehiculo.marca,
      modelo: nuevoVehiculo.modelo,
      año: nuevoVehiculo.año
    });

    await vehiculo.save();

    res.status(200).json({ 
      mensaje: 'Vehículo agregado correctamente', 
      usuario 
    });

  } catch (error) {
    res.status(500).json({ mensaje: 'Error al agregar vehículo', error });
  }
};

/*---------------------------------------------------------------------------------------*/
const registrarIngreso = async (req, res) => {
  try {
    const { dni, dominio, tipoRegistro } = req.body;

    const usuario = await Usuario.findOne({ dni, activo: true });
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado o inactivo' });
    }

    const vehiculo = usuario.vehiculos.find(v => v.dominio === dominio);
    if (!vehiculo) {
      return res.status(404).json({ mensaje: 'Vehículo no registrado' });
    }

    // Verificar si ya tiene un estacionamiento activo
    const Estacionamiento = require('../models/Estacionamiento');
    const estacionamientoActivo = await Estacionamiento.findOne({
      usuarioDNI: dni,
      vehiculoDominio: dominio,
      estado: 'activo'
    });

    if (estacionamientoActivo) {
      return res.status(400).json({ mensaje: 'Ya tiene un estacionamiento activo para este vehículo' });
    }

    // Crear nuevo registro de estacionamiento
    const nuevoEstacionamiento = new Estacionamiento({
      usuarioDNI: dni,
      vehiculoDominio: dominio,
      tipoRegistro,
      horaInicio: new Date()
    });

    await nuevoEstacionamiento.save();

    res.status(200).json({
      mensaje: 'Estacionamiento iniciado correctamente',
      estacionamiento: nuevoEstacionamiento
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al registrar ingreso', error });
  }
};



// ✅ Exportar todos los controladores en un solo module.exports
// Obtener datos del usuario
const obtenerUsuario = async (req, res) => {
  try {
    const { dni } = req.params;
    const usuario = await Usuario.findOne({ dni, activo: true })
      .populate('tarifaAsignada', 'nombre precioPorHora descripcion');
    
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado o inactivo' });
    }

    // Buscar todos los vehículos del usuario
    const Vehiculo = require('../models/Vehiculo');
    const vehiculos = await Vehiculo.find({ 
      usuario: usuario._id
    }).sort({ dominio: 1 }); // Ordenar por dominio

    // Eliminar duplicados basados en el dominio (por si acaso)
    const vehiculosUnicos = vehiculos.reduce((acc, current) => {
      const x = acc.find(item => item.dominio === current.dominio);
      if (!x) {
        return acc.concat([current]);
      } else {
        return acc;
      }
    }, []);

    res.status(200).json({ 
      usuario: {
        dni: usuario.dni,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        email: usuario.email,
        montoDisponible: usuario.montoDisponible,
        asociado: usuario.asociado,
        tarifaAsignada: usuario.tarifaAsignada, // ✅ Agregar tarifa asignada
        fechaRegistro: usuario.fechaRegistro,
        vehiculos: vehiculosUnicos.map(v => ({
          dominio: v.dominio,
          tipo: v.tipo,
          marca: v.marca,
          modelo: v.modelo,
          año: v.año
        }))
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al obtener datos del usuario', error });
  }
};

// Modificar vehículo
const modificarVehiculo = async (req, res) => {
  try {
    const { dominio } = req.params;
    const { marca, modelo, tipo, año, dominio: nuevoDominio } = req.body;

    // Validar que todos los campos estén presentes
    if (!marca || !modelo || !tipo || !año || !nuevoDominio) {
      return res.status(400).json({ 
        mensaje: 'Todos los campos son requeridos para la modificación'
      });
    }

    const Vehiculo = require('../models/Vehiculo');
    
    // Si el dominio va a cambiar, verificar que el nuevo no exista
    if (nuevoDominio.toUpperCase() !== dominio.toUpperCase()) {
      const existeVehiculo = await Vehiculo.findOne({ 
        dominio: nuevoDominio.toUpperCase() 
      });
      
      if (existeVehiculo) {
        return res.status(400).json({ 
          mensaje: 'Ya existe un vehículo con ese dominio' 
        });
      }
    }

    // Encontrar el vehículo y su usuario
    const vehiculoActual = await Vehiculo.findOne({ dominio: dominio.toUpperCase() });
    if (!vehiculoActual) {
      return res.status(404).json({ mensaje: 'Vehículo no encontrado' });
    }

    // Encontrar el usuario que posee el vehículo
    const usuarioDelVehiculo = await Usuario.findById(vehiculoActual.usuario);
    if (!usuarioDelVehiculo) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    // Si el dominio va a cambiar, verificar que no cause conflictos
    if (nuevoDominio.toUpperCase() !== dominio.toUpperCase()) {
      // Eliminar el vehículo antiguo de la lista de vehículos del usuario
      usuarioDelVehiculo.vehiculos = usuarioDelVehiculo.vehiculos.filter(
        v => v.dominio.toUpperCase() !== dominio.toUpperCase()
      );
      
      // Eliminar el vehículo antiguo
      await Vehiculo.deleteOne({ dominio: dominio.toUpperCase() });
    }

    // Crear o actualizar el vehículo
    const vehiculoActualizado = await Vehiculo.findOneAndUpdate(
      { dominio: dominio.toUpperCase() },
      {
        $set: {
          dominio: nuevoDominio.toUpperCase(),
          marca,
          modelo,
          tipo: tipo.toLowerCase(),
          año,
          usuario: usuarioDelVehiculo._id
        }
      },
      { new: true, upsert: true }
    );

    // Actualizar el vehículo en el array de vehículos del usuario
    const vehiculoIndex = usuarioDelVehiculo.vehiculos.findIndex(
      v => v.dominio.toUpperCase() === dominio.toUpperCase()
    );

    const vehiculoData = {
      dominio: nuevoDominio.toUpperCase(),
      tipo: tipo.toLowerCase(),
      marca,
      modelo,
      año
    };

    if (vehiculoIndex === -1) {
      usuarioDelVehiculo.vehiculos.push(vehiculoData);
    } else {
      usuarioDelVehiculo.vehiculos[vehiculoIndex] = vehiculoData;
    }

    // Guardar los cambios en el usuario
    await usuarioDelVehiculo.save();

    res.status(200).json({ 
      mensaje: 'Vehículo actualizado correctamente',
      vehiculo: vehiculoActualizado
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al modificar el vehículo', error });
  }
};

// Eliminar vehículo
const eliminarVehiculo = async (req, res) => {
  try {
    const { dominio } = req.params;
    
    const Vehiculo = require('../models/Vehiculo');
    const vehiculo = await Vehiculo.findOne({ dominio: dominio.toUpperCase() });

    if (!vehiculo) {
      return res.status(404).json({ mensaje: 'Vehículo no encontrado' });
    }

    // Eliminar el vehículo completamente
    await Vehiculo.deleteOne({ _id: vehiculo._id });

    res.status(200).json({ 
      mensaje: 'Vehículo eliminado correctamente' 
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al eliminar el vehículo', error });
  }
};

const finalizarEstacionamiento = async (req, res) => {
  try {
    const { dni, dominio } = req.body;

    const Estacionamiento = require('../models/Estacionamiento');
    const estacionamiento = await Estacionamiento.findOne({
      usuarioDNI: dni,
      vehiculoDominio: dominio,
      estado: 'activo'
    });

    if (!estacionamiento) {
      return res.status(404).json({ mensaje: 'No se encontró un estacionamiento activo para este vehículo' });
    }

    const horaFin = new Date();
    const duracionMilisegundos = horaFin - estacionamiento.horaInicio;
    const duracionHoras = Math.ceil(duracionMilisegundos / (1000 * 60 * 60)); // Redondear hacia arriba

    // Calcular tarifa según tipo de registro
    const tarifaPorHora = estacionamiento.tipoRegistro === 'normal' ? 500 : 250;
    const montoTotal = duracionHoras * tarifaPorHora;

    // Buscar usuario activo y verificar saldo
    const usuario = await Usuario.findOne({ dni, activo: true });
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado o inactivo' });
    }

    if (usuario.montoDisponible < montoTotal) {
      return res.status(400).json({ mensaje: 'Saldo insuficiente para completar la operación' });
    }

    // Actualizar estacionamiento
    estacionamiento.horaFin = horaFin;
    estacionamiento.duracionHoras = duracionHoras;
    estacionamiento.montoTotal = montoTotal;
    estacionamiento.estado = 'finalizado';
    await estacionamiento.save();

    // Descontar del saldo
    usuario.montoDisponible -= montoTotal;
    await usuario.save();

    // Generar comprobante
    const nroComprobante = uuidv4().slice(0, 8);
    const comprobante = new Comprobante({
      usuario: {
        dni: usuario.dni,
        nombre: usuario.nombre,
        apellido: usuario.apellido
      },
      montoAcreditado: -montoTotal,
      montoDisponible: usuario.montoDisponible,
      vehiculos: [dominio],
      nroComprobante
    });
    await comprobante.save();

    // El estacionamiento ya se registra en las transacciones del controlador de estacionamiento
    // No necesitamos duplicar esta información aquí

    res.status(200).json({
      mensaje: 'Estacionamiento finalizado correctamente',
      duracionHoras,
      montoTotal,
      comprobante
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al finalizar el estacionamiento', error });
  }
};

// Obtener todos los usuarios con sus tarifas
const obtenerTodosUsuarios = async (req, res) => {
  try {
    const usuarios = await Usuario.find({ activo: true })
      .populate('tarifaAsignada', 'tipoUsuario precioPorHora descripcion')
      .select('-password -tokenVerificacion -tokenRecuperacion')
      .sort({ fechaRegistro: -1 });

    res.json(usuarios);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ mensaje: 'Error al obtener usuarios', error });
  }
};

// Actualizar usuario (incluyendo tarifa y estado de asociado)
const actualizarUsuario = async (req, res) => {
  try {
    const { dni } = req.params;
    const { asociado, tarifaAsignada, ...otrosDatos } = req.body;

    // Buscar el usuario
    const usuario = await Usuario.findOne({ dni, activo: true });
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    // Validar que la tarifa existe si se especifica
    if (tarifaAsignada && tarifaAsignada !== '') {
      const tarifaExiste = await ConfiguracionPrecio.findById(tarifaAsignada);
      if (!tarifaExiste) {
        return res.status(400).json({ mensaje: 'La tarifa especificada no existe' });
      }
    }

    // Actualizar campos
    if (typeof asociado !== 'undefined') {
      usuario.asociado = asociado;
    }
    
    if (tarifaAsignada !== undefined) {
      usuario.tarifaAsignada = tarifaAsignada === '' ? null : tarifaAsignada;
    }

    // Actualizar otros datos permitidos
    const camposPermitidos = ['nombre', 'apellido', 'email'];
    camposPermitidos.forEach(campo => {
      if (otrosDatos[campo] !== undefined) {
        usuario[campo] = otrosDatos[campo];
      }
    });

    await usuario.save();

    // Devolver usuario actualizado con tarifa poblada
    const usuarioActualizado = await Usuario.findById(usuario._id)
      .populate('tarifaAsignada', 'tipoUsuario precioPorHora descripcion')
      .select('-password -tokenVerificacion -tokenRecuperacion');

    res.json({
      mensaje: 'Usuario actualizado correctamente',
      usuario: usuarioActualizado
    });

  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ mensaje: 'Error al actualizar usuario', error });
  }
};

// Obtener tarifas disponibles
const obtenerTarifasDisponibles = async (req, res) => {
  try {
    const tarifas = await ConfiguracionPrecio.find({ activo: true })
      .sort({ tipoUsuario: 1 });

    res.json(tarifas);
  } catch (error) {
    console.error('Error al obtener tarifas:', error);
    res.status(500).json({ mensaje: 'Error al obtener tarifas', error });
  }
};

module.exports = {
  recargarUsuario,
  agregarVehiculo,
  registrarIngreso,
  obtenerUsuario,
  modificarVehiculo,
  eliminarVehiculo,
  finalizarEstacionamiento,
  obtenerTodosUsuarios,
  actualizarUsuario,
  obtenerTarifasDisponibles
};
