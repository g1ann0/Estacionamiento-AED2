// Verificación del motor de tarifas: fracción de cobro, tarifa por tipo de vehículo, recargos
// por momento (nocturno, fin de semana, feriado) y tope diario.
//
// La primera prueba es la que más importa: sin configurar nada, el importe tiene que ser
// EXACTAMENTE el de antes. Todo lo demás nace apagado.
//
// El cálculo se prueba directo contra el motor, sin base ni servidor: es una función pura y
// probarla así permite fijar horas y feriados sin depender de cuándo se corre el script.
//
// Uso: node scripts/verify-tarifas.js

const { calcularCobro } = require('../services/tarifaEngine');

let ok = 0;
let fallos = 0;
const check = (condicion, descripcion, detalle = '') => {
  if (condicion) {
    console.log(`OK    ${descripcion}${detalle ? ` (${detalle})` : ''}`);
    ok += 1;
  } else {
    console.error(`FALLA ${descripcion}${detalle ? ` (${detalle})` : ''}`);
    fallos += 1;
  }
};

// Fechas locales explícitas: un martes común, un sábado y un feriado.
const martes = (hora, minuto = 0) => new Date(2026, 7, 11, hora, minuto, 0); // 11/08/2026, martes
const sabado = (hora, minuto = 0) => new Date(2026, 7, 15, hora, minuto, 0); // 15/08/2026, sábado
const feriado = (hora, minuto = 0) => new Date(2026, 7, 17, hora, minuto, 0); // 17/08/2026, lunes
const FERIADOS = new Set(['2026-08-17']);

const cobrar = (desde, hasta, precioPorHora, tarifa = {}, feriados = FERIADOS) =>
  calcularCobro({ horaInicio: desde, horaFin: hasta, precioPorHora, tarifa, feriados });

console.log('\n— Sin configurar: idéntico al comportamiento anterior —');

let r = cobrar(martes(10), martes(12), 1000);
check(r.montoTotal === 2000, 'dos horas exactas se cobran como dos horas', `$${r.montoTotal}`);

r = cobrar(martes(10), martes(12, 12), 1000);
check(r.montoTotal === 3000, 'la fracción va hacia arriba: 2h 12m son 3 horas', `$${r.montoTotal}`);
check(r.duracionHoras === 3, 'y `duracionHoras` sigue diciendo 3, como antes');

r = cobrar(martes(10), martes(10, 1), 1000);
check(r.montoTotal === 1000, 'un minuto se cobra como una hora', `$${r.montoTotal}`);

r = cobrar(martes(10), martes(10), 1000);
check(r.montoTotal === 0, 'una estadía de duración cero no cobra nada');
check(r.recargosAplicados.length === 0 && r.topeAplicado === false, 'y no reporta recargos ni tope');

console.log('\n— Fracción de cobro —');

r = cobrar(martes(10), martes(12, 12), 1000, { fraccionMinutos: 30 });
check(r.montoTotal === 2500, 'con media hora: 2h 12m se cobran 2h 30m', `$${r.montoTotal}`);
check(r.fracciones === 5, 'son cinco fracciones de 30 minutos', `${r.fracciones}`);

r = cobrar(martes(10), martes(10, 20), 1200, { fraccionMinutos: 15 });
check(r.montoTotal === 600, 'con cuarto de hora: 20 minutos se cobran 30', `$${r.montoTotal}`);

console.log('\n— Recargo nocturno —');

// 21:00 a 23:00 con recargo del 50% desde las 22:00: una hora normal y una recargada.
r = cobrar(martes(21), martes(23), 1000, {
  recargos: { nocturno: { porcentaje: 50, desde: '22:00', hasta: '06:00' } }
});
check(r.montoTotal === 2500, 'se cobra hora por hora: una normal y una nocturna', `$${r.montoTotal}`);
check(
  r.recargosAplicados.some((x) => x.nombre === 'nocturno' && x.fracciones === 1),
  'y el detalle dice que una sola fracción fue nocturna'
);

// Toda la estadía dentro de la franja, cruzando la medianoche.
r = cobrar(martes(23), new Date(2026, 7, 12, 2, 0, 0), 1000, {
  recargos: { nocturno: { porcentaje: 100, desde: '22:00', hasta: '06:00' } }
});
check(r.montoTotal === 6000, 'la franja nocturna cruza la medianoche sin cortarse', `$${r.montoTotal}`);

// Fuera de la franja, el recargo no existe.
r = cobrar(martes(10), martes(12), 1000, {
  recargos: { nocturno: { porcentaje: 100, desde: '22:00', hasta: '06:00' } }
});
check(r.montoTotal === 2000, 'de día no se aplica el recargo nocturno', `$${r.montoTotal}`);

console.log('\n— Fin de semana y feriado —');

r = cobrar(sabado(10), sabado(12), 1000, { recargos: { finDeSemana: { porcentaje: 20 } } });
check(r.montoTotal === 2400, 'el sábado se aplica el recargo de fin de semana', `$${r.montoTotal}`);

r = cobrar(martes(10), martes(12), 1000, { recargos: { finDeSemana: { porcentaje: 20 } } });
check(r.montoTotal === 2000, 'el martes no', `$${r.montoTotal}`);

r = cobrar(feriado(10), feriado(12), 1000, { recargos: { feriado: { porcentaje: 100 } } });
check(r.montoTotal === 4000, 'un día cargado como feriado duplica', `$${r.montoTotal}`);

r = cobrar(feriado(10), feriado(12), 1000, { recargos: { feriado: { porcentaje: 100 } } }, new Set());
check(r.montoTotal === 2000, 'el mismo día sin cargarlo como feriado no recarga nada', `$${r.montoTotal}`);

// Feriado a la madrugada: corresponden dos recargos y se aplica el mayor, no la suma.
r = cobrar(feriado(2), feriado(4), 1000, {
  recargos: { feriado: { porcentaje: 100 }, nocturno: { porcentaje: 50, desde: '22:00', hasta: '06:00' } }
});
check(r.montoTotal === 4000, 'con dos recargos posibles gana el mayor, no se suman', `$${r.montoTotal}`);

console.log('\n— Tope diario —');

// 10 horas a $1.000 son $10.000, pero el tope corta en $6.000.
r = cobrar(martes(8), martes(18), 1000, { topeDiario: 6000 });
check(r.montoTotal === 6000, 'el tope corta el importe del día', `$${r.montoTotal}`);
check(r.topeAplicado === true, 'y la respuesta lo dice, para que la pantalla lo pueda explicar');

// Dos días completos: el tope se aplica por cada ventana de 24 horas, no una sola vez.
r = cobrar(martes(8), new Date(2026, 7, 13, 8, 0, 0), 1000, { topeDiario: 6000 });
check(r.montoTotal === 12000, 'dos días de estadía pagan dos topes', `$${r.montoTotal}`);

r = cobrar(martes(8), martes(12), 1000, { topeDiario: 6000 });
check(r.montoTotal === 4000 && r.topeAplicado === false, 'por debajo del tope, no se toca nada', `$${r.montoTotal}`);

console.log('\n— Combinado —');

// Media hora de fracción, recargo nocturno y tope: el tope manda al final.
r = cobrar(martes(20), new Date(2026, 7, 12, 6, 0, 0), 1000, {
  fraccionMinutos: 30,
  topeDiario: 8000,
  recargos: { nocturno: { porcentaje: 50, desde: '22:00', hasta: '06:00' } }
});
check(r.montoTotal === 8000, 'con todo junto, el tope sigue siendo el techo', `$${r.montoTotal}`);

console.log(`\n${fallos === 0 ? '✅' : '❌'} ${ok}/${ok + fallos} OK${fallos ? `, ${fallos} falla(s)` : ''}`);
process.exit(fallos === 0 ? 0 : 1);
