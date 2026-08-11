# Funcionalidades a quitar, simplificar o deprecar

> Poda hecha con el contexto de cómo operan los sistemas profesionales del rubro (ver sección I de [`00-PROPUESTA-UX-ADMIN.md`](00-PROPUESTA-UX-ADMIN.md)).
>
> **ESTADO: ejecutada.** Aprobada explícitamente el 2026-08-09, grupos 1, 2 y 4 incluidos.
> Verificación posterior: `node scripts/verify-resolver.js` (22/22) y `node scripts/verify-etapa2.js` (15/15), ambos verdes.

## Estado de ejecución

| Grupo | Estado |
|---|---|
| 1 · Código muerto | ✅ Ejecutado — 9 archivos eliminados, rutas y montajes limpiados |
| 2.1 · Portón | ✅ Ejecutado — campo opcional, fuera de los tres flujos que lo pedían |
| 2.2 · Tarifas huérfanas | ✅ Ejecutado — validación honesta, whitelist de prueba eliminada |
| 2.3 · APIs duplicadas | ✅ Ejecutado — 3 endpoints eliminados |
| 2.4 · Consolidar `Log*` en `AuditLog` | ✅ Ejecutado — 4 modelos eliminados, datos migrados, `routes/auditoria.js` reescrito de 272 a 130 líneas |
| 3 · Se queda | ✅ Verificado — `SEO.jsx` solo se usa en Home, Login y Registro; detrás del login no había nada que sacar |
| 4 · Recarga de saldo | ✅ Ejecutado — alta cerrada, saldos existentes intactos |

### El build roto: resuelto

`npm run build` fallaba con `'use' is not exported from 'react'` desde antes de la poda: `react-router-dom@7` llama a `React.use()`, que existe en React 19, y el proyecto tenía React 18.3.1 con `react-scripts` 5.0.1 —la última versión de CRA, de 2022— fijando todo lo demás.

Se resolvió migrando a Vite + React 19, que era la fase 0 del plan. Detalle abajo.

<details>
<summary>Diagnóstico original</summary>

### Hallazgo aparte: el build del frontend ya estaba roto

`npm run build` falla con `'use' is not exported from 'react'`. Es **anterior a esta poda** y no lo causa: viene de `react-router-dom@7.7.1`, que llama a `React.use()` (`react-router/dist/development/chunk-KIUJAIYX.mjs:2497`), un hook que existe recién en React 19, mientras el proyecto tiene React 18.3.1 instalado.

Es la misma discrepancia que ya estaba anotada en `PRODUCT.md`: el README declara React 19.1.0 y el `package.json` fija React 18.

Salidas: subir a React 19 (alinea con lo que el README ya dice y desbloquea react-router 7) o bajar react-router a 6. Corresponde resolverlo en la **fase 0**, que es la que toca el build. Los archivos modificados en esta poda se verificaron aparte con `esbuild`: los seis parsean sin error.

</details>

### Fase 0 ejecutada: migración a Vite + actualización total de dependencias

| Antes | Ahora |
|---|---|
| `react-scripts` 5.0.1 (CRA, último release 2022) | Vite 8.2.1 + `@vitejs/plugin-react` 6 |
| React 18.3.1 | React 19.2.8 |
| `react-router-dom` 7.7.1 (roto sobre React 18) | 7.18.2, funcionando |
| `react-helmet-async` | **eliminado** — React 19 eleva `<title>`/`<meta>` de forma nativa |
| `web-vitals`, `workbox-webpack-plugin` | **eliminados** |
| Express 4.18 · Mongoose 7.4 · bcryptjs 2 · dotenv 16 | Express 5.2 · Mongoose 9.9 · bcryptjs 3 · dotenv 17 |
| ~1500 paquetes en el frontend | 346 paquetes, 0 vulnerabilidades |

**Rupturas encontradas y resueltas:**

- Express 5 cambió el motor de rutas: `app.get('*')` hacía fallar el arranque, y `app.use('/api/*')` dejó de ser un patrón válido.
- El driver de Mongo rechaza `useNewUrlParser`/`useUnifiedTopology`: **la conexión a la base fallaba en el arranque** hasta sacarlas.
- Mongoose 9 dejó de pasar el callback `next` a los hooks de documento (3 hooks reescritos como `async`).
- `new: true/false` en `findOneAndUpdate` quedó deprecado → `returnDocument` (16 llamadas).
- Índices duplicados declarados dos veces en `Vehiculo` y `Factura`.

**Y un hallazgo mayor: la PWA nunca tuvo service worker.** `config-overrides.js` lo configuraba vía `InjectManifest`, pero los scripts llamaban a `react-scripts` directamente y `react-app-rewired` no estaba ni instalado, así que ese archivo **nunca se ejecutó**. Tampoco había ningún `serviceWorker.register()` en el código. El manifest existía —la app se podía instalar— pero no había nada offline detrás. `vite-plugin-pwa` genera el primero que realmente funciona: 19 archivos precacheados y la API en NetworkFirst.

---

## 1. Quitar ya — código muerto o de desarrollo corriendo en producción

Sin riesgo, sin discusión de producto.

| Qué | Evidencia | Por qué |
|---|---|---|
| Rutas `/diagnostico`, `/debug-login`, `/debug-dashboard` | `App.js:133-135` | Tres pantallas de depuración ruteadas en el bundle de producción, dos de ellas con flujos de login alternativos. |
| `Login_temp.jsx` | 223 líneas, no importado por nadie | Copia muerta de la pantalla de login. |
| `ListladoComprobantes.jsx` | 345 líneas | Duplicado con errata de `ListadoComprobantes.jsx`. Dos archivos que hay que mantener sincronizados y nadie sabe cuál está vivo. |
| `POST /api/analytics/web-vitals` | `routes/analytics.js` | En producción **el guardado está comentado como TODO**: el endpoint recibe métricas de cada carga de página y las descarta. Tráfico y superficie de API a cambio de nada. |
| `PerformanceMonitor` montado en todas las rutas | `App.js:126` | Es el emisor del endpoint anterior. Sin consumidor, sobra. |
| +20 `console.log` de depuración | `AdminDashboard.jsx:35,95,98,105,109,303-322,331-337,360-368,611-613…` | Uno de ellos informa por consola si hay token de sesión presente. No viajan al código nuevo. |
| URL `http://localhost:3000` hardcodeada | `AdminDashboard.jsx:36,148,187` | El resto del proyecto usa `config.js`. Estas tres llamadas no funcionan fuera de la máquina del desarrollador. |

---

## 2. Simplificar — fricción diaria sin retorno

### 2.1 El portón (Norte / Sur / Este / Oeste) — el peor costo/beneficio del sistema

`Estacionamiento.porton` es **obligatorio** (`models/Estacionamiento.js:15-19`) y se guarda también en `Transaccion`. El cajero elige un portón en cada ingreso.

**No lo usa absolutamente nada.** No entra en el cálculo de tarifa, no aparece en ningún reporte, no se puede filtrar por él, no se muestra en ninguna pantalla de consulta. Se escribe y no se lee nunca.

En una playa con 200 ingresos por turno, son 200 interacciones para producir un dato muerto.

Tres salidas, en orden de preferencia:

1. **Convertirlo en sector con capacidad** — que es lo que en los sistemas profesionales justifica dividir la playa: ocupación por sector, tarifa por sector, "sector completo". Si el dato va a existir, que haga algo.
2. **Default por sucursal, editable solo si hace falta** — el operador no lo toca nunca; queda disponible en el desplegable de datos avanzados.
3. **Sacarlo** — dejarlo opcional en el modelo y no pedirlo más.

Hoy es lo peor de los tres mundos: obligatorio, costoso e inútil.

### 2.2 Tipo de usuario tarifario como texto libre

`AdminDashboard` permite crear una tarifa escribiendo cualquier cadena como `tipoUsuario` (el placeholder sugiere `estudiante`, `tercera_edad`, `corporativo`). Pero la cascada real solo resuelve **tarifa asignada al usuario → `asociado`/`no_asociado` → default** (`estadiaService.js:45-49`).

Consecuencia: cada tarifa creada con un nombre inventado es una tarifa **huérfana**, que aparece en la lista, se puede editar, se audita en `LogPrecio`… y no se aplica nunca sola. Solo funciona si alguien la asigna a mano a un cliente.

Propuesta: tarifas con nombre libre, sí, pero **asignación explícita** como único mecanismo, y sacar la ilusión de que escribir "estudiante" crea un segmento tarifario.

### 2.3 Tres APIs para el mismo ingreso y egreso

`POST /api/estacionamiento/iniciar`, `POST /api/usuarios/ingresar` y `POST /api/transacciones/ingreso` hacen lo mismo. La Etapa 0.2 unificó la lógica por dentro (las tres delegan en `estadiaService`), pero **las tres siguen expuestas**: tres superficies para asegurar, versionar y mantener, con tres formas distintas de nombrar los mismos campos.

Propuesta: elegir una, deprecar las otras dos con aviso, y borrarlas cuando el frontend nuevo no las use.

### 2.4 Cuatro modelos `Log*` conviviendo con `AuditLog`

`LogSaldo`, `LogVehiculo`, `LogPrecio` y `LogConfiguracionEmpresa` son cuatro esquemas ad-hoc que hacen lo que `AuditLog` ya hace genérico. Está previsto en la Etapa 1.2 del plan; el rediseño de la pantalla de Auditoría es el momento natural de consolidar, porque hoy esa pantalla tiene que saber leer cinco formatos distintos.

---

## 3. Revisar — parece candidato pero se queda

| Qué | Veredicto |
|---|---|
| SEO, sitemap, structured data | **Se queda en la superficie pública** (home, login, registro), que es donde tiene sentido y donde vos lo marcaste como restricción. **Se saca de todo lo que está detrás del login**: `react-helmet-async` en cada pantalla del panel es peso sin destinatario — un panel de caja no se indexa. |
| PWA / service worker | Se queda. Es restricción confirmada y el criterio de aceptación de la migración a Vite. |
| Verificación de email | Se queda para la app del conductor. Nunca debe bloquear la caja: el cliente ocasional no tiene cuenta ni mail. |
| `facturas_pdf/` y PDFKit | Se quedan y **se amplían**: hoy generan la factura de recarga; van a generar el comprobante de estadía (sección D de la propuesta). |

---

## 4. Deprecar con cuidado — hay plata real de por medio

### La recarga de saldo con comprobante subido y aprobación manual

Es la funcionalidad más grande del panel actual, y la única que **ningún sistema profesional del rubro tiene**.

Cómo funciona hoy: el cliente transfiere por fuera del sistema, sube un comprobante, un administrador lo revisa y lo aprueba o rechaza a mano, recién entonces se le acredita saldo, y se genera una `Factura`. De ahí salen cuatro de las pantallas del panel —Comprobantes pendientes, Todos los comprobantes, Gestión de facturas, Control de transacciones— más el modelo `LogSaldo`.

Por qué sobra:

- **Ya existe cobro real.** Desde la Etapa 3 se cobra en el momento con efectivo, tarjeta o QR. El prepago dejó de ser el único medio de pago; pasó a ser un medio más, y el más caro de operar.
- **Cuesta trabajo administrativo por transacción.** Alguien tiene que mirar cada comprobante. Eso no escala y no lo hace nadie más en el rubro.
- **Su reemplazo natural existe y es mejor:** el **abono mensual**. Es lo que TIBA y E-PARKING venden como gestión de abonados, con vencimiento y bloqueo por mora. Resuelve el mismo problema —el cliente frecuente que no quiere pagar cada vez— sin revisión manual.

**No se borra.** Hay saldos cargados con plata real. El camino es:

1. **Cerrar el alta** de nuevas recargas (el botón desaparece de la app del conductor).
2. **Los saldos existentes se siguen gastando** normalmente como medio de pago `saldo_prepago`.
3. **Migrar el caso de uso a abonos** cuando el modelo exista.
4. Las cuatro pantallas pasan a **modo consulta** y se retiran cuando el último saldo llegue a cero.

Esta es una decisión de negocio, no de diseño. La propongo con el argumento arriba; no la ejecuto sin tu sí explícito.

---

## Resumen

| Grupo | Ítems | Necesita tu aprobación |
|---|---|---|
| 1 · Quitar ya | 7 | No — es limpieza |
| 2 · Simplificar | 4 | Sí, pero son decisiones chicas (sobre todo el portón) |
| 3 · Se queda | 4 | No |
| 4 · Deprecar recarga de saldo | 1 | **Sí, explícito** — hay plata real |
