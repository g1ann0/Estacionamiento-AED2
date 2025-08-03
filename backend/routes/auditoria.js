const express = require('express');
const router = express.Router();
const LogSaldo = require('../models/LogSaldo');
const LogVehiculo = require('../models/LogVehiculo');
const LogPrecio = require('../models/LogPrecio');
const LogConfiguracionEmpresa = require('../models/LogConfiguracionEmpresa');
const authMiddleware = require('../middlewares/authMiddleware');

// Endpoint para obtener logs de auditoría
router.get('/auditoria', authMiddleware, async (req, res) => {
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

    const skip = (parseInt(pagina) - 1) * parseInt(limite);
    const limitNum = parseInt(limite);
    const sortOrder = orden === 'desc' ? -1 : 1;

    // Filtros de fecha
    const filtroFecha = {};
    if (fechaDesde || fechaHasta) {
      filtroFecha.fechaModificacion = {};
      if (fechaDesde) {
        filtroFecha.fechaModificacion.$gte = new Date(fechaDesde);
      }
      if (fechaHasta) {
        const fechaHastaDate = new Date(fechaHasta);
        fechaHastaDate.setHours(23, 59, 59, 999);
        filtroFecha.fechaModificacion.$lte = fechaHastaDate;
      }
    }

    // Función para crear filtro de búsqueda
    const crearFiltroBusqueda = (campos) => {
      if (!busqueda) return {};
      
      const condiciones = [];
      campos.forEach(campo => {
        if (campo.includes('.')) {
          // Para campos anidados
          const obj = {};
          obj[campo] = { $regex: busqueda, $options: 'i' };
          condiciones.push(obj);
        } else {
          const obj = {};
          obj[campo] = { $regex: busqueda, $options: 'i' };
          condiciones.push(obj);
        }
      });
      
      return condiciones.length > 0 ? { $or: condiciones } : {};
    };

    let logs = [];
    let total = 0;
    let estadisticas = {
      totalLogs: 0,
      logsSaldo: 0,
      logsVehiculo: 0,
      logsPrecio: 0,
      logsConfiguracion: 0
    };

    // Obtener estadísticas generales
    const [countSaldo, countVehiculo, countPrecio, countConfiguracion] = await Promise.all([
      LogSaldo.countDocuments(),
      LogVehiculo.countDocuments(),
      LogPrecio.countDocuments(),
      LogConfiguracionEmpresa.countDocuments()
    ]);

    estadisticas = {
      totalLogs: countSaldo + countVehiculo + countPrecio + countConfiguracion,
      logsSaldo: countSaldo,
      logsVehiculo: countVehiculo,
      logsPrecio: countPrecio,
      logsConfiguracion: countConfiguracion
    };

    if (tipoLog === 'todos') {
      // Obtener logs de todos los tipos
      const promesasLogs = [];

      // Logs de Saldo
      const filtroSaldo = { ...filtroFecha, ...crearFiltroBusqueda([
        'usuarioAfectado.dni', 'usuarioAfectado.nombre', 'usuarioAfectado.apellido',
        'modificadoPor.dni', 'modificadoPor.nombre', 'modificadoPor.apellido',
        'motivo', 'ip', 'observaciones'
      ])};
      
      promesasLogs.push(
        LogSaldo.find(filtroSaldo)
          .sort({ fechaModificacion: sortOrder })
          .lean()
          .then(logs => logs.map(log => ({ ...log, tipoLog: 'saldo' })))
      );

      // Logs de Vehículo
      const filtroVehiculo = { ...filtroFecha, ...crearFiltroBusqueda([
        'vehiculo.dominio', 'vehiculo.marca', 'vehiculo.modelo',
        'propietarioAnterior.dni', 'propietarioAnterior.nombre',
        'propietarioNuevo.dni', 'propietarioNuevo.nombre',
        'modificadoPor.dni', 'modificadoPor.nombre', 'modificadoPor.apellido',
        'motivo', 'ip'
      ])};
      
      promesasLogs.push(
        LogVehiculo.find(filtroVehiculo)
          .sort({ fechaModificacion: sortOrder })
          .lean()
          .then(logs => logs.map(log => ({ ...log, tipoLog: 'vehiculo' })))
      );

      // Logs de Precio
      const filtroPrecio = { ...filtroFecha, ...crearFiltroBusqueda([
        'tipoUsuario', 'descripcionAnterior', 'descripcionNueva',
        'modificadoPor.dni', 'modificadoPor.nombre', 'modificadoPor.apellido',
        'motivo', 'ip'
      ])};
      
      promesasLogs.push(
        LogPrecio.find(filtroPrecio)
          .sort({ fechaModificacion: sortOrder })
          .lean()
          .then(logs => logs.map(log => ({ ...log, tipoLog: 'precio' })))
      );

      // Logs de Configuración
      const filtroConfiguracion = { ...filtroFecha, ...crearFiltroBusqueda([
        'usuarioInfo.dni', 'usuarioInfo.nombre', 'usuarioInfo.apellido',
        'configuracionAnterior.nombre', 'configuracionNueva.nombre',
        'motivo', 'ip'
      ])};
      
      promesasLogs.push(
        LogConfiguracionEmpresa.find(filtroConfiguracion)
          .sort({ fechaModificacion: sortOrder })
          .lean()
          .then(logs => logs.map(log => ({ ...log, tipoLog: 'configuracion' })))
      );

      // Obtener todos los logs y combinarlos
      const resultadosLogs = await Promise.all(promesasLogs);
      const todosLogs = resultadosLogs.flat();

      // Ordenar todos los logs combinados
      todosLogs.sort((a, b) => {
        const fechaA = new Date(a.fechaModificacion || a.fecha);
        const fechaB = new Date(b.fechaModificacion || b.fecha);
        return sortOrder === -1 ? fechaB - fechaA : fechaA - fechaB;
      });

      total = todosLogs.length;
      logs = todosLogs.slice(skip, skip + limitNum);

    } else {
      // Obtener logs de un tipo específico
      let Model;
      let filtro = filtroFecha;
      
      switch (tipoLog) {
        case 'saldo':
          Model = LogSaldo;
          filtro = { ...filtroFecha, ...crearFiltroBusqueda([
            'usuarioAfectado.dni', 'usuarioAfectado.nombre', 'usuarioAfectado.apellido',
            'modificadoPor.dni', 'modificadoPor.nombre', 'modificadoPor.apellido',
            'motivo', 'ip', 'observaciones'
          ])};
          break;
        case 'vehiculo':
          Model = LogVehiculo;
          filtro = { ...filtroFecha, ...crearFiltroBusqueda([
            'vehiculo.dominio', 'vehiculo.marca', 'vehiculo.modelo',
            'propietarioAnterior.dni', 'propietarioAnterior.nombre',
            'propietarioNuevo.dni', 'propietarioNuevo.nombre',
            'modificadoPor.dni', 'modificadoPor.nombre', 'modificadoPor.apellido',
            'motivo', 'ip'
          ])};
          break;
        case 'precio':
          Model = LogPrecio;
          filtro = { ...filtroFecha, ...crearFiltroBusqueda([
            'tipoUsuario', 'descripcionAnterior', 'descripcionNueva',
            'modificadoPor.dni', 'modificadoPor.nombre', 'modificadoPor.apellido',
            'motivo', 'ip'
          ])};
          break;
        case 'configuracion':
          Model = LogConfiguracionEmpresa;
          filtro = { ...filtroFecha, ...crearFiltroBusqueda([
            'usuarioInfo.dni', 'usuarioInfo.nombre', 'usuarioInfo.apellido',
            'configuracionAnterior.nombre', 'configuracionNueva.nombre',
            'motivo', 'ip'
          ])};
          break;
        default:
          return res.status(400).json({ mensaje: 'Tipo de log no válido' });
      }

      const sortField = ordenPor === 'fecha' ? 'fechaModificacion' : ordenPor;
      const sortObj = {};
      sortObj[sortField] = sortOrder;

      [logs, total] = await Promise.all([
        Model.find(filtro)
          .sort(sortObj)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Model.countDocuments(filtro)
      ]);

      logs = logs.map(log => ({ ...log, tipoLog }));
    }

    const totalPaginas = Math.ceil(total / limitNum);

    res.json({
      logs,
      paginacion: {
        total,
        pagina: parseInt(pagina),
        limite: limitNum,
        totalPaginas
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
