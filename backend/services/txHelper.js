const mongoose = require('mongoose');

let avisoFallbackEmitido = false;

// Ejecuta fn(session) dentro de una transacción de MongoDB (requiere replica set/mongos).
// Reutilizable por cualquier servicio que necesite atomicidad multi-documento
// (estadiaService hoy; turnoService/egreso manual en etapas futuras).
//
// Si el despliegue de Mongo todavía no es replica set, degrada a ejecutar fn(null)
// sin sesión: la lógica de negocio sigue siendo segura ante condiciones de carrera
// gracias a los guards atómicos por documento (findOneAndUpdate con filtro de estado),
// pero se pierde el rollback automático multi-documento ante fallos parciales.
async function runInTransaction(fn) {
  const session = await mongoose.startSession();
  try {
    let resultado;
    await session.withTransaction(async () => {
      resultado = await fn(session);
    });
    return resultado;
  } catch (error) {
    if (error?.message?.includes('Transaction numbers are only allowed on a replica set member or mongos')) {
      if (!avisoFallbackEmitido) {
        console.warn('[txHelper] MongoDB no es replica set: ejecutando sin transacción (ver Tarea 0.3, docs/analisis-gap-cgas). Reconfigurar Mongo como replica set para atomicidad completa.');
        avisoFallbackEmitido = true;
      }
      return fn(null);
    }
    throw error;
  } finally {
    session.endSession();
  }
}

module.exports = { runInTransaction };
