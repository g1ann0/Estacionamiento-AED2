import React, { createContext, useState, useContext, useEffect } from 'react';
import { salir, sesionActual } from '../services/accesoService';

// Quién está usando el sistema.
//
// El token ya no vive acá ni en `localStorage`: la sesión es una cookie HttpOnly que este
// código no puede leer —ni él ni ningún script que llegue a inyectarse en la página—. Lo que
// queda del lado del navegador es el nombre y el rol, para dibujar el menú; el permiso real lo
// decide el servidor en cada request, como siempre.
//
// Consecuencia práctica: al cargar la página no alcanza con mirar el almacenamiento local para
// saber si hay sesión. Hay que preguntárselo al servidor. Eso además arregla el caso que se
// veía seguido: la pantalla mostraba "Test Admin" y el menú completo con una sesión ya vencida,
// y recién al pedir datos aparecía un "Token inválido" suelto en medio de una tabla.

const AuthContext = createContext(null);

const CLAVE_USUARIO = 'usuario';

// El usuario cacheado evita el parpadeo de "no logueado" mientras el servidor contesta. Es una
// pista para pintar, no una credencial: si la verificación dice que no hay sesión, se descarta.
const usuarioCacheado = () => {
  try {
    const guardado = localStorage.getItem(CLAVE_USUARIO);
    return guardado ? JSON.parse(guardado) : null;
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [usuario, setUsuario] = useState(usuarioCacheado);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let vigente = true;
    (async () => {
      const confirmado = await sesionActual();
      if (!vigente) return;
      if (confirmado) {
        setUsuario(confirmado);
        try { localStorage.setItem(CLAVE_USUARIO, JSON.stringify(confirmado)); } catch { /* modo privado */ }
      } else {
        setUsuario(null);
        try { localStorage.removeItem(CLAVE_USUARIO); } catch { /* modo privado */ }
      }
      setLoading(false);
    })();
    return () => { vigente = false; };
  }, []);

  const login = (userData) => {
    try { localStorage.setItem(CLAVE_USUARIO, JSON.stringify(userData)); } catch { /* modo privado */ }
    setUsuario(userData);
  };

  const logout = async () => {
    await salir();
    try { localStorage.removeItem(CLAVE_USUARIO); } catch { /* modo privado */ }
    setUsuario(null);
  };

  const updateUser = (userData) => {
    try { localStorage.setItem(CLAVE_USUARIO, JSON.stringify(userData)); } catch { /* modo privado */ }
    setUsuario(userData);
  };

  const isAuthenticated = () => !!usuario;

  return (
    <AuthContext.Provider value={{ usuario, login, logout, updateUser, isAuthenticated, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
