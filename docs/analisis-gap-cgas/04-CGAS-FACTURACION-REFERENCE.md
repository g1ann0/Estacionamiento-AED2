# 04 — CGAS: Referencia de Arquitectura y Flujo de Facturación

> Fuente: microservicio `Facturacion` de CGAS (.NET, Clean Architecture) en `cgas-backend/CaldenCloud/Services/Facturacion/` y scripts de esquema en `cgas-database/CaldenCloud/DBUp/Scripts/`. Este documento describe **cómo CGAS resuelve el problema**, no prescribe copiarlo — la clasificación A/B/C/D de aplicabilidad al Estacionamiento está en [05-GAP-ANALYSIS-CGAS-ESTACIONAMIENTO.md](05-GAP-ANALYSIS-CGAS-ESTACIONAMIENTO.md).

## 1. Mapa de capas

| Capa | Contenido |
|---|---|
| `Facturacion.Domain` | Entidades (patrón *partial* + `Entities/Generated/*.generated.cs`), `Enums/TypeImpuestoReal.cs`, DTOs de integración AFIP en `Model/` (`CAECabRequest`, `CAEResponse`, etc.) |
| `Facturacion.Application` | CQRS con MediatR: `Features/MovimientosFac/Commands|Queries` (núcleo), `Consumers/` (RabbitMQ background services), `Behaviours/` (pipeline de validación), `Services/AfipTicketCacheService.cs` |
| `Facturacion.Infrastructure` | `Connected Services/` (proxies WCF/SOAP autogenerados de AFIP: WSAA, WSFE, WSFEX), `Services/FacturacionElectronicaService/*`, `Persistence/ApplicationContext` (EF Core), `Repositories/` |
| `Facturacion.API` | Controllers (manuales + `Controllers/Generated/` CRUD scaffoldeado), `Program.cs` |
| `Facturacion.EventBus.Messages` | Infraestructura genérica de eventos (Dapr) — **sin eventos concretos de facturación** (la mensajería asíncrona real es vía RabbitMQ/Azure Service Bus con mensajes tipados, no vía este bus) |

## 2. Entidades de dominio clave

Todas heredan de `EditableEntity` (`RowVersion` Guid con `[ConcurrencyCheck]`, `UltimaVez`, `UltimoUsuario_Id`, `Empresa_Id` multi-tenant) — [EditableEntity.cs](../../../cgas-backend/CaldenCloud/Services/CaldenCloudShared/Domain/Common/EditableEntity.cs).

| Entidad | Rol | Archivo |
|---|---|---|
| `MovimientoFac` | Cabecera del comprobante (factura/remito/NC/ND) | [MovimientoFacBase.generated.cs](../../../cgas-backend/CaldenCloud/Services/Facturacion/Facturacion.Domain/Entities/Generated/MovimientoFacBase.generated.cs) |
| `MovimientoFacDetalle` | Renglones (artículo, cantidad, precio) | [MovimientoFacDetalleBase.generated.cs](../../../cgas-backend/CaldenCloud/Services/Facturacion/Facturacion.Domain/Entities/Generated/MovimientoFacDetalleBase.generated.cs) |
| `MovimientoFacElectronica` | Datos de CAE (1:1 con `MovimientoFac`): `CAE`, `VencimientoCAE`, `FormaPago` | [MovimientoFacElectronicaBase.generated.cs](../../../cgas-backend/CaldenCloud/Services/Facturacion/Facturacion.Domain/Entities/Generated/MovimientoFacElectronicaBase.generated.cs) |
| `MovimientoFacImpuesto` | Impuestos por renglón (IVA, IIBB) | — |
| `Talonario` | Punto de venta + numeración (`ProximoNumero`) | [TalonarioBase.generated.cs](../../../cgas-backend/CaldenCloud/Services/Facturacion/Facturacion.Domain/Entities/Generated/TalonarioBase.generated.cs) |
| `TipoMovimientoVenta` | Catálogo de tipos de comprobante (código AFIP, letra, habilitaciones) | — |
| `TipoDocumento` | Catálogo de documentos de identidad (CUIT, DNI, etc., con `CodigoAFIP`) | — |
| `CategoriaIVA` | Condición IVA del receptor (`EsConsumidorFinal`, `EsResponsableInscripto`, `EsMonotributo`, `EsExento`, etc.) | — |
| `CondicionVenta` | Contado / cuenta corriente / planes de financiación | — |

**Importante**: CGAS **no tiene un enum formal de "estado del comprobante"**. El estado se infiere combinando `DocumentoCancelado` (anulado), presencia de `CAE` (emitido con éxito) y flags booleanas. Esto es una decisión de diseño de CGAS, no necesariamente la mejor práctica a copiar (ver gap correspondiente).

## 3. Flujo completo de emisión de un comprobante

1. `POST api/v1/MovimientoFac` → [MovimientoFacControllerBase.generated.cs](../../../cgas-backend/CaldenCloud/Services/Facturacion/Facturacion.API/Controllers/Generated/MovimientoFacControllerBase.generated.cs) → `CreateMovimientoFacCommand` vía MediatR.
2. [CreateMovimientoFacCommandHandler.cs](../../../cgas-backend/CaldenCloud/Services/Facturacion/Facturacion.Application/Features/MovimientosFac/Commands/CreateMovimientosFac/CreateMovimientoFacCommandHandler.cs) — **proceso síncrono**:
   - Resuelve cliente, tipo de comprobante, condición de venta.
   - Si el tipo es NC/ND, valida comprobante asociado (`ValidarYObtenerCbteAsocNcNd`: mismo cliente, tipo compatible, importe ≤ disponible).
   - Si el tipo es electrónico → llama a `IFacturacionElectronicaServiceFactory.GetService(...).EmitirDocumento(...)` (sección 4).
   - Si obtiene CAE → persiste `MovimientoFac` + detalle + impuestos, ajusta `Talonario.ProximoNumero`, y crea `MovimientoFacElectronica` con el CAE.
   - Si **no** obtiene CAE → `ConflictException`, **no persiste nada** (falla completa, sin guardar parcial).
   - Si no es electrónico (remito/documento manual) → persiste directo, sin llamar a AFIP.
3. **Proceso asíncrono** (fire-and-forget, vía Refit local / RabbitMQ / Azure Service Bus según configuración): actualiza cuenta corriente, stock, valores (cupones/cheques) y genera asiento contable.

## 4. Integración real con AFIP/ARCA (WSAA + WSFE)

- **WSAA (autenticación)**: [AfipAuthenticationService.cs](../../../cgas-backend/CaldenCloud/Services/Facturacion/Facturacion.Infrastructure/Services/AutenticacionService/AfipAuthenticationService.cs) — cliente WCF/SOAP, certificado X.509 cliente (.p12), ticket cacheado (`IAfipTicketCacheService`).
- **WSFE (facturación electrónica nacional)**: [FacturacionElectronicaService.cs](../../../cgas-backend/CaldenCloud/Services/Facturacion/Facturacion.Infrastructure/Services/FacturacionElectronicaService/FacturacionElectronicaService.cs), método central `EmitirDocumento`:
  1. Login WSAA → ticket.
  2. `GetUltimoNumeroComprobanteAsync` (`FECompUltimoAutorizado`) → siguiente número.
  3. Construye request (`ReqCAE`): cabecera + detalle (importes, IVA, tributos, comprobantes asociados para NC/ND).
  4. `FECAESolicitar` (SOAP) → `CAEResponse{CAE, CAEFchVto, Observaciones[], Errores[]}`.
  5. Si CAE vacío/nulo → error, no se persiste el comprobante.
- **Modo mock**: `MockFacturacionElectronicaService.cs`, activable por configuración (`FacturacionElectronica:UseMock=true`) — útil para entornos de desarrollo/demo sin certificado real.
- **Reintentos**:
  - Error de correlatividad AFIP (10016): hasta 10 reintentos con backoff exponencial + jitter, re-consultando el último número en cada intento (por si otro proceso ya facturó ese número).
  - Error de BD interna de AFIP (502): hasta 5 reintentos.
  - Fallos de conectividad SOAP/SSL: 3 reintentos con backoff lineal.
- **Reconciliación**: [RecuperarFacturasFaltantesCommandHandler.cs](../../../cgas-backend/CaldenCloud/Services/Facturacion/Facturacion.Application/Features/MovimientosFac/Commands/RecuperarFacturasFaltantes/RecuperarFacturasFaltantesCommandHandler.cs) — consulta un rango de comprobantes ya autorizados en AFIP y reconstruye/persiste localmente los que falten (caso: se obtuvo CAE pero la persistencia local falló). Expuesto también vía cola RabbitMQ con reintentos.
- **Telemetría**: OpenTelemetry con contadores específicos (`afip.cae.success`, `afip.cae.errors`, `afip.correlativo.retries`, etc.).

## 5. Puntos de venta y numeración

- `Talonario.PuntoVenta` + `ProximoNumero`. Para comprobantes **electrónicos**, el número real proviene de AFIP (`FECompUltimoAutorizado + 1`) — **ARCA es la fuente de verdad del número fiscal**, no el talonario local.
- **Hallazgo de concurrencia en CGAS** (a evitar al diseñar el Estacionamiento): la actualización de `Talonario.ProximoNumero` se hace con `concurrencyControl=false` (desactiva el chequeo optimista por `RowVersion`), lo que es un riesgo de doble numeración bajo alta concurrencia para comprobantes **no electrónicos** (remitos, documentos manuales). No hay una constraint `UNIQUE` en base de datos sobre `(PuntoVenta, Numero, TipoMovimientoVenta)` — la única protección es aplicativa (`ExisteMovimientoFac`), y solo se invoca cuando el documento es manual.

## 6. Validaciones de negocio

- FluentValidation generado (`NotNull` sobre campos obligatorios de cabecera) + validador manual de que `Detalle` no esté vacío.
- Reglas NC/ND (US-068) codificadas directamente en el handler (no en FluentValidation): comprobante original obligatorio, mismo cliente, tipo compatible, importe ≤ disponible.
- **Comentarios propios del código marcan como pendiente**: validación de consistencia entre totales de cabecera y de renglones — es decir, ni CGAS tiene esto resuelto al 100%.

## 7. Manejo de estados, reintentos e idempotencia

- **No hay máquina de estados formal** (se infiere de flags + presencia de CAE).
- **No hay idempotency-key** en la emisión de comprobantes — un doble clic podría generar dos comprobantes con dos CAE distintos; la única mitigación (`ExisteMovimientoFac`) solo aplica a documentos manuales.
- El patrón de `IdempotencyKey` **sí existe** en otro módulo de CGAS (CRM, tabla `ClientesPotencialesEventos`) pero no fue portado a Facturación — es decir, CGAS tiene el patrón disponible conceptualmente pero no aplicado de forma universal.
- Concurrencia optimista vía `RowVersion` en toda la capa de persistencia (salvo la excepción del talonario mencionada arriba).

## 8. Auditoría

- Estampado automático (no interceptor EF, no trigger SQL): `RepositoryBase` asigna `RowVersion = Guid.NewGuid()` y `UltimaVez` en cada `Add/Update`.
- **No existe una tabla de historial de cambios** (audit log campo a campo) para comprobantes — solo se conserva el último cambio (`UltimaVez`/`UltimoUsuario_Id`).
- Filtrado multi-tenant manual por `Empresa_Id` en el repositorio (no vía EF Global Query Filters, por un bug de concurrencia documentado en el propio código de CGAS).

## 9. Esquema de base de datos relevante

Tablas principales (`cgas-database/CaldenCloud/DBUp/Scripts/`): `MovimientosFac`, `MovimientosFacElectronicas`, `Talonarios`. Único índice único confirmado: `UQ_MovimientosFac_Empresa (Empresa_Id, MovimientoFac_Id)` — es un índice de cobertura sobre la PK, **no** una regla de negocio sobre `(PuntoVenta, Numero)`. Existen vistas de reporte fiscal (`Reporte_Modelo_Facturacion`, `Exportacion_Ventas_IVA_Digital_*`) que soportan el Libro IVA Digital.

## 10. Conclusión: qué resuelve CGAS que el Estacionamiento no resuelve

1. Integración SOAP real con WSAA/WSFE, con manejo de tickets, certificados y reintentos específicos por tipo de error de AFIP.
2. Talonario/numeración desacoplado del número fiscal real (que en electrónicos proviene de AFIP).
3. Catálogo robusto de tipos de comprobante, tipos de documento y condición IVA alineado al padrón AFIP.
4. Mecanismo de reconciliación (`RecuperarFacturasFaltantes`) ante fallos parciales.
5. Telemetría dedicada a la integración fiscal.

Y qué **no** resuelve del todo (para no idealizar CGAS como fuente perfecta):
1. Sin máquina de estados formal del comprobante.
2. Sin idempotency-key universal en la emisión.
3. Riesgo de numeración duplicada en documentos manuales (concurrencia desactivada a propósito en el talonario).
4. Sin historial de auditoría campo a campo.
