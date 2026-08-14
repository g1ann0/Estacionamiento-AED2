# Sistema de gestión de estacionamiento

Software de playa de estacionamiento: control de entradas y salidas, cobro por mostrador o por saldo prepago, caja con turnos y arqueo, y facturación electrónica ante ARCA.

Está pensado para que el turno cuadre. Todo lo que se cobra deja asiento, todo lo que sale deja comprobante, y todo cambio sensible —precio, saldo, vehículo, configuración— queda auditado con quién, cuándo y por qué.

---

## Qué hace

- **Terminal de mostrador.** Una patente resuelve todo: si el auto está adentro dice cuánto se cobra y con qué medios de pago; si está afuera, lo hace entrar. Sin cuenta de cliente de por medio.
- **Cobro** en efectivo, tarjeta, QR/transferencia o saldo prepago. El cobro por caja exige turno abierto: ese dinero necesita dónde conciliarse.
- **Caja y turnos** con apertura, movimientos manuales, arqueo a ciegas y cierre con diferencia. El operador cuenta el cajón sin ver el total esperado; el dueño ve todo después.
- **Facturación electrónica ARCA** (WSAA + WSFE), con emisión diferida —el cobro no espera a ARCA—, reintentos, anulación por nota de crédito y reconciliación automática.
- **Tarifas** por tipo de cliente y de vehículo, con fracción de cobro, recargo nocturno, de fin de semana y de feriado, y tope diario. Todo configurable y todo apagado por defecto.
- **App del conductor** para ver sus vehículos, sus estadías y sus comprobantes.
- **Auditoría** de todas las operaciones sensibles, en un solo lugar.

## Stack

Node + Express 5 y MongoDB (Mongoose 9) en el backend. React 19 con Vite en el frontend. Sin framework de UI: el sistema de diseño es propio y vive en `frontend/src/styles/`.

MongoDB tiene que ser un **replica set**, aunque sea de un solo nodo: un cobro son cinco escrituras y sin transacciones no hay forma de revertirlas juntas.

## Cómo se levanta

```bash
# Backend
cd backend
npm install
cp .env.example .env        # completar JWT_SECRET y MONGODB_URI
node server.js              # http://localhost:3000

# Frontend (otra terminal)
cd frontend
npm install
npm run dev                 # http://localhost:3001
```

El primer administrador se crea a mano — no hay credencial por defecto:

```bash
node scripts/crear-admin.js <email> <dni> <contraseña>
```

## Scripts

Todos se corren desde `backend/`.

| Para qué | Comando |
|---|---|
| Crear o promover un administrador | `node scripts/crear-admin.js <email> <dni> <pass>` |
| Ver y aplicar migraciones de datos | `node scripts/migrar.js` · `node scripts/migrar.js aplicar` |
| Usuarios de prueba para las verificaciones | `node scripts/seed-test-users.js` · `... cleanup` |
| Estado de los servicios de ARCA | `node scripts/arca-estado.js` |
| Generar clave privada y CSR | `node scripts/arca-generar-csr.js <CUIT> <alias>` |
| Probar el login contra ARCA | `node scripts/arca-probar-login.js` |
| Verificar producción **sin emitir nada** | `ARCA_AMBIENTE=produccion node scripts/arca-verificar-produccion.js` |

### Verificaciones

No hay framework de tests: hay scripts que ejercitan el sistema real contra la base y la API, y dicen en castellano qué falló. Necesitan el servidor levantado con `RATE_LIMIT_OFF=true`.

```bash
node scripts/seed-test-users.js
BASE_URL=http://localhost:3000 node scripts/verify-seguridad.js   # los agujeros cerrados
BASE_URL=http://localhost:3000 node scripts/verify-authz.js       # permisos por rol y endpoint
BASE_URL=http://localhost:3000 node scripts/verify-etapa7.js      # cierres, IDOR de turno, rate limit
node scripts/verify-tarifas.js                                    # motor de tarifas (no necesita servidor)
ARCA_MOCK=true node scripts/verify-etapa6.js                      # facturación electrónica
```

`verify-etapa1` … `verify-etapa7`, `verify-resolver`, `verify-concurrencia` y `verify-excepcion` cubren el resto por etapa.

## Documentación

| Documento | Para qué |
|---|---|
| [`PRODUCT.md`](PRODUCT.md) | Qué es el producto, para quién, y qué está decidido |
| [`docs/despliegue-produccion.md`](docs/despliegue-produccion.md) | Checklist del primer despliegue real |
| [`docs/tarifas.md`](docs/tarifas.md) | Cómo se calcula lo que se cobra |
| [`docs/auditoria-seguridad.md`](docs/auditoria-seguridad.md) | Los agujeros que había, cómo se cerraron y qué queda |
| [`docs/analisis-gap-cgas/08-PLAN-IMPLEMENTACION.md`](docs/analisis-gap-cgas/08-PLAN-IMPLEMENTACION.md) | El plan por etapas y su estado |
| [`docs/analisis-gap-cgas/10-ARCA-...`](docs/analisis-gap-cgas/10-ARCA-COMO-OBTENER-EL-CERTIFICADO.md) | Certificado de ARCA e instalación en un cliente |
| [`docs/analisis-gap-cgas/`](docs/analisis-gap-cgas/) 01-07, 09 | El análisis que fundamenta cada decisión del diseño |
| [`docs/rediseno-admin/`](docs/rediseno-admin/) | El rediseño del panel: propuesta, poda y auditoría de modelos |

## Estado

Etapas 0 a 7 implementadas y verificadas. La integración con ARCA está probada contra **homologación real** (factura B con CAE y su nota de crédito, 2026-08-12).

Lo único pendiente es el pasaje a **producción**, que no es código: el certificado y el punto de venta se emiten contra el CUIT de quien va a facturar. El circuito completo para el día de la instalación está en el documento 10.
