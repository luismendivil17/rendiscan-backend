import Joi from 'joi';


export const registerSchema = Joi.object({
    nombre: Joi.string().min(2).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    rol: Joi.string().valid('solicitante','jefe','contabilidad').default('solicitante')
});

export const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
});