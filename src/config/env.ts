import 'dotenv/config';

export function parsePort(value: string | undefined): number {
  if (value === undefined) return 3000;
  if (!/^\d+$/.test(value)) throw new Error('PORT debe ser un entero entre 1 y 65535');
  const port = Number(value);
  if (port < 1 || port > 65535) throw new Error('PORT debe estar entre 1 y 65535');
  return port;
}

export const env = {
  port: parsePort(process.env.PORT),
  corsOrigins: (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};
