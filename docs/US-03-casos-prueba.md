# US-03 · Casos de inicio y cierre de sesión

Fecha: 11 de noviembre de 2026 (America/Bogota). Rama: `feature/US-03-inicio-sesion`. Alcance Yoselin #84–#89. [Informe QA](US-03-informe-QA.md).

PASA = ejecutado y conforme dentro del alcance indicado. FALLA = incumplimiento observado. BLOQUEADO = falta una precondición. NO EJECUTADO = pendiente, sin resultado. Un mock no prueba credenciales reales, firma JWT, persistencia, logout Firebase ni permisos del despliegue.

## Contrato y preparación

Firebase Client SDK debe autenticar al usuario en frontend. La API recibe ID token por Bearer y verifica con revocación en cada petición; obtiene UID/email/proveedor del token verificado, nunca del cuerpo. No hay endpoint Express de login/logout ni sesiones de servidor/cookies de autenticación implementadas. No crearlos para sustituir Firebase.

Local: npm instalado según package.json, servicios y rutas reales con fixture/verificador/MemoryStore simulados, sin ADC ni red. La suite final pasa 75 pruebas (71 heredadas, 4 nuevas US-03). Rutas /users/me requieren token, pero permiten gestionar perfil incompleto; /private es exclusivamente un fixture que exige autenticación y perfil completo. No se afirma que existan rutas privadas del salón implementadas en API.

Externo: Chrome headless/CDP aislado, sin cuenta ni credenciales US-01. Login accesible desde frontend raíz mediante Inicia sesión; URL permanece /register. La URL directa /login devuelve404. Las entradas sintéticas solo prueban UI; el archivo de evidencia no guarda sus valores. Las peticiones mutantes de navegador estaban bloqueadas como precaución, contador observado0; el handler inspeccionado confirma la ausencia de autenticación real. No interpretar esa precaución como una caída de Firebase.

## Casos locales simulados

Evidencia común: [suite](evidencias/US-03/verificacion-local.txt) y [pruebas](../tests/users.test.ts). Fixture nuevo por prueba o variante. Los títulos abreviados de evidencia se encuentran en la salida TAP.

| ID | Escenario | Precondiciones | Pasos | Esperado | Obtenido | Estado | Evidencia |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S-L01 | Identidad válida password | Verificador simulado password | POST y GET propio con token aceptado | 201/200, identidad del verificador | Perfil propio, proveedor/correo derivados | PASA local | US-01 registro manual HTTP |
| S-L02 | Identidad válida Google | Verificador google.com | Crear/leer perfil propio | 201/200 y proveedor Google | Conforme; no OAuth real | PASA local | CRUD propio; US-02 identidad mínima |
| S-L03 | Sin autenticación | Sin Bearer | GET/POST/PATCH/DELETE | 401 antes de acceder a datos | Todos rechazados | PASA local | Auth cabecera, US-01 POST, US-03 PATCH/DELETE |
| S-L04 | Token inválido/expirado/revocado | Errores SDK simulados | Rutas protegidas; mutaciones negativas | 401 sanitizado y sin cambios | Perfil/reserva intactos | PASA local | Auth invalid/expired/revoked; US-03 PATCH/DELETE |
| S-L05 | Cuenta eliminada/deshabilitada | Verificador lanza user-not-found/user-disabled | GET propio | 401 | Conforme | PASA local | Auth deleted/disabled; no prueba credenciales de cuenta inexistente |
| S-L06 | Identidad por solicitud | Perfil owner, ambos proveedores en variantes | GET válido; GET sin token; revocado; otro UID; owner nuevamente | No heredar identidad anterior; 401/401/404/200 | Conforme, revocación solicitada siempre | PASA local | US-03 identidad entre solicitudes |
| S-L07 | UID o claims manipulados | Cuenta simulada; cuerpos con uid/email/authProvider | POST/PATCH con campos no editables; query o URL UID ajeno | 400 por cuerpo; no acceso ajeno | Perfil ajeno intacto, consulta usa UID autenticado | PASA local | Validación; US-01 selección UID; US-02 UID inválido |
| S-L08 | Ruta privada completa | Owner completo; newcomer incompleto y otro ausente | GET /private con cada identidad y sin token | 200/403/403/401 | Conforme; perfil propio incompleto sigue legible | PASA local | US-03 completo ajeno no habilita |
| S-L09 | Proveedor no permitido | Verificador devuelve anonymous | POST propio | 403 | Conforme | PASA local | Auth proveedor no permitido |
| S-L10 | Firebase Admin falla | Entrada inválida, permisos/internal, cuota/unavailable simulados | Invocar servicio de autenticación | 401 entrada; 500 infraestructura inesperada; 503 transitoria | Mensajes exactos genéricos, sin SECRET | PASA local | US-03 clasificación SDK |
| S-L11 | Firestore falla | Store con error o transacción abortada | CRUD y escrituras | 503/500 según código, sin secretos ni cambios parciales | Conforme con almacenamiento simulado | PASA local | Firestore errores; Transacción abortada |
| S-L12 | Perfil incoherente | Reserva ajena/ausente o datos corruptos | Leer/actualizar/borrar/privado fixture | 409 sin exponer datos ni habilitar acceso | Conforme | PASA local | Inconsistencias existentes |

S-L06 prueba ausencia de identidad almacenada entre solicitudes, **no un cierre de sesión Firebase**. El token simulado que sigue siendo válido continúa autorizado según contrato; no se usa para prometer invalidación inmediata tras signOut.

## Casos externos reales y pendientes

URL, fecha exacta, navegador y respuestas están en [navegador](evidencias/US-03/navegador.json) y [HTTP/fuente pública](evidencias/US-03/publico.json). La autorización específica de cuenta US-03 y reutilización del archivo externo ya se recibió. La sesión real continúa BLOQUEADA por falta de integración. No se leyó el archivo ni se introdujeron sus valores en el frontend; no se crearán cuentas si no existen.

| ID | Escenario | Precondiciones | Pasos | Esperado | Obtenido | Estado | Evidencia |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S-P01 | Disponibilidad visual login | Frontend público | Desde raíz activar Inicia sesión | Mostrar formulario login | Formulario visible; permanece /register con título Registro | PASA disponibilidad; título FALLA en A02 | E01/E05 |
| S-P02 | Login por URL directa | URL /login declarada en cliente | GET directo | Pantalla login disponible | HTTP404 | FALLA | E02 |
| S-P03 | Campos vacíos | Formulario sin datos | Enfocar submit, Enter | Errores de obligatoriedad sin envío | Ambos campos inválidos y errores textuales | PASA visual; relación accesible FALLA | E01 empty; E06 |
| S-P04 | Correo mal formado | Formulario público | Introducir formato inválido sintético, enviar | Explicación de formato | Mensaje de correo válido y clave obligatoria | PASA UI | E01 malformed; sin guardar valores |
| S-P05 | Login integrado | Formulario; entrada sintética no asociada a cuenta | Enviar datos sintácticamente válidos | Consulta real Auth; error/sesión derivados de respuesta | Siempre mensaje simulado tras temporizador, sin llamadas Auth/API | FALLA integración | E01 synthetic; E02 handler |
| S-P06 | Credenciales incorrectas reales | Integración y cuenta autorizada US-03 | Enviar clave de prueba incorrecta con permiso | Rechazo real de Firebase sin sesión | No se ejecutó con cuenta | BLOQUEADO | No confundir con S-P05 |
| S-P07 | Cuenta inexistente real | Integración y correo de prueba permitido | Intentar login de cuenta inexistente | Error seguro según protección de enumeración | No se consultó Firebase | BLOQUEADO | Integración ausente |
| S-P08 | Login válido password | Integración y cuenta autorizada | Iniciar sesión y GET perfil | Firebase autentica, API 200/404 propio según perfil | Sin sesión real ni token | BLOQUEADO | Autorización recibida; credenciales no utilizadas por integración ausente |
| S-P09 | Login Google | Página pública | Activar Continuar con Google | Iniciar OAuth | Mensaje de futura integración | FALLA inicio; selección de cuenta BLOQUEADA | E01 google |
| S-P10 | API sin token/ficticio | Backend público | GET /users/me sin token y con ficticio | 401 | 401 en ambos | PASA | E02 |
| S-P11 | Ruta diagnóstica | Sin clave diagnóstica | GET firestore-status | 403 | 403, sin consultar datos con clave | PASA | E02 |
| S-P12 | Token válido/revocado real y perfil ajeno | Identidades autorizadas, integración; permiso específico para revocar | Consultar propio e intentar selección UID permitido por el plan | Solo propio; 401 revocado, sin datos ajenos | No se usaron tokens/UID ajenos ni revocó cuentas | BLOQUEADO | Suite local no sustituye producción |
| S-P13 | Perfil incompleto | Sesión real y perfil de prueba incompleto | Consultar propio e intentar funcionalidad privada implementada | Gestionar alta, bloquear función que exige completitud | No sesión y API del salón no implementada | BLOQUEADO | /private solo fixture |
| S-P14 | Cierre de sesión | Sesión Firebase real | Activar salida y verificar auth/currentUser y navegación | signOut cliente y retirada del token del cliente | Código público de salida solo navega; no hubo sesión real | BLOQUEADO funcional; limitación por inspección | E02 inspection |
| S-P15 | Acceso después de salir | S-P14 con sesión real | Navegar atrás/recargar y consultar sin token | UI no presenta sesión; API sin token401 | Solo API sin token está verificada; logout real pendiente | BLOQUEADO completo | S-P10 es independiente |
| S-P16 | Persistencia al recargar | Sesión real, política de persistencia acordada | Login, recarga, comprobar identidad y perfil | Comportamiento acorde a política; no navegación simulada | No sesión real; Recordar datos no acredita persistencia | BLOQUEADO | E02 fuente |
| S-P17 | Error de red | Solicitud Auth real, permiso para simular solo cliente | Desconectar cliente, enviar, restaurar | Error recuperable sin sesión falsa | No hay solicitud real que interrumpir | BLOQUEADO | Sin indisponibilidad inducida |
| S-P18 | Teclado/toggle | Formulario público vacío | Tab, Enter en envío; activar Mostrar/Ocultar vacío | Orden lógico, activación y cambio accesible de nombre/tipo | Secuencia registrada, errores al Enter, toggle text/Ocultar | PASA muestra | E01 tabs/toggle |
| S-P19 | Mensajes accesibles | Vacíos y mensaje de simulación | Inspeccionar DOM/AX | Relación error-campo y anuncios programáticos | Vacíos sin descripción/live; genérico login role=alert | FALLA vacíos; PASA semántica genérica, sin lector | E01 empty/axEmpty/synthetic |
| S-P20 | Móvil/contraste/diseño | Referencia publicada accesible | Medir estilos/ancho y comparar capturas | Textos legibles, controles usables, diferencias documentadas | Contraste auxiliar falla; sin scroll horizontal320; diferencias de composición | FALLA contraste; evaluación parcial | E03/E04/E07–E09 |

## Retest y evidencia segura

Confirmar integración/versiones antes de casos autenticados; cuenta específica y mecanismo seguro ya autorizados para US-03. No volver a solicitar esas credenciales. No crear, eliminar ni modificar cuentas; si la cuenta no existe, detener ese caso y reportarlo. No almacenar valores, cookies, tokens ni HAR crudo. Para cada retest conservar resultado anterior, añadir fecha/zona, caso, versiones, pasos, esperado/obtenido, HTTP real o «sin respuesta HTTP», código SDK sanitizado y evidencia. SignOut del cliente y revocación administrativa son acciones diferentes: no revocar cuentas sin autorización ni esperar que Express tenga un endpoint de logout inexistente.
