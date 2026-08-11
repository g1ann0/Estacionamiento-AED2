// Punto de entrada de la integración con ARCA.
//
// Elige el cliente real o el mock según la configuración, y expone la misma interfaz para los
// dos. El resto del sistema no sabe cuál está usando — salvo por la marca `simulado` que
// devuelve el mock, que sí viaja hasta el comprobante para que nunca se confunda con uno real.

const { leerConfig, validarConfig } = require('./config');
const wsfe = require('./wsfe');
const mock = require('./mock');
const catalogos = require('./catalogos');

const clienteArca = () => (leerConfig().usarMock ? mock : wsfe);

// ¿Está la integración en condiciones de emitir? Se consulta antes de intentar, para poder
// decirle al operador algo mejor que un stack trace.
const estadoIntegracion = () => {
  const config = leerConfig();
  const faltantes = validarConfig(config);

  return {
    ambiente: config.ambiente,
    modo: config.usarMock ? 'mock' : 'real',
    habilitada: config.usarMock || faltantes.length === 0,
    faltantes
  };
};

module.exports = {
  clienteArca,
  estadoIntegracion,
  leerConfig,
  catalogos
};
