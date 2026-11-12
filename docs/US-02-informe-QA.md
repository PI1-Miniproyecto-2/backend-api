# US-02 · Informe QA: Google y nombre de usuario obligatorio

Fecha: 11 de noviembre de 2026 (America/Bogota). Responsable de ejecución: Codex; tareas de Yoselin #72–#77, Sprint 1. Repositorio backend-api, rama `feature/US-02-registro-google`, árbol inicialmente limpio. No se cambió de rama ni se hicieron commits, push, merges o PR.

## 1. Objetivo y alcance

Verificar soporte backend para identidad Google, username válido/único y autorización por UID; elaborar casos; evaluar interfaz pública, accesibilidad y diseño; consolidar seguimiento. Fuera de alcance: implementar frontend de Angie, OAuth desde backend, cambiar reglas/IAM/credenciales, despliegues, acciones Taiga o modificar usuarios reales.

El contrato TS-01 ya admite `google.com` y `password`: el frontend realiza OAuth mediante Firebase y envía ID token; `auth.service` llama `verifyIdToken(token, true)`, reduce identidad a UID/email/proveedor y no utiliza esos campos del cuerpo. `/users/me` solo opera sobre UID autenticado. Servicios validan perfil y reserva dentro de transacciones; username normalizado comparte espacio global de nombres entre proveedores.

Username obligatorio significa necesario para `profileCompleted=true`, no prohibir el documento transitorio de onboarding. POST {} o null puede crear perfil incompleto; cadena vacía/espacios/nombre inválido produce 400. Los nombres/apellidos también se requieren para completar conforme a TS-01. No se asigna username desde correo o nombre Google. Cambiar este contrato sin necesidad rompería alta por pasos; no se hizo.

Se inspeccionaron README, TS-01, QA US-01, rutas, controladores, servicios/store, middleware, Firebase Admin, pruebas, Swagger, Dockerfile/Compose y reglas. No se encontró un nuevo defecto backend: no se cambia código de producción. Se añaden cinco pruebas focalizadas, reutilizando fixture y MemoryStore existentes. Un mismo UID vinculado puede conservar perfil; coincidencia de email entre UID distintos no fusiona cuentas. La prueba no implementa ni simula la operación de linking en Firebase.

## 2. Entorno y seguridad

- Local: Ubuntu, Node.js v20.19.5, npm 10.8.2; herramientas existentes TypeScript, node:test, tsx y Supertest.
- Público: [frontend](https://frontend123-opal.vercel.app/), [API/Swagger](https://backend-api-yzvv.onrender.com/api-docs/), [diseño Figma publicado](https://jelly-speed-93201488.figma.site/).
- Navegador: Chrome 143.0.7499.40 headless/CDP, perfil temporal aislado, 1440×900 y 390×844 CSS px, escala 1; muestra de ancho 320. Timestamps UTC de navegador y Bogotá de HTTP en evidencias.
- Frontend entra desde raíz y renderiza /register. Versiones/commits desplegados no confirmados; se registra hash del bundle público. Figma es una publicación, no un archivo con versión/nodos aprobados.

No se leyó ni utilizó el archivo de credenciales US-01 para Google. No se eligió ninguna cuenta Google, no se creó ni modificó cuenta/perfil real y no se ejecutaron escrituras de producción. Se inspeccionaron páginas sin sesión y GET de API con token ausente/ficticio. Sin tokens reales, contraseñas o correos personales en evidencias. No se realizó carga ni se indujo caída de servicios. No se modificaron reglas, IAM, secretos, configuraciones o estados Taiga.

## 3. Actividades ejecutadas

Se revisó la cobertura existente y se añadieron cinco pruebas `US-02:` en `tests/users.test.ts`:

1. Google con nombres pero username omitido/null permanece incompleto, privado 403; PATCH reserva y completa, conserva fecha.
2. Username ocupado por password da 409 a Google sin nuevas escrituras.
3. Mismo UID conserva perfil al sincronizar proveedor; otro UID con mismo email no lo hereda.
4. UID vacío/con slash se rechaza; claims de nombre no se convierten en perfil ni identidad editable.
5. Username vacío/espacios/punto falla en POST y PATCH y no completa onboarding.

Se reutilizan las regresiones para token, CRUD, campos administrados, unicidad/case/concurrencia, Firestore, rollback y aislamiento. [Casos completos](US-02-casos-prueba.md). Se inspeccionó el botón real con teclado, clic, DOM, árbol AX, estilos, screenshots y comparación con la referencia accesible. No se duplicaron documentos/evidencias US-01 ni se modificaron sus archivos.

## 4. Resultados automatizados

| Comando | Resultado final |
| --- | --- |
| `npm run build` | PASA, código 0 |
| `npm test` | PASA, código 0; **71 aprobadas, 0 fallidas, 0 canceladas, 0 omitidas** |
| `npm run typecheck` | PASA final, código 0 |
| `git diff --check` | Comprobación final registrada en E03 |
| `git status --short` | Solo pruebas y documentación/evidencias US-02; registro final E03 |

El primer chequeo de tipos detectó un mock Google nuevo incompleto; se añadieron claims requeridos de DecodedIdToken y el chequeo pasó. No fue un defecto de producción. La suite inicial de 70 pasó; tras añadir el caso vacío/espacios/punto, la suite final de 71 pasó. E03 conserva ambas ejecuciones y el diagnóstico corregido. La suite usa mocks, sin ADC ni red; sockets locales se autorizaron para tsx/Supertest.

MemoryStore serializa transacciones y verifica rollback simulado. No reproduce reintentos, contención ni tiempos de Firestore; pruebas del adaptador también usan SDK simulado. No se afirma firma JWT real, linking real o persistencia remota por el resultado local. `requireCompleteProfile` protege una ruta fixture, no una ruta de salón productiva implementada aquí.

## 5. Funcionales en producción

**Resultado principal FALLA:** Enter y clic en Google muestran «La autenticación con Google estará disponible cuando conectemos Firebase Authentication.». Se observó role=status. No se inició OAuth, no se abrió selector y no hubo solicitudes observadas a Firebase/API al activar. El handler del bundle público confirma que solo muestra el mensaje. No es una cancelación de OAuth ni un error real de Firebase.

| Paso del flujo | Resultado real |
| --- | --- |
| 1. Iniciar OAuth | FALLA: botón de demostración, E01/E02/E05 |
| 2. Elegir cuenta | BLOQUEADO por paso 1; si se integra se necesita autorización específica de cuenta Google |
| 3. Obtener identidad | BLOQUEADO; sin token real |
| 4. Solicitar username obligatorio tras OAuth | BLOQUEADO; hay campo en registro manual, no se verificó onboarding Google |
| 5. Enviar ID token a API | BLOQUEADO; ninguna solicitud de ese flujo |
| 6. Crear/recuperar perfil | BLOQUEADO; no se afirma escritura o persistencia Firestore |
| 7. Manejar duplicado | BLOQUEADO real; PASA solo en mocks |
| 8. Continuar a aplicación | BLOQUEADO; activación mantiene /register |

Comprobaciones independientes reales: GET `/health` 200; `/openapi.json` 200 con proveedores password/google.com y patrón ASCII; GET `/users/me` sin token 401; con token deliberadamente ficticio 401, sin detalles internos. Estos estados no demuestran Firebase configurado correctamente.

Casos G-P01–G-P14 documentan cada esperado, obtenido y estado. Cancelación y conexión fallida no se probaron porque no existe flujo OAuth activo. No se solicita contraseña de Google ni se reutiliza la de Firebase US-01; la ausencia de integración hace innecesario utilizar ahora una cuenta de prueba. No se probó aislamiento real entre dos cuentas ni revocación administrativa.

## 6. Accesibilidad WCAG 2.2

Evaluación parcial de interfaz pública conforme a criterios aplicables de [WCAG 2.2 W3C](https://www.w3.org/TR/WCAG22/). Se distingue interacción manual asistida por CDP, inspección automatizada de DOM/AX/estilos y comprobaciones pendientes. No se certifica nivel AA de todo el proceso.

| ID / criterio | Método | Resultado y alcance |
| --- | --- | --- |
| A01 · 3.1.1 A / 2.4.2 A | DOM renderizado | PASA muestra: lang=es y título Registro seguido de AulaPro |
| A02 · 2.1.1 A / 2.1.2 A | Tab/Shift+Tab/Enter mediante CDP | PASA acceso y activación Google. 7 Tab, 4 Shift+Tab recuperan Google. No se evalúa todo OAuth |
| A03 · 2.4.3 A | Recorrido registrado | PASA orden inicial: marca, volver, Google, nombres, apellidos, username, email; resto de página no recorrido en esta revisión |
| A04 · 2.4.7 AA / 2.4.11 AA | Estilos y captura con foco | PASA Google: outline sólido 3px, visible sin ocultación completa en estados revisados; no certifica otros focos |
| A05 · 4.1.2 A / 2.5.3 A | AX y texto visible | PASA botón nativo con nombre «G Registrarse con Google», focusable. G decorativa anunciada es mejora posible, no fallo automático |
| A06 · 1.3.1 A / 1.3.5 AA / 3.3.2 A | DOM username | Label asociado y autocomplete=username presentes. No required/aria-required, ejemplo emilio.c incompatible con API; instrucciones deben alinearse. Obligación tras Google BLOQUEADA |
| A07 · 3.3.1 A / 3.3.3 AA | Flujo username Google | BLOQUEADO: no pantalla posterior ni error de duplicado real; no se trasladan pruebas de errores US-01 como ejecución nueva |
| A08 · 4.1.3 AA | DOM tras Enter/clic | PASA semántica de mensaje de demostración con role=status. No se afirma anuncio por lector; estados Auth pendientes |
| A09 · 1.4.3 AA / 1.4.11 AA | Colores computados y sRGB | PASA muestra texto Google: 9.361:1 normal y 8.670:1 hover; foco contra blanco 5.063:1. No se midió todo formulario |
| A10 · 2.5.8 AA / 1.4.10 AA | Rectángulos/ancho/screenshot | Botón 530×43 desktop, 341×43 móvil: supera 24×24. A 320 scrollWidth=320, sin desborde horizontal de la página en muestra; resto responsive parcial |
| A11 · 1.4.4 AA / 1.4.12 AA | Zoom y espaciado | NO EJECUTADO; emulación de ancho no sustituye zoom o espaciado |
| A12 · Lectores / 3.3.8 AA | Herramientas asistivas y OAuth | NVDA/Orca NO EJECUTADO; OAuth accesible y desafío cognitivo BLOQUEADOS por integración |

[Nombres y roles](https://www.w3.org/TR/WCAG22/#name-role-value), [contraste](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [mensajes de estado](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) y [objetivos](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) sustentan estas comprobaciones. Ratios con luminancia relativa sRGB sobre colores CSS opacos; E04 incluye método y pares medidos. No se asigna contraste a texto sin resolver fondo.

Chrome AX no equivale a prueba NVDA/Orca. No se ejecutaron Lighthouse/axe ni se inventaron puntajes. Se requieren lector real, navegación/errores del onboarding integrado, zoom/espaciado y revisión del resto de criterios A/AA antes de declarar cumplimiento.

## 7. Usabilidad y fidelidad visual

Evaluación experta, sin sesiones de usuarios ni tiempos inventados. El texto Google comunica la acción claramente y el nombre accesible la incluye; Enter/clic proporcionan feedback visible. Sin embargo, el botón habilitado promete un flujo que no existe, principal fricción y bloqueo funcional. No hay transición a selección de cuenta ni captura obligatoria posterior de username. El mensaje expone el nombre técnico Firebase al usuario; conviene presentar disponibilidad/alternativa con lenguaje de producto cuando se resuelva la integración.

El campo manual sugiere emilio.c, incompatible con contrato API; no se probó aquí validación posterior a Google. En móvil, el panel promocional ocupa espacio antes de las acciones y une palabras en la cita (unaidea/entiendesmejor), observable en captura. Es un hallazgo de copy responsive, no una medición de tasa de abandono.

Comparación real contra la publicación Figma accesible, navegando internamente a /register, mismas ventanas y escala. Capturas móviles desplazan cada página para mostrar su botón Google; **no representan una superposición pixel a pixel de idéntico scroll**. La barra flotante Figma es del publicador y no se atribuye al producto.

| Aspecto | Diseño observado | Frontend observado / conclusión |
| --- | --- | --- |
| Texto Google | Registrarse con Google | Coincide texto principal; el flujo real no se implementó |
| Posición desktop | Google bajo formulario/CTA principal | Arriba del formulario, orden distinto |
| Botón desktop | 382×44 CSS px, 14px peso700 | 530×43, 12px peso650; diferencia medida |
| Contenedor | Tarjeta blanca redondeada | Formulario abierto sobre fondo claro |
| Campos | Nombre completo y username en fila | Nombres/Apellidos separados, username a ancho completo; avatares extra |
| Mobile | Botón accesible con scroll, tarjeta compacta | Botón visible al desplazar, otra composición y copy unido en panel promocional |
| Estados OAuth | No se inspeccionaron estados de éxito/cancelación de prototipo | No disponibles en frontend; comparación de esos estados BLOQUEADA |

No hay versión/nodos aprobados ni tolerancias acordadas: se reportan diferencias, sin inventar porcentaje de fidelidad o calificar cambios como defectos contra un diseño congelado inexistente. Aprobación visual pendiente de diseño/Angie. El título/idioma del sitio Figma no se confunde con los del frontend.

## 8. Defectos encontrados

| ID | Severidad propuesta | Reproducción / esperado / obtenido | Evidencia / responsable propuesto |
| --- | --- | --- | --- |
| US02-D01 | Alta | Abrir desde raíz, enfocar Google y Enter/clic. Esperado OAuth; obtenido aviso de futura conexión, sin selector/solicitudes | E01/E02/E05; frontend/Angie |
| US02-D02 | Media | Leer ejemplo de username emilio.c y contrato API. Esperado regla consistente; ejemplo contiene punto que API excluye | E01 initial.username y E02 patrón; frontend |
| US02-D03 | Baja | Ancho390, observar panel: unaidea/entiendesmejor. Esperado espacios entre palabras | E06; frontend |

No se identificó defecto nuevo backend que requiriera cambiar TS-01. Diferencias de diseño son observaciones con aprobación pendiente, no fallos inventados. No se abrió ninguna issue ni se cambió Taiga. Para reportar un defecto: título `[US-02][Dxx]`, tarea/caso, URL/versiones/fecha/SO/navegador, precondiciones sin secretos, pasos numerados, esperado/obtenido, HTTP real o sin respuesta, severidad e impacto, evidencia y resultado del retest. Conservar la ejecución fallida y agregar el retest.

## 9. Dependencias y bloqueos

Angie debe integrar Firebase Google, dominio autorizado y manejo de popup/cancelación; obtener token, recuperar perfil propio y solicitar username válido antes de continuar. Ante 409 conservar sesión y permitir otro nombre, sin repetir creación de cuenta. Si falla respuesta después de escritura, GET antes de repetir POST. No enviar UID/email/proveedor como datos editables ni escribir directo a Firestore.

Se requieren despliegue/versionado identificables, criterios formales de US-02 y confirmación de cambios de diseño. La configuración real Firebase/IAM/CORS, revocación, reglas remotas, concurrencia/rollback real y persistencia siguen sin validación autenticada. Authentication y Firestore no comparten transacción. El acceso completo al salón requiere middleware en futuras rutas; esta historia no crea esas funcionalidades. Cuentas Google de prueba requieren autorización específica cuando se desbloquee OAuth; las credenciales US-01 no la sustituyen.

## 10. Go / No-Go

**GO para revisar los cambios de pruebas y documentación y preparar un único commit US-02 por parte del usuario. NO-GO para cerrar toda US-02 o declarar registro Google productivo/AA aprobado.** Backend local verificado; OAuth público FALLA, resto autenticado BLOQUEADO. No se realizó commit, push, merge ni PR.

## 11. Evidencias

| ID | Archivo / enlace verificable | Alcance |
| --- | --- | --- |
| E01 | [Navegador](evidencias/US-02/navegador.json) | DOM resumido, Tab/Shift+Tab/Enter, clic, AX Google, medidas y mensajes; sin cuentas |
| E02 | [API/bundle público](evidencias/US-02/publico.json) | HTTP 200/401, enum/patrón remoto, hash/handler Google |
| E03 | [Verificación local](evidencias/US-02/verificacion-local.txt) | Comandos, diagnóstico corregido y suites 70/71 |
| E04 | [Contraste](evidencias/US-02/contraste.json) | Cálculo de muestra Google y foco |
| E05 | [Google desktop](evidencias/US-02/google-desktop.png) | Captura real de feedback y foco, 1440×900 |
| E06 | [Google mobile](evidencias/US-02/google-mobile.png) | Captura real tras scroll, 390×844 |
| E07 | [Diseño desktop](evidencias/US-02/diseno-desktop.png) | Referencia publicada accesible, 1440×900 |
| E08 | [Diseño mobile](evidencias/US-02/diseno-mobile.png) | Referencia tras scroll para ver Google, 390×844 |
| E09 | [Pruebas](../tests/users.test.ts) y [casos](US-02-casos-prueba.md) | Trazabilidad local/externa |

Directorio de evidencia breve: aproximadamente 350 KB al capturar, sin HAR, bundle completo ni árbol AX completo redundante. Los eventos de creación de pestañas del JSON incluyen páginas de auditoría/diseño del perfil aislado; **no son popups de Google**. No se fotografió selección de cuenta ni éxito porque no ocurrieron. Para evidencia pendiente (lector/OAuth/persistencia) no se crean archivos ficticios.

## 12. Seguimiento Taiga #72–#77

Estado de ejecución propuesto; no modifica estado remoto de Taiga.

| Tarea | Entregable y estado real | Pendiente |
| --- | --- | --- |
| #72 · US-02-07 | Completada localmente: inspección y 5 pruebas nuevas; suite71 PASA | Integración real en #74, motor Firestore fuera del mock |
| #73 · US-02-08 | Completada: casos con requisito/precondiciones/pasos/esperado/obtenido/estado/evidencia | Agregar retests sin borrar histórico |
| #74 · US-02-09 | Parcial ejecutada: OAuth FALLA; GET públicos PASA; pasos autenticados BLOQUEADOS | Integración y autorización de cuenta Google |
| #75 · US-02-10 | Parcial ejecutada: botón, teclado, AX/semántica, contraste y ancho verificados | Lector, zoom, proceso completo y AA integral |
| #76 · US-02-11 | Comparación y evaluación experta disponibles; aprobación visual pendiente | Diseño versionado/aprobado, estados posteriores y validación con usuarios si se requiere |
| #77 · US-02-12 | Consolidación disponible para revisión, evidencias/defectos/seguimiento | Coordinar correcciones, retest y decisión final; no cerrar historia |

Siguiente paso: frontend corrige US02-D01 y alinea username, identifica el despliegue; QA repite G-P01 y solo entonces solicita autorización de cuenta Google y ejecuta pasos autenticados/cancelación/red; después revisión de accesibilidad completa, aceptación visual y cierre con evidencia. No se fija fecha de cierre sin estos insumos.
