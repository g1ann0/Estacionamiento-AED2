# 03 — Auditoría de Facturación e Integración ARCA (Estado Actual del Estacionamiento)

## 1. Clasificación general

**Conclusión principal, verificada en código (no supuesta)**: el sistema de Estacionamiento **no tiene ninguna integración real con AFIP/ARCA**. Lo que existe es un conjunto de modelos de datos y reglas de negocio simuladas que *imitan* la nomenclatura fiscal argentina (CUIT, condición IVA, punto de venta, IVA 21%), pero:
- No hay ningún cliente HTTP/SOAP hacia servicios de AFIP (0 coincidencias de `wsfe`, `webservice`, `afip.gov.ar`, `CAE` real en todo el código — grep confirmado por subagente).
- No se solicita, recibe ni persiste un **CAE** real en ningún punto.
- El "certificado digital" es un booleano sin lógica de carga/uso.
- El PDF generado se titula explícitamente **"TICKET — CONSUMIDOR FINAL"**, no un comprobante fiscal válido.

## 2. Tabla de estado por elemento (según lo pedido en la Fase 2)

| Elemento | Estado | Evidencia |
|---|---|---|
| Facturación (persistencia de datos) | **Parcialmente implementado** | Modelos `Factura`/`Comprobante` existen, pero solo para *recarga de saldo*, no para la estadía. [Factura.js](../../backend/models/Factura.js), [Comprobante.js](../../backend/models/Comprobante.js) |
| ARCA (integración real) | **Inexistente** | Sin llamadas SOAP/HTTP a AFIP en todo el repositorio |
| CAE | **Inexistente** | Campo no existe en `Factura`; solo configuración `arca.cae.solicitudAutomatica`/`validezDias` nunca usada |
| Puntos de venta | **Parcialmente implementado** | `ConfiguracionEmpresa.puntoVenta` (string de 5 dígitos), un único punto de venta global, no por sucursal/caja |
| Numeración | **Implementado pero con inconsistencias** | `Factura.generarNumeroFactura()` incrementa `ConfiguracionEmpresa.numeracion.proximoNumero`; pero `Comprobante` usa dos formatos de número distintos según el endpoint (`uuidv4().slice(0,8)` vs `'COMP-' + Date.now()`) — [comprobanteController.js](../../backend/controllers/comprobanteController.js) vs [usuarioController.js](../../backend/controllers/usuarioController.js) |
| Tipos de comprobante | **Parcialmente implementado** | Enum `['ticket','factura_b','factura_c']` en `Factura.tipoComprobante`, sin `factura_a`, sin notas de crédito/débito |
| Datos del emisor | **Implementado (parcial)** | `ConfiguracionEmpresa` (razón social, CUIT validado con regex, domicilio, condición IVA) — pero `Factura.emisor` tiene **valores hardcodeados por default** (`'ESTACIONAMIENTO AE2'`, CUIT ficticio) en el propio schema, no siempre lee la configuración real |
| Datos del receptor | **Implementado (parcial)** | `Factura.cliente{dni,nombre,apellido,email,condicionIva}`, default `'Consumidor Final'` |
| Condición frente al IVA | **Parcialmente implementado** | Enum de 7 valores en `ConfiguracionEmpresa.condicionIva`; en `Factura.cliente.condicionIva` solo se usa para decidir si discrimina IVA o no (no hay catálogo AFIP de condiciones de receptor) |
| Consumidor final | **Implementado (básico)** | Default de `cliente.condicionIva` |
| Identificación del cliente | Implementado | DNI obligatorio (no CUIT/CUIL, no soporta receptores con otro tipo de documento) |
| Impuestos (IVA) | **Implementado (simplificado)** | `iva.porcentaje` fijo 21%, sin discriminación por alícuota múltiple, sin otros impuestos (IIBB, impuestos internos) |
| Totales | Implementado | `calcularTotales()` en [Factura.js](../../backend/models/Factura.js) |
| Redondeos | **No contemplado explícitamente** | No hay lógica de redondeo documentada más allá de aritmética JS estándar (riesgo de errores de punto flotante en dinero, no usa tipo `Decimal128` de Mongo) |
| Fechas | Implementado | `fechaEmision` |
| Estados | **Parcialmente implementado** | `Factura.estado: ['emitida','anulada']` — sin estados intermedios (pendiente de CAE, error, reintentando) |
| Reintentos | **Inexistente** | No aplica: no hay integración externa que reintentar |
| Errores | **No contemplado** | No hay manejo de errores de un servicio externo (porque no existe la integración) |
| Anulación | **Implementado (regla de negocio simulada)** | Límite de 15 días hardcodeado en [facturaController.js](../../backend/controllers/facturaController.js), presentado como "regla ARCA" pero es una constante en código, no una consulta real a normativa ni a un servicio |
| Notas de crédito/débito | **Inexistente** | No hay modelo ni lógica |
| Persistencia de respuestas de ARCA | **No aplica (no existe integración)** | — |
| Auditoría de facturación | **Parcialmente implementado** | `LogConfiguracionEmpresa` audita cambios de configuración fiscal de la empresa, pero no hay auditoría de emisión/anulación de cada factura individual más allá de `generadaPor` |

## 3. Riesgos identificados

1. **Riesgo legal/comercial**: si el sistema se comercializa como si emitiera "facturas" reales (tal como sugiere el nombre del modelo y el enum `factura_b`/`factura_c`), un cliente podría asumir que cumple con obligaciones fiscales de AFIP/ARCA cuando en realidad emite un PDF sin validez fiscal. **Esto debe marcarse explícitamente en cualquier documentación comercial.**
2. **REQUIERE VALIDACIÓN FUNCIONAL/FISCAL**: la regla de "15 días para anular" no tiene fuente normativa verificable en el código ni en documentación adjunta — no se debe asumir que es la regla vigente de ARCA sin confirmarla con un contador/fuente oficial antes de reutilizarla.
3. **Bug funcional detectado durante la auditoría** (no relacionado a ARCA pero sí a integridad de saldo): `comprobanteController.crearComprobante` tiene un bug de precedencia de operadores: `usuario.montoDisponible || 0 + montoAcreditado` se evalúa como `usuario.montoDisponible || (0 + montoAcreditado)` — si el usuario ya tenía saldo, el monto acreditado se descarta completamente en ese campo. Debe corregirse independientemente de las mejoras de facturación.
4. **Endpoint de creación de comprobante sin validar identidad del solicitante**: cualquier usuario autenticado puede crear un comprobante a nombre de otro DNI arbitrario ([comprobanteController.js](../../backend/controllers/comprobanteController.js)).

## 4. Qué necesita el Estacionamiento para tener una facturación sólida con ARCA (resumen, desarrollado en 04/05/08)

Ver [04-CGAS-FACTURACION-REFERENCE.md](04-CGAS-FACTURACION-REFERENCE.md) para el flujo de referencia de CGAS y [05-GAP-ANALYSIS-CGAS-ESTACIONAMIENTO.md](05-GAP-ANALYSIS-CGAS-ESTACIONAMIENTO.md) para la matriz de gaps. En síntesis, faltan (todo **PENDIENTE DE DEFINICIÓN** en cuanto a alcance fiscal exacto, a validar con un contable antes de implementar):
- Modelo de comprobante ligado a la **estadía** (no solo a la recarga de saldo).
- Integración real con WSAA/WSFE de AFIP (autenticación, solicitud de CAE, manejo de errores/reintentos).
- Talonario/numeración por punto de venta con protección de concurrencia.
- Catálogo real de tipos de comprobante (A/B/C, tickets no fiscales) y condición IVA del receptor conforme al padrón de AFIP.
- Persistencia de la respuesta de AFIP (CAE, vencimiento, observaciones/errores) de forma auditable.
- Mecanismo de reconciliación ante fallos parciales (CAE obtenido pero error de persistencia local), análogo a `RecuperarFacturasFaltantes` de CGAS.
