# TS-01 · Evidencias técnicas

Fecha: 10 de noviembre de 2026 (America/Bogota). Rama: `feature/TS-01-firebase-auth-perfiles`.

## Alcance entregado

| Tarea | Implementación y evidencia |
| --- | --- |
| A · Autenticación | Servicio reutilizable con Firebase Admin y `verifyIdToken(token, true)`, middleware Bearer e identidad mínima tipada e inmutable. Errores de token 401; proveedor no permitido 403; fallos internos no se disfrazan de token inválido. |
| B · Modelo | `users/{uid}`, `usernames/{normalizado}`, avatar predeterminado y catálogo explícito, campos administrados desde identidad verificada y Timestamp de servidor. Google y password admiten alta por pasos. |
| C · CRUD | POST/GET/PATCH/DELETE `/api/v1/users/me`, solo sobre UID autenticado. DELETE elimina perfil y reserva, sin llamadas para borrar Authentication. |
| D · Unicidad | Transacciones con lectura de perfil, reservas del UID, reserva anterior y destino antes de escribir. Cambio y liberación atómicos; conflictos 409. |
| E · Validaciones | Tipos, longitudes, nulos, regex completa, catálogo y lista cerrada de campos; detección de datos corruptos y reservas huérfanas. Respuestas sanitizadas en español. |
| F · Reglas | `firestore.rules` deniega todo acceso directo de clientes; `firebase.json` prepara publicación. No había reglas versionadas previas. Reglas remotas, emulador y publicación pendientes. |
| G · Documentación | Swagger CRUD con Bearer, cuerpos, respuestas y errores; README con ADC local, Docker, Render y publicación de reglas. Contrato ampliado con decisiones concretas. |
| H · Pruebas | 58 pruebas aprobadas, 0 fallidas; incluyen 15 pruebas previas de Sprint 0 sin cambiar sus aserciones. |
| I · Evidencias | Este documento, matriz de casos y separación entre resultados locales y validaciones externas. |

No se cambiaron dependencias, tsconfig, Dockerfile, Compose, `.env.example` ni `src/config/firebase.ts`: no hacen falta nuevas variables de aplicación ni claves para implementar el flujo. Se conserva ADC e inicialización diferida. Se retiró del README un bloque de texto ajeno al proyecto que interrumpía la sección Swagger.

## Archivos

Modificados:

- `README.md`
- `docs/modelo-perfiles-firestore.md`
- `src/config/openapi.ts`
- `src/middlewares/error.middleware.ts`
- `src/routes/index.ts`
- `tests/docs.test.ts` (se añade una prueba, conservando las anteriores)

Creados:

- `docs/TS-01-evidencias-tecnicas.md`
- `firebase.json`
- `firestore.rules`
- `src/config/avatars.ts`
- `src/config/users.openapi.ts`
- `src/controllers/users.controller.ts`
- `src/middlewares/auth.middleware.ts`
- `src/middlewares/profile.middleware.ts`
- `src/models/user-profile.ts`
- `src/routes/users.routes.ts`
- `src/services/api-error.ts`
- `src/services/auth.service.ts`
- `src/services/profile.service.ts`
- `src/services/profile.store.ts`
- `src/services/profile.validation.ts`
- `src/types/express.d.ts`
- `tests/helpers/memory-store.ts`
- `tests/profile-store.test.ts`
- `tests/users.test.ts`

## Endpoints y decisiones

| Método y ruta | Respuesta de éxito |
| --- | --- |
| `POST /api/v1/users/me` | 201 con perfil propio |
| `GET /api/v1/users/me` | 200 con perfil propio |
| `PATCH /api/v1/users/me` | 200 con perfil actualizado |
| `DELETE /api/v1/users/me` | 204 sin cuerpo |

Se conservan `/health`, `/api/v1/system/status`, `/api-docs` y `/openapi.json` públicos. `/api/v1/system/firestore-status` conserva su comprobación de `DIAGNOSTIC_API_KEY` y `x-diagnostic-key`; no se modificó esa ruta ni su controlador.

POST/PATCH requieren objeto JSON; `{}` permite alta por pasos o sincronización. PATCH conserva los campos omitidos; no permite limpiar el username asignado ni vaciar nombres de un perfil completo. Se recortan nombres personales, pero no username. Se rechaza expresamente el salto de línea final que el ancla `$` de JavaScript puede admitir. El catálogo permitido es `avatar_book`, `avatar_owl` y `avatar_lamp`.

Las fechas persistidas son Timestamp y la API las serializa como ISO. El backend relee tras confirmar una escritura para resolverlas; si esa lectura falla, la escritura podría haberse confirmado. Tras un timeout o respuesta ambigua, consultar antes de repetir. La creación repetida devuelve 409 y no sobrescribe; la eliminación repetida devuelve 204 solo si no quedan reservas del UID.

`requireCompleteProfile()` valida la existencia, completitud y coherencia de reservas. Se prueba con una ruta local de la suite; las futuras rutas del salón deberán aplicar este middleware después de autenticación. No se inventaron funcionalidades privadas del salón en producción.

La reconciliación de datos corruptos se documenta y bloquea con 409; no se implementó un proceso automático que pueda sobrescribir reservas ajenas. La eliminación integral de cuenta Auth queda como flujo separado futuro, con consentimiento explícito, autenticación reciente y limpieza idempotente recuperable. El CRUD no anuncia ni ejecuta esa eliminación.

## Matriz de casos

Los resultados siguientes son locales con mocks, salvo donde se indica expresamente.

| Caso | Resultado esperado | Resultado obtenido |
| --- | --- | --- |
| 1 · Token ausente o cabecera mal formada | 401 antes de acceder a datos | Aprobado |
| 2 · Token inválido | 401 sin detalles internos | Aprobado |
| 3 · Token expirado | 401 | Aprobado |
| 4 · Token revocado | 401 con comprobación de revocación activada | Aprobado |
| 5 · Token válido | Identidad mínima, `checkRevoked: true` | Aprobado |
| 6 · Crear perfil | 201, campos derivados, fechas y reserva | Aprobado |
| 7 · Consultar perfil propio | 200 con el perfil | Aprobado |
| 8 · Actualizar perfil | 200, preserva `createdAt` y campos omitidos | Aprobado |
| 9 · Eliminar perfil | 204; repetición segura | Aprobado |
| 10 · Nombre ocupado | 409, insensible a mayúsculas | Aprobado |
| 11 · Solicitudes concurrentes | Un 201 y un 409, una reserva | Aprobado con almacenamiento simulado; pendiente motor Firestore |
| 12 · Cambio de nombre | Nuevo reservado y anterior liberado juntos | Aprobado |
| 13 · Liberación al eliminar | Otro UID puede reservar después | Aprobado |
| 14 · Campos inválidos | 400 antes de escribir | Aprobado; incluye límites y salto de línea |
| 15 · Campos desconocidos | 400 sin escrituras | Aprobado |
| 16 · Campos administrados | 400 para UID, correo, proveedor, fechas, completitud y normalización | Aprobado |
| 17 · Perfil incompleto | Alta permitida, privado 403, acceso tras completar | Aprobado |
| 18 · Fallos Firestore | 503 transitorio / 500 interno, sin secretos ni cambios parciales | Aprobado con fallos inyectados |
| 19 · OpenAPI | CRUD, seguridad, campos, errores y documento válido | Aprobado con SwaggerParser y pruebas HTTP |
| 20 · Regresión Sprint 0 | Todas las pruebas anteriores pasan | 15/15 aprobadas |
| Cuenta eliminada o deshabilitada | 401 | Aprobado con errores del verificador simulado |
| Proveedor no permitido / correo ausente | 403 / 400 | Aprobado |
| UID ajeno | No leer ni modificar otro perfil | Aprobado |
| Reserva ajena, ausente o adicional | 409, sin borrado ajeno ni acceso privado | Aprobado |
| Cambio de correo y proveedor password | Identidad derivada, sincronización en PATCH | Aprobado |
| Adaptador Firestore | Cliente diferido, transacción, consulta por UID y serverTimestamp | Aprobado con SDK simulado |
| Reglas de cliente autenticado/no autenticado | Denegar GET/LIST/CREATE/UPDATE/DELETE | Pendiente emulador y Console; no se afirma validado |

El almacenamiento de prueba serializa transacciones, descarta cambios si fallan y prohíbe lecturas después de escribir. Esto verifica el comportamiento de los servicios y las respuestas HTTP, pero no reproduce los bloqueos, reintentos ni tiempos del motor Firestore real. Una prueba separada verifica el adaptador hacia las primitivas del SDK. Los tokens simulados no prueban una firma real ni la configuración IAM.

## Comandos y resultados reales

| Comando / comprobación | Resultado |
| --- | --- |
| `npm run build` | Aprobado, TypeScript estricto compila |
| `npm test` | 58 pruebas, 58 aprobadas, 0 fallidas, 0 omitidas |
| `npm run typecheck` | Aprobado, código y pruebas |
| Validación OpenAPI | Aprobada dentro de `npm test`, sin referencias externas |
| `git diff --check` | Aprobado |
| `git status --short` | Solo archivos de TS-01 enumerados arriba; sin commit |
| `docker compose config --quiet` | Aprobado |
| `docker build -t backend-api:ts01-review .` | Aprobado; imagen construida con el Dockerfile existente |
| Smoke test Docker sin red externa | Aprobado: health 200, sistema 200, OpenAPI 200, perfil sin token 401, diagnóstico sin clave 403 |
| Firebase CLI | No instalada; emulador y publicación no ejecutados |
| Render / Firebase real | No desplegados ni consultados para CRUD |

El primer intento de `npm test` no pudo arrancar por EPERM en el socket IPC local de tsx dentro del sandbox; la suite se ejecutó después con permiso para sockets locales y pasó completa. Las pruebas no leyeron ADC ni accedieron a un proyecto Firebase. El primer acceso a Docker también fue bloqueado por permisos del sandbox; se reintentó la construcción fuera de ese límite.

## Pendientes externos y riesgos

- `npm ci` durante la construcción Docker informó 8 vulnerabilidades moderadas en el árbol de dependencias existente, tanto en la instalación completa como en producción. No se modificaron manifiestos ni lockfile. Pendiente analizar los avisos con `npm audit` y preparar una actualización compatible antes de producción; no se aplicó `npm audit fix --force`.

- Verificar con identidad real autorizada ADC, permisos IAM para documentos y consulta de usuarios Auth, password/Google y dominios del frontend. Las ADC estándar de usuario de gcloud requieren un cliente OAuth propio para Authentication según la [documentación oficial](https://firebase.google.com/docs/admin/setup#test_with_gcloud_end_user_credentials). Esto no se validó con credenciales reales.
- Provisionar una identidad ADC de ejecución en Render mediante configuración externa segura. No se cargaron claves, archivos secretos ni tokens. El detalle de archivos secretos de Render está documentado en el README y en su [documentación oficial](https://render.com/docs/configure-environment-variables#secret-files).
- Instalar Firebase CLI en el entorno de validación y probar reglas y concurrencia con emulador. Comparar las reglas remotas antes de publicar: denegar todas las colecciones podría afectar clientes externos que no se observan en este repositorio. El procedimiento de publicación está preparado, pero no ejecutado.
- Capturar evidencias reales de Render (deploy y health), Firebase Console (proveedores y reglas), Swagger (operaciones autenticadas) y Firestore (perfil/reserva, cambio y eliminación), ocultando datos personales y credenciales. No se generaron capturas ficticias.
- La reconciliación administrativa y la eliminación integral de cuenta no están automatizadas. Los estados incoherentes se bloquean; el procedimiento de diagnóstico y reparación segura permanece documentado en el modelo.
- Las operaciones entre Authentication y Firestore no son atómicas; puede cambiar el estado de la cuenta después de verificar el token. No se promete consistencia transaccional entre servicios.

## Recomendación de revisión

GO para revisión y, tras la aprobación humana del diff, commit, push y Pull Request de TS-01. NO-GO para declarar un despliegue de producción validado hasta completar ADC/IAM, reglas, emulador y evidencias reales. No se ejecutaron commit, push, merge, cambio de rama ni Pull Request.
