const express = require('express');
const router = express.Router();
const AuditLog = require('../models/AuditLog');
const authMiddleware = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/requireRole');

// Logs de auditoría (solo admin).
// Montado en server.js como app.use('/api/admin/auditoria', ...) — la URL externa no cambia.
//
// Antes esta ruta consultaba cinco colecciones distintas, cada una con su propio nombre de
// campo para la fecha, para el actor y para el afectado, traía TODOS los registros de las
// cinco a memoria, los ordenaba en Node y recién ahí cortaba la página. Con una sola
// colección, el filtro, el orden y la paginación los resuelve la base.

// El tipo de log ya no es una colección: es el prefijo de la acción.
const PREFIJOS = {
  saldo: 'saldo_',
  vehiculo: 'vehiculo_',
  precio: 'precio_',
  configuracion: 'empresa_'
};

const tipoDeAccion = (accion = '') => {
  const encontrado = Object.entries(PREFIJOS).find(([, prefijo]) => accion.startsWith(prefijo));
  return encontrado ? encontrado[0] : 'general';
};

// Los campos donde tiene sentido buscar texto libre, ya unificados: antes había una lista
// distinta por colección porque cada una nombraba lo mismo a su manera.
const CAMPOS_BUSCABLES = [
  'entidad', 'entidadId', 'accion', 'motivo', 'ip', 'usuarioDni',
  'actor.dni', 'actor.nombre', 'actor.apellido',
  'afectado.dni', 'afectado.nombre', 'afectado.apellido'
];

router.get('/', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const {
      tipoLog = 'todos',
      fechaDesde,
      fechaHasta,
      busqueda = '',
      pagina = 1,
      limite = 20,
      ordenPor = 'fecha',
      orden = 'desc'
    } = req.query;

    const salto = (parseInt(pagina) - 1) * parseInt(limite);
    const limiteNum = parseInt(limite);
    const direccion = orden === 'desc' ? -1 : 1;

    const filtro = {};

    if (fechaDesde || fechaHasta) {
      filtro.fecha = {};
      if (fechaDesde) filtro.fecha.$gte = new Date(fechaDesde);
      if (fechaHasta) {
        const hasta = new Date(fechaHasta);
        hasta.setHours(23, 59, 59, 999);
        filtro.fecha.$lte = hasta;
      }
    }

    if (tipoLog !== 'todos') {
      if (tipoLog === 'general') {
        // "General" es todo lo que no cae en ninguna de las cuatro familias históricas:
        // ingresos, egresos, turnos, comprobantes.
        filtro.accion = { $not: new RegExp(`^(${Object.values(PREFIJOS).join('|')})`) };
      } else if (PREFIJOS[tipoLog]) {
        filtro.accion = { $regex: `^${PREFIJOS[tipoLog]}` };
      } else {
        return res.status(400).json({ mensaje: 'Tipo de log no válido' });
      }
    }

    if (busqueda) {
      filtro.$or = CAMPOS_BUSCABLES.map((campo) => ({
        [campo]: { $regex: busqueda, $options: 'i' }
      }));
    }

    const campoOrden = ordenPor === 'fecha' ? 'fecha' : ordenPor;

    const [registros, total, porTipo] = await Promise.all([
      AuditLog.find(filtro)
        .sort({ [campoOrden]: direccion })
        .skip(salto)
        .limit(limiteNum)
        .lean(),
      AuditLog.countDocuments(filtro),
      // Las estadísticas salen de una sola agregación en vez de cinco countDocuments.
      AuditLog.aggregate([{ $group: { _id: '$accion', cantidad: { $sum: 1 } } }])
    ]);

    const estadisticas = porTipo.reduce((acumulado, { _id, cantidad }) => {
      const clave = {
        saldo: 'logsSaldo',
        vehiculo: 'logsVehiculo',
        precio: 'logsPrecio',
        configuracion: 'logsConfiguracion',
        general: 'logsGenerales'
      }[tipoDeAccion(_id)];
      acumulado[clave] += cantidad;
      acumulado.totalLogs += cantidad;
      return acumulado;
    }, {
      totalLogs: 0,
      logsSaldo: 0,
      logsVehiculo: 0,
      logsPrecio: 0,
      logsConfiguracion: 0,
      logsGenerales: 0
    });

    res.json({
      logs: registros.map((registro) => ({ ...registro, tipoLog: tipoDeAccion(registro.accion) })),
      paginacion: {
        total,
        pagina: parseInt(pagina),
        limite: limiteNum,
        totalPaginas: Math.ceil(total / limiteNum) || 1
      },
      estadisticas
    });

  } catch (error) {
    console.error('Error al obtener logs de auditoría:', error);
    res.status(500).json({
      mensaje: 'Error interno del servidor',
      error: error.message
    });
  }
});

module.exports = router;
