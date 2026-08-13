// Comprobantes de estadía: listado, detalle, PDF y envío por mail.
//
// Hasta ahora estos comprobantes se creaban en cada egreso y NO tenían ninguna superficie de
// lectura: existían en la base y no había forma de encontrarlos, descargarlos ni reenviarlos.
// `routes/comprobantes.js` es otra cosa — cubre los comprobantes de recarga de saldo.

const ComprobanteEstadia = require('../models/ComprobanteEstadia');
const Estacionamiento = require('../models/Estacionamiento');
const Usuario = require('../models/Usuario');
const auditoriaService = require('../services/auditoriaService');
const { enviarMail } = require('../services/mailService');
const { escribirPdf, generarBuffer, nombreArchivo, numeroFormateado } = require('../services/comprobanteEstadiaPdf');
const { aTexto, paginar, totalPaginas, rangoDeFechas, regexContiene } = require('../utils/consultas');

// Estado de la facturación electrónica: si está configurada, cuántos comprobantes esperan CAE
// y cuántos quedaron con error. Es lo que el panel muestra arriba de la lista — una cola que
// crece sin que nadie la mire es exactamente el problema que la emisión diferida podría causar
// si no se hiciera visible.
const estadoFiscal = async (req, res, next) => {
  try {
    const { estadoIntegracion } = require('../services/arca');
    const { estadoWorker } = require('../services/arca/worker');
    const { MAX_INTENTOS } = require('../services/facturacionElectronicaService');

    const [pendientes, conError, agotados, emitidos, simulados] = await Promise.all([
      ComprobanteEstadia.countDocuments({ estado: 'pendiente_cae', cae: null }),
      ComprobanteEstadia.countDocuments({ estado: 'error_arca', cae: null, intentosArca: { $lt: MAX_INTENTOS } }),
      // Los que agotaron los reintentos ya no los toma el worker: necesitan que alguien mire.
      ComprobanteEstadia.countDocuments({ cae: null, intentosArca: { $gte: MAX_INTENTOS } }),
      ComprobanteEstadia.countDocuments({ cae: { $ne: null } }),
      ComprobanteEstadia.countDocuments({ simulado: true })
    ]);

    res.status(200).json({
      integracion: estadoIntegracion(),
      worker: estadoWorker(),
      comprobantes: { pendientes, conError, agotados, emitidos, simulados },
      maxIntentos: MAX_INTENTOS
    });
  } catch (error) {
    next(error);
  }
};

// Reintento manual de un comprobante puntual. Sirve para los que agotaron los intentos
// automáticos: alguien corrigió el dato que ARCA rechazaba y quiere volver a probar sin
// esperar la próxima vuelta del worker.
const reintentarCae = async (req, res, next) => {
  try {
    const { emitirComprobante } = require('../services/facturacionElectronicaService');
    const resultado = await emitirComprobante(req.params.id);

    if (resultado.yaEmitido) {
      return res.status(200).json({ mensaje: 'Este comprobante ya tenía CAE', comprobante: resultado.comprobante });
    }

    res.status(200).json({
      mensaje: `ARCA autorizó el comprobante${resultado.simulado ? ' (simulado)' : ''}`,
      cae: resultado.cae,
      comprobante: resultado.comprobante
    });
  } catch (error) {
    // Un rechazo de ARCA no es un error del servidor: es una respuesta que el operador tiene
    // que leer. Va con 409 y el detalle, no con un 500.
    if (error.rechazadoPorArca) {
      return res.status(409).json({ mensaje: error.message, erroresArca: error.erroresArca ?? [] });
    }
    next(error);
  }
};

// Anulación. Un comprobante con CAE no se borra: se compensa con una nota de crédito, que es
// otro comprobante fiscal. Por eso la respuesta distingue los dos casos — el operador tiene
// que saber si acaba de emitir un comprobante nuevo o si solo dio de baja un ticket.
const anular = async (req, res, next) => {
  try {
    const { anularComprobante } = require('../services/facturacionElectronicaService');
    const { comprobante, notaCredito } = await anularComprobante(req.params.id, { motivo: req.body?.motivo });

    res.status(200).json({
      mensaje: notaCredito
        ? `Comprobante anulado con nota de crédito N° ${String(notaCredito.numero).padStart(8, '0')}` +
          (notaCredito.cae ? '' : ' (esperando el CAE de ARCA)')
        : 'Comprobante anulado. No requirió nota de crédito: no llegó a emitirse ante ARCA.',
      comprobante,
      notaCredito
    });
  } catch (error) {
    if (error.rechazadoPorArca) {
      return res.status(409).json({ mensaje: error.message, erroresArca: error.erroresArca ?? [] });
    }
    // Los rechazos de esta operación son reglas de negocio ("ya está anulado", "falta el
    // motivo"), no fallas: van con 400 y el texto tal cual, que es lo que se muestra.
    if (/motivo|anulad|nota de crédito|no encontrado/i.test(error.message)) {
      return res.status(400).json({ mensaje: error.message });
    }
    next(error);
  }
};

// Reconciliación manual: compara nuestra numeración fiscal con la de ARCA y recupera lo que
// falte. Es admin porque el resultado se lee, se interpreta y a veces obliga a buscar papeles.
const reconciliarFiscal = async (req, res, next) => {
  try {
    const { reconciliar } = require('../services/facturacionElectronicaService');
    const resultado = await reconciliar(req.body ?? {});
    res.status(200).json(resultado);
  } catch (error) {
    next(error);
  }
};

const listar = async (req, res, next) => {
  try {
    const { medioPago, estado, q } = req.query;
    const { pagina, limite, salto } = paginar(req.query, { porDefecto: 25 });

    const filtro = {};
    if (medioPago) filtro.medioPago = medioPago;
    if (estado) filtro.estado = estado;
    const rango = rangoDeFechas(req.query, 'emisión');
    if (rango) filtro.fechaEmision = rango;

    // La búsqueda acepta las dos formas en que alguien busca un comprobante: por su número o
    // por la patente del auto. Nadie recuerda el ObjectId de una estadía.
    if (aTexto(q).trim()) {
      const termino = aTexto(q).trim();
      const soloDigitos = termino.replace(/\D/g, '');
      const estadias = await Estacionamiento.find(
        { vehiculoDominio: regexContiene(termino.toUpperCase()) },
        '_id'
      ).limit(200).lean();

      const alternativas = [];
      if (estadias.length) alternativas.push({ estadiaId: { $in: estadias.map((e) => e._id) } });
      if (soloDigitos) alternativas.push({ numero: Number(soloDigitos) });
      filtro.$or = alternativas.length ? alternativas : [{ _id: null }];
    }

    const [comprobantes, total] = await Promise.all([
      ComprobanteEstadia.find(filtro)
        .sort({ fechaEmision: -1 })
        .skip(salto)
        .limit(limite)
        .populate('estadiaId', 'vehiculoDominio horaInicio horaFin duracionHoras origen motivoExcepcion')
        // La lista tiene que poder decir "anulado con la NC 00000003" sin una segunda vuelta.
        .populate('anulaA', 'numero numeroFiscal puntoVenta cae')
        .populate('anuladoPorId', 'numero numeroFiscal puntoVenta cae')
        .lean(),
      ComprobanteEstadia.countDocuments(filtro)
    ]);

    res.status(200).json({ comprobantes, total, pagina, limite, totalPaginas: totalPaginas(total, limite) });
  } catch (error) {
    next(error);
  }
};

const obtener = async (req, res, next) => {
  try {
    const comprobante = await ComprobanteEstadia.findById(req.params.id)
      .populate('estadiaId', 'vehiculoDominio horaInicio horaFin duracionHoras montoTotal origen motivoExcepcion')
      .populate('anulaA', 'numero numeroFiscal puntoVenta cae tipoComprobanteFiscal')
      .populate('anuladoPorId', 'numero numeroFiscal puntoVenta cae tipoComprobanteFiscal');
    if (!comprobante) return res.status(404).json({ mensaje: 'Comprobante no encontrado' });
    res.status(200).json({ comprobante });
  } catch (error) {
    next(error);
  }
};

const descargarPdf = async (req, res, next) => {
  try {
    const comprobante = await ComprobanteEstadia.findById(req.params.id)
      .populate('estadiaId', 'vehiculoDominio horaInicio horaFin duracionHoras origen motivoExcepcion')
      .populate('anulaA', 'numero numeroFiscal puntoVenta cae tipoComprobanteFiscal')
      .populate('anuladoPorId', 'numero numeroFiscal puntoVenta cae tipoComprobanteFiscal');
    if (!comprobante) return res.status(404).json({ mensaje: 'Comprobante no encontrado' });

    // El mostrador baja cualquiera; un cliente, solo el suyo. Sin esta comprobación, cambiar
    // el id en la URL daría el comprobante de otra persona: nombre, DNI, patente e importe.
    const rol = req.usuarioActual?.rol ?? req.usuario?.rol;
    const esDelMostrador = rol === 'operador' || rol === 'admin';
    const esTitular = comprobante.receptor?.dni && comprobante.receptor.dni === req.usuario?.dni;
    if (!esDelMostrador && !esTitular) {
      return res.status(403).json({ mensaje: 'Este comprobante no es tuyo' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo(comprobante)}"`);
    await escribirPdf(comprobante, res);
  } catch (error) {
    next(error);
  }
};

const enviarPorMail = async (req, res, next) => {
  try {
    const comprobante = await ComprobanteEstadia.findById(req.params.id)
      .populate('estadiaId', 'vehiculoDominio horaInicio horaFin duracionHoras origen motivoExcepcion')
      .populate('anulaA', 'numero numeroFiscal puntoVenta cae tipoComprobanteFiscal')
      .populate('anuladoPorId', 'numero numeroFiscal puntoVenta cae tipoComprobanteFiscal');
    if (!comprobante) return res.status(404).json({ mensaje: 'Comprobante no encontrado' });

    // La dirección explícita gana; si no viene, se usa la del cliente registrado. El cliente
    // ocasional no tiene cuenta ni mail, así que ahí el operador tiene que escribir uno.
    let destino = req.body?.email?.trim();
    if (!destino && comprobante.receptor.tipo === 'usuario' && comprobante.receptor.dni) {
      const usuario = await Usuario.findOne({ dni: comprobante.receptor.dni }, 'email').lean();
      destino = usuario?.email;
    }
    if (!destino) {
      return res.status(400).json({
        mensaje: 'No hay una dirección a la que enviarlo. Escribí el correo del cliente.'
      });
    }

    const numero = numeroFormateado(comprobante);
    const pdf = await generarBuffer(comprobante);

    await enviarMail({
      to: destino,
      subject: `Comprobante de estadía ${numero}`,
      text: `Adjuntamos el comprobante ${numero} de la estadía${comprobante.estadiaId?.vehiculoDominio ? ` del vehículo ${comprobante.estadiaId.vehiculoDominio}` : ''}.\n\nEs un documento no fiscal.`,
      attachments: [{ filename: nombreArchivo(comprobante), content: pdf, contentType: 'application/pdf' }]
    });

    // El envío de un comprobante es un hecho que después alguien va a querer reconstruir
    // ("me lo mandaron o no"): queda en auditoría con la dirección usada.
    await auditoriaService.registrar({
      entidad: 'ComprobanteEstadia',
      entidadId: comprobante._id,
      accion: 'enviar_comprobante',
      usuarioId: req.usuarioActual?._id,
      usuarioDni: req.usuario?.dni,
      datosNuevos: { numero, destino }
    });

    res.status(200).json({ mensaje: `Comprobante ${numero} enviado a ${destino}`, destino });
  } catch (error) {
    next(error);
  }
};

module.exports = { listar, obtener, descargarPdf, enviarPorMail, estadoFiscal, reintentarCae, reconciliarFiscal, anular };
