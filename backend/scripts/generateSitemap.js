// Script para generar sitemap automático
const fs = require('fs');
const path = require('path');

const generateSitemap = () => {
  const baseUrl = process.env.BASE_URL || 'https://tu-dominio.com';
  const currentDate = new Date().toISOString().split('T')[0];
  
  const urls = [
    {
      loc: `${baseUrl}/`,
      lastmod: currentDate,
      changefreq: 'weekly',
      priority: '1.0'
    },
    {
      loc: `${baseUrl}/login`,
      lastmod: currentDate,
      changefreq: 'monthly',
      priority: '0.8'
    },
    {
      loc: `${baseUrl}/registro`,
      lastmod: currentDate,
      changefreq: 'monthly',
      priority: '0.8'
    }
  ];

  let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

  urls.forEach(url => {
    sitemap += `
    <url>
        <loc>${url.loc}</loc>
        <lastmod>${url.lastmod}</lastmod>
        <changefreq>${url.changefreq}</changefreq>
        <priority>${url.priority}</priority>
    </url>`;
  });

  sitemap += `
</urlset>`;

  // Escribir el sitemap
  const sitemapPath = path.join(__dirname, '../../frontend/public/sitemap.xml');
  fs.writeFileSync(sitemapPath, sitemap);
  
  console.log('✅ Sitemap generado correctamente en:', sitemapPath);
};

module.exports = { generateSitemap };

// Ejecutar si se llama directamente
if (require.main === module) {
  generateSitemap();
}
