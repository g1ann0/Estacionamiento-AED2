// Test rápido de fecha
const fecha1 = new Date();
console.log('new Date():', fecha1);
console.log('toISOString():', fecha1.toISOString());
console.log('getFullYear():', fecha1.getFullYear());
console.log('getMonth():', fecha1.getMonth());
console.log('getDate():', fecha1.getDate());

// Método actual del service
function formatearFechaAFIP(fecha) {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, '0');
  const day = String(fecha.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

console.log('\nFecha AFIP actual:', formatearFechaAFIP(new Date()));

// Método correcto usando toISOString
function formatearFechaAFIPCorrecta(fecha) {
  return fecha.toISOString().split('T')[0].replace(/-/g, '');
}

console.log('Fecha AFIP correcta:', formatearFechaAFIPCorrecta(new Date()));
