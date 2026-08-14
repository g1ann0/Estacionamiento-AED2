# 10 — Cómo obtener el certificado de ARCA, paso a paso

Guía operativa para dejar la facturación electrónica lista para probar. No hace falta saber
de criptografía: los comandos están escritos para copiar y pegar.

> **Los nombres de los menús cambian.** AFIP pasó a llamarse ARCA y el sitio se reorganizó más
> de una vez. Si un menú no se llama exactamente como dice acá, buscá el que más se le parezca:
> el circuito es el mismo desde hace años.

---

## Lo que hay que entender antes de empezar

Son **tres cosas distintas** y se confunden todo el tiempo:

| Cosa | Qué es | Quién la tiene |
|---|---|---|
| **Clave privada** (`.key`) | Con esto se firma. Es el secreto. | Se genera en tu máquina y **nunca sale de ahí**. ARCA jamás la ve. |
| **CSR** (`.csr`) | Un pedido: "soy este CUIT, emitime un certificado para esta clave". | Se sube a ARCA. |
| **Certificado** (`.crt`) | La respuesta de ARCA: "confirmo que esta clave es de este CUIT". | Lo devuelve ARCA. Es público. |

**La consecuencia que importa:** un `.crt` sin su `.key` no sirve para nada. Si la clave se
perdió, el certificado es papel mojado y hay que tramitar otro. No hay forma de recuperarla,
ni ARCA puede ayudarte: nunca la tuvo.

**Homologación y producción son dos mundos separados.** Certificados distintos, URLs distintas,
y un certificado de un ambiente **no funciona** en el otro. Siempre se empieza por homologación.

---

## Paso 1 — Generar la clave privada y el CSR

En una terminal, dentro de `backend/`:

```bash
node scripts/arca-generar-csr.js 20442422924 "CASTELPARK"
```

(El CUIT es el que ya figura en tu certificado actual.)

Deja dos archivos en `backend/certs/`:

- **`arca.key`** — la clave privada. No se comparte, no se sube, no va al repo.
- **`arca.csr`** — el pedido. Esto sí se sube a ARCA.

La carpeta `backend/certs/` está en `.gitignore`, así que nada de esto llega al repositorio.

---

## Paso 2 — Entrar a ARCA

Necesitás **clave fiscal nivel 3** (la que se saca en el banco o en una dependencia). Con
nivel 2 no alcanza para certificados digitales.

1. Entrar a **arca.gob.ar** → **Iniciar sesión** con CUIT y clave fiscal.
2. Ir a **Administrador de Relaciones de Clave Fiscal**.
3. **Adherir servicio** → buscar y adherir:
   - **Administración de Certificados Digitales**
   - **Facturación Electrónica** (o "Comprobantes en línea", según cómo aparezca)

Después de adherir un servicio hay que **cerrar sesión y volver a entrar** para que aparezca
en el menú. Es el tropiezo más común.

---

## Paso 3 — Subir el CSR y bajar el certificado

### Para HOMOLOGACIÓN (lo que corresponde ahora)

Homologación tiene su propio portal, separado del de producción:

1. Entrar a **WSASS — Autogestión de Certificados de Homologación**:
   `https://wsass-homo.afip.gob.ar/wsass/portal/main.aspx`
2. **Crear un alias**: un nombre para identificar el certificado. **Solo letras y números** —
   WSASS rechaza guiones y espacios con el mensaje "El Nombre simbólico del DN sólo puede
   contener números y/o letras". Por ejemplo `estacionamientohomo`.
3. **Adjuntar el CSR**: abrí `backend/certs/arca.csr` con el Bloc de notas, copiá **todo** el
   contenido —incluidas las líneas `-----BEGIN CERTIFICATE REQUEST-----` y
   `-----END CERTIFICATE REQUEST-----`— y pegalo donde lo pida.
4. **Descargar el certificado** que devuelve.
5. En el mismo portal, **asociar el alias al servicio `wsfe`** (Facturación Electrónica).
   Sin este paso el certificado es válido pero no tiene permiso: ARCA responde
   *"Computador no autorizado a acceder al servicio"*.

### Para PRODUCCIÓN (más adelante, cuando ya funcione en homologación)

1. **Administración de Certificados Digitales** → **Agregar alias** → subir el `.csr` →
   descargar el `.crt`.
2. **Administrador de Relaciones** → **Nueva relación** → Servicio **Facturación Electrónica**
   → como *representante*, elegir el **alias del certificado** (no una persona).

---

## Si el portal no abre

Los portales de ARCA se caen seguido, y el error que devuelven no lo dice: la conexión se
corta, y desde el navegador se parece bastante a un problema propio. Antes de pelearse con la
configuración:

```bash
node scripts/arca-estado.js
```

Consulta los seis servicios que hacen falta y hace la distinción que importa: si los **web
services** responden y solo falla un **portal web**, el problema es de ellos y no hay nada que
corregir de este lado.

> **Verificado el 11/08/2026:** WSASS —el portal donde se tramita el certificado de
> homologación— cortaba la conexión en todas sus variantes de URL (http, https, con guión y sin
> guión, y la raíz del sitio), mientras que el WSAA y el WSFE de homologación respondían 200.
> El ambiente de homologación estaba vivo; lo único caído era el portal de autogestión de
> certificados.

---

## Paso 4 — Poner el certificado en su lugar

Guardar el archivo descargado como:

```
backend/certs/arca.crt
```

Y completar `backend/.env`:

```
ARCA_AMBIENTE=homologacion
ARCA_CUIT=20442422924
ARCA_CERT_PATH=./certs/arca.crt
ARCA_KEY_PATH=./certs/arca.key
ARCA_MOCK=false
```

---

## Paso 5 — Probar

```bash
node scripts/arca-probar-login.js
```

Si sale **✅ ARCA autorizó el acceso**, el certificado, la clave, el CUIT y el ambiente están
bien, y lo que sigue es armar los comprobantes.

Si sale error, el script traduce los cuatro que aparecen casi siempre:

| Lo que dice ARCA | Qué significa |
|---|---|
| *Certificado no emitido por AC de confianza* | Certificado de un ambiente probado contra el otro. Revisá `ARCA_AMBIENTE`. |
| *Computador no autorizado a acceder al servicio* | Falta asociar el alias al servicio `wsfe` (paso 3.5). |
| *El CEE ya posee un TA válido* | **No es un error**: el certificado funciona. ARCA da un ticket cada 12 horas. |
| *ENOTFOUND / ETIMEDOUT* | Conectividad o un firewall en el medio. |

---

## Paso 6 — El punto de venta

Aparte del certificado, para emitir hace falta un **punto de venta habilitado para Web
Services**:

**Administración de Puntos de Venta y Domicilios** → alta de punto de venta → sistema
**"Factura Electrónica - Web Services"**.

Un punto de venta que no existe, o que está dado de alta para otro sistema (por ejemplo
"Comprobantes en línea"), hace fallar la emisión con un error que **no dice** que el problema
es el punto de venta. Vale la pena revisarlo antes de perder una tarde.

El número que se configure acá tiene que coincidir con el `puntoVenta` de la configuración de
empresa del sistema.

---
---

# Instalación en un cliente — cuando el sistema se vende

Todo lo de arriba se hizo con el CUIT del desarrollo, contra homologación. Esta parte es lo que
falta el día que el sistema se instala en una playa de verdad, y conviene leerla **antes** de
prometerle fechas a nadie.

## Por qué no se puede adelantar

El certificado de producción se emite **contra un CUIT**, y en producción cada CAE es una
**factura fiscal real**: queda en el historial impositivo de ese CUIT, genera IVA débito o
ingreso de monotributo, y no se borra — se anula con una nota de crédito, que es otro
comprobante fiscal.

De ahí salen las dos consecuencias que ordenan todo lo demás:

1. **El certificado y el punto de venta son del cliente, no del desarrollador.** Quien factura
   es el dueño de la playa.
2. **No existe "probar la emisión" en producción.** Cualquier factura de prueba es una factura
   de verdad. Lo que se prueba antes es todo el circuito *hasta un paso antes del CAE*; la
   emisión se estrena con la primera venta real.

Lo que sí se puede hacer sin cliente —y ya está hecho— es dejar el circuito entero probado en
homologación. Eso es lo que cierra la Etapa 6: WSAA, WSFE, factura B con CAE real de prueba y
nota de crédito asociada.

## Los dos caminos posibles

| | **A · Certificado del cliente** | **B · Delegación al desarrollador** |
|---|---|---|
| Quién tramita el certificado | El dueño, con su clave fiscal | El dueño autoriza tu certificado a operar por él |
| Qué necesitás de él | El `.crt` que descarga | Que te dé de alta como representante |
| Cuándo conviene | Instalación única, cliente con contador que lo maneja | Varias playas, o un dueño que no quiere entrar al portal |
| Dónde queda la clave privada | En el servidor de la playa (la generás vos ahí) | En tu máquina/servidor |

En los dos casos **la clave privada se genera del lado de quien va a firmar y nunca se manda por
mail ni por WhatsApp.** Lo que viaja es el CSR (público) y el certificado (público).

> La delegación se hace desde **Administrador de Relaciones de Clave Fiscal** del CUIT del
> cliente: nueva relación → Facturación Electrónica → representante. Los nombres de los menús
> cambiaron con el pase de AFIP a ARCA — **confirmá el circuito con el contador del cliente
> antes de comprometer una fecha.** Es el único paso de todo esto donde equivocarse cuesta
> tiempo de otra persona.

## Qué le pedís al dueño

Una sola lista, para mandarle tal cual:

- [ ] **CUIT** de la playa (el que va a facturar).
- [ ] **Clave fiscal nivel 3** — hace falta para tramitar certificados. Si tiene nivel 2, se
      sube en el banco o en un cajero.
- [ ] **Condición frente al IVA**: monotributo o responsable inscripto. Define qué comprobante
      se emite (C o B) y no lo decide el sistema por su cuenta.
- [ ] **Un punto de venta nuevo**, dado de alta para **"Factura Electrónica - Web Services"**.
      Nuevo y no uno que ya use: si comparte numeración con "Comprobantes en línea" o con una
      controladora fiscal, los números se pisan.
- [ ] **Razón social, domicilio comercial e inicio de actividades**, para el encabezado del
      comprobante.
- [ ] Si va por el camino B: que te **delegue el servicio** de facturación electrónica.

## Qué hacés vos

En el servidor donde va a correr el sistema (no en tu notebook, si es distinto):

```bash
# 1 · Clave privada + CSR, con el CUIT DEL CLIENTE
node scripts/arca-generar-csr.js <CUIT_DEL_CLIENTE> "NOMBRE-DE-LA-PLAYA"

# 2 · El .csr se lo pasás al dueño (o lo subís vos, si te delegó el acceso).
#     Vuelve un .crt, que va a:
#     backend/certs/arca-produccion.crt
#     La clave privada ya está en backend/certs/arca.key y NO se mueve de ahí.

# 3 · Verificar la instalación SIN emitir nada
ARCA_AMBIENTE=produccion ARCA_MOCK=false node scripts/arca-verificar-produccion.js
```

Ese último script es el que cierra la instalación. Hace tres cosas y ninguna emite:

1. Se autentica contra el WSAA de producción — prueba certificado, clave, CUIT y ambiente.
2. Le pregunta al WSFE el último número autorizado del punto de venta — **prueba que el punto
   de venta esté habilitado para Web Services**, que es el error que más tiempo hace perder
   porque ARCA no lo nombra cuando falla.
3. Lee el último comprobante emitido, si hay alguno.

Si los tres pasan, lo único sin probar es la emisión. Y esa se estrena con una venta real.

## El `.env` de esa instalación

```
ARCA_AMBIENTE=produccion
ARCA_CUIT=<CUIT del cliente>
ARCA_MOCK=false
```

El certificado y la clave se resuelven solos (`certs/arca-produccion.crt` + `certs/arca.key`).
Nada de esto está escrito en el código: **una playa nueva es un `.env` y un certificado**, no
una versión distinta del sistema. Si mañana son tres playas, son tres instalaciones, cada una
con su CUIT, su certificado y su punto de venta.

Y en el panel, antes de cobrar la primera vez: **Configuración → Empresa y facturación** con la
razón social, el CUIT, la condición de IVA y el **mismo número de punto de venta** que se dio
de alta en ARCA. Si ese número no coincide, la emisión falla con un error que tampoco lo
menciona.

## La primera factura real

No es un paso técnico, es una decisión del dueño. Lo razonable es que la primera sea **una
estadía de verdad, de importe chico**, y que alguien mire que salió bien:

- el comprobante tiene CAE y vencimiento;
- el PDF dice lo que tiene que decir (razón social, CUIT, condición, punto de venta, número);
- el número sigue al último autorizado del punto de venta.

Si algo salió mal, el camino es la **nota de crédito** —ya está implementada y probada contra
homologación—, nunca borrar el registro.

## Resumen de qué depende de quién

| Paso | Depende de |
|---|---|
| Circuito ARCA probado punta a punta | ✅ Hecho, en homologación |
| Certificado de producción | El CUIT del cliente |
| Punto de venta para Web Services | El CUIT del cliente |
| Verificación de la instalación (sin emitir) | `arca-verificar-produccion.js`, 5 minutos |
| Primera factura real | La primera venta del negocio |
