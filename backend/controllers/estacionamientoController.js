const Vehiculo = require('../models/Vehiculo');
const Estacionamiento = require('../models/Estacionamiento');
const Usuario = require('../models/Usuario');
const estadiaService = require('../services/estadiaService');
const { aTexto } = require('../utils/consultas');

const esMostrador = (req) => {
    const rol = req.usuarioActual?.rol ?? req.usuario?.rol;
    return rol === 'operador' || rol === 'admin';
};

// ¿Este dominio es del que pregunta? El mostrador ve cualquiera; un conductor, solo los suyos.
// Sin esta comprobación, `/estado/:dominio` era un buscador de patentes: cualquier cliente
// autenticado podía preguntar por una patente ajena y enterarse de si el auto está adentro,
// desde cuándo y con qué datos — que es exactamente la información que no le corresponde.
async function puedeVerDominio(req, dominio) {
    if (esMostrador(req)) return true;
    const vehiculo = await Vehiculo.findOne({ dominio }).select('usuario').lean();
    if (!vehiculo?.usuario) return false;
    const propietario = await Usuario.findById(vehiculo.usuario).select('dni').lean();
    return propietario?.dni === req.usuario?.dni;
}

const verificarEstacionamiento = async (req, res) => {
    try {
        const dominio = aTexto(req.params.dominio).trim().toUpperCase();
        const vehiculo = await Vehiculo.findOne({ dominio });

        if (!vehiculo) {
            return res.status(404).json({ mensaje: 'Vehículo no encontrado' });
        }

        if (!(await puedeVerDominio(req, dominio))) {
            return res.status(403).json({ mensaje: 'Este vehículo no es tuyo' });
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
        const dni = aTexto(req.body?.dni);
        const dominio = aTexto(req.body?.dominio).trim().toUpperCase();
        const { porton } = req.body ?? {};

        if (req.usuario.dni !== dni && !esMostrador(req)) {
            return res.status(403).json({ mensaje: 'No tenés permiso para iniciar un estacionamiento a nombre de otro usuario' });
        }
        if (!dominio) {
            return res.status(400).json({ mensaje: 'dominio es obligatorio' });
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

// Egreso por autoservicio. Dos agujeros que tenía y que no eran teóricos:
//
//   1. **No verificaba de quién era la estadía.** Con la patente de otro en el cuerpo, un
//      cliente cerraba la estadía ajena y le debitaba el saldo al titular.
//   2. **El medio de pago venía del cliente.** Mandando `medioPago: 'efectivo'` la estadía se
//      cerraba sin debitar saldo y sin turno de caja que lo respaldara —el canal `app` no exige
//      turno—, o sea salir gratis. En autoservicio no hay cajero que reciba efectivo: el único
//      medio posible es el saldo prepago, y por eso ya no se acepta lo que diga el request.
//
// El cobro por mostrador (efectivo/tarjeta/QR) tiene su propio endpoint, con operador
// autenticado y turno abierto: POST /api/estadias/egreso-manual.
const finalizarEstacionamiento = async (req, res, next) => {
    try {
        const dominio = aTexto(req.body?.dominio).trim().toUpperCase();
        if (!dominio) {
            return res.status(400).json({ mensaje: 'dominio es obligatorio' });
        }

        // La titularidad se resuelve contra la estadía activa, no contra el vehículo: la estadía
        // es la que dice a quién se le cobra (mismo criterio que usa el egreso). Si no hay
        // ninguna activa, se deja pasar para que el servicio distinga 404 de 409 como siempre.
        if (!esMostrador(req)) {
            const activa = await Estacionamiento
                .findOne({ vehiculoDominio: dominio, estado: 'activo' })
                .select('usuarioDNI')
                .lean();
            if (activa && activa.usuarioDNI !== req.usuario?.dni) {
                return res.status(403).json({ mensaje: 'Esta estadía no es tuya' });
            }
        }

        const resultado = await estadiaService.finalizarEstadia({
            dominio,
            medioPago: esMostrador(req) ? req.body?.medioPago ?? null : 'saldo_prepago'
        });

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
