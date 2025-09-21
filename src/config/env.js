import 'dotenv/config';
if (!process.env.JWT_SECRET) {
  console.warn('JWT_SECRET no está definido.');
}
