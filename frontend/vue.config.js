module.exports = { 
  devServer: {
    proxy: { 
      '/api': { 
        target: 'http://localhost:3000/api',
        changeOrigin: true, 
        secure: false,
        pathRewrite: { 
          '^/api': ''
        } 
      },
      '/ip': {
        target: 'http://pv.sohu.com/cityjson?ie=utf-8',
        changeOrigin: true,
        secure: false
      }
    } 
  },
  outputDir: '../backend/public', 
}