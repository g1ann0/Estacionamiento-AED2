const Usuario = require('../models/Usuario');
const Vehiculo = require('../models/Vehiculo');
const Estacionamiento = require('../models/Estacionamiento');
const ConfiguracionPrecio = require('../models/ConfiguracionPrecio');
const auditoriaService = require('../services/auditoriaService');


// Recarga de saldo — CERRADA. Era dinero gratis.
//
// El endpoint aceptaba `{dni, monto}` y solo verificaba que el DNI fuera el del token o que
// quien llamaba fuera admin. Como el DNI del token es el propio, **cualquier cliente
// autenticado podía acreditarse el saldo que quisiera** con un POST, sin pagar nada y sin
// dejar más rastro que un comprobante que él mismo generaba. No había cobro real detrás: la
// plata aparecía de la nada.
//
// No se "arregla" pidiendo rol admin, porque el circuito de recarga ya estaba discontinuado
// (ver comprobanteController.crearComprobante y docs/rediseno-admin/01, grupo 4): el pago se
// cobra al retirar el vehículo. El ajuste de saldo por parte del dueño sigue existiendo, pero
// por el camino que corresponde —`PUT /api/admin/usuarios/:dni`—, que es admin-only, exige
// motivo y queda en auditoría.
//
// 410 y no 404: la funcionalidad existió y fue retirada.
const recargarUsuario = async (req, res) => {
  res.status(410).json({
    mensaje: 'La recarga de saldo fue discontinuada. El pago se realiza al retirar el vehículo, en efectivo, tarjeta o QR. Un administrador puede ajustar el saldo desde el panel, con motivo y auditoría.'
  });
};

// Agregar vehículo a usuario existente
const agregarVehiculo = async (req, res) => {
  try {
    const { dni, nuevoVehiculo } = req.body;

    if (req.usuario.dni !== dni && req.usuario.rol !== 'admin') {
      return res.status(403).json({ mensaje: 'No tenés permiso para agregar un vehículo a otro usuario' });
    }

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

// `registrarIngreso` vivía acá como una de las tres puertas al mismo flujo de ingreso
// (junto con estacionamientoController y transaccionController). La Tarea 0.2 unificó la
// lógica en estadiaService; esta puerta quedó sin llamadores y se eliminó. El ingreso entra
// hoy por POST /api/estacionamiento/iniciar (app) o POST /api/estadias/ingreso-manual (caja).

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

    // El índice único de `dominio` garantiza que no haya repetidos: la deduplicación en
    // memoria que había acá ("por si acaso") era un síntoma del array embebido, no del modelo.
    const vehiculos = await Vehiculo.find({ usuario: usuario._id }).sort({ dominio: 1 }).lean();

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
        vehiculos: vehiculos.map(v => ({
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

    // Vehículo de cliente ocasional/caja (sin propietario) — no editable desde este
    // endpoint de autoservicio; ver adminController.modificarVehiculoAdmin para el caso admin.
    if (!vehiculoActual.usuario) {
      return res.status(400).json({ mensaje: 'Este vehículo no tiene un propietario registrado' });
    }

    // Encontrar el usuario que posee el vehículo
    const usuarioDelVehiculo = await Usuario.findById(vehiculoActual.usuario);
    if (!usuarioDelVehiculo) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    if (req.usuario.dni !== usuarioDelVehiculo.dni && req.usuario.rol !== 'admin') {
      return res.status(403).json({ mensaje: 'No tenés permiso para modificar este vehículo' });
    }

    // Si el dominio va a cambiar, eliminar el registro anterior antes del upsert.
    if (nuevoDominio.toUpperCase() !== dominio.toUpperCase()) {
      // Salvo que el auto esté adentro: la estadía activa referencia al vehículo por su
      // dominio (es un string, no una referencia), así que renombrarlo en medio de la estadía
      // la deja apuntando a una patente que ya no existe y el egreso no la encuentra más.
      const adentro = await Estacionamiento.exists({ vehiculoDominio: dominio.toUpperCase(), estado: 'activo' });
      if (adentro) {
        return res.status(409).json({ mensaje: 'No se puede cambiar la patente mientras el vehículo está dentro de la playa.' });
      }
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
      { returnDocument: 'after', upsert: true }
    );

    // El upsert de arriba es la única escritura: el vehículo vive solo en su colección.

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
    const dominio = String(req.params.dominio ?? '').toUpperCase();

    const vehiculo = await Vehiculo.findOne({ dominio });

    if (!vehiculo) {
      return res.status(404).json({ mensaje: 'Vehículo no encontrado' });
    }

    // Un vehículo sin dueño es de la playa (entró alguna vez como ocasional por caja), no de
    // nadie: antes el permiso solo se comprobaba cuando tenía propietario, así que cualquier
    // cliente autenticado podía borrar del catálogo los autos de los clientes ocasionales.
    if (!vehiculo.usuario) {
      if (req.usuarioActual?.rol !== 'admin') {
        return res.status(403).json({ mensaje: 'Este vehículo no tiene propietario registrado: solo un administrador puede eliminarlo' });
      }
    } else {
      const usuarioDelVehiculo = await Usuario.findById(vehiculo.usuario);
      if (usuarioDelVehiculo && req.usuario.dni !== usuarioDelVehiculo.dni && req.usuarioActual?.rol !== 'admin') {
        return res.status(403).json({ mensaje: 'No tenés permiso para eliminar este vehículo' });
      }
    }

    // Con el auto adentro, borrarlo deja la estadía activa apuntando a un dominio que ya no
    // está en el catálogo — y esa estadía todavía tiene que cobrarse.
    const adentro = await Estacionamiento.exists({ vehiculoDominio: dominio, estado: 'activo' });
    if (adentro) {
      return res.status(409).json({ mensaje: 'El vehículo está dentro de la playa. Primero registrá la salida.' });
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

const ROLES_VALIDOS = ['cliente', 'admin', 'operador'];

// Actualizar usuario (incluyendo tarifa, rol y estado de asociado)
const actualizarUsuario = async (req, res) => {
  try {
    const { dni } = req.params;
    const { asociado, tarifaAsignada, rol, ...otrosDatos } = req.body;

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

    if (rol !== undefined && !ROLES_VALIDOS.includes(rol)) {
      return res.status(400).json({ mensaje: `Rol inválido. Debe ser uno de: ${ROLES_VALIDOS.join(', ')}` });
    }

    const estadoAnterior = { rol: usuario.rol, asociado: usuario.asociado, tarifaAsignada: usuario.tarifaAsignada };

    // Actualizar campos
    if (typeof asociado !== 'undefined') {
      usuario.asociado = asociado;
    }

    if (tarifaAsignada !== undefined) {
      usuario.tarifaAsignada = tarifaAsignada === '' ? null : tarifaAsignada;
    }

    if (rol !== undefined) {
      usuario.rol = rol;
    }

    // Actualizar otros datos permitidos
    const camposPermitidos = ['nombre', 'apellido', 'email'];
    camposPermitidos.forEach(campo => {
      if (otrosDatos[campo] !== undefined) {
        usuario[campo] = otrosDatos[campo];
      }
    });

    await usuario.save();

    if (rol !== undefined && rol !== estadoAnterior.rol) {
      await auditoriaService.registrar({
        entidad: 'Usuario',
        entidadId: usuario._id,
        accion: 'cambio_rol',
        usuarioId: req.usuarioActual?._id ?? null,
        usuarioDni: req.usuario.dni,
        datosAnteriores: { rol: estadoAnterior.rol },
        datosNuevos: { rol },
        motivo: `Admin ${req.usuario.dni} cambió el rol de ${dni} de "${estadoAnterior.rol}" a "${rol}"`
      });
    }
    if (tarifaAsignada !== undefined && String(tarifaAsignada) !== String(estadoAnterior.tarifaAsignada ?? '')) {
      await auditoriaService.registrar({
        entidad: 'Usuario',
        entidadId: usuario._id,
        accion: 'cambio_tarifa',
        usuarioId: req.usuarioActual?._id ?? null,
        usuarioDni: req.usuario.dni,
        datosAnteriores: { tarifaAsignada: estadoAnterior.tarifaAsignada },
        datosNuevos: { tarifaAsignada: usuario.tarifaAsignada }
      });
    }

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
  obtenerUsuario,
  modificarVehiculo,
  eliminarVehiculo,
  obtenerTodosUsuarios,
  actualizarUsuario,
  obtenerTarifasDisponibles
};
