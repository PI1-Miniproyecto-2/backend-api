# US-06 · Informe QA de creación y consulta de salas

20 de noviembre de 2026 (America/Bogota) · Rama `feature/US-06-crear-salas` · Base `69ff4d9` · Responsable Yoselin, Backend Lead y QA

## 1. Objetivo y alcance

Verificar `POST /api/v1/rooms`, `GET /api/v1/rooms` y `GET /api/v1/rooms/{roomId}`. El árbol de trabajo inicial estaba limpio. La entrega añade cobertura de seguridad, el contrato publicado en Swagger y evidencia local de aceptación. [Matriz de casos](US-06-casos-prueba.md).

## 2. Entorno de pruebas

Linux, Node.js 20.19.5, npm 10.8.2, TypeScript, `node:test`, `tsx`, Supertest y Swagger Parser. Las pruebas usan Express con sockets locales, un verificador Firebase Auth simulado, perfiles en `MemoryStore` y dobles de Firestore. El listado verifica la consulta que construye el adaptador con un cliente simulado. La ejecución prescinde de credenciales y servicios Firebase reales.

## 3. Pruebas automatizadas ejecutadas

- Se conservaron las 96 pruebas de la base. Se amplió la validación del nombre con un caso que excede el límite por unidades UTF-16.
- Cinco pruebas nuevas cubren rechazos por token, tenant y perfil, la privacidad de salas inactivas, el filtro y límite del listado, y los fallos de Firestore en las tres operaciones.
- Una prueba nueva verifica las operaciones de salas servidas en `/openapi.json`. La validación existente analiza la especificación completa y sus referencias internas.

## 4. Resultados obtenidos

| Verificación | Resultado |
| --- | --- |
| `npm run typecheck` | Aprobada |
| `npm run build` | Aprobada |
| `npm test` | 102 ejecutadas, 102 aprobadas, 0 fallidas, 0 canceladas y 0 omitidas |
| OpenAPI 3.0.3 y contrato de salas | Aprobados dentro de la suite |
| `git diff --check` | Aprobada, con revisión adicional de los archivos nuevos |

## 5. Hallazgos y correcciones

El documento OpenAPI del commit base carecía de las rutas de salas. Se agregaron la etiqueta Salas, sus tres operaciones, la seguridad Bearer, los esquemas, los ejemplos y las respuestas que corresponden al código. Se documentó el 409 que puede emitir la comprobación de integridad del perfil o su reserva. El listado también documenta el 400 del parser global si se envía un cuerpo JSON malformado. Las pruebas locales no detectaron defectos funcionales que requirieran cambios de producción.

El [contrato TS-02](US-06-contrato-salas.md) describe `rooms/{roomId}`, los IDs alfanuméricos de 20 caracteres, `ownerUid`, `participantUids`, `status: active` y `createdAt` como Timestamp. También define el control de revocación, el rechazo de otros tenants, el perfil completo y el acceso de propietario o participante registrado.

## 6. Riesgos y limitaciones

- El listado devuelve hasta 50 salas propias ordenadas por ID. Las siguientes quedan fuera del listado de esta entrega porque carece de paginación.
- Los dobles verifican el comportamiento de la API y la consulta construida. Los permisos efectivos, el índice, el orden y la persistencia quedan pendientes de verificar en Firebase desplegado.
- El acceso de participantes ya registrados se prueba con datos simulados. El flujo REST de incorporación de participantes invitados queda fuera de esta entrega.
- US-05 conserva los documentos de salas después de eliminar una cuenta. El token de la identidad eliminada se rechaza. Los participantes autorizados siguen sujetos a la política de acceso de la sala.
- El autorizador real de Socket.IO en `bakend-realtime` queda pendiente de integración.

## 7. Integración pendiente y evidencias para el DUE

| Evidencia | Disponibilidad |
| --- | --- |
| Suite local, validación OpenAPI y matriz de casos | Disponible con los comandos de la sección 4. [Pruebas REST](../tests/rooms.test.ts) y [pruebas Swagger](../tests/docs.test.ts) |
| Render y Firebase controlado | Pendiente. Adjuntar fecha, revisión desplegada, permisos efectivos, códigos HTTP, consulta e inspección redactada del documento almacenado |
| Frontend y TS-02 | Pendiente. Adjuntar capturas redactadas del flujo de salas y resultados del autorizador con propietario, participante y tercero |

## 8. Recomendación Go / No-Go

**Go preliminar para revisión del backend.** La suite local y el contrato OpenAPI pasan. **No-Go para aprobación definitiva de producción** hasta validar Render, Firebase Auth y Firestore reales, el flujo de frontend y la integración de TS-02.
