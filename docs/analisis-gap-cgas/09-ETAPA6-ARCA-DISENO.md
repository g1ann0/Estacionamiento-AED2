# 09 — Etapa 6: integración real con ARCA

> **Estado:** implementada y verificada contra el mock (73 verificaciones en
> `verify-etapa6.js`). El WSAA está probado contra ARCA real. Falta el certificado de
> homologación —el portal WSASS estaba caído— y con él la prueba de emisión punta a punta.

Diseño de la facturación electrónica del Estacionamiento, tomando como base la
implementación de CGAS, que está en producción facturando en toda la Argentina.

La referencia detallada de CGAS está en [04-CGAS-FACTURACION-REFERENCE.md](04-CGAS-FACTURACION-REFERENCE.md).
Este documento decide **qué se copia, qué se corrige y qué se hace distinto**, y por qué.

---

## 1. Lo que se copia de CGAS

Son decisiones ya validadas contra ARCA real, con años de operación encima. No se
rediseñan.

### 1.1 WSAA — autenticación por ticket firmado

El circuito es fijo y lo impone ARCA:

1. Armar el **TRA** (Ticket de Requerimiento de Acceso), un XML con `uniqueId`,
   `generationTime`, `expirationTime` y `service`.
2. **Firmarlo como CMS/PKCS#7** con el certificado X.509 (.p12) de la empresa.
3. Enviar el CMS en base64 a `loginCms` del WSAA.
4. Recibir `token` + `sign`, que valen para todas las llamadas al WSFE.

Detalles que CGAS aprendió y conviene copiar tal cual:

- `generationTime` se firma con **10 minutos de margen hacia atrás** y
  `expirationTime` con 10 hacia adelante. Es tolerancia al desfasaje de reloj
  contra los servidores de ARCA: sin ese margen, un reloj adelantado hace fallar
  la autenticación con un error que no dice nada útil.
- La hora es **hora de Argentina**, no UTC ni la del servidor.
- El ticket se **cachea**: dura 12 horas y pedir uno nuevo por cada comprobante es
  una forma rápida de que ARCA rechace por exceso de solicitudes.

### 1.2 WSFE — el número lo pone ARCA, no nosotros

**Esto es lo más importante del documento.**

Antes de emitir, CGAS llama a `FECompUltimoAutorizado(puntoVenta, tipoCbte)` y usa
**ese número + 1**. El talonario local no decide el número fiscal: lo decide ARCA.

Consecuencia directa para nuestro modelo: hoy `Talonario.proximoNumero` con
`findOneAndUpdate + $inc` es la fuente de verdad del número del ticket no fiscal. Para
comprobantes fiscales **deja de serlo**. Los dos mecanismos tienen que convivir:

| Tipo | Numeración |
|---|---|
| `ticket` (no fiscal, lo de hoy) | Talonario local, atómico |
| `factura_b` / `factura_c` (fiscal) | `FECompUltimoAutorizado + 1`, de ARCA |

### 1.3 La estructura del pedido de CAE

`FECAESolicitar` con cabecera (`CantReg`, `PtoVta`, `CbteTipo`) y detalle:
`Concepto`, `DocTipo`, `DocNro`, `CbteDesde`, `CbteHasta`, `CbteFch`, `ImpTotal`,
`ImpTotConc`, `ImpNeto`, `ImpOpEx`, `ImpIVA`, `ImpTrib`, `MonId`, `MonCotiz`,
`Iva[]`, `Tributos[]`, `CondicionIVAReceptorId`.

Todos los importes **redondeados a 2 decimales antes de enviarlos**. ARCA valida que
la suma de los renglones dé exactamente el total, y un float sin redondear rompe esa
igualdad por centésimas.

### 1.4 Reintentos diferenciados por tipo de error

CGAS no reintenta "si falla": distingue el error de ARCA y reacciona distinto.

| Error | Qué es | Estrategia de CGAS |
|---|---|---|
| **10016** | Correlatividad: el número que mandaste no es el que ARCA espera | Hasta 10 reintentos, backoff exponencial con jitter, **re-consultando el último número autorizado en cada intento** |
| **502** | Error interno de la base de ARCA | Hasta 5 reintentos |
| SSL / conectividad SOAP | La red o el TLS | 3 reintentos, backoff lineal |

El detalle que importa del 10016: no alcanza con esperar y reintentar con el mismo
número. Hay que **volver a preguntar cuál es el último**, porque el motivo probable
es que otro proceso facturó mientras tanto.

El jitter existe para que dos cajas que fallan al mismo tiempo no reintenten al
mismo tiempo.

### 1.5 Si no hay CAE, no se persiste nada

CGAS no guarda comprobantes a medias: sin CAE, `ConflictException` y nada se escribe.
Un comprobante sin CAE en la base es un comprobante que alguien va a tomar por
válido.

### 1.6 Modo mock

`UseMock=true` por configuración, con un servicio que devuelve un CAE falso. Sirve
para desarrollo y demo sin certificado.

**Con una condición que ya está fijada en PRODUCT.md:** el objetivo es ARCA real, sin
modo mock permanente. El mock es andamio de desarrollo y la interfaz **nunca** debe
mostrar un CAE de mock como si fuera fiscal.

### 1.7 Reconciliación

`RecuperarFacturasFaltantes`: consulta a ARCA un rango de comprobantes ya autorizados
y reconstruye los que no quedaron guardados localmente.

Cubre el caso más feo de todos: **ARCA otorgó el CAE y la persistencia local falló**.
Sin esto, el comprobante existe para ARCA y no existe para nosotros — y la
correlatividad queda rota para siempre.

---

## 2. Lo que NO se copia de CGAS

El propio relevamiento de CGAS marca cuatro debilidades. En tres, el Estacionamiento
ya está mejor y hay que **no perder** esa ventaja al portar el resto.

| Debilidad de CGAS | Cómo está el Estacionamiento |
|---|---|
| Sin máquina de estados formal del comprobante (se infiere de flags + presencia de CAE) | `ComprobanteEstadia.estado` ya es un enum explícito: `emitido`, `pendiente_cae`, `error_arca`, `anulado`. **Se mantiene y se usa activamente.** |
| Sin `idempotency-key` en la emisión: un doble clic puede generar dos CAE | **Se agrega.** Ver sección 4. |
| Numeración con control de concurrencia desactivado y sin constraint única en la base | Nuestro `Talonario` ya usa `findOneAndUpdate + $inc` atómico, y `ComprobanteEstadia` tiene índice único sobre `(puntoVenta, tipoComprobante, numero)`. **Se mantiene.** |
| Sin auditoría campo a campo | Ya existe `AuditLog` genérico. Cada emisión, error y anulación se registra. |

---

## 3. La decisión de arquitectura de esta etapa

**CGAS emite de forma síncrona.** El comprobante se pide a ARCA dentro del mismo
request que lo crea, y si no hay CAE, la operación entera falla.

Eso funciona en CGAS porque se factura desde una oficina. **Acá se factura en la
salida de una playa, con el auto esperando y el cliente adelante.**

Si copiamos el modelo síncrono tal cual, ARCA pasa a ser parte del camino crítico del
cobro: con ARCA caído o lento, el operador no puede cobrar ni levantar la barrera.

Las dos salidas están en la sección 5. Es una decisión de negocio, no de
implementación, y no se toma sola.

---

## 4. Idempotencia — lo que CGAS no tiene

Un doble clic en "Cobrar" hoy genera dos estadías cerradas; con facturación
electrónica generaría **dos CAE**, y un CAE emitido no se borra: se anula con una nota
de crédito.

Diseño: la clave de idempotencia es la **estadía**. Una estadía tiene a lo sumo un
comprobante fiscal. `ComprobanteEstadia` ya tiene índice sobre `estadiaId`; se
convierte en único para los comprobantes fiscales, y la emisión consulta primero si
ya existe uno antes de llamar a ARCA.

---

## 5. Dependencias técnicas en Node

CGAS es .NET y usa WCF/SOAP con soporte nativo. En Node hace falta resolver dos cosas
que allá venían de fábrica:

1. **Firma CMS/PKCS#7 del TRA.** No está en la biblioteca estándar. `node-forge`
   cubre PKCS#7 y la lectura del `.p12`.
2. **Cliente SOAP para WSAA y WSFE.** El paquete `soap` de npm consume los WSDL de
   ARCA directamente.

Ninguna de las dos está instalada hoy en el backend.

---

## 6. Lo que hace falta antes de escribir la primera línea

- **Certificado y CUIT.** ARCA emite el certificado desde la clave fiscal de la
  empresa, con un alias y un CUIT asociados. Sin eso no hay homologación posible.
- **Elegir el ambiente:** ARCA tiene homologación (testing) y producción, con URLs y
  certificados distintos. Se empieza por homologación, siempre.
- **Punto de venta habilitado** para factura electrónica en el ambiente elegido. Un
  punto de venta no habilitado devuelve un error que no lo dice claramente.
