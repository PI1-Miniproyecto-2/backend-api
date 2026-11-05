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

Autenticación de usuarios, Socket.IO y Docker corresponden a otras tareas.

## Swagger / OpenAPI (TS-00-T08)

Instala las dependencias con `npm ci` y ejecuta `npm run dev` (o
`npm run build` seguido de `npm start`). Abre:

- Swagger UI: <http://localhost:3000/api-docs> (redirige a `/api-docs/`).
- Especificación JSON: <http://localhost:3000/openapi.json>.

Si cambias `PORT`, utiliza ese puerto en las URL. La especificación utiliza
`servers: [{ url: '/' }]`, por lo que Swagger apunta al mismo servidor que publica
la documentación, tanto en local como en el dominio real asignado por Render.
Esto sigue el [uso de URL relativas en OpenAPI](https://swagger.io/docs/specification/v3_0/api-host-and-base-path/).
No requiere configurar una URL de producción ni exponer variables de entorno.

En Swagger UI, despliega `GET /health`, pulsa **Try it out** y **Execute**:
debe devolver HTTP 200 con `{"status":"ok"}`. También puedes consultar el JSON:

```bash
curl http://localhost:3000/openapi.json
```

`GET /api/v1/system/status` documenta el contrato previsto
`{"status":"ok","service":"backend-api"}`. **Se integrará desde TS-00-T06**:
esta rama no implementa el endpoint, por lo que ejecutarlo devuelve 404.
La documentación conserva `/health` independiente de Firestore.

La fuente de la especificación OpenAPI 3.0.3 es `src/config/openapi.ts`; contiene
metadatos, etiquetas, contratos y esquemas reutilizables. Las rutas de publicación
están en `src/routes/docs.routes.ts`. Al añadir endpoints, actualiza la especificación
y sus pruebas. No se usa generación por anotaciones ni se necesita un paso extra de build.

Los errores documentados corresponden al middleware existente: JSON mal formado
(400), rutas no registradas (404) y errores internos (500), según corresponda.
No se documentan errores de autenticación ni de Firestore para estas rutas.
`npm test` verifica Swagger UI, sus recursos, los ejemplos y la validez estructural
de OpenAPI con un validador solo de desarrollo y sin referencias externas.
