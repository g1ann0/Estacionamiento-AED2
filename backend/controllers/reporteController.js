// Reportes. Solo admin, y a diferencia de todo lo que ve el operador, acá sí hay plata
// agregada: la caja ciega protege al que cuenta el cajón, no al dueño que revisa después.
//
// Las dos agregaciones corren en la base, no en Node: son sobre colecciones que crecen con
// cada cobro y traerlas enteras a memoria para sumarlas en el servidor es la forma más
// rápida de que el reporte se vuelva inusable a los seis meses.

const MovimientoCaja = require('../models/MovimientoCaja');
const Estacionamiento = require('../models/Estacionamiento');
const Turno = require('../models/Turno');
const { construirFiltroDeTurnos } = require('../utils/filtroTurnos');

// Rango por defecto: los últimos 30 días. Un reporte sin filtros que barre toda la historia
// no responde ninguna pregunta real y cuesta lo mismo que la peor consulta posible.
const resolverRango = ({ desde, hasta }) => {
  const fin = hasta ? new Date(`${hasta}T23:59:59.999`) : new Date();
  const inicio = desde ? new Date(desde) : new Date(fin.getTime() - 29 * 24 * 60 * 60 * 1000);
  inicio.setHours(0, 0, 0, 0);
  return { inicio, fin };
};

const recaudacion = async (req, res, next) => {
  try {
    const { inicio, fin } = resolverRango(req.query);

    const porDia = await MovimientoCaja.aggregate([
      { $match: { fecha: { $gte: inicio, $lte: fin }, anulado: false } },
      {
        $group: {
          _id: {
            dia: { $dateToString: { format: '%Y-%m-%d', date: '$fecha' } },
            medioPago: '$medioPago'
          },
          // El egreso resta: un movimiento de caja no es "plata que entró" por existir.
          neto: { $sum: { $cond: [{ $eq: ['$tipo', 'ingreso'] }, '$monto', { $multiply: ['$monto', -1] }] } },
          cobros: { $sum: { $cond: [{ $eq: ['$origen', 'cobro_estadia'] }, 1, 0] } },
          // Lo cobrado por estadías se acumula aparte del neto: el promedio por cobro tiene
          // que dividir plata de estadías por cantidad de estadías. Dividir el neto —que ya
          // tiene descontados los egresos de caja— da un promedio que no existió nunca, y
          // con un solo egreso grande el resultado hasta puede ser negativo.
          cobrado: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$origen', 'cobro_estadia'] }, { $eq: ['$tipo', 'ingreso'] }] },
                '$monto',
                0
              ]
            }
          }
        }
      },
      { $sort: { '_id.dia': -1 } }
    ]);

    const dias = new Map();
    for (const fila of porDia) {
      const dia = fila._id.dia;
      if (!dias.has(dia)) dias.set(dia, { dia, total: 0, cobros: 0, cobrado: 0, porMedio: {} });
      const registro = dias.get(dia);
      registro.porMedio[fila._id.medioPago] = fila.neto;
      registro.total += fila.neto;
      registro.cobros += fila.cobros;
      registro.cobrado += fila.cobrado;
    }

    const filas = [...dias.values()].sort((a, b) => b.dia.localeCompare(a.dia));
    const total = filas.reduce((suma, fila) => suma + fila.total, 0);
    const cobros = filas.reduce((suma, fila) => suma + fila.cobros, 0);
    const cobrado = filas.reduce((suma, fila) => suma + fila.cobrado, 0);

    res.status(200).json({
      desde: inicio,
      hasta: fin,
      dias: filas,
      total,
      cobros,
      cobrado,
      // El promedio por cobro solo tiene sentido si hubo cobros; sin ellos no se devuelve 0,
      // que se leería como "cobramos y no entró plata".
      promedioPorCobro: cobros ? Math.round(cobrado / cobros) : null
    });
  } catch (error) {
    next(error);
  }
};

const ocupacion = async (req, res, next) => {
  try {
    const { inicio, fin } = resolverRango(req.query);

    const [ingresos, egresos, dentroAhora, turnos] = await Promise.all([
      Estacionamiento.aggregate([
        { $match: { horaInicio: { $gte: inicio, $lte: fin } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$horaInicio' } }, cantidad: { $sum: 1 } } }
      ]),
      Estacionamiento.aggregate([
        { $match: { horaFin: { $gte: inicio, $lte: fin } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$horaFin' } },
            cantidad: { $sum: 1 },
            // La duración promedio se calcula sobre las estadías que terminaron: las abiertas
            // todavía no tienen duración y promediarlas achataría el número.
            minutos: { $avg: { $divide: [{ $subtract: ['$horaFin', '$horaInicio'] }, 60000] } }
          }
        }
      ]),
      Estacionamiento.countDocuments({ estado: 'activo' }),
      Turno.countDocuments({ fechaApertura: { $gte: inicio, $lte: fin } })
    ]);

    const dias = new Map();
    const asegurar = (dia) => {
      if (!dias.has(dia)) dias.set(dia, { dia, ingresos: 0, egresos: 0, minutosPromedio: null });
      return dias.get(dia);
    };
    for (const fila of ingresos) asegurar(fila._id).ingresos = fila.cantidad;
    for (const fila of egresos) {
      const registro = asegurar(fila._id);
      registro.egresos = fila.cantidad;
      registro.minutosPromedio = fila.minutos != null ? Math.round(fila.minutos) : null;
    }

    const filas = [...dias.values()].sort((a, b) => b.dia.localeCompare(a.dia));

    res.status(200).json({
      desde: inicio,
      hasta: fin,
      dias: filas,
      dentroAhora,
      turnos,
      totalIngresos: filas.reduce((suma, fila) => suma + fila.ingresos, 0),
      totalEgresos: filas.reduce((suma, fila) => suma + fila.egresos, 0)
    });
  } catch (error) {
    next(error);
  }
};

// Diferencias de caja históricas (Etapa 7.1). Es la pregunta del dueño después del cierre:
// "quién, en qué caja y en qué período tuvo diferencias, y de cuánto".
//
// Solo entran los turnos CERRADOS. Un turno anulado sigue apareciendo en la lista de cierres
// —hay que poder encontrarlo— pero su diferencia ya no cuenta como plata faltante: sumarla
// acá le inventaría un faltante al operador por un arqueo que se dio de baja.
//
// Faltante y sobrante se suman por separado y en positivo. Un operador con -$5.000 un día y
// +$5.000 otro tiene neto cero y dos diferencias que revisar: el neto solo, sin los dos
// costados, es exactamente el número que oculta el problema.
const agrupar = (por) => [
  {
    $group: {
      _id: `$${por}`,
      turnos: { $sum: 1 },
      esperado: { $sum: '$montoEsperadoCierre' },
      declarado: { $sum: '$montoDeclaradoCierre' },
      diferenciaNeta: { $sum: '$diferencia' },
      faltante: { $sum: { $cond: [{ $lt: ['$diferencia', 0] }, { $abs: '$diferencia' }, 0] } },
      sobrante: { $sum: { $cond: [{ $gt: ['$diferencia', 0] }, '$diferencia', 0] } },
      conDiferencia: { $sum: { $cond: [{ $ne: ['$diferencia', 0] }, 1, 0] } },
      ultimoCierre: { $max: '$fechaCierre' }
    }
  },
  // Ordenado por magnitud del descuadre, no por fecha: el que más se aparta va arriba, que es
  // el que hay que mirar. `$sum` sobre las dos columnas ya positivas evita comparar signos.
  { $sort: { faltante: -1, sobrante: -1 } }
];

const cierres = async (req, res, next) => {
  try {
    // Sin fechas se mira toda la historia: un turno por operador y por día es un volumen que
    // aguanta la agregación completa, y acotar por defecto escondería justamente el cierre
    // viejo que alguien vino a buscar.
    const filtro = { ...construirFiltroDeTurnos(req.query), estado: 'cerrado' };

    const [resultado] = await Turno.aggregate([
      { $match: filtro },
      {
        $facet: {
          totales: [
            {
              $group: {
                _id: null,
                turnos: { $sum: 1 },
                esperado: { $sum: '$montoEsperadoCierre' },
                declarado: { $sum: '$montoDeclaradoCierre' },
                diferenciaNeta: { $sum: '$diferencia' },
                faltante: { $sum: { $cond: [{ $lt: ['$diferencia', 0] }, { $abs: '$diferencia' }, 0] } },
                sobrante: { $sum: { $cond: [{ $gt: ['$diferencia', 0] }, '$diferencia', 0] } },
                conDiferencia: { $sum: { $cond: [{ $ne: ['$diferencia', 0] }, 1, 0] } }
              }
            }
          ],
          porOperador: [
            ...agrupar('operadorId'),
            { $lookup: { from: 'usuarios', localField: '_id', foreignField: '_id', as: 'operador' } },
            {
              $addFields: {
                operador: {
                  $let: {
                    vars: { o: { $first: '$operador' } },
                    in: { _id: '$$o._id', nombre: '$$o.nombre', apellido: '$$o.apellido', dni: '$$o.dni' }
                  }
                }
              }
            }
          ],
          porCaja: [
            ...agrupar('cajaId'),
            { $lookup: { from: 'cajas', localField: '_id', foreignField: '_id', as: 'caja' } },
            {
              $addFields: {
                caja: {
                  $let: { vars: { c: { $first: '$caja' } }, in: { _id: '$$c._id', nombre: '$$c.nombre' } }
                }
              }
            }
          ]
        }
      }
    ]);

    const vacio = { turnos: 0, esperado: 0, declarado: 0, diferenciaNeta: 0, faltante: 0, sobrante: 0, conDiferencia: 0 };
    const { _id, ...totales } = resultado?.totales?.[0] ?? vacio;

    res.status(200).json({
      totales,
      porOperador: resultado?.porOperador ?? [],
      porCaja: resultado?.porCaja ?? []
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { recaudacion, ocupacion, cierres };
