
export const requireRole = (... roles) => (req,res,next) => {
    if(!roles.includes(req.user.rol)){
        return res.status(403).json({error: 'No autorizado'});
    }
    next();
};