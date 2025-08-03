const Vehiculo = require('../models/Vehiculo');
const Usuario = require('../models/Usuario');

const agregarVehiculo = async (req, res) => {
  try {
    const { dni, nuevoVehiculo } = req.body;

    // Verificar que tengamos todos los datos necesarios
    if (!dni || !nuevoVehiculo) {
      return res.status(400).json({ mensaje: 'Faltan datos requeridos' });
    }

    // Verificar que el vehículo tenga todos los campos necesarios
    const { dominio, tipo, marca, modelo, año } = nuevoVehiculo;
    if (!dominio || !tipo || !marca || !modelo || !año) {
      return res.status(400).json({ mensaje: 'Faltan datos del vehículo' });
    }

        // Buscar el usuario por DNI
        const usuario = await Usuario.findOne({ dni });

        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        }

        // Verificar que el usuario esté verificado
        if (!usuario.verificado) {
            return res.status(400).json({ mensaje: 'El usuario no está verificado' });
        }

        // Verificar que el usuario que hace la petición sea el mismo del DNI o sea admin
        if (req.usuario.dni !== dni && req.usuario.rol !== 'admin') {
            return res.status(403).json({ mensaje: 'No tienes permiso para agregar vehículos a este usuario' });
        }

        // Verificar si ya existe un vehículo con ese dominio
        const vehiculoExistente = await Vehiculo.findOne({ 
            dominio: nuevoVehiculo.dominio.toUpperCase() 
        });
        if (vehiculoExistente) {
            return res.status(400).json({ mensaje: 'Ya existe un vehículo con ese dominio' });
        }

        // Crear el nuevo vehículo
        const vehiculo = new Vehiculo({
            ...nuevoVehiculo,
            dominio: nuevoVehiculo.dominio.toUpperCase(),
            usuario: usuario._id
        });
        await vehiculo.save();

        // Verificar si el vehículo ya está en el array del usuario (evitar duplicados)
        const vehiculoYaEnArray = usuario.vehiculos.find(v => v.dominio === vehiculo.dominio);
        if (!vehiculoYaEnArray) {
            // Agregar el vehículo al array de vehículos del usuario solo si no existe
            usuario.vehiculos.push({
                dominio: vehiculo.dominio,
                tipo: vehiculo.tipo,
                marca: vehiculo.marca,
                modelo: vehiculo.modelo,
                año: vehiculo.año
            });
            await usuario.save();
        }

        return res.status(200).json({
            mensaje: 'Vehículo agregado correctamente',
            vehiculo: {
                marca: vehiculo.marca,
                modelo: vehiculo.modelo,
                dominio: vehiculo.dominio,
                tipo: vehiculo.tipo,
                año: vehiculo.año
            }
        });

    } catch (error) {
        console.error('Error al crear vehículo:', error);
        return res.status(500).json({
            mensaje: 'Error al agregar el vehículo',
            error: error.message
        });
    }
};

const obtenerVehiculosPorUsuario = async (req, res) => {
    try {
        const { dni } = req.params;
        const usuario = await Usuario.findOne({ dni });
        
        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        }

        res.json(usuario.vehiculos);
    } catch (error) {
        console.error('Error al obtener vehículos:', error);
        res.status(500).json({ 
            mensaje: 'Error al obtener vehículos',
            error: error.message 
        });
    }
};

const eliminarVehiculo = async (req, res) => {
    try {
        const { dni, dominio } = req.params;

        // Buscar el usuario
        const usuario = await Usuario.findOne({ dni });
        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        }

        // Verificar permisos
        if (req.usuario.dni !== dni && req.usuario.rol !== 'admin') {
            return res.status(403).json({ mensaje: 'No tienes permiso para eliminar vehículos de este usuario' });
        }

        // Eliminar el vehículo de la colección de vehículos
        const resultado = await Vehiculo.deleteOne({ dominio: dominio.toUpperCase(), usuario: usuario._id });
        if (resultado.deletedCount === 0) {
            return res.status(404).json({ mensaje: 'Vehículo no encontrado' });
        }

        // Eliminar el vehículo del array de vehículos del usuario
        usuario.vehiculos = usuario.vehiculos.filter(v => v.dominio !== dominio.toUpperCase());
        await usuario.save();

        res.json({ mensaje: 'Vehículo eliminado correctamente' });
    } catch (error) {
        console.error('Error al eliminar vehículo:', error);
        res.status(500).json({ 
            mensaje: 'Error al eliminar el vehículo',
            error: error.message 
        });
    }
};

const modificarVehiculo = async (req, res) => {
    try {
        const { dni, dominio } = req.params;
        const datosActualizados = req.body;

        // Buscar el usuario
        const usuario = await Usuario.findOne({ dni });
        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        }

        // Verificar permisos
        if (req.usuario.dni !== dni && req.usuario.rol !== 'admin') {
            return res.status(403).json({ mensaje: 'No tienes permiso para modificar vehículos de este usuario' });
        }

        // Actualizar el vehículo en la colección de vehículos
        const vehiculo = await Vehiculo.findOneAndUpdate(
            { dominio: dominio.toUpperCase(), usuario: usuario._id },
            { ...datosActualizados },
            { new: true }
        );

        if (!vehiculo) {
            return res.status(404).json({ mensaje: 'Vehículo no encontrado' });
        }

        // Actualizar el vehículo en el array de vehículos del usuario
        const indice = usuario.vehiculos.findIndex(v => v.dominio === dominio.toUpperCase());
        if (indice !== -1) {
            // Actualizar el vehículo existente
            usuario.vehiculos[indice] = {
                dominio: vehiculo.dominio,
                tipo: vehiculo.tipo,
                marca: vehiculo.marca,
                modelo: vehiculo.modelo,
                año: vehiculo.año
            };
        } else {
            // Si por alguna razón no está en el array, agregarlo (no debería pasar)
            usuario.vehiculos.push({
                dominio: vehiculo.dominio,
                tipo: vehiculo.tipo,
                marca: vehiculo.marca,
                modelo: vehiculo.modelo,
                año: vehiculo.año
            });
        }
        
        // Eliminar duplicados por dominio (función utilitaria)
        const vehiculosUnicos = [];
        const dominiosVistos = new Set();
        for (const veh of usuario.vehiculos) {
            if (!dominiosVistos.has(veh.dominio)) {
                dominiosVistos.add(veh.dominio);
                vehiculosUnicos.push(veh);
            }
        }
        usuario.vehiculos = vehiculosUnicos;
        
        await usuario.save();

        res.json({
            mensaje: 'Vehículo actualizado correctamente',
            vehiculo: {
                marca: vehiculo.marca,
                modelo: vehiculo.modelo,
                dominio: vehiculo.dominio,
                tipo: vehiculo.tipo,
                año: vehiculo.año
            }
        });
    } catch (error) {
        console.error('Error al modificar vehículo:', error);
        res.status(500).json({ 
            mensaje: 'Error al modificar el vehículo',
            error: error.message 
        });
    }
};

// Función utilitaria para limpiar duplicados en el array de vehículos de un usuario
const limpiarDuplicadosVehiculos = async (req, res) => {
    try {
        const { dni } = req.params;

        // Buscar el usuario
        const usuario = await Usuario.findOne({ dni });
        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        }

        // Verificar permisos (solo el usuario o admin pueden limpiar)
        if (req.usuario.dni !== dni && req.usuario.rol !== 'admin') {
            return res.status(403).json({ mensaje: 'No tienes permiso para modificar este usuario' });
        }

        // Contar duplicados antes de limpiar
        const vehiculosOriginales = usuario.vehiculos.length;

        // Eliminar duplicados por dominio
        const vehiculosUnicos = [];
        const dominiosVistos = new Set();
        
        for (const vehiculo of usuario.vehiculos) {
            if (!dominiosVistos.has(vehiculo.dominio)) {
                dominiosVistos.add(vehiculo.dominio);
                vehiculosUnicos.push(vehiculo);
            }
        }

        usuario.vehiculos = vehiculosUnicos;
        await usuario.save();

        const vehiculosLimpiados = usuario.vehiculos.length;
        const duplicadosEliminados = vehiculosOriginales - vehiculosLimpiados;

        res.json({
            mensaje: 'Duplicados eliminados correctamente',
            vehiculosOriginales,
            vehiculosLimpiados,
            duplicadosEliminados,
            vehiculos: usuario.vehiculos
        });

    } catch (error) {
        console.error('Error al limpiar duplicados:', error);
        res.status(500).json({ 
            mensaje: 'Error al limpiar duplicados',
            error: error.message 
        });
    }
};

module.exports = {
    agregarVehiculo,
    obtenerVehiculosPorUsuario,
    eliminarVehiculo,
    modificarVehiculo,
    limpiarDuplicadosVehiculos
};