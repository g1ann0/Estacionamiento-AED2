import { useCallback, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import AppShell from './AppShell';
import { listarCajas, obtenerTurnoActual } from '../services/turnoService';

// Resuelve el contexto operativo del panel —cajas, caja en uso y turno abierto— una sola
// vez y para todas las pantallas. El estado del turno es información de primera línea: sin
// turno abierto no se puede cobrar, y el operador tiene que verlo antes de intentarlo, no
// después.
//
// El mismo contexto baja por `Outlet` a las pantallas: la Terminal lo usa para sus
// contadores y Caja para operar el turno. Cuando una de ellas abre o cierra un turno llama
// a `recargar`, y el header y el resto del panel quedan al día sin recargar la página.
export default function PanelLayout() {
  const [contexto, setContexto] = useState({
    sucursal: 'Estacionamiento',
    cajas: [],
    caja: null,
    turno: null,
    cargando: true,
    error: null
  });

  const cargar = useCallback(async () => {
    try {
      const cajas = await listarCajas();
      const caja = cajas?.[0] ?? null;
      const turno = caja ? await obtenerTurnoActual(caja._id) : null;
      setContexto((actual) => ({ ...actual, cajas, caja, turno, cargando: false, error: null }));
    } catch (e) {
      // Si el contexto no se puede resolver, el header dice "Sin turno abierto" y el panel
      // sigue siendo usable: no es motivo para bloquear la pantalla entera.
      setContexto((actual) => ({ ...actual, cargando: false, error: e.message }));
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <AppShell contexto={contexto}>
      <Outlet context={{ ...contexto, recargar: cargar }} />
    </AppShell>
  );
}
