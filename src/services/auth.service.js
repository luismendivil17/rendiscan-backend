import bcrypt from 'bcrypt'; 
import jwt from 'jsonwebtoken';
import {q} from '../db/index.js';

export async function register({nombre,email,password,rol}) {
    const hash = await bcrypt.hash(password,10);
    const sql = `INSERT INTO usuarios (nombre,email,password,rol)
               VALUES ($1,$2,$3,$4) RETURNING id,nombre,email,rol`;
    const { rows} = await q(sql, [nombre, email, hash, rol]);
    return rows[0];
}

export async function login(email, password) {
  const { rows } = await q(`SELECT * FROM usuarios WHERE email=$1`, [email]);
  const user = rows[0];
  if (!user) {
    throw Object.assign(new Error('Credenciales inválidas'), { status: 401 });
  }

  const isValid = await bcrypt.compare(password, user.password); 
  if (!isValid) {
    throw Object.assign(new Error('Credenciales inválidas'), { status: 401 });
  }

  return jwt.sign(
    { id: user.id, rol: user.rol },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );
}