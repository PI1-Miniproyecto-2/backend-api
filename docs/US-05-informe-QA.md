# US-05 · Informe QA de eliminación de cuenta

19 de noviembre de 2026 (America/Bogota) · Rama `feature/US-05-eliminar-cuenta` · Base `ef756a3` · Responsable Yoselin, Backend Lead y QA

## 1. Objetivo y alcance

Verificar la eliminación de cuenta propia en `DELETE /api/v1/users/me`, actualizar el contrato Swagger y registrar los casos de aceptación. El árbol de trabajo inicial estaba limpio. Las comprobaciones cubren el backend y las dependencias simuladas. [Casos de prueba](US-05-casos-prueba.md).

## 2. Entorno de pruebas

Linux, Node.js 20.19.5, npm 10.8.2, TypeScript, `node:test`, `tsx`, Supertest y sockets HTTP locales. La suite usa un verificador y un servicio de baja Auth simulados, `MemoryStore` y la validación local de Swagger. La prueba de concurrencia coordina dos solicitudes reales contra estos dobles. Se usaron identidades sintéticas y la ejecución se limitó al entorno local.

## 3. Pruebas automatizadas realizadas

- Se conservaron las 85 pruebas de la base. Se reutilizaron la baja exitosa, protección del UID propio, consistencia de reservas, errores en Firestore y Auth, bloqueo de recreación, reintento y concurrencia.
- Se amplió la cobertura de 401 sin filtración para cuenta deshabilitada y demás rechazos de DELETE, de 403 para `auth_time` ausente, inválido, futuro o de más de cinco minutos, de 408 para lectura chunked abierta, y del acceso a la ruta privada de prueba tras la baja.
- Se agregaron dos pruebas. Una corta la conexión tras confirmar la baja de Auth y verifica que el intento siguiente recibe 401. La otra verifica el contrato de DELETE servido por Swagger.

## 4. Resultados obtenidos

| Verificación | Resultado |
| --- | --- |
| `npm run typecheck` | Aprobada |
| `npm run build` | Aprobada |
| `npm test` | 87 ejecutadas, 87 aprobadas, 0 fallidas, 0 canceladas y 0 omitidas |
| Validación OpenAPI 3.0.3 y contrato DELETE | Aprobada dentro de la suite |
| `git diff --check` | Aprobada |

Las pruebas verificaron el aislamiento entre identidades, el rechazo de un UID ajeno, los mensajes genéricos y la ausencia de escrituras o bajas Auth ante rechazos de entrada y autenticación. La ruta privada usada para verificar el rechazo posterior a la eliminación pertenece al fixture de prueba.

## 5. Errores encontrados

Swagger aún describía la eliminación exclusiva del perfil y anunciaba un 404 en la operación DELETE que no corresponde a la ausencia del perfil propio. Se actualizó la especificación según el funcionamiento del commit base. El 408 corresponde al plazo de cinco segundos del controlador para la lectura chunked que queda pendiente después del parser global. En particular, el plazo del controlador no se aplica al tiempo que consume ese parser antes de invocar DELETE. Las pruebas no revelaron un defecto de seguridad que exigiera modificar el código funcional.

## 6. Riesgos y limitaciones

**Confirmación y fallos parciales.** Firestore confirma la eliminación del perfil y su reserva y guarda la marca en una sola transacción. Después se llama a Auth. Si falla Auth o se interrumpe el proceso entre ambos pasos, los datos ya pueden estar eliminados aunque la identidad siga activa. Se permite repetir DELETE con una identidad válida y autenticación reciente. Si dos solicitudes pasan la autenticación antes de la baja, ambas pueden recibir 204 cuando Auth confirme la eliminación o indique `auth/user-not-found`. Tras una desconexión, un 401 posterior rechaza la autenticación y no acredita por sí solo el resultado anterior. El doble serializa transacciones y no acredita contención, reintentos o aislamiento del motor real. Tampoco verifica firma, revocación real ni IAM.

**Marca y datos.** `account_deletions/{sha256(uid)}` almacena `requestedAt` como fecha del servidor. POST y PATCH consultan la marca dentro de sus transacciones y rechazan recrear o modificar el perfil, incluso si la solicitud ya pasó la autenticación. Los reintentos conservan la marca original. Tras eliminar Auth, la marca permanece y las nuevas solicitudes con el token anterior se rechazan en autenticación. La marca registra la fase de Firestore, por lo que su presencia no certifica la baja de Auth.

El hash del UID es determinista y se puede correlacionar con un UID conocido. No equivale a anonimización ni protege frente a probar identificadores de baja entropía. La retención indefinida implica riesgo de correlación y acumulación, y bloquea el uso del mismo UID si se reasigna. La duración, el acceso y la eliminación de la marca quedan pendientes de una política del equipo. Antes de purgarla debe existir una forma de impedir la recreación con solicitudes ya autenticadas o tokens previamente emitidos.

La inspección de `src` identificó `users`, `usernames`, `account_deletions` y un documento de diagnóstico en `system_checks`, sin modelos, rutas ni escrituras de salas o mensajes asociados al usuario en esta rama. La política de datos compartidos requiere acuerdo del equipo. El flujo de US-05 actúa sobre el perfil, la reserva y la marca.

## 7. Pruebas pendientes en producción

- **Render y Firebase controlado.** Confirmar, con la identidad de ejecución y cuentas desechables autorizadas, que ADC permite leer y escribir los documentos y consultar las reservas de Firestore, verificar la identidad y eliminar usuarios mediante Firebase Admin. Comprobar en particular `firebaseauth.users.delete`. Registrar el resultado IAM y contrastar el estado real de Auth y Firestore antes y después de DELETE, incluyendo concurrencia y reintentos. [Permisos de Firebase Authentication](https://docs.cloud.google.com/iam/docs/roles-permissions/firebaseauth)
- **Vercel con Angie.** Verificar confirmación, cancelación sin solicitud DELETE, reautenticación, cierre de sesión después de 204 y tratamiento de respuestas ambiguas. La evidencia del frontend queda pendiente de integración.
- **Evidencia para el DUE.** Adjuntar salida de validaciones locales, matriz de casos y captura del Swagger actualizado. En despliegue controlado, registrar fecha y revisión, códigos HTTP, comprobación de permisos, estado de documentos y evidencias del flujo de confirmación y cancelación. Redactar identificadores y excluir tokens, credenciales y datos personales. La ejecución de Render y Vercel sigue pendiente.

## 8. Recomendación Go / No-Go

**Go preliminar para integración del backend.** Las 87 pruebas locales y la validación OpenAPI pasan. **No-Go para aprobación definitiva de producción** hasta verificar el despliegue real, los permisos efectivos, la eliminación y persistencia con Firebase y el flujo de confirmación y cancelación con el frontend.
