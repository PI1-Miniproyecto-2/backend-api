# US-06 · Contrato de salas para REST y TS-02

Firestore guarda cada sala en `rooms/{roomId}`. Firestore genera un ID
alfanumérico de 20 caracteres y el backend REST escribe estos campos:

| Campo | Tipo | Valor al crear |
| --- | --- | --- |
| `name` | string | Nombre recortado de 1 a 100 unidades UTF-16 |
| `ownerUid` | string | UID extraído del token verificado |
| `participantUids` | string[] | Arreglo con el UID del propietario |
| `createdAt` | Timestamp | Fecha generada en el servidor REST |
| `status` | string | `active` |

REST requiere un Firebase ID token válido del proyecto, con verificación de revocación,
y un perfil completo. Se rechazan identidades de otros tenants porque el documento
identifica a los usuarios por UID. Las respuestas incluyen `roomId` y convierten `createdAt` a
ISO 8601. El listado filtra por `ownerUid` y devuelve hasta 50 documentos en
orden ascendente por ID, con el índice individual de Firestore y sin paginación
en esta entrega. La consulta individual devuelve el mismo HTTP 404 para salas
inexistentes, inactivas o sin acceso.

## Autorización en Socket.IO

TS-02 debe verificar el Firebase ID token, incluida su revocación, y obtener el
UID de la identidad autenticada del mismo proyecto y rechazar otros tenants. Debe aplicar la política de
perfil completo para el acceso a funciones privadas. Para autorizar el acceso
a una sala, validar el formato de `roomId` y consultar `rooms/{roomId}`. La
función `canAccess(roomId, uid)` solo devuelve verdadero si el documento existe,
`status === 'active'` y se cumple al menos una de las siguientes condiciones.

- `ownerUid === uid`.
- `participantUids` es un arreglo que contiene el UID.

Ante un fallo de consulta, se deniega el acceso. Conocer el ID de una sala no
otorga acceso. Las salas permanecen almacenadas tras el flujo de eliminación de
cuenta de US-05, que elimina el perfil y la identidad de Firebase Auth.
