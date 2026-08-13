# 08 — Plan de Implementación

> Documento más importante del análisis. Orden determinado por **dependencias técnicas reales** detectadas en los documentos 01-07, no por una plantilla genérica. Cada etapa indica objetivo, estado actual, qué implementar, impacto en Database/Backend/Frontend, dependencias, riesgos, reutilización y criterios de aceptación.
>
> **Nota de progreso**: las Etapas 0 a 7 están implementadas y verificadas end-to-end con requests reales — ver commits y `backend/scripts/verify-*.js` (`verify-etapa1..7`, `verify-authz`, `verify-concurrencia`, `verify-resolver`, `verify-excepcion`). La Etapa 6 además se probó contra **ARCA homologación real** el 2026-08-12 (factura B PV 1 N° 4, CAE 86320756083025; nota de crédito B PV 1 N° 1, CAE 86320756083083). Lo único pendiente del plan es el pasaje de ARCA a **producción**, que no es código: alta del punto de venta para "Factura Electrónica - Web Services", certificado de producción y `ARCA_MOCK=false` en el entorno productivo.

## Cómo se determinó el orden

1. No se puede construir Caja/Turno ni Cliente Ocasional sobre una base sin transacciones atómicas ni control de concurrencia (gaps CRÍTICOS de doc 05) — por eso la **Etapa 0** ataca eso primero.
2. Caja/Turno y Operación Manual necesitan un rol `operador` y permisos reales (hoy rotos, ver doc 01/05) — por eso la **Etapa 1** resuelve permisos y auditoría genérica antes de sumar funcionalidad nueva que dependa de ellos.
3. El Cliente Ocasional (Etapa 2) es prerrequisito de la Operación de Caja completa (Etapa 5), pero puede construirse antes de tener Caja/Turno funcionando (solo requiere desacoplar `Vehiculo` de `Usuario`).
4. Medios de Pago y el modelo de Comprobante de Estadía (Etapa 3) son prerrequisito tanto de Caja (Etapa 4, para saber qué cobrar) como de la Operación Manual (Etapa 5).
5. Caja/Turno (Etapa 4) requiere Medios de Pago (Etapa 3) para poder calcular el efectivo esperado.
6. La Operación Manual completa (Etapa 5) integra Cliente Ocasional + Caja + Medios de Pago — no puede ir antes.
7. La integración real con ARCA (Etapa 6) es la de mayor complejidad externa (certificados, WSAA/WSFE) y no bloquea el modelo de negocio "cobro sin factura fiscal" a corto plazo — se ubica después de que el núcleo operativo (caja/turno/cliente ocasional) esté sólido, aunque el modelo de datos del comprobante (Etapa 3) ya la prepara.
8. Auditoría avanzada y reconciliación (Etapa 7) cierran el plan porque dependen de que existan los eventos de negocio (movimientos, comprobantes, turnos) que hay que auditar/reconciliar.

---

## ETAPA 0 — Correcciones estructurales (bloqueante para todo lo demás) — ✅ IMPLEMENTADA

### Tarea 0.1 — Autorización por rol consistente
- **Objetivo**: cerrar los accesos indebidos detectados (cualquier `cliente` autenticado puede operar como admin en varias rutas).
- **Estado actual**: `admin.js`, `usuarios.js` (listar/editar), `facturas.js` solo validan JWT válido, sin verificar `rol==='admin'` ([01](01-ARQUITECTURA-ACTUAL.md) sección 4).
- **Implementación**: middleware `requireRole(...roles)` aplicado explícitamente a cada ruta administrativa; auditar las rutas existentes una por una.
- **Database**: sin cambios.
- **Backend**: nuevo middleware en `middlewares/`; modificar `routes/admin.js`, `usuarios.js`, `facturas.js`, `auditoria.js`.
- **Frontend**: sin cambios funcionales (ya oculta opciones por rol en UI, pero eso no es control de seguridad real).
- **Dependencias**: ninguna (puede iniciarse de inmediato).
- **Riesgos**: romper flujos actuales que dependían del bug (verificar cada ruta con tests).
- **Reutilización**: patrón ya existente y correcto en `precios.js`/`configuracionEmpresa.js` — replicar ese mismo patrón.
- **Referencia CGAS**: no aplica directamente (CGAS delega auth al Gateway), pero sirve como recordatorio de que la autorización debe validarse explícitamente por endpoint.
- **Criterios de aceptación**: un usuario `cliente` recibe 403 en todos los endpoints administrativos; tests automatizados por ruta.

### Tarea 0.2 — Unificar el flujo de ingreso/egreso (eliminar implementaciones duplicadas)
- **Objetivo**: eliminar la inconsistencia entre `estacionamientoController`, `usuarioController` y `transaccionController` (doc 02).
- **Estado actual**: 3 implementaciones parcialmente distintas del mismo proceso de negocio.
- **Implementación**: extraer un servicio único `services/estadiaService.js` (funciones `iniciarEstadia`/`finalizarEstadia`/`obtenerTarifa`); los 3 controladores pasan a delegar en él; eliminar código duplicado.
- **Database**: sin cambios de esquema en esta tarea (se prepara para la Etapa 2).
- **Backend**: refactor de los 3 controladores + rutas que los usan.
- **Frontend**: verificar qué pantallas llaman a qué endpoint y unificar a uno solo si hay endpoints redundantes.
- **Dependencias**: ninguna.
- **Riesgos**: alto si no hay tests de regresión previos (el sistema no parece tener suite de tests automatizados — agregar cobertura mínima antes del refactor).
- **Reutilización**: la lógica de `obtenerTarifa` de `estacionamientoController` es la más completa; usarla como base.
- **Referencia CGAS**: n/a (es un problema propio del Estacionamiento).
- **Criterios de aceptación**: un solo punto de entrada de negocio para ingreso/egreso; los 3 endpoints existentes producen resultados idénticos y consistentes en `Vehiculo.estActivo`/`Estacionamiento.estado`.

### Tarea 0.3 — Transacciones atómicas y concurrencia
- **Objetivo**: eliminar el riesgo de estados inconsistentes y condiciones de carrera (doble cobro/doble egreso).
- **Estado actual**: ninguna operación usa `session.startTransaction()`; no hay control de versión optimista.
- **Implementación**: envolver `iniciarEstadia`/`finalizarEstadia` en transacciones de MongoDB (requiere replica set, verificar entorno de despliegue); usar `findOneAndUpdate` con filtro de estado (`{estado:'activo'}` → `{estado:'finalizado'}`) como guarda atómica adicional contra doble egreso, incluso dentro de la transacción.
- **Database**: agregar campo de versión (`__v` de Mongoose ya existe por defecto; verificar que se use en updates críticos) a `Estacionamiento`, `Vehiculo`, `Usuario`.
- **Backend**: modificar `estadiaService.js` (de la tarea 0.2) para usar sesiones/transacciones.
- **Frontend**: manejar el nuevo código de error 409 (conflicto) en la UI.
- **Dependencias**: Tarea 0.2 (necesita el servicio unificado antes de envolverlo en transacciones).
- **Riesgos**: requiere que MongoDB esté configurado como replica set (las transacciones no funcionan en instancia standalone) — **verificar entorno de despliegue actual antes de implementar**.
- **Reutilización**: patrón conceptual de `RowVersion` + `DbUpdateConcurrencyException` de CGAS (doc 04/05) — adaptado a Mongoose.
- **Referencia CGAS**: [RepositoryBase.cs](../../../cgas-backend/CaldenCloud/Services/Tesoreria/Tesoreria.Infrastructure/Repositories/RepositoryBase.cs) (control de concurrencia optimista).
- **Criterios de aceptación**: prueba de concurrencia (2 requests simultáneos de egreso del mismo vehículo) resulta en un único descuento de saldo y una sola `Transaccion` de salida; el segundo request recibe 409.

### Tarea 0.4 — Higiene de secretos y credenciales
- **Objetivo**: eliminar secretos hardcodeados/débiles antes de cualquier despliegue comercial.
- **Estado actual**: `JWT_SECRET` trivial, credenciales SMTP en código fuente, credenciales de demo en Markdown.
- **Implementación**: mover todo a variables de entorno gestionadas de forma segura (vault/secret manager), rotar `JWT_SECRET`, eliminar `DATOS_PRODUCCION.md` del control de versiones o purgar el historial si ya fue commiteado.
- **Database/Backend/Frontend**: solo configuración, sin cambios de modelo.
- **Dependencias**: ninguna, puede hacerse en paralelo a 0.1-0.3.
- **Riesgos**: si el repositorio es público o se comparte, rotar credenciales inmediatamente.
- **Reutilización**: n/a.
- **Referencia CGAS**: certificados AFIP gestionados como archivo `.p12` protegido, no en el repo — mismo principio aplica aquí.
- **Criterios de aceptación**: `git grep` de contraseñas/secretos en el código retorna vacío; `.env` fuera del control de versiones.

---

## ETAPA 1 — Roles, permisos y auditoría genérica

### Tarea 1.1 — Rol `operador` (cajero)
- **Objetivo**: habilitar un tercer rol operativo distinto de `cliente`/`admin`.
- **Estado actual**: enum `Usuario.rol: ['cliente','admin']` (doc 01).
- **Implementación**: agregar `operador` al enum; definir matriz de permisos (doc 07, sección 7) como middleware `requireRole`.
- **Database**: modificar enum de `Usuario.rol`.
- **Backend**: nuevos middlewares de autorización por acción; actualizar rutas de caja/turno (Etapas 4-5) para usarlos desde su creación.
- **Frontend**: nueva pantalla de gestión de usuarios/operadores (alta de cajeros por admin).
- **Dependencias**: Etapa 0 (permisos deben estar corregidos primero).
- **Riesgos**: bajo.
- **Reutilización**: patrón de permisos por rol de `precios.js`.
- **Referencia CGAS**: modelo de "empleado con permiso `AutorizaCierreTurno`" ([EmpleadoEstacion](../../../cgas-backend/CaldenCloud/Services/CierreDeTurnos)) — se simplifica a rol en vez de permiso por contraseña individual, dado que el Estacionamiento ya tiene JWT por usuario.
- **Criterios de aceptación**: un usuario `operador` puede ingresar/cobrar pero no modificar tarifas ni anular.

### Tarea 1.2 — `AuditLog` genérico
- **Objetivo**: generalizar el patrón `Log*` existente (4 modelos ad-hoc) a un único modelo de auditoría reutilizable para todas las funcionalidades nuevas.
- **Estado actual**: `LogSaldo`, `LogVehiculo`, `LogPrecio`, `LogConfiguracionEmpresa` — cada uno con su propio schema (doc 01, sección 7).
- **Implementación**: modelo `AuditLog {entidad, entidadId, accion, usuarioId, fecha, ip, datosAnteriores, datosNuevos, motivo}`; middleware/helper para registrar desde cualquier controlador.
- **Database**: nueva colección `auditlogs` con índices por `entidad+entidadId` y por `fecha`.
- **Backend**: helper `auditoriaService.registrar(...)`; los 4 modelos `Log*` existentes pueden migrarse gradualmente o convivir (decisión de implementación, no bloqueante).
- **Frontend**: extender `AuditoriaLogs.jsx` para incluir los nuevos eventos (turno, caja, ingreso manual).
- **Dependencias**: ninguna técnica, pero conviene antes de la Etapa 4/5 para auditar desde el día uno.
- **Riesgos**: bajo.
- **Reutilización**: 100% del patrón ya usado en los 4 `Log*` existentes.
- **Referencia CGAS**: campos `UltimaVez`/`UltimoUsuario_Id` de `EditableEntity` (auditoría básica embebida) — CGAS tampoco tiene historial completo, así que aquí el Estacionamiento debe ir un paso más allá (gap D del doc 05).
- **Criterios de aceptación**: toda operación sensible listada en el pedido (ingreso manual, egreso, modificación de tarifa, descuento, cortesía, anulación, devolución, movimientos de caja, apertura/cierre) queda registrada con quién/cuándo/motivo.

---

## ETAPA 2 — Cliente ocasional / vehículo independiente del usuario

### Tarea 2.1 — Desacoplar `Vehiculo` de `Usuario`
- **Objetivo**: permitir vehículos sin propietario registrado.
- **Estado actual**: `Vehiculo.usuario` es `required: true` (doc 07).
- **Implementación**: cambiar a opcional; ajustar controladores que asumen que siempre existe (`agregarVehiculo`, reportes, etc.).
- **Database**: modificar schema de `Vehiculo` (campo opcional); revisar índices existentes (`{usuario:1, dominio:1}`).
- **Backend**: `vehiculoController.js` y `estadiaService.js` (Etapa 0.2) deben soportar vehículo sin dueño.
- **Frontend**: sin impacto directo (afecta al panel de caja, Etapa 5).
- **Dependencias**: Etapa 0.2 (servicio unificado).
- **Riesgos**: medio — revisar todo código que hace `vehiculo.usuario.populate()` asumiendo que existe.
- **Reutilización**: n/a.
- **Referencia CGAS**: no aplica (dominio distinto) — clasificación D del doc 05.
- **Criterios de aceptación**: se puede crear un `Vehiculo` sin `usuario` sin errores.

### Tarea 2.2 — Campo `clienteOcasional` y `origen` en la estadía
- **Objetivo**: soportar datos opcionales del conductor sin cuenta, y trazabilidad de canal.
- **Estado actual**: no existe.
- **Implementación**: sub-documento `clienteOcasional{nombre,telefono,documento}` (todos opcionales) + campo `origen: app|caja|manual|api` + `operadorId` en `Estacionamiento`/`Transaccion`.
- **Database**: nuevos campos en ambos schemas.
- **Backend**: `estadiaService.iniciarEstadia` acepta estos parámetros.
- **Frontend**: nuevo formulario simplificado (ver Etapa 5).
- **Dependencias**: Tarea 2.1.
- **Riesgos**: bajo.
- **Reutilización**: n/a.
- **Referencia CGAS**: n/a — necesidad nueva (D).
- **Criterios de aceptación**: una estadía puede crearse sin `Usuario`, solo con patente.

---

## ETAPA 3 — Medios de pago y comprobante de estadía

### Tarea 3.1 — Modelo `MedioPago` y cobro directo (no solo saldo prepago)
- **Objetivo**: permitir cobrar efectivo/tarjeta/QR en el momento del egreso, no solo débito de saldo.
- **Estado actual**: único medio de "pago" es descuento de `Usuario.montoDisponible` (doc 02).
- **Implementación**: enum/catálogo `medioPago: efectivo|tarjeta|qr_transferencia|saldo_prepago`; el egreso pasa a requerir seleccionar un medio de pago; si es `saldo_prepago`, se mantiene el comportamiento actual.
- **Database**: nuevo campo `medioPago` en `Transaccion`/nuevo modelo `MovimientoCaja` (definido completo en Etapa 4, pero el catálogo de medios de pago se define aquí porque es prerrequisito).
- **Backend**: `estadiaService.finalizarEstadia` recibe `medioPago`.
- **Frontend**: selector de medio de pago en la pantalla de egreso.
- **Dependencias**: Etapa 0 (servicio unificado + transacciones).
- **Riesgos**: medio — el egreso actual no contempla "no hay saldo suficiente pero paga en efectivo", hay que revisar la regla de rechazo por saldo insuficiente para que solo aplique si `medioPago === saldo_prepago`.
- **Reutilización**: n/a (funcionalidad nueva).
- **Referencia CGAS**: catálogo `MedioPago`/`CanalCobro` (Efectivo/Transferencia/QR/Tarjeta) de Tesorería/CierreDeTurnos — clasificación B (aplicable con adaptación, reducido).
- **Criterios de aceptación**: se puede cobrar una estadía en efectivo sin que el usuario tenga saldo prepago.

### Tarea 3.2 — Comprobante de estadía (separado de la recarga de saldo)
- **Objetivo**: generar un comprobante por cada estadía cobrada, no solo por recargas.
- **Estado actual**: `Comprobante`/`Factura` solo existen para recarga de saldo (doc 02/03).
- **Implementación**: nuevo modelo (o generalización del existente) `ComprobanteEstadia` con: número (talonario por punto de venta), tipo (ticket no fiscal / factura), datos del receptor (usuario o `clienteOcasional`), importe, medio de pago, estado (`emitido`, `pendiente_cae`, `error_arca`, `anulado`).
- **Database**: nueva colección + índice único de numeración `(puntoVenta, tipoComprobante, numero)` (mejora respecto a CGAS, que no tiene esta constraint — ver doc 05).
- **Backend**: se genera automáticamente al finalizar la estadía (dentro de la misma transacción atómica de la Etapa 0.3).
- **Frontend**: mostrar/descargar el comprobante al finalizar el cobro.
- **Dependencias**: Tareas 0.3, 3.1.
- **Riesgos**: alto si no se define bien el estado inicial ante fallo de ARCA (se resuelve completamente en Etapa 6, pero el modelo de datos debe preverlo desde ahora).
- **Reutilización**: numeración y estructura general de `Factura.js` existente, pero corrigiendo la inconsistencia de doble formato de número (doc 01, hallazgo 9).
- **Referencia CGAS**: `MovimientoFac` + `Talonario` + `MovimientoFacElectronica` ([04-CGAS-FACTURACION-REFERENCE.md](04-CGAS-FACTURACION-REFERENCE.md)) — clasificación B.
- **Criterios de aceptación**: cada egreso cobrado genera exactamente un comprobante, con numeración sin duplicados verificable por constraint de base de datos.

---

## ETAPA 4 — Caja y Turno

### Tarea 4.1 — Modelos `Caja` y `Turno` + apertura/cierre
- **Objetivo**: implementar el diseño completo de [06-CIERRE-TURNO-ESTACIONAMIENTO.md](06-CIERRE-TURNO-ESTACIONAMIENTO.md).
- **Estado actual**: inexistente.
- **Implementación**: modelos `Caja`, `Turno` (ver doc 06 sección 2); endpoints de apertura/cierre; validación anti-doble-apertura (índice parcial único `{cajaId,estado:'abierto'}`).
- **Database**: 2 colecciones nuevas + índice parcial único.
- **Backend**: `turnoService.js` (abrir, obtenerActual, cerrar); middleware que exige turno abierto para operaciones de cobro.
- **Frontend**: pantallas "Abrir turno" / "Turno actual" / "Cerrar turno" (ver Etapa 8 de UX en doc 06).
- **Dependencias**: Etapa 1 (rol operador + permisos), Etapa 3 (medios de pago, para el cálculo del cierre).
- **Riesgos**: la prevención de doble apertura debe probarse bajo concurrencia (2 requests simultáneos abriendo turno en la misma caja).
- **Reutilización**: n/a en código, sí en concepto de CGAS.
- **Referencia CGAS**: `StockCierreTurnoService.CrearCierreTurnoAsync` (flujo "Gas", con la regla anti-doble-apertura) — [CierreDeTurnos.Application/Services/Stock/StockCierreTurnoService.cs](../../../cgas-backend/CaldenCloud/Services/CierreDeTurnos/CierreDeTurnos.Application/Services/Stock/StockCierreTurnoService.cs). **No** tomar como referencia el flujo legado "Estación" de CGAS (no tiene esta validación).
- **Criterios de aceptación**: no se puede abrir un segundo turno en la misma caja mientras haya uno abierto (test de concurrencia incluido).

### Tarea 4.2 — `MovimientoCaja` (ingresos/egresos manuales + cobros automáticos)
- **Objetivo**: registrar todo movimiento de dinero del turno.
- **Estado actual**: inexistente.
- **Implementación**: modelo `MovimientoCaja` (doc 06); el cobro de una estadía (Etapa 3) genera automáticamente un `MovimientoCaja`; se agregan endpoints de alta manual de ingreso/egreso.
- **Database**: nueva colección + índices `{turnoId, tipo}`.
- **Backend**: integrar con `estadiaService.finalizarEstadia` (debe fallar si no hay turno abierto en la caja).
- **Frontend**: pantalla "Movimientos de caja" + "Ingreso/Egreso manual de dinero".
- **Dependencias**: Tarea 4.1.
- **Riesgos**: bajo, ya cubierto por transacciones de Etapa 0.
- **Reutilización**: n/a.
- **Referencia CGAS**: `MovimientoTesoreria`/`CierreDetalleOtroIngreso`/`CierreDetallePagoGasto` — clasificación B.
- **Criterios de aceptación**: el resumen de cierre calcula correctamente el efectivo esperado a partir de los `MovimientoCaja` del turno.

### Tarea 4.3 — Cálculo de cierre (esperado/declarado/diferencia)
- **Objetivo**: completar el cierre con el cálculo de diferencia de caja.
- **Implementación**: ver doc 06 sección 3; endpoint `resumen-cierre` (previsualización) + `cerrar` (persistencia final transaccional).
- **Database**: campos de `Turno` ya definidos en 4.1.
- **Backend**: agregaciones sobre `MovimientoCaja`.
- **Frontend**: pantalla de cierre con conteo de efectivo y confirmación.
- **Dependencias**: Tareas 4.1, 4.2.
- **Riesgos**: bajo.
- **Reutilización**: n/a.
- **Referencia CGAS**: `DeclararCobrosCierreTurnoCommandHandler` (cálculo `netoEsperado`/`totalDeclarado`/`DiferenciasPendientes`) — clasificación B.
- **Criterios de aceptación**: cerrar un turno sin movimientos calcula diferencia = declarado − monto inicial, sin errores (caso borde explícito del pedido).

---

## ETAPA 5 — Operación de caja sin cuenta (integración completa)

### Tarea 5.1 — Ingreso manual desde caja
- **Objetivo**: implementar `POST /api/estadias/ingreso-manual` (doc 07 sección 3).
- **Dependencias**: Etapas 2 (cliente ocasional) y 1 (rol operador).
- **Database/Backend/Frontend**: según doc 07.
- **Riesgos**: bajo, es integración de piezas ya construidas.
- **Reutilización**: `estadiaService.iniciarEstadia` (Etapa 0.2/2.2) al 100%.
- **Referencia CGAS**: n/a (clasificación D).
- **Criterios de aceptación**: un operador ingresa un vehículo solo con la patente, sin usuario, en menos de 2 acciones de UI.

### Tarea 5.2 — Egreso manual / cobro desde caja
- **Objetivo**: implementar `POST /api/estadias/:id/egreso-manual` (doc 07 sección 4).
- **Dependencias**: Etapas 3 (medios de pago + comprobante), 4 (turno abierto obligatorio).
- **Riesgos**: validar que el turno esté abierto antes de permitir el cobro (409 si no).
- **Reutilización**: `estadiaService.finalizarEstadia` al 100%.
- **Referencia CGAS**: n/a (clasificación D), aunque el registro del `MovimientoCaja` reutiliza el diseño de la Etapa 4.
- **Criterios de aceptación**: flujo completo `PATENTE → COBRAR → MEDIO DE PAGO → CONFIRMAR` operativo end-to-end, con comprobante y movimiento de caja generados atómicamente.

---

## ETAPA 6 — Integración real con ARCA

### Tarea 6.1 — Cliente WSAA/WSFE (modo mock primero)
- **Objetivo**: reemplazar la simulación actual por una integración real, comenzando en modo mock configurable.
- **Estado actual**: inexistente (doc 03).
- **Implementación**: cliente HTTP/SOAP hacia WSAA (autenticación) y WSFE (`FECAESolicitar`), con modo `mock` para desarrollo — análogo a `MockFacturacionElectronicaService` de CGAS.
- **Database**: `ComprobanteEstadia.estado` pasa a usarse activamente (`pendiente_cae`→`emitido`/`error_arca`); persistir `CAE`, `vencimientoCAE`, `observaciones`, `errores`.
- **Backend**: nuevo módulo `services/arcaService.js`; reintentos con backoff (adaptar, no copiar literal, los códigos de error reales de WSFE).
- **Frontend**: mostrar estado del comprobante (pendiente/emitido/error) en las pantallas de facturación.
- **Dependencias**: Etapa 3.2 (modelo de comprobante ya debe existir).
- **Riesgos**: **REQUIERE VALIDACIÓN FUNCIONAL/FISCAL** — obtener certificado digital real, homologación en entorno de testing de AFIP, y confirmar con un contable qué tipos de comprobante corresponde emitir para un estacionamiento (posible Factura B/C, no se debe asumir).
- **Reutilización**: conceptual únicamente (no se puede reutilizar código .NET desde Node.js).
- **Referencia CGAS**: [FacturacionElectronicaServicebase.cs](../../../cgas-backend/CaldenCloud/Services/Facturacion/Facturacion.Infrastructure/Services/FacturacionElectronicaService/FacturacionElectronicaServicebase.cs), [AfipAuthenticationService.cs](../../../cgas-backend/CaldenCloud/Services/Facturacion/Facturacion.Infrastructure/Services/AutenticacionService/AfipAuthenticationService.cs) — clasificación B.
- **Criterios de aceptación**: en modo mock, el flujo completo de cobro genera un comprobante con CAE simulado sin bloquear el cobro si ARCA no responde.

### Tarea 6.2 — Reconciliación de comprobantes faltantes
- **Objetivo**: detectar y resolver comprobantes con CAE obtenido pero no persistidos localmente (o viceversa).
- **Implementación**: job periódico que compara el rango de números autorizados en AFIP contra la base local.
- **Dependencias**: Tarea 6.1 en producción real (no mock).
- **Riesgos**: bajo, es una tarea de mantenimiento.
- **Reutilización**: conceptual.
- **Referencia CGAS**: `RecuperarFacturasFaltantesCommandHandler` — clasificación A.
- **Criterios de aceptación**: un comprobante con fallo de persistencia local pero CAE válido en AFIP se recupera automáticamente en la siguiente ejecución del job.

---

## ETAPA 7 — Auditoría avanzada y cierre del ciclo — ✅ IMPLEMENTADA

Verificación: `node scripts/verify-etapa7.js` (44/44) y `node scripts/verify-authz.js` (matriz de 3 roles × 20 endpoints + IDOR). Los dos necesitan el servidor levantado con `RATE_LIMIT_OFF=true` y los usuarios de `seed-test-users.js`.

### Tarea 7.1 — Reportes de cierre de turno y diferencias históricas — ✅
- **Objetivo**: pantallas de histórico de cierres y diferencias de caja (requisito del pedido).
- **Implementado**:
  - `GET /api/turnos` acepta `cajaId`, `operadorId`, `estado`, `desde`, `hasta`, con página y límite acotados (máximo 100 por página).
  - `GET /api/reportes/cierres` (admin) devuelve el acumulado: totales, desglose por operador y por caja. **Faltante y sobrante se suman por separado y en positivo**: un operador con −$5.000 un día y +$5.000 otro tiene neto cero y dos arqueos para revisar, y el neto solo esconde exactamente eso. Los turnos **anulados quedan fuera del acumulado** (siguen listados en la pantalla, porque hay que poder encontrarlos, pero su diferencia no es plata faltante).
  - `backend/utils/filtroTurnos.js` centraliza el filtro para que la lista y el acumulado no puedan divergir. Ahí se resuelve además que `desde`/`hasta` se interpreten en hora local: `new Date('2026-08-11')` es medianoche UTC, o sea el 10 a las 21:00 en Argentina, y el filtro perdía el día pedido.
  - Pantalla `Cierres` con filtros de caja/operador/período, tablero de faltante y sobrante acumulados, y tabla "Por operador" que al hacer clic filtra por esa persona.
  - Corregido de paso: `Caja → Cierres` estaba en el menú del operador y llevaba a dos endpoints admin-only, o sea a un 403.
- **Criterios de aceptación**: cumplidos — un admin ve el histórico de diferencias por operador, caja y período.

### Tarea 7.2 — Endurecimiento final (revisión de seguridad integral) — ✅
- **Objetivo**: revalidar toda la superficie nueva (Etapas 1-6) contra los mismos criterios de la Etapa 0.
- **Hallazgos corregidos**:
  - **El turno no tenía dueño.** Cualquier `operador` podía, cambiando el id en la URL, leer los movimientos, los contadores y el **resumen de cierre** del turno de otro —que trae justo los importes que la caja ciega le oculta a quien está por contar el cajón—, registrar movimientos en su caja y hasta cerrárselo. Ahora el operador solo opera su turno; el admin entra a todos, que es su función.
  - **Sin límite de intentos en la superficie sin token.** El login era un oráculo de contraseñas consultable sin costo y `solicitar-recuperacion` un botón para inundar de mails la casilla de cualquier cliente. Se agregó `middlewares/rateLimit.js` (ventana fija en memoria, sin dependencias nuevas): 20 intentos / 15 min para login y tokens, 5 / hora para lo que dispara correo. `RATE_LIMIT_OFF=true` lo apaga en desarrollo y en los scripts de verificación.
  - **Ids mal formados devolvían 500.** `cajaId`, `operadorId`, fechas y estados inválidos ahora responden 400; un turno o comprobante inexistente responde 404.
  - **Paginación sin techo.** `limite=999999` convertía una pantalla paginada en un volcado de la colección.
  - Secretos: verificado que `.gitignore` cubre `.env`, `backend/certs/`, `*.key`, `*.crt` y `*.p12`, y que no hay ninguno versionado.
- **Criterios de aceptación**: cumplidos — `verify-authz.js` cubre ahora las 20 rutas de la superficie nueva contra los tres roles, más IDOR y acceso sin token.

### Tarea 6.2 (cierre) — reconciliación automática — ✅
La reconciliación con ARCA existía como acción manual del panel. Un descuadre fiscal que solo se detecta cuando alguien se acuerda de apretar el botón no se detecta: ahora el worker la corre cada 6 horas (`ARCA_RECONCILIACION_INTERVALO_MS`, `0` la apaga), compartiendo cerrojo con la emisión para no pisar la numeración correlativa de ARCA. Los huérfanos se registran en el log para revisión manual, nunca se inventan datos.

---

## Nota sobre sincronización de esquemas de base de datos

A diferencia de CGAS —que mantiene **dos representaciones de esquema conviviendo** (`cgas-database/CaldenCloud/DBUp` legado + `cgas-database/CaldenGas/Database` SSDT declarativo), lo cual generó los hallazgos de inconsistencia documentados en 04/05—, el Estacionamiento usa **Mongoose sin una herramienta formal de migraciones versionadas** (los `scripts/migracion*.js` son ad-hoc, ver doc 01 sección 9). Antes de la Etapa 2 en adelante (que modifica schemas existentes), se recomienda introducir una herramienta de migraciones versionada (ej. `migrate-mongo`) para que cada cambio de schema quede documentado y sea reproducible entre entornos — evitando repetir el patrón de scripts de reparación manual encontrado en el proyecto actual.

---

## Matriz Final de Funcionalidades

Estado al cierre de la Etapa 7. La columna "Falta" es lo que queda, no lo que faltaba cuando se escribió el plan.

| Funcionalidad | Estado | Dónde vive | Falta |
|---|---|---|---|
| Ingreso / egreso de vehículo | ✅ | `estadiaService` (único punto de entrada, transaccional) | — |
| Estadía con cliente ocasional | ✅ | Etapa 2 | — |
| Tarifas | ✅ básico | Etapa previa | Franjas horarias y feriados: fuera del alcance acordado |
| Ingreso / egreso manual desde caja | ✅ | Etapa 5 | — |
| Medios de pago | ✅ | Etapa 3 | — |
| Caja, apertura y cierre de turno | ✅ | Etapa 4 | — |
| Movimientos de caja | ✅ | Etapa 4 | — |
| Comprobante de estadía | ✅ | Etapa 3 | — |
| ARCA (WSAA + WSFE) | ✅ probado en homologación real | Etapa 6 | Alta del punto de venta y certificado de **producción** (trámite, no código) |
| Reconciliación con ARCA | ✅ manual y automática | Tarea 6.2 + worker | — |
| Anulaciones (nota de crédito) | ✅ | Etapa 6 | — |
| Auditoría (`AuditLog` genérico) | ✅ | Etapa 1.2 | — |
| Permisos por rol (cliente / operador / admin) | ✅ | Etapas 0.1, 1.1 y 7.2 | — |
| Histórico de cierres y diferencias | ✅ | Etapa 7.1 | — |
| Reembolsos | ✅ vía `MovimientoCaja` (`egreso` manual con motivo) | Etapa 4.2 | Un tipo `devolucion` propio, si el negocio pide distinguirlo del resto de los egresos |
| Migraciones de esquema versionadas | ⚠️ | `scripts/migracion*.js` ad-hoc | `migrate-mongo` u otra herramienta, recomendado en la nota de arriba |
