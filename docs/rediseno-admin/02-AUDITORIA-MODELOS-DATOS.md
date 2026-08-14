# Auditoría de los modelos de datos

> Hallazgos verificados en código. Ordenados por daño que hacen hoy.
>
> **Estado:** los puntos 4, 5 y 6 están **ejecutados y verificados**. Los puntos 1, 2, 3 y 7 siguen siendo propuestas: tocan datos reales o necesitan una decisión de producto.

| # | Hallazgo | Estado |
|---|---|---|
| 1 | Vehículos duplicados en array + colección | ✅ **Eliminado** — `Usuario.vehiculos[]` ya no existe |
| 2 | Dos sistemas de comprobantes | ⏸ Congelado por la poda; retiro pendiente |
| 3 | `Transaccion` ≈ `Estacionamiento` | ⏸ Requiere medir antes de decidir |
| 4 | `tipoRegistro` escrito y nunca leído | ✅ Eliminado |
| 5 | `marca`/`modelo`/`año` obligatorios con placeholder | ✅ Opcionales, sin placeholders |
| 6 | Falta capacidad | ✅ `Sucursal.capacidad` + ocupación en la API |
| 7 | `tipoUsuario` como texto libre | ⏸ Parcial (la poda cerró lo peligroso) |

---

## 1. El catálogo de vehículos está duplicado, y hay código dedicado a reparar la desincronización

`Usuario.vehiculos[]` es un array embebido con `{dominio, tipo, marca, modelo, año}` **y además** existe la colección `Vehiculo` con los mismos campos. Los dos se mantienen a mano, en paralelo:

- `adminController` da de alta el vehículo en la colección **y** hace `usuario.vehiculos.push(...)`.
- `usuarioController.obtenerUsuario` lee de la **colección**.
- `usuarioController.recargarUsuario` lee del **array**.
- `vehiculoController` mantiene el array en cinco lugares distintos (`push`, `filter`, `findIndex`, reemplazo por índice…).

La prueba de que no funciona está en el propio código: `vehiculoController` tiene una rutina que recorre `usuario.vehiculos`, arma `vehiculosUnicos` y reescribe el array para sacar duplicados (líneas 186-253). Hay una función cuyo trabajo es limpiar la basura que genera la duplicación.

**Propuesta:** eliminar `Usuario.vehiculos[]`. La colección `Vehiculo` con su índice `{usuario, dominio}` ya responde todo lo que el array responde. Es una migración de un paso —copiar lo que esté solo en el array, después borrar el campo— y elimina de un saque una clase entera de bugs de "el vehículo aparece dos veces" / "lo borré y sigue ahí".

**Riesgo:** medio. Hay que revisar cada lectura del array (unas 12).

---

## 2. Dos sistemas de comprobantes conviviendo

| Sistema | Modelos | Numeración | Estado |
|---|---|---|---|
| Recarga de saldo | `Comprobante` + `Factura` | `ConfiguracionEmpresa.numeracion.proximoNumero`, **global y no atómica** (`Factura.js:166-172`: lee, suma, guarda) | Discontinuado en la poda |
| Estadía | `ComprobanteEstadia` + `Talonario` | por sucursal + punto de venta + tipo, con `$inc` atómico | El vigente |

El primero tiene una condición de carrera real en la numeración: dos facturas simultáneas pueden llevar el mismo número. El segundo se diseñó justamente para evitar eso, y su comentario lo dice.

**Propuesta:** con el alta de recargas ya cerrada, `Comprobante`/`Factura` quedan en modo lectura hasta que el último saldo llegue a cero, y después se retiran junto con `ConfiguracionEmpresa.numeracion`. Mientras tanto, **no** agregarles funcionalidad.

---

## 3. `Transaccion` es casi una copia de `Estacionamiento`

Cada estadía escribe: un documento `Estacionamiento`, una `Transaccion` de tipo `ingreso` y, al salir, una `Transaccion` de tipo `salida`. Las tres comparten dominio, propietario, cliente ocasional, origen, operador, sucursal, tarifa, monto y duración.

`Estacionamiento` es el estado (¿está adentro?). `Transaccion` es el historial. Pero el historial se puede derivar del estado más sus timestamps: `horaInicio`, `horaFin`, `montoTotal` y `medioPago` ya viven en `Estacionamiento`.

**Propuesta:** evaluar la eliminación de `Transaccion` en favor de `Estacionamiento` + `MovimientoCaja` (que ya es el registro contable real). Tres escrituras por estadía pasan a una.

**Riesgo:** alto — es la colección que alimenta los listados actuales. Es la decisión más grande de esta lista y no la tomaría sin medir primero qué consulta realmente cada pantalla. La dejo planteada, no recomendada todavía.

---

## 4. Campos que se escriben y nadie lee

| Campo | Dónde | Situación |
|---|---|---|
| `Estacionamiento.tipoRegistro` (`normal`/`asociado`) | `estadiaService.js:179` | Se escribe en cada ingreso. **Ninguna consulta lo lee.** Además es una copia congelada de `usuario.asociado`, que puede cambiar después: el dato queda mintiendo. |
| `Estacionamiento.porton` | — | Ya resuelto en la poda: pasó a opcional y salió de los tres flujos que lo pedían. |
| `Comprobante.vehiculos[]` | `models/Comprobante.js:12` | Lista de dominios copiada del array de `Usuario` en el momento de la recarga. Doble denormalización sobre un dato que ya estaba duplicado (ver punto 1). |

**Propuesta:** eliminar `tipoRegistro`. La condición de asociado se resuelve al calcular la tarifa, que es donde importa, y ahí sale del usuario real y no de una copia vieja.

---

## 5. `Vehiculo` exige datos que el mostrador no tiene

`marca`, `modelo` y `año` son `required: true`. Cuando entra un ocasional, `estadiaService` no tiene nada de eso y crea el vehículo con `marca: 'Sin datos'`, `modelo: 'Sin datos'`, `año: 'S/D'`.

Un `required` que se satisface con un placeholder no está validando nada: solo obliga a inventar. Y esos "Sin datos" después se muestran en pantalla.

**Propuesta:** `marca`, `modelo` y `año` opcionales. La UI muestra ausencia como ausencia, no como la cadena "Sin datos".

Aparte: `año` es `String`. Para un campo que es un año, eso hace imposible filtrar por rango o validar. Debería ser `Number` (o irse, si nadie lo consulta).

---

## 6. No existe la capacidad de la playa

Ya está anotado en la propuesta de UX y vale repetirlo acá porque es una **falta** de modelo, no un exceso: no hay `capacidad` en `Sucursal`, no hay `Sector`, no hay plazas. Sin eso, "ocupación 32/40" es indibujable y "playa completa" es indetectable.

**Propuesta:** `Sucursal.capacidad` como primer paso mínimo (un número, o un objeto `{auto, moto}`). `Sector` con capacidad propia es el paso siguiente, y es el reemplazo natural del portón si alguna vez hace falta dividir la playa de verdad.

---

## 7. `ConfiguracionPrecio.tipoUsuario` sigue siendo texto libre

La poda cerró la parte peligrosa —la lista de tipos válidos ya no tiene datos de prueba hardcodeados y la respuesta avisa que una tarifa con nombre propio no se aplica sola— pero el campo sigue siendo una cadena que hace de identificador y de nombre a la vez.

**Propuesta:** separar `codigo` (identificador, del conjunto cerrado que la cascada resuelve) de `nombre` (etiqueta libre, la que ve el operador). Es el paso previo natural a los abonos.

---

## Resumen

| # | Hallazgo | Recomendación | Riesgo |
|---|---|---|---|
| 1 | Vehículos duplicados en array + colección | **Eliminar el array** | Medio |
| 2 | Dos sistemas de comprobantes | Congelar el viejo, retirarlo después | Bajo |
| 3 | `Transaccion` ≈ `Estacionamiento` | Medir antes de decidir | Alto |
| 4 | `tipoRegistro` escrito y nunca leído | Eliminar | Bajo |
| 5 | `marca`/`modelo`/`año` obligatorios con placeholder | Hacerlos opcionales; `año` a `Number` | Bajo |
| 6 | Falta capacidad | **Agregar** `Sucursal.capacidad` | Bajo |
| 7 | `tipoUsuario` como texto libre | Separar código de nombre | Bajo |

Los puntos 1, 4, 5 y 6 ya están hechos. Quedan el 2 (esperando que los saldos lleguen a cero), el 3 (requiere medir) y el 7 (código vs. nombre de tarifa).

### Punto 1, ejecutado

- `Usuario.vehiculos[]` eliminado del modelo. El catálogo vive solo en la colección `Vehiculo`.
- `vehiculoController` reescrito: se fue el endpoint `POST /usuario/:dni/limpiar-duplicados`, que existía únicamente para reparar los duplicados que generaba la duplicación.
- Se fueron también las dos deduplicaciones en memoria ("por si acaso") de `usuarioController`: con un índice único de dominio, no puede haber repetidos.
- `agregarVehiculo` ahora **adopta** un vehículo sin dueño en vez de rechazarlo: es exactamente el caso de una patente que entró alguna vez como ocasional por caja y después su dueño se registra.
- Migración `scripts/migrar-vehiculos-embebidos.js` (`--dry-run` / `--limpiar`). Corrida: 0 vehículos huérfanos en el array, campo eliminado de 4 usuarios.
- Verificado end-to-end contra el servidor: alta sin `año` (devuelve `null`, no `"S/D"`), listado, rechazo de duplicado, baja.

### Lo ejecutado, en detalle

- **`Estacionamiento.tipoRegistro`** eliminado del modelo y del servicio.
- **`Vehiculo.marca` / `.modelo` / `.año`** y **`Transaccion.vehiculo.marca` / `.modelo`** pasaron a opcionales; `estadiaService` dejó de escribir `'Sin datos'` y `'S/D'`. `año` sigue siendo `String` por los datos históricos: pasarlo a `Number` necesita una migración aparte.
- **`Sucursal.capacidad`** (`{total, auto, moto}`, en null por defecto) y `GET /api/estadias/activas` ahora devuelve un bloque `ocupacion` con `dentro`, `dentroPorTipo`, `capacidad`, `capacidadPorTipo` y `completa`. Con capacidad en null informa el número de adentro **sin denominador**, en vez de inventar un total. Cubierto por cuatro checks en `verificaciones/verify-resolver.js`.
