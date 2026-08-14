// Cálculo del importe de una estadía.
//
// Vivía como tres líneas dentro de estadiaService (`Math.ceil` de horas por precio). Sale acá
// porque dejó de ser una multiplicación: ahora la tarifa puede depender del tipo de vehículo,
// cobrarse por fracción, tener recargo nocturno, de fin de semana o de feriado, y estar
// limitada por un tope diario.
//
// Dos decisiones que sostienen todo lo demás:
//
//   1. **Se cobra bloque por bloque, no de una.** Una estadía que entra a las 21:00 y sale a
//      las 23:00 con recargo nocturno desde las 22:00 paga una hora normal y una recargada. La
//      alternativa —mirar la hora de entrada y aplicar un solo criterio a toda la estadía— es
//      más simple de programar y más difícil de defender frente al cliente.
//   2. **Los recargos no se suman: gana el mayor.** Un feriado a la madrugada es un momento
//      caro una vez, no dos. Sumar porcentajes produce importes que el cajero no puede explicar.
//
// Sin configuración, esto devuelve exactamente lo que devolvía antes: hora entera hacia arriba,
// precio único, sin recargos ni tope.

const MINUTOS_POR_HORA = 60;
const MS_POR_MINUTO = 60 * 1000;
const UN_DIA_MINUTOS = 24 * 60;

// Día del calendario en hora local, AAAA-MM-DD. `toISOString()` daría el día en UTC, que en
// Argentina es el siguiente a partir de las 21:00 — y el recargo de feriado caería el día que no es.
const diaLocal = (fecha) => {
  const dos = (n) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
};

const minutosDelDia = (fecha) => fecha.getHours() * 60 + fecha.getMinutes();

const aMinutos = (hhmm, porDefecto) => {
  const partes = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? ''));
  if (!partes) return porDefecto;
  const horas = Number(partes[1]);
  const minutos = Number(partes[2]);
  if (horas > 23 || minutos > 59) return porDefecto;
  return horas * 60 + minutos;
};

// La franja nocturna cruza la medianoche (22:00 → 06:00), así que no alcanza con "entre desde
// y hasta": cuando el inicio es mayor que el fin, el intervalo es la unión de los dos extremos.
const enFranja = (minuto, desde, hasta) =>
  (desde <= hasta ? minuto >= desde && minuto < hasta : minuto >= desde || minuto < hasta);

// Qué recargo corresponde a un instante. Devuelve el mayor aplicable, con su nombre, para que
// el comprobante y la pantalla puedan decir por qué se cobró de más.
function recargoDe(instante, reglas, feriados) {
  const candidatos = [];

  const feriado = reglas?.feriado?.porcentaje ?? 0;
  if (feriado > 0 && feriados?.has(diaLocal(instante))) {
    candidatos.push({ nombre: 'feriado', porcentaje: feriado });
  }

  const finDeSemana = reglas?.finDeSemana?.porcentaje ?? 0;
  const dia = instante.getDay();
  if (finDeSemana > 0 && (dia === 0 || dia === 6)) {
    candidatos.push({ nombre: 'fin de semana', porcentaje: finDeSemana });
  }

  const nocturno = reglas?.nocturno?.porcentaje ?? 0;
  if (nocturno > 0) {
    const desde = aMinutos(reglas?.nocturno?.desde, 22 * 60);
    const hasta = aMinutos(reglas?.nocturno?.hasta, 6 * 60);
    if (enFranja(minutosDelDia(instante), desde, hasta)) {
      candidatos.push({ nombre: 'nocturno', porcentaje: nocturno });
    }
  }

  if (candidatos.length === 0) return { nombre: null, porcentaje: 0 };
  return candidatos.reduce((mayor, actual) => (actual.porcentaje > mayor.porcentaje ? actual : mayor));
}

const redondear = (monto) => Math.round(monto * 100) / 100;

/**
 * @param {Date}   horaInicio
 * @param {Date}   horaFin
 * @param {number} precioPorHora
 * @param {object} tarifa         fraccionMinutos, topeDiario, recargos
 * @param {Set}    feriados       días AAAA-MM-DD con recargo
 */
function calcularCobro({ horaInicio, horaFin, precioPorHora, tarifa = {}, feriados = new Set() }) {
  const fraccion = Math.max(1, Number(tarifa.fraccionMinutos) || MINUTOS_POR_HORA);
  const topeDiario = tarifa.topeDiario == null ? null : Number(tarifa.topeDiario);
  const reglas = tarifa.recargos ?? {};

  const duracionMs = Math.max(0, horaFin - horaInicio);
  const duracionMinutosReal = duracionMs / MS_POR_MINUTO;
  const duracionHorasReal = duracionMinutosReal / MINUTOS_POR_HORA;

  // Fracciones completas hacia arriba: 5 minutos de estadía se cobran como una fracción. Una
  // estadía de duración cero (el egreso de excepción, por ejemplo) no cobra nada.
  const fracciones = duracionMinutosReal === 0 ? 0 : Math.ceil(duracionMinutosReal / fraccion);
  const precioPorFraccion = (precioPorHora * fraccion) / MINUTOS_POR_HORA;

  let total = 0;
  const detalleRecargos = new Map();
  // Los topes se llevan por ventana de 24 h contadas desde el ingreso, no por día de calendario:
  // el cliente entiende "un día de estadía" como 24 horas desde que dejó el auto.
  const acumuladoPorVentana = new Map();

  for (let i = 0; i < fracciones; i += 1) {
    // El precio del bloque lo fija el momento en que EMPIEZA. Con fracciones de una hora o
    // menos, partirlo más fino no cambia el importe de forma perceptible y sí vuelve el
    // cálculo imposible de reproducir a mano en el mostrador.
    const inicioBloque = new Date(horaInicio.getTime() + i * fraccion * MS_POR_MINUTO);
    const { nombre, porcentaje } = recargoDe(inicioBloque, reglas, feriados);
    const importeBloque = precioPorFraccion * (1 + porcentaje / 100);

    const ventana = Math.floor((i * fraccion) / UN_DIA_MINUTOS);
    const acumulado = acumuladoPorVentana.get(ventana) ?? 0;

    let importeCobrado = importeBloque;
    if (topeDiario != null) {
      const disponible = Math.max(0, topeDiario - acumulado);
      importeCobrado = Math.min(importeBloque, disponible);
    }
    acumuladoPorVentana.set(ventana, acumulado + importeCobrado);
    total += importeCobrado;

    if (nombre && importeCobrado > 0) {
      const previo = detalleRecargos.get(nombre) ?? { fracciones: 0, porcentaje };
      detalleRecargos.set(nombre, { fracciones: previo.fracciones + 1, porcentaje });
    }
  }

  const montoSinTope = redondear(fracciones * precioPorFraccion);

  return {
    duracionHorasReal,
    // Se conserva el nombre histórico: es la cantidad de horas facturadas, y con fracción de
    // 60 minutos da exactamente lo mismo que antes.
    duracionHoras: Math.ceil(fracciones * fraccion / MINUTOS_POR_HORA),
    fracciones,
    fraccionMinutos: fraccion,
    montoTotal: redondear(total),
    // Para que la pantalla pueda decir "se aplicó el tope diario" en vez de mostrar un número
    // más chico sin explicación.
    topeAplicado: topeDiario != null && redondear(total) < montoSinTope,
    recargosAplicados: [...detalleRecargos.entries()].map(([nombre, datos]) => ({ nombre, ...datos }))
  };
}

module.exports = { calcularCobro, recargoDe, diaLocal, enFranja };
