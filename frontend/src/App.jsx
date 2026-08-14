import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { TemaProvider } from './panel/TemaProvider';
import PanelLayout from './panel/PanelLayout';
import Terminal from './panel/terminal/Terminal';
import TurnoActual from './panel/caja/TurnoActual';
import Movimientos from './panel/caja/Movimientos';
import Cierres from './panel/caja/Cierres';
import Feriados from './panel/configuracion/Feriados';
import ComprobantesEstadia from './panel/comprobantes/ComprobantesEstadia';
import Recargas from './panel/comprobantes/Recargas';
import Facturas from './panel/comprobantes/Facturas';
import Tarifas from './panel/tarifas/Tarifas';
import HistorialTarifas from './panel/tarifas/HistorialTarifas';
import Dentro from './panel/playa/Dentro';
import HistorialEstadias from './panel/playa/HistorialEstadias';
import Clientes from './panel/clientes/Clientes';
import VehiculosClientes from './panel/clientes/Vehiculos';
import Saldos from './panel/clientes/Saldos';
import Recaudacion from './panel/reportes/Recaudacion';
import Ocupacion from './panel/reportes/Ocupacion';
import Sucursales from './panel/configuracion/Sucursales';
import CajasConfig from './panel/configuracion/Cajas';
import UsuariosConfig from './panel/configuracion/Usuarios';
import Auditoria from './panel/auditoria/Auditoria';
import Empresa from './panel/configuracion/Empresa';
import { useAuth } from './context/AuthContext';
import Acceso from './cliente/Acceso';
import Registro from './cliente/Registro';
import ClienteLayout from './cliente/ClienteLayout';
import Panel from './cliente/Panel';
import NuevaContrasena from './cliente/NuevaContrasena';
import OlvideContrasena from './cliente/OlvideContrasena';
import Perfil from './cliente/Perfil';
import Historial from './cliente/Historial';
import Inicio from './cliente/Inicio';

// Quién opera el panel y quién la app del conductor. Son tres roles reales —`cliente`,
// `operador`, `admin`, los tres en el enum de Usuario y distinguidos por `requireRole` en las
// rutas de caja, turnos, estadías, comprobantes y sucursales— y esto los rutea en el frontend.
//
// Antes la comparación era contra la cadena `'admin'` a secas, así que un operador quedaba
// fuera del panel y aterrizaba en el dashboard del conductor: el rol existía en la base y en
// la API, y el ruteo no lo dejaba entrar a la Terminal, que es justamente su pantalla.
//
// Esto es conveniencia de navegación, no seguridad: la autorización real la aplica el backend
// en cada endpoint.
const DEL_PANEL = ['admin', 'operador'];

const PrivateRoute = ({ children, roles }) => {
  const { isAuthenticated, loading, usuario } = useAuth();

  if (loading) {
    return <p className="cargando-sesion">Cargando…</p>;
  }

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(usuario.rol)) {
    // Cada uno a su casa: quien opera la playa al panel, el conductor a su app.
    return <Navigate to={DEL_PANEL.includes(usuario.rol) ? '/admin' : '/dashboard'} replace />;
  }

  return children;
};

// Pantallas de acceso: si ya hay sesión, no tiene sentido volver a pedirla.
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading, usuario } = useAuth();

  if (loading) {
    return <p className="cargando-sesion">Cargando…</p>;
  }

  if (isAuthenticated()) {
    return <Navigate to={DEL_PANEL.includes(usuario.rol) ? '/admin' : '/dashboard'} replace />;
  }

  return children;
};


function App() {
  return (
    <TemaProvider>
      <AuthProvider>
        <Router>
          <div className="app-container">
            <Routes>
              {/* Ruta principal con página de inicio */}
              <Route path="/" element={<Inicio />} />

              {/* Rutas públicas */}
              <Route path="/login" element={
                <PublicRoute>
                  <Acceso />
                </PublicRoute>
              } />
              <Route path="/registro" element={
                <PublicRoute>
                  <Registro />
                </PublicRoute>
              } />
              
              <Route path="/setear-password" element={<NuevaContrasena modo="verificar" />} />
              <Route path="/olvide-password" element={
                <PublicRoute>
                  <OlvideContrasena />
                </PublicRoute>
              } />
              <Route path="/recuperar-password" element={
                <PublicRoute>
                  <NuevaContrasena modo="recuperar" />
                </PublicRoute>
              } />

              {/* App del conductor. Comparte shell: header, tema y navegación inferior fija,
                  igual que el panel comparte el suyo. */}
              <Route element={
                <PrivateRoute roles={['cliente']}>
                  <ClienteLayout />
                </PrivateRoute>
              }>
                <Route path="/dashboard" element={<Panel />} />
                <Route path="/historial" element={<Historial />} />
                <Route path="/perfil" element={<Perfil />} />
              </Route>

              {/* Panel de operación. Todo el menú vive acá adentro: no quedan pantallas
                  anteriores ruteadas. */}
              <Route path="/admin" element={
                <PrivateRoute roles={DEL_PANEL}>
                  <PanelLayout />
                </PrivateRoute>
              }>
                <Route index element={<Terminal />} />
                <Route path="playa/dentro" element={<Dentro />} />
                <Route path="playa/historial" element={<HistorialEstadias />} />
                <Route path="caja/turno" element={<TurnoActual />} />
                <Route path="caja/movimientos" element={<Movimientos />} />
                <Route path="caja/cierres" element={<Cierres />} />
                <Route path="comprobantes/estadias" element={<ComprobantesEstadia />} />
                <Route path="comprobantes/recargas" element={<Recargas />} />
                <Route path="comprobantes/facturas" element={<Facturas />} />
                <Route path="clientes" element={<Clientes />} />
                <Route path="clientes/vehiculos" element={<VehiculosClientes />} />
                <Route path="clientes/saldos" element={<Saldos />} />
                <Route path="tarifas" element={<Tarifas />} />
                <Route path="tarifas/historial" element={<HistorialTarifas />} />
                <Route path="reportes/recaudacion" element={<Recaudacion />} />
                <Route path="reportes/ocupacion" element={<Ocupacion />} />
                {/* Reportes → Cierres y Caja → Cierres son la misma pantalla: el arqueo cerrado
                    se busca desde los dos lados y duplicar el componente sería duplicar el bug. */}
                <Route path="reportes/cierres" element={<Cierres />} />
                <Route path="configuracion" element={<Empresa />} />
                <Route path="configuracion/sucursales" element={<Sucursales />} />
                <Route path="configuracion/cajas" element={<CajasConfig />} />
                <Route path="configuracion/feriados" element={<Feriados />} />
                <Route path="configuracion/usuarios" element={<UsuariosConfig />} />
                <Route path="auditoria" element={<Auditoria />} />
              </Route>

              {/* Ruta 404 */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </Router>
      </AuthProvider>
    </TemaProvider>
  );
}

export default App;


