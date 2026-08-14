# Auditoría de seguridad, bugs y rendimiento — 2026-08-13

Revisión completa del backend y del frontend (`backend/` 15k líneas, `frontend/src/` 8,6k). Todo lo listado acá se reprodujo primero y se corrigió después; la verificación automática vive en `backend/scripts/verificaciones/verify-seguridad.js` (24 comprobaciones) y en la matriz ampliada de `verificaciones/verify-authz.js`.

Para correr las verificaciones: servidor levantado con `RATE_LIMIT_OFF=true` y usuarios de `scripts/seed-test-users.js`.

---

## Crítico

### 1. Cualquier cliente podía acreditarse el saldo que quisiera

`POST /api/usuarios/recargar` aceptaba `{dni, monto}` y solo comprobaba que el DNI fuera el del token **o** que quien llamara fuera admin. El DNI del token siempre es el propio, así que la condición se cumplía sola: un cliente autenticado sumaba saldo sin pagar nada, y el comprobante que quedaba lo generaba él mismo. No había cobro real detrás — la plata aparecía de la nada.

**Corregido:** el endpoint responde 410. El circuito de recarga ya estaba discontinuado (el pago se cobra al retirar el vehículo); el ajuste de saldo por parte del dueño sigue existiendo por `PUT /api/admin/usuarios/:dni`, que es admin-only, exige motivo y queda en auditoría.

### 2. Toma de cuenta por inyección de operadores de MongoDB

`POST /api/auth/restablecer-password` metía el token del cuerpo directo en la consulta. Con `{"token": {"$ne": null}}` la consulta dejaba de significar "este token" y pasaba a significar "cualquiera": encontraba al primer usuario con un token de recuperación vivo y le cambiaba la contraseña. Sin conocer un solo dato de la víctima. El mismo patrón estaba en login, registro y solicitud de recuperación.

**Corregido:** `middlewares/sanitizarConsulta.js` rechaza con 400 cualquier clave que empiece con `$`, contenga un punto o venga como `campo[$ne]`, en cuerpo, query y params — para toda la API, incluidos los endpoints que se escriban mañana. Además, en `authController` los valores se fuerzan a texto antes de consultar. El parser de query queda fijado en `simple` porque de eso depende una de las defensas.

### 3. Cerrar la estadía de otro y debitarle el saldo

`POST /api/estacionamiento/finalizar` no comprobaba de quién era la estadía. Con la patente de otro en el cuerpo, un cliente cerraba la estadía ajena y el importe se debitaba del saldo del titular.

**Corregido:** la titularidad se resuelve contra la estadía activa (que es la que dice a quién se le cobra). El mostrador —operador o admin— sigue pudiendo cobrar cualquiera, que es su trabajo.

### 4. Salir gratis declarando "efectivo"

En el mismo endpoint, el medio de pago venía del cliente. Mandando `medioPago: 'efectivo'` la estadía se cerraba sin debitar saldo y sin turno de caja que la respaldara —el canal `app` no exige turno—, con lo cual el auto salía sin que nadie cobrara nada.

**Corregido:** en autoservicio el único medio posible es el saldo prepago, y ya no se acepta lo que diga el request. El cobro en efectivo/tarjeta/QR tiene su propio camino: `POST /api/estadias/egreso-manual`, con operador autenticado y turno abierto.

---

## Alto

| # | Hallazgo | Corrección |
|---|---|---|
| 5 | **Escritura de campos ajenos al formulario.** `PUT /api/vehiculos/usuario/:dni/vehiculo/:dominio` metía el cuerpo entero en el update. Se podía escribir `usuario` (regalarse o regalar un auto a otra cuenta) y `estActivo`, la marca de "está adentro": puesta en `false` a mano, el auto quedaba libre para volver a entrar sin haber salido. | Lista blanca de campos editables (`tipo`, `marca`, `modelo`, `año`). El estado de la estadía lo maneja `estadiaService`. |
| 6 | **Expresiones regulares escritas por el usuario.** Siete filtros de búsqueda construían `new RegExp(valor)` o `$regex: valor` sin escapar. Un término como `(a+)+$` es retroceso catastrófico: el servidor se queda calculando minutos por un request de una línea. | `escaparRegex`/`regexContiene` en `utils/consultas.js`, aplicados en los siete. Verificado: el término bomba responde en 15 ms. |
| 7 | **Listados sin techo.** `?limite=999999` convertía cualquier pantalla paginada en un volcado de la colección; `?pagina=abc` producía `skip: NaN` y un 500. | `paginar()` acota a 100 por página y normaliza; aplicado en los 9 listados. |
| 8 | **Fuga de patentes.** `/api/estacionamiento/estado/:dominio` y `/api/estacionamiento-estado/...` respondían a cualquier autenticado: se podía preguntar por una patente ajena y saber si el auto está adentro y desde cuándo. | Solo el titular o el mostrador. |
| 9 | **Borrar vehículos ajenos.** El permiso solo se comprobaba si el vehículo tenía propietario, así que cualquier cliente podía borrar del catálogo los autos de los clientes ocasionales. Y se podía borrar —o renombrar— un auto con estadía activa, dejando un cobro pendiente apuntando a una patente inexistente. | Los vehículos sin dueño son solo del admin; con el auto adentro, la baja y el cambio de patente responden 409. |
| 10 | **Sin límite de intentos.** El login era un oráculo de contraseñas gratis y `solicitar-recuperacion` un botón para inundar de correo la casilla de cualquiera. | `middlewares/rateLimit.js` (Etapa 7.2): 20/15 min en login y tokens, 5/hora en lo que dispara correo. |
| 11 | **Enumeración de cuentas.** El login devolvía 404 "usuario no encontrado" y 401 "contraseña incorrecta": contestaba gratis si una persona tiene cuenta. | Mismo 401 y mismo texto en los dos casos. |
| 12 | **Detalle interno en las respuestas 500.** Varios `catch` devolvían el objeto de error, con rutas y nombres de campos. | El error queda en el log del servidor; al cliente va el mensaje. |
| 13 | **Saldo sin validar.** `typeof montoDisponible === 'number'` deja pasar `NaN`, `Infinity` y negativos. Un saldo `NaN` rompe todas las cuentas río abajo sin decir por qué. | Se exige número finito y ≥ 0. |

---

## Bugs funcionales

| # | Hallazgo | Corrección |
|---|---|---|
| 14 | **El panel de ingresos y egresos escondía todo lo que entra por caja.** Filtraba en memoria las transacciones cuyo usuario no estuviera activo; desde la Etapa 2 las de cliente ocasional tienen `usuario: null`, o sea la mayoría del movimiento de una playa. Además el total de la paginación se calculaba sobre la página ya filtrada, así que siempre decía "una sola página". | Se listan todas y el total sale de `countDocuments`. |
| 15 | **Fechas corridas un día.** `new Date('2026-08-11')` es medianoche UTC — el 10 a las 21:00 en Argentina —, así que "hasta el 11" perdía el día 11 entero. | `fechaLocal`/`rangoDeFechas` en `utils/consultas.js`, compartidos por los listados con filtro de fechas. |
| 16 | **Token de recuperación eterno.** El vencimiento se comprobaba con `fecha < límite`; con la fecha ausente eso da `false`, o sea "no venció". | Sin fecha, vencido. |
| 17 | **Contraseña sin mínimo en el alta.** `setearPassword` no validaba nada: se podía crear una cuenta con la contraseña `a`. | Mismo mínimo que los otros dos caminos. |
| 18 | **Links de correo apuntando a `localhost:3001`** y remitente fijo a una cuenta personal, los dos escritos a mano en el código: fuera de la máquina del desarrollador, el link que recibe el cliente no funciona. | `APP_URL` y `SMTP_FROM`. |
| 19 | **El cambio de rol a operador se ignoraba en silencio** desde el panel de usuarios: la lista de roles aceptados se había quedado en `['cliente','admin']`. | Los tres roles. |
| 20 | **PDF de comprobante consultando un campo eliminado** (`Usuario.vehiculos[]`, borrado con el array embebido): una consulta de más que siempre devolvía vacío. | Se usan los dominios que el comprobante guardó al emitirse, que además es lo correcto para un comprobante. |
| 21 | **Un id inexistente devolvía 500** al reintentar el CAE. | 404. |

---

## Rendimiento

| # | Hallazgo | Corrección |
|---|---|---|
| 22 | **Índices faltantes en las cuatro colecciones que crecen sin techo.** La Terminal preguntaba "qué hay adentro" varias veces por minuto escaneando todo el historial de estadías; los listados de transacciones y el reporte de ocupación, igual. | Nueve índices nuevos en `Estacionamiento`, `Transaccion`, `MovimientoCaja` y `Turno`, cada uno con el acceso que lo justifica anotado al lado. |
| 23 | **La pantalla de auditoría agrupaba la colección entera en cada carga** —la colección que más crece del sistema— y encima los números no se correspondían con las filas mostradas. | La agregación usa el mismo filtro que la lista. |
| 24 | **Orden por campo arbitrario del request**: un escaneo sin índice a pedido. | Lista blanca de campos ordenables. |
| 25 | **Cuerpo de request sin límite explícito.** | 100 kb (no hay subida de archivos en esta API). |

---

## Endurecimiento adicional

- Cabeceras `X-Content-Type-Options`, `X-Frame-Options` y `Referrer-Policy`, sin dependencias nuevas.
- `CORS_ORIGINS` para sumar el dominio de producción: la lista estaba fija en puertos locales, y una lista que no incluye al frontend real termina "arreglándose" abriendo el CORS a cualquiera.
- `GET /api/precios/:tipoUsuario` era el único endpoint de precios sin token: dejaba leer la estructura comercial a quien pasara por la URL.
- En `SEO.jsx`, el `<` del JSON-LD se escapa: hoy los datos son estáticos, pero el día que uno venga de la configuración de la empresa el agujero aparecería sin que nadie lo relacione con ese archivo.
- ~100 líneas de código muerto comentado en `perfilController` y 8 `console.log` que imprimían datos de clientes.

---

## Verificación

```
verify-seguridad     24/24    (nuevo — un caso por agujero cerrado)
verify-authz         62/62    (3 roles × 20 endpoints + IDOR + sin token)
verify-etapa1..7             todas verdes
verify-etapa6       104/104   (mock ARCA)
verify-resolver, verify-concurrencia, verify-excepcion   verdes
npm run build (frontend)     OK
```

`verify-etapa3` cambió una afirmación: comprobaba que un cliente pudiera cerrar su estadía declarando "efectivo" sin que se le debitara el saldo — que es exactamente el agujero 4. Ahora ese cobro lo hace el mostrador, y se verifica además que el cliente no pueda elegir el medio de pago.

---

## Queda pendiente

- **Las migraciones no corren solas al arrancar.** Existen y están versionadas (`node scripts/migrar.js`), pero hay que ejecutarlas a mano en cada despliegue. Está en la checklist de [despliegue](despliegue-produccion.md).

---

## Cerrado después de la auditoría

Lo que quedaba anotado como deuda de arquitectura ya se resolvió:

- **El JWT salió de `localStorage`.** La sesión viaja en una cookie `HttpOnly` + `SameSite=Lax` que el JavaScript de la página no puede leer, así que un XSS ya no se lleva la credencial; `SameSite=Lax` es además la defensa contra CSRF. La cabecera `Authorization` sigue funcionando para scripts e integraciones, y `POST /api/auth/logout` borra la cookie del lado del servidor — antes "salir" solo olvidaba el nombre en pantalla y la sesión seguía viva.
- **Emails insensibles a mayúsculas**, con migración de los existentes (`migraciones/001-emails-en-minuscula.js`) que no fusiona las cuentas que colisionan: eso necesita una decisión humana.
- **El primer usuario que se registra ya no queda como admin**, y el seed dejó de crear `admin@estacionamiento.com / admin123` — una credencial por defecto, conocida y publicada en el repositorio. El primer administrador se crea con `node scripts/crear-admin.js`; en desarrollo, si no hay ninguno, se crea uno con contraseña aleatoria que se imprime una sola vez.
