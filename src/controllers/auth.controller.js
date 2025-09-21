import * as authService from '../services/auth.service.js';
import { registerSchema, loginSchema} from '../validators/auth.schema.js';

export async function register(req,res,next) {
    try{
        const data = await registerSchema.validateAsync(req.body);
        const user = await authService.register(data);
        res.json(user);
    }   catch (e) { next(e);}    
}

export async function login(req,res,next) {
    try{
        const data = await loginSchema.validateAsync(req.body);
        const token = await authService.login(data.email,data.password);
        res.json({token});
    }   catch(e){ next(e);}    
}

