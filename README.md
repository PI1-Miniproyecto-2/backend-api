# backend-api

API REST del Mini-proyecto 2 — Salón de Estudio Colaborativo en Tiempo Real.
Tareas **TS-00-T04 y TS-00-T05 del Sprint 0**, con Node.js, TypeScript, Express y Firebase Admin SDK.

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
| `FIREBASE_PROJECT_ID` | Sin valor | Proyecto Firebase; en desarrollo: `miniproyecto-2-c0d28`. Obligatorio solo al usar Firestore. |
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
npm test           # Pruebas HTTP, PORT y Firebase/Firestore con dependencias simuladas
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

## Estructura

```text
src/
  app.ts              # Configuración de Express, independiente del listener
  server.ts           # Inicio del servidor HTTP
  config/             # Variables de entorno y validación
  routes/             # Rutas HTTP
  controllers/        # Respuestas HTTP
  services/           # Lógica de aplicación y acceso a Firestore
  scripts/            # Diagnósticos manuales sin rutas públicas
  middlewares/        # Manejo de errores y rutas desconocidas
tests/                # Pruebas con node:test y Supertest
.env.example          # Configuración de ejemplo sin secretos
```

## Firebase y Firestore (TS-00-T05)

La integración utiliza `applicationDefault()` de Firebase Admin SDK y la base
Firestore `(default)`. Consulta la [documentación oficial de ADC con Firebase Admin](https://firebase.google.com/docs/admin/setup).
La aplicación se inicializa cuando se solicita Firestore y se reutiliza en llamadas
posteriores. `/health` no inicializa Firebase ni comprueba Firestore.

En Ubuntu, utiliza las ADC locales de Google Cloud CLI ya configuradas. No hace
falta volver a iniciar sesión si están vigentes. Para configurar otro entorno local:

```bash
gcloud auth application-default login
```

Configura en `.env` (o exporta en la terminal):

```dotenv
FIREBASE_PROJECT_ID=miniproyecto-2-c0d28
```

No configures `GOOGLE_APPLICATION_CREDENTIALS` con una clave privada para este flujo.
No abras ni copies el archivo de ADC al repositorio. Las reglas de `.gitignore`
excluyen ADC, configuraciones locales de gcloud y claves de cuentas de servicio.
La identidad de ADC debe tener permiso IAM para leer el documento de Firestore;
Firebase Admin utiliza IAM, no las reglas de seguridad del cliente web.

Con internet disponible y `FIRESTORE_EMULATOR_HOST` sin configurar, ejecuta manualmente:

```bash
npm run check:firestore
```

El script lee exclusivamente `system_checks/connection-test` sin modificar datos.
Comprueba que existe y que `status` es exactamente `"ok"`. En caso de éxito muestra
un mensaje y termina con código 0; en caso de fallo muestra un mensaje sin
credenciales y termina con código 1. Revisa el proyecto, ADC, permisos IAM,
conectividad y el campo `status` si falla. No hay un endpoint de diagnóstico.
También puede ejecutarse compilado con `npm run build` y
`node dist/scripts/check-firestore.js`.

Las pruebas automatizadas usan inyección de dependencias: no leen ADC ni acceden
a Firestore o a internet. Verifican éxito, documento ausente, estado inválido,
fallos de lectura y reutilización de Firebase con ADC simuladas.

Autenticación de usuarios, Socket.IO, Swagger y Docker corresponden a otras tareas.
