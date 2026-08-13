// Operación de caja sin cuenta del cliente (ver docs/analisis-gap-cgas/07/08 Etapa 5).
// Los 3 endpoints son wrappers delgados: toda la lógica de negocio ya vive en
// estadiaService (ingreso/egreso) desde las Etapas 0/2/3/4 — acá solo se resuelve el
// operador desde el JWT y se traduce HTTP <-> servicio, sin duplicar reglas.

const Estacionamiento = require('../models/Estacionamiento');
const Vehiculo = require('../models/Vehiculo');
const Sucursal = require('../models/Sucursal');
const Usuario = require('../models/Usuario');
const ComprobanteEstadia = require('../models/ComprobanteEstadia');
const estadiaService = require('../services/estadiaService');
const { aTexto, paginar, totalPaginas, rangoDeFechas, regexContiene } = require('../utils/consultas');

const ingresoManual = async (req, res, next) => {
  try {
    // `porton` sigue aceptándose por compatibilidad, pero ya no se exige: era una interacción
    // por ingreso para escribir un dato que ninguna consulta leía (ver models/Estacionamiento.js).
    const { dominio, dni = null, porton = null, tipoVehiculo = 'auto', clienteOcasional } = req.body;
    if (!dominio) {
      return res.status(400).json({ mensaje: 'dominio es obligatorio' });
    }

    const resultado = await estadiaService.iniciarEstadia({
      dni,
      dominio: aTexto(dominio).trim().toUpperCase(),
      porton,
      tipoVehiculo,
      origen: 'caja',
      operadorId: req.usuarioActual._id,
      clienteOcasional: dni ? null : clienteOcasional
    });

    res.status(200).json({ mensaje: 'Ingreso registrado correctamente', ...resultado });
  } catch (error) {
    next(error);
  }
};

const egresoManual = async (req, res, next) => {
  try {
    const { dominio, medioPago } = req.body;
    if (!dominio || !medioPago) {
      return res.status(400).json({ mensaje: 'dominio y medioPago son obligatorios' });
    }

    const resultado = await estadiaService.finalizarEstadia({
      dominio: aTexto(dominio).trim().toUpperCase(),
      medioPago,
      operadorId: req.usuarioActual._id
    });

    res.status(200).json({ mensaje: 'Egreso registrado correctamente', ...resultado });
  } catch (error) {
    next(error);
  }
};

// Historial de estadías: lo que ya pasó. `listarActivas` responde "qué hay adentro ahora" y
// es la consulta de la Terminal; esta responde "qué pasó" y es la de administración, con
// filtros y paginación porque la colección crece sin techo.
const listarHistorial = async (req, res, next) => {
  try {
    const { dominio, estado, origen } = req.query;
    const { pagina, limite, salto } = paginar(req.query, { porDefecto: 25 });

    const filtro = {};
    if (estado) filtro.estado = estado;
    if (origen) filtro.origen = origen;
    // La patente se busca como texto, no como expresión regular: sin escapar, un término como
    // `(a+)+$` deja al servidor calculando durante minutos por un solo request.
    if (dominio) filtro.vehiculoDominio = regexContiene(aTexto(dominio).toUpperCase());
    const rango = rangoDeFechas(req.query, 'ingreso');
    if (rango) filtro.horaInicio = rango;

    const [estadias, total] = await Promise.all([
      Estacionamiento.find(filtro).sort({ horaInicio: -1 }).skip(salto).limit(limite).lean(),
      Estacionamiento.countDocuments(filtro)
    ]);

    // El nombre del cliente registrado no vive en la estadía (solo el DNI): se resuelve en una
    // sola consulta para toda la página, no una por fila.
    const dnis = [...new Set(estadias.map((e) => e.usuarioDNI).filter(Boolean))];
    const usuarios = dnis.length ? await Usuario.find({ dni: { $in: dnis } }, 'dni nombre apellido').lean() : [];
    const porDni = Object.fromEntries(usuarios.map((u) => [u.dni, u]));

    res.status(200).json({
      estadias: estadias.map((estadia) => ({ ...estadia, cliente: porDni[estadia.usuarioDNI] ?? null })),
      total,
      pagina,
      limite,
      totalPaginas: totalPaginas(total, limite)
    });
  } catch (error) {
    next(error);
  }
};

// Las estadías del conductor autenticado, con el comprobante de cada una. Es lo que la app
// del cliente promete en su página de inicio: "cada estadía con su hora de ingreso, su
// duración y lo que se cobró", más el comprobante para descargar.
//
// Va por DNI del token, nunca por un parámetro: un cliente no puede pedir el historial de
// otro cambiando un número en la URL.
const listarMias = async (req, res, next) => {
  try {
    const { dni } = req.usuario;
    const { pagina, limite, salto } = paginar(req.query);

    const [estadias, total] = await Promise.all([
      Estacionamiento.find({ usuarioDNI: dni }).sort({ horaInicio: -1 }).skip(salto).limit(limite).lean(),
      Estacionamiento.countDocuments({ usuarioDNI: dni })
    ]);

    // El comprobante se resuelve para toda la página de una sola vez.
    const ids = estadias.map((e) => e._id);
    const comprobantes = ids.length
      ? await ComprobanteEstadia.find({ estadiaId: { $in: ids } }, 'estadiaId numero puntoVenta total medioPago estado').lean()
      : [];
    const porEstadia = Object.fromEntries(comprobantes.map((c) => [String(c.estadiaId), c]));

    res.status(200).json({
      estadias: estadias.map((estadia) => ({ ...estadia, comprobante: porEstadia[String(estadia._id)] ?? null })),
      total,
      pagina,
      limite,
      totalPaginas: totalPaginas(total, limite)
    });
  } catch (error) {
    next(error);
  }
};

// Doc 07 sección 4, paso 1: "Cajero busca por patente / listado de vehículos dentro".
// Estacionamiento.vehiculoDominio es un string suelto (no ObjectId+ref, ver doc 01
// hallazgo 3), así que se resuelve el detalle del vehículo con una segunda consulta
// en vez de un populate.
const listarActivas = async (req, res, next) => {
  try {
    const activas = await Estacionamiento.find({ estado: 'activo' }).sort({ horaInicio: -1 }).lean();
    const dominios = activas.map((e) => e.vehiculoDominio);
    const vehiculos = await Vehiculo.find({ dominio: { $in: dominios } }).lean();
    const vehiculoPorDominio = Object.fromEntries(vehiculos.map((v) => [v.dominio, v]));

    const resultado = activas.map((estadia) => ({
      ...estadia,
      vehiculo: vehiculoPorDominio[estadia.vehiculoDominio] || null
    }));

    // La ocupación viaja con el listado y no en un request aparte: la terminal muestra las dos
    // cosas juntas y son la misma consulta. `capacidad` en null significa que la sucursal no
    // la tiene configurada — la UI muestra el número de adentro sin denominador, en vez de
    // inventar un total.
    const sucursal = await Sucursal.findOne({ esPrincipal: true }).lean();
    const dentroPorTipo = resultado.reduce((acc, estadia) => {
      const tipo = estadia.vehiculo?.tipo || 'auto';
      acc[tipo] = (acc[tipo] || 0) + 1;
      return acc;
    }, {});

    res.status(200).json({
      activas: resultado,
      ocupacion: {
        dentro: resultado.length,
        dentroPorTipo,
        capacidad: sucursal?.capacidad?.total ?? null,
        capacidadPorTipo: {
          auto: sucursal?.capacidad?.auto ?? null,
          moto: sucursal?.capacidad?.moto ?? null
        },
        completa: sucursal?.capacidad?.total != null && resultado.length >= sucursal.capacidad.total
      }
    });
  } catch (error) {
    next(error);
  }
};

// Doc 07 sección 8: PATENTE → ¿adentro? → INGRESAR o COBRAR. Un solo request resuelve la
// bifurcación completa, incluido el importe, para que la terminal no tenga que decidirla
// trayendo todas las estadías activas ni cobrar antes de saber cuánto.
const resolverPatente = async (req, res, next) => {
  try {
    const resultado = await estadiaService.resolverPatente({ dominio: req.params.dominio });
    res.status(200).json(resultado);
  } catch (error) {
    next(error);
  }
};

// Ticket perdido: el auto está en la salida y no hay registro de ingreso. Importe fijo desde
// configuración —nunca del request— y motivo obligatorio. Ver estadiaService.egresoExcepcion.
const egresoExcepcion = async (req, res, next) => {
  try {
    const { dominio, medioPago, motivo } = req.body;
    const resultado = await estadiaService.egresoExcepcion({
      dominio,
      medioPago,
      motivo,
      operadorId: req.usuarioActual._id
    });
    res.status(200).json({ mensaje: 'Estadía no registrada cobrada correctamente', ...resultado });
  } catch (error) {
    next(error);
  }
};

module.exports = { ingresoManual, egresoManual, listarActivas, listarHistorial, listarMias, resolverPatente, egresoExcepcion };
