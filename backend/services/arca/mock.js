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

const clave = (puntoVenta, tipoComprobante) => `${puntoVenta}-${tipoComprobante}`;

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

  return {
    // Un CAE real tiene 14 dígitos y jamás empieza en 0000.
    cae: `0000${String(Date.now()).slice(-10)}`,
    caeFchVto: aaaammdd,
    numero,
    observaciones: [],
    simulado: true
  };
}

const reiniciar = () => ultimos.clear();

module.exports = { ultimoNumeroAutorizado, solicitarCAE, reiniciar };
