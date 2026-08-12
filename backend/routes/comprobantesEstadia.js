const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/requireRole');
const { listar, obtener, descargarPdf, enviarPorMail, estadoFiscal, reintentarCae, reconciliarFiscal } = require('../controllers/comprobanteEstadiaController');

// Comprobantes de la ESTADÍA cobrada. No confundir con /api/comprobantes, que son los
// comprobantes de recarga de saldo (funcionalidad discontinuada, en modo consulta).
router.use(authMiddleware);

// El PDF lo puede bajar el mostrador y también el cliente al que se le emitió: la app le
// promete sus comprobantes, y un comprobante que el titular no puede descargar no es suyo.
// La verificación de titularidad la hace el controlador contra el DNI del token.
router.get('/:id/pdf', descargarPdf);

// El estado de la integración fiscal va antes de '/:id' para que 'fiscal' no se lea como un id.
router.get('/fiscal/estado', requireRole('operador', 'admin'), estadoFiscal);
router.post('/fiscal/reconciliar', requireRole('admin'), reconciliarFiscal);
router.post('/:id/reintentar-cae', requireRole('admin'), reintentarCae);

router.get('/', requireRole('operador', 'admin'), listar);
router.get('/:id', requireRole('operador', 'admin'), obtener);
router.post('/:id/enviar', requireRole('operador', 'admin'), enviarPorMail);

module.exports = router;
