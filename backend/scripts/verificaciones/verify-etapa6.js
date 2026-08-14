// Verifica la Etapa 6 —facturación electrónica— contra el mock de ARCA.
//
// Cubre lo que se puede probar sin certificado: los catálogos, el desglose de importes, el
// armado del pedido, la idempotencia, la emisión diferida y el worker. Lo que NO cubre es la
// conversación real con ARCA: para eso está arca-probar-login.js y el certificado.
//
// Uso: ARCA_MOCK=true node scripts/verify-etapa6.js

require('dotenv').config();
process.env.ARCA_MOCK = 'true';
process.env.ARCA_AMBIENTE = 'homologacion';
process.env.ARCA_CUIT = process.env.ARCA_CUIT || '20442422924';

const mongoose = require('mongoose');

let ok = 0;
let fallos = 0;
const check = (condicion, descripcion, detalle = '') => {
  if (condicion) {
    console.log(`OK   ${descripcion}${detalle ? ` (${detalle})` : ''}`);
    ok += 1;
  } else {
    console.log(`FALLA ${descripcion}${detalle ? ` (${detalle})` : ''}`);
    fallos += 1;
  }
};

// Las pruebas usan su propio punto de venta para no mezclarse jamás con comprobantes reales.
const PV_PRUEBA = '09999';

const catalogos = require('../../services/arca/catalogos');
const mock = require('../../services/arca/mock');

async function verificarCatalogos() {
  console.log('\n— Catálogos y desglose de importes —');

  check(catalogos.tipoComprobantePara('Responsable Monotributo') === 11, 'un monotributista emite factura C');
  check(catalogos.tipoComprobantePara('IVA Responsable Inscripto') === 6, 'un responsable inscripto emite factura B');

  const sinDni = catalogos.documentoDe({ dni: null });
  check(sinDni.tipo === 99 && sinDni.numero === 0, 'sin DNI se informa consumidor final (99/0), no un documento inventado');

  const conDni = catalogos.documentoDe({ dni: '30123456' });
  check(conDni.tipo === 96 && conDni.numero === 30123456, 'ocho dígitos se informan como DNI');

  const conCuit = catalogos.documentoDe({ dni: '20442422924' });
  check(conCuit.tipo === 80, 'once dígitos se informan como CUIT');

  // El total cobrado es IVA incluido: el neto se calcula hacia atrás, nunca sumando IVA encima.
  const b = catalogos.desglosarImportes(12100, 6);
  check(b.impTotal === 12100, 'factura B: el total es exactamente lo cobrado', `$${b.impTotal}`);
  check(b.impNeto === 10000, 'factura B: el neto sale de dividir por 1,21', `$${b.impNeto}`);
  check(b.impIVA === 2100, 'factura B: el IVA es la diferencia', `$${b.impIVA}`);
  check(
    catalogos.redondear(b.impNeto + b.impIVA) === b.impTotal,
    'factura B: neto + IVA da el total exacto (es lo que ARCA valida)'
  );

  const c = catalogos.desglosarImportes(12100, 11);
  check(c.impNeto === 12100 && c.impIVA === 0 && c.iva.length === 0, 'factura C: no discrimina IVA');

  // Un importe con decimales feos es donde aparecen las diferencias de un centavo.
  const feo = catalogos.desglosarImportes(9999.99, 6);
  check(
    catalogos.redondear(feo.impNeto + feo.impIVA) === feo.impTotal,
    'con importes de decimales incómodos, neto + IVA sigue dando el total',
    `${feo.impNeto} + ${feo.impIVA} = ${feo.impTotal}`
  );

  const hoy = catalogos.fechaArca(new Date('2026-08-11T23:30:00-03:00'));
  check(/^\d{8}$/.test(hoy), 'la fecha va como AAAAMMDD', hoy);
}

async function verificarMock() {
  console.log('\n— Cliente mock —');
  mock.reiniciar();

  const base = {
    puntoVenta: 1,
    tipoComprobante: 6,
    concepto: 2,
    documento: { tipo: 99, numero: 0 },
    fecha: catalogos.fechaArca(),
    importes: catalogos.desglosarImportes(12100, 6),
    moneda: 'PES',
    condicionIvaReceptor: 5,
    periodoServicio: { desde: '20260811', hasta: '20260811', vencimientoPago: '20260811' }
  };

  const primero = await mock.solicitarCAE(base);
  check(Boolean(primero.cae), 'el mock devuelve un CAE');
  check(primero.cae.startsWith('0000'), 'el CAE de mock arranca en 0000: es reconocible a simple vista');
  check(primero.simulado === true, 'la respuesta viene marcada como simulada');
  check(primero.numero === 1, 'el primer comprobante lleva el número 1');

  const segundo = await mock.solicitarCAE(base);
  check(segundo.numero === 2, 'la numeración avanza de a uno');

  // Las validaciones que ARCA sí hace, replicadas para que fallen en desarrollo y no el día
  // que se conecte el certificado.
  let errorTotal = null;
  try { await mock.solicitarCAE({ ...base, importes: { impTotal: 0, impNeto: 0, impIVA: 0, iva: [] } }); }
  catch (e) { errorTotal = e; }
  check(errorTotal?.rechazadoPorArca, 'un total en cero se rechaza');

  let errorSuma = null;
  try { await mock.solicitarCAE({ ...base, importes: { impTotal: 100, impNeto: 50, impIVA: 10, iva: [] } }); }
  catch (e) { errorSuma = e; }
  check(errorSuma?.rechazadoPorArca, 'si neto + IVA no da el total, se rechaza');

  let errorPeriodo = null;
  try { await mock.solicitarCAE({ ...base, periodoServicio: null }); }
  catch (e) { errorPeriodo = e; }
  check(errorPeriodo?.rechazadoPorArca, 'un comprobante de servicios sin período se rechaza');

  // El mock no puede correr apuntando a producción.
  process.env.ARCA_AMBIENTE = 'produccion';
  let errorAmbiente = null;
  try { await mock.solicitarCAE(base); } catch (e) { errorAmbiente = e; }
  check(errorAmbiente?.message.includes('no emite comprobantes fiscales'), 'el mock se niega a correr contra producción');
  process.env.ARCA_AMBIENTE = 'homologacion';
}

async function verificarEmision() {
  console.log('\n— Emisión diferida sobre la base real —');

  await mongoose.connect(process.env.MONGODB_URI);
  const ComprobanteEstadia = require('../../models/ComprobanteEstadia');
  const Estacionamiento = require('../../models/Estacionamiento');
  const { emitirComprobante, procesarPendientes, construirPedido } = require('../../services/facturacionElectronicaService');

  mock.reiniciar();

  // Los comprobantes de prueba de corridas anteriores se borran antes de empezar. El mock
  // reinicia su numeración en cada corrida, y el índice único —correctamente— rechazaría el
  // número fiscal repetido. Es la misma protección que evita numeración duplicada en serio.
  await ComprobanteEstadia.deleteMany({ puntoVenta: PV_PRUEBA });

  const marca = `VERIF6${Date.now()}`.slice(0, 12);

  const estadia = await Estacionamiento.create({
    vehiculoDominio: marca,
    horaInicio: new Date(Date.now() - 2 * 3600 * 1000),
    horaFin: new Date(),
    duracionHoras: 2,
    montoTotal: 12100,
    estado: 'finalizado',
    origen: 'caja'
  });

  const comprobante = await ComprobanteEstadia.create({
    numero: Math.floor(Math.random() * 1e9),
    puntoVenta: PV_PRUEBA,
    tipoComprobante: 'ticket',
    estadiaId: estadia._id,
    receptor: { tipo: 'consumidor_final', nombre: 'Consumidor', apellido: 'Final', condicionIva: 'Consumidor Final' },
    medioPago: 'efectivo',
    subtotal: 12100,
    total: 12100,
    estado: 'pendiente_cae'
  });

  try {
    const pedido = construirPedido({
      comprobante,
      estadia,
      configuracion: { condicionIva: 'IVA Responsable Inscripto' }
    });
    check(pedido.concepto === 2, 'una estadía se factura como servicio');
    check(Boolean(pedido.periodoServicio.desde && pedido.periodoServicio.hasta), 'el período del servicio viaja con el pedido');
    check(pedido.importes.impTotal === 12100, 'el importe del pedido es el cobrado');

    const resultado = await emitirComprobante(comprobante._id);
    check(Boolean(resultado.cae), 'se obtiene el CAE');

    const guardado = await ComprobanteEstadia.findById(comprobante._id);
    check(guardado.estado === 'emitido', 'el comprobante queda emitido');
    check(Boolean(guardado.cae), 'el CAE queda guardado');
    check(guardado.simulado === true, 'queda marcado como simulado: un CAE de mock no se confunde con uno real');
    check(guardado.numero === comprobante.numero, 'el número del TICKET no se pisa: es el que el cliente se llevó');
    check(typeof guardado.numeroFiscal === 'number', 'el número fiscal se guarda aparte', `#${guardado.numeroFiscal}`);
    check(guardado.tipoComprobanteFiscal === 6, 'se guarda el tipo de comprobante de ARCA');
    check(guardado.caeFchVto instanceof Date, 'el vencimiento del CAE se guarda como fecha');

    // Un ticket anterior a la integración no puede pedir CAE: emitiría un comprobante fiscal
    // con fecha de hoy por una estadía vieja.
    const viejo = await ComprobanteEstadia.create({
      numero: Math.floor(Math.random() * 1e9),
      puntoVenta: PV_PRUEBA,
      tipoComprobante: 'ticket',
      estadiaId: estadia._id,
      receptor: { tipo: 'consumidor_final', nombre: 'Consumidor', apellido: 'Final', condicionIva: 'Consumidor Final' },
      medioPago: 'efectivo',
      subtotal: 500,
      total: 500,
      estado: 'emitido'
    });

    let errorViejo = null;
    try { await emitirComprobante(viejo._id); } catch (e) { errorViejo = e; }
    check(
      errorViejo?.message.includes('antes de que la facturación electrónica'),
      'un ticket anterior a la integración no puede pedir CAE'
    );
    const viejoTrasIntento = await ComprobanteEstadia.findById(viejo._id);
    check(!viejoTrasIntento.cae && viejoTrasIntento.estado === 'emitido', 'y queda intacto');
    await ComprobanteEstadia.deleteOne({ _id: viejo._id });

    // Idempotencia: un doble clic no puede producir dos CAE, porque un CAE no se borra.
    const repetido = await emitirComprobante(comprobante._id);
    check(repetido.yaEmitido === true, 'pedir CAE dos veces no llama a ARCA de nuevo');
    const trasRepetir = await ComprobanteEstadia.findById(comprobante._id);
    check(trasRepetir.cae === guardado.cae, 'el CAE no cambió al reintentar');

    // Worker.
    const otro = await ComprobanteEstadia.create({
      numero: Math.floor(Math.random() * 1e9),
      puntoVenta: PV_PRUEBA,
      tipoComprobante: 'ticket',
      estadiaId: estadia._id,
      receptor: { tipo: 'consumidor_final', nombre: 'Consumidor', apellido: 'Final', condicionIva: 'Consumidor Final' },
      medioPago: 'efectivo',
      subtotal: 500,
      total: 500,
      estado: 'pendiente_cae'
    });

    // Acotado al punto de venta de prueba: los pendientes reales del sistema no son asunto
    // de esta verificación.
    const corrida = await procesarPendientes({ limite: 50, puntoVenta: PV_PRUEBA });
    check(corrida.emitidos >= 1, 'el worker emite los pendientes', `${corrida.emitidos} emitidos`);
    const otroGuardado = await ComprobanteEstadia.findById(otro._id);
    check(otroGuardado.estado === 'emitido' && Boolean(otroGuardado.cae), 'el pendiente quedó emitido');

    await ComprobanteEstadia.deleteMany({ _id: { $in: [comprobante._id, otro._id] } });
    await Estacionamiento.deleteOne({ _id: estadia._id });
  } catch (error) {
    await ComprobanteEstadia.deleteMany({ estadiaId: estadia._id });
    await Estacionamiento.deleteOne({ _id: estadia._id });
    throw error;
  } finally {
    await mongoose.disconnect();
  }
}

// Lo que el PDF dice en cada estado. Un test que solo comprueba que el archivo empiece con
// "%PDF" no prueba nada de lo que importa acá: lo delicado es exactamente qué texto lleva —
// un comprobante que dice "no fiscal" teniendo CAE, o que se presenta como factura teniendo
// un CAE de prueba, es el tipo de error que termina en un problema con ARCA.
async function verificarPdf() {
  console.log('\n— Lo que dice el PDF en cada estado —');

  const { leyendaFiscal, generarBuffer, numeroFormateado } = require('../../services/comprobanteEstadiaPdf');

  const base = {
    numero: 42,
    puntoVenta: PV_PRUEBA,
    tipoComprobante: 'ticket',
    receptor: { tipo: 'clienteOcasional', nombre: 'Juan', apellido: 'Final', condicionIva: 'Consumidor Final' },
    medioPago: 'efectivo',
    total: 12100,
    fechaEmision: new Date(),
    estado: 'emitido',
    estadiaId: { vehiculoDominio: 'AA111BB', horaInicio: new Date(Date.now() - 7200000), horaFin: new Date(), duracionHoras: 2 }
  };

  const sinIntegracion = leyendaFiscal(base);
  check(sinIntegracion.estado === 'no_fiscal', 'sin integración: el documento se declara no fiscal');
  check(sinIntegracion.subtitulo.includes('NO FISCAL'), 'sin integración: lo dice en el encabezado');
  check(!sinIntegracion.pie.includes('CAE'), 'sin integración: el pie no menciona ningún CAE');

  const pendiente = leyendaFiscal({ ...base, estado: 'pendiente_cae' });
  check(pendiente.estado === 'pendiente', 'esperando CAE: estado pendiente');
  check(pendiente.subtitulo.includes('trámite'), 'esperando CAE: avisa que el fiscal está en trámite');
  check(pendiente.titulo === 'COMPROBANTE DE ESTADÍA', 'esperando CAE: no se titula factura');

  const simulado = leyendaFiscal({
    ...base, cae: '00001234567890', caeFchVto: new Date(), numeroFiscal: 7, tipoComprobanteFiscal: 6, simulado: true
  });
  check(simulado.estado === 'prueba', 'CAE simulado: estado de prueba');
  check(simulado.subtitulo.includes('PRUEBA'), 'CAE simulado: el encabezado avisa que es de prueba');
  check(simulado.titulo !== 'FACTURA B', 'CAE simulado: NO se presenta como factura');
  check(simulado.resaltado === true, 'CAE simulado: se resalta para que no pase desapercibido');

  const real = leyendaFiscal({
    ...base, cae: '75123456789012', caeFchVto: new Date(), numeroFiscal: 7, tipoComprobanteFiscal: 6, simulado: false
  });
  check(real.estado === 'autorizado', 'autorizado: estado autorizado');
  check(real.titulo === 'FACTURA B', 'autorizado: el documento se titula FACTURA B');
  check(real.pie.includes('75123456789012'), 'autorizado: el pie lleva el CAE');
  check(!real.subtitulo.includes('NO FISCAL'), 'autorizado: ya no dice NO FISCAL');

  const monotributo = leyendaFiscal({ ...base, cae: '1', tipoComprobanteFiscal: 11 });
  check(monotributo.titulo === 'FACTURA C', 'un monotributista emite factura C');

  // Una nota de crédito no puede titularse "comprobante de estadía": dice lo contrario de lo
  // que hace, y el que la recibe la leería como un cobro más.
  const notaEnTramite = leyendaFiscal({ ...base, tipoComprobante: 'nota_credito', estado: 'pendiente_cae' });
  check(notaEnTramite.titulo === 'NOTA DE CRÉDITO', 'una nota de crédito en trámite se titula NOTA DE CRÉDITO');
  check(notaEnTramite.subtitulo.includes('nota de crédito'), 'y el encabezado dice que espera el CAE');

  const notaAutorizada = leyendaFiscal({
    ...base, tipoComprobante: 'nota_credito', cae: '75123456789012', tipoComprobanteFiscal: 8
  });
  check(notaAutorizada.titulo === 'NOTA DE CRÉDITO B', 'autorizada, lleva la letra que le corresponde');

  const notaC = leyendaFiscal({ ...base, tipoComprobante: 'nota_credito', cae: '1', tipoComprobanteFiscal: 13 });
  check(notaC.titulo === 'NOTA DE CRÉDITO C', 'y la de un monotributista es una nota de crédito C');

  // El número interno del ticket es el que el cliente tiene en la mano: se conserva aunque
  // ARCA haya asignado otro para lo fiscal.
  check(numeroFormateado(base) === `${PV_PRUEBA}-00000042`, 'el número interno mantiene su formato');

  // Y que el PDF efectivamente se genere en los cuatro estados.
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    for (const [nombre, comprobante] of [
      ['sin integración', base],
      ['pendiente', { ...base, estado: 'pendiente_cae' }],
      ['simulado', { ...base, cae: '0000123', simulado: true, tipoComprobanteFiscal: 6, numeroFiscal: 7 }],
      ['autorizado', { ...base, cae: '75123456789012', caeFchVto: new Date(), tipoComprobanteFiscal: 6, numeroFiscal: 7 }],
      ['anulado con nota de crédito', {
        ...base,
        estado: 'anulado',
        cae: '75123456789012',
        tipoComprobanteFiscal: 6,
        numeroFiscal: 7,
        motivoAnulacion: 'Cobro duplicado',
        anuladoPorId: { numero: 3, numeroFiscal: 1, puntoVenta: PV_PRUEBA, cae: '75999999999999' }
      }],
      ['nota de crédito', {
        ...base,
        tipoComprobante: 'nota_credito',
        cae: '75999999999999',
        tipoComprobanteFiscal: 8,
        numeroFiscal: 1,
        anulaA: { numero: 42, numeroFiscal: 7, puntoVenta: PV_PRUEBA, cae: '75123456789012' }
      }]
    ]) {
      const pdf = await generarBuffer(comprobante);
      check(pdf.slice(0, 4).toString() === '%PDF', `el PDF se genera con el comprobante ${nombre}`, `${pdf.length} bytes`);
    }
  } finally {
    await mongoose.disconnect();
  }
}

// El caso feo: ARCA autoriza y la persistencia local falla. Para ARCA el comprobante existe;
// para nosotros no. Es el único escenario que no se puede evitar —el CAE y el commit local
// están en dos sistemas y no pueden ser atómicos— y por eso hay que poder repararlo.
async function verificarReconciliacion() {
  console.log('\n— Reconciliación: ARCA autorizó y nosotros no nos enteramos —');

  await mongoose.connect(process.env.MONGODB_URI);
  const ComprobanteEstadia = require('../../models/ComprobanteEstadia');
  const Estacionamiento = require('../../models/Estacionamiento');
  const { emitirComprobante, reconciliar } = require('../../services/facturacionElectronicaService');

  mock.reiniciar();
  await ComprobanteEstadia.deleteMany({ puntoVenta: PV_PRUEBA });

  const estadia = await Estacionamiento.create({
    vehiculoDominio: `RECON${Date.now()}`.slice(0, 11),
    horaInicio: new Date(Date.now() - 3600 * 1000),
    horaFin: new Date(),
    duracionHoras: 1,
    montoTotal: 7777,
    estado: 'finalizado',
    origen: 'caja'
  });

  const comprobante = await ComprobanteEstadia.create({
    numero: Math.floor(Math.random() * 1e9),
    puntoVenta: PV_PRUEBA,
    tipoComprobante: 'ticket',
    estadiaId: estadia._id,
    receptor: { tipo: 'consumidor_final', nombre: 'Consumidor', apellido: 'Final', condicionIva: 'Consumidor Final' },
    medioPago: 'efectivo',
    subtotal: 7777,
    total: 7777,
    estado: 'pendiente_cae'
  });

  try {
    // ARCA autoriza, y el cliente nunca recibe la respuesta.
    mock.simularCorteTrasAutorizar(true);
    let corte = null;
    try { await emitirComprobante(comprobante._id); } catch (e) { corte = e; }
    mock.simularCorteTrasAutorizar(false);

    check(Boolean(corte), 'la emisión falla por el corte de conexión');

    const tras = await ComprobanteEstadia.findById(comprobante._id);
    check(!tras.cae, 'localmente el comprobante quedó SIN CAE');
    check(tras.estado === 'error_arca', 'y marcado con error');

    // Este es el punto: para ARCA ese comprobante existe y está autorizado.
    const enArca = await mock.consultarComprobante(Number(PV_PRUEBA), 6, 1);
    check(Boolean(enArca?.cae), 'pero ARCA lo tiene autorizado: el CAE se otorgó igual');

    const resultado = await reconciliar({ puntoVenta: Number(PV_PRUEBA), tipoComprobante: 6 });
    check(resultado.ultimoEnArca === 1, 'la reconciliación ve que ARCA autorizó 1', `ARCA: ${resultado.ultimoEnArca}`);
    check(resultado.ultimoLocal === 0, 'y que nosotros no tenemos ninguno', `local: ${resultado.ultimoLocal}`);
    check(resultado.faltantes === 1, 'detecta que falta 1');
    check(resultado.vinculados.length === 1, 'y lo vincula con el comprobante que esperaba');
    check(resultado.huerfanos.length === 0, 'sin huérfanos: había un candidato con el mismo importe');

    const reparado = await ComprobanteEstadia.findById(comprobante._id);
    check(reparado.cae === enArca.cae, 'el comprobante local quedó con el CAE que ARCA había otorgado');
    check(reparado.numeroFiscal === 1, 'y con el número fiscal correcto');
    check(reparado.estado === 'emitido', 'y en estado emitido');

    // Correr de nuevo no debe duplicar nada.
    const segunda = await reconciliar({ puntoVenta: Number(PV_PRUEBA), tipoComprobante: 6 });
    check(segunda.faltantes === 0, 'una segunda corrida no encuentra nada que reparar');

    // Un comprobante autorizado en ARCA sin candidato local se reporta, no se inventa.
    await ComprobanteEstadia.deleteMany({ puntoVenta: PV_PRUEBA });
    const huerfano = await reconciliar({ puntoVenta: Number(PV_PRUEBA), tipoComprobante: 6 });
    check(huerfano.huerfanos.length === 1, 'sin candidato local, el comprobante se reporta como huérfano');
    check(
      huerfano.vinculados.length === 0,
      'y NO se fabrica una estadía para que los números cierren'
    );

    await ComprobanteEstadia.deleteMany({ puntoVenta: PV_PRUEBA });
    await Estacionamiento.deleteOne({ _id: estadia._id });
  } catch (error) {
    await ComprobanteEstadia.deleteMany({ puntoVenta: PV_PRUEBA });
    await Estacionamiento.deleteOne({ _id: estadia._id });
    throw error;
  } finally {
    await mongoose.disconnect();
  }
}

// ANULACIÓN CON NOTA DE CRÉDITO.
//
// Lo que se prueba acá es la regla de fondo: un CAE no se deshace. Si el comprobante llegó a
// ARCA, anularlo significa emitir OTRO comprobante que lo compense; si no llegó, alcanza con
// darlo de baja. Y la carrera del medio —que ARCA autorice justo mientras alguien anula—
// tiene que terminar igual de consistente.
async function verificarNotaCredito() {
  console.log('\n— Anulación con nota de crédito —');

  await mongoose.connect(process.env.MONGODB_URI);
  const ComprobanteEstadia = require('../../models/ComprobanteEstadia');
  const Estacionamiento = require('../../models/Estacionamiento');
  const Talonario = require('../../models/Talonario');
  const Sucursal = require('../../models/Sucursal');
  const { emitirComprobante, anularComprobante, procesarPendientes } = require('../../services/facturacionElectronicaService');

  mock.reiniciar();
  await ComprobanteEstadia.deleteMany({ puntoVenta: PV_PRUEBA });

  const sucursal = await Sucursal.findOne({ esPrincipal: true });
  await Talonario.deleteMany({ puntoVenta: PV_PRUEBA });
  await Talonario.create({ sucursalId: sucursal._id, puntoVenta: PV_PRUEBA, tipoComprobante: 'nota_credito', proximoNumero: 1 });

  const estadia = await Estacionamiento.create({
    vehiculoDominio: `NC${Date.now()}`.slice(0, 12),
    horaInicio: new Date(Date.now() - 3600 * 1000),
    horaFin: new Date(),
    duracionHoras: 1,
    montoTotal: 12100,
    estado: 'finalizado',
    origen: 'caja'
  });

  const nuevoComprobante = (extra = {}) => ComprobanteEstadia.create({
    numero: Math.floor(Math.random() * 1e9),
    puntoVenta: PV_PRUEBA,
    tipoComprobante: 'ticket',
    sucursalId: sucursal._id,
    estadiaId: estadia._id,
    receptor: { tipo: 'consumidor_final', nombre: 'Consumidor', apellido: 'Final', condicionIva: 'Consumidor Final' },
    medioPago: 'efectivo',
    subtotal: 12100,
    total: 12100,
    estado: 'pendiente_cae',
    ...extra
  });

  const limpiar = async () => {
    await ComprobanteEstadia.deleteMany({ puntoVenta: PV_PRUEBA });
    await Talonario.deleteMany({ puntoVenta: PV_PRUEBA });
    await Estacionamiento.deleteOne({ _id: estadia._id });
  };

  try {
    // ---- Caso fiscal: el comprobante tiene CAE, así que se compensa ----
    const original = await nuevoComprobante();
    await emitirComprobante(original._id);
    const conCae = await ComprobanteEstadia.findById(original._id);
    check(Boolean(conCae.cae), 'punto de partida: el comprobante tiene CAE');

    const { notaCredito } = await anularComprobante(original._id, { motivo: 'Cobro duplicado en la salida' });
    const anulado = await ComprobanteEstadia.findById(original._id);

    check(anulado.estado === 'anulado', 'el original queda anulado');
    check(Boolean(anulado.cae), 'y CONSERVA su CAE: lo que ARCA autorizó no se borra');
    check(String(anulado.anuladoPorId) === String(notaCredito._id), 'el original apunta a la nota de crédito');
    check(String(notaCredito.anulaA) === String(original._id), 'la nota de crédito apunta al original');
    check(anulado.motivoAnulacion === 'Cobro duplicado en la salida', 'el motivo queda asentado');
    check(anulado.fechaAnulacion instanceof Date, 'y la fecha de anulación también');

    check(notaCredito.tipoComprobante === 'nota_credito', 'la nota de crédito es un comprobante propio');
    check(notaCredito.numero === 1, 'numerada con su propio talonario, no con el de tickets', `N° ${notaCredito.numero}`);
    check(notaCredito.total === original.total, 'por el mismo importe, en positivo', `$${notaCredito.total}`);
    check(Boolean(notaCredito.cae), 'con su propio CAE: es un comprobante fiscal completo');
    check(notaCredito.tipoComprobanteFiscal === 8, 'de la misma letra que la factura B que compensa (tipo 8)');
    check(String(notaCredito.cae) !== String(anulado.cae), 'y su CAE es distinto del de la factura');

    // ARCA tiene que tenerla registrada con el comprobante asociado, no suelta.
    const enArca = await mock.consultarComprobante(Number(PV_PRUEBA), 8, notaCredito.numeroFiscal);
    check(Boolean(enArca), 'la nota de crédito quedó registrada en ARCA', `#${notaCredito.numeroFiscal}`);

    // ---- Lo que no se permite ----
    let error = null;
    try { await anularComprobante(original._id, { motivo: 'otra vez' }); } catch (e) { error = e; }
    check(/ya está anulado/i.test(error?.message ?? ''), 'un comprobante ya anulado no se anula dos veces');

    error = null;
    try { await anularComprobante(notaCredito._id, { motivo: 'anular la nota' }); } catch (e) { error = e; }
    check(/nota de crédito no se anula/i.test(error?.message ?? ''), 'una nota de crédito no se anula a sí misma');

    error = null;
    try { await anularComprobante(original._id, { motivo: '' }); } catch (e) { error = e; }
    check(/motivo/i.test(error?.message ?? ''), 'sin motivo no se anula: es lo único que explica la nota de crédito después');

    // ---- El mock rechaza una nota de crédito sin asociado, igual que ARCA ----
    error = null;
    try {
      await mock.solicitarCAE({
        puntoVenta: Number(PV_PRUEBA),
        tipoComprobante: 8,
        concepto: 2,
        periodoServicio: { desde: '20260811', hasta: '20260811', vencimientoPago: '20260811' },
        documento: { tipo: 99, numero: 0 },
        fecha: '20260811',
        importes: catalogos.desglosarImportes(1000, 8),
        moneda: 'PES'
      });
    } catch (e) { error = e; }
    check(error?.rechazadoPorArca === true, 'una nota de crédito sin comprobante asociado es rechazada');

    // ---- Caso no fiscal: nunca llegó a ARCA, no hay nada que compensar ----
    const sinCae = await nuevoComprobante();
    const resultadoSinCae = await anularComprobante(sinCae._id, { motivo: 'Se anuló antes de facturar' });
    check(resultadoSinCae.notaCredito === null, 'un comprobante sin CAE se anula sin nota de crédito');

    const anuladoSinCae = await ComprobanteEstadia.findById(sinCae._id);
    check(anuladoSinCae.estado === 'anulado' && !anuladoSinCae.cae, 'queda anulado y sin CAE');

    const pasada = await procesarPendientes({ puntoVenta: PV_PRUEBA });
    check(pasada.procesados === 0, 'y el worker ya no lo toma: sale solo de la cola');

    // ---- La carrera: ARCA autoriza mientras alguien anula ----
    //
    // Es el único caso en que el sistema no puede elegir. Cuando la respuesta de ARCA llega
    // después de la anulación, el CAE ya existe del otro lado: negarlo no lo borra. La
    // emisión guarda el CAE y emite la nota de crédito que la anulación no pudo emitir.
    const enCarrera = await nuevoComprobante();
    const original_solicitarCAE = mock.solicitarCAE;
    mock.solicitarCAE = async (datos) => {
      // Mientras "ARCA responde", alguien anula desde el panel.
      await ComprobanteEstadia.updateOne(
        { _id: enCarrera._id },
        { estado: 'anulado', motivoAnulacion: 'Anulado durante la emisión', fechaAnulacion: new Date() }
      );
      return original_solicitarCAE(datos);
    };

    try {
      await emitirComprobante(enCarrera._id);
    } finally {
      mock.solicitarCAE = original_solicitarCAE;
    }

    const trasCarrera = await ComprobanteEstadia.findById(enCarrera._id);
    check(Boolean(trasCarrera.cae), 'si ARCA autorizó durante la anulación, el CAE se guarda igual');
    check(trasCarrera.estado === 'anulado', 'el comprobante queda anulado, como se había pedido');
    check(Boolean(trasCarrera.anuladoPorId), 'y se emite la nota de crédito que la anulación no pudo emitir');

    const ncDeCarrera = await ComprobanteEstadia.findById(trasCarrera.anuladoPorId);
    check(ncDeCarrera?.tipoComprobanteFiscal === 8, 'esa nota de crédito también es de la letra correcta');

    await limpiar();
  } catch (error) {
    await limpiar();
    throw error;
  } finally {
    await mongoose.disconnect();
  }
}

async function main() {
  await verificarCatalogos();
  await verificarMock();
  await verificarEmision();
  await verificarPdf();
  await verificarReconciliacion();
  await verificarNotaCredito();

  console.log(`\n${fallos === 0 ? '✅ TODO OK' : `❌ ${fallos} fallas`} — ${ok} verificaciones`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('\nError ejecutando verify-etapa6:', error);
  process.exit(1);
});
