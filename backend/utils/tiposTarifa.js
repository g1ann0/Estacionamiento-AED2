// La cascada de tarifas (estadiaService.obtenerTarifaDetallada) solo resuelve por sí sola dos
// tipos: `asociado` y `no_asociado`. Cualquier otra tarifa se aplica ÚNICAMENTE si un admin se
// la asigna explícitamente a un cliente (Usuario.tarifaAsignada).
//
// Antes de la poda, el panel dejaba escribir cualquier cadena como tipo de usuario, lo que
// producía tarifas huérfanas: aparecían en la lista, se podían editar, se auditaban en
// LogPrecio, y no se cobraban nunca porque no había ningún mecanismo que las eligiera.
// La validación de acá no prohíbe las tarifas con nombre —son un producto real, el de la
// tarifa asignada— pero sí deja de fingir que nombrar una crea un segmento automático.
const TIPOS_TARIFA_AUTOMATICA = ['asociado', 'no_asociado'];

module.exports = { TIPOS_TARIFA_AUTOMATICA };
