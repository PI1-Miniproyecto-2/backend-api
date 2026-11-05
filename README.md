# backend-api

API REST del Mini-proyecto 2 — Salón de Estudio Colaborativo en Tiempo Real.
Base de la tarea **TS-00-T04 del Sprint 0**, con Node.js, TypeScript y Express.

## Instalación

Requisitos: Node.js 20 o superior y npm.

```bash
npm ci
cp .env.example .env
npm run dev
```

El servidor escucha en `0.0.0.0` y utiliza `PORT` (3000 por defecto).
`dotenv` carga el archivo `.env`; las variables del entorno tienen prioridad.
La configuración permite inyectar variables posteriormente desde Render.

## Variables de entorno

| Variable | Predeterminado | Descripción |
| --- | --- | --- |
| `PORT` | `3000` | Puerto entero entre 1 y 65535. Un valor inválido impide el arranque. |
| `CORS_ORIGIN` | Vacío | Lista de orígenes exactos separados por comas, por ejemplo `http://localhost:5173,https://frontend.example.com`. |

Sin `CORS_ORIGIN` no se emiten cabeceras que permitan acceso entre orígenes.
CORS controla el acceso desde navegadores; no sustituye a la autenticación.
No subas `.env` ni credenciales al repositorio.

## Comandos

```bash
npm run dev        # Desarrollo con recarga automática
npm run build      # Compila src/ en dist/
npm start          # Ejecuta dist/server.js; requiere build previo
npm test           # Pruebas HTTP y validación de PORT
npm run typecheck  # Comprueba tipos del código y las pruebas
```

Para ejecutar la versión compilada:

```bash
npm run build
npm start
curl http://localhost:3000/health
```

`GET /health` devuelve HTTP 200 y `{"status":"ok"}` con contenido JSON.
Las rutas desconocidas devuelven 404, el JSON mal formado devuelve 400 y
los errores internos devuelven 500 sin exponer detalles al cliente.

## Diagnóstico de la API (TS-00-T06)

`GET /api/v1/system/status` verifica la respuesta HTTP de la API versionada.
Devuelve HTTP 200 con `Content-Type: application/json` y el siguiente cuerpo:

```json
{"status":"ok","service":"backend-api"}
```

Con el servidor en ejecución:

```bash
curl -i http://localhost:3000/api/v1/system/status
```

El endpoint no consulta Firestore ni otros servicios externos y no expone
configuración privada. `/health` conserva su respuesta original como comprobación
de salud. Métodos sin ruta registrada, como `POST /api/v1/system/status`, y rutas
inexistentes devuelven HTTP 404 con `{"error":"Ruta no encontrada"}`, siguiendo
el manejo actual del servidor.

## Estructura

```text
src/
  app.ts              # Configuración de Express, independiente del listener
  server.ts           # Inicio del servidor HTTP
  config/             # Variables de entorno y validación
  routes/             # Rutas HTTP
  controllers/        # Respuestas HTTP
  services/           # Lógica de aplicación
  middlewares/        # Manejo de errores y rutas desconocidas
tests/                # Pruebas con node:test y Supertest
.env.example          # Configuración de ejemplo sin secretos
```

Esta tarea no incorpora Firebase, Firestore, autenticación, Socket.IO,
Swagger ni Docker. Su implementación corresponde a tareas posteriores.
