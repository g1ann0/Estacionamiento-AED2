// Prepara las tarifas existentes para la tarifa por tipo de vehículo.
//
// Dos cosas que el cambio de schema NO hace solo, y que sin esto rompen el alta de tarifas con
// un error de clave duplicada:
//
//   1. **El índice único viejo sigue vivo en Mongo.** `tipoUsuario` era `unique: true`; sacarlo
//      del modelo no borra el índice ya creado en la base — Mongoose crea índices, nunca los
//      elimina. Con `tipoUsuario_1` presente no puede existir "asociado / auto" y
//      "asociado / moto" a la vez, que es justamente lo que el cambio habilita.
//   2. **Los documentos anteriores no tienen `tipoVehiculo`.** El campo ausente no es 'todos'
//      para una consulta: `{tipoUsuario:'asociado', tipoVehiculo:'todos'}` no los encuentra, y
//      el upsert intenta crear un duplicado en vez de actualizarlos.

module.exports = {
  descripcion: 'Tarifas: campo tipoVehiculo en las existentes y baja del índice único viejo',

  async aplicar(db) {
    const coleccion = db.collection('configuracionprecios');

    const actualizados = await coleccion.updateMany(
      { tipoVehiculo: { $exists: false } },
      { $set: { tipoVehiculo: 'todos' } }
    );

    let indiceEliminado = false;
    const indices = await coleccion.indexes();
    if (indices.some((indice) => indice.name === 'tipoUsuario_1')) {
      await coleccion.dropIndex('tipoUsuario_1');
      indiceEliminado = true;
    }

    return { tarifasActualizadas: actualizados.modifiedCount, indiceViejoEliminado: indiceEliminado };
  }
};
