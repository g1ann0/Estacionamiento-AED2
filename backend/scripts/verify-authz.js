// Verificación manual de Tarea 0.1 — corre contra un servidor ya levantado (no arranca uno propio).
// Uso: BASE_URL=http://localhost:3999 node scripts/verify-authz.js
const BASE_URL = process.env.BASE_URL || 'http://localhost:3999';

async function login(email, password) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Login falló para ${email}: ${res.status} ${JSON.stringify(data)}`);
  return data.token;
}

// Rutas admin-only que deben dar 403 a un cliente y NO dar 403 a un admin.
const RUTAS_ADMIN = [
  { method: 'GET', path: '/api/admin/usuarios' },
  { method: 'GET', path: '/api/admin/comprobantes' },
  { method: 'GET', path: '/api/admin/vehiculos' },
  { method: 'GET', path: '/api/admin/auditoria' },
  { method: 'GET', path: '/api/facturas' },
  { method: 'GET', path: '/api/usuarios' },
];

async function llamar(method, path, token) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.status;
}

(async () => {
  let fallos = 0;

  const tokenAdmin = await login('test-admin@verify.local', 'Test1234!');
  const tokenCliente = await login('test-cliente@verify.local', 'Test1234!');

  for (const { method, path } of RUTAS_ADMIN) {
    const statusCliente = await llamar(method, path, tokenCliente);
    const statusAdmin = await llamar(method, path, tokenAdmin);

    if (statusCliente !== 403) {
      console.error(`FAIL [cliente debería dar 403] ${method} ${path} -> ${statusCliente}`);
      fallos++;
    } else {
      console.log(`OK   [cliente -> 403]  ${method} ${path}`);
    }

    if (statusAdmin === 403) {
      console.error(`FAIL [admin no debería dar 403] ${method} ${path} -> ${statusAdmin}`);
      fallos++;
    } else {
      console.log(`OK   [admin -> ${statusAdmin}] ${method} ${path}`);
    }
  }

  // IDOR puntual: cliente no puede leer vehículos de otro DNI.
  const otroDni = '90000003'; // dni de TEST_CLIENTE2, no el de TEST_CLIENTE
  const statusIdor = await llamar('GET', `/api/vehiculos/usuario/${otroDni}`, tokenCliente);
  if (statusIdor !== 403) {
    console.error(`FAIL [IDOR vehiculos/usuario/:dni] -> ${statusIdor}`);
    fallos++;
  } else {
    console.log(`OK   [IDOR vehiculos/usuario/:dni -> 403]`);
  }

  console.log(`\n${fallos === 0 ? '✅ TODO OK' : `❌ ${fallos} fallo(s)`}`);
  process.exit(fallos === 0 ? 0 : 1);
})().catch(err => {
  console.error('Error ejecutando verify-authz:', err);
  process.exit(1);
});
