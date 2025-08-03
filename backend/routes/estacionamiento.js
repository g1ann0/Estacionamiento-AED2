const express = require('express');
const router = express.Router();
const { 
    verificarEstacionamiento,
    iniciarEstacionamiento,
    finalizarEstacionamiento 
} = require('../controllers/estacionamientoController');
const authMiddleware = require('../middlewares/authMiddleware');

// Verificar estado de estacionamiento
router.get('/estado/:dominio', authMiddleware, verificarEstacionamiento);

// Iniciar estacionamiento
router.post('/iniciar', authMiddleware, iniciarEstacionamiento);

// Finalizar estacionamiento
router.post('/finalizar', authMiddleware, finalizarEstacionamiento);

module.exports = router;
