const AuditLog = require('../models/AuditLog');

// Servicio único de auditoría. Reemplaza a los cuatro modelos ad-hoc que existían
// (LogSaldo, LogVehiculo, LogPrecio, LogConfiguracionEmpresa), cada uno con su propio
// esquema, sus propios índices y su propia forma de nombrar "quién" y "cuándo".
//
// Por qué se consolidó: la pantalla de Auditoría tenía que saber leer cinco formatos
// distintos para responder una sola pregunta —qué pasó, quién lo hizo y cuándo—, y cada
// funcionalidad nueva (turno, caja, comprobante, anulación) sumaba un modelo más.
//
// El registro de auditoría nunca hace fallar la operación de negocio: si falla, se loguea y
// se sigue. Perder un cobro real por un fallo de auditoría sería peor que perder el rastro.

const ENTIDADES = {
  USUARIO: 'Usuario',
  VEHICULO: 'Vehiculo',
  PRECIO: 'ConfiguracionPrecio',
  EMPRESA: 'ConfiguracionEmpresa',
  ESTADIA: 'Estacionamiento',
  TURNO: 'Turno',
  CAJA: 'MovimientoCaja',
  COMPROBANTE: 'ComprobanteEstadia'
};

async function registrar({
  entidad,
  entidadId,
  accion,
  usuarioId = null,
  usuarioDni = null,
  actor = null,
  afectado = null,
  ip = '',
  datosAnteriores = null,
  datosNuevos = null,
  motivo = '',
  session = null
}) {
  try {
    await AuditLog.create([{
      entidad,
      entidadId: String(entidadId),
      accion,
      usuarioId,
      usuarioDni: usuarioDni ?? actor?.dni ?? null,
      actor,
      afectado,
      ip,
      datosAnteriores,
      datosNuevos,
      motivo
    }], session ? { session } : undefined);
  } catch (error) {
    console.error('[auditoriaService] Error al registrar auditoría (no bloqueante):', error.message);
  }
}

// Normaliza el objeto de usuario que se guarda como actor o afectado. Los cuatro Log*
// guardaban el mismo bloque {dni, nombre, apellido, email} con nombres de campo distintos
// (`modificadoPor`, `usuarioAfectado`, `usuario`); acá hay una sola forma.
function persona(usuario) {
  if (!usuario) return null;
  return {
    dni: usuario.dni ?? null,
    nombre: usuario.nombre ?? null,
    apellido: usuario.apellido ?? null,
    email: usuario.email ?? null
  };
}

// Consulta paginada genérica. Sustituye a los cuatro pares find/countDocuments que cada
// controlador implementaba por su cuenta.
async function consultar({ filtro = {}, pagina = 1, limite = 20 } = {}) {
  const salto = (Number(pagina) - 1) * Number(limite);
  const [registros, total] = await Promise.all([
    AuditLog.find(filtro).sort({ fecha: -1 }).skip(salto).limit(Number(limite)).lean(),
    AuditLog.countDocuments(filtro)
  ]);
  return {
    registros,
    total,
    pagina: Number(pagina),
    paginas: Math.ceil(total / Number(limite)) || 1
  };
}

module.exports = { registrar, consultar, persona, ENTIDADES };
