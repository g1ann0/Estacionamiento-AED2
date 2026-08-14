// Servicio de dominio único para el flujo de ingreso/egreso de vehículos.
// Reemplaza las 3 implementaciones paralelas que existían en estacionamientoController,
// usuarioController y transaccionController (ver docs/analisis-gap-cgas/02, 05, 08).
//
// Los guards de concurrencia son atómicos a nivel de un solo documento
// (findOneAndUpdate con filtro de estado, no read-then-write), así que la corrección
// contra condiciones de carrera NO depende de que MongoDB esté en modo replica set.
// runInTransaction (txHelper) envuelve todo además en una transacción cuando el
// despliegue lo soporta, para revertir escrituras parciales ante fallos inesperados.

const Usuario = require('../models/Usuario');
const Vehiculo = require('../models/Vehiculo');
const Estacionamiento = require('../models/Estacionamiento');
const Transaccion = require('../models/Transaccion');
const ConfiguracionPrecio = require('../models/ConfiguracionPrecio');
const Sucursal = require('../models/Sucursal');
const ErrorResponse = require('../utils/errorResponse');
const { MEDIOS_PAGO } = require('../utils/mediosPago');
const { runInTransaction } = require('./txHelper');
const auditoriaService = require('./auditoriaService');
const comprobanteEstadiaService = require('./comprobanteEstadiaService');
const turnoService = require('./turnoService');
const Caja = require('../models/Caja');
const Feriado = require('../models/Feriado');
const tarifaEngine = require('./tarifaEngine');

// Si no se pasa sucursalId explícitamente, resuelve a la sucursal principal (despliegue
// de un solo local). Devuelve null si todavía no hay ninguna sucursal sembrada —
// el campo es opcional en los schemas, así que esto no bloquea la operación.
async function resolverSucursalId(sucursalId, session) {
  if (sucursalId) return sucursalId;
  const principal = await Sucursal.findOne({ esPrincipal: true }).session(session);
  return principal?._id ?? null;
}

// Movida tal cual desde estacionamientoController.js (era la implementación más completa
// de las 3 que existían — fallback de 3 niveles: tarifa asignada > ConfiguracionPrecio > hardcode).
//
// Devuelve además QUÉ nivel de la cascada resolvió el precio: la terminal de caja tiene que
// poder mostrar por qué se cobra lo que se cobra ("$1.500/h · Asociado"), y sin el origen
// sería un número sin defensa frente al cliente del otro lado del mostrador.
// Las reglas de cobro que viajan con la tarifa. Se separan del documento para que el resto del
// servicio no dependa de si vino de Mongoose o de un objeto armado a mano.
const reglasDe = (tarifa) => ({
  fraccionMinutos: tarifa?.fraccionMinutos ?? 60,
  topeDiario: tarifa?.topeDiario ?? null,
  recargos: tarifa?.recargos ?? {}
});

const SIN_CONFIGURAR = { fraccionMinutos: 60, topeDiario: null, recargos: {} };

// La cascada ahora tiene un escalón más: el tipo de vehículo. Antes auto y moto pagaban lo
// mismo porque la tarifa solo se resolvía por tipo de cliente — un gap que estaba anotado como
// "a decidir" desde el rediseño. Una tarifa específica de moto le gana a la general; si no hay
// específica, se usa la de siempre, así que una playa que no configura nada no cambia nada.
async function obtenerTarifaDetallada(usuario, tipoVehiculo = null) {
  try {
    if (usuario.tarifaAsignada) {
      const tarifaEspecifica = usuario.tarifaAsignada.precioPorHora !== undefined
        ? usuario.tarifaAsignada // ya viene populada por el llamador
        : await ConfiguracionPrecio.findById(usuario.tarifaAsignada);
      if (tarifaEspecifica && tarifaEspecifica.activo) {
        return {
          precioPorHora: tarifaEspecifica.precioPorHora,
          origen: 'asignada',
          etiqueta: tarifaEspecifica.descripcion || 'Tarifa asignada',
          reglas: reglasDe(tarifaEspecifica)
        };
      }
    }

    const tipoUsuario = usuario.asociado ? 'asociado' : 'no_asociado';

    // Primero la tarifa del tipo de vehículo concreto; después la general ('todos').
    const candidatas = await ConfiguracionPrecio.find({
      tipoUsuario,
      activo: true,
      tipoVehiculo: { $in: tipoVehiculo ? [tipoVehiculo, 'todos'] : ['todos'] }
    });
    const especifica = tipoVehiculo ? candidatas.find((t) => t.tipoVehiculo === tipoVehiculo) : null;
    // `tipoVehiculo` puede faltar en los documentos anteriores al campo: ausente es 'todos'.
    const general = candidatas.find((t) => (t.tipoVehiculo ?? 'todos') === 'todos');
    const configuracion = especifica ?? general;

    if (configuracion) {
      const etiquetaBase = usuario.asociado ? 'Asociado' : 'General';
      return {
        precioPorHora: configuracion.precioPorHora,
        origen: especifica ? `${tipoUsuario}_${tipoVehiculo}` : tipoUsuario,
        etiqueta: especifica ? `${etiquetaBase} · ${tipoVehiculo === 'moto' ? 'Moto' : 'Auto'}` : etiquetaBase,
        reglas: reglasDe(configuracion)
      };
    }

    return {
      precioPorHora: usuario.asociado ? 250 : 500,
      origen: 'default',
      etiqueta: usuario.asociado ? 'Asociado (sin configurar)' : 'General (sin configurar)',
      reglas: SIN_CONFIGURAR
    };
  } catch (error) {
    console.error('Error al obtener tarifa:', error);
    return {
      precioPorHora: usuario.asociado ? 250 : 500,
      origen: 'default',
      etiqueta: 'General (error al resolver)',
      reglas: SIN_CONFIGURAR
    };
  }
}

async function obtenerTarifa(usuario, tipoVehiculo = null) {
  const { precioPorHora } = await obtenerTarifaDetallada(usuario, tipoVehiculo);
  return precioPorHora;
}

// Usuario "anónimo" con el que se resuelve la tarifa de un cliente ocasional: sin cuenta no
// hay tarifa asignada ni condición de asociado, así que cae en la tarifa general.
const USUARIO_OCASIONAL = { asociado: false, tarifaAsignada: null };

// Los feriados se leen una vez por minuto y no en cada cobro: son un puñado de filas que casi
// nunca cambian, y la terminal recalcula el importe cada vez que alguien tipea una patente.
let feriadosCache = { valores: new Set(), vence: 0 };
async function feriadosVigentes(session) {
  if (Date.now() < feriadosCache.vence) return feriadosCache.valores;
  const filas = await Feriado.find({}, 'fecha').session(session ?? null).lean();
  feriadosCache = { valores: new Set(filas.map((f) => f.fecha)), vence: Date.now() + 60 * 1000 };
  return feriadosCache.valores;
}

// Única fuente del cálculo de duración e importe. La previsualización de la terminal
// (resolverPatente) y el cobro real (finalizarEstadia) llaman a esta misma función: si el
// redondeo viviera duplicado, la pantalla podría prometer un importe y la caja cobrar otro.
//
// La regla ya no es una sola: fracción configurable, recargos por momento y tope diario viven
// en services/tarifaEngine.js. Sin configuración, el resultado es idéntico al anterior —hora
// entera hacia arriba— y por eso el nombre y la forma de la respuesta no cambian.
async function calcularCobro({ horaInicio, horaFin, precioPorHora, reglas = SIN_CONFIGURAR, session = null }) {
  return tarifaEngine.calcularCobro({
    horaInicio,
    horaFin,
    precioPorHora,
    tarifa: reglas,
    feriados: await feriadosVigentes(session)
  });
}

// dni: presente → canal 'app' (cliente registrado), requiere Vehiculo pre-existente y
//      saldo prepago positivo, igual que antes de Etapa 2.
// dni ausente → canal 'caja'/'manual' (cliente ocasional, ver docs/analisis-gap-cgas/07):
//      no hay Usuario ni saldo que validar; el Vehiculo se reutiliza si ya existe o se
//      crea sin dueño con los datos mínimos disponibles (marca/modelo/año quedan como
//      placeholder si no se proveen, ya que el schema los sigue exigiendo).
async function iniciarEstadia({
  dni = null,
  dominio,
  porton = null,
  origen = dni ? 'app' : 'caja',
  clienteOcasional = null,
  operadorId = null,
  sucursalId = null,
  tipoVehiculo = 'auto'
}) {
  return runInTransaction(async (session) => {
    const sucursal = await resolverSucursalId(sucursalId, session);

    let usuario = null;
    if (dni) {
      usuario = await Usuario.findOne({ dni, activo: true })
        .populate('tarifaAsignada', 'tipoUsuario precioPorHora descripcion activo')
        .session(session);
      if (!usuario) {
        throw new ErrorResponse('Usuario no encontrado o inactivo', 404);
      }
      // El saldo solo condiciona el autoservicio: en el canal 'app' el cliente entra sabiendo
      // que va a pagar con saldo prepago, así que entrar sin saldo es entrar a una deuda.
      // Desde caja el medio de pago se decide recién en el egreso (efectivo/tarjeta/QR), y
      // bloquear el ingreso de un cliente registrado con saldo 0 dejaría al auto en la puerta
      // por una regla que no aplica a cómo va a pagar.
      if (origen === 'app' && usuario.montoDisponible <= 0) {
        throw new ErrorResponse('Saldo insuficiente. Por favor, recargue su saldo antes de estacionar.', 400);
      }
    }

    // Guard atómico contra doble ingreso: solo un request concurrente gana el flip.
    let vehiculo = await Vehiculo.findOneAndUpdate(
      { dominio, estActivo: { $ne: true } },
      { $set: { estActivo: true, ultimoIngreso: new Date() } },
      { returnDocument: 'after', session }
    );
    if (!vehiculo) {
      const existe = await Vehiculo.findOne({ dominio }).session(session);
      if (existe) {
        throw new ErrorResponse('Ya tiene un estacionamiento activo para este vehículo', 409);
      }
      if (dni) {
        // Canal app: el vehículo debe haber sido dado de alta por el usuario antes.
        throw new ErrorResponse('Vehículo no encontrado', 404);
      }
      // Canal caja/manual: alta rápida sin dueño (ver doc 07 sección 3).
      // Sin marca/modelo/año: son opcionales y el mostrador no los conoce. La UI muestra la
      // ausencia como ausencia, no como la cadena 'Sin datos'.
      const [creado] = await Vehiculo.create(
        [{
          dominio,
          tipo: tipoVehiculo,
          usuario: null,
          sucursalId: sucursal,
          estActivo: true,
          ultimoIngreso: new Date()
        }],
        { session }
      );
      vehiculo = creado;
    }

    const horaInicio = vehiculo.ultimoIngreso;
    const [nuevoEstacionamiento] = await Estacionamiento.create(
      [{
        usuarioDNI: dni,
        vehiculoDominio: dominio,
        horaInicio,
        porton,
        clienteOcasional: clienteOcasional || undefined,
        origen,
        operadorId,
        sucursalId: sucursal
      }],
      { session }
    );

    // La tarifa que se anota en el ingreso es informativa —el importe se calcula al salir—,
    // pero se resuelve con el tipo de vehículo igual, para que diga lo mismo que va a cobrarse.
    const tarifa = await obtenerTarifa(usuario || USUARIO_OCASIONAL, vehiculo?.tipo ?? null);
    const [nuevaTransaccion] = await Transaccion.create(
      [{
        tipo: 'ingreso',
        usuario: usuario?._id ?? null,
        vehiculo: {
          dominio: vehiculo.dominio,
          marca: vehiculo.marca,
          modelo: vehiculo.modelo,
          tipo: vehiculo.tipo
        },
        propietario: usuario ? { dni: usuario.dni, nombre: usuario.nombre, apellido: usuario.apellido } : undefined,
        clienteOcasional: clienteOcasional || undefined,
        origen,
        operadorId,
        sucursalId: sucursal,
        porton,
        fechaHora: horaInicio,
        tarifa,
        montoTotal: 0
      }],
      { session }
    );

    await auditoriaService.registrar({
      entidad: 'Estacionamiento',
      entidadId: nuevoEstacionamiento._id,
      accion: 'ingreso',
      usuarioId: usuario?._id ?? operadorId,
      usuarioDni: usuario?.dni ?? null,
      datosNuevos: { dominio, porton, horaInicio, origen },
      session
    });

    return { estacionamiento: nuevoEstacionamiento, transaccion: nuevaTransaccion };
  });
}

// medioPago: 'efectivo'|'tarjeta'|'qr_transferencia'|'saldo_prepago'. Si se omite y la
// estadía tiene un Usuario asociado, se asume 'saldo_prepago' (comportamiento histórico,
// canal app). Para cliente ocasional (sin Usuario) es obligatorio — no hay saldo del que
// debitar.
//
// Turno/caja (Etapa 4): un cobro que NO sea saldo_prepago y NO venga del canal 'app'
// (es decir, canal caja/manual — un operador de por medio) requiere un Turno abierto en
// la Caja de la sucursal: ese dinero físico necesita un lugar donde conciliarse. El canal
// app queda exento siempre (autoservicio, sin cajero físico presente) aunque el usuario
// elija un medioPago no digital.
// operadorId: quién está cobrando AHORA (puede diferir de quien inició la estadía, ver
// doc 06 "Pago realizado por otro operador"); si no se pasa, se usa el operador que
// inició la estadía.
async function finalizarEstadia({ dominio, medioPago = null, sucursalId = null, operadorId = null }) {
  return runInTransaction(async (session) => {
    const horaFin = new Date();

    // Guard atómico contra doble egreso: el filtro {estado:'activo'} es el compare-and-swap.
    // new:false devuelve el documento previo al update (necesitamos horaInicio/porton de ahí).
    const estacionamientoPrevio = await Estacionamiento.findOneAndUpdate(
      { vehiculoDominio: dominio, estado: 'activo' },
      { $set: { estado: 'finalizado', horaFin } },
      { returnDocument: 'before', session }
    );
    if (!estacionamientoPrevio) {
      // Distinguir "nunca hubo estadía para este dominio" (404) de "ya fue finalizada
      // por otro request concurrente, o nunca estuvo activa" (409) — sin esto, el
      // perdedor de una carrera de doble-egreso recibía 404 en vez de 409.
      const existeAlguna = await Estacionamiento.exists({ vehiculoDominio: dominio }).session(session);
      if (!existeAlguna) {
        throw new ErrorResponse('No hay estacionamiento activo para este vehículo', 404);
      }

      const vehiculo = await Vehiculo.findOne({ dominio }).session(session);
      if (vehiculo?.estActivo) {
        // Vehículo marcado activo sin estadía activa asociada — reparar el estado inconsistente.
        await Vehiculo.updateOne({ _id: vehiculo._id }, { $set: { estActivo: false } }, { session });
      }
      throw new ErrorResponse('El estacionamiento ya fue finalizado', 409);
    }

    // El DNI se toma del registro de la estadía, no de un valor externo, para que el
    // cobro siempre corresponda al dueño real de la estadía que se está cerrando.
    // Cliente ocasional (Etapa 2): estacionamientoPrevio.usuarioDNI es null, no hay Usuario.
    const usuario = estacionamientoPrevio.usuarioDNI
      ? await Usuario.findOne({ dni: estacionamientoPrevio.usuarioDNI, activo: true })
          .populate('tarifaAsignada', 'tipoUsuario precioPorHora descripcion activo')
          .session(session)
      : null;
    if (estacionamientoPrevio.usuarioDNI && !usuario) {
      throw new ErrorResponse('Usuario no encontrado o inactivo', 404);
    }

    const medioPagoResuelto = medioPago || (usuario ? 'saldo_prepago' : null);
    if (!medioPagoResuelto) {
      throw new ErrorResponse('medioPago es obligatorio para cobrar una estadía de cliente ocasional', 400);
    }
    if (!MEDIOS_PAGO.includes(medioPagoResuelto)) {
      throw new ErrorResponse(`medioPago inválido. Debe ser uno de: ${MEDIOS_PAGO.join(', ')}`, 400);
    }
    if (medioPagoResuelto === 'saldo_prepago' && !usuario) {
      throw new ErrorResponse('No se puede pagar con saldo prepago sin una cuenta registrada', 400);
    }

    const sucursal = await resolverSucursalId(sucursalId || estacionamientoPrevio.sucursalId, session);

    const requiereTurno = estacionamientoPrevio.origen !== 'app' && medioPagoResuelto !== 'saldo_prepago';
    let turnoActivo = null;
    let cajaActiva = null;
    if (requiereTurno) {
      cajaActiva = await Caja.findOne({ sucursalId: sucursal, activa: true }).session(session);
      if (!cajaActiva) {
        throw new ErrorResponse('No hay una caja configurada para esta sucursal — ver utils/seedData.js', 500);
      }
      turnoActivo = await turnoService.obtenerTurnoAbierto({ cajaId: cajaActiva._id, session });
      if (!turnoActivo) {
        throw new ErrorResponse('No hay turno abierto para registrar este cobro. Abrí un turno antes de cobrar en efectivo/tarjeta/QR.', 409);
      }
    }

    // Misma función que usa la previsualización de la terminal (resolverPatente): el importe
    // que se cobra acá es el que la pantalla mostró antes de que el cajero apretara COBRAR.
    // El tipo de vehículo entra en la resolución: desde ahora una moto puede tener su tarifa.
    const vehiculoDeLaEstadia = await Vehiculo.findOne({ dominio }).session(session);
    const detalleTarifa = await obtenerTarifaDetallada(usuario || USUARIO_OCASIONAL, vehiculoDeLaEstadia?.tipo ?? null);
    const tarifa = detalleTarifa.precioPorHora;
    const { duracionHorasReal, duracionHoras, montoTotal, recargosAplicados, topeAplicado } = await calcularCobro({
      horaInicio: estacionamientoPrevio.horaInicio,
      horaFin,
      precioPorHora: tarifa,
      reglas: detalleTarifa.reglas,
      session
    });

    if (medioPagoResuelto === 'saldo_prepago') {
      if (usuario.montoDisponible < montoTotal) {
        // Ya no hay competencia por este documento (el flip de arriba nos lo garantiza),
        // así que revertir es una compensación segura, no una nueva ventana de carrera.
        await Estacionamiento.updateOne(
          { _id: estacionamientoPrevio._id },
          { $set: { estado: 'activo' }, $unset: { horaFin: '' } },
          { session }
        );
        throw new ErrorResponse('Saldo insuficiente para finalizar el estacionamiento', 400);
      }
      usuario.montoDisponible -= montoTotal;
      await usuario.save({ session });
    }
    // Efectivo/tarjeta/QR: el cobro ocurre fuera del sistema (caja física/terminal); no hay
    // débito de saldo. Se registra como MovimientoCaja del turno más abajo (requiereTurno).

    const estacionamiento = await Estacionamiento.findOneAndUpdate(
      { _id: estacionamientoPrevio._id },
      { $set: { duracionHorasReal, duracionHoras, montoTotal } },
      { returnDocument: 'after', session }
    );

    const vehiculo = await Vehiculo.findOneAndUpdate(
      { dominio },
      { $set: { estActivo: false } },
      { returnDocument: 'after', session }
    );

    const transaccionIngreso = await Transaccion.findOneAndUpdate(
      { 'vehiculo.dominio': dominio, tipo: 'ingreso', estado: 'activo' },
      { $set: { estado: 'finalizado' } },
      { returnDocument: 'after', session }
    );

    const [transaccionSalida] = await Transaccion.create(
      [{
        tipo: 'salida',
        usuario: usuario?._id ?? null,
        vehiculo: {
          dominio: vehiculo.dominio,
          marca: vehiculo.marca,
          modelo: vehiculo.modelo,
          tipo: vehiculo.tipo
        },
        propietario: usuario ? { dni: usuario.dni, nombre: usuario.nombre, apellido: usuario.apellido } : undefined,
        clienteOcasional: estacionamiento.clienteOcasional || undefined,
        origen: estacionamiento.origen,
        operadorId: operadorId || estacionamiento.operadorId,
        sucursalId: sucursal,
        porton: estacionamiento.porton,
        fechaHora: horaFin,
        tarifa,
        montoTotal,
        medioPago: medioPagoResuelto,
        duracionHorasReal,
        duracionHoras,
        duracion: `${duracionHoras} hora(s)`,
        estado: 'finalizado'
      }],
      { session }
    );

    const comprobante = await comprobanteEstadiaService.generarComprobante({
      estacionamiento,
      transaccion: transaccionSalida,
      usuario,
      clienteOcasional: estacionamiento.clienteOcasional,
      medioPago: medioPagoResuelto,
      montoTotal,
      sucursalId: sucursal,
      session
    });

    let movimientoCaja = null;
    if (requiereTurno) {
      movimientoCaja = await turnoService.registrarMovimiento({
        turnoId: turnoActivo._id,
        tipo: 'ingreso',
        origen: 'cobro_estadia',
        medioPago: medioPagoResuelto,
        monto: montoTotal,
        estadiaId: estacionamiento._id,
        comprobanteId: comprobante._id,
        usuarioId: operadorId || estacionamiento.operadorId || usuario?._id,
        session
      });
    }

    await auditoriaService.registrar({
      entidad: 'Estacionamiento',
      entidadId: estacionamiento._id,
      accion: 'egreso',
      usuarioId: usuario?._id ?? estacionamiento.operadorId,
      usuarioDni: usuario?.dni ?? null,
      datosNuevos: { dominio, montoTotal, duracionHoras, medioPago: medioPagoResuelto, comprobante: comprobante.numero },
      session
    });

    return {
      duracionHorasReal,
      duracionHoras,
      montoTotal,
      montoDisponible: usuario?.montoDisponible ?? null,
      estacionamiento,
      transaccionSalida,
      transaccionIngreso,
      comprobante,
      movimientoCaja
    };
  });
}

// Resolución de patente para la terminal de caja: un solo request contesta las cuatro
// preguntas que el cajero necesita antes de tocar un botón — ¿está adentro?, ¿el vehículo es
// conocido?, ¿hay cliente registrado detrás?, ¿cuánto se cobra?. Sin esto, la terminal
// tendría que traer todas las estadías activas y filtrar en el cliente (lo que hace hoy
// CajaOperativa.jsx), y el importe recién aparecería después de cobrar.
//
// Es de solo lectura: no crea, no modifica y no reserva nada. El estado que devuelve es una
// foto del momento — el cobro real vuelve a resolver todo dentro de su transacción, así que
// dos cajeros sobre la misma patente siguen resolviéndose por el guard atómico del egreso,
// no por esta previsualización.
async function resolverPatente({ dominio, sucursalId = null }) {
  const dominioNormalizado = String(dominio || '').trim().toUpperCase();
  if (!dominioNormalizado) {
    throw new ErrorResponse('Ingresá una patente', 400);
  }

  const ahora = new Date();
  const [estadiaActiva, vehiculo] = await Promise.all([
    Estacionamiento.findOne({ vehiculoDominio: dominioNormalizado, estado: 'activo' }).lean(),
    Vehiculo.findOne({ dominio: dominioNormalizado }).lean()
  ]);

  // El titular sale del vehículo cuando está afuera, y del registro de la estadía cuando está
  // adentro: la estadía es la que manda sobre a quién se le cobra (mismo criterio que el egreso).
  const dniTitular = estadiaActiva ? estadiaActiva.usuarioDNI : null;
  const usuario = dniTitular
    ? await Usuario.findOne({ dni: dniTitular, activo: true })
        .populate('tarifaAsignada', 'tipoUsuario precioPorHora descripcion activo')
        .lean()
    : (!estadiaActiva && vehiculo?.usuario
        ? await Usuario.findOne({ _id: vehiculo.usuario, activo: true })
            .populate('tarifaAsignada', 'tipoUsuario precioPorHora descripcion activo')
            .lean()
        : null);

  const tarifa = await obtenerTarifaDetallada(usuario || USUARIO_OCASIONAL, vehiculo?.tipo ?? null);

  const cliente = usuario
    ? {
        tipo: 'registrado',
        dni: usuario.dni,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        asociado: !!usuario.asociado,
        montoDisponible: usuario.montoDisponible ?? 0
      }
    : { tipo: 'ocasional' };

  const datosVehiculo = vehiculo
    ? { dominio: vehiculo.dominio, marca: vehiculo.marca, modelo: vehiculo.modelo, tipo: vehiculo.tipo }
    : null;

  if (!estadiaActiva) {
    // La salida de excepción se ofrece solo si hay tarifa configurada: sin monto, el flujo
    // cobraría cero. La UI la muestra como última opción, nunca como la primera.
    const sucursalActual = await Sucursal.findOne({ esPrincipal: true }).lean();

    return {
      dominio: dominioNormalizado,
      estado: 'afuera',
      accion: 'ingresar',
      vehiculo: datosVehiculo,
      vehiculoNuevo: !vehiculo,
      cliente,
      tarifa,
      excepcion: {
        disponible: sucursalActual?.tarifaExcepcion != null,
        monto: sucursalActual?.tarifaExcepcion ?? null
      },
      // Vehículo marcado como dentro sin estadía activa: estado inconsistente heredado de un
      // fallo previo. La terminal lo usa para ofrecer el camino de "no aparece al salir" en vez
      // de proponer un ingreso que va a chocar contra el guard de doble ingreso.
      inconsistencia: !!vehiculo?.estActivo
    };
  }

  const cobro = await calcularCobro({
    horaInicio: estadiaActiva.horaInicio,
    horaFin: ahora,
    precioPorHora: tarifa.precioPorHora,
    reglas: tarifa.reglas
  });

  // Estado del turno resuelto acá y no al confirmar: el cajero tiene que ver el bloqueo antes
  // de elegir medio de pago, no después de apretar COBRAR (el 409 de finalizarEstadia sigue
  // siendo la validación real; esto solo evita que se entere tarde).
  const sucursal = await resolverSucursalId(sucursalId || estadiaActiva.sucursalId, null);
  const requiereTurno = estadiaActiva.origen !== 'app';
  let turno = { requiere: requiereTurno, abierto: false, numero: null, caja: null };
  if (requiereTurno) {
    const caja = await Caja.findOne({ sucursalId: sucursal, activa: true }).lean();
    const turnoAbierto = caja ? await turnoService.obtenerTurnoAbierto({ cajaId: caja._id }) : null;
    turno = {
      requiere: true,
      abierto: !!turnoAbierto,
      numero: turnoAbierto?.numero ?? null,
      caja: caja ? { id: caja._id, nombre: caja.nombre } : null
    };
  }

  // Cada medio viene con su motivo de indisponibilidad: un botón apagado sin explicación
  // obliga al cajero a adivinar con el cliente esperando.
  const mediosPago = MEDIOS_PAGO.map((medio) => {
    if (medio === 'saldo_prepago') {
      if (!usuario) {
        return { medio, disponible: false, motivo: 'Sin cuenta registrada' };
      }
      if ((usuario.montoDisponible ?? 0) < cobro.montoTotal) {
        return {
          medio,
          disponible: false,
          motivo: `Saldo $${usuario.montoDisponible ?? 0} — no alcanza`
        };
      }
      return { medio, disponible: true, motivo: null };
    }
    if (requiereTurno && !turno.abierto) {
      return { medio, disponible: false, motivo: 'No hay turno abierto' };
    }
    return { medio, disponible: true, motivo: null };
  });

  return {
    dominio: dominioNormalizado,
    estado: 'adentro',
    accion: 'cobrar',
    vehiculo: datosVehiculo,
    cliente: usuario ? cliente : { tipo: 'ocasional', ...(estadiaActiva.clienteOcasional || {}) },
    tarifa,
    estadia: {
      id: estadiaActiva._id,
      horaInicio: estadiaActiva.horaInicio,
      porton: estadiaActiva.porton,
      origen: estadiaActiva.origen
    },
    cobro: {
      ahora,
      duracionHorasReal: cobro.duracionHorasReal,
      duracionHoras: cobro.duracionHoras,
      montoTotal: cobro.montoTotal,
      // La terminal muestra el redondeo explícito ("2h 12m → se cobran 3h") para que el cajero
      // pueda defender el importe sin llamar al dueño. Con fracción distinta de la hora, el
      // texto lo arma la pantalla con estos dos datos.
      redondeo: cobro.fraccionMinutos === 60 ? 'hora_hacia_arriba' : 'fraccion_hacia_arriba',
      fraccionMinutos: cobro.fraccionMinutos,
      fracciones: cobro.fracciones,
      // Por qué se cobra de más, o por qué se cobra menos de lo que daría la cuenta simple:
      // sin esto el importe es un número sin defensa frente al cliente del otro lado.
      recargos: cobro.recargosAplicados,
      topeAplicado: cobro.topeAplicado
    },
    turno,
    mediosPago
  };
}

// Egreso de excepción — "ticket perdido": el auto está en la salida y no hay registro de
// ingreso (se tipeó mal la patente, entró sin registrar, o el sistema estuvo caído).
//
// Es un caso de negocio de primera clase en todos los sistemas del rubro, no una rareza. Se
// cobra un importe fijo configurado, sin discutir, y queda asentado como excepción.
//
// Dos reglas que sostienen el control interno:
//   1. El monto NO viene del request. Sale de la configuración de la sucursal. Si el cajero
//      pudiera escribirlo, la excepción se volvería un acuerdo de mostrador.
//   2. El motivo es obligatorio, y la operación es de rol operador: NO pide autorización de
//      admin. Con el auto en la barrera, el control tiene que ser posterior (auditoría),
//      no previo — si no, la salida se traba con el cliente esperando.
async function egresoExcepcion({ dominio, medioPago, motivo, operadorId = null, sucursalId = null }) {
  const dominioNormalizado = String(dominio || '').trim().toUpperCase();
  if (!dominioNormalizado) {
    throw new ErrorResponse('Ingresá una patente', 400);
  }
  if (!motivo || !String(motivo).trim()) {
    throw new ErrorResponse('El motivo es obligatorio para cobrar una estadía no registrada', 400);
  }
  if (!medioPago || !MEDIOS_PAGO.includes(medioPago)) {
    throw new ErrorResponse(`medioPago inválido. Debe ser uno de: ${MEDIOS_PAGO.join(', ')}`, 400);
  }
  // El saldo prepago pertenece a una cuenta, y acá no hay estadía ni titular que la respalde.
  if (medioPago === 'saldo_prepago') {
    throw new ErrorResponse('Una estadía no registrada no se puede cobrar con saldo prepago', 400);
  }

  return runInTransaction(async (session) => {
    // Guard: si la patente SÍ tiene estadía activa, esto no es una excepción — es un cobro
    // normal, y cobrarlo como excepción le saldría más caro al cliente sin motivo.
    const activa = await Estacionamiento.findOne(
      { vehiculoDominio: dominioNormalizado, estado: 'activo' }
    ).session(session);
    if (activa) {
      throw new ErrorResponse(
        `${dominioNormalizado} tiene una estadía activa. Cobrala normalmente en vez de como excepción.`,
        409
      );
    }

    const sucursal = await resolverSucursalId(sucursalId, session);
    const datosSucursal = await Sucursal.findById(sucursal).session(session);
    const montoTotal = datosSucursal?.tarifaExcepcion ?? null;
    if (montoTotal == null) {
      throw new ErrorResponse(
        'No hay una tarifa de excepción configurada para esta sucursal. Configurala antes de cobrar estadías no registradas.',
        409
      );
    }

    const caja = await Caja.findOne({ sucursalId: sucursal, activa: true }).session(session);
    if (!caja) {
      throw new ErrorResponse('No hay una caja configurada para esta sucursal', 500);
    }
    const turnoActivo = await turnoService.obtenerTurnoAbierto({ cajaId: caja._id, session });
    if (!turnoActivo) {
      throw new ErrorResponse('No hay turno abierto para registrar este cobro. Abrí un turno antes de cobrar.', 409);
    }

    const ahora = new Date();

    // El vehículo puede no existir en el catálogo: se crea sin dueño, como cualquier ocasional.
    let vehiculo = await Vehiculo.findOne({ dominio: dominioNormalizado }).session(session);
    if (!vehiculo) {
      const [creado] = await Vehiculo.create(
        [{ dominio: dominioNormalizado, tipo: 'auto', usuario: null, sucursalId: sucursal, estActivo: false }],
        { session }
      );
      vehiculo = creado;
    } else if (vehiculo.estActivo) {
      // Estado inconsistente heredado (marcado dentro sin estadía activa): se corrige acá.
      await Vehiculo.updateOne({ _id: vehiculo._id }, { $set: { estActivo: false } }, { session });
    }

    // Se guarda como estadía ya finalizada: horaInicio = horaFin porque el ingreso es
    // justamente lo que no se conoce. Inventar una hora de entrada sería peor que no tenerla.
    const [estacionamiento] = await Estacionamiento.create(
      [{
        usuarioDNI: null,
        vehiculoDominio: dominioNormalizado,
        horaInicio: ahora,
        horaFin: ahora,
        duracionHoras: 0,
        duracionHorasReal: 0,
        montoTotal,
        estado: 'finalizado',
        origen: 'excepcion',
        motivoExcepcion: String(motivo).trim(),
        operadorId,
        sucursalId: sucursal
      }],
      { session }
    );

    const [transaccionSalida] = await Transaccion.create(
      [{
        tipo: 'salida',
        usuario: null,
        vehiculo: { dominio: vehiculo.dominio, marca: vehiculo.marca, modelo: vehiculo.modelo, tipo: vehiculo.tipo },
        origen: 'excepcion',
        operadorId,
        sucursalId: sucursal,
        fechaHora: ahora,
        tarifa: 0,
        montoTotal,
        medioPago,
        duracionHoras: 0,
        duracionHorasReal: 0,
        duracion: 'estadía no registrada',
        estado: 'finalizado'
      }],
      { session }
    );

    const comprobante = await comprobanteEstadiaService.generarComprobante({
      estacionamiento,
      transaccion: transaccionSalida,
      usuario: null,
      clienteOcasional: null,
      medioPago,
      montoTotal,
      sucursalId: sucursal,
      session
    });

    const movimientoCaja = await turnoService.registrarMovimiento({
      turnoId: turnoActivo._id,
      tipo: 'ingreso',
      origen: 'cobro_estadia',
      medioPago,
      monto: montoTotal,
      motivo: `Estadía no registrada — ${String(motivo).trim()}`,
      estadiaId: estacionamiento._id,
      comprobanteId: comprobante._id,
      usuarioId: operadorId,
      session
    });

    await auditoriaService.registrar({
      entidad: 'Estacionamiento',
      entidadId: estacionamiento._id,
      accion: 'egreso_excepcion',
      usuarioId: operadorId,
      datosNuevos: { dominio: dominioNormalizado, montoTotal, medioPago, comprobante: comprobante.numero },
      motivo: String(motivo).trim(),
      session
    });

    return { montoTotal, estacionamiento, transaccionSalida, comprobante, movimientoCaja };
  });
}

module.exports = {
  obtenerTarifa,
  obtenerTarifaDetallada,
  calcularCobro,
  resolverPatente,
  iniciarEstadia,
  finalizarEstadia,
  egresoExcepcion
};
