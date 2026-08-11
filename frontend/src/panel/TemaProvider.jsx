import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// Tres estados reales, no dos: claro, oscuro y "seguir al sistema". `sistema` es el valor
// por defecto y no es lo mismo que claro — una máquina configurada en oscuro tiene que abrir
// en oscuro sin que nadie elija nada.
const CLAVE = 'panel-tema';
const TemaContexto = createContext(null);

const leerPreferencia = () => {
  try {
    const guardado = localStorage.getItem(CLAVE);
    return guardado === 'claro' || guardado === 'oscuro' || guardado === 'sistema' ? guardado : 'sistema';
  } catch {
    // localStorage puede fallar en modo privado; no es motivo para romper la app.
    return 'sistema';
  }
};

// Escribe el atributo que leen los tokens. En `sistema` lo BORRA en vez de calcular claro u
// oscuro: así la media query `prefers-color-scheme` vuelve a mandar, y el tema sigue al
// sistema en vivo si el usuario lo cambia con la app abierta.
export const aplicarTema = (tema) => {
  const raiz = document.documentElement;
  if (tema === 'sistema') raiz.removeAttribute('data-theme');
  else raiz.setAttribute('data-theme', tema === 'oscuro' ? 'dark' : 'light');
};

export function TemaProvider({ children }) {
  const [tema, setTemaEstado] = useState(leerPreferencia);

  useEffect(() => {
    aplicarTema(tema);
    try {
      localStorage.setItem(CLAVE, tema);
    } catch {
      // Sin persistencia, el tema sigue funcionando en la sesión actual.
    }
  }, [tema]);

  const setTema = useCallback((siguiente) => setTemaEstado(siguiente), []);

  const ciclarTema = useCallback(() => {
    setTemaEstado((actual) => (actual === 'sistema' ? 'claro' : actual === 'claro' ? 'oscuro' : 'sistema'));
  }, []);

  // Resuelve qué se está viendo realmente, que no es lo mismo que lo elegido: con `sistema`
  // hay que preguntarle al sistema.
  const temaEfectivo = useMemo(() => {
    if (tema !== 'sistema') return tema;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
  }, [tema]);

  const valor = useMemo(() => ({ tema, temaEfectivo, setTema, ciclarTema }), [tema, temaEfectivo, setTema, ciclarTema]);

  return <TemaContexto.Provider value={valor}>{children}</TemaContexto.Provider>;
}

export function useTema() {
  const contexto = useContext(TemaContexto);
  if (!contexto) throw new Error('useTema debe usarse dentro de <TemaProvider>');
  return contexto;
}
