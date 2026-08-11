// React 19 eleva <title>, <meta> y <link> al <head> desde cualquier punto del árbol, así que
// este componente ya no necesita react-helmet-async (paquete sin mantenimiento que además
// bloqueaba la actualización a React 19).
const SEO = ({
  title = "Sistema de Estacionamiento",
  description = "Plataforma digital para gestión de estacionamientos universitarios. Control de vehículos, pagos y administración eficiente.",
  keywords = "estacionamiento, gestión vehicular, universidad, control acceso, pagos digitales, administración",
  canonical = window.location.href,
  image = "/logo192.png",
  type = "website"
}) => {
  const fullTitle = title === "Sistema de Estacionamiento" ? title : `${title} | Sistema de Estacionamiento`;
  const siteUrl = import.meta.env.VITE_SITE_URL || "http://localhost:3001";
  const fullCanonical = canonical.startsWith('http') ? canonical : `${siteUrl}${canonical}`;

  const datosEstructurados = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Sistema de Estacionamiento",
    "description": description,
    "url": siteUrl,
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web Browser",
    "author": {
      "@type": "Person",
      "name": "Gian Castellino"
    },
    "provider": {
      "@type": "Organization",
      "name": "Instituto Superior Juan XXIII"
    }
  };

  return (
    <>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />

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

      <meta name="author" content="Gian Castellino" />
      <meta name="robots" content="index, follow" />
      <meta name="language" content="es" />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(datosEstructurados) }}
      />
    </>
  );
};

export default SEO;
