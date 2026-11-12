# US-01 · Registro manual: verificación y casos de prueba

Fecha: 11 de noviembre de 2026 (America/Bogota). Rama: `feature/US-01-registro-manual`.
Alcance exclusivo: US-01-07 (verificar flujo de cuentas y perfiles en API) y US-01-08 (casos de prueba).

## Flujo inspeccionado y contrato

Se revisaron las rutas, configuración Firebase Admin, servicios, controladores, middlewares, pruebas, README, modelo Firestore, evidencias TS-01 y Swagger (`src/config/openapi.ts` y `users.openapi.ts`).

1. El frontend debe crear la cuenta con correo y contraseña mediante Firebase Authentication (`createUserWithEmailAndPassword`) y obtener el ID token del usuario (`getIdToken`). Este repositorio no contiene el frontend: no se afirma que esa integración real esté ejecutada o verificada.
2. Envía `POST /api/v1/users/me`, `Authorization: Bearer <ID_TOKEN>` y únicamente datos editables: `firstName`, `lastName`, `username`, `avatarId`. Nunca contraseña, confirmación de contraseña, UID o correo en el cuerpo.
3. `auth.service.ts` utiliza `verifyIdToken(token, true)` mediante Admin SDK con inicialización diferida y ADC. Acepta `password` y `google.com`; extrae UID, correo y proveedor del token verificado.
4. `profile.service.ts` valida y crea `users/{uid}` y la reserva `usernames/{username.toLowerCase()}` en una transacción. Devuelve 201 con fechas ISO; Firestore almacena Timestamp. El correo procede del token, no del cliente.
5. Authentication y Firestore son operaciones separadas. Una cuenta sin perfil es recuperable: GET devuelve 404, se puede crear el perfil después sin repetir el alta de Authentication. POST repetido devuelve 409. Si hay timeout o error después del commit, consultar GET antes de repetir POST; si existe, continuar con ese perfil.

Se admiten perfiles incompletos también para `password`: `{}` produce 201 y `profileCompleted: false`; PATCH completa el alta. `requireCompleteProfile()` bloquea con 403 funcionalidades que lo incorporen. La ruta `/private` es exclusivamente del fixture de pruebas; no hay ruta del salón implementada en producción. DELETE del perfil no elimina la cuenta de Authentication.

No se añadieron endpoints de registro de contraseñas ni llamadas de creación de cuentas desde Admin SDK. La modificación funcional se limita a aclarar el contrato Swagger; la lógica existente satisface estos casos con mocks.

## Preparación local

Dependencias instaladas, Node compatible con `package.json`; ejecutar desde la raíz `npm run build`, `npm test`, `npm run typecheck` y `git diff --check`. No se requieren Firebase, red, ADC, tokens reales ni emuladores. Los nombres de token en las pruebas son identificadores ficticios interpretados por el verificador inyectado; no son JWT válidos.

`tests/users.test.ts` monta las rutas reales con servicios reales, verificador simulado y `MemoryStore`. Este almacén serializa transacciones y descarta escrituras abortadas; no reproduce el motor de Firestore. `tests/profile-store.test.ts` verifica el adaptador del SDK con un cliente simulado. Las pruebas existentes de TS-01 se conservan y complementan.

En la siguiente matriz, cada caso parte de un fixture nuevo salvo los pasos que crean explícitamente datos. Las columnas vacías se reservan para registrar una ejecución y su evidencia; no representan una aprobación automática de producción.

## Casos locales automatizados

| ID | Precondiciones | Pasos | Resultado esperado | Resultado obtenido | Evidencia |
| --- | --- | --- | --- | --- | --- |
| US01-L01 | Token simulado válido, proveedor password, sin perfil | GET propio; POST con nombres, username y avatar; GET propio | 404 inicial; 201; correo del token, proveedor password, perfil completo, username normalizado, reserva del UID y GET 200 idéntico | ____ | ____ |
| US01-L02 | Sin token o token inválido/expirado/revocado/cuenta deshabilitada/eliminada | POST con datos válidos para cada condición | 401 sin escrituras ni detalles internos; verificación con revocación activa | ____ | ____ |
| US01-L03 | Cabecera ausente o mal formada | GET sin cabecera, Basic, Bearer vacío, varios tokens | 401 sin invocar verificador | ____ | ____ |
| US01-L04 | Token password sin correo o con correo inválido | POST con perfil válido | 400, sin reserva ni perfil | ____ | ____ |
| US01-L05 | Perfil password existente | POST y PATCH con password, confirmPassword, email o uid aportados por cliente | 400; datos y contador de escrituras intactos; respuesta no refleja valores secretos | ____ | ____ |
| US01-L06 | Token válido, fixture vacío por variante | POST con array/null, nombre vacío/tipo inválido/>100, username corto/largo/espacios/Unicode/guion/salto de línea, avatar inválido y campos administrados | 400 antes de escribir; límites válidos de username de 3 y 20 aceptados | ____ | ____ |
| US01-L07 | Dos UID password distintos | Crear Ana_01 para uno; solicitar ANA_01 con el otro | 201 y 409; no se crea perfil del segundo ni se revela propietario | ____ | ____ |
| US01-L08 | Dos UID y mismo username libre | Lanzar POST concurrentes | Un 201 y un 409; una reserva y un perfil (simulación, no concurrencia real Firestore) | ____ | ____ |
| US01-L09 | Token password válido sin perfil | POST {}; intentar ruta privada del fixture; PATCH completo; repetir acceso | 201 incompleto con avatar_book y sin reserva; 403 privado; 200 completo con createdAt conservado; 200 privado | ____ | ____ |
| US01-L10 | Perfil password creado | Repetir POST con otro username; consultar | 409 sin sobrescritura ni nueva reserva; GET conserva perfil original | ____ | ____ |
| US01-L11 | Perfil y reserva de owner; token other | Conflicto por username; GET/PATCH/DELETE /users/owner; GET/PATCH/DELETE /me?uid=owner | Conflicto 409; rutas ajenas 404; query no cambia UID: GET/PATCH 404 y DELETE 204 sobre propio perfil ausente; owner intacto | ____ | ____ |
| US01-L12 | Identidad verificada password | Crear perfil; actualizar con identidad cuyo correo fue renovado | Correo inicial y actualizado derivados de identidad; createdAt conservado, sin campos de credenciales | ____ | ____ |
| US01-L13 | Store con errores inyectados | Ejecutar GET/POST/PATCH/DELETE con códigos 14, 10, 4 y 7 | 503 transitorios / 500 interno, sin secretos ni datos nuevos | ____ | ____ |
| US01-L14 | Fallo inyectado en segunda escritura | POST completo; inspeccionar almacén | 503; rollback simulado sin perfil ni reserva parcial | ____ | ____ |
| US01-L15 | Fallo de lectura posterior al commit | POST; GET posterior; repetir POST | POST 503 sin secretos aunque el perfil existe; GET 200 recupera; POST 409, sin duplicados | ____ | ____ |
| US01-L16 | Proveedor no permitido o verificador indisponible | POST con proveedor anonymous; GET con fallo de infraestructura Auth | 403 / 503 respectivamente, sin presentar infraestructura como token inválido | ____ | ____ |
| US01-L17 | Perfil con reserva ausente/ajena/adicional o datos corruptos | Leer, modificar, borrar e intentar acceso privado | 409; no se expone información corrupta ni se borra reserva ajena | ____ | ____ |
| US01-L18 | App y especificación locales | Consultar /openapi.json y /api-docs; validar documento y contrato POST | OpenAPI válido, Bearer obligatorio, cuerpo sin password, flujo frontend→Firebase→perfil explicado | ____ | ____ |

Referencias de ejecución: L01–L05, L07, L09–L11 y L15 incluyen pruebas con prefijo `US-01:` en `tests/users.test.ts`; L06, L08, L12–L14, L16–L17 también usan regresiones existentes en ese archivo. L18 corresponde a `tests/docs.test.ts`. La sincronización de correo L12 se verifica a nivel servicio; la autenticación real y renovación efectiva del token quedan fuera del mock.

## Casos de integración real y producción — pendientes, no ejecutados

Ejecutar primero en un entorno de pruebas autorizado con cuentas desechables. Los fallos inducidos y concurrencia deben probarse en emulador o staging. Para producción usar cuentas de prueba autorizadas, nombres únicos y evidencias redactadas; no provocar indisponibilidad ni revocar cuentas de personas reales. Estos procedimientos no autorizan despliegues ni cambios de configuración.

| ID | Precondiciones | Pasos | Resultado esperado | Resultado obtenido | Evidencia |
| --- | --- | --- | --- | --- | --- |
| US01-P01 | Frontend y API desplegados, proveedor correo/contraseña habilitado, proyecto coherente, CORS e IAM/ADC configurados | Registrar cuenta desechable desde frontend; obtener token; crear perfil con POST; consultar GET y documentos con acceso administrativo autorizado | Cuenta en Authentication; POST 201; users/{mismo UID}, correo verificado, proveedor password y reserva correcta; ningún envío de contraseña a API | Pendiente | ____ |
| US01-P02 | Cuenta desechable ya registrada en Authentication | Reintentar registro con mismo correo; probar contraseña que incumpla política configurada y correo inválido desde frontend | Firebase rechaza según su política; frontend muestra error y no solicita creación de perfil sin autenticación exitosa | Pendiente | ____ |
| US01-P03 | Cuenta de prueba sin perfil en entorno controlado | Interrumpir antes del POST o inducir fallo solo en staging; reautenticar, GET y reanudar POST sin recrear cuenta | GET 404 y posterior 201; si commit ya ocurrió, GET 200; no eliminar automáticamente cuenta Auth | Pendiente | ____ |
| US01-P04 | Dos cuentas de prueba y username único | Crear perfil A; intentar mismo nombre con B cambiando mayúsculas; consultar/modificar perfil A con token B por URL/query/cuerpo | 409 para nombre; sin acceso ajeno; A intacto | Pendiente | ____ |
| US01-P05 | Cuenta de prueba, acceso a configuración de staging | Probar token vencido/revocado, proveedor y proyecto incorrectos, cuenta deshabilitada | Acceso denegado, ningún perfil escrito; errores sin tokens ni trazas sensibles | Pendiente | ____ |
| US01-P06 | Reglas remotas revisadas; SDK cliente de prueba | Intentar acceso directo Firestore sin sesión y con sesión de prueba | Lectura/escritura directa denegadas; Admin solo mediante API con autorización por UID | Pendiente | ____ |
| US01-P07 | Emulador/staging preparado para concurrencia y fallos | Reservar simultáneamente mismo nombre; inducir aborto y fallo de lectura tras commit | Una reserva; sin cambios parciales; recuperación consultando GET | Pendiente | ____ |

Guardar como evidencia únicamente estados HTTP, cuerpos redactados, fecha, entorno, versión y capturas sin Authorization, contraseñas, ADC ni datos personales. Los mocks no prueban firma JWT, configuración real de proveedores, políticas de contraseña, CORS desplegado, IAM, reglas remotas ni reintentos del motor Firestore. El paso de validación de perfil completo debe incorporarse a futuras rutas del salón. Authentication y Firestore no comparten transacción; la reconciliación administrativa sigue pendiente en TS-01.

## Resultado de esta ejecución local

| Comando | Resultado obtenido |
| --- | --- |
| `npm run build` | Aprobado, código de salida 0. |
| `npm test` | 66 pruebas aprobadas, 0 fallidas, 0 omitidas; incluye 8 pruebas añadidas para US-01. |
| `npm run typecheck` | Aprobado, código de salida 0; incluye fuentes y pruebas. |
| `git diff --check` | Aprobado, código de salida 0. |

Los casos locales L01–L18 tienen cobertura aprobada en la suite según las referencias anteriores; las celdas individuales se conservan para adjuntar resultados y evidencia de futuras ejecuciones. La salida TAP de esta sesión identifica las pruebas ejecutadas. El primer `npm test` no arrancó por `EPERM` al crear el socket IPC local de tsx; se reejecutó con permiso para sockets locales y aprobó. No se usaron credenciales reales.

No se ejecutaron pruebas de producción, despliegues ni modificaciones del frontend. Los casos P01–P07 siguen pendientes. No se hicieron commit, push ni Pull Request.


## Seguimiento QA posterior · US-01-09 a US-01-12

El [informe QA](US-01-informe-QA.md) consolida la nueva ejecución local, las URL suministradas durante la revisión, comprobaciones públicas GET reales y los bloqueos de producción con cuentas, accesibilidad y fidelidad visual. Incluye matriz F01–F10, checklist WCAG, heurísticas, evidencias y Go/No-Go. Los resultados anteriores se conservan como histórico de US-01-07/08; los GET públicos posteriores no equivalen a ejecutar íntegramente P01–P07 ni a aprobar el registro completo.

## Continuación externa autorizada · 11 de noviembre de 2026

El responsable QA autorizó una sola cuenta ficticia y un archivo externo de credenciales con permisos 600. Se ejecutó un intento de registro sin guardar credenciales en evidencias. El frontend desplegado únicamente valida un formulario de demostración: no se observaron llamadas de alta Firebase ni de perfiles, corroborado mediante el handler público. No se confirmó una cuenta nueva ni se modificaron cuentas existentes. Véanse [informe actualizado](US-01-informe-QA.md), [intento sanitizado](evidencias/US-01/registro-autorizado.json) y [fuente pública inspeccionada](evidencias/US-01/integracion-frontend.txt).

Esta tabla añade resultados de continuación; no reemplaza el histórico local ni convierte los P01–P07 completos en aprobados.

| Caso relacionado | Verificación externa real | Estado / límite |
| --- | --- | --- |
| P01 / F01 | Intento de registro con datos válidos autorizados | FALLA: formulario sin integración Auth/API |
| P02 / F02 y F14 | Clave corta y confirmación distinta | PASA validación UI por aria-invalid, sin solicitudes; política Firebase real BLOQUEADA |
| P02 / F03 | Correo registrado | BLOQUEADO: no integración, no se actuó sobre cuenta existente |
| P01 / F04 y F08 | Creación y persistencia de perfil | BLOQUEADO: no cuenta nueva autenticada ni token |
| P04 / F05 y F09 | Username duplicado y propiedad entre dos cuentas | BLOQUEADO: no integración y autorización limitada a una cuenta |
| P05 / F06 | GET sin token/ficticio y POST vacío sin token | PASA: HTTP 401 en los tres; sin probar revocación real |
| F11 | Envío de formulario vacío | PASA errores visuales; relación y anuncio accesibles FALLA, ver D05 |
| F12 | Username qa.nombre | FALLA consistencia: UI admite punto, API no |
| F13 | Acceso directo a /register | FALLA: HTTP 404; desde raíz sí renderiza el formulario |
| P03/P06/P07 | Recuperación real, reglas y motor/concurrencia | BLOQUEADO; sin fallos inducidos en producción |

Accesibilidad y diseño: se ejecutaron Chrome headless/CDP, recorrido Tab, DOM/árbol AX, contraste de una muestra y capturas comparables con Figma publicado. Falló contraste de texto normal (3.475 y 3.009 frente a 4.5) y se observaron errores sin asociación programática. Comparación visual realizada, aprobación de diferencias pendiente. No se ejecutaron NVDA, Orca, Lighthouse o axe ni se certifica WCAG AA integral. Evidencias, procedimientos y resultados A/H/V están en el informe.


### Revalidación con cuenta de prueba actualizada

El responsable confirmó y actualizó la cuenta autorizada en el archivo externo; se utilizó sin mostrar credenciales. La [evidencia sanitizada de revalidación](evidencias/US-01/registro-revalidacion.json) confirma F02 y F14 PASA en UI con sus mensajes reales. F01 continúa FALLA: el formulario muestra «¡Formulario validado correctamente! El registro está listo para conectarse con el servidor.» y no invoca Auth/API. F04/F08 continúan BLOQUEADOS por falta de integración, no por falta de credenciales. [Despliegue revalidado](evidencias/US-01/revalidacion-publica.json): frontend, health y OpenAPI 200; mismo bundle público de demostración. No se confirmó creación de cuenta ni se actuó sobre cuentas existentes. Los resultados anteriores se conservan; véase E20–E22 del informe para evidencia nueva y verificaciones locales.
