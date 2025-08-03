const express = require('express');
const router = express.Router();
const Estacionamiento = require('../models/Estacionamiento');
const Vehiculo = require('../models/Vehiculo');
const authMiddleware = require('../middlewares/authMiddleware');

// Obtener estado actual de un vehículo
router.get('/estado/:dominio', authMiddleware, async (req, res) => {
    try {
        const { dominio } = req.params;

        // Buscar el vehículo
        const vehiculo = await Vehiculo.findOne({ dominio });
        if (!vehiculo) {
            return res.status(404).json({ mensaje: 'Vehículo no encontrado' });
        }

        // Buscar si tiene un estacionamiento activo
        const estacionamiento = await Estacionamiento.findOne({
            vehiculoDominio: dominio,
            estado: 'activo'
        });

        // Si tiene estacionamiento activo pero el vehículo no está marcado como activo,
        // actualizamos el estado del vehículo
        if (estacionamiento && !vehiculo.estActivo) {
            vehiculo.estActivo = true;
            await vehiculo.save();
        }

        // Si no tiene estacionamiento activo pero el vehículo está marcado como activo,
        // corregimos el estado del vehículo
        if (!estacionamiento && vehiculo.estActivo) {
            vehiculo.estActivo = false;
            await vehiculo.save();
        }

        return res.status(200).json({
            estActivo: vehiculo.estActivo,
            estacionamiento: estacionamiento
        });

    } catch (error) {
        console.error('Error al verificar estado:', error);
        res.status(500).json({ mensaje: 'Error al verificar estado del vehículo' });
    }
});

module.exports = router;
