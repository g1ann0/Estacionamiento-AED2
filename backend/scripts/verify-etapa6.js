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

const catalogos = require('../services/arca/catalogos');
const mock = require('../services/arca/mock');

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
  const ComprobanteEstadia = require('../models/ComprobanteEstadia');
  const Estacionamiento = require('../models/Estacionamiento');
  const { emitirComprobante, procesarPendientes, construirPedido } = require('../services/facturacionElectronicaService');

  mock.reiniciar();
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
    puntoVenta: '00001',
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

    // Idempotencia: un doble clic no puede producir dos CAE, porque un CAE no se borra.
    const repetido = await emitirComprobante(comprobante._id);
    check(repetido.yaEmitido === true, 'pedir CAE dos veces no llama a ARCA de nuevo');
    const trasRepetir = await ComprobanteEstadia.findById(comprobante._id);
    check(trasRepetir.cae === guardado.cae, 'el CAE no cambió al reintentar');

    // Worker.
    const otro = await ComprobanteEstadia.create({
      numero: Math.floor(Math.random() * 1e9),
      puntoVenta: '00001',
      tipoComprobante: 'ticket',
      estadiaId: estadia._id,
      receptor: { tipo: 'consumidor_final', nombre: 'Consumidor', apellido: 'Final', condicionIva: 'Consumidor Final' },
      medioPago: 'efectivo',
      subtotal: 500,
      total: 500,
      estado: 'pendiente_cae'
    });

    const corrida = await procesarPendientes({ limite: 50 });
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

async function main() {
  await verificarCatalogos();
  await verificarMock();
  await verificarEmision();

  console.log(`\n${fallos === 0 ? '✅ TODO OK' : `❌ ${fallos} fallas`} — ${ok} verificaciones`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('\nError ejecutando verify-etapa6:', error);
  process.exit(1);
});
