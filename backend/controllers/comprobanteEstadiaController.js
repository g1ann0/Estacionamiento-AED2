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

const listar = async (req, res, next) => {
  try {
    const { desde, hasta, medioPago, estado, q, pagina = 1, limite = 25 } = req.query;

    const filtro = {};
    if (medioPago) filtro.medioPago = medioPago;
    if (estado) filtro.estado = estado;
    if (desde || hasta) {
      filtro.fechaEmision = {};
      if (desde) filtro.fechaEmision.$gte = new Date(desde);
      // `hasta` llega como fecha sin hora: se toma el día completo, no las 00:00.
      if (hasta) filtro.fechaEmision.$lte = new Date(`${hasta}T23:59:59.999`);
    }

    // La búsqueda acepta las dos formas en que alguien busca un comprobante: por su número o
    // por la patente del auto. Nadie recuerda el ObjectId de una estadía.
    if (q?.trim()) {
      const termino = q.trim();
      const soloDigitos = termino.replace(/\D/g, '');
      const estadias = await Estacionamiento.find(
        { vehiculoDominio: new RegExp(termino.toUpperCase(), 'i') },
        '_id'
      ).limit(200).lean();

      const alternativas = [];
      if (estadias.length) alternativas.push({ estadiaId: { $in: estadias.map((e) => e._id) } });
      if (soloDigitos) alternativas.push({ numero: Number(soloDigitos) });
      filtro.$or = alternativas.length ? alternativas : [{ _id: null }];
    }

    const salto = (parseInt(pagina) - 1) * parseInt(limite);
    const [comprobantes, total] = await Promise.all([
      ComprobanteEstadia.find(filtro)
        .sort({ fechaEmision: -1 })
        .skip(salto)
        .limit(parseInt(limite))
        .populate('estadiaId', 'vehiculoDominio horaInicio horaFin duracionHoras origen motivoExcepcion')
        .lean(),
      ComprobanteEstadia.countDocuments(filtro)
    ]);

    res.status(200).json({
      comprobantes,
      total,
      pagina: parseInt(pagina),
      totalPaginas: Math.max(1, Math.ceil(total / parseInt(limite)))
    });
  } catch (error) {
    next(error);
  }
};

const obtener = async (req, res, next) => {
  try {
    const comprobante = await ComprobanteEstadia.findById(req.params.id)
      .populate('estadiaId', 'vehiculoDominio horaInicio horaFin duracionHoras montoTotal origen motivoExcepcion');
    if (!comprobante) return res.status(404).json({ mensaje: 'Comprobante no encontrado' });
    res.status(200).json({ comprobante });
  } catch (error) {
    next(error);
  }
};

const descargarPdf = async (req, res, next) => {
  try {
    const comprobante = await ComprobanteEstadia.findById(req.params.id)
      .populate('estadiaId', 'vehiculoDominio horaInicio horaFin duracionHoras origen motivoExcepcion');
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
      .populate('estadiaId', 'vehiculoDominio horaInicio horaFin duracionHoras origen motivoExcepcion');
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

module.exports = { listar, obtener, descargarPdf, enviarPorMail };
