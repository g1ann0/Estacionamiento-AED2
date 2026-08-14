import {
  LayoutDashboard, Car, Wallet, Receipt, Users, Tags,
  ChartNoAxesCombined, Settings, ShieldCheck
} from 'lucide-react';

// Arquitectura de navegación del panel (ver docs/rediseno-admin/00, sección A).
//
// Tres reglas que la gobiernan:
//   1. Máximo dos niveles. Grupo → ítem. Nada más profundo.
//   2. No se muestra lo que no existe. Abonos, convenios, descuentos, reglas de tarifa,
//      sectores y métodos de pago configurables no tienen modelo detrás: no entran al menú
//      hasta que existan. Un ítem que abre una pantalla vacía desgasta más que su ausencia.
//   3. El menú se filtra por rol. El operador no ve Tarifas, Configuración ni Auditoría.
//
// `Terminal` no es un grupo: es el destino por defecto y vive solo, arriba de todo.

export const NAVEGACION = [
  {
    id: 'terminal',
    etiqueta: 'Terminal',
    icono: LayoutDashboard,
    ruta: '/admin',
    roles: ['operador', 'admin']
  },
  {
    id: 'playa',
    etiqueta: 'Playa',
    icono: Car,
    roles: ['operador', 'admin'],
    items: [
      { etiqueta: 'Vehículos dentro', ruta: '/admin/playa/dentro' },
      { etiqueta: 'Historial de estadías', ruta: '/admin/playa/historial' }
    ]
  },
  {
    id: 'caja',
    etiqueta: 'Caja',
    icono: Wallet,
    roles: ['operador', 'admin'],
    items: [
      { etiqueta: 'Turno actual', ruta: '/admin/caja/turno' },
      { etiqueta: 'Movimientos', ruta: '/admin/caja/movimientos' },
      // Los cierres son del dueño, no del cajero: la pantalla vive del histórico de arqueos
      // (`GET /api/turnos`) y del acumulado de diferencias, dos endpoints admin-only. Sin este
      // filtro el operador veía la opción en el menú y entraba a un error 403.
      { etiqueta: 'Cierres', ruta: '/admin/caja/cierres', roles: ['admin'] }
    ]
  },
  {
    id: 'comprobantes',
    etiqueta: 'Comprobantes',
    icono: Receipt,
    roles: ['operador', 'admin'],
    items: [
      { etiqueta: 'Comprobantes de estadía', ruta: '/admin/comprobantes/estadias' },
      { etiqueta: 'Recargas de saldo', ruta: '/admin/comprobantes/recargas', roles: ['admin'] },
      { etiqueta: 'Facturas', ruta: '/admin/comprobantes/facturas', roles: ['admin'] }
    ]
  },
  {
    id: 'clientes',
    etiqueta: 'Clientes',
    icono: Users,
    roles: ['admin'],
    items: [
      { etiqueta: 'Clientes', ruta: '/admin/clientes' },
      { etiqueta: 'Vehículos', ruta: '/admin/clientes/vehiculos' },
      { etiqueta: 'Saldos y transacciones', ruta: '/admin/clientes/saldos' }
    ]
  },
  {
    id: 'tarifas',
    etiqueta: 'Tarifas',
    icono: Tags,
    roles: ['admin'],
    items: [
      { etiqueta: 'Tarifas', ruta: '/admin/tarifas' },
      { etiqueta: 'Historial de cambios', ruta: '/admin/tarifas/historial' }
    ]
  },
  {
    id: 'reportes',
    etiqueta: 'Reportes',
    icono: ChartNoAxesCombined,
    roles: ['admin'],
    items: [
      { etiqueta: 'Recaudación', ruta: '/admin/reportes/recaudacion' },
      { etiqueta: 'Ocupación', ruta: '/admin/reportes/ocupacion' },
      { etiqueta: 'Cierres de caja', ruta: '/admin/reportes/cierres' }
    ]
  },
  {
    id: 'configuracion',
    etiqueta: 'Configuración',
    icono: Settings,
    roles: ['admin'],
    items: [
      { etiqueta: 'Empresa y facturación', ruta: '/admin/configuracion' },
      { etiqueta: 'Sucursales', ruta: '/admin/configuracion/sucursales' },
      { etiqueta: 'Cajas', ruta: '/admin/configuracion/cajas' },
      { etiqueta: 'Usuarios y roles', ruta: '/admin/configuracion/usuarios' },
      { etiqueta: 'Feriados', ruta: '/admin/configuracion/feriados' }
    ]
  },
  {
    id: 'auditoria',
    etiqueta: 'Auditoría',
    icono: ShieldCheck,
    roles: ['admin'],
    items: [
      { etiqueta: 'Actividad', ruta: '/admin/auditoria' }
    ]
  }
];

// El filtrado por rol es de presentación, no de seguridad: la autorización real la aplica
// `requireRole` en cada ruta del backend. Ocultar una opción no protege un endpoint.
export function navegacionParaRol(rol) {
  return NAVEGACION
    .filter((grupo) => grupo.roles.includes(rol))
    .map((grupo) => ({
      ...grupo,
      items: grupo.items?.filter((item) => !item.roles || item.roles.includes(rol))
    }))
    .filter((grupo) => !grupo.items || grupo.items.length > 0);
}
