# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primario: el playero / operador de caja.** Trabaja un turno completo frente a la pantalla del estacionamiento: registra ingresos y egresos de vehículos, cobra, emite comprobantes y cierra caja al final del turno. Sesión larga, interrupciones constantes, con el cliente esperando del otro lado del mostrador. Velocidad y certeza pesan más que cualquier otra cosa.

**Secundario: el administrador/dueño.** Configura tarifas, empresa y sucursales, revisa transacciones, facturas, listados y auditoría. Consulta y control, no operación minuto a minuto.

**Secundario: el cliente conductor registrado.** Se registra, carga vehículos, tiene saldo e historial de estadías. Uso esporádico, mayormente desde el celular.

## Product Purpose

Sistema de gestión de estacionamiento en operación real: controla la estadía de cada vehículo desde el ingreso hasta el egreso, calcula el importe según la tarifa que corresponde al cliente, cobra (saldo o efectivo), emite el comprobante y deja todo asentado en caja y auditoría.

Éxito = el turno cierra cuadrado y sin fricción: ningún vehículo sin registrar, ningún cobro sin comprobante, ninguna diferencia de caja inexplicada.

## Positioning

Es un producto en producción con plata real de por medio, no una demo. La diferencia frente a un CRUD de estacionamiento genérico está en el modelo operativo completo: turnos y caja con movimientos auditables, tarifas por usuario con cascada de resolución, comprobantes numerados por talonario y trazabilidad de todo cambio sensible (precio, saldo, vehículo, configuración de empresa) en logs dedicados.

## Operating Context

- **La escena real es el mostrador.** El operador atiende con el auto esperando; cada pantalla compite con esa presión de tiempo.
- **El turno es la unidad de trabajo.** Apertura de turno → operación → cierre con arqueo. `Turno`, `Caja` y `MovimientoCaja` son entidades de primera clase, no reportes.
- **Hay operación de caja sin usuario registrado** (estadía manual para el que no es cliente del sistema) — documentado en `docs/analisis-gap-cgas/07-OPERACION-CAJA-SIN-USUARIO.md`.
- **Roadmap por etapas** vivo en `docs/analisis-gap-cgas/08-PLAN-IMPLEMENTACION.md`. La integración fiscal es Etapa 6.

## Capabilities and Constraints

**Funcionalidad confirmada en código**

- Autenticación JWT con registro, verificación, recuperación y seteo de contraseña.
- Alta y gestión de vehículos por usuario; estado de vehículo y de estacionamiento en tiempo real.
- Estadías: ingreso/egreso, cálculo de importe, estadía manual desde caja.
- Tarifas: `ConfiguracionPrecio` con cascada de prioridad — tarifa asignada al usuario → tarifa por tipo (asociado / no asociado) → valores por defecto.
- Saldo por usuario, transacciones y recarga con factura.
- Turnos y caja: apertura, movimientos, cierre.
- Comprobantes de estadía numerados por `Talonario` (sucursal + punto de venta + tipo), incremento atómico vía `findOneAndUpdate` + `$inc`.
- Panel administrativo: usuarios, precios, configuración de empresa, listados, control de transacciones, gestión de facturas.
- Auditoría: `AuditLog` más logs específicos de precio, saldo, vehículo y configuración de empresa.

**Stack**

- Frontend: React 18 + CRA (`react-scripts` 5) con `react-app-rewired`, React Router 7, `react-helmet-async`, Workbox, CSS propio en `src/styles/` (`theme.css`, `admin.css`, `animations.css`, `Home.css`). Sin librería de componentes.
- Backend: Node + Express, MongoDB/Mongoose, JWT.
- Componentes en `frontend/src/components/` planos, sin carpeta `pages/`.

**Restricciones confirmadas**

- **Español rioplatense.** Toda la UI en español de Argentina, sin i18n multi-idioma. Los términos de dominio (estadía, talonario, punto de venta, arqueo, asociado) no se traducen ni se suavizan.
- **PWA / offline.** Service worker y operación sin conexión son parte del producto.
- **Multi-sucursal.** `Sucursal` es real: nada puede asumir una sola sucursal ni un punto de venta único.
- **Roles.** Operador y administrador tienen alcances distintos; la UI no puede asumir permisos totales.

**Explícitamente indeciso / pendiente**

- **Facturación fiscal.** La integración con ARCA (Etapa 6) está implementada y probada contra **homologación real** el 2026-08-12: factura B con CAE y nota de crédito asociada. Lo que falta es el pasaje a producción, que depende del CUIT de quien va a facturar y no se puede adelantar — ver `docs/analisis-gap-cgas/10`. Mientras el certificado de producción no exista, los comprobantes se emiten como **ticket no fiscal, sin CAE**, y la interfaz lo dice: ningún trabajo futuro puede presentarlos como fiscales ni mostrar un CAE inventado.

## Brand Commitments

Nombre en uso: **Sistema de Gestión de Estacionamiento**. Manifiesto PWA con `short_name` "Estacionamiento" y `theme_color` `#007bff`.

No hay identidad de marca confirmada más allá de eso. `theme.css` es la fuente actual de color y tipografía; no está confirmado como sistema de diseño intencional.

## Evidence on Hand

- Análisis y plan por etapas en `docs/analisis-gap-cgas/` (10 documentos), rediseño del panel en `docs/rediseno-admin/`.
- Documentación operativa: `docs/tarifas.md`, `docs/despliegue-produccion.md`, `docs/auditoria-seguridad.md`.
- La documentación académica de la cursada y los informes de SEO se retiraron del repositorio: describían un sistema anterior a las Etapas 0-7 y contradecían al código.
- Assets sueltos en la raíz: `car icon.png` y una imagen `.jpg` sin uso confirmado.
- **No hay** testimonios, clientes nombrados, benchmarks publicados, pricing comercial ni datos de uso real. Nada de eso se puede inventar.

## Product Principles

1. **El turno tiene que cuadrar.** Toda decisión de producto se juzga contra el cierre de caja: si una pantalla facilita un cobro sin asiento o una salida sin comprobante, está mal diseñada.
2. **El mostrador manda.** El operador diseña su ritmo con un cliente esperando. Menos pasos, estado siempre visible, errores que se entienden y se resuelven sin llamar al admin.
3. **Nada fiscal se simula.** Mientras no exista la integración con ARCA, la UI dice la verdad sobre qué es cada comprobante.
4. **Todo cambio sensible deja rastro.** Precio, saldo, vehículo y configuración se auditan; la interfaz tiene que hacer visible ese rastro, no esconderlo.
5. **La tarifa correcta es la del cliente, no la genérica.** La cascada de tarifas es un diferencial del producto y debe ser legible en pantalla: por qué se cobró lo que se cobró.

## Accessibility & Inclusion

No se estableció un estándar formal con el usuario. Los badges de accesibilidad del README son aspiracionales y no cuentan como requisito confirmado. Condición real a considerar: uso prolongado en mostrador, posiblemente con luz variable y sin mouse cómodo — navegación por teclado y contraste alto tienen valor operativo aunque no haya norma comprometida.
