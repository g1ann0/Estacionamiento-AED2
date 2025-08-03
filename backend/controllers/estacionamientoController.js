const Usuario = require('../models/Usuario');
const Vehiculo = require('../models/Vehiculo');
const Estacionamiento = require('../models/Estacionamiento');
const ConfiguracionPrecio = require('../models/ConfiguracionPrecio');

// Función auxiliar para obtener tarifa dinámica
const obtenerTarifa = async (usuario) => {
    try {
        // 1. Si el usuario tiene una tarifa específica asignada, usarla
        if (usuario.tarifaAsignada) {
            const tarifaEspecifica = await ConfiguracionPrecio.findById(usuario.tarifaAsignada);
            if (tarifaEspecifica && tarifaEspecifica.activo) {
                console.log(`Usando tarifa específica para usuario ${usuario.dni}: ${tarifaEspecifica.tipoUsuario} - $${tarifaEspecifica.precioPorHora}/hora`);
                return tarifaEspecifica.precioPorHora;
            }
        }

        // 2. Si no tiene tarifa específica, usar tarifa por defecto según tipo de usuario
        const tipoUsuario = usuario.asociado ? 'asociado' : 'no_asociado';
        const configuracion = await ConfiguracionPrecio.findOne({ 
            tipoUsuario: tipoUsuario,
            activo: true 
        });
        
        if (configuracion) {
            console.log(`Usando tarifa por defecto para usuario ${usuario.dni}: ${configuracion.tipoUsuario} - $${configuracion.precioPorHora}/hora`);
            return configuracion.precioPorHora;
        }

        // 3. Valores por defecto si no existe configuración
        const tarifaPorDefecto = usuario.asociado ? 250 : 500;
        console.log(`Usando tarifa por defecto fija para usuario ${usuario.dni}: $${tarifaPorDefecto}/hora`);
        return tarifaPorDefecto;
        
    } catch (error) {
        console.error('Error al obtener tarifa:', error);
        // Valores por defecto en caso de error
        const tarifaPorDefecto = usuario.asociado ? 250 : 500;
        console.log(`Error - usando tarifa por defecto para usuario ${usuario.dni}: $${tarifaPorDefecto}/hora`);
        return tarifaPorDefecto;
    }
};

const verificarEstacionamiento = async (req, res) => {
    try {
        const { dominio } = req.params;
        const vehiculo = await Vehiculo.findOne({ dominio });

        if (!vehiculo) {
            return res.status(404).json({ mensaje: 'Vehículo no encontrado' });
        }

        // Buscar estacionamiento activo
        const estacionamientoActivo = await Estacionamiento.findOne({
            vehiculoDominio: dominio,
            estado: 'activo'
        });

        if (estacionamientoActivo) {
            return res.status(200).json({ 
                mensaje: 'Estacionamiento activo encontrado',
                estacionamiento: estacionamientoActivo,
                vehiculo: vehiculo
            });
        }

        return res.status(200).json({ 
            mensaje: 'Vehículo disponible para estacionar',
            estacionamiento: null,
            vehiculo: vehiculo
        });

    } catch (error) {
        console.error('Error al verificar estacionamiento:', error);
        res.status(500).json({ mensaje: 'Error al verificar estacionamiento' });
    }
};

const iniciarEstacionamiento = async (req, res) => {
    try {
        const { dni, dominio, porton } = req.body;

        // Buscar el usuario activo y verificar saldo
        const usuario = await Usuario.findOne({ dni, activo: true })
            .populate('tarifaAsignada', 'tipoUsuario precioPorHora descripcion activo');
        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado o inactivo' });
        }

        // Verificar saldo disponible
        if (usuario.montoDisponible <= 0) {
            return res.status(400).json({ 
                mensaje: 'Saldo insuficiente. Por favor, recargue su saldo antes de estacionar.' 
            });
        }

        // Buscar el vehículo
        const vehiculo = await Vehiculo.findOne({ dominio });
        if (!vehiculo) {
            return res.status(404).json({ mensaje: 'Vehículo no encontrado' });
        }

        // Verificar si ya está activo
        if (vehiculo.estActivo) {
            return res.status(400).json({ 
                mensaje: 'Ya tiene un estacionamiento activo para este vehículo' 
            });
        }

        // Crear nuevo registro de estacionamiento
        const nuevoEstacionamiento = new Estacionamiento({
            usuarioDNI: dni,
            vehiculoDominio: dominio,
            tipoRegistro: usuario.asociado ? 'asociado' : 'normal',
            horaInicio: new Date(),
            porton: porton // Asegurarnos de que se guarde el portón
        });

        // Marcar el vehículo como activo y actualizar último ingreso
        const horaActual = new Date();
        vehiculo.estActivo = true;
        vehiculo.ultimoIngreso = horaActual;
        await vehiculo.save();

        await nuevoEstacionamiento.save();

        // Determinar tarifa según la configuración del usuario
        const tarifa = await obtenerTarifa(usuario);

        // Crear transacción de ingreso
        const Transaccion = require('../models/Transaccion');
        const nuevaTransaccion = new Transaccion({
            tipo: 'ingreso',
            usuario: usuario._id,
            vehiculo: {
                dominio: vehiculo.dominio,
                marca: vehiculo.marca,
                modelo: vehiculo.modelo,
                tipo: vehiculo.tipo
            },
            propietario: {
                dni: usuario.dni,
                nombre: usuario.nombre,
                apellido: usuario.apellido
            },
            porton,
            fechaHora: horaActual,
            tarifa: tarifa,
            montoTotal: 0
        });
        await nuevaTransaccion.save();

        res.status(200).json({
            mensaje: 'Estacionamiento iniciado correctamente',
            estacionamiento: nuevoEstacionamiento,
            transaccion: nuevaTransaccion
        });

    } catch (error) {
        console.error('Error al iniciar estacionamiento:', error);
        res.status(500).json({ mensaje: 'Error al iniciar estacionamiento' });
    }
};

const finalizarEstacionamiento = async (req, res) => {
    try {
        console.log('Iniciando finalizarEstacionamiento con body:', req.body);
        const { dni, dominio } = req.body;

        // Buscar el vehículo
        const vehiculo = await Vehiculo.findOne({ dominio });
        if (!vehiculo) {
            return res.status(404).json({ mensaje: 'Vehículo no encontrado' });
        }

        // Buscar el estacionamiento activo
        console.log('Buscando estacionamiento activo para dominio:', dominio);
        const estacionamiento = await Estacionamiento.findOne({
            vehiculoDominio: dominio,
            estado: 'activo'
        });
        console.log('Estacionamiento encontrado:', estacionamiento);

        if (!estacionamiento) {
            // Si no hay estacionamiento activo, asegurarse de que el vehículo esté marcado como inactivo
            if (vehiculo.estActivo) {
                vehiculo.estActivo = false;
                await vehiculo.save();
            }
            return res.status(404).json({ mensaje: 'No hay estacionamiento activo para este vehículo' });
        }

        // Verificar que tengamos el portón
        if (!estacionamiento.porton) {
            return res.status(400).json({ mensaje: 'Error: No se pudo determinar el portón del estacionamiento' });
        }

        // Calcular duración y monto
        const horaFin = new Date();
        const duracionMs = horaFin - estacionamiento.horaInicio;
        const duracionHorasReal = duracionMs / (1000 * 60 * 60); // Duración real en horas
        const duracionHoras = Math.ceil(duracionHorasReal); // Redondeamos hacia arriba para facturación
        
        // Buscar el usuario activo para determinar la tarifa y actualizar saldo
        const usuario = await Usuario.findOne({ dni, activo: true })
            .populate('tarifaAsignada', 'tipoUsuario precioPorHora descripcion activo');
        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado o inactivo' });
        }
        
        // Determinar tarifa según la configuración del usuario
        const tarifa = await obtenerTarifa(usuario);
        const montoTotal = duracionHoras * tarifa;

        // Verificar que el usuario tenga saldo suficiente
        if (usuario.montoDisponible < montoTotal) {
            return res.status(400).json({ 
                mensaje: 'Saldo insuficiente para finalizar el estacionamiento'
            });
        }

        // Actualizar el saldo del usuario
        usuario.montoDisponible -= montoTotal;
        await usuario.save();

        // Actualizar el estacionamiento
        estacionamiento.horaFin = horaFin;
        estacionamiento.duracionHorasReal = duracionHorasReal; // Guardamos la duración real
        estacionamiento.duracionHoras = duracionHoras; // Guardamos las horas facturadas
        estacionamiento.montoTotal = montoTotal;
        estacionamiento.estado = 'finalizado';
        await estacionamiento.save();

        // Marcar el vehículo como inactivo
        vehiculo.estActivo = false;
        await vehiculo.save();

        // Buscar y actualizar la transacción de ingreso correspondiente
        const Transaccion = require('../models/Transaccion');
        const transaccionIngreso = await Transaccion.findOne({
            'vehiculo.dominio': dominio,
            tipo: 'ingreso',
            estado: 'activo'
        });

        if (transaccionIngreso) {
            transaccionIngreso.estado = 'finalizado';
            await transaccionIngreso.save();
        }

        // Crear transacción de salida
        const nuevaTransaccion = new Transaccion({
            tipo: 'salida',
            usuario: usuario._id,
            vehiculo: {
                dominio: vehiculo.dominio,
                marca: vehiculo.marca,
                modelo: vehiculo.modelo,
                tipo: vehiculo.tipo
            },
            propietario: {
                dni: usuario.dni,
                nombre: usuario.nombre,
                apellido: usuario.apellido
            },
            porton: estacionamiento.porton,
            fechaHora: new Date(),
            tarifa: tarifa,
            montoTotal: montoTotal,
            duracionHorasReal: duracionHorasReal,
            duracionHoras: duracionHoras,
            duracion: `${duracionHoras} hora(s)`,
            estado: 'finalizado'
        });
        await nuevaTransaccion.save();

        res.status(200).json({
            mensaje: 'Estacionamiento finalizado correctamente',
            duracionHorasReal: duracionHorasReal,
            duracionHoras,
            montoTotal,
            montoDisponible: usuario.montoDisponible,
            estacionamiento,
            transaccionSalida: nuevaTransaccion,
            transaccionIngreso: transaccionIngreso // Incluir la transacción de ingreso actualizada
        });

    } catch (error) {
        console.error('Error al finalizar estacionamiento:', error);
        res.status(500).json({ mensaje: 'Error al finalizar estacionamiento' });
    }
};

module.exports = {
    verificarEstacionamiento,
    iniciarEstacionamiento,
    finalizarEstacionamiento
};
