# 02 — Flujo Actual de una Estadía (Ingreso → Estadía → Pago → Egreso → Facturación)

## 0. Advertencia importante: tres implementaciones paralelas del mismo flujo

El repositorio contiene **tres rutas de código distintas** que implementan (con diferencias) el mismo proceso de negocio "ingreso/egreso de vehículo":

| Implementación | Archivo | Usa `Estacionamiento`? | Usa `Vehiculo.estActivo`? | Tarifa |
|---|---|---|---|---|
| **estacionamientoController** (la "oficial", usada por `/api/estacionamiento`) | [estacionamientoController.js](../../backend/controllers/estacionamientoController.js) | Sí | Sí | `obtenerTarifa()` (prioridad tarifa asignada → config por tipo → fallback 250/500) |
| `usuarioController.registrarIngreso/finalizarEstacionamiento` | [usuarioController.js](../../backend/controllers/usuarioController.js) | Sí | Sí | **Tarifas hardcodeadas 500/250**, no usa `obtenerTarifa()` |
| `transaccionController.crearTransaccionIngreso/registrarSalida` | [transaccionController.js](../../backend/controllers/transaccionController.js) | **No** (solo crea `Transaccion`) | **No** | — |

**Riesgo de integridad**: según qué endpoint invoque el frontend en cada pantalla, el estado de `Vehiculo.estActivo` y de `Estacionamiento` puede quedar inconsistente entre sí. Este es un hallazgo CRÍTICO a resolver antes de construir caja/turno (ver Etapa 0 en [08-PLAN-IMPLEMENTACION.md](08-PLAN-IMPLEMENTACION.md)): **debe unificarse en un único servicio de dominio** antes de agregar el canal "Caja" (Fase 6 del pedido), para no terminar con una cuarta implementación paralela.

El resto de este documento describe el flujo "oficial" (`estacionamientoController`).

## 1. Ingreso del vehículo

**Endpoint**: `POST /api/estacionamiento/iniciar` → [estacionamiento.js](../../backend/routes/estacionamiento.js) → `iniciarEstacionamiento` ([estacionamientoController.js](../../backend/controllers/estacionamientoController.js)).

| Paso | Detalle |
|---|---|
| Identificación del vehículo | `Vehiculo.findOne({dominio})` — **el vehículo debe existir previamente**, dado de alta por un `Usuario` |
| Identificación del usuario | `Usuario.findOne({dni, activo:true})`, populate de `tarifaAsignada` |
| Validaciones | Usuario activo; `montoDisponible > 0` (**no** valida que alcance para al menos 1 hora, solo que sea positivo); vehículo existente; `vehiculo.estActivo === false` (evita doble ingreso) |
| Creación de estadía | `new Estacionamiento({usuarioDNI, vehiculoDominio, tipoRegistro, horaInicio, porton})` — campos sueltos, no `ObjectId` |
| Efectos secundarios | `vehiculo.estActivo = true`, `vehiculo.ultimoIngreso = now`, crea `Transaccion` tipo `ingreso` con `montoTotal: 0` |
| Entidades participantes | `Usuario`, `Vehiculo`, `Estacionamiento`, `ConfiguracionPrecio` (indirecta vía `obtenerTarifa`), `Transaccion` |

**Faltantes / casos borde no contemplados**:
- No hay control de **capacidad máxima** (playa llena) — no existe entidad "Sucursal/Playa" con cupo.
- No valida el enum de `porton` antes de guardar (falla recién en `.save()` si es inválido).
- No hay **atomicidad**: `vehiculo.save()` y `nuevoEstacionamiento.save()` son dos operaciones independientes; un fallo entre medio deja datos inconsistentes.
- No contempla el **cliente ocasional** (sin cuenta) — ver [07-OPERACION-CAJA-SIN-USUARIO.md](07-OPERACION-CAJA-SIN-USUARIO.md).

## 2. Cálculo del tiempo y del importe (tarifa)

Función `obtenerTarifa(usuario)` ([estacionamientoController.js](../../backend/controllers/estacionamientoController.js)):
1. Si `usuario.tarifaAsignada` existe y está `activo` → usa esa `ConfiguracionPrecio.precioPorHora`.
2. Si no, busca `ConfiguracionPrecio` por `tipoUsuario` (`asociado`/`no_asociado`).
3. Si no hay configuración, usa **fallback hardcodeado** `250` (asociado) / `500` (no asociado).

Cálculo de duración en `finalizarEstacionamiento`: `duracionHorasReal = (horaFin - horaInicio) / 3_600_000`; `duracionHoras = Math.ceil(duracionHorasReal)` (redondeo hacia arriba, **mínimo 1 hora facturada aunque hayan sido segundos**). `montoTotal = duracionHoras * tarifa`.

**Faltantes**:
- No hay tarifas por franja horaria, día de semana, feriado, ni tope diario/mensual.
- No hay tarifas diferenciadas por tipo de vehículo más allá de `auto`/`moto` a nivel de modelo (el cálculo de tarifa no usa `vehiculo.tipo`).
- No hay concepto de tarifa por sucursal (solo existe un "estacionamiento" global implícito, no hay entidad `Sucursal`).

## 3. Egreso del vehículo

**Endpoint**: `POST /api/estacionamiento/finalizar` → `finalizarEstacionamiento` ([estacionamientoController.js](../../backend/controllers/estacionamientoController.js)).

| Paso | Detalle |
|---|---|
| Búsqueda de estadía activa | `Estacionamiento.findOne({vehiculoDominio, estado:'activo'})` |
| Cálculo | Duración + tarifa (sección 2) |
| Validación de saldo | `usuario.montoDisponible < montoTotal` → rechaza si no alcanza (no hay pago parcial ni pago en efectivo en el momento) |
| Cobro | Descuento directo de `usuario.montoDisponible` (**no** hay entidad "Pago" ni "medio de pago" — es débito de saldo prepago) |
| Cierre de estadía | `estacionamiento.estado = 'finalizado'`, `vehiculo.estActivo = false` |
| Transacción | Actualiza la `Transaccion` de ingreso a `finalizado` y crea una nueva `Transaccion` tipo `salida` |
| Comprobante/Factura | **No se genera ningún comprobante ni factura en este flujo.** La Factura/Comprobante del sistema está ligada exclusivamente a la **recarga de saldo**, no al egreso del vehículo (ver sección 4). |

**Faltantes / casos borde no contemplados** (confirmados por ausencia de código, no supuestos):
- **Condición de carrera real**: lectura + mutación + `.save()` sin `findOneAndUpdate` atómico ni control de versión. Dos requests concurrentes de egreso para el mismo vehículo pueden ambas leer `estado:'activo'` antes de que la primera persista el cambio → doble descuento de saldo y doble `Transaccion` de salida.
- **Sin idempotencia**: un reintento de red desde el frontend puede duplicar el egreso.
- **Sin transacción atómica de MongoDB** entre las 4 escrituras (`usuario`, `estacionamiento`, `vehiculo`, `transaccion`).
- **Sin comprobante fiscal del cobro de estadía**: el egreso no genera ticket/factura — esto es una brecha crítica frente a un producto comercial (ver [03-AUDITORIA-FACTURACION-ARCA.md](03-AUDITORIA-FACTURACION-ARCA.md)).
- **Sin medios de pago**: todo cobro es débito de saldo virtual prepago; no hay soporte para cobrar en efectivo/tarjeta/QR en el momento del egreso (necesario para el cliente ocasional, Fase 6).
- **Vehículo estacionado al momento de un cierre de turno/caja**: no aplica hoy porque no existe turno/caja (sección 5 de [03-AUDITORIA-FACTURACION-ARCA.md](03-AUDITORIA-FACTURACION-ARCA.md)).

## 4. Cobro → Comprobante → Factura → ARCA (flujo real encontrado, distinto al ideal)

El único flujo de "cobro + comprobante + factura" que existe **no está atado a la estadía**, sino a la **recarga de saldo prepago**:

1. Cliente solicita recarga → `comprobanteController.crearComprobante` crea `Comprobante` en estado `pendiente` (número `'COMP-' + Date.now()`).
2. Un admin **aprueba** el comprobante (`adminController`/`comprobanteController` — `validarComprobante`) → acredita `montoDisponible` del usuario.
3. Al aprobar, se dispara `generarFacturaPorComprobante` ([facturaController.js](../../backend/controllers/facturaController.js)) que crea una `Factura` (numeración vía `ConfiguracionEmpresa.numeracion.proximoNumero`) y un PDF titulado **"TICKET — CONSUMIDOR FINAL"**.
4. **No hay integración real con ARCA/AFIP** en ningún punto de este flujo — ver detalle completo en [03-AUDITORIA-FACTURACION-ARCA.md](03-AUDITORIA-FACTURACION-ARCA.md).

Es decir: **hoy no existe un flujo de facturación por estadía** (el caso de uso "cobrar el estacionamiento y facturarlo" descrito en el pedido del usuario). Lo que existe es "facturar la recarga de saldo", un concepto de negocio distinto.

## 5. Cierre contable/caja

**No existe.** No hay ningún concepto de turno o caja en el código (modelos, controladores, ni rutas). Detalle exhaustivo en [03-AUDITORIA-FACTURACION-ARCA.md](03-AUDITORIA-FACTURACION-ARCA.md) sección 5 y en el diseño propuesto en [06-CIERRE-TURNO-ESTACIONAMIENTO.md](06-CIERRE-TURNO-ESTACIONAMIENTO.md).

## 6. Resumen de brechas del flujo end-to-end

| Paso del flujo ideal (pedido del usuario) | Existe hoy? | Gap principal |
|---|---|---|
| Ingreso → identificación vehículo/usuario → estadía | Sí (parcial, con 3 implementaciones) | Unificar en un servicio único; falta cliente ocasional |
| Cálculo de tiempo/importe | Sí (básico) | Sin franjas horarias/feriados/tarifas por sucursal |
| Egreso | Sí | Sin atomicidad ni concurrencia segura |
| Cobro | Solo contra saldo prepago | Sin medios de pago (efectivo/tarjeta/QR) en el momento del egreso |
| Generación de comprobante por la estadía | **No existe** | Falta modelo "comprobante de estadía" (hoy Comprobante/Factura son de recarga de saldo) |
| Facturación | Solo para recarga de saldo | Falta facturar el servicio de estacionamiento en sí |
| ARCA | **No existe integración real** | Todo es simulado/placeholder |
| Cierre contable/caja | **No existe** | Diseño completo requerido — ver documento 06 |
