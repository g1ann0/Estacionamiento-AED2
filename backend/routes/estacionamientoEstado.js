const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const Estacionamiento = require('../models/Estacionamiento');

router.get('/estado/:dominio', authMiddleware, async (req, res) => {
  try {
    const estacionamiento = await Estacionamiento.findOne({
      vehiculoDominio: req.params.dominio,
      estado: 'activo'
    });

    res.json({ estacionamiento });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al obtener el estado del estacionamiento' });
  }
});

module.exports = router;
