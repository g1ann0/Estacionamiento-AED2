# Cómo se calcula lo que se cobra

Hasta acá la tarifa era una multiplicación: horas hacia arriba por precio por hora. Auto y moto pagaban lo mismo, la noche costaba igual que el mediodía y un auto olvidado un fin de semana largo acumulaba un importe que nadie iba a pagar.

Esto documenta las reglas que ahora existen. **Todas nacen apagadas**: una playa que no configura nada sigue cobrando exactamente como antes — hora entera hacia arriba, precio único, sin recargos ni tope. Ningún número de este documento es un precio sugerido; los ejemplos usan valores redondos para que la cuenta se vea.

Motor: [`backend/services/tarifaEngine.js`](../backend/services/tarifaEngine.js) · Verificación: `node scripts/verificaciones/verify-tarifas.js` (23 casos).

---

## Cómo se elige la tarifa

Al cobrar, el sistema busca en este orden y se queda con la primera que encuentra:

1. **Tarifa asignada al cliente** — la que un admin le puso a esa persona.
2. **Tarifa del tipo de cliente + tipo de vehículo** — por ejemplo "asociado / moto".
3. **Tarifa del tipo de cliente** — la general, que aplica a todos los vehículos.
4. **Valor por defecto** — solo si no hay ninguna configurada.

El escalón 2 es nuevo. Antes la tarifa se resolvía únicamente por condición de cliente, así que una moto pagaba lo mismo que una camioneta. Cargar una tarifa de moto no obliga a tocar nada más: si no existe, se sigue usando la general.

## Fracción de cobro

Cuánto dura la unidad mínima que se cobra. Por defecto **60 minutos** (la regla histórica); se puede poner en 30 o 15.

Siempre redondea hacia arriba, y la pantalla de cobro lo dice explícito para que el cajero pueda defender el importe:

| Estadía | Fracción 60 | Fracción 30 | Fracción 15 |
|---|---|---|---|
| 2 h 12 m | 3 h | 2 h 30 m | 2 h 15 m |
| 1 minuto | 1 h | 30 m | 15 m |

## Recargos

Tres, cada uno con su porcentaje:

- **Nocturno**, con franja horaria configurable (por defecto 22:00 → 06:00). La franja puede cruzar la medianoche.
- **Fin de semana**: sábado y domingo.
- **Feriado**: los días cargados en *Configuración → Feriados*.

Dos reglas que definen todo el comportamiento:

**Se cobra bloque por bloque.** Una estadía que entra a las 21:00 y sale a las 23:00, con recargo nocturno del 50% desde las 22:00, paga una hora normal y una recargada — no dos de un solo tipo. Mirar solo la hora de entrada sería más fácil de programar y más difícil de explicarle al cliente.

**Se aplica un solo recargo: el mayor.** Un feriado a la madrugada es un momento caro una vez, no dos. Sumar porcentajes produce importes que el cajero no puede justificar frente al mostrador.

> Los feriados se cargan a mano y no se importan de ningún calendario: el que importa no es solo el nacional. Un feriado provincial, una fiesta local o el día del evento que llena la playa cambian la tarifa igual, y una lista automática que dice lo contrario que la realidad es peor que no tener lista.

## Tope diario

Máximo por cada **24 horas contadas desde el ingreso** (no por día de calendario: el cliente entiende "un día" como 24 horas desde que dejó el auto).

Con tope de $6.000 y tarifa de $1.000/h, una estadía de 10 horas paga $6.000; una de dos días, $12.000. La respuesta del cobro incluye `topeAplicado: true` para que la pantalla lo pueda decir en vez de mostrar un número más chico sin explicación.

Existe para el caso concreto del auto olvidado el fin de semana largo: sin tope, el importe se vuelve impagable y termina en una negociación de mostrador, que es exactamente lo que el sistema debería evitar.

## Dónde se configura

- **Tarifas → Tarifas**: precio, a qué vehículos se aplica, fracción, tope y los tres recargos.
- **Configuración → Feriados**: qué días son feriado. El porcentaje vive en la tarifa, la lista acá — así se puede cargar el calendario del año sin decidir todavía cuánto se cobra, y cambiar el porcentaje una vez sin tocar los quince días.

Todo cambio de tarifa queda en el historial con el valor anterior, quién lo hizo y el motivo.

## Migración

El modelo anterior tenía un índice único por `tipoUsuario`, que impedía que convivieran "asociado / auto" y "asociado / moto". Sacarlo del schema no lo borra de la base —Mongoose crea índices, nunca los elimina—, así que hay una migración que lo da de baja y completa el campo nuevo en las tarifas existentes:

```bash
node scripts/migrar.js            # muestra pendientes
node scripts/migrar.js aplicar    # las corre
```

Sin ella, crear una tarifa por tipo de vehículo falla con un error de clave duplicada.
