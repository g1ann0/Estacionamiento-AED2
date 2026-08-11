// Migración: los cuatro modelos Log* ad-hoc pasan a la colección única AuditLog.
//
// Uso:
//   node scripts/migrar-logs-a-auditlog.js            → migra (idempotente)
//   node scripts/migrar-logs-a-auditlog.js --dry-run  → solo informa qué haría
//   node scripts/migrar-logs-a-auditlog.js --limpiar  → borra las colecciones viejas
//                                                        (solo después de verificar)
//
// Es idempotente: cada registro migrado lleva `datosNuevos._origen` con la colección y el
// _id de origen, y se usa como clave para no duplicar si se corre dos veces.
require('dotenv').config();
const mongoose = require('mongoose');

const NOMBRES_VIEJOS = ['logsaldos', 'logvehiculos', 'logprecios', 'logconfiguracionempresas'];

function persona(p) {
  if (!p) return null;
  return {
    dni: p.dni ?? null,
    nombre: p.nombre ?? null,
    apellido: p.apellido ?? null,
    email: p.email ?? null
  };
}

// Cada Log* nombraba lo mismo de forma distinta. Acá se traduce una vez y para siempre.
const TRADUCTORES = {
  logsaldos: (d) => ({
    entidad: 'Usuario',
    entidadId: d.usuarioAfectado?.dni ?? String(d._id),
    accion: `saldo_${d.tipoOperacion || 'ajuste_admin'}`,
    actor: persona(d.modificadoPor),
    afectado: persona(d.usuarioAfectado),
    usuarioDni: d.modificadoPor?.dni ?? null,
    fecha: d.fechaModificacion,
    ip: d.ip || '',
    datosAnteriores: { saldo: d.saldoAnterior },
    datosNuevos: { saldo: d.saldoNuevo, diferencia: d.diferencia, observaciones: d.observaciones || '' },
    motivo: d.motivo || ''
  }),

  logvehiculos: (d) => ({
    entidad: 'Vehiculo',
    entidadId: d.vehiculo?.dominio ?? d.dominio ?? String(d._id),
    accion: `vehiculo_${d.tipoOperacion || d.accion || 'modificacion'}`,
    actor: persona(d.modificadoPor),
    afectado: persona(d.usuarioAfectado ?? d.propietario),
    usuarioDni: d.modificadoPor?.dni ?? null,
    fecha: d.fechaModificacion ?? d.fecha,
    ip: d.ip || '',
    datosAnteriores: d.datosAnteriores ?? d.vehiculoAnterior ?? null,
    datosNuevos: d.datosNuevos ?? d.vehiculo ?? null,
    motivo: d.motivo || ''
  }),

  logprecios: (d) => {
    // El tipo de operación era implícito en qué campo venía en null.
    let accion = 'precio_modificacion';
    if (d.precioAnterior === null && d.precioNuevo !== null) accion = 'precio_creacion';
    else if (d.precioAnterior !== null && d.precioNuevo === null) accion = 'precio_eliminacion';
    return {
      entidad: 'ConfiguracionPrecio',
      entidadId: d.tipoUsuario,
      accion,
      actor: persona(d.modificadoPor),
      afectado: null,
      usuarioDni: d.modificadoPor?.dni ?? null,
      fecha: d.fechaModificacion,
      ip: d.ip || '',
      datosAnteriores: { precioPorHora: d.precioAnterior, descripcion: d.descripcionAnterior || '' },
      datosNuevos: { precioPorHora: d.precioNuevo, descripcion: d.descripcionNueva || '' },
      motivo: d.motivo || ''
    };
  },

  logconfiguracionempresas: (d) => ({
    entidad: 'ConfiguracionEmpresa',
    entidadId: String(d.configuracionId ?? d.empresaId ?? d._id),
    accion: `empresa_${d.operacion || d.tipoOperacion || 'modificacion'}`,
    actor: persona(d.usuario ?? d.modificadoPor),
    afectado: null,
    usuarioDni: (d.usuario ?? d.modificadoPor)?.dni ?? null,
    fecha: d.fecha ?? d.fechaModificacion,
    ip: d.ip || '',
    datosAnteriores: d.datosAnteriores ?? d.valorAnterior ?? null,
    datosNuevos: d.datosNuevos ?? d.valorNuevo ?? null,
    motivo: d.motivo || ''
  })
};

(async () => {
  const dryRun = process.argv.includes('--dry-run');
  const limpiar = process.argv.includes('--limpiar');

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const AuditLog = require('../models/AuditLog');

  const colecciones = (await db.listCollections().toArray()).map((c) => c.name);

  if (limpiar) {
    for (const nombre of NOMBRES_VIEJOS) {
      if (colecciones.includes(nombre)) {
        await db.collection(nombre).drop();
        console.log(`  eliminada: ${nombre}`);
      }
    }
    await mongoose.disconnect();
    console.log('\nColecciones viejas eliminadas.');
    return;
  }

  let migrados = 0;
  let omitidos = 0;

  for (const nombre of NOMBRES_VIEJOS) {
    if (!colecciones.includes(nombre)) {
      console.log(`- ${nombre}: no existe, nada que migrar`);
      continue;
    }

    const documentos = await db.collection(nombre).find({}).toArray();
    console.log(`- ${nombre}: ${documentos.length} registro(s)`);

    for (const doc of documentos) {
      const origen = { coleccion: nombre, id: String(doc._id) };

      const yaMigrado = await AuditLog.exists({
        'datosNuevos._origen.coleccion': nombre,
        'datosNuevos._origen.id': origen.id
      });
      if (yaMigrado) { omitidos++; continue; }

      const traducido = TRADUCTORES[nombre](doc);
      traducido.datosNuevos = { ...(traducido.datosNuevos || {}), _origen: origen };

      if (!dryRun) await AuditLog.create(traducido);
      migrados++;
    }
  }

  console.log(`\n${dryRun ? '[dry-run] ' : ''}migrados: ${migrados} · ya presentes: ${omitidos}`);
  if (!dryRun && migrados > 0) {
    console.log('Verificá la pantalla de Auditoría y después corré con --limpiar para eliminar las colecciones viejas.');
  }

  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
