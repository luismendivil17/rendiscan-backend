const express = require('express');
const app = express();
const jwt = require('jsonwebtoken');
require('dotenv').config();

const PORT = process.env.PORT || 3000;

const cors = require('cors');
app.use(cors());
app.use(express.json());

function requireAuth(req, res, next){
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Token requerido'});
    try{
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.user = payload;
        next();
    } catch{
        return res.status(401).json({error: 'Token invalido o expirado'});
    }
}




app.get ('/',(reg,res) =>{
    res.send(`El Backend de RendiScan está funcionando`);
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});


const rendiciones = [
    {id: 'REND-001', solicitante: 'solicitante@prueba.com',estado: 'CREADA', monto: 120.50},
    {id: 'REND-002', solicitante: 'solicitante@prueba.com',estado: 'CREADA', monto: 120.50},
    {id: 'REND-003', solicitante: 'solicitante@prueba.com',estado: 'CREADA', monto: 120.50},
    {id: 'REND-004', solicitante: 'solicitante@prueba.com',estado: 'CREADA', monto: 120.50},
    {id: 'REND-005', solicitante: 'solicitante@prueba.com',estado: 'CREADA', monto: 120.50},
    {id: 'REND-006', solicitante: 'solicitante@prueba.com',estado: 'CREADA', monto: 120.50},
    {id: 'REND-007', solicitante: 'solicitante@prueba.com',estado: 'CREADA', monto: 120.50},
];

app.post('/login', (req, res)=>{
    const {email, password} = req.body;

    const usuarios =[
        {email: 'solicitante@prueba.com', password: '1234', rol: 'Solicitante'},
        {email: 'aprobador@prueba.com', password:'1234',rol: 'Aprobador'}
        ];
        
    const user = usuarios.find (u => u.email === email && u.password === password);

    if (user) {
        const token = jwt.sign(
            {sub: user.email, rol:user.rol},
            process.env.JWT_SECRET,
            {expiresIn: '2h'}
        );
       res.json({ message: 'Login Exitoso',user,token});
    } else{
        res.status(401).json({error: 'Credenciales invalidas'});
    }
});

app.get('/perfil',requireAuth, (req,res) =>{
    res.json({
        ok: true,
        user: {email: req.user.sub, rol: req.user.rol}
    });
});

app.get('/health', (req,res) =>{
    res.json({ok : true, uptime: process.uptime()});
});


