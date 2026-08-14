# Lo que falta

Estado al 2026-08-14. Las Etapas 0 a 7 están implementadas y verificadas; esto es lo que queda entre "el sistema funciona" y "el sistema se usa un martes cualquiera en una playa que lo pagó".

Está ordenado por **meta**, no por dificultad, porque son tres cosas distintas y mezclarlas es lo que hace que un proyecto parezca terminado cuando no lo está.

> Cada punto dice *por qué duele*, no solo qué falta. Un pendiente sin consecuencia no es un pendiente: es una idea.

---

## 🔴 Para que funcione un día real en una playa

Sin esto, el sistema está completo y no se puede usar.

### 1. No hay impresión. Cero.

El comprobante de una estadía hoy se **descarga en PDF** o se **manda por mail**. En un mostrador, el cliente se va con un papel en la mano: nadie le manda un mail al que está saliendo con el auto.

Falta:

- Salida a **impresora térmica** (ESC/POS, 58 o 80 mm, USB o red — es el estándar del rubro).
- Un **formato de ticket** distinto del PDF A4 actual: el PDF está pensado para archivar, no para un rollo de 58 mm.
- Decidir qué pasa cuando la impresora no está: el cobro **no puede** depender de que haya papel.

**Por qué duele:** es la diferencia entre un sistema que se demuestra y uno que se usa.

### 2. El ingreso no entrega nada

No hay ticket de entrada. El vehículo entra, queda registrado, y el conductor se va sin nada.

Y es incoherente con lo que ya existe: hay un flujo completo de **egreso de excepción por "ticket perdido"** —cobro fijo, motivo obligatorio, auditoría— de un ticket que el sistema nunca emitió.

**Por qué duele:** el ticket es el comprobante de que el auto entró a esa hora. Sin papel, cualquier discusión sobre el importe es la palabra del cajero contra la del cliente.

### 3. Sin internet o sin Mongo, no se cobra

No hay modo degradado. Si se cae la conexión o la base, la Terminal no resuelve patentes, no calcula importes y no registra salidas.

Lo mínimo aceptable:

- Que la Terminal **diga qué pasa** en vez de fallar con un error técnico.
- Poder **registrar la salida** para cargarla cuando el sistema vuelva, aunque sea a mano y con motivo.

**Por qué duele:** diez minutos de caída en una playa es una fila en la salida y una barrera levantada "por las dudas". Ahí se pierde el control que justifica todo el circuito de caja.

### 4. El saldo prepago quedó sin forma de cargarse

`saldo_prepago` sigue vivo como medio de pago —la Terminal lo ofrece cuando el cliente tiene saldo— pero la recarga se **cerró** en la auditoría de seguridad, porque cualquier cliente autenticado podía acreditarse lo que quisiera sin pagar nada (ver [auditoría, hallazgo 1](auditoria-seguridad.md)).

Hoy, un cliente con $0 no puede cargar salvo que un administrador le ajuste el saldo a mano desde el panel.

**Es una decisión de producto antes que código.** Tres caminos:

| Camino | Qué implica |
|---|---|
| **El abono lo reemplaza** (ver punto 5) | Se retira `saldo_prepago` como medio de pago cuando los saldos existentes se agoten |
| **Recarga cobrada en caja** | El operador cobra en efectivo/tarjeta y acredita: queda como movimiento de caja del turno, con su comprobante. Es la versión honesta de lo que había |
| **Se deja como está** | Los saldos actuales se gastan y el medio muere solo. Hay que sacarlo de la Terminal cuando llegue a cero |

**Por qué duele:** hoy la Terminal ofrece un medio de pago que el cliente no puede alimentar. Eso es una promesa rota en la pantalla del mostrador.

---

## 🟡 Para venderlo

El sistema funciona sin esto, pero es lo que decide si alguien lo paga.

### 5. Abonos mensuales

`PRODUCT.md` los nombra como el reemplazo previsto del saldo prepago. No existen: no hay modelo, ni pantalla, ni cobro recurrente.

Es la forma en que un cliente frecuente le paga a una playa. Un sistema que solo sabe cobrar estadías sueltas deja afuera al que deja el auto todos los días, que suele ser el ingreso más estable del negocio.

Alcance mínimo: un abono es un cliente + un vehículo + un período + un importe; mientras está vigente, el egreso no cobra. Y el vencimiento tiene que ser visible en la Terminal **antes** de levantar la barrera.

### 6. Multi-sucursal a medias

Los modelos llevan `sucursalId` en todo (estadía, transacción, caja, comprobante, vehículo), pero el panel muestra `"Estacionamiento"` fijo y opera siempre contra la sucursal principal.

Para una playa sola alcanza. Para una cadena —que es donde el software se vende mejor— falta el selector de sucursal y que los reportes y el histórico de cierres filtren por ella.

La buena noticia: el modelo de datos ya está preparado, es trabajo de interfaz y de filtros.

### 7. Cortesías y descuentos

Los pide el [doc 07](analisis-gap-cgas/07-OPERACION-CAJA-SIN-USUARIO.md) y no existen. El caso real es el comercio que valida el ticket de su cliente.

Cuando se implemente, tiene que ser **auditado y con motivo**: una cortesía es plata que el turno no va a tener, y sin rastro se vuelve el agujero preferido de cualquier caja.

---

## 🟢 Para no romperlo con el tiempo

Media jornada en total. Nada de esto se nota hasta el día que se nota.

| Qué falta | Por qué duele |
|---|---|
| **Integración continua** | Las 13 verificaciones existen y las corre el que se acuerda. Un workflow que las ejecute en cada push cuesta media hora y evita que una regresión llegue al cliente |
| **Supervisor de proceso** (systemd, pm2, servicio de Windows) | Si el backend se cae a las 3 de la mañana, queda caído hasta que alguien lo note. Hoy no hay nada que lo reinicie |
| **Backup automático** | Está documentado en el [checklist de despliegue](despliegue-produccion.md), no configurado. Un backup que nadie programó no existe. Y los comprobantes fiscales no se reconstruyen: ARCA tiene el CAE, pero la estadía, el cliente y el medio de pago viven solo en esta base |
| **Alertas** | Si ARCA rechaza cincuenta comprobantes seguidos, nadie se entera hasta que alguien abra el panel de estado fiscal |
| **Logs** | `console.log` a stdout, sin niveles ni rotación. El día que haya que reconstruir qué pasó en un turno, esto es lo que va a faltar |
| **Migraciones en el arranque** | `scripts/migrar.js` existe y es idempotente, pero hay que acordarse de correrlo en cada despliegue |

---

## ⚪ ARCA — aparte, porque no depende de nosotros

El circuito está implementado y **probado contra homologación real** (factura B con CAE y su nota de crédito, 2026-08-12). Lo que falta se hace con el CUIT de quien va a facturar y no se puede adelantar: certificado de producción, alta del punto de venta para Web Services y la primera factura real.

El procedimiento completo para el día de la instalación está en [10-ARCA, "Instalación en un cliente"](analisis-gap-cgas/10-ARCA-COMO-OBTENER-EL-CERTIFICADO.md#instalación-en-un-cliente--cuando-el-sistema-se-vende).

---

## Cómo leería esto

Si hubiera que elegir un orden:

1. **Impresión de entrada y salida (1 y 2, juntos).** Es lo que desbloquea el uso real. Hasta que exista, el sistema se demuestra pero no se opera.
2. **Decidir el punto 4.** Es una definición de negocio y hoy hay una promesa rota en la pantalla del mostrador.
3. **El grupo verde.** Media jornada, y evita los disgustos que se descubren tarde.
4. **Abonos (5).** Es lo que hace que el software valga una cuota mensual y no una venta única.
5. **Multi-sucursal (6) y cortesías (7).** Cuando aparezca el cliente que los necesite.

Lo hecho hasta acá es **el sistema**. Lo que falta es sobre todo **el mostrador físico**: el papel, la impresora, y qué pasa cuando algo se cae.
