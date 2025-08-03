const Usuario = require('../models/Usuario');
const ConfiguracionPrecio = require('../models/ConfiguracionPrecio');
const ConfiguracionEmpresa = require('../models/ConfiguracionEmpresa');
const bcrypt = require('bcryptjs');

/**
 * Función para inicializar datos por defecto del sistema
 * Se ejecuta automáticamente al iniciar el servidor si no existen datos
 */
const inicializarDatosPorDefecto = async () => {
  try {
    console.log('🔄 Verificando datos iniciales del sistema...');

    // 1. Crear usuario administrador por defecto
    await crearAdminPorDefecto();
    
    // 2. Crear configuración de precios por defecto
    await crearPreciosPorDefecto();
    
    // 3. Crear configuración de empresa por defecto
    await crearConfiguracionEmpresaPorDefecto();

    console.log('✅ Sistema inicializado correctamente con datos por defecto');
    
  } catch (error) {
    console.error('❌ Error al inicializar datos por defecto:', error);
  }
};

/**
 * Crear usuario administrador por defecto
 */
const crearAdminPorDefecto = async () => {
  try {
    // Verificar si ya existe un admin
    const adminExistente = await Usuario.findOne({ rol: 'admin' });
    
    if (!adminExistente) {
      const passwordHash = await bcrypt.hash('admin123', 10);
      
      const adminDefault = new Usuario({
        dni: '12345678',
        nombre: 'Administrador',
        apellido: 'Sistema',
        email: 'admin@estacionamiento.com',
        password: passwordHash,
        rol: 'admin',
        asociado: true,
        montoDisponible: 0,
        verificado: true,
        vehiculos: []
      });

      await adminDefault.save();
      console.log('👤 Usuario administrador creado: admin@estacionamiento.com / admin123');
    }
  } catch (error) {
    console.error('Error creando admin por defecto:', error);
  }
};

/**
 * Crear configuración de precios por defecto
 */
const crearPreciosPorDefecto = async () => {
  try {
    const preciosExistentes = await ConfiguracionPrecio.find();
    
    if (preciosExistentes.length === 0) {
      const preciosDefault = [
        {
          tipoUsuario: 'asociado',
          precioPorHora: 250,
          descripcion: 'Precio preferencial para usuarios asociados',
          actualizadoPor: 'Sistema',
          activo: true
        },
        {
          tipoUsuario: 'no_asociado', 
          precioPorHora: 500,
          descripcion: 'Precio estándar para usuarios no asociados',
          actualizadoPor: 'Sistema',
          activo: true
        }
      ];
      
      await ConfiguracionPrecio.insertMany(preciosDefault);
      console.log('💰 Configuración de precios creada: Asociados $250/h, No asociados $500/h');
    }
  } catch (error) {
    console.error('Error creando precios por defecto:', error);
  }
};

/**
 * Crear configuración de empresa por defecto (ARCA)
 */
const crearConfiguracionEmpresaPorDefecto = async () => {
  try {
    const configExistente = await ConfiguracionEmpresa.findOne();
    
    if (!configExistente) {
      const configDefault = new ConfiguracionEmpresa({
        // Datos básicos de la empresa
        razonSocial: 'ESTACIONAMIENTO AE2 S.R.L.',
        cuit: '20-12345678-9',
        inicioActividades: new Date('2025-01-01'),
        condicionIva: 'IVA Responsable Inscripto',
        
        // Domicilio fiscal
        domicilio: {
          calle: 'Av. Corrientes',
          numero: '1234',
          piso: '',
          departamento: '',
          codigoPostal: 'C1043',
          localidad: 'Capital Federal',
          provincia: 'Ciudad Autónoma de Buenos Aires'
        },
        
        // Configuración de facturación
        puntoVenta: '00001',
        
        // Datos de contacto
        contacto: {
          telefono: '+54 11 4000-0000',
          email: 'admin@estacionamiento.com',
          sitioWeb: 'www.estacionamientoae2.com.ar'
        },
        
        // Configuración ARCA específica
        arca: {
          certificadoDigital: {
            activo: false,
            alias: 'ESTACIONAMIENTO_AE2'
          },
          cae: {
            solicitudAutomatica: true,
            validezDias: 10
          },
          limitesAnulacion: {
            diasMaximos: 15,
            requiereMotivo: true
          }
        },
        
        // Numeración
        numeracion: {
          proximaFactura: 1,
          reseteoAnual: false
        },
        
        // Estado
        activo: true,
        fechaCreacion: new Date(),
        fechaUltimaActualizacion: new Date()
      });

      await configDefault.save();
      console.log('🏢 Configuración de empresa creada con datos ARCA por defecto');
      console.log('   - CUIT: 20-12345678-9');
      console.log('   - Punto de venta: 00001');
      console.log('   - Validación ARCA habilitada (15 días)');
    }
  } catch (error) {
    console.error('Error creando configuración de empresa:', error);
  }
};

/**
 * Crear usuario de prueba (opcional)
 */
const crearUsuarioPrueba = async () => {
  try {
    const usuarioExistente = await Usuario.findOne({ dni: '87654321' });
    
    if (!usuarioExistente) {
      const passwordHash = await bcrypt.hash('user123', 10);
      
      const usuarioDefault = new Usuario({
        dni: '87654321',
        nombre: 'Usuario',
        apellido: 'Prueba',
        email: 'usuario@test.com',
        password: passwordHash,
        rol: 'cliente',
        asociado: false,
        montoDisponible: 1000,
        verificado: true,
        vehiculos: [
          {
            dominio: 'ABC123',
            tipo: 'auto',
            marca: 'Toyota',
            modelo: 'Corolla',
            año: 2020
          }
        ]
      });

      await usuarioDefault.save();
      console.log('👤 Usuario de prueba creado: usuario@test.com / user123');
    }
  } catch (error) {
    console.error('Error creando usuario de prueba:', error);
  }
};

/**
 * Función para resetear todos los datos (uso en desarrollo)
 */
const resetearSistema = async () => {
  try {
    console.log('⚠️  RESETEANDO SISTEMA - Eliminando todos los datos...');
    
    await Usuario.deleteMany({});
    await ConfiguracionPrecio.deleteMany({});
    await ConfiguracionEmpresa.deleteMany({});
    
    console.log('🗑️  Datos eliminados. Reinicializando...');
    await inicializarDatosPorDefecto();
    await crearUsuarioPrueba();
    
    console.log('✅ Sistema reseteado y reinicializado correctamente');
  } catch (error) {
    console.error('❌ Error al resetear sistema:', error);
  }
};

module.exports = {
  inicializarDatosPorDefecto,
  crearAdminPorDefecto,
  crearPreciosPorDefecto,
  crearConfiguracionEmpresaPorDefecto,
  crearUsuarioPrueba,
  resetearSistema
};
