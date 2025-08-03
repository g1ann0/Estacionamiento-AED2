import React from 'react';
import { Helmet } from 'react-helmet-async';

const SEO = ({ 
  title = "Sistema de Estacionamiento", 
  description = "Plataforma digital para gestión de estacionamientos universitarios. Control de vehículos, pagos y administración eficiente.",
  keywords = "estacionamiento, gestión vehicular, universidad, control acceso, pagos digitales, administración",
  canonical = window.location.href,
  image = "/logo192.png",
  type = "website"
}) => {
  const fullTitle = title === "Sistema de Estacionamiento" ? title : `${title} | Sistema de Estacionamiento`;
  const siteUrl = process.env.REACT_APP_SITE_URL || "http://localhost:3001";
  const fullCanonical = canonical.startsWith('http') ? canonical : `${siteUrl}${canonical}`;

  return (
    <Helmet>
      {/* Título y descripción básica */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      
      {/* Canonical URL */}
      <link rel="canonical" href={fullCanonical} />
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={`${siteUrl}${image}`} />
      <meta property="og:url" content={fullCanonical} />
      <meta property="og:site_name" content="Sistema de Estacionamiento" />
      
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={`${siteUrl}${image}`} />
      
      {/* Información adicional */}
      <meta name="author" content="Gian Castellino" />
      <meta name="robots" content="index, follow" />
      <meta name="language" content="es" />
      <meta name="revisit-after" content="7 days" />
      
      {/* Structured Data - Schema.org */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          "name": "Sistema de Estacionamiento",
          "description": description,
          "url": siteUrl,
          "applicationCategory": "BusinessApplication",
          "operatingSystem": "Web Browser",
          "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "ARS"
          },
          "author": {
            "@type": "Person",
            "name": "Gian Castellino"
          },
          "provider": {
            "@type": "Organization",
            "name": "Instituto Superior Juan XXIII"
          }
        })}
      </script>
    </Helmet>
  );
};

export default SEO;
