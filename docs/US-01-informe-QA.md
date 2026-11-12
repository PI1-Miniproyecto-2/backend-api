# US-01 · Informe QA del registro manual

Fecha: 11 de noviembre de 2026, America/Bogota. Ejecutor: Codex; seguimiento: Yoselin. Repositorio: backend-api. Rama: `feature/US-01-registro-manual`. Base: `c5013d6`. Entorno: Ubuntu Linux, Node.js v20.19.5, npm 10.8.2; navegador externo: Google Chrome 143.0.7499.40 headless mediante Chrome DevTools Protocol (CDP), perfil temporal aislado.

## Resumen ejecutivo

**NO-GO para cerrar US-01 o aprobar el registro desplegado.** La pantalla desplegada valida formularios, pero todavía no integra el registro con Firebase Authentication ni la creación del perfil en la API. El intento autorizado con la única cuenta de prueba no produjo solicitudes a esos servicios; se corroboró en el manejador público `onSubmit`, que solo valida y presenta un mensaje de demostración. No se confirmó ninguna cuenta creada y no se iniciaron sesiones ni modificaron cuentas preexistentes.

Se confirmó además: acceso directo a `/register` con HTTP 404; contraste insuficiente de textos normales; errores de campo sin asociación programática con su explicación; username con puntos aceptado por frontend y rechazado por backend. La comparación con el diseño publicado se ejecutó en escritorio y móvil y encontró diferencias de estructura, tipografía y componentes; falta confirmar cuáles son cambios aprobados.

Las 66 pruebas de backend se conservan; la verificación local inicial se registra en E19 y la nueva revalidación tras actualizar la cuenta, en E22. El backend con mocks no acredita integración real. US-01-09/10/11 tienen ejecución parcial y defectos/pendientes; US-01-12 consolida evidencia disponible y seguimiento, sin declarar cerrada la historia. GO únicamente para revisión y un futuro commit/PR de documentación QA con estos límites. No se hicieron commit, push, merge, PR ni cambio de rama.

## Alcance, autorización y manejo de datos

Se revisaron [README](../README.md), [casos US-01](US-01-casos-prueba.md), [evidencias TS-01](TS-01-evidencias-tecnicas.md), [modelo Firestore](modelo-perfiles-firestore.md), pruebas, rutas, servicios, middlewares, Swagger, Dockerfile, Compose, reglas Firebase y configuración de despliegue. No se encontraron criterios de aceptación formales; la cobertura siguiente se deriva del contrato y del encargo y debe confirmarse con Product Owner.

URL autorizadas: [frontend](https://frontend123-opal.vercel.app/), [Swagger backend](https://backend-api-yzvv.onrender.com/api-docs/) y [diseño publicado](https://jelly-speed-93201488.figma.site/). Se accedió al registro del diseño mediante su enlace interno Crear cuenta. No se conoce el commit de las aplicaciones desplegadas ni la versión aprobada del diseño.

El responsable QA autorizó pruebas controladas y una sola cuenta ficticia. Se comprobó que `~/.config/salon-estudio/qa/registro.env` existe, es legible, tiene permisos 600 y contiene `QA_TEST_EMAIL` y `QA_TEST_PASSWORD`. Se usaron en memoria para el intento autorizado; sus valores no aparecen en scripts, informes, salida de terminal ni capturas. No se guardaron DOM ni capturas de la pantalla con credenciales introducidas. Las capturas existentes muestran formularios vacíos o únicamente el username sintético `qa.nombre` y textos públicos del prototipo.

Las primeras comprobaciones de UI bloquearon toda petición mutante mediante CDP Fetch; no se interceptó ninguna, porque solo se ejecutaron validaciones de cliente. Ese bloqueo no se aplicó al intento de registro autorizado: la ausencia de solicitudes Auth/API en ese intento es un resultado observado, no efecto del bloqueo. POST vacío sin Authorization se ejecutó separadamente para comprobar 401. No se hizo carga, borrado, modificación de usuarios ajenos ni prueba con cuentas personales. No se creó una segunda cuenta para forzar duplicados.

Las sesiones de documentos conectados estaban vacías; se encontró Chrome local y se habilitó la inspección headless con permiso de red, sin añadir dependencias al repositorio. Esta continuación supera el bloqueo anterior de navegador/Figma. Los logs anteriores se conservan como históricos, no como resultados nuevos.

## Revalidación tras actualizar la cuenta autorizada

El responsable QA confirmó que el correo actualizado es de prueba y que la contraseña del archivo externo es exclusiva para Firebase, no para acceder al buzón. Se verificaron de nuevo permisos 600 y variables presentes sin mostrar valores. Se utilizó exclusivamente esa configuración; ningún correo proporcionado por chat se copió a la documentación.

E20 registra un nuevo intento desde Chrome aislado a las 22:34 del 11 de noviembre de 2026 (Bogotá; timestamp UTC en el JSON). Contraseña corta: mensaje «La contraseña debe tener mínimo 8 caracteres.» y password inválido. Confirmación distinta: «Las contraseñas no coinciden.» y confirmación inválida. Datos válidos: mensaje observado «¡Formulario validado correctamente! El registro está listo para conectarse con el servidor.», sin campos inválidos ni solicitudes Auth/API. No se confirmó cuenta creada; las operaciones autenticadas de perfiles no se ejecutaron.

E21 confirma frontend, health y OpenAPI HTTP 200 y el mismo handler de demostración. El hash del bundle coincide con E13: no se observó cambio de ese recurso público. El bloqueo de creación de perfil es la integración ausente, **no la falta de autorización o del archivo de credenciales**. No se repitieron las pruebas visuales anteriores ni se transfirieron sus resultados a una nueva versión.

El selector de mensajes se corrigió para esta revalidación e incluye small y `.register-feedback`; por eso E20 sí documenta el mensaje de estado real. Su propiedad `errors` agrupa tanto errores como mensajes de estado y no debe interpretarse como que la confirmación de demostración es un error de validación. Se mantuvo E18 intacto con sus limitaciones históricas.

## Criterios verificables y límites

| Criterio operativo | Backend-api / cobertura local | Verificación externa y límite actual |
| --- | --- | --- |
| Cuenta correo/contraseña | Consumo de identidad password, nunca registro público de contraseñas | Intento UI FALLA: handler de demostración, sin Firebase |
| Contraseña inválida / confirmación | Contraseñas rechazadas en cuerpo de perfil | Validación UI corta y confirmación distinta PASA; política real Firebase BLOQUEADA |
| Correo ya registrado | Firebase debe resolverlo; no es responsabilidad del CRUD | BLOQUEADO: sin integración y sin modificar cuentas existentes |
| Perfil y persistencia | POST/GET propio, correo del token y transacción, con mocks | BLOQUEADO: no se obtuvo una identidad nueva autenticada desde el registro |
| Username válido/duplicado | Regex, normalización y 409 con mocks | FALLA consistencia: UI permite punto; duplicado real BLOQUEADO |
| Identidad y propiedad | Bearer/revocación solicitada, UID propio | GET sin token/ficticio y POST sin token 401; firma real/propiedad con dos cuentas pendientes |
| Accesibilidad | API ofrece contrato, no DOM del formulario | Inspección DOM/AX, teclado CDP y contraste parciales ejecutados; lectores y auditoría integral pendientes |
| Usabilidad y fidelidad | No evaluables por respuestas JSON | Evaluación experta y comparación contra publicación Figma ejecutadas parcialmente |

Auth y Firestore son operaciones separadas. El flujo esperado es frontend → creación Firebase → ID token → POST `/api/v1/users/me`. Se admiten perfiles incompletos, PATCH para completar y GET para recuperar una escritura con respuesta ambigua. DELETE de perfil no elimina Authentication. `requireCompleteProfile` se prueba en una ruta fixture; no hay ruta de salón privada implementada aquí. Docker `/health` no demuestra Auth/Firestore; Admin usa IAM y omite reglas cliente. No se ejecutó despliegue ni publicación de reglas.

## Estados y trazabilidad de Yoselin

PASA = comprobación ejecutada con resultado esperado, en el alcance indicado. FALLA = incumplimiento observado. BLOQUEADO = falta precondición concreta. NO EJECUTADO = no realizado; no implica aprobación. Un PASA parcial no certifica el criterio completo ni se transfiere entre local y producción.

| Tarea | Evidencia / cobertura | Estado y seguimiento |
| --- | --- | --- |
| US-01-07 · Flujo API | Base c5013d6, L01–L18, 66 pruebas | Completada localmente; integración externa seguida en F01/F04 |
| US-01-08 · Casos | [Documento de casos](US-01-casos-prueba.md), matrices L/P/F | Completada; histórico preservado y continuación añadida |
| US-01-09 · Funcionales producción | F01–F14, E11–E13/E18 | Parcial: alta FALLA; validaciones/401 PASA; perfil, persistencia y duplicados BLOQUEADOS |
| US-01-10 · WCAG 2.2 AA | A01–A20, E14–E16 | Parcial: contraste y asociación de errores FALLA; lectores y alcance completo pendientes |
| US-01-11 · Usabilidad/fidelidad | H01–H10 y V01–V06, E17 | Evaluación experta/comparación disponible; aprobación de cambios y estados autenticados pendientes |
| US-01-12 · Consolidar | Este informe, evidencias E01–E19, defectos y plantilla de issue | Consolidación disponible para revisión; seguimiento y cierre final pendientes |

## US-01-09 · Casos funcionales externos

Versiones desplegadas no confirmadas. E18 contiene fecha UTC equivalente a la noche del 11 de noviembre en Bogotá. Los estados HTTP se distinguen de validaciones exclusivamente de cliente. No se inventan respuestas Firebase ni estados de perfil.

| ID / caso anterior | Precondiciones y pasos realmente ejecutados o pendientes | Esperado | Estado / obtenido real | HTTP / evidencia |
| --- | --- | --- | --- | --- |
| F01 / P01 · Registro válido | Cuenta del archivo autorizado; nombres QA, username único, términos y credenciales; activar Crear cuenta | Cuenta Auth, POST perfil 201 y confirmación del alta | FALLA: ninguna solicitud Auth/API; handler público solo valida y muestra mensaje de demostración | Sin HTTP de registro; E20/E21 y E18/E13 |
| F02 / P02 · Contraseña corta | Mismo correo controlado; contraseña de un carácter en ambos campos; enviar | Rechazo antes de alta | PASA solo validación UI: password aria-invalid=true, sin solicitudes. Política Firebase BLOQUEADA | Sin HTTP; E20 y E18 |
| F03 / P02 · Correo registrado | Requiere integración Firebase y cuenta de prueba existente autorizada para este caso | Error seguro, sin duplicar perfil | BLOQUEADO: registro no integrado; no se probó ni modificó cuenta existente | — |
| F04 / P01 · Crear perfil | Requiere ID token de cuenta nueva confirmada en esta ejecución | POST 201, GET 200, UID/email/reserva coherentes | BLOQUEADO por F01; no se obtuvo token ni se llamó al CRUD autenticado | —; E18 |
| F05 / P04 · Username duplicado | Requiere integración y dos identidades de prueba autorizadas | Segundo POST 409, sin cambios parciales | BLOQUEADO por F01 y autorización limitada a una cuenta | — |
| F06 / P05 · Token | GET propio sin token y token ficticio; POST {} sin token | 401 sanitizado | PASA en esos tres casos; revocación real/proyecto incorrecto pendientes | 401/401/401; E11/E12 |
| F07 / P03 · Error de red | Requiere solicitud real de registro y permiso para simular desconexión solo del cliente | Mensaje recuperable y GET ante resultado ambiguo | BLOQUEADO por ausencia de integración; no se simuló un fallo de infraestructura | — |
| F08 / P01 · Persistencia | Requiere perfil real recién creado; recarga/reentrada y lectura propia | GET 200, mismo createdAt, sin duplicados | BLOQUEADO por F01/F04. Independientemente la recarga de /register falla en F13 | — |
| F09 / P04 · Perfil ajeno | Dos cuentas autorizadas; intentar seleccionar UID ajeno | Sin lectura ni cambios ajenos | BLOQUEADO; no se usaron UID de usuarios reales | — |
| F10 / P03 · Incompleto/reintento | Requiere token autorizado; POST {}, PATCH y GET | Alta recuperable, POST repetido 409 | BLOQUEADO por F01; cubierto solo localmente con mocks | — |
| F11 · Formulario vacío | Abrir desde raíz; activar Crear cuenta con todos los campos vacíos | Errores por campo, sin envío | PASA visual: errores obligatorios y términos, aria-invalid=true; asociación accesible falla en D05 | Sin HTTP; E14 |
| F12 · Username con punto | Introducir qa.nombre y reenviar con otros campos vacíos | Regla de username consistente con API | FALLA: username deja de marcarse inválido; bundle admite punto y API lo excluye | Sin HTTP; E13/E14 |
| F13 · Acceso directo/recarga | Navegar a URL /register directamente con Chrome y curl | Formulario disponible al compartir/recargar ruta | FALLA: página 404 NOT_FOUND, aunque desde raíz se renderiza /register | 404; E12/E14 |
| F14 · Confirmación distinta | Cuenta controlada; password y confirmación diferentes; enviar | Rechazo antes de alta | PASA solo UI: confirmPassword aria-invalid=true; sin solicitudes | Sin HTTP; E20 y E18 |

P06 (reglas reales) y P07 (motor transaccional/concurrencia/fallos inducidos) siguen BLOQUEADOS por falta de entorno/proyecto/acceso administrativo adecuado. No se usó Admin para intentar demostrar reglas cliente ni se indujo indisponibilidad productiva. No se ejecutó `check:firestore` como sustituto del registro.

El selector de errores del intento con credenciales no incluyó los elementos small ni `.register-feedback`: sus arrays `errors: []` no acreditan ausencia de mensajes. E18 conserva esa limitación. En el primer intento el mensaje exacto se corroboró por inspección del código público (E13); en la revalidación se observó directamente y se guardó como texto sanitizado (E20), sin capturas de pantalla con credenciales. No se consultó Firebase Console; no se afirma una búsqueda exhaustiva de cuentas en ese proyecto.

## US-01-10 · Accesibilidad WCAG 2.2 AA

Se interpreta «manual de registro» como registro manual; si además existe una guía de usuario debe aportarse para su auditoría. Fuente: [WCAG 2.2 W3C](https://www.w3.org/TR/WCAG22/). AA incluye todos los criterios A/AA aplicables al proceso completo; esta muestra no es una certificación integral. Los resultados se refieren al frontend, no al sitio de diseño.

| ID | Criterios / nivel | Resultado real y alcance | Estado |
| --- | --- | --- | --- |
| A01 | 3.1.1 A; 3.1.2 AA | Formulario renderizado declara lang=es y contenido revisado en español; otros estados/idiomas pendientes | PASA en pantalla revisada; resto NO EJECUTADO |
| A02 | 2.4.2 A; 2.4.6 AA | Título «Registro» seguido de AulaPro, etiquetas descriptivas; h1 es cita decorativa, h2 es alta | PASA título/etiquetas; jerarquía como mejora de usabilidad |
| A03 | 1.3.1 A; 4.1.2 A | Campos tienen labels; botones mostrar/ocultar con nombre; avatares aria-pressed. Errores sin descripción asociada: D05 | FALLA relación de errores; etiquetas básicas PASA |
| A04 | 3.3.2 A; 1.3.5 AA | given-name/family-name/username/email/new-password presentes; requisitos de username contradictorios y obligatoriedad solo aparece al enviar | PASA propósitos de entrada; instrucciones parciales, corregir D06 |
| A05 | 3.3.1 A; 3.3.3 AA | Errores obligatorios en texto y aria-invalid; corta/confirmación distinta rechazadas. No se revisó recuperación Firebase | PASA identificación visual de vacíos; resto parcial |
| A06 | 1.4.1 A | Errores vacíos contienen texto, no solo rojo | PASA estado vacío; otros estados NO EJECUTADO |
| A07 | 2.1.1 A; 2.1.2 A | 21 Tab con CDP atraviesan 19 controles y vuelven a inicio sin trampa. No se completó alta por teclado | PASA recorrido Tab; activación integral NO EJECUTADO |
| A08 | 2.4.3 A; 1.3.2 A | Orden: enlaces, Google, nombres, username, correo, claves/toggles, avatares, términos, envío, login | PASA orden de pantalla inicial; lector pendiente |
| A09 | 2.4.7 AA; 2.4.11 AA | Foco inicial y estilos inspeccionados, controles visibles en recorrido desktop; captura de input enfocado. No se midieron todos los focos/overlays | Verificación parcial; sin aprobación global |
| A10 | 1.4.3 AA | Subtítulo 12px #788985 sobre #F7F9F8: 3.475:1; texto auxiliar inferior #87938F: 3.009:1, mínimo 4.5:1 | FALLA; D04/E16 |
| A11 | 1.4.11 AA | Se guardaron bordes/colores computados; falta medir todos los componentes, estados y fondos efectivos | NO EJECUTADO completo |
| A12 | 1.4.4/1.4.10/1.4.12 AA | A 320 CSS px no hay desborde horizontal; screenshots a 390. Zoom 200% y espaciado no se probaron | PASA muestra de ancho; resto NO EJECUTADO |
| A13 | 2.5.8 AA | Toggles medidos 23×23 CSS px; no se dicta fallo por tamaño solo, debe evaluar excepción de espaciado. Otros objetivos y excepciones pendientes | Medición parcial, NO EJECUTADO completo |
| A14 | 4.1.3 AA | En errores vacíos no hay alert/status/live; foco no se dirige a error; texto small no asociado y AX carece de descripción. Éxito tiene handler de status en fuente, no se probó con lector | FALLA anuncio programático de errores; D05 |
| A15 | 3.2.1 A; 3.2.2 A | Tab no provocó navegación inesperada en pantalla inicial; otros controles/estados no revisados integralmente | PASA muestra; resto NO EJECUTADO |
| A16 | 3.3.7 A; 3.3.8 AA | Autocompletado new-password y mostrar/ocultar campo vacío comprobados. Pegado, gestor y autenticación real pendientes | Verificación parcial; integración BLOQUEADA |
| A17 | 2.5.3 A; 2.5.2 A | Nombres visibles y accesibles extraídos; cancelación de puntero no probada | NO EJECUTADO completo |
| A18 | 1.1.1 A; 2.4.4 A | Enlaces tienen texto y avatares nombre; inventario completo de imágenes/alternativas pendiente | Verificación parcial |
| A19 | 1.3.4 AA; 2.5.7 AA | Emulación de ancho no prueba orientación física ni todos los gestos | NO EJECUTADO |
| A20 | 2.2.1 A; 3.2.6 A; 3.3.4 AA | No se evaluaron expiración, ayuda repetida o confirmación de datos persistidos | BLOQUEADO proceso real; aplicabilidad pendiente |

Método de contraste E16: luminancia relativa sRGB, razón (L claro+0.05)/(L oscuro+0.05), texto y primer fondo opaco identificado en estilos computados. Solo se califican los pares resueltos; se omiten fondos no identificados. El párrafo inferior contiene un enlace con color propio: el fallo se atribuye al texto auxiliar heredado, no automáticamente al enlace. [Criterio de contraste](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

El [mínimo de objetivos](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) contempla excepciones, por eso 23px por sí solo no basta para marcar FALLA. El [anuncio de estado](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) y la [identificación de errores](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html) requieren verificación semántica además del color.

| Herramienta/procedimiento | Estado real |
| --- | --- |
| Chrome headless/CDP, DOM renderizado, estilos y AX | EJECUTADO; evidencias E14–E16 |
| Teclado CDP Tab | EJECUTADO; 21 eventos y secuencia en teclado.json, sin completar alta por teclado |
| NVDA / Orca | NO EJECUTADO; no se invocaron lectores. Árbol AX no equivale a experiencia con lector |
| Lighthouse / axe | NO EJECUTADO; no instalados ni invocados; ninguna puntuación inventada |
| Contraste | EJECUTADO muestra de texto, con fallos; no integral |
| Reflow | EJECUTADO 320/390 CSS px; zoom/espaciado NO EJECUTADO |

## US-01-11 · Usabilidad y fidelidad visual

Evaluación experta parcial basada en [Nielsen, NN/g](https://www.nngroup.com/articles/ten-usability-heuristics/); no se realizaron sesiones con usuarios ni se atribuyen tiempos o porcentajes de éxito.

| ID | Heurística | Observación real / estado |
| --- | --- | --- |
| H01 | Visibilidad del estado | FALLA flujo de alta: termina en validación de demostración, no creación. API no recibe solicitudes |
| H02 | Lenguaje del usuario | Campos en español claros; FALLA copy móvil: «unaidea», «entiendesmejor» al ocultar br sin espacios, D07 |
| H03 | Control y libertad | Volver al inicio e inicio de sesión disponibles; navegación/recuperación completa pendientes; acceso directo 404, D03 |
| H04 | Consistencia | FALLA username frente a API; diferencias visuales de diseño E17, aprobación pendiente |
| H05 | Prevención | PASA vacíos, clave corta y confirmación distinta; FALLA regla de username con punto |
| H06 | Reconocimiento | Labels persistentes y ejemplo visibles; requisitos de username no corresponden a API; obligatoriedad no indicada antes de enviar, mejora pendiente |
| H07 | Eficiencia | Autocompletado presente y foco recorrible; gestor/pegado y flujo completo NO EJECUTADO |
| H08 | Minimalismo | Acción Crear cuenta identificable; en móvil panel promocional ocupa primera pantalla y desplaza formulario. Observación de fricción, sin métrica de usuarios |
| H09 | Recuperación | Errores vacíos junto a campos; sin asociación accesible. Recuperación de red/409 BLOQUEADA por integración |
| H10 | Ayuda/documentación | Hint de username presente pero sin regla válida; guía de registro no aportada. Evaluación de ayuda completa BLOQUEADA |

Comparación ejecutada contra la publicación Figma proporcionada, no contra archivo editable ni versión congelada/aprobada. Misma ventana 1440×900 y 390×844 CSS px, escala 1 y zoom por defecto. Se accedió a registro del diseño desde Crear cuenta. La barra flotante Figma es del publicador y no se califica como parte del producto. No se fijaron tolerancias ni se calculó porcentaje de similitud.

| ID | Comparación | Resultado observado / estado |
| --- | --- | --- |
| V01 | Composición desktop | DIFERENCIA: diseño presenta tarjeta blanca redondeada; frontend formulario abierto y más ancho sobre fondo claro |
| V02 | Tipografía | DIFERENCIA medida: labels 14px diseño / 10px frontend; título 30px / 27px desktop |
| V03 | Colores/recursos | DIFERENCIA visible en verdes, marca, fondo y decoración lateral; contraste frontend falló por separado |
| V04 | Campos/acciones | DIFERENCIA: diseño Nombre completo + username en fila; frontend Nombres/Apellidos y username ancho. Google debajo en diseño, arriba en frontend; avatares adicionales en frontend |
| V05 | Estados | Vacío comparado; errores frontend capturados. Comparación de éxito/errores equivalentes contra diseño NO EJECUTADA |
| V06 | Mobile | Capturas de ambos a 390×844; frontend conserva panel promocional y muestra copy unido. Comparación inicial ejecutada; scroll completo/teclado virtual pendientes |

Estas diferencias son observaciones verificadas; su aceptación final está BLOQUEADA hasta confirmar con diseño cuáles son cambios autorizados. No se declara fidelidad aprobada ni se inventa fallo contra una tolerancia inexistente. Capturas y medidas están en E17.

## Defectos y riesgos

| ID | Severidad propuesta / hallazgo | Reproducción, esperado y obtenido | Evidencia / acción |
| --- | --- | --- | --- |
| D01 | Baja · Swagger divergente | GET openapi remoto; esperado descripción local de registro; remoto conserva descripción anterior | E05/E11; cotejar versión desplegada |
| D02 | Alta · Registro sin integración | Desde raíz completar datos válidos de prueba y enviar. Esperado Auth + POST perfil; obtenido handler de demostración y cero solicitudes Auth/API | E13/E18; frontend integra Firebase y perfil, luego repetir F01–F10 |
| D03 | Alta · Ruta directa 404 | Abrir /register directamente o recargar URL; esperado formulario, obtenido 404 NOT_FOUND | E12/E14; revisar rewrites SPA en despliegue frontend |
| D04 | Media · Contraste insuficiente | Abrir registro desktop; medir subtítulo/texto inferior. Esperado 4.5:1, obtenido 3.475 y 3.009 | E16; corregir colores y retest WCAG 1.4.3 |
| D05 | Alta · Errores no asociados/anunciados | Enviar vacío. Esperado vínculo campo-explicación y anuncio; obtenido small sin id/aria-describedby/aria-errormessage, sin región viva y AX sin descripción | E14/E15; corregir semántica y verificar con lector; no se afirma ensayo NVDA |
| D06 | Media · Username incompatible | Usar qa.nombre: UI no lo marca inválido; regex pública permite punto, contrato API no. Esperado regla consistente | E13/E14; alinear frontend con contrato sin ampliar backend por suposición |
| D07 | Baja · Copy móvil unido | Ancho 390, observar cita: unaidea/entiendesmejor; esperado espacios entre palabras | E14/E17; corregir br responsive/contenido y retest |

Ningún defecto se corrigió en frontend desde este repositorio y no se publicaron issues. D02 bloquea el objetivo principal de la historia; D04/D05 impiden aprobar accesibilidad con esta evidencia. D05 tiene evidencia estructural, no resultado de un lector real. D03 afecta ruta/recarga, no demuestra pérdida de datos persistidos.

Riesgos pendientes: integración y política real Firebase/IAM/CORS/reglas; alta parcial entre servicios; reconciliación administrativa; protección de futuras rutas del salón; pruebas con dos identidades; credenciales de prueba que podrían corresponder a cuenta preexistente (no se inició sesión ni modificó); criterios formales/versionado no aportados. TS-01 reportó históricamente 8 vulnerabilidades moderadas: no se hizo auditoría nueva ni se confirma su vigencia. La API deriva email del token, pero no exige email_verified: confirmar con Product Owner si se requiere verificar buzón, sin cambiar contrato por suposición.

## Evidencias verificables

Todas las rutas siguientes existen salvo las marcadas pendientes. Las capturas no contienen las credenciales de la cuenta autorizada. Los textos/ejemplos de los prototipos son contenido público; no se incluyen datos de usuarios reales.

| ID | Archivo/enlace | Estado y alcance |
| --- | --- | --- |
| E01 | [Casos US-01](US-01-casos-prueba.md) | Disponible; histórico + seguimiento |
| E02 | [TS-01](TS-01-evidencias-tecnicas.md) | Histórico; 58 pruebas de esa revisión |
| E03 | [Pruebas usuarios](../tests/users.test.ts), [Swagger](../tests/docs.test.ts) | Fuente de suite actual de 66 |
| E04 | [Verificación previa](evidencias/US-01/verificacion-local.txt) | Histórico local anterior, incluido bloqueo/reintento de sockets |
| E05 | [Contrato Swagger local](../src/config/users.openapi.ts) | Fuente local; no identifica commit remoto |
| E06 | [Dockerfile](../Dockerfile), [Compose](../compose.yaml), [reglas](../firestore.rules) | Inspección; publicación remota no demostrada |
| E07 | [Frontend](https://frontend123-opal.vercel.app/), [API](https://backend-api-yzvv.onrender.com/api-docs/) | URL reales; versión desplegada no confirmada |
| E08 | NVDA, Orca, Lighthouse/axe, zoom/espaciado | Pendiente; sin archivos ni resultados |
| E09 | [Diseño suministrado](https://jelly-speed-93201488.figma.site/) | Accedido con Chrome; no es archivo Figma con versión aprobada |
| E10 | Issues/retests | Pendiente; no se publicaron issues |
| E11 | [GET públicos previos](evidencias/US-01/comprobaciones-publicas.txt) | HTTP 200/401 y divergencia documental |
| E12 | [Continuación pública](evidencias/US-01/continuacion-publica.txt) | HTTP 404 directo, diseño 200, POST sin token 401 |
| E13 | [Integración y hash de bundle](evidencias/US-01/integracion-frontend.txt) | Handler público y regex, sin credenciales |
| E14 | [Inicial DOM](evidencias/US-01/frontend-inicial.json), [captura](evidencias/US-01/frontend-inicial.png), [errores DOM](evidencias/US-01/frontend-errores-vacios.json), [errores captura](evidencias/US-01/frontend-errores-vacios.png), [username](evidencias/US-01/frontend-username-invalido.json), [404](evidencias/US-01/frontend-acceso-directo-404.json) | Frontend renderizado sin credenciales; vacíos/punto y acceso directo |
| E15 | [Teclado](evidencias/US-01/teclado.json), [AX](evidencias/US-01/arbol-accesibilidad.json), [toggle vacío](evidencias/US-01/activacion-validacion.json), [foco](evidencias/US-01/frontend-foco.png) | Eventos Tab/DOM y árbol; no lector de pantalla |
| E16 | [Contraste](evidencias/US-01/contraste-texto.json), [estilos desktop](evidencias/US-01/frontend-mediciones-desktop.json), [320px](evidencias/US-01/frontend-mediciones-320.json), [errores](evidencias/US-01/frontend-errores-mediciones.json) | Mediciones parciales reales |
| E17 | [Diseño desktop](evidencias/US-01/diseno-registro-desktop.png), [medidas](evidencias/US-01/diseno-mediciones-desktop.json), [diseño móvil](evidencias/US-01/diseno-registro-mobile.png), [frontend móvil](evidencias/US-01/frontend-mobile.png), [medidas móvil](evidencias/US-01/frontend-mediciones-mobile.json), [320](evidencias/US-01/frontend-320.png) | Comparación inicial real; capturas sin cuenta |
| E18 | [Intento autorizado](evidencias/US-01/registro-autorizado.json) | Estado aria-invalid y red sanitizados; limitaciones del selector documentadas |
| E19 | [Verificación de continuación](evidencias/US-01/continuacion-verificacion.txt) | Comandos/resultados locales iniciales |
| E20 | [Registro con cuenta actualizada](evidencias/US-01/registro-revalidacion.json) | Mensajes reales, estado de campos y ausencia de solicitudes; sin valores de credenciales |
| E21 | [Despliegue revalidado](evidencias/US-01/revalidacion-publica.json) | HTTP públicos, hash y handler sin integración |
| E22 | [Verificaciones locales reejecutadas](evidencias/US-01/revalidacion-local.txt) | Build, suite, tipos y diff de esta revalidación |

Los demás JSON/PNG del directorio documentan el diseño inicial y estados de errores/mobile relacionados. Ningún nombre de evidencia propuesta equivale a una captura realizada. Para cada ejecución nueva registrar fecha/zona, URL, versión, caso, pasos, esperado, obtenido, estado y enlace; omitir Authorization, passwords, tokens y datos personales. No subir HAR crudo. No se generaron capturas de éxito ficticias.

## Registro de defectos y seguimiento en GitHub

Crear manualmente una issue por defecto confirmado en el repositorio responsable (principalmente frontend para D02–D07), enlazada a US-01 y al ID de este informe. No crear issues desde esta ejecución. Plantilla:

```text
Título: [US-01][área][Dxx] comportamiento observado
Tarea / caso / criterio de aceptación o WCAG:
Entorno: URL sin secretos, commit/versiones si disponibles, fecha/zona,
         SO, navegador, viewport, lector/herramienta y versión.
Precondiciones: alias de cuenta autorizada, sin credenciales.
Pasos de reproducción numerados:
1.
2.
Esperado:
Obtenido: HTTP real o «sin respuesta HTTP»; código SDK redactado si existe.
Frecuencia / número de intentos:
Severidad y justificación del impacto:
Prioridad acordada con Product Owner:
Evidencia: enlace/archivo redactado.
Responsable / estado / versión corregida / resultado y evidencia del retest:
```

Severidad propuesta: crítica = exposición/pérdida de datos o caída general; alta = bloquea registro o acceso sin alternativa razonable; media = obstáculo relevante con alternativa; baja = impacto menor. Prioridad se acuerda separadamente. Flujo: abierta → triage → corrección → lista para QA → retest → cerrada o reabierta. Conservar el resultado fallido histórico y añadir retest, no sobrescribirlo.

## Verificaciones locales de esta continuación

Resultados exactos iniciales en E19 y reejecución actual en E22:

| Comando | Resultado de esta continuación |
| --- | --- |
| `npm run build` | PASA, código 0 |
| `npm test` | PASA, código 0; 66 aprobadas, 0 fallidas, 0 canceladas, 0 omitidas |
| `npm run typecheck` | PASA, código 0 |
| `git diff --check` | PASA, código 0; también archivos nuevos revisados sin diagnósticos de espacios |
| `git status --short` | Código 0; únicamente casos/informe y evidencias QA, sin cambios de aplicación |

La suite se ejecutó con sockets locales autorizados para tsx/Supertest, sin leer el archivo de credenciales. No se añaden dependencias ni pruebas redundantes; se conservan arquitectura y frontend. Las respuestas 201/400/409/500/503 de mocks siguen siendo evidencia local, no producción.

## Go / No-Go y pendientes de cierre

**GO para revisión y futuro commit/PR documental; NO-GO para aprobación de US-01 y del registro desplegado.** Corregir D02/D03, alinear validaciones y resolver accesibilidad; confirmar los cambios visuales con diseño; desplegar versión identificable; repetir F01–F14 y completar persistencia, duplicados y recuperación con cuentas autorizadas. Ejecutar lector, activación completa por teclado y criterios WCAG pendientes. Aportar criterios formales y verificar IAM/reglas en entorno autorizado. Yoselin consolida retests y decisión final.

La única cuenta autorizada no se amplía implícitamente a una segunda identidad. No se elimina ni modifica ninguna cuenta preexistente. No hay limpieza pendiente de una cuenta cuya creación se haya confirmado en esta ejecución; si el equipo identifica datos de prueba externos, su gestión requiere verificar titularidad antes de actuar.
