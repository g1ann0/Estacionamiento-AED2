const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);
    
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            mensaje: 'Error de validación',
            errores: Object.values(err.errors).map(e => e.message)
        });
    }
    
    if (err.name === 'MongoError' || err.name === 'MongoServerError') {
        if (err.code === 11000) {
            return res.status(400).json({
                mensaje: 'Ya existe un registro con esos datos'
            });
        }
    }
    
    res.status(500).json({
        mensaje: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
};

module.exports = errorHandler;
