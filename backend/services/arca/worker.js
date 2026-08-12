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
const { procesarPendientes } = require('../facturacionElectronicaService');

const INTERVALO_MS = Number(process.env.ARCA_WORKER_INTERVALO_MS || 5 * 60 * 1000);
const LOTE = Number(process.env.ARCA_WORKER_LOTE || 20);

let temporizador = null;
let corriendo = false;
let ultimaCorrida = null;

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

  return temporizador;
}

function detener() {
  if (temporizador) clearInterval(temporizador);
  temporizador = null;
}

const estadoWorker = () => ({
  activo: Boolean(temporizador),
  corriendo,
  intervaloMs: INTERVALO_MS,
  lote: LOTE,
  ultimaCorrida
});

module.exports = { iniciar, detener, correrUnaVez, estadoWorker };
