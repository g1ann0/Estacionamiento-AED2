const express = require('express');
const router = express.Router();

// Generar sitemap dinámico
router.get('/sitemap.xml', (req, res) => {
  const baseUrl = process.env.BASE_URL || 'https://tu-dominio.com';
  const currentDate = new Date().toISOString().split('T')[0];
  
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
        <loc>${baseUrl}/</loc>
        <lastmod>${currentDate}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>1.0</priority>
    </url>
    <url>
        <loc>${baseUrl}/login</loc>
        <lastmod>${currentDate}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.8</priority>
    </url>
    <url>
        <loc>${baseUrl}/registro</loc>
        <lastmod>${currentDate}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.8</priority>
    </url>
</urlset>`;

  res.set('Content-Type', 'text/xml');
  res.send(sitemap);
});

// Endpoint para structured data
router.get('/api/structured-data', (req, res) => {
  const baseUrl = process.env.BASE_URL || 'https://tu-dominio.com';
  
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Sistema de Gestión de Estacionamiento",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web",
    "description": "Sistema inteligente para la gestión y administración de estacionamientos con control de acceso automatizado.",
    "url": baseUrl,
    "provider": {
      "@type": "Organization",
      "name": "Tu Empresa",
      "url": baseUrl
    },
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "reviewCount": "150"
    }
  };
  
  res.json(structuredData);
});

module.exports = router;
