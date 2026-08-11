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
2. **Crear un alias** (un nombre para identificar este certificado; por ejemplo
   `estacionamiento-homo`).
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
