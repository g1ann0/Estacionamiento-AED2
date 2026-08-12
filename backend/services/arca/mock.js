// Mock del WSFE: devuelve un CAE falso para poder recorrer el circuito sin certificado.
//
// PRODUCT.md fija que el objetivo es ARCA real, sin modo mock permanente. Este archivo es
// andamio de desarrollo y se comporta como tal:
//
//   - El CAE arranca con "0000" y ARCA nunca emite uno así. Un CAE de mock es reconocible a
//     simple vista, para que nadie lo confunda con uno válido en una pantalla o en un PDF.
//   - Todo lo que devuelve viene marcado con `simulado: true`, y quien persista un comprobante
//     con esa marca tiene que dejarla asentada.
//   - Se niega a funcionar si el ambiente es producción: si alguien despliega con
//     ARCA_MOCK=true apuntando a producción, es un error de configuración, no una opción.

const { leerConfig } = require('./config');

// Numeración en memoria, por punto de venta y tipo. No pretende sobrevivir a un reinicio: es
// exactamente lo que hace falta para probar la correlatividad en desarrollo.
const ultimos = new Map();

// Lo que el mock "autorizó", para poder responder consultas como hace ARCA. Es lo que permite
// probar la reconciliación: el caso en que ARCA otorgó el CAE y la persistencia local falló.
const autorizados = new Map();

const clave = (puntoVenta, tipoComprobante) => `${puntoVenta}-${tipoComprobante}`;
const claveComprobante = (puntoVenta, tipoComprobante, numero) => `${puntoVenta}-${tipoComprobante}-${numero}`;

const verificarAmbiente = () => {
  const config = leerConfig();
  if (config.ambiente === 'produccion') {
    throw new Error(
      'ARCA_MOCK=true con ARCA_AMBIENTE=produccion. El mock no emite comprobantes fiscales: ' +
      'apagá el mock o cambiá el ambiente.'
    );
  }
};

async function ultimoNumeroAutorizado(puntoVenta, tipoComprobante) {
  verificarAmbiente();
  return ultimos.get(clave(puntoVenta, tipoComprobante)) ?? 0;
}

async function solicitarCAE(datos) {
  verificarAmbiente();

  const { puntoVenta, tipoComprobante } = datos;
  const numero = (ultimos.get(clave(puntoVenta, tipoComprobante)) ?? 0) + 1;
  ultimos.set(clave(puntoVenta, tipoComprobante), numero);

  // Las validaciones que ARCA sí hace y que conviene que fallen temprano, en desarrollo, y no
  // el día que se conecte el certificado real.
  if (!datos.importes || datos.importes.impTotal <= 0) {
    const error = new Error('ARCA no autorizó el comprobante: (10015) El importe total debe ser mayor a cero');
    error.rechazadoPorArca = true;
    throw error;
  }

  const suma = Number((datos.importes.impNeto + datos.importes.impIVA).toFixed(2));
  if (Math.abs(suma - datos.importes.impTotal) > 0.01) {
    const error = new Error(
      `ARCA no autorizó el comprobante: (10048) La suma de neto e IVA (${suma}) no coincide con el total (${datos.importes.impTotal})`
    );
    error.rechazadoPorArca = true;
    throw error;
  }

  if (datos.concepto !== 1 && !datos.periodoServicio) {
    const error = new Error('ARCA no autorizó el comprobante: (10016) Concepto de servicios sin período informado');
    error.rechazadoPorArca = true;
    throw error;
  }

  const vencimiento = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
  const aaaammdd = vencimiento.toISOString().slice(0, 10).replace(/-/g, '');

  const respuesta = {
    // Un CAE real tiene 14 dígitos y jamás empieza en 0000.
    cae: `0000${String(Date.now()).slice(-10)}`,
    caeFchVto: aaaammdd,
    numero,
    observaciones: [],
    simulado: true
  };

  // El comprobante queda registrado ANTES de devolverlo, igual que en ARCA: si el que llama se
  // cae después de recibir el CAE, para ARCA el comprobante existe igual. Esa asimetría es
  // justamente lo que la reconciliación viene a reparar.
  autorizados.set(claveComprobante(puntoVenta, tipoComprobante, numero), {
    ...respuesta,
    fecha: datos.fecha,
    importeTotal: datos.importes.impTotal,
    documento: datos.documento
  });

  // Modo de falla para poder probar la reconciliación: ARCA autoriza, y el cliente nunca se
  // entera. Se activa desde el propio test, no desde configuración.
  if (fallarDespuesDeAutorizar) {
    const error = new Error('Simulación: la conexión se cortó después de que ARCA autorizó');
    error.code = 'ECONNRESET';
    throw error;
  }

  return respuesta;
}

async function consultarComprobante(puntoVenta, tipoComprobante, numero) {
  verificarAmbiente();
  return autorizados.get(claveComprobante(puntoVenta, tipoComprobante, numero)) ?? null;
}

// Interruptor del modo de falla. Vive acá y no en la configuración porque no es una opción de
// despliegue: es una herramienta de prueba.
let fallarDespuesDeAutorizar = false;
const simularCorteTrasAutorizar = (activo) => { fallarDespuesDeAutorizar = activo; };

const reiniciar = () => {
  ultimos.clear();
  autorizados.clear();
  fallarDespuesDeAutorizar = false;
};

module.exports = { ultimoNumeroAutorizado, solicitarCAE, consultarComprobante, reiniciar, simularCorteTrasAutorizar };
