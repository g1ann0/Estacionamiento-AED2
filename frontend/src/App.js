import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/AuthContext';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import AdminGestion from './components/AdminGestion';
import ControlTransacciones from './components/ControlTransacciones';
import ListadosAdmin from './components/ListadosAdmin';
import ConfiguracionEmpresa from './components/ConfiguracionEmpresa';
import Navbar from './components/Navbar';
import SetearPassword from './components/SetearPassword';
import OlvidePassword from './components/OlvidePassword';
import RecuperarPassword from './components/RecuperarPassword';
import Perfil from './components/Perfil';
import Historial from './components/Historial';
import NetworkDiagnostic from './components/NetworkDiagnostic';
import DebugLogin from './components/DebugLogin';
import DashboardDebug from './components/DashboardDebug';
import Home from './components/Home';
import SEO from './components/SEO';
import PerformanceMonitor from './components/PerformanceMonitor';
import './styles/theme.css';
import './styles/admin.css';

// Componente para rutas protegidas
const PrivateRoute = ({ children, requiredRole }) => {
  const { isAuthenticated, loading, usuario } = useAuth();

  if (loading) {
    return (
      <div className="container">
        <div className="card" style={{ maxWidth: '400px', margin: '100px auto', textAlign: 'center' }}>
          <p>Cargando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  // Si se requiere un rol específico
  if (requiredRole) {
    // Si el usuario es admin y la ruta requiere rol de usuario normal
    if (usuario.rol === 'admin' && requiredRole === 'usuario') {
      return <Navigate to="/admin" replace />;
    }
    
    // Si el usuario es normal y la ruta requiere rol de admin
    if (usuario.rol !== 'admin' && requiredRole === 'admin') {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return children;
};

// Componente para rutas públicas (redirige según el rol del usuario)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading, usuario } = useAuth();

  if (loading) {
    return (
      <div className="container">
        <div className="card" style={{ maxWidth: '400px', margin: '100px auto', textAlign: 'center' }}>
          <p>Cargando...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated()) {
    return <Navigate to={usuario.rol === 'admin' ? '/admin' : '/dashboard'} replace />;
  }

  return children;
};

// Componente wrapper para la página de configuración
const ConfiguracionEmpresaPage = () => {
  const [mensaje, setMensaje] = React.useState(null);

  return (
    <div>
      <Navbar />
      <div className="container">
        {mensaje && (
          <div className={`message message-${mensaje.type}`} style={{ margin: '1rem 0', position: 'relative' }}>
            {mensaje.text}
            <button 
              onClick={() => setMensaje(null)} 
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
                padding: '0 5px'
              }}
            >
              ×
            </button>
          </div>
        )}
        <ConfiguracionEmpresa onMensaje={setMensaje} />
      </div>
    </div>
  );
};

function App() {
  return (
    <HelmetProvider>
      <AuthProvider>
        <Router>
          <PerformanceMonitor />
          <div className="app-container">
            <Routes>
              {/* Ruta principal con página de inicio */}
              <Route path="/" element={<Home />} />

              {/* Ruta de diagnóstico temporal */}
              <Route path="/diagnostico" element={<NetworkDiagnostic />} />
              <Route path="/debug-login" element={<DebugLogin />} />
              <Route path="/debug-dashboard" element={<DashboardDebug />} />

              {/* Rutas públicas */}
              <Route path="/login" element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              } />
              <Route path="/registro" element={
                <PublicRoute>
                  <Register />
                </PublicRoute>
              } />
              
              <Route path="/setear-password" element={<SetearPassword />} />
              <Route path="/olvide-password" element={
                <PublicRoute>
                  <OlvidePassword />
                </PublicRoute>
              } />
              <Route path="/recuperar-password" element={
                <PublicRoute>
                  <RecuperarPassword />
                </PublicRoute>
              } />

              {/* Rutas protegidas para usuarios normales */}
              <Route path="/dashboard" element={
                <PrivateRoute requiredRole="usuario">
                  <Dashboard />
                </PrivateRoute>
              } />

              <Route path="/historial" element={
                <PrivateRoute requiredRole="usuario">
                  <Historial />
                </PrivateRoute>
              } />

              <Route path="/perfil" element={
                <PrivateRoute requiredRole="usuario">
                  <Perfil />
                </PrivateRoute>
              } />

              {/* Rutas protegidas para administradores */}
              <Route path="/admin" element={
                <PrivateRoute requiredRole="admin">
                  <AdminDashboard />
                </PrivateRoute>
              } />

              <Route path="/admin/gestion" element={
                <PrivateRoute requiredRole="admin">
                  <AdminGestion />
                </PrivateRoute>
              } />

              <Route path="/admin/transacciones" element={
                <PrivateRoute requiredRole="admin">
                  <ControlTransacciones />
                </PrivateRoute>
              } />

              <Route path="/admin/listados" element={
                <PrivateRoute requiredRole="admin">
                  <ListadosAdmin />
                </PrivateRoute>
              } />

              <Route path="/admin/configuracion" element={
                <PrivateRoute requiredRole="admin">
                  <ConfiguracionEmpresaPage />
                </PrivateRoute>
              } />

              {/* Ruta 404 */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </Router>
      </AuthProvider>
    </HelmetProvider>
  );
}

export default App;


