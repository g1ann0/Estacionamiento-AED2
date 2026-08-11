const Vehiculo = require('../models/Vehiculo');
const Estacionamiento = require('../models/Estacionamiento');
const estadiaService = require('../services/estadiaService');

const verificarEstacionamiento = async (req, res) => {
    try {
        const { dominio } = req.params;
        const vehiculo = await Vehiculo.findOne({ dominio });

        if (!vehiculo) {
            return res.status(404).json({ mensaje: 'Vehículo no encontrado' });
        }

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

const iniciarEstacionamiento = async (req, res, next) => {
    try {
        const { dni, dominio, porton } = req.body;

        if (req.usuario.dni !== dni && req.usuario.rol !== 'admin') {
            return res.status(403).json({ mensaje: 'No tenés permiso para iniciar un estacionamiento a nombre de otro usuario' });
        }

        const { estacionamiento, transaccion } = await estadiaService.iniciarEstadia({ dni, dominio, porton });

        res.status(200).json({
            mensaje: 'Estacionamiento iniciado correctamente',
            estacionamiento,
            transaccion
        });
    } catch (error) {
        next(error);
    }
};

const finalizarEstacionamiento = async (req, res, next) => {
    try {
        const { dominio, medioPago } = req.body;

        const resultado = await estadiaService.finalizarEstadia({ dominio, medioPago });

        res.status(200).json({
            mensaje: 'Estacionamiento finalizado correctamente',
            ...resultado
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    verificarEstacionamiento,
    iniciarEstacionamiento,
    finalizarEstacionamiento
};
