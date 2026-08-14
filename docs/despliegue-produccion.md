# Puesta en producción

Checklist para el primer despliegue real. El orden importa: lo que está arriba bloquea a lo que sigue.

Plantilla de variables: [`backend/.env.production.example`](../backend/.env.production.example).

---

## 1. Secretos

- [ ] **Rotar `JWT_SECRET`.** El de desarrollo estuvo en un repositorio público: hay que tratarlo como conocido por terceros. Con él, cualquiera se firma un token de administrador.
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
  ```
  Rotarlo invalida todas las sesiones abiertas — eso es lo que se busca.
- [ ] **Contraseña de aplicación SMTP nueva.** La anterior también quedó expuesta.
- [ ] Verificar que no haya secretos versionados:
  ```bash
  git ls-files | grep -iE "\.env$|\.key$|\.crt$|\.p12$"   # debe salir vacío
  ```

## 2. Base de datos

- [ ] **Mongo tiene que ser un replica set**, aunque sea de un solo nodo. Sin él, las transacciones fallan y `txHelper` degrada a escrituras sueltas: los guards atómicos por documento siguen protegiendo de las carreras, pero se pierde el rollback cuando un cobro falla a la mitad, y un cobro son cinco escrituras (estadía, vehículo, transacción, comprobante, movimiento de caja).

  Verificar:
  ```bash
  node -e "require('dotenv').config();const{MongoClient}=require('mongodb');(async()=>{const c=new MongoClient(process.env.MONGODB_URI);await c.connect();const h=await c.db('admin').command({hello:1});console.log(h.setName??'STANDALONE — falta el replica set');await c.close()})()"
  ```
  Si dice `STANDALONE`: agregar `replication:\n  replSetName: rs0` a `mongod.cfg`, reiniciar el servicio y correr `rs.initiate()` una vez desde `mongosh`.

  > En el entorno de desarrollo actual esto ya está hecho: responde `rs0`.

- [ ] **Índices creados.** Mongoose los crea al arrancar; con datos ya cargados puede demorar. Confirmar antes de abrir al público:
  ```bash
  node -e "require('dotenv').config();require('mongoose').connect(process.env.MONGODB_URI).then(async m=>{for(const n of ['estacionamientos','turnos','movimientocajas','transaccions'])console.log(n,(await m.connection.db.collection(n).indexes()).map(i=>i.name).join(', '));process.exit(0)})"
  ```

- [ ] **Backup automático y restauración probada.** Un backup que nunca se restauró no es un backup.
  ```bash
  mongodump --uri="$MONGODB_URI" --out=/backups/$(date +%F)
  # y la prueba que importa, contra una base descartable:
  mongorestore --uri="mongodb://127.0.0.1:27017/prueba_restauracion" --drop /backups/2026-08-13/estacionamientoDB
  ```
  Los comprobantes fiscales no se pueden reconstruir: ARCA tiene el CAE, pero la estadía, el cliente y el medio de pago viven solo acá.

## 3. Variables de entorno

- [ ] `NODE_ENV=production`
- [ ] `APP_URL` con el dominio real (si no, los links de los correos apuntan a `localhost`)
- [ ] `SMTP_FROM` con una casilla del negocio, no personal
- [ ] `CORS_ORIGINS` con el dominio del frontend, si se sirve aparte
- [ ] **`RATE_LIMIT_OFF` sin definir o en `false`.** En `true` el login queda sin freno.
- [ ] `MONGODB_URI` apuntando a la base productiva, con `?replicaSet=`

## 4. ARCA — lo único que no es código

- [ ] Dar de alta el punto de venta para **"Factura Electrónica - Web Services"** en el portal de ARCA. El PV de homologación no sirve en producción.
- [ ] Tramitar el certificado de producción con el mismo CSR (ver [`docs/analisis-gap-cgas/10-ARCA-COMO-OBTENER-EL-CERTIFICADO.md`](analisis-gap-cgas/10-ARCA-COMO-OBTENER-EL-CERTIFICADO.md)) y dejarlo en `backend/certs/arca-produccion.crt`.
- [ ] Verificar la instalación **sin emitir ningún comprobante** (autentica y lee; el detalle del circuito de venta está en la sección "Instalación en un cliente" de [10-ARCA](analisis-gap-cgas/10-ARCA-COMO-OBTENER-EL-CERTIFICADO.md)):
  ```bash
  ARCA_AMBIENTE=produccion ARCA_MOCK=false node scripts/arca/arca-verificar-produccion.js
  ```
- [ ] Si algo falla antes de eso, revisar que WSFE de producción responda — el 2026-08-12 daba `EPROTO` mientras homologación andaba entera:
  ```bash
  ARCA_AMBIENTE=produccion node scripts/arca/arca-estado.js
  ARCA_AMBIENTE=produccion node scripts/arca/arca-probar-login.js
  ```
- [ ] `ARCA_MOCK=false`. Con `true` el sistema inventa un CAE que ante ARCA no existe.
- [ ] Confirmar con el contador qué tipo de comprobante corresponde emitir. Hoy se resuelve por la condición de IVA de la empresa (monotributo → factura C, responsable inscripto → factura B).

## 5. Arranque y verificación

- [ ] `cd frontend && npm run build`
- [ ] Levantar el backend con un supervisor que lo reinicie solo (systemd, pm2, servicio de Windows). Hoy no hay ninguno configurado.
- [ ] Correr la batería contra el entorno real, **con un servidor de prueba**, no contra producción con datos de clientes:
  ```bash
  node scripts/seed-test-users.js
  BASE_URL=... node scripts/verificaciones/verify-authz.js
  BASE_URL=... node scripts/verificaciones/verify-seguridad.js
  node scripts/seed-test-users.js cleanup
  ```
- [ ] Dar de alta el usuario administrador real y **eliminar los usuarios de prueba** (`node scripts/seed-test-users.js cleanup`).
- [ ] Abrir un turno, cobrar una estadía y cerrar el turno confirmando que el arqueo cuadra. Ojo: con ARCA en producción **esa estadía emite una factura fiscal real**, así que no es una prueba — que sea la primera venta de verdad, de importe chico, y que alguien mire el comprobante emitido. Si sale mal, se corrige con nota de crédito, nunca borrando el registro.

## 6. Después de abrir

- [ ] Mirar el log el primer día: el worker de ARCA avisa cada corrida con comprobantes pendientes, y la reconciliación avisa los huérfanos.
- [ ] Revisar `Reportes → Cierres de caja` la primera semana: las diferencias sistemáticas de un mismo operador son el indicador que justifica todo el circuito de turnos.
