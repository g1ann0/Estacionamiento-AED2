import React, { useEffect } from 'react';
import '../styles/facturador.css';

const ListadoFacturasElectronicas = ({ onMensaje }) => {
  useEffect(() => {
    onMensaje({ 
      type: 'info', 
      text: 'Este módulo está obsoleto. Use el Facturador AFIP desde el panel de administración.' 
    });
  }, [onMensaje]);

  return (
    <div className="listado-facturas-electronicas">
      <h2>⚠️ Módulo Obsoleto</h2>
      <p>Las facturas electrónicas ahora se gestionan desde el <strong>Facturador Electrónico AFIP</strong>.</p>
      <p>Acceda desde el panel de administración.</p>
    </div>
  );
};

export default ListadoFacturasElectronicas;
