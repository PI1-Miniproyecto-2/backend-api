# backend-api

API REST del Mini-proyecto 2 — Salón de Estudio Colaborativo en Tiempo Real.
Sprint 0 y **TS-01 · Autenticación y perfiles**, con Node.js, TypeScript, Express y Firebase Admin SDK.

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
| `FIREBASE_PROJECT_ID` | Sin valor | Proyecto Firebase; en desarrollo: `miniproyecto-2-c0d28`. Obligatorio al usar Firestore o Firebase Authentication. |
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
La aplicación se inicializa cuando se solicita Firestore o Authentication y se reutiliza en llamadas
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
conectividad y el campo `status` si falla. El diagnóstico HTTP `/api/v1/system/firestore-status` está protegido por `DIAGNOSTIC_API_KEY` y `x-diagnostic-key`; si no se configura, devuelve 403. `/api/v1/system/status` sigue siendo público.
También puede ejecutarse compilado con `npm run build` y
`node dist/scripts/check-firestore.js`.

Las pruebas automatizadas usan inyección de dependencias: no leen ADC ni acceden
a Firestore o a internet. Verifican éxito, documento ausente, estado inválido,
fallos de lectura y reutilización de Firebase con ADC simuladas.


TS-01 incorpora autenticación y perfiles; Socket.IO corresponde a otra tarea.

## Docker y Docker Compose (TS-00-T09)

Requisitos: Docker Engine y Docker Compose con acceso al daemon Docker.
El Dockerfile utiliza Node.js 20 y etapas separadas de compilación, dependencias
de producción y ejecución. La imagen final contiene `dist/`, los manifiestos npm
y las dependencias de producción; ejecuta `npm start` como usuario `node`.
No incluye pruebas, fuentes TypeScript del proyecto ni herramientas de desarrollo.
`.dockerignore` limita el contexto de construcción y excluye credenciales.

Para construir y ejecutar localmente con Compose:

```bash
docker compose config
docker compose build
docker compose up -d
docker compose ps
curl -i http://localhost:3000/health
docker compose logs backend-api
```

La respuesta esperada es HTTP 200 y `{"status":"ok"}`. El `HEALTHCHECK` usa
el módulo HTTP integrado de Node.js para consultar `/health` en el puerto de
ejecución, sin instalar herramientas adicionales.

Compose publica el servicio solo en `127.0.0.1:3000` por defecto. `PORT` configura el puerto
interno (3000 por defecto); `HOST_PORT` configura el puerto publicado en el equipo
(3000 por defecto). Si 3000 está ocupado, utiliza `HOST_PORT=3001 docker compose up -d`
y verifica `http://localhost:3001/health`. Usa el mismo `HOST_PORT` en los comandos
posteriores de Compose para conservar la configuración.
Compose toma `PORT`, `FIREBASE_PROJECT_ID` y `CORS_ORIGIN` de la terminal o de
`.env`, pasando únicamente esas variables al contenedor. Por ejemplo:

```bash
PORT=8080 FIREBASE_PROJECT_ID=miniproyecto-2-c0d28 docker compose up -d --build
curl -i http://localhost:3000/health
```

El ID de proyecto no es una credencial. No se copian ni se montan las ADC
personales de Ubuntu. No se valida Firestore dentro del contenedor; la
autenticación segura de producción se resolverá durante el despliegue.

Para reconstruir después de modificar código y para detener el servicio:

```bash
docker compose up -d --build
docker compose down
```

Esta ejecución local usa la imagen de producción para verificar el resultado
compilado. Para desarrollo con recarga automática, utiliza `npm run dev` fuera
del contenedor.

También puedes utilizar Docker sin Compose:

```bash
docker build -t backend-api:local .
docker run -d --name backend-api-local -p 127.0.0.1:3000:3000 -e PORT=3000 backend-api:local
curl -i http://localhost:3000/health
docker stop backend-api-local
docker rm backend-api-local
```

Detén Compose antes de este ejemplo para liberar el puerto local 3000.

Para el despliegue posterior en Render, selecciona el runtime Docker y este
Dockerfile. El servidor ya escucha en `0.0.0.0` y utiliza `PORT` recibido durante
la ejecución. `EXPOSE 3000` es informativo y no fija el puerto de Render; no se
sobrescribe `PORT` en la imagen. Configura `/health` como ruta de comprobación
del servicio. Render construye desde el Dockerfile y no necesita Compose.
Consulta [Docker en Render](https://render.com/docs/docker) y
los [requisitos de puerto de servicios web](https://render.com/docs/web-services).
Esta tarea prepara la imagen; no despliega el servicio ni configura credenciales.

El CRUD de perfiles no requiere cambios en la imagen ni servicios adicionales de Compose.

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
`{"status":"ok","service":"backend-api"}`. El endpoint GET /api/v1/system/status está implementado y documentado en OpenAPI. Devuelve HTTP 200 con {"status":"ok","service":"backend-api"} y permite comprobar el funcionamiento de la API sin consultar Firestore.
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


## TS-01 · Autenticación y perfiles

Contrato: [modelo de Firestore](docs/modelo-perfiles-firestore.md). Evidencias y pendientes: [TS-01](docs/TS-01-evidencias-tecnicas.md).

El frontend inicia sesión con Firebase Authentication (password o Google) y envía su ID token en `Authorization: Bearer <ID_TOKEN>`. No accede directamente a Firestore ni envía contraseñas a esta API. El backend usa `verifyIdToken(token, true)` para comprobar firma, expiración y revocación. UID, correo y proveedor se obtienen de esa identidad verificada; un error de credenciales del servidor no se presenta como un token inválido del usuario.

| Endpoint | Éxito | Uso |
| --- | --- | --- |
| `POST /api/v1/users/me` | 201 | Crear perfil, opcionalmente incompleto con `{}`. |
| `GET /api/v1/users/me` | 200 | Leer perfil propio. |
| `PATCH /api/v1/users/me` | 200 | Cambiar campos editables o completar el perfil. |
| `DELETE /api/v1/users/me` | 204 | Eliminar perfil y liberar nombre; no elimina Authentication. |

POST y PATCH reciben un objeto JSON con solo `firstName`, `lastName`, `username` y `avatarId`. Ejemplo: `{"firstName":"Ana","lastName":"Perez","username":"Ana_01","avatarId":"avatar_book"}`. Los campos son opcionales para permitir alta por pasos; los nulos siguen las restricciones del modelo. Catálogo: `avatar_book`, `avatar_owl`, `avatar_lamp`. Un nombre tiene 3–20 caracteres ASCII alfanuméricos o `_`, con unicidad insensible a mayúsculas. Se rechazan campos desconocidos y administrados por el servidor. Las fechas se almacenan como Timestamp y se devuelven como cadenas ISO.

Las rutas solo operan sobre el UID del token. Los errores devuelven `{"error":"mensaje en español"}` con 400, 401, 403, 404, 409, 500 o 503 según el contrato. POST repetido devuelve 409; DELETE repetido devuelve 204 si no quedan reservas. Ante un timeout, consultar GET antes de repetir una escritura. Los perfiles incompletos pueden gestionar su alta, pero `requireCompleteProfile()` debe proteger las futuras funcionalidades del salón. No se añaden rutas del salón en esta tarea.

`auth.service` verifica y reduce la identidad; `auth.middleware` protege las rutas; `users.controller` traduce HTTP; `profile.service` aplica reglas y transacciones; `profile.store` adapta Firestore. El servicio detecta reservas huérfanas o ajenas y bloquea con 409 sin sobrescribirlas. La reconciliación administrativa queda pendiente; no hay borrado automático de cuentas Auth por errores de Firestore.

### Ejecución local y ADC para Authentication

No se requieren dependencias npm nuevas ni variables de aplicación adicionales. Se conserva `applicationDefault()` y `FIREBASE_PROJECT_ID`. Mantener ADC fuera del repositorio. Tener ADC que permiten leer Firestore no demuestra que permitan consultar Authentication para comprobar revocación.

La [documentación oficial de Firebase Admin](https://firebase.google.com/docs/admin/setup#test_with_gcloud_end_user_credentials) indica que las credenciales de usuario generadas con el cliente OAuth predeterminado de gcloud no son aceptadas por Firebase Authentication. Para este flujo local, un administrador debe disponer de un cliente OAuth de tipo Desktop y ejecutar, fuera del repositorio:

```bash
gcloud auth application-default login --client-id-file=/ruta/externa/oauth-desktop.json
```

El archivo OAuth y las ADC son configuración externa; no deben copiarse aquí. El proyecto se proporciona explícitamente mediante `FIREBASE_PROJECT_ID`. La identidad debe tener permisos IAM de lectura/escritura de documentos y consulta de usuarios Auth para la comprobación de revocación, con mínimo privilegio. Activar password y Google en Authentication y configurar los dominios autorizados del frontend. Estas acciones no se han ejecutado en esta intervención.

### Reglas de Firestore

No existían reglas versionadas en este repositorio. `firestore.rules` deniega toda lectura y escritura de SDK cliente en todas las colecciones, incluyendo `users`, `usernames` y diagnósticos. Admin SDK utiliza IAM y omite estas reglas; la API aplica autorización por UID. Esto es compatible con el acceso exclusivamente desde backend previsto aquí, pero antes de publicar hay que comparar con las reglas remotas y confirmar que ningún otro cliente del proyecto depende de acceso directo.

Con Firebase CLI disponible, usar primero un proyecto demo sin datos reales:

```bash
firebase emulators:start --only firestore --project demo-backend-api
```

Verificar con SDK cliente contra el emulador que GET, LIST, CREATE, UPDATE y DELETE fallan con `permission-denied`, tanto sin autenticar como autenticado, para `users`, `usernames` y otra colección. Verificar también que Admin accede al emulador y que dos clientes concurrentes no pueden reservar el mismo nombre. Las pruebas unitarias incluidas simulan transacciones; no sustituyen estas comprobaciones del motor y de las reglas. No usar Admin para demostrar que las reglas deniegan acceso, porque las omite.

Tras validar y revisar las reglas remotas, publicar y volver a verificarlas en Firebase Console:

```bash
firebase deploy --only firestore:rules --project "$FIREBASE_PROJECT_ID"
```

`firebase.json` solo apunta al archivo de reglas; no configura Hosting ni crea servicios adicionales. La CLI requiere sesión y permisos de despliegue independientes de las ADC de la aplicación. Referencia: [publicar reglas](https://firebase.google.com/docs/rules/manage-deploy). Las reglas no se han publicado ni probado en emulador en esta intervención; no está instalada Firebase CLI.

### Docker y Render con TS-01

Se conserva el Dockerfile multi-stage y `compose.yaml`: no hay dependencias ni servicios adicionales. `docker compose config --quiet` valida la configuración. Compose no monta las ADC locales, de modo que arrancar `/health` no demuestra que Auth o Firestore estén operativos dentro del contenedor.

En Render, crear o actualizar el Web Service con runtime Docker, puerto proporcionado por Render y health check `/health`. Configurar `FIREBASE_PROJECT_ID` y `CORS_ORIGIN` del frontend; no usar `*` como sustituto de los orígenes previstos. `/health` y `/api/v1/system/status` son comprobaciones HTTP, no de disponibilidad de Firebase. El diagnóstico existente de Firestore conserva su clave opcional `DIAGNOSTIC_API_KEY`; no exponerla en el frontend.

Render necesita una identidad de ejecución compatible con ADC: no hereda las ADC de Ubuntu. La provisión de esa identidad por el administrador es un requisito pendiente del despliegue. Si se utiliza un archivo de credenciales autorizado, se suministra exclusivamente como secreto de ejecución fuera de Git y de la imagen y ADC puede localizarlo mediante `GOOGLE_APPLICATION_CREDENTIALS` apuntando al archivo externo. Nunca hardcodear su contenido ni añadir claves al `.env.example`. Render documenta los archivos secretos en `/etc/secrets/<filename>` y su uso con Docker en [variables y secretos](https://render.com/docs/configure-environment-variables#secret-files). No se han creado ni cargado credenciales. La opción concreta de identidad debe validarse con Auth y Firestore antes de producción.

Tras el despliegue autorizado, verificar Swagger, token ausente (401), perfil propio con token válido, unicidad, cambios y liberación del nombre, y denegación de acceso directo a Firestore. Capturar evidencias sin tokens ni correos personales. El borrado de cuenta Auth requerirá un flujo separado con consentimiento explícito, autenticación reciente, limpieza idempotente y recuperación de fallos parciales; no está expuesto por este CRUD.

### Validación local

```bash
npm run build
npm test
npm run typecheck
git diff --check
```

Las pruebas usan identidades y almacenamiento simulados, sin ADC ni acceso a Firebase real. Cubren HTTP, validaciones, perfiles incompletos, permisos, nombres concurrentes, fallos y OpenAPI con el validador instalado. No requieren ejecutar `check:firestore`, que consulta un proyecto real.
