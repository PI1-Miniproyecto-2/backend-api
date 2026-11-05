import { app } from './app';
import { env } from './config/env';

const server = app.listen(env.port, '0.0.0.0', () => {
  console.log(`API escuchando en el puerto ${env.port}`);
});

server.on('error', (error) => {
  console.error('No se pudo iniciar el servidor:', error);
  process.exitCode = 1;
});
