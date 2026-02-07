# 📚 Documentación de API - Sistema de Estacionamiento

**Versión:** 1.0.0  
**Base URL:** `http://localhost:3000/api` (Development)  
**Arquitectura:** Modelo-Vista-Controlador (MVC)  
**Framework:** Express.js + MongoDB (Mongoose)

---

## 📋 Índice

1. [Autenticación](#autenticación)
2. [Usuarios](#usuarios)
3. [Vehículos](#vehículos)
4. [Estacionamiento](#estacionamiento)
5. [Transacciones](#transacciones)
6. [Comprobantes](#comprobantes)
7. [Admin - Gestión](#admin---gestión)
8. [Admin - Auditoría](#admin---auditoría)
9. [Precios](#precios)
10. [Facturador AFIP](#facturador-afip)
11. [Configuración Empresa](#configuración-empresa)
12. [Perfil](#perfil)
13. [Analytics](#analytics)

---

## 🔐 Autenticación

Todos los endpoints (excepto los públicos) requieren autenticación mediante JWT Bearer Token.

**Header requerido:**
```
Authorization: Bearer <tu_token_jwt>
```

### 1. Registrar Usuario con Email

**POST** `/api/auth/registrar-con-email`

Registra un nuevo usuario y envía email de confirmación.

**Body:**
```json
{
  "email": "usuario@ejemplo.com",
  "nombre": "Juan",
  "apellido": "Pérez",
  "dni": "12345678"
}
```

**Respuesta exitosa (201):**
```json
{
  "success": true,
  "mensaje": "Usuario registrado. Se ha enviado un email de confirmación."
}
```

---

### 2. Confirmar Email

**GET** `/api/auth/confirmar/:token`

Confirma el email del usuario mediante token.

**Parámetros URL:**
- `token` (string): Token de confirmación

**Respuesta exitosa (200):**
```json
{
  "mensaje": "Email confirmado exitosamente",
  "usuario": {
    "id": "...",
    "email": "usuario@ejemplo.com",
    "emailConfirmado": true
  }
}
```

---

### 3. Setear Contraseña

**POST** `/api/auth/setear-password`

Establece la contraseña inicial del usuario.

**Body:**
```json
{
  "token": "token_de_confirmacion",
  "password": "MiContraseña123!"
}
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "mensaje": "Contraseña establecida exitosamente",
  "token": "jwt_token_here"
}
```

---

### 4. Login

**POST** `/api/auth/login`

Inicia sesión con email y contraseña.

**Body:**
```json
{
  "email": "usuario@ejemplo.com",
  "password": "MiContraseña123!"
}
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "mensaje": "Login exitoso",
  "token": "jwt_token_here",
  "usuario": {
    "id": "...",
    "email": "usuario@ejemplo.com",
    "nombre": "Juan",
    "apellido": "Pérez",
    "dni": "12345678",
    "rol": "usuario",
    "saldo": 0
  }
}
```

---

### 5. Solicitar Recuperación de Contraseña

**POST** `/api/auth/solicitar-recuperacion`

Envía email con link de recuperación.

**Body:**
```json
{
  "email": "usuario@ejemplo.com"
}
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "mensaje": "Se ha enviado un email con instrucciones para recuperar la contraseña"
}
```

---

### 6. Validar Token de Recuperación

**GET** `/api/auth/validar-recuperacion/:token`

Valida si el token de recuperación es válido.

**Parámetros URL:**
- `token` (string): Token de recuperación

**Respuesta exitosa (200):**
```json
{
  "valido": true,
  "mensaje": "Token válido"
}
```

---

### 7. Restablecer Contraseña

**POST** `/api/auth/restablecer-password`

Restablece la contraseña con el token de recuperación.

**Body:**
```json
{
  "token": "token_de_recuperacion",
  "nuevaPassword": "NuevaContraseña123!"
}
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "mensaje": "Contraseña restablecida exitosamente"
}
```

---

### 8. Verificar Token JWT

**GET** `/api/auth/verificar`

**Headers:** `Authorization: Bearer <token>`

Verifica si el token JWT es válido.

**Respuesta exitosa (200):**
```json
{
  "mensaje": "Token válido",
  "usuario": {
    "id": "...",
    "email": "usuario@ejemplo.com",
    "nombre": "Juan",
    "apellido": "Pérez",
    "dni": "12345678",
    "rol": "usuario"
  }
}
```

---

## 👥 Usuarios

### 1. Obtener Usuario por DNI

**GET** `/api/usuarios/:dni`

**Headers:** `Authorization: Bearer <token>`

**Parámetros URL:**
- `dni` (string): DNI del usuario

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "usuario": {
    "dni": "12345678",
    "nombre": "Juan",
    "apellido": "Pérez",
    "email": "usuario@ejemplo.com",
    "saldo": 5000,
    "tipoUsuario": "normal",
    "vehiculos": []
  }
}
```

---

### 2. Recargar Saldo

**POST** `/api/usuarios/recargar`

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "dni": "12345678",
  "monto": 1000
}
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "mensaje": "Recarga exitosa",
  "nuevoSaldo": 6000
}
```

---

### 3. Agregar Vehículo

**POST** `/api/usuarios/vehiculo`

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "dni": "12345678",
  "dominio": "ABC123",
  "marca": "Ford",
  "modelo": "Focus",
  "anio": 2020,
  "color": "Azul"
}
```

**Respuesta exitosa (201):**
```json
{
  "success": true,
  "mensaje": "Vehículo agregado exitosamente",
  "vehiculo": {
    "dominio": "ABC123",
    "marca": "Ford",
    "modelo": "Focus"
  }
}
```

---

### 4. Modificar Vehículo

**PUT** `/api/usuarios/vehiculo/:dominio`

**Headers:** `Authorization: Bearer <token>`

**Parámetros URL:**
- `dominio` (string): Dominio del vehículo

**Body:**
```json
{
  "marca": "Ford",
  "modelo": "Fiesta",
  "anio": 2021,
  "color": "Rojo"
}
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "mensaje": "Vehículo modificado exitosamente"
}
```

---

### 5. Eliminar Vehículo

**DELETE** `/api/usuarios/vehiculo/:dominio`

**Headers:** `Authorization: Bearer <token>`

**Parámetros URL:**
- `dominio` (string): Dominio del vehículo

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "mensaje": "Vehículo eliminado exitosamente"
}
```

---

### 6. Obtener Todos los Usuarios (Admin)

**GET** `/api/usuarios`

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page` (number, opcional): Número de página (default: 1)
- `limit` (number, opcional): Límite por página (default: 10)
- `busqueda` (string, opcional): Búsqueda por nombre, apellido o DNI

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "usuarios": [],
  "total": 100,
  "pagina": 1,
  "totalPaginas": 10
}
```

---

### 7. Actualizar Usuario (Admin)

**PUT** `/api/usuarios/:dni`

**Headers:** `Authorization: Bearer <token>`

**Parámetros URL:**
- `dni` (string): DNI del usuario

**Body:**
```json
{
  "nombre": "Juan Carlos",
  "apellido": "Pérez",
  "tipoUsuario": "premium"
}
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "mensaje": "Usuario actualizado exitosamente"
}
```

---

### 8. Obtener Tarifas Disponibles

**GET** `/api/usuarios/tarifas/disponibles`

**Headers:** `Authorization: Bearer <token>`

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "tarifas": [
    {
      "tipoUsuario": "normal",
      "descripcion": "Usuario Normal",
      "precioHora": 100
    },
    {
      "tipoUsuario": "premium",
      "descripcion": "Usuario Premium",
      "precioHora": 75
    }
  ]
}
```

---

## 🚗 Vehículos

### 1. Agregar Vehículo

**POST** `/api/vehiculos/agregar`

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "dni": "12345678",
  "dominio": "DEF456",
  "marca": "Toyota",
  "modelo": "Corolla",
  "anio": 2022,
  "color": "Blanco"
}
```

**Respuesta exitosa (201):**
```json
{
  "success": true,
  "mensaje": "Vehículo agregado exitosamente"
}
```

---

### 2. Obtener Vehículos por Usuario

**GET** `/api/vehiculos/usuario/:dni`

**Headers:** `Authorization: Bearer <token>`

**Parámetros URL:**
- `dni` (string): DNI del propietario

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "vehiculos": [
    {
      "dominio": "ABC123",
      "marca": "Ford",
      "modelo": "Focus",
      "anio": 2020,
      "color": "Azul"
    }
  ]
}
```

---

### 3. Modificar Vehículo

**PUT** `/api/vehiculos/usuario/:dni/vehiculo/:dominio`

**Headers:** `Authorization: Bearer <token>`

**Parámetros URL:**
- `dni` (string): DNI del propietario
- `dominio` (string): Dominio del vehículo

**Body:**
```json
{
  "marca": "Ford",
  "modelo": "Fiesta",
  "anio": 2021,
  "color": "Negro"
}
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "mensaje": "Vehículo modificado exitosamente"
}
```

---

### 4. Eliminar Vehículo

**DELETE** `/api/vehiculos/usuario/:dni/vehiculo/:dominio`

**Headers:** `Authorization: Bearer <token>`

**Parámetros URL:**
- `dni` (string): DNI del propietario
- `dominio` (string): Dominio del vehículo

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "mensaje": "Vehículo eliminado exitosamente"
}
```

---

### 5. Limpiar Duplicados de Vehículos

**POST** `/api/vehiculos/usuario/:dni/limpiar-duplicados`

**Headers:** `Authorization: Bearer <token>`

**Parámetros URL:**
- `dni` (string): DNI del propietario

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "mensaje": "Duplicados eliminados",
  "eliminados": 2
}
```

---

## 🅿️ Estacionamiento

### 1. Verificar Estado de Estacionamiento

**GET** `/api/estacionamiento/estado/:dominio`

**Headers:** `Authorization: Bearer <token>`

**Parámetros URL:**
- `dominio` (string): Dominio del vehículo

**Respuesta exitosa (200):**
```json
{
  "estacionamiento": {
    "vehiculoDominio": "ABC123",
    "estado": "activo",
    "horaEntrada": "2026-02-07T10:00:00.000Z",
    "dni": "12345678"
  }
}
```

---

### 2. Iniciar Estacionamiento

**POST** `/api/estacionamiento/iniciar`

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "dni": "12345678",
  "dominio": "ABC123"
}
```

**Respuesta exitosa (201):**
```json
{
  "success": true,
  "mensaje": "Estacionamiento iniciado",
  "estacionamiento": {
    "vehiculoDominio": "ABC123",
    "estado": "activo",
    "horaEntrada": "2026-02-07T10:00:00.000Z"
  }
}
```

---

### 3. Finalizar Estacionamiento

**POST** `/api/estacionamiento/finalizar`

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "dni": "12345678",
  "dominio": "ABC123"
}
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "mensaje": "Estacionamiento finalizado",
  "detalles": {
    "horaEntrada": "2026-02-07T10:00:00.000Z",
    "horaSalida": "2026-02-07T14:00:00.000Z",
    "tiempoTotal": "4 horas",
    "costoTotal": 400,
    "saldoRestante": 4600
  }
}
```

---

### 4. Obtener Estado (Ruta Alternativa)

**GET** `/api/estacionamiento-estado/estado/:dominio`

**Headers:** `Authorization: Bearer <token>`

**Parámetros URL:**
- `dominio` (string): Dominio del vehículo

**Respuesta exitosa (200):**
```json
{
  "estacionamiento": {
    "vehiculoDominio": "ABC123",
    "estado": "activo",
    "horaEntrada": "2026-02-07T10:00:00.000Z"
  }
}
```

---

## 💰 Transacciones

### 1. Obtener Transacciones

**GET** `/api/transacciones`

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `dni` (string, opcional): Filtrar por DNI de usuario
- `tipo` (string, opcional): Filtrar por tipo (ingreso/salida/recarga)
- `fechaDesde` (string, opcional): Fecha inicial (formato: YYYY-MM-DD)
- `fechaHasta` (string, opcional): Fecha final (formato: YYYY-MM-DD)
- `page` (number, opcional): Número de página
- `limit` (number, opcional): Límite por página

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "transacciones": [
    {
      "tipo": "ingreso",
      "dni": "12345678",
      "dominio": "ABC123",
      "fecha": "2026-02-07T10:00:00.000Z",
      "monto": 400
    }
  ],
  "total": 50,
  "pagina": 1
}
```

---

### 2. Crear Transacción de Ingreso

**POST** `/api/transacciones/ingreso`

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "dni": "12345678",
  "dominio": "ABC123"
}
```

**Respuesta exitosa (201):**
```json
{
  "success": true,
  "mensaje": "Ingreso registrado",
  "transaccion": {
    "id": "...",
    "tipo": "ingreso",
    "fecha": "2026-02-07T10:00:00.000Z"
  }
}
```

---

### 3. Registrar Salida

**PUT** `/api/transacciones/:transaccionId/salida`

**Headers:** `Authorization: Bearer <token>`

**Parámetros URL:**
- `transaccionId` (string): ID de la transacción

**Body:**
```json
{
  "dni": "12345678"
}
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "mensaje": "Salida registrada",
  "detalles": {
    "costoTotal": 400,
    "tiempoTotal": "4 horas"
  }
}
```

---

## 🧾 Comprobantes

### 1. Obtener Comprobantes

**GET** `/api/comprobantes`

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `estado` (string, opcional): Filtrar por estado (pendiente/aprobado/rechazado)
- `dni` (string, opcional): Filtrar por DNI de usuario
- `page` (number, opcional): Número de página

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "comprobantes": [
    {
      "nroComprobante": "C-001",
      "dni": "12345678",
      "monto": 1000,
      "fecha": "2026-02-07T10:00:00.000Z",
      "estado": "pendiente",
      "metodoPago": "transferencia"
    }
  ]
}
```

---

### 2. Crear Comprobante

**POST** `/api/comprobantes`

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "dni": "12345678",
  "monto": 1000,
  "metodoPago": "transferencia",
  "imagenComprobante": "base64_encoded_image"
}
```

**Respuesta exitosa (201):**
```json
{
  "success": true,
  "mensaje": "Comprobante creado",
  "nroComprobante": "C-001"
}
```

---

### 3. Aprobar Comprobante (Admin)

**PUT** `/api/comprobantes/:nroComprobante/aprobar`

**Headers:** `Authorization: Bearer <token>`

**Parámetros URL:**
- `nroComprobante` (string): Número de comprobante

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "mensaje": "Comprobante aprobado y saldo acreditado"
}
```

---

### 4. Obtener Comprobante por Número

**GET** `/api/comprobantes/:nroComprobante`

**Headers:** `Authorization: Bearer <token>`

**Parámetros URL:**
- `nroComprobante` (string): Número de comprobante

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "comprobante": {
    "nroComprobante": "C-001",
    "dni": "12345678",
    "monto": 1000,
    "estado": "aprobado"
  }
}
```

---

### 5. Generar PDF del Comprobante

**GET** `/api/comprobantes/:nroComprobante/pdf`

**Headers:** `Authorization: Bearer <token>`

**Parámetros URL:**
- `nroComprobante` (string): Número de comprobante

**Respuesta exitosa (200):**
- Content-Type: `application/pdf`
- Archivo PDF descargable

---

## 👨‍💼 Admin - Gestión

**Nota:** Todos estos endpoints requieren rol de administrador.

### 1. Obtener Comprobantes Pendientes

**GET** `/api/admin/comprobantes/pendientes`

**Headers:** `Authorization: Bearer <token>`

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "comprobantes": []
}
```

---

### 2. Obtener Todos los Comprobantes

**GET** `/api/admin/comprobantes`

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `estado` (string, opcional)
- `page` (number, opcional)
- `limit` (number, opcional)

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "comprobantes": [],
  "total": 100
}
```

---

### 3. Validar Comprobante

**PUT** `/api/admin/comprobantes/:nroComprobante/validar`

**Headers:** `Authorization: Bearer <token>`

**Parámetros URL:**
- `nroComprobante` (string): Número de comprobante

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "mensaje": "Comprobante validado y saldo acreditado"
}
```

---

### 4. Rechazar Comprobante

**PUT** `/api/admin/comprobantes/:nroComprobante/rechazar`

**Headers:** `Authorization: Bearer <token>`

**Parámetros URL:**
- `nroComprobante` (string): Número de comprobante

**Body:**
```json
{
  "motivoRechazo": "Imagen ilegible"
}
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "mensaje": "Comprobante rechazado"
}
```

---

### 5. Obtener Todos los Usuarios

**GET** `/api/admin/usuarios`

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `busqueda` (string, opcional)
- `tipoUsuario` (string, opcional)
- `page` (number, opcional)

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "usuarios": [],
  "total": 150
}
```

---

### 6. Obtener Usuarios Desactivados

**GET** `/api/admin/usuarios/desactivados`

**Headers:** `Authorization: Bearer <token>`

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "usuarios": []
}
```

---

### 7. Reactivar Usuario

**POST** `/api/admin/usuarios/reactivar`

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "dni": "12345678"
}
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "mensaje": "Usuario reactivado exitosamente"
}
```

---

### 8. Modificar Usuario

**PUT** `/api/admin/usuarios/:dni`

**Headers:** `Authorization: Bearer <token>`

**Parámetros URL:**
- `dni` (string): DNI del usuario

**Body:**
```json
{
  "nombre": "Juan Carlos",
  "apellido": "Pérez",
  "tipoUsuario": "premium",
  "saldo": 5000
}
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "mensaje": "Usuario modificado exitosamente"
}
```

---

### 9. Eliminar Usuario

**DELETE** `/api/admin/usuarios/:dni`

**Headers:** `Authorization: Bearer <token>`

**Parámetros URL:**
- `dni` (string): DNI del usuario

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "mensaje": "Usuario eliminado (desactivado)"
}
```

---

### 10. Obtener Todos los Vehículos

**GET** `/api/admin/vehiculos`

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `busqueda` (string, opcional)
- `page` (number, opcional)

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "vehiculos": [],
  "total": 200
}
```

---

### 11. Agregar Vehículo (Admin)

**POST** `/api/admin/vehiculos`

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "dni": "12345678",
  "dominio": "XYZ789",
  "marca": "Chevrolet",
  "modelo": "Cruze"
}
```

**Respuesta exitosa (201):**
```json
{
  "success": true,
  "mensaje": "Vehículo agregado exitosamente"
}
```

---

### 12. Modificar Vehículo (Admin)

**PUT** `/api/admin/vehiculos/:dominio`

**Headers:** `Authorization: Bearer <token>`

**Parámetros URL:**
- `dominio` (string): Dominio del vehículo

**Body:**
```json
{
  "marca": "Chevrolet",
  "modelo": "Onix",
  "anio": 2023
}
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "mensaje": "Vehículo modificado exitosamente"
}
```

---

### 13. Eliminar Vehículo (Admin)

**DELETE** `/api/admin/vehiculos/:dominio`

**Headers:** `Authorization: Bearer <token>`

**Parámetros URL:**
- `dominio` (string): Dominio del vehículo

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "mensaje": "Vehículo eliminado exitosamente"
}
```

---

### 14. Obtener Historial de Saldos

**GET** `/api/admin/saldos/historial`

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `dni` (string, opcional)
- `fechaDesde` (string, opcional)
- `fechaHasta` (string, opcional)
- `page` (number, opcional)

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "historial": [],
  "total": 300
}
```

---

### 15. Obtener Estadísticas de Saldos

**GET** `/api/admin/saldos/estadisticas`

**Headers:** `Authorization: Bearer <token>`

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "estadisticas": {
    "totalRecargas": 50000,
    "totalGastos": 30000,
    "promedioSaldo": 2000
  }
}
```

---

### 16. Obtener Historial de Vehículos

**GET** `/api/admin/vehiculos/historial`

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `dominio` (string, opcional)
- `page` (number, opcional)

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "historial": [],
  "total": 150
}
```

---

### 17. Obtener Estadísticas de Vehículos

**GET** `/api/admin/vehiculos/estadisticas`

**Headers:** `Authorization: Bearer <token>`

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "estadisticas": {
    "totalVehiculos": 200,
    "vehiculosPorMarca": {}
  }
}
```

---

### 18. Obtener Ingresos del Estacionamiento

**GET** `/api/admin/transacciones/ingresos`

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `fechaDesde` (string, opcional)
- `fechaHasta` (string, opcional)

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "ingresos": [],
  "total": 100
}
```

---

### 19. Obtener Egresos del Estacionamiento

**GET** `/api/admin/transacciones/egresos`

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `fechaDesde` (string, opcional)
- `fechaHasta` (string, opcional)

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "egresos": [],
  "total": 50
}
```

---

### 20. Obtener Estadísticas de Transacciones

**GET** `/api/admin/transacciones/estadisticas`

**Headers:** `Authorization: Bearer <token>`

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "estadisticas": {
    "totalIngresos": 100000,
    "totalEgresos": 50000,
    "balance": 50000
  }
}
```

---

### 21. Obtener Historial de Configuración de Empresa

**GET** `/api/admin/configuracion/historial`

**Headers:** `Authorization: Bearer <token>`

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "historial": []
}
```

---

### 22. Obtener Estadísticas de Configuración

**GET** `/api/admin/configuracion/estadisticas`

**Headers:** `Authorization: Bearer <token>`

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "estadisticas": {}
}
```

---

## 📊 Admin - Auditoría

### 1. Obtener Logs de Auditoría

**GET** `/api/admin/auditoria`

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `tipoLog` (string, opcional): todos/saldo/vehiculo/precio/configuracion (default: todos)
- `fechaDesde` (string, opcional): Fecha inicial
- `fechaHasta` (string, opcional): Fecha final
- `busqueda` (string, opcional): Búsqueda en logs
- `pagina` (number, opcional): Número de página (default: 1)
- `limite` (number, opcional): Límite por página (default: 20)
- `ordenPor` (string, opcional): Campo para ordenar (default: fecha)
- `orden` (string, opcional): asc/desc (default: desc)

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "logs": [],
  "total": 500,
  "pagina": 1,
  "totalPaginas": 25,
  "estadisticas": {
    "totalLogs": 500,
    "logsSaldo": 200,
    "logsVehiculo": 150,
    "logsPrecio": 100,
    "logsConfiguracion": 50
  }
}
```

---

## 💵 Precios

### 1. Obtener Todos los Precios (Admin)

**GET** `/api/precios`

**Headers:** `Authorization: Bearer <token>`

**Nota:** Solo administradores

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "precios": [
    {
      "tipoUsuario": "normal",
      "descripcion": "Usuario Normal",
      "precioHora": 100
    },
    {
      "tipoUsuario": "premium",
      "descripcion": "Usuario Premium",
      "precioHora": 75
    }
  ]
}
```

---

### 2. Crear Precio (Admin)

**POST** `/api/precios`

**Headers:** `Authorization: Bearer <token>`

**Nota:** Solo administradores

**Body:**
```json
{
  "tipoUsuario": "vip",
  "descripcion": "Usuario VIP",
  "precioHora": 50
}
```

**Respuesta exitosa (201):**
```json
{
  "success": true,
  "mensaje": "Precio creado exitosamente"
}
```

---

### 3. Obtener Precio por Tipo de Usuario

**GET** `/api/precios/:tipoUsuario`

**Parámetros URL:**
- `tipoUsuario` (string): Tipo de usuario (normal/premium/vip)

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "precio": {
    "tipoUsuario": "normal",
    "descripcion": "Usuario Normal",
    "precioHora": 100
  }
}
```

---

### 4. Actualizar Precio (Admin)

**PUT** `/api/precios/:tipoUsuario`

**Headers:** `Authorization: Bearer <token>`

**Nota:** Solo administradores

**Parámetros URL:**
- `tipoUsuario` (string): Tipo de usuario

**Body:**
```json
{
  "precioHora": 120,
  "descripcion": "Usuario Normal (Actualizado)"
}
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "mensaje": "Precio actualizado exitosamente"
}
```

---

### 5. Eliminar Precio (Admin)

**DELETE** `/api/precios/:tipoUsuario`

**Headers:** `Authorization: Bearer <token>`

**Nota:** Solo administradores

**Parámetros URL:**
- `tipoUsuario` (string): Tipo de usuario

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "mensaje": "Precio eliminado exitosamente"
}
```

---

### 6. Obtener Historial de Cambios de Precios

**GET** `/api/precios/historial/cambios`

**Headers:** `Authorization: Bearer <token>`

**Nota:** Solo administradores

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "historial": []
}
```

---

### 7. Obtener Estadísticas de Cambios de Precios

**GET** `/api/precios/historial/estadisticas`

**Headers:** `Authorization: Bearer <token>`

**Nota:** Solo administradores

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "estadisticas": {}
}
```

---

## 🧾 Facturador AFIP

**Nota:** Todos estos endpoints requieren autenticación.

### 1. Obtener Comprobantes Aprobados Pendientes de Facturación

**GET** `/api/facturador/comprobantes-aprobados`

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `dni` (string, opcional): Filtrar por DNI
- `fechaDesde` (string, opcional)
- `fechaHasta` (string, opcional)

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "comprobantes": [
    {
      "nroComprobante": "C-001",
      "dni": "12345678",
      "usuario": {
        "nombre": "Juan",
        "apellido": "Pérez"
      },
      "monto": 1000,
      "fecha": "2026-02-07T10:00:00.000Z",
      "estado": "aprobado"
    }
  ]
}
```

---

### 2. Validar CUIT con AFIP

**POST** `/api/facturador/validar-cuit`

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "cuit": "20123456789"
}
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "datos": {
    "razonSocial": "Juan Pérez",
    "condicionIVA": "Responsable Inscripto",
    "tipoPersona": "Física"
  }
}
```

---

### 3. Generar Factura Electrónica

**POST** `/api/facturador/generar-factura`

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "nroComprobante": "C-001",
  "cuit": "20123456789",
  "tipoFactura": "B",
  "conceptoFactura": "Recarga de saldo"
}
```

**Respuesta exitosa (201):**
```json
{
  "success": true,
  "mensaje": "Factura generada exitosamente",
  "factura": {
    "cae": "12345678901234",
    "numeroFactura": "0001-00000001",
    "fechaVencimientoCAE": "2026-02-17"
  }
}
```

---

### 4. Obtener Facturas Generadas

**GET** `/api/facturador/facturas`

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `dni` (string, opcional)
- `tipoFactura` (string, opcional): A/B
- `fechaDesde` (string, opcional)
- `fechaHasta` (string, opcional)
- `page` (number, opcional)
- `limit` (number, opcional)

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "facturas": [
    {
      "numeroFactura": "0001-00000001",
      "tipoFactura": "B",
      "cae": "12345678901234",
      "monto": 1000,
      "fecha": "2026-02-07T10:00:00.000Z"
    }
  ],
  "total": 50
}
```

---

## 🏢 Configuración Empresa

**Nota:** Todos estos endpoints requieren rol de administrador.

### 1. Obtener Configuración Actual

**GET** `/api/configuracion-empresa`

**Headers:** `Authorization: Bearer <token>`

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "configuracion": {
    "nombre": "Estacionamiento Central",
    "cuit": "30123456789",
    "direccion": {
      "calle": "Av. Principal",
      "numero": "123",
      "localidad": "Buenos Aires",
      "provincia": "Buenos Aires",
      "codigoPostal": "1000"
    },
    "telefono": "011-1234-5678",
    "email": "info@estacionamiento.com",
    "puntoVenta": 1
  }
}
```

---

### 2. Actualizar Configuración

**PUT** `/api/configuracion-empresa`

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "nombre": "Estacionamiento Central SA",
  "cuit": "30123456789",
  "direccion": {
    "calle": "Av. Principal",
    "numero": "123",
    "localidad": "Buenos Aires",
    "provincia": "Buenos Aires",
    "codigoPostal": "1000"
  },
  "telefono": "011-1234-5678",
  "email": "info@estacionamiento.com"
}
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "mensaje": "Configuración actualizada exitosamente"
}
```

---

### 3. Validar Configuración para Facturación

**GET** `/api/configuracion-empresa/validar`

**Headers:** `Authorization: Bearer <token>`

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "valida": true,
  "mensaje": "Configuración válida para facturación"
}
```

---

### 4. Obtener Próximo Número de Factura

**GET** `/api/configuracion-empresa/proximo-numero`

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `tipoComprobante` (number, opcional): Código de tipo de comprobante AFIP

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "proximoNumero": 42
}
```

---

### 5. Obtener Historial de Cambios de Configuración

**GET** `/api/configuracion-empresa/historial`

**Headers:** `Authorization: Bearer <token>`

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "historial": []
}
```

---

### 6. Obtener Estadísticas de Configuración

**GET** `/api/configuracion-empresa/estadisticas`

**Headers:** `Authorization: Bearer <token>`

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "estadisticas": {}
}
```

---

## 👤 Perfil

**Nota:** Todos estos endpoints requieren autenticación.

### 1. Obtener Datos del Perfil

**GET** `/api/perfil`

**Headers:** `Authorization: Bearer <token>`

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "perfil": {
    "nombre": "Juan",
    "apellido": "Pérez",
    "email": "usuario@ejemplo.com",
    "dni": "12345678",
    "saldo": 5000,
    "tipoUsuario": "normal",
    "vehiculos": []
  }
}
```

---

### 2. Actualizar Datos Básicos

**PUT** `/api/perfil/datos-basicos`

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "nombre": "Juan Carlos",
  "apellido": "Pérez González"
}
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "mensaje": "Datos actualizados exitosamente"
}
```

---

### 3. Cambiar Contraseña

**PUT** `/api/perfil/cambiar-contrasena`

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "passwordActual": "ContraseñaVieja123!",
  "passwordNueva": "ContraseñaNueva123!"
}
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "mensaje": "Contraseña cambiada exitosamente"
}
```

---

## 📊 Analytics

### 1. Recibir Métricas de Web Vitals

**POST** `/api/analytics/web-vitals`

**Body:**
```json
{
  "name": "LCP",
  "value": 1200,
  "id": "...",
  "timestamp": 1707312000000,
  "url": "http://localhost:3001/dashboard",
  "userAgent": "Mozilla/5.0..."
}
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "message": "Métrica recibida correctamente"
}
```

---

### 2. Recibir Errores de JavaScript

**POST** `/api/analytics/errors`

**Body:**
```json
{
  "message": "Uncaught TypeError...",
  "stack": "Error stack trace...",
  "timestamp": 1707312000000,
  "url": "http://localhost:3001/dashboard"
}
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "message": "Error recibido correctamente"
}
```

---

### 3. Obtener Estadísticas de Rendimiento

**GET** `/api/analytics/performance-stats`

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "data": {
    "avgLoadTime": 1200,
    "avgFCP": 800,
    "avgLCP": 1500,
    "avgFID": 50,
    "avgCLS": 0.05,
    "avgTTFB": 200,
    "totalPageViews": 1250,
    "errorRate": 0.02,
    "lastUpdated": "2026-02-07T10:00:00.000Z"
  }
}
```

---

## 🔍 SEO

### 1. Obtener Sitemap

**GET** `/sitemap.xml`

**Respuesta exitosa (200):**
- Content-Type: `application/xml`
- Sitemap XML del sitio

---

### 2. Obtener Robots.txt

**GET** `/robots.txt`

**Respuesta exitosa (200):**
- Content-Type: `text/plain`
- Archivo robots.txt

---

## 📝 Códigos de Estado HTTP

| Código | Significado |
|--------|-------------|
| 200 | OK - Solicitud exitosa |
| 201 | Created - Recurso creado exitosamente |
| 400 | Bad Request - Solicitud incorrecta |
| 401 | Unauthorized - No autorizado (token inválido o faltante) |
| 403 | Forbidden - Prohibido (no tiene permisos) |
| 404 | Not Found - Recurso no encontrado |
| 500 | Internal Server Error - Error del servidor |

---

## 🔒 Autenticación y Seguridad

### Flujo de Autenticación

1. **Registro:** Usuario se registra con email → Recibe email de confirmación
2. **Confirmación:** Usuario hace clic en link del email → Confirma email
3. **Contraseña:** Usuario establece contraseña → Recibe token JWT
4. **Login:** Usuario inicia sesión → Recibe token JWT
5. **Acceso:** Usuario usa token JWT en header `Authorization: Bearer <token>`

### Expiración de Tokens

- **Token JWT:** 7 días
- **Token de confirmación:** 24 horas
- **Token de recuperación:** 1 hora

---

## 📦 Colección de Postman

Para importar todos estos endpoints en Postman:

1. Crear nueva colección "Sistema Estacionamiento API"
2. Configurar variable de entorno `baseUrl` = `http://localhost:3000/api`
3. Configurar variable de entorno `token` = `<tu_jwt_token>`
4. Importar cada endpoint con su método HTTP, URL y body correspondiente

---

## 🎯 Testing

### Endpoints Públicos (No requieren autenticación)
- POST `/api/auth/registrar-con-email`
- GET `/api/auth/confirmar/:token`
- POST `/api/auth/login`
- POST `/api/auth/solicitar-recuperacion`
- GET `/api/precios/:tipoUsuario`
- GET `/sitemap.xml`
- GET `/robots.txt`

### Endpoints Autenticados (Requieren token JWT)
- Todos los demás endpoints

### Endpoints Solo Admin
- `/api/admin/*`
- `/api/precios` (POST, PUT, DELETE)
- `/api/configuracion-empresa/*`
- `/api/facturador/*`

---

## 🛠️ Mantenimiento y Soporte

Para reportar errores o solicitar nuevas funcionalidades, contactar con el equipo de desarrollo.

**Fecha de última actualización:** 7 de febrero de 2026
