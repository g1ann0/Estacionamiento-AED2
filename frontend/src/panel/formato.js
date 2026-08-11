// Formato compartido del panel. Vive en un solo lugar porque el registro numérico es parte
// del sistema visual: si una pantalla escribe "$4500" y otra "$ 4.500", el operador deja de
// leer importes de un vistazo y empieza a leerlos letra por letra.

export const pesos = (n) => `$${Number(n ?? 0).toLocaleString('es-AR')}`;

// El signo va adelante del peso, no del número: "-$5.000" se lee como plata que sale.
export const pesosConSigno = (n) => `${n < 0 ? '-' : ''}${pesos(Math.abs(n ?? 0))}`;

// 24 horas, siempre. Un turno que cruza la medianoche con horas en formato de 12 obliga al
// cajero a traducir "04:10 p. m." mientras el cliente espera, y en el arqueo un "12:47 a. m."
// es directamente ambiguo.
export const hora = (fecha) =>
  new Date(fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });

export const fecha = (valor) =>
  new Date(valor).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export const fechaHora = (valor) => `${fecha(valor)} ${hora(valor)}`;

export const duracionDesdeHoras = (horasReales) => {
  const total = Math.max(0, Math.round((horasReales ?? 0) * 60));
  return `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, '0')}m`;
};

export const duracionEntre = (desde, hasta) => {
  const minutos = Math.max(0, Math.floor((new Date(hasta).getTime() - new Date(desde).getTime()) / 60000));
  return `${Math.floor(minutos / 60)}h ${String(minutos % 60).padStart(2, '0')}m`;
};

export const ETIQUETA_MEDIO = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  qr_transferencia: 'QR',
  saldo_prepago: 'Saldo'
};

// El nombre largo se usa donde hay lugar y el corto en los segmentados de cobro, donde la
// fila entera tiene que entrar sin partirse.
export const ETIQUETA_MEDIO_LARGA = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  qr_transferencia: 'QR / Transferencia',
  saldo_prepago: 'Saldo prepago'
};

export const ETIQUETA_ORIGEN = {
  cobro_estadia: 'Cobro',
  manual: 'Manual',
  ajuste: 'Ajuste',
  devolucion: 'Devolución'
};

export const nombreDe = (persona, alternativa = '—') =>
  persona?.nombre ? `${persona.nombre} ${persona.apellido ?? ''}`.trim() : alternativa;

// El receptor de un comprobante no siempre es una persona con apellido. Para el cliente
// ocasional el modelo guarda `apellido: 'Final'` como relleno —viene de "Consumidor Final"—
// así que escribir "apellido, nombre" produce cosas como «Final, Juan Pérez». El apellido
// solo se usa cuando el receptor es un usuario registrado, que es el único caso donde es
// un apellido de verdad.
export const nombreReceptor = (receptor) => {
  if (!receptor) return '—';
  if (receptor.tipo === 'usuario') return `${receptor.apellido}, ${receptor.nombre}`;
  const nombre = receptor.nombre?.trim();
  return nombre && nombre.toLowerCase() !== 'consumidor' ? nombre : null;
};
