const { InjectManifest } = require('workbox-webpack-plugin');

module.exports = function override(config, env) {
  if (env === 'production') {
    // Agregar Service Worker para PWA
    config.plugins.push(
      new InjectManifest({
        swSrc: './src/sw.js',
        swDest: 'sw.js',
        exclude: [/\.map$/, /manifest$/, /\.htaccess$/],
      })
    );

    // Optimización de chunks
    config.optimization = {
      ...config.optimization,
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
        },
      },
    };
  }

  return config;
};
