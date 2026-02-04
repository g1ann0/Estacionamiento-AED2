const { obtenerFechaArgentina, formatearFechaAFIP } = require('../utils/fechaArgentina');

console.log('🌍 Zona horaria del sistema:', Intl.DateTimeFormat().resolvedOptions().timeZone);
console.log('\n📅 Comparación de fechas:');
console.log('━'.repeat(60));

const fechaUTC = new Date();
const fechaArgentina = obtenerFechaArgentina();

console.log('UTC (Date.now):');
console.log('  toISOString():', fechaUTC.toISOString());
console.log('  toString():', fechaUTC.toString());
console.log('  Año:', fechaUTC.getFullYear(), 'Mes:', fechaUTC.getMonth() + 1, 'Día:', fechaUTC.getDate());

console.log('\nArgentina (obtenerFechaArgentina):');
console.log('  toISOString():', fechaArgentina.toISOString());
console.log('  toString():', fechaArgentina.toString());
console.log('  Año:', fechaArgentina.getFullYear(), 'Mes:', fechaArgentina.getMonth() + 1, 'Día:', fechaArgentina.getDate());

console.log('\n📊 Formato AFIP:');
console.log('  UTC:', fechaUTC.toISOString().split('T')[0].replace(/-/g, ''));
console.log('  Argentina:', formatearFechaAFIP());

console.log('\n✅ La función debe retornar la fecha actual de Buenos Aires');
console.log('   Esperado: 20260203 (3 de febrero 2026)');
console.log('   Obtenido:', formatearFechaAFIP());
