# US-04 · Informe QA de consulta y edición de perfil

19 de noviembre de 2026 (America/Bogota) · Rama `feature/US-04-editar-perfil` · Base `32761bb` · Responsable Yoselin, Backend Lead y QA

## 1. Objetivo y alcance

Verificar GET y PATCH de `/api/v1/users/me`, actualizar el contrato OpenAPI y registrar evidencia de aceptación de US-04. El árbol de trabajo inicial estaba limpio. Los cambios se limitan a la especificación de perfiles, pruebas y documentación QA. [Casos de prueba](US-04-casos-prueba.md).

## 2. Entorno de ejecución

Ejecución local en Linux con Node.js 20.19.5, npm 10.8.2, TypeScript, `node:test`, `tsx` y Supertest. La suite usa sockets locales, un verificador de identidad simulado y `MemoryStore`. La prueba del adaptador Firestore usa un cliente simulado y verifica el uso de `FieldValue.serverTimestamp()`. Quedan fuera de esta ejecución la firma y revocación reales de tokens, los permisos IAM y la persistencia, contención y reintentos del motor Firestore.

## 3. Resumen de pruebas automatizadas

- Se conservaron las 76 pruebas de la base. Se reutilizó la cobertura de autenticación, aislamiento por UID, campos de identidad, cero bytes frente a `{}`, reservas, errores sanitizados, reversión y validez de OpenAPI.
- Se amplió la matriz de validación para PATCH y se comprobó que el fallo de escritura conserva completo el estado del perfil y sus reservas.
- Se agregaron cuatro pruebas automatizadas en total.
  - Una prueba con cuatro ediciones parciales, una por cada campo editable.
  - Una prueba de PATCH concurrentes por el mismo nombre de usuario.
  - Una prueba de recuperación mediante GET tras un fallo de lectura posterior al commit.
  - Una prueba del contrato Swagger.

## 4. Resultados obtenidos

| Verificación | Resultado |
| --- | --- |
| `npm run typecheck` | Aprobada |
| `npm run build` | Aprobada |
| `npm test` | 80 ejecutadas, 80 aprobadas, 0 fallidas, 0 canceladas y 0 omitidas |
| Validación de OpenAPI 3.0 | Aprobada dentro de la suite |
| `git diff --check` | Aprobada |

Las pruebas confirmaron que GET y PATCH usan la identidad verificada, rechazan intentos de acceso ajeno y protegen campos administrados. Los fallos de infraestructura devolvieron mensajes genéricos. La reversión y el ganador único ante solicitudes concurrentes se comprobaron en el almacén simulado.

## 5. Errores encontrados

La suite no mostró defectos funcionales nuevos. El rechazo del cuerpo de cero bytes corresponde al commit base y se verificó de nuevo. El 503 tras confirmar el cambio de nombre se indujo deliberadamente y reprodujo el comportamiento documentado.

## 6. Riesgos conocidos

PATCH guarda el perfil y las reservas en una transacción, luego relee el perfil para responder con las fechas resultantes. Un fallo de la relectura puede provocar una respuesta de error aunque la escritura se haya confirmado. La prueba verifica que GET recupera el perfil guardado tras restablecer el servicio. Ante una respuesta ambigua, el cliente debe consultar GET antes de repetir PATCH. Sigue pendiente comprobar este flujo con Firestore real en un entorno controlado.

## 7. Pruebas pendientes en producción

Quedan pendientes la revisión operativa de Swagger y los resultados HTTP y de persistencia con cuentas autorizadas en el backend desplegado en Render, así como el recorrido visual en Vercel si la interfaz está disponible. Los casos US04-P01 y US04-P02 detallan las precondiciones y los resultados esperados. La evidencia para la rúbrica debe incluir revisión y fecha del despliegue, códigos HTTP, perfil actualizado al volver a consultar y, cuando aplique, capturas de la interfaz con datos redactados. Conservar también la salida de las verificaciones locales y la matriz de casos. Las comprobaciones en Render y Vercel siguen pendientes.

## 8. Recomendación Go / No-Go

**Go para revisión e integración de backend.** El contrato local y las 80 pruebas automatizadas pasan. **No-Go preliminar para aprobación de producción** hasta confirmar autenticación real, persistencia y aislamiento en el despliegue.
