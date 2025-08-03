const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Usuario = require('../models/Usuario');
const Vehiculo = require('../models/Vehiculo');
const ConfiguracionPrecio = require('../models/ConfiguracionPrecio');

// Configuración de la base de datos
const DB_URI = 'mongodb://127.0.0.1:27017/estacionamientoDB';

const usuariosData = [
  {
    dni: '12345678',
    nombre: 'Juan Carlos',
    apellido: 'Rodriguez',
    email: 'juan.rodriguez@email.com',
    password: 'password123',
    rol: 'cliente',
    asociado: true,
    montoDisponible: 5000,
    verificado: true,
    tipoTarifa: 'asociado'
  },
  {
    dni: '23456789',
    nombre: 'María',
    apellido: 'González',
    email: 'maria.gonzalez@email.com',
    password: 'password123',
    rol: 'cliente',
    asociado: false,
    montoDisponible: 3000,
    verificado: true,
    tipoTarifa: 'estudiantes'
  },
  {
    dni: '34567890',
    nombre: 'Pedro',
    apellido: 'López',
    email: 'pedro.lopez@email.com',
    password: 'password123',
    rol: 'cliente',
    asociado: false,
    montoDisponible: 2500,
    verificado: true,
    tipoTarifa: 'general'
  },
  {
    dni: '45678901',
    nombre: 'Ana',
    apellido: 'Martínez',
    email: 'ana.martinez@email.com',
    password: 'password123',
    rol: 'cliente',
    asociado: true,
    montoDisponible: 4500,
    verificado: true,
    tipoTarifa: 'asociado'
  },
  {
    dni: '56789012',
    nombre: 'Carlos',
    apellido: 'Fernández',
    email: 'carlos.fernandez@email.com',
    password: 'password123',
    rol: 'cliente',
    asociado: false,
    montoDisponible: 1500,
    verificado: true,
    tipoTarifa: 'estudiantes'
  },
  {
    dni: '67890123',
    nombre: 'Laura',
    apellido: 'Sánchez',
    email: 'laura.sanchez@email.com',
    password: 'password123',
    rol: 'cliente',
    asociado: false,
    montoDisponible: 3500,
    verificado: true,
    tipoTarifa: 'general'
  },
  {
    dni: '78901234',
    nombre: 'Roberto',
    apellido: 'García',
    email: 'roberto.garcia@email.com',
    password: 'password123',
    rol: 'cliente',
    asociado: true,
    montoDisponible: 6000,
    verificado: true,
    tipoTarifa: 'asociado'
  },
  {
    dni: '89012345',
    nombre: 'Sofía',
    apellido: 'Ruiz',
    email: 'sofia.ruiz@email.com',
    password: 'password123',
    rol: 'cliente',
    asociado: false,
    montoDisponible: 2000,
    verificado: true,
    tipoTarifa: 'estudiantes'
  },
  {
    dni: '90123456',
    nombre: 'Miguel',
    apellido: 'Torres',
    email: 'miguel.torres@email.com',
    password: 'password123',
    rol: 'cliente',
    asociado: false,
    montoDisponible: 4000,
    verificado: true,
    tipoTarifa: 'general'
  },
  {
    dni: '11111111',
    nombre: 'Lucía',
    apellido: 'Morales',
    email: 'lucia.morales@email.com',
    password: 'password123',
    rol: 'cliente',
    asociado: true,
    montoDisponible: 5500,
    verificado: true,
    tipoTarifa: 'asociado'
  }
];

const vehiculosData = [
  // Juan Carlos Rodriguez
  { usuarioDni: '12345678', dominio: 'ABC123', tipo: 'auto', marca: 'Toyota', modelo: 'Corolla', año: 2020 },
  { usuarioDni: '12345678', dominio: 'DEF456', tipo: 'moto', marca: 'Honda', modelo: 'CB 125', año: 2019 },
  
  // María González
  { usuarioDni: '23456789', dominio: 'GHI789', tipo: 'auto', marca: 'Ford', modelo: 'Focus', año: 2018 },
  
  // Pedro López
  { usuarioDni: '34567890', dominio: 'JKL012', tipo: 'auto', marca: 'Chevrolet', modelo: 'Onix', año: 2021 },
  { usuarioDni: '34567890', dominio: 'MNO345', tipo: 'moto', marca: 'Yamaha', modelo: 'YBR 125', año: 2020 },
  
  // Ana Martínez
  { usuarioDni: '45678901', dominio: 'PQR678', tipo: 'auto', marca: 'Volkswagen', modelo: 'Gol', año: 2019 },
  
  // Carlos Fernández
  { usuarioDni: '56789012', dominio: 'STU901', tipo: 'moto', marca: 'Honda', modelo: 'Wave', año: 2018 },
  
  // Laura Sánchez
  { usuarioDni: '67890123', dominio: 'VWX234', tipo: 'auto', marca: 'Renault', modelo: 'Sandero', año: 2020 },
  { usuarioDni: '67890123', dominio: 'YZA567', tipo: 'auto', marca: 'Peugeot', modelo: '208', año: 2021 },
  
  // Roberto García
  { usuarioDni: '78901234', dominio: 'BCD890', tipo: 'auto', marca: 'Fiat', modelo: 'Cronos', año: 2022 },
  { usuarioDni: '78901234', dominio: 'EFG123', tipo: 'moto', marca: 'Kawasaki', modelo: 'Ninja 300', año: 2021 },
  
  // Sofía Ruiz
  { usuarioDni: '89012345', dominio: 'HIJ456', tipo: 'moto', marca: 'Yamaha', modelo: 'FZ 16', año: 2019 },
  
  // Miguel Torres
  { usuarioDni: '90123456', dominio: 'KLM789', tipo: 'auto', marca: 'Nissan', modelo: 'Versa', año: 2020 },
  
  // Lucía Morales
  { usuarioDni: '11111111', dominio: 'NOP012', tipo: 'auto', marca: 'Hyundai', modelo: 'Accent', año: 2021 },
  { usuarioDni: '11111111', dominio: 'QRS345', tipo: 'moto', marca: 'Honda', modelo: 'CBR 250', año: 2022 }
];

async function conectarDB() {
  try {
    await mongoose.connect(DB_URI);
    console.log('✅ Conectado a MongoDB');
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error);
    process.exit(1);
  }
}

async function crearUsuarios() {
  try {
    console.log('\n📝 Creando usuarios...');
    
    // Obtener tarifas disponibles
    const tarifas = await ConfiguracionPrecio.find({});
    const tarifaMap = {};
    tarifas.forEach(tarifa => {
      tarifaMap[tarifa.tipoUsuario] = tarifa._id;
    });

    for (const userData of usuariosData) {
      // Verificar si el usuario ya existe
      const usuarioExistente = await Usuario.findOne({ dni: userData.dni });
      if (usuarioExistente) {
        console.log(`⚠️ Usuario ${userData.dni} ya existe, saltando...`);
        continue;
      }

      // Encriptar password
      const passwordHash = await bcrypt.hash(userData.password, 10);
      
      // Asignar tarifa según tipo
      const tarifaAsignada = tarifaMap[userData.tipoTarifa] || null;

      const nuevoUsuario = new Usuario({
        dni: userData.dni,
        nombre: userData.nombre,
        apellido: userData.apellido,
        email: userData.email,
        password: passwordHash,
        rol: userData.rol,
        asociado: userData.asociado,
        montoDisponible: userData.montoDisponible,
        verificado: userData.verificado,
        tarifaAsignada: tarifaAsignada,
        fechaRegistro: new Date(),
        activo: true
      });

      await nuevoUsuario.save();
      console.log(`✅ Usuario creado: ${userData.nombre} ${userData.apellido} (${userData.dni}) - Tarifa: ${userData.tipoTarifa}`);
    }
  } catch (error) {
    console.error('❌ Error creando usuarios:', error);
  }
}

async function crearVehiculos() {
  try {
    console.log('\n🚗 Creando vehículos...');

    for (const vehiculoData of vehiculosData) {
      // Verificar si el vehículo ya existe
      const vehiculoExistente = await Vehiculo.findOne({ dominio: vehiculoData.dominio });
      if (vehiculoExistente) {
        console.log(`⚠️ Vehículo ${vehiculoData.dominio} ya existe, saltando...`);
        continue;
      }

      // Buscar el usuario propietario
      const usuario = await Usuario.findOne({ dni: vehiculoData.usuarioDni });
      if (!usuario) {
        console.log(`❌ Usuario ${vehiculoData.usuarioDni} no encontrado para vehículo ${vehiculoData.dominio}`);
        continue;
      }

      const nuevoVehiculo = new Vehiculo({
        dominio: vehiculoData.dominio,
        tipo: vehiculoData.tipo,
        marca: vehiculoData.marca,
        modelo: vehiculoData.modelo,
        año: vehiculoData.año,
        usuario: usuario._id,
        fechaRegistro: new Date(),
        activo: true
      });

      await nuevoVehiculo.save();
      console.log(`✅ Vehículo creado: ${vehiculoData.dominio} (${vehiculoData.marca} ${vehiculoData.modelo}) - Propietario: ${usuario.nombre} ${usuario.apellido}`);
    }
  } catch (error) {
    console.error('❌ Error creando vehículos:', error);
  }
}

async function mostrarResumen() {
  try {
    console.log('\n📊 RESUMEN DE DATOS CREADOS:');
    
    const totalUsuarios = await Usuario.countDocuments({ activo: true });
    const totalVehiculos = await Vehiculo.countDocuments({ activo: true });
    const usuariosAsociados = await Usuario.countDocuments({ asociado: true, activo: true });
    const usuariosConTarifa = await Usuario.countDocuments({ tarifaAsignada: { $ne: null }, activo: true });

    console.log(`👥 Total usuarios: ${totalUsuarios}`);
    console.log(`🚗 Total vehículos: ${totalVehiculos}`);
    console.log(`🏆 Usuarios asociados: ${usuariosAsociados}`);
    console.log(`💰 Usuarios con tarifa específica: ${usuariosConTarifa}`);

    // Mostrar distribución por tipo de tarifa
    console.log('\n📈 Distribución de tarifas:');
    const tarifas = await ConfiguracionPrecio.find({});
    for (const tarifa of tarifas) {
      const count = await Usuario.countDocuments({ tarifaAsignada: tarifa._id, activo: true });
      console.log(`   ${tarifa.tipoUsuario}: ${count} usuarios (${tarifa.precioPorHora}/hora)`);
    }

    // Mostrar distribución por tipo de vehículo
    console.log('\n🚙 Distribución de vehículos:');
    const autos = await Vehiculo.countDocuments({ tipo: 'auto', activo: true });
    const motos = await Vehiculo.countDocuments({ tipo: 'moto', activo: true });
    console.log(`   Autos: ${autos}`);
    console.log(`   Motos: ${motos}`);

  } catch (error) {
    console.error('❌ Error generando resumen:', error);
  }
}

async function main() {
  console.log('🚀 Iniciando seed de datos de producción...\n');
  
  await conectarDB();
  await crearUsuarios();
  await crearVehiculos();
  await mostrarResumen();
  
  console.log('\n✅ Seed completado exitosamente!');
  console.log('\n💡 Credenciales para todos los usuarios:');
  console.log('   📧 Email: [nombre.apellido]@email.com');
  console.log('   🔑 Password: password123');
  console.log('\n🔗 Ejemplos de login:');
  console.log('   • juan.rodriguez@email.com / password123');
  console.log('   • maria.gonzalez@email.com / password123');
  console.log('   • admin@estacionamiento.com / admin123 (admin)');
  
  mongoose.connection.close();
}

main().catch(console.error);
