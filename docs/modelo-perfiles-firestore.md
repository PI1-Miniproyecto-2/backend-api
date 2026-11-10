# TS-01 · Modelo de perfiles de usuarios en Firestore

## Alcance y contexto

Diseño del modelo de perfiles del Salón de Estudio Colaborativo. Este documento define lo que se implementará posteriormente; no crea datos, endpoints ni configuración.

El repositorio utiliza Node.js, TypeScript, Express y Firebase Admin SDK. Según `README.md`, `src/config/firebase.ts` y `src/services/firestore.service.ts`, Firebase se inicializa de forma diferida mediante `applicationDefault()` (ADC), utiliza `FIREBASE_PROJECT_ID` y accede a Firestore `(default)`. Se reutilizarán esa aplicación y ese cliente. Las futuras rutas seguirán el prefijo `/api/v1` y la separación entre rutas, controladores, servicios y middlewares. La autenticación y las operaciones de perfiles descritas aquí todavía no están implementadas.

El frontend se autenticará con Firebase Authentication y enviará su ID token a la API mediante `Authorization: Bearer <ID_TOKEN>`. El backend lo verificará con Firebase Admin SDK antes de operar. El UID y el correo procederán exclusivamente del token verificado, nunca de valores declarados en el cuerpo, parámetros o cabeceras adicionales del cliente. Si el token no contiene un correo válido, se rechazará la creación o sincronización del perfil; no se inventará uno.

El frontend no accederá directamente a Firestore. El acceso de clientes deberá denegarse mediante reglas de Firestore; Firebase Admin utiliza IAM y no esas reglas, por lo que la API deberá aplicar su propia autorización. CORS no sustituye este control. Nunca se almacenarán contraseñas, ID tokens, refresh tokens ni credenciales en estos documentos.

## Esquema de colecciones

```text
Firestore (default)
├── users
│   └── {uid de Firebase Authentication}
│       ├── firstName
│       ├── lastName
│       ├── username
│       ├── usernameNormalized
│       ├── email
│       ├── avatarId
│       ├── authProvider
│       ├── profileCompleted
│       ├── createdAt
│       └── updatedAt
└── usernames
    └── {usernameNormalized}
        └── uid → users/{uid}
```

Estas colecciones coexistirán con los documentos de diagnóstico existentes, como `system_checks/connection-test`, sin modificarlos. El catálogo de avatares se mantendrá en el backend; este diseño no requiere una colección adicional.

## Colección `users`

Un documento por usuario en `users/{uid}`. Su ID es exactamente el UID de Firebase Authentication; no es necesario duplicarlo como campo. Todos los campos siguientes estarán presentes, usando `null` solo donde se indica.

| Campo | Tipo Firestore | Regla y significado |
| --- | --- | --- |
| `firstName` | string o null | Nombre, sin espacios en los extremos, entre 1 y 100 caracteres si se informa; obligatorio para completar el perfil. |
| `lastName` | string o null | Apellido, sin espacios en los extremos, entre 1 y 100 caracteres si se informa; obligatorio para completar el perfil. |
| `username` | string o null | Nombre elegido, conservando sus mayúsculas; `null` mientras no se haya elegido. |
| `usernameNormalized` | string o null | `username.toLowerCase()`; `null` si `username` es `null`. |
| `email` | string | Correo obtenido del ID token verificado; no editable mediante el cuerpo de la API de perfiles. |
| `avatarId` | string | Identificador de un avatar del catálogo permitido; siempre tendrá un valor válido, incluido el predeterminado. |
| `authProvider` | string | `password` o `google.com`, derivado de `firebase.sign_in_provider` del token verificado. |
| `profileCompleted` | boolean | Calculado por el backend; verdadero solo si nombres, apellido y avatar son válidos y el nombre está reservado para ese UID. |
| `createdAt` | Timestamp | Generado por el servidor al crear el documento; inmutable en actualizaciones. |
| `updatedAt` | Timestamp | Generado por el servidor al crear o modificar el documento. |

Las escrituras usarán `FieldValue.serverTimestamp()` para ambas fechas al crear y para `updatedAt` al actualizar. No se aceptarán fechas suministradas por el cliente ni se persistirán cadenas ISO como fechas.

`authProvider` representa el proveedor de la última autenticación aceptada y sincronizada por la API; no pretende enumerar todas las identidades vinculadas. Si un usuario vincula password y Google, ambos accesos conservarán el mismo documento cuando Authentication les asigne el mismo UID. No se unirán perfiles por coincidencia de correo. Un proveedor diferente de los dos permitidos se rechazará.

El correo y el proveedor se sincronizarán desde un token verificado vigente en una operación de creación o actualización. Un cambio de correo requiere primero el flujo de Authentication y renovar el token. La lectura del perfil no permitirá al cliente reemplazar estos campos.

## Colección `usernames` y reglas de nombres

Cada documento `usernames/{usernameNormalized}` tendrá únicamente el campo `uid` (string), correspondiente al propietario en Authentication y al ID del documento `users/{uid}`.

Reglas obligatorias en el backend:

- Longitud entre 3 y 20 caracteres.
- Solo letras ASCII, números y guion bajo.
- Expresión regular exacta: `^[A-Za-z0-9_]{3,20}$`.
- Validar el valor recibido completo: rechazar espacios, tildes, guiones, símbolos y caracteres Unicode fuera del conjunto permitido, sin corregirlos silenciosamente.
- Normalizar a minúsculas después de validar. `Ana_01`, `ANA_01` y `ana_01` compiten por `usernames/ana_01`.

La unicidad dependerá de transacciones de Firestore ejecutadas por la API. Una comprobación de disponibilidad del frontend será solo informativa y nunca reservará el nombre.

Invariantes: un perfil con nombre debe apuntar a una reserva con su mismo UID; una reserva debe apuntar a un perfil con ese nombre normalizado. Un perfil sin nombre tendrá ambos campos de nombre en `null` y `profileCompleted: false`.

## Avatares predeterminados

El backend mantendrá un catálogo permitido y versionado con identificadores estables. Catálogo inicial propuesto: `avatar_book` (predeterminado), `avatar_owl` y `avatar_lamp`. Los recursos visuales asociados podrán distribuirse con el frontend, que resolverá cada ID a su imagen.

Firestore almacenará exclusivamente `avatarId`: no archivos, contenido binario, rutas aportadas por el usuario ni URLs arbitrarias. El backend validará el ID contra el catálogo en creación y actualización; un ID desconocido producirá un error de validación. Si no se envía al crear, se usará `avatar_book`. Al retirar un avatar se deberá conservar su compatibilidad o migrar sus referencias antes de eliminarlo del catálogo.

## Proveedores y perfiles incompletos

Firebase Authentication gestionará los accesos con correo y contraseña (`password`) y con Google (`google.com`). La contraseña solo se enviará a Authentication mediante su flujo correspondiente; nunca a las operaciones de perfiles ni a Firestore.

Una cuenta de Google puede existir en Authentication sin documento de perfil. En su primera creación mediante la API se permitirá un perfil incompleto con nombres pendientes en `null`, `username: null`, `usernameNormalized: null`, avatar predeterminado y `profileCompleted: false`. No se generará un nombre de usuario a partir del correo ni del nombre de Google y no se creará una reserva hasta que el usuario elija un nombre válido. Los nombres sugeridos por Google deberán pasar por la validación de la API antes de guardarse.

También se admitirá un perfil incompleto para password si el registro y la captura de datos ocurren en pasos separados. El usuario autenticado podrá consultar, completar o eliminar su propio perfil. Las funcionalidades privadas que requieren perfil completo, como acceder al salón colaborativo, deberán comprobar en el backend la existencia del perfil y `profileCompleted: true`; un token válido por sí solo no bastará. Un documento incoherente tampoco habilitará esas funcionalidades.

## Operaciones mediante la API

Los siguientes endpoints son una propuesta para implementación posterior, no rutas existentes. Usar `/me` evita que el cliente seleccione el UID del propietario. Si se incorpora alguna ruta con `:uid`, se exigirá que coincida con el UID verificado; este diseño no concede acceso a perfiles ajenos.

| Operación propuesta | Comportamiento |
| --- | --- |
| `POST /api/v1/users/me` | Crear el perfil del UID autenticado. Obtener correo y proveedor del token, validar datos, asignar avatar predeterminado si falta y reservar el nombre si se suministra. Responder 201. |
| `GET /api/v1/users/me` | Leer solo el perfil del UID autenticado; responder 200 o 404 si todavía no existe. |
| `PATCH /api/v1/users/me` | Actualizar campos permitidos, completar el perfil o cambiar de nombre; responder 200. |
| `DELETE /api/v1/users/me` | Eliminar el perfil y liberar su nombre en una sola transacción; responder 204. Repetir la eliminación sin datos restantes también devuelve 204. |

La API aceptará únicamente `firstName`, `lastName`, `username` y `avatarId` como campos editables. Rechazará campos desconocidos y campos administrados por el servidor, incluidos UID, correo, proveedor, fechas, normalización y estado de completitud. Validará tipos, límites, valores nulos y catálogo antes de escribir. En PATCH, un campo omitido conserva su valor. No se permitirá limpiar un nombre ya asignado mediante `null`: se cambia por otro nombre válido o se libera al eliminar el perfil. Los nombres personales podrán quedar pendientes en un perfil incompleto; no se permitirá vaciarlos después de completar el perfil.

La lectura y la actualización de un perfil ausente devolverán 404; una actualización no lo creará implícitamente. Una creación repetida devolverá 409 sin sobrescribir el documento existente: tras un timeout el cliente podrá consultar su perfil para conocer el resultado. `profileCompleted` siempre se recalculará en el servidor, considerando la reserva correspondiente.

### Transacciones para reservar, cambiar y liberar

Todas las lecturas necesarias se realizarán dentro de la transacción y antes de sus escrituras. Firestore podrá reintentar la función transaccional; esta no enviará mensajes ni modificará Authentication ni realizará otros efectos externos.

1. **Creación y reserva inicial:** leer `users/{uid}` y, si hay nombre, `usernames/{normalizado}`. Si el perfil existe, devolver conflicto. Si la reserva existe para otro UID, devolver conflicto de nombre. Si no existe, crear la reserva y el perfil juntos. Una reserva preexistente del mismo UID sin perfil se tratará como inconsistencia y requerirá reconciliación antes de continuar.
2. **Completar un perfil sin nombre:** leer el perfil y la reserva solicitada; verificar propietario y ausencia de conflictos; crear la reserva y actualizar ambos campos de nombre, el resto de datos válidos, la completitud y `updatedAt` en el mismo commit.
3. **Cambiar de nombre:** leer el perfil, la reserva anterior y la nueva. Verificar que la anterior pertenece al UID y que la nueva está libre. Crear la nueva reserva, actualizar el perfil y eliminar la anterior en un único commit. Si la nueva ya pertenece al mismo UID pero no coincide con el perfil, tratarlo como inconsistencia, no como una reserva libre.
4. **Cambiar solo mayúsculas:** si la normalización no cambia, verificar la reserva existente del UID y actualizar únicamente la presentación de `username` y `updatedAt`, sin liberar ni recrear la reserva.
5. **Eliminar y liberar:** leer el perfil y su reserva, verificar la propiedad y eliminar ambos en la misma transacción. Si el perfil no tiene nombre, eliminar solo el perfil. Nunca borrar una reserva que pertenezca a otro UID. Ante una reserva ausente o ajena cuando el perfil declara un nombre, detener la operación y reconciliar.

Dos usuarios que soliciten simultáneamente el mismo nombre no podrán reservarlo ambos: después de los reintentos, solo uno confirmará y el otro recibirá 409. Un fallo de la transacción no deberá dejar una reserva nueva sin su actualización de perfil ni liberar el nombre anterior parcialmente.

`DELETE /api/v1/users/me` elimina el perfil, no la cuenta de Authentication. La cuenta restante podrá crear nuevamente un perfil, pero no acceder a funciones que requieren completitud mientras no lo tenga. El borrado integral de cuenta será un flujo posterior, separado y explícito.

## Errores y consistencia entre servicios

El contrato futuro conservará respuestas JSON con la propiedad `error`, coherentes con el middleware actual, sin exponer excepciones, tokens ni credenciales. Los estados específicos deberán implementarse posteriormente; el middleware actual solo contempla JSON inválido, rutas inexistentes y errores internos.

| HTTP | Situación y respuesta esperada |
| --- | --- |
| 400 | Cuerpo inválido, campos no editables, nombre fuera de la regla, avatar desconocido o correo requerido ausente. Corregir la entrada o renovar el token según corresponda. |
| 401 | Token ausente, inválido, expirado o revocado; cuenta deshabilitada o eliminada. Reautenticar cuando corresponda. |
| 403 | UID ajeno, proveedor no permitido o intento de usar una funcionalidad que requiere perfil completo. |
| 404 | Perfil propio inexistente en lectura o actualización. Ofrecer completar el alta. |
| 409 | Nombre ocupado, perfil ya existente o inconsistencia que impide una escritura segura. No informar quién posee el nombre. |
| 503 | Firestore temporalmente no disponible o contención transaccional agotada; permitir reintento controlado. |
| 500 | Fallo interno inesperado; mensaje genérico al cliente y diagnóstico restringido en el servidor. |

Para detectar cuentas eliminadas o deshabilitadas y tokens revocados, las operaciones protegidas deberán usar la verificación del token con comprobación de revocación, por ejemplo `verifyIdToken(token, true)`. Aun así, Authentication y Firestore no comparten una transacción: el estado de la cuenta puede cambiar después de verificar el token.

Tratamiento previsto de estados inconsistentes:

- **Cuenta de Authentication sin perfil:** es un estado permitido durante el alta o después de eliminar el perfil. GET devuelve 404 y la creación autenticada permite continuar; el acceso a funcionalidades que requieren completitud permanece bloqueado.
- **Perfil o reserva sin cuenta de Authentication:** no se permite acceso. Un proceso de reconciliación del backend, con identidad de servicio autorizada y verificación de ausencia definitiva de la cuenta, eliminará perfil y reservas propias de forma transaccional. Un fallo temporal al consultar Authentication no demuestra que la cuenta no exista.
- **Reserva ausente, propietario distinto o reservas adicionales para un UID:** bloquear escrituras afectadas y acceso que requiera un perfil coherente; registrar el incidente sin datos sensibles. La reconciliación comprobará perfil, reservas y existencia de la cuenta antes de reparar. No se sobrescribirá una reserva ajena ni se liberará un nombre por una petición del frontend.
- **Perfil ausente con reserva residual:** la reconciliación localizará las reservas por `uid` y eliminará únicamente las que sigan siendo huérfanas al releerlas dentro de la transacción. DELETE repetido no debe afirmar éxito de una limpieza pendiente si detecta estos restos.
- **Correo o proveedor desactualizados:** sincronizarlos desde un token verificado renovado mediante la API; nunca aceptar el correo del cuerpo como reparación.
- **Timeout con resultado de escritura desconocido:** consultar el perfil antes de repetir una creación o un cambio de nombre. Las transacciones y sus verificaciones de propiedad evitarán duplicados y liberaciones incorrectas.

Un futuro borrado integral deberá comprobar la identidad, eliminar o deshabilitar la cuenta de Authentication y ejecutar después una limpieza idempotente en Firestore con reintentos y reconciliación. Si falla la limpieza, los documentos residuales no deberán dar acceso. No se prometerá atomicidad entre ambos servicios ni se eliminará automáticamente una cuenta porque una escritura de perfil haya fallado.

## Ejemplos ilustrativos

Los identificadores, nombres y correos siguientes son ficticios. Los Timestamp reales son tipos nativos de Firestore; las cadenas ISO de estos ejemplos JSON representan su valor para facilitar la lectura y no son el formato que se almacenará.

Perfil completo: documento `users/uid_ejemplo_password`.

```json
{
  "firstName": "Ana",
  "lastName": "Perez",
  "username": "Ana_01",
  "usernameNormalized": "ana_01",
  "email": "ana@example.com",
  "avatarId": "avatar_owl",
  "authProvider": "password",
  "profileCompleted": true,
  "createdAt": "2026-11-10T15:00:00.000Z",
  "updatedAt": "2026-11-10T15:05:00.000Z"
}
```

Reserva asociada: documento `usernames/ana_01`.

```json
{
  "uid": "uid_ejemplo_password"
}
```

Perfil de Google pendiente de completar: documento `users/uid_ejemplo_google`. No existe una reserva en `usernames` para este perfil.

```json
{
  "firstName": null,
  "lastName": null,
  "username": null,
  "usernameNormalized": null,
  "email": "estudiante@example.com",
  "avatarId": "avatar_book",
  "authProvider": "google.com",
  "profileCompleted": false,
  "createdAt": "2026-11-10T16:00:00.000Z",
  "updatedAt": "2026-11-10T16:00:00.000Z"
}
```

Al elegir un nombre disponible y proporcionar los nombres personales válidos, la API creará su reserva y completará este perfil en una sola transacción, preservando `createdAt` y actualizando `updatedAt`.

## Decisiones de implementación de TS-01

El CRUD descrito está implementado en esta rama; las secciones anteriores conservan el contrato de diseño. Se concretó el catálogo en `src/config/avatars.ts`. Los nombres personales se recortan antes de validar su longitud; el username se valida completo, sin recortar, y también se rechaza un salto de línea final (el ancla `$` de JavaScript por sí sola puede admitirlo). POST y PATCH requieren un objeto JSON, aunque puede estar vacío para alta por pasos o sincronización de identidad. PATCH vacío conserva los campos editables y sincroniza correo, proveedor y `updatedAt`.

Cada operación comprueba las reservas del UID dentro de la transacción; los datos persistidos corruptos o reservas adicionales producen 409 y no se reparan automáticamente. GET valida la coherencia sin sincronizar la identidad. Después de una escritura se relee el perfil para resolver los Timestamp de servidor; si esa lectura falla, la escritura podría haberse confirmado y el cliente debe consultar antes de repetirla.

`requireCompleteProfile()` es un middleware reutilizable para las futuras rutas del salón y tiene pruebas con una ruta de prueba; no se añadió una ruta del salón a producción. La reconciliación administrativa y la eliminación integral de cuenta siguen siendo procesos posteriores: no se expone un endpoint que elimine Authentication. DELETE del perfil no llama a Auth. Véanse las instrucciones y pendientes operativos en `README.md` y `TS-01-evidencias-tecnicas.md`.
