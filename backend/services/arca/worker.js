// Worker de emisión diferida: le pide a ARCA los CAE que quedaron pendientes.
//
// Existe porque el cobro no espera a ARCA. Cada egreso deja su comprobante en `pendiente_cae`
// y este proceso lo resuelve después, reintentando los que fallaron.
//
// Dos cuidados:
//
//   - **Una corrida por vez.** ARCA numera de forma correlativa por punto de venta; dos
//     corridas simultáneas se pisan y producen el error 10016, que después hay que reintentar.
//     Serializar es más rápido que competir.
//   - **No arranca si la integración no está configurada.** Un worker que despierta cada
//     minuto para descubrir que le falta el certificado solo llena el log.

const { estadoIntegracion } = require('./index');
const { procesarPendientes, reconciliar } = require('../facturacionElectronicaService');

const INTERVALO_MS = Number(process.env.ARCA_WORKER_INTERVALO_MS || 5 * 60 * 1000);
const LOTE = Number(process.env.ARCA_WORKER_LOTE || 20);
// Reconciliación periódica (Tarea 6.2). El CAE y el commit local están en dos sistemas y no
// pueden ser atómicos: si el proceso se corta en el medio, ARCA queda con un comprobante
// autorizado que acá no figura. La corrida manual desde el panel existe, pero un descuadre
// fiscal que solo se detecta cuando alguien se acuerda de apretar el botón no se detecta.
// Cada 6 horas por defecto; 0 la apaga.
const RECONCILIACION_MS = Number(process.env.ARCA_RECONCILIACION_INTERVALO_MS ?? 6 * 60 * 60 * 1000);

let temporizador = null;
let temporizadorReconciliacion = null;
let corriendo = false;
let ultimaCorrida = null;
let ultimaReconciliacion = null;

async function correrUnaVez() {
  if (corriendo) return { omitido: 'ya hay una corrida en curso' };

  corriendo = true;
  const inicio = Date.now();
  try {
    const resultado = await procesarPendientes({ limite: LOTE });
    ultimaCorrida = { ...resultado, cuando: new Date(), duracionMs: Date.now() - inicio };

    if (resultado.procesados > 0) {
      console.log(
        `[ARCA] ${resultado.emitidos} comprobante(s) autorizado(s), ${resultado.fallidos} con error, ` +
        `de ${resultado.procesados} procesado(s) en ${ultimaCorrida.duracionMs} ms`
      );
      for (const error of resultado.errores) {
        console.warn(`[ARCA] comprobante ${error.comprobanteId}: ${error.mensaje}`);
      }
    }

    return ultimaCorrida;
  } catch (error) {
    // Que el worker falle no puede tumbar el servidor: los comprobantes siguen en la cola y
    // se reintentan en la próxima vuelta.
    console.error('[ARCA] la corrida del worker falló:', error.message);
    ultimaCorrida = { error: error.message, cuando: new Date() };
    return ultimaCorrida;
  } finally {
    corriendo = false;
  }
}

// Comparte el mismo cerrojo que la emisión: las dos hablan con el mismo punto de venta y la
// numeración de ARCA es correlativa, así que pisarse produce el 10016 que después hay que
// reintentar. Si el worker está emitiendo, la reconciliación espera a la vuelta siguiente.
async function reconciliarUnaVez() {
  if (corriendo) return { omitido: 'hay una corrida de emisión en curso' };

  corriendo = true;
  try {
    const resultado = await reconciliar();
    ultimaReconciliacion = { ...resultado, cuando: new Date() };

    // Silencio cuando todo cierra: el log solo habla cuando hay algo que mirar.
    if (resultado.faltantes > 0) {
      console.warn(
        `[ARCA] reconciliación: ${resultado.faltantes} comprobante(s) de diferencia con ARCA ` +
        `(último en ARCA ${resultado.ultimoEnArca}, local ${resultado.ultimoLocal}); ` +
        `${resultado.vinculados.length} vinculado(s), ${resultado.huerfanos.length} huérfano(s)`
      );
      for (const huerfano of resultado.huerfanos) {
        console.warn(`[ARCA] huérfano N° ${huerfano.numero} (CAE ${huerfano.cae}, $${huerfano.importeTotal}): requiere revisión manual`);
      }
    }

    return ultimaReconciliacion;
  } catch (error) {
    console.error('[ARCA] la reconciliación falló:', error.message);
    ultimaReconciliacion = { error: error.message, cuando: new Date() };
    return ultimaReconciliacion;
  } finally {
    corriendo = false;
  }
}

function iniciar() {
  const estado = estadoIntegracion();

  if (!estado.habilitada) {
    console.log(
      `[ARCA] worker apagado: falta configurar ${estado.faltantes.join(', ')}. ` +
      'Los comprobantes se emiten como ticket no fiscal.'
    );
    return null;
  }

  if (temporizador) return temporizador;

  console.log(`[ARCA] worker activo (${estado.modo}, ${estado.ambiente}) cada ${INTERVALO_MS / 1000}s`);

  // `unref` para que un worker dormido no impida que el proceso termine cuando corresponde.
  temporizador = setInterval(correrUnaVez, INTERVALO_MS);
  temporizador.unref?.();

  // Primera corrida en diferido: el arranque del servidor no se demora esperando a ARCA.
  setTimeout(correrUnaVez, 10000).unref?.();

  if (RECONCILIACION_MS > 0) {
    console.log(`[ARCA] reconciliación automática cada ${Math.round(RECONCILIACION_MS / 60000)} min`);
    temporizadorReconciliacion = setInterval(reconciliarUnaVez, RECONCILIACION_MS);
    temporizadorReconciliacion.unref?.();
    // La primera va un minuto después del arranque, ya con la emisión pendiente despachada.
    setTimeout(reconciliarUnaVez, 60000).unref?.();
  } else {
    console.log('[ARCA] reconciliación automática apagada (ARCA_RECONCILIACION_INTERVALO_MS=0)');
  }

  return temporizador;
}

function detener() {
  if (temporizador) clearInterval(temporizador);
  if (temporizadorReconciliacion) clearInterval(temporizadorReconciliacion);
  temporizador = null;
  temporizadorReconciliacion = null;
}

const estadoWorker = () => ({
  activo: Boolean(temporizador),
  corriendo,
  intervaloMs: INTERVALO_MS,
  lote: LOTE,
  ultimaCorrida,
  reconciliacion: {
    activa: Boolean(temporizadorReconciliacion),
    intervaloMs: RECONCILIACION_MS,
    ultima: ultimaReconciliacion
  }
});

module.exports = { iniciar, detener, correrUnaVez, reconciliarUnaVez, estadoWorker };
