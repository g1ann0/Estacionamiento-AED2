// Verificación de autorización por endpoint. Nació con la Tarea 0.1 (rutas administrativas
// sin control de rol) y la Etapa 7.2 la extiende a toda la superficie nueva: turnos, cajas,
// estadías, comprobantes de estadía, sucursales y reportes.
//
// La tabla tiene tres columnas y no dos, porque desde la Etapa 1 hay tres roles: lo que el
// cliente no puede tocar, lo que el operador sí, y lo que es solo del dueño. Un endpoint que
// el operador puede usar y otro que no se ven idénticos desde afuera hasta que se los prueba.
//
// Corre contra un servidor ya levantado (no arranca uno propio) y necesita los usuarios de
// `seed-test-users.js`.
//
// Uso: RATE_LIMIT_OFF=true node scripts/seed-test-users.js && BASE_URL=http://localhost:3999 node scripts/verify-authz.js
const BASE_URL = process.env.BASE_URL || 'http://localhost:3999';

async function login(email, password) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (res.status === 429) {
    throw new Error(
      'El login está rate-limiteado (429). Levantá el servidor con RATE_LIMIT_OFF=true para correr las verificaciones.'
    );
  }
  if (!res.ok) throw new Error(`Login falló para ${email}: ${res.status} ${JSON.stringify(data)}`);
  return data.token;
}

// `permitidos` lista los roles que NO deben recibir 403. Todo el resto sí.
// El cliente nunca aparece en `permitidos`: ninguna de estas rutas es de la app del conductor.
const RUTAS = [
  // — Etapa 0: superficie administrativa original —
  { method: 'GET', path: '/api/admin/usuarios', permitidos: ['admin'] },
  { method: 'GET', path: '/api/admin/comprobantes', permitidos: ['admin'] },
  { method: 'GET', path: '/api/admin/vehiculos', permitidos: ['admin'] },
  { method: 'GET', path: '/api/admin/auditoria', permitidos: ['admin'] },
  { method: 'GET', path: '/api/facturas', permitidos: ['admin'] },
  { method: 'GET', path: '/api/usuarios', permitidos: ['admin'] },

  // — Etapa 4/5: caja, turno y operación de mostrador —
  { method: 'GET', path: '/api/cajas', permitidos: ['admin', 'operador'] },
  { method: 'POST', path: '/api/cajas', permitidos: ['admin'] },
  { method: 'GET', path: '/api/turnos/actual?cajaId=000000000000000000000000', permitidos: ['admin', 'operador'] },
  // El histórico de arqueos es del dueño: trae los importes de todos los turnos de todos los
  // operadores, que es exactamente lo que la caja ciega le oculta al que cuenta el cajón.
  { method: 'GET', path: '/api/turnos', permitidos: ['admin'] },
  { method: 'GET', path: '/api/estadias/activas', permitidos: ['admin', 'operador'] },
  { method: 'GET', path: '/api/estadias/historial', permitidos: ['admin', 'operador'] },

  // — Etapa 3/6: comprobantes de estadía —
  { method: 'GET', path: '/api/comprobantes-estadia', permitidos: ['admin', 'operador'] },
  { method: 'GET', path: '/api/comprobantes-estadia/fiscal/estado', permitidos: ['admin', 'operador'] },
  // Se prueba con un id inexistente a propósito: interesa quién pasa el portero, y así la
  // verificación no dispara una conversación real con ARCA por correr el script.
  { method: 'POST', path: '/api/comprobantes-estadia/000000000000000000000000/reintentar-cae', permitidos: ['admin'] },

  // — Configuración y reportes —
  { method: 'GET', path: '/api/sucursales', permitidos: ['admin', 'operador'] },
  { method: 'POST', path: '/api/sucursales', permitidos: ['admin'] },
  { method: 'GET', path: '/api/reportes/recaudacion', permitidos: ['admin'] },
  { method: 'GET', path: '/api/reportes/ocupacion', permitidos: ['admin'] },
  { method: 'GET', path: '/api/reportes/cierres', permitidos: ['admin'] }
];

async function llamar(method, path, token) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    // Cuerpo vacío en los POST: lo que se prueba es el portero, no el formulario. Un 400 por
    // datos faltantes ya significa que el rol pasó, que es justo lo que la tabla afirma.
    body: method === 'POST' ? '{}' : undefined
  });
  return res.status;
}

(async () => {
  let fallos = 0;
  const anotar = (bien, texto) => {
    console.log(`${bien ? 'OK  ' : 'FALLA'} ${texto}`);
    if (!bien) fallos += 1;
  };

  const tokens = {
    admin: await login('test-admin@verify.local', 'Test1234!'),
    operador: await login('test-operador@verify.local', 'Test1234!'),
    cliente: await login('test-cliente@verify.local', 'Test1234!')
  };

  console.log('— Autorización por rol y endpoint —');
  for (const { method, path, permitidos } of RUTAS) {
    for (const rol of ['admin', 'operador', 'cliente']) {
      const status = await llamar(method, path, tokens[rol]);
      const deberiaPasar = permitidos.includes(rol);
      const paso = status !== 403;
      anotar(
        paso === deberiaPasar,
        `[${rol} -> ${status}${deberiaPasar ? '' : ', esperado 403'}] ${method} ${path}`
      );
    }
  }

  console.log('\n— IDOR —');
  // Un cliente no puede leer los vehículos de otro DNI.
  const otroDni = '90000003'; // dni de TEST_CLIENTE2, no el de TEST_CLIENTE
  const statusIdor = await llamar('GET', `/api/vehiculos/usuario/${otroDni}`, tokens.cliente);
  anotar(statusIdor === 403, `[cliente -> ${statusIdor}] GET /api/vehiculos/usuario/:dni de otro`);

  // Sin token no entra nadie: la tabla de arriba prueba roles, esto prueba la puerta.
  const sinToken = await fetch(`${BASE_URL}/api/turnos`);
  anotar(sinToken.status === 401, `[sin token -> ${sinToken.status}] GET /api/turnos`);

  console.log(`\n${fallos === 0 ? '✅ TODO OK' : `❌ ${fallos} fallo(s)`}`);
  process.exit(fallos === 0 ? 0 : 1);
})().catch(err => {
  console.error('Error ejecutando verify-authz:', err.message);
  process.exit(1);
});
