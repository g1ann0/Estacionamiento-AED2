// Normaliza los emails existentes a minúsculas.
//
// El modelo los guarda así desde el cambio de schema; esto arregla lo que quedó de antes, para
// que `Juan@Gmail.com` y `juan@gmail.com` dejen de ser dos cuentas.
//
// Las cuentas que colisionan al normalizar NO se tocan: fusionarlas significa decidir cuál se
// queda con las estadías, los comprobantes y el saldo, y eso no lo puede resolver un script.
// Quedan listadas para que alguien las mire; `scripts/migrar-emails-minuscula.js` las muestra
// en detalle.

module.exports = {
  descripcion: 'Emails de usuarios en minúsculas (sin fusionar los que colisionan)',

  async aplicar(db) {
    const usuarios = db.collection('usuarios');
    const todos = await usuarios.find({}, { projection: { email: 1 } }).toArray();

    const porNormalizado = new Map();
    for (const usuario of todos) {
      const clave = (usuario.email || '').trim().toLowerCase();
      porNormalizado.set(clave, [...(porNormalizado.get(clave) ?? []), usuario._id]);
    }
    const enChoque = new Set(
      [...porNormalizado.values()].filter((ids) => ids.length > 1).flat().map(String)
    );

    let normalizados = 0;
    for (const usuario of todos) {
      const normalizado = (usuario.email || '').trim().toLowerCase();
      if (!usuario.email || usuario.email === normalizado) continue;
      if (enChoque.has(String(usuario._id))) continue;
      await usuarios.updateOne({ _id: usuario._id }, { $set: { email: normalizado } });
      normalizados += 1;
    }

    return { revisados: todos.length, normalizados, omitidosPorChoque: enChoque.size };
  }
};
