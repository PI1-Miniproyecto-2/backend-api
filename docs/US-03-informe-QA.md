# US-03 · Informe QA de inicio y cierre de sesión

Fecha: 11 de noviembre de 2026 (America/Bogota). Ejecutor: Codex; seguimiento Yoselin #84–#89. Repositorio backend-api, rama `feature/US-03-inicio-sesion`, árbol inicial limpio. Sin cambio de rama, commit, push, merge, PR o modificación de estados Taiga.

## 1. Objetivo y alcance

Verificar autenticación/autorización backend, ampliar cobertura faltante, elaborar casos y evaluar el login público, cierre de sesión, accesibilidad y diseño con evidencia real. Reutilizar arquitectura/fixtures; no implementar frontend de Angie, nuevas rutas login/logout, reglas/IAM/secretos o despliegues. No se encontró un defecto nuevo backend que requiriera cambiar producción.

[Casos completos](US-03-casos-prueba.md). Se inspeccionaron README, informes US-01/US-02, rutas, controladores, auth/profile middleware y servicios, store Firestore, Admin SDK, Swagger, pruebas y modelo de perfiles. No se reescribieron documentos previos ni se repitieron sus resultados como evidencia actual.

## 2. Entorno y modelo de seguridad real

Ubuntu Linux, Node.js v20.19.5, npm 10.8.2; TypeScript, node:test/tsx y Supertest existentes. Público: [frontend Vercel](https://frontend123-opal.vercel.app/), [backend Render](https://backend-api-yzvv.onrender.com/api-docs/) y [diseño publicado](https://jelly-speed-93201488.figma.site/). Chrome 143.0.7499.40 headless/CDP aislado, 1440×900, 390×844 y muestra de ancho320 CSS px, escala1. Timestamps UTC y Bogotá en JSON; commits desplegados no identificados. No se utilizó navegador/perfil personal.

Tras la autorización específica de US-03 se permite reutilizar `~/.config/salon-estudio/qa/registro.env` (QA_TEST_EMAIL y QA_TEST_PASSWORD) exclusivamente para inicio/cierre de sesión controlados. No se leyó ni utilizó: el frontend sigue sin integración y no necesita esas credenciales para las verificaciones públicas. No se accederá a Gmail ni se crearán cuentas ausentes. Se usaron entradas sintéticas sin cuenta para validar UI; sus valores no se guardan. No hubo sesión real, tokens reales, cookies de autenticación almacenadas como evidencia, cuentas creadas/modificadas/eliminadas ni consultas a datos de otros usuarios. Se bloquearon peticiones mutantes del navegador por precaución; contador observado0. El handler público confirma que no intenta autenticar: la ausencia de solicitudes no se atribuye solo al bloqueo de herramientas. Capturas solo de campos vacíos; después de entradas sintéticas se guardaron mensajes/estados, no valores, y se limpiaron antes de capturar móvil.

### Inventario de rutas backend inspeccionadas

| Ruta | Protección existente | Límite de la conclusión |
| --- | --- | --- |
| POST/GET/PATCH/DELETE /api/v1/users/me | authenticate en todos; verifyIdToken(token,true), identidad por solicitud, UID propio | No exige perfil completo para gestionar onboarding |
| GET /api/v1/system/firestore-status | Clave diagnóstica por x-diagnostic-key; 403 si falta/no coincide | No es ruta de salón protegida por Firebase Bearer |
| GET /health y /api/v1/system/status | Públicas | No verifican sesión ni disponibilidad Auth |
| /api-docs y /openapi.json | Públicas | Documentación, no autorización |
| /private | Solo fixture de pruebas: authenticate + requireCompleteProfile | No existe en API de producción |
| Dashboard/salas/logout | No hay endpoints de esas funciones en backend inspeccionado | Las rutas declaradas en React no demuestran protección de API |

No hay endpoint Express login/logout ni sesión de servidor/cookie de autenticación. El modelo previsto es Firebase Client SDK para autenticar y [signOut del cliente](https://firebase.google.com/docs/reference/js/auth#signout) para salir, dejando de enviar token. La API verifica cada petición independientemente; una petición previa válida no autentica la siguiente sin Bearer.

No prometer revocación inmediata de un ID token ya emitido por cerrar la UI: [Firebase distingue tokens de corta vida y revocación de sesiones](https://firebase.google.com/docs/auth/admin/manage-sessions). La API solicita comprobación de revocación; no se añadió un flujo administrativo ni se revocó ninguna cuenta. Un test sin token después de otro válido acredita independencia entre solicitudes, no una prueba end-to-end de logout.

## 3. Pruebas automatizadas

Se añadieron cuatro pruebas en `tests/users.test.ts`, reutilizando fixture y MemoryStore:

1. PATCH/DELETE rechazan ausencia y tokens inválidos, expirados/revocados sin alterar datos.
2. No se conserva identidad entre solicitudes/usuarios; ambos proveedores; checkRevoked=true.
3. Clasificación de errores adicionales Admin: argumentos401, permisos/interno500 y cuota/unavailable503, mensajes sanitizados.
4. Un perfil ajeno completo no habilita a usuario incompleto/ausente; ruta privada fixture distingue200/403/401 y perfil propio sigue legible.

Se mantienen 71 regresiones para password/Google, identidad verificada y campos manipulados, UID ajeno, provisión/lectura/actualización, coherencia y errores Firestore. Resultado final: **75 aprobadas, 0 fallidas, 0 canceladas, 0 omitidas**, sin credenciales/red. Los mocks no prueban firma JWT, credenciales correctas, IAM, revocación efectiva o reintentos del motor real.

| Comando | Resultado |
| --- | --- |
| npm run build | PASA, salida0 |
| npm test | PASA, salida0; 75/75 |
| npm run typecheck | PASA, salida0 |
| git diff --check | PASA, salida0; revisión adicional de archivos nuevos sin diagnósticos |
| git status --short | Salida0; solo pruebas y documentos/evidencias US-03, registro E03 |

Sockets locales autorizados para tsx/Supertest; no se añadieron dependencias ni cambió configuración. E03 conserva salida real.

## 4. Pruebas funcionales en producción

Se abrió frontend raíz y se activó Inicia sesión mediante su botón. Aparece «Bienvenido de nuevo», correo/contraseña, Google, recordar datos y recuperar contraseña. URL y título siguen siendo /register y Registro seguido de AulaPro. No se observa una sesión por mostrar esa pantalla.

Vacíos: errores obligatorios y aria-invalid=true. Correo mal formado sintético: mensaje de formato. Envío sintácticamente válido con datos sintéticos: «Correo o contraseña incorrectos» tras temporizador; ninguna solicitud Auth/API. El handler inspeccionado fija ese mensaje y no llama a Firebase; **FALLA login integrado**, no una comprobación real de contraseña o cuenta inexistente. El botón Google anuncia que estará disponible al conectar Firebase: **FALLA inicio OAuth**.

| Comprobación actual | Resultado real |
| --- | --- |
| Pantalla mediante navegación pública | PASA disponibilidad visual; título/URL no corresponden al modo |
| /login directo | FALLA: HTTP404 |
| UI vacíos y formato | PASA validación visual; falla relación accesible de vacíos |
| Login email/clave y Google integrados | FALLA por demostración |
| GET /health | PASA200, no acredita Auth |
| GET /users/me sin token / ficticio | PASA401/401 sanitizados |
| GET firestore-status sin clave | PASA403 |
| Login válido, credenciales incorrectas/cuenta inexistente reales | BLOQUEADO por integración; autorización específica recibida, sin uso de credenciales |
| Perfil incompleto/ajeno y token real válido/revocado | BLOQUEADO externo; sí cubierto con mocks |
| Logout y acceso posterior | BLOQUEADO end-to-end: no hay sesión real |
| Persistencia al recargar / error de red | BLOQUEADO: no sesión/solicitud de autenticación real |

Se recibió autorización específica de cuenta y mecanismo seguro para US-03; ya no se consideran un permiso pendiente. La revalidación pública de E02 conserva el mismo hash y handler de demostración: el bloqueo vigente es la integración ausente. La autorización no permite crear, borrar o modificar cuentas; si la cuenta no existe, no se creará automáticamente. No se intentó saltar autenticación, usar tokens ajenos ni habilitar pantallas mediante manipulación de rutas. Las rutas React declaradas dashboard/profile/rooms se inventariaron por inspección, sin afirmar que estén autenticadas o que expongan datos reales.

Cierre de sesión por inspección pública: existe botón con título Cerrar sesión cuyo handler navega a /login; no se encontró signOut en ese bundle. Se conserva el fragmento y hash en E02. Eso **no acredita cierre de una sesión Firebase**; no se pulsó desde una sesión real inexistente. Recordar datos solo presenta estado de checkbox en el código inspeccionado, no demuestra persistencia Firebase. No se ensayó reuso de tokens reales ni se revocaron cuentas.

## 5. WCAG 2.2: evaluación parcial

Fuente: [WCAG 2.2 W3C](https://www.w3.org/TR/WCAG22/). Se revisa el login renderizado del producto; idioma/título del prototipo Figma no se atribuyen al frontend. No se declara conformidad integral AA.

| ID / criterio | Método | Resultado real |
| --- | --- | --- |
| A01 · 3.1.1 A | DOM | PASA muestra: lang=es y textos españoles |
| A02 · 2.4.2 A | DOM modo login | FALLA: título conserva Registro aunque muestra inicio de sesión; D03 |
| A03 · 1.3.1 A / 4.1.2 A | Labels/AX | PASA etiquetas de correo, clave y recordar. FALLA asociación de errores vacíos: no describedBy/errormessage, AX sin descripción; D04 |
| A04 · 2.1.1 A / 2.1.2 A | Tab/Enter CDP | PASA muestra: 12 Tab recorren controles y vuelven al inicio; Enter en submit genera errores. Proceso autenticado no evaluable |
| A05 · 2.4.3 A | Secuencia registrada | PASA orden: marca, volver, Google, correo, clave, toggle, recordar, recuperar, envío, registro |
| A06 · 2.4.7 AA / 2.4.11 AA | Estilos y captura foco | Botones con outline3px y foco de envío visible; inputs usan borde cambiado sin outline. Verificación parcial, sin aprobar todos los indicadores/estados |
| A07 · 1.4.3 AA | Medición sRGB | FALLA texto normal: subtítulo3.475:1, auxiliar inferior3.009:1, Recordar datos3.859:1, mínimo4.5; D05 |
| A08 · 3.3.1 A / 3.3.3 AA / 1.4.1 A | Envío vacío/formato | PASA identificación visual en texto y orientación de formato, no solo color. No acredita error Firebase real |
| A09 · 4.1.3 AA | Mensajes DOM/AX | FALLA vacíos: sin alert/status/live ni descripción enlazada; foco queda en envío. Genérico de demo tiene role=alert: PASA semántica solamente, no ensayo de lector |
| A10 · 1.3.5 AA / 4.1.2 A | DOM y toggle vacío | PASA email/current-password y cambio a type=text/Ocultar contraseña; regreso a oculto ejecutado. No se probó gestor o pegado |
| A11 · 4.1.2 A / 2.5.3 A | Botón Google | Botón nativo con texto G Continuar con Google, recorrible y disponible; PASA nombre/control, flujo OAuth FALLA |
| A12 · 1.4.10 AA | 390/320 CSS px | Sin desborde horizontal en muestra320; capturas móviles con scroll. PASA muestra, no totalidad del proceso |
| A13 · 1.4.4 AA / 1.4.12 AA / 2.5.8 AA | Zoom/espaciado/objetivos | NO EJECUTADO completo: emulación de ancho no equivale a zoom ni medición de todas las excepciones de objetivos |
| A14 · Lectores / 3.3.8 AA | Herramientas asistivas | NVDA y Orca NO EJECUTADO. Autenticación accesible completa BLOQUEADA por integración |

E04 calcula (L claro+0.05)/(L oscuro+0.05) con luminancia sRGB y primer fondo opaco identificado. Se excluyen botones sin texto: iconos requieren evaluación de contraste no textual, no umbral de texto. El párrafo inferior contiene un botón de color propio: el fallo corresponde al texto auxiliar, no automáticamente a ese botón. [Contraste](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [errores](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html) y [mensajes](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) sustentan estas verificaciones.

No se ejecutó Lighthouse/axe ni se inventaron puntajes. AX de Chrome no equivale a lector de pantalla. Falta lector real, revisión completa de foco, zoom/espaciado y estados autenticados antes de aprobar AA.

## 6. Usabilidad y consistencia visual

Login usa campos claros y distingue acción principal, Google y acceso a registro; errores vacíos están junto al campo. La recuperación real no se evaluó: la entrada sintética siempre termina en mensaje incorrecto de demostración, sin orientar una sesión real. Botón Recordar datos y salida requieren una política real de persistencia/logout; su presencia no garantiza comportamiento.

Mantiene marca, panel promocional, color y controles de US-01/US-02, pero reutiliza título/URL del registro. En móvil la cita une palabras (unaidea/entiendesmejor) y ocupa área antes del formulario. Son observaciones expertas, no métricas de usuarios. No se hicieron sesiones con usuarios ni se inventaron tiempos/tasas.

Referencia accesible: se abrió el diseño publicado y su enlace interno /login. Comparación a1440×900 y390×844, escala1. No hay versión/nodos aprobados ni tolerancias; se reportan diferencias, sin inventar porcentaje de fidelidad. Las capturas móviles desplazan cada página para mostrar el campo de correo: no son superposición del mismo offset. Barra flotante Figma pertenece al publicador.

| Elemento | Diseño publicado | Frontend observado |
| --- | --- | --- |
| Contenedor | Tarjeta blanca redondeada | Formulario abierto sobre fondo claro |
| Google | Debajo del botón de login | Encima de campos |
| Labels/campos | Tipografía/espacios mayores | Tipografía menor; métricas en E01 |
| Texto recordar | Recordarme | Recordar datos |
| Acciones básicas | Correo, clave, recuperación, login y registro | Mismas categorías, distinta composición |
| Mobile | Tarjeta compacta y controles con scroll | Panel promocional adicional, copy unido |
| Logout | No se comparó un estado de sesión real | Fuente pública navega; confirmación de salida real BLOQUEADA |

Aprobación de diferencias con Angie/diseño pendiente; no se califican cambios intencionales sin conocer la versión aprobada.

## 7. Defectos encontrados

| ID | Severidad propuesta | Reproducción / esperado / obtenido | Evidencia |
| --- | --- | --- | --- |
| US03-D01 | Alta | Abrir desde raíz, Inicia sesión, enviar datos sintéticos válidos. Esperado consultar Firebase; obtenido error fijo tras temporizador sin Auth/API. Google también carece de integración | E01 synthetic/google, E02 handler |
| US03-D02 | Alta | GET /login directo; esperado login disponible; obtenido404 | E02 |
| US03-D03 | Media | Cambiar a modo login; esperado título de inicio de sesión; conserva Registro y URL /register | E01 initial; criterio2.4.2 |
| US03-D04 | Alta | Enviar vacío; esperado relación campo-error y anuncio; obtenido small sin asociación, sin región viva y foco permanece en submit | E01 empty/axEmpty, E06; no implica prueba NVDA |
| US03-D05 | Media | Medir subtítulo/auxiliar/Recordar; esperado4.5:1; obtenido3.475/3.009/3.859 | E04; criterio1.4.3 |
| US03-D06 | Baja | Ancho390, leer cita; esperado espacios; palabras unidas al ocultar br | E07 |

Ningún defecto nuevo backend identificado; no se modificó frontend ni se publicaron issues. Las diferencias visuales tienen aprobación pendiente. Logout solo por navegación es limitación de la demo; retest funcional bloqueado, no un cierre real fallido ejecutado.

Para registrar issues: `[US-03][Dxx] síntoma`, tarea/caso, URL y versiones/fecha/navegador/viewport/lector, precondiciones sin secretos, pasos numerados, esperado/obtenido, HTTP real o sin respuesta, severidad/impacto, evidencia redactada y retest. Prioridad acordada con Product Owner; conservar resultados fallidos históricos. No publicar datos de cuentas, JWT, cookies o HAR crudo.

## 8. Dependencias del frontend

Angie debe integrar signInWithEmailAndPassword y Google con Firebase Client SDK, manejar respuesta real/protección de enumeración, obtener token y consultar perfil propio. Rutas de UI deben responder al estado auth; usuario sin perfil debe poder completar alta, y acceso a funciones que exigen perfil completo debe validarse en backend cuando existan. No usar solo navegación como prueba de sesión.

Implementar signOut cliente, limpiar estado/token del cliente, navegación segura tras salida y comportamiento al volver/recargar; acordar persistencia y significado de Recordar datos. Retirar mensajes de demo, alinear título/rutas y configurar disponibilidad directa de /login. Resolver contraste y semántica de errores, verificar lector y confirmar diseño aprobado. Sin modificar reglas/IAM en esta tarea.

Cuenta de prueba y mecanismo seguro autorizados para US-03; no solicitar nuevamente credenciales ni publicarlas. Usarlos solo cuando la integración se habilite y sin crear, borrar o modificar cuentas. La existencia de la cuenta Firebase no se verificó, pues no se autenticó. Política de revocación administrativa, si se desea, requiere alcance y autorización independientes; no inventar endpoint/logout ni revocar cuentas reales.

## 9. Go / No-Go

**GO para revisión de pruebas/documentación y futuro único commit US-03 por parte del usuario. NO-GO para cerrar US-03 o afirmar login/logout reales y WCAG AA aprobados.** Backend local verificado; login desplegado FALLA y escenarios de sesión BLOQUEADOS.

## 10. Evidencias

| ID | Archivo verificable | Estado/alcance |
| --- | --- | --- |
| E01 | [Navegador](evidencias/US-03/navegador.json) | DOM/estilos sin valores, secuencia Tab, mensajes, toggle vacío, AX reducido y referencia |
| E02 | [HTTP y fuente pública](evidencias/US-03/publico.json) | 200/401/403/404, hash/handler demo, inspección salida y rutas declaradas |
| E03 | [Verificación local](evidencias/US-03/verificacion-local.txt) | Build/test/typecheck/diff/status reales |
| E04 | [Contraste](evidencias/US-03/contraste.json) | Cálculo/método y pares medidos |
| E05 | [Login desktop](evidencias/US-03/login-desktop.png) | Formulario vacío, 1440×900 |
| E06 | [Vacíos](evidencias/US-03/login-vacios.png) | Errores y foco envío reales, sin valores |
| E07 | [Login móvil](evidencias/US-03/login-mobile.png) | Después de limpiar entradas, scroll hacia correo |
| E08 | [Diseño desktop](evidencias/US-03/diseno-login-desktop.png) | Referencia publicada accesible |
| E09 | [Diseño móvil](evidencias/US-03/diseno-login-mobile.png) | Referencia con scroll |
| E10 | [Pruebas](../tests/users.test.ts) y [casos](US-03-casos-prueba.md) | Fuente y trazabilidad |

Sin capturas de éxito/logout ficticias, HAR, bundle completo ni valores de entrada. La inspección de fuente se correlacionó con hash público; no prueba el estado administrativo del proyecto Firebase. Evidencias de sesión/lector/recuperación real siguen pendientes y no tienen archivos inventados.

## 11. Seguimiento Taiga #84–#89

Estado de ejecución documental, sin cambios remotos en Taiga.

| Tarea | Estado real | Pendiente |
| --- | --- | --- |
| #84 · Autenticación/autorización API | Completada local: inventario y4 nuevas pruebas;75/75 | Firma/revocación/identidades reales en entorno autorizado |
| #85 · Casos de sesión | Completada: matriz local/externa y modelo logout | Añadir retests sin sobrescribir histórico |
| #86 · Funcionales producción | Parcial: UI/API públicas ejecutadas; integración FALLA | Integración pendiente; cuenta específica ya autorizada; logout/persistencia/perfiles/red BLOQUEADOS |
| #87 · WCAG | Parcial con fallos título/contraste/errores y muestras aprobadas | Lector, zoom, foco integral y proceso autenticado |
| #88 · Usabilidad/visual | Evaluación y comparación públicas disponibles | Aprobación de diseño y confirmación de salida real |
| #89 · Seguimiento/evidencias | Consolidación lista para revisión | Coordinar correcciones, retest y cierre final |

## 12. Pendientes para cerrar US-03

Confirmar criterios de aceptación, versiones desplegadas y diseño aprobado. Corregir integración/rutas/título y accesibilidad con Angie. Con la integración habilitada, ejecutar login válido/errores controlados con la cuenta ya autorizada, sin crearla si no existe. Google o pruebas con más identidades pueden necesitar autorización adicional; verificar perfil incompleto y propiedad dentro de los permisos disponibles; verificar logout, acceso posterior, persistencia y fallo seguro de red. Probar lector/zoom y completar evaluación AA; registrar defectos/retests con evidencia. Mantener NO-GO hasta resolver bloqueos y fallos obligatorios. No se hicieron commit ni push.
