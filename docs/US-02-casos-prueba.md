# US-02 · Casos de prueba: Google y username obligatorio

Fecha: 11 de noviembre de 2026 (America/Bogota). Rama: `feature/US-02-registro-google`. Alcance Yoselin: #72–#77. [Informe y seguimiento](US-02-informe-QA.md).

## Contrato y estados

Firebase Authentication debe realizar OAuth en el frontend y entregar un ID token. La API usa `verifyIdToken(token, true)`, extrae UID/email/proveedor y opera exclusivamente sobre `/api/v1/users/me`. No recibe contraseñas ni implementa OAuth mediante endpoints públicos nuevos.

Username es **necesario para completar** un perfil: 3–20 letras ASCII, números o `_`, unicidad sin distinguir mayúsculas. También se requieren nombres/apellidos válidos según TS-01. Crear un perfil transitorio sin username con `{}` o `username: null` es válido (201, profileCompleted=false); no equivale a completar US-02. Una cadena vacía, espacios o nombre inválido da 400. GET propio ausente da 404, PATCH completa, POST repetido da 409. La funcionalidad que exige perfil completo debe aplicar el middleware correspondiente; `/private` solo existe en pruebas.

PASA: comprobación ejecutada y resultado esperado en su entorno. FALLA: incumplimiento observado. BLOQUEADO: falta una precondición. NO EJECUTADO: pendiente sin resultado. Los mocks no prueban OAuth, firma JWT real, IAM, reglas o persistencia del motor Firestore.

## Local: servicios reales, verificador y almacenamiento simulados

Precondición común L: dependencias instaladas, fixture nuevo por prueba/variante, sin ADC, credenciales o acceso a Firebase. Evidencia común [suite final](evidencias/US-02/verificacion-local.txt) y [código de pruebas](../tests/users.test.ts). Resultado final: 71 pruebas aprobadas, 0 fallidas, 0 omitidas; 5 pruebas nuevas US-02 y 66 regresiones existentes. No se duplican las pruebas genéricas TS-01/US-01.

| ID | Requisito/escenario | Precondiciones | Pasos | Esperado | Obtenido | Estado | Evidencia |
| --- | --- | --- | --- | --- | --- | --- | --- |
| G-L01 | Identidad Google verificada | L; verificador inyectado google.com | Verificar token simulado y crear perfil completo | UID/email/proveedor del verificador, checkRevoked=true, 201 | Identidad mínima e inmutable y perfil google.com | PASA local | CRUD propio; US-02 identidad mínima |
| G-L02 | Primera autenticación sin perfil | L; UID sin documento | GET propio y ruta privada fixture; crear {} | 404, 403 y 201 incompleto sin reserva | Estados esperados, avatar predeterminado | PASA local | Perfil incompleto de Google |
| G-L03 | Nombres Google sin username | L | POST con nombres, omitir username o enviar null; intentar privado; PATCH username válido | Incompleto, 403; PATCH completa/reserva y conserva createdAt; privado 200 | Ambas variantes aprobadas | PASA local | US-02 nombres sin username |
| G-L04 | Username ocupado | L; perfil A reservado | POST B con mismo nombre | 409, sin perfil ni escritura parcial de B | Conflicto esperado | PASA local | Unicidad nombre ocupado |
| G-L05 | Mayúsculas/minúsculas y proveedor | L; password tiene Ana_01 | Crear Google con ANA_01 | 409, reserva global para ambos proveedores | Sin escrituras nuevas, reserva intacta | PASA local | US-02 reserva global |
| G-L06 | Username vacío/espacios/punto | L | POST con cada variante; crear incompleto y repetir variantes en PATCH | 400, sin completar ni reservar | POST/PATCH rechazados, privado 403 | PASA local | US-02 vacío/espacios/punto |
| G-L07 | Longitud/tipos/avatares/campos administrados | L | Enviar cuerpos inválidos y campos uid/email/authProvider | 400 antes de escribir; límites válidos aceptados | Validaciones aprobadas | PASA local | Tabla Validación; límites username |
| G-L08 | Token ausente | L | GET/POST sin Bearer y cabeceras mal formadas | 401 sin acceso a datos | Rechazo esperado | PASA local | Auth cabecera; US-01 POST exige token |
| G-L09 | Token inválido/revocado/expirado | L; errores Firebase simulados | Invocar rutas protegidas con cada error | 401 sin secretos, revocación solicitada | Respuestas sanitizadas | PASA local | Auth invalid/expired/revoked/disabled/deleted |
| G-L10 | Perfil ajeno | L; A existe, token B | GET/PATCH propio B y URL de A; intentar uid en cuerpo | Sin lectura/sobrescritura ajena; 404/400 según caso | Perfil A intacto | PASA local | UID; Validación uid |
| G-L11 | Firestore indisponible/aborto | L; fallo inyectado | CRUD y fallo durante escritura | 503 transitorio/500 inesperado, sin secretos; rollback | Estados esperados y atomicidad simulada | PASA local | Firestore; Transacción abortada |
| G-L12 | Reintento de creación | L; perfil ya creado | Repetir POST; GET | 409 sin sobrescribir; GET devuelve original | Aprobado | PASA local | CRUD propio |
| G-L13 | Concurrencia | L; dos UID | POST simultáneos con mismo nombre | Un 201 y un 409 | Una reserva, un perfil en MemoryStore | PASA local | Unicidad concurrente; no prueba motor real |
| G-L14 | Identidad vinculada / mismo correo | L; servicio inyectado | Password→Google mismo UID; otro UID con mismo email | Mismo UID conserva perfil; otro UID no lo hereda | Sin fusión por email ni duplicación de reserva | PASA local | US-02 identidades vinculadas; no realiza linking Firebase |
| G-L15 | UID inválido / claims no editables | L; decoded simulado | Verificar UID vacío/con slash y claims de nombre | 401 UID inválido; identidad mínima para válido | Aprobado | PASA local | US-02 identidad Google mínima |

Los nombres abreviados de evidencia corresponden a títulos de pruebas de `tests/users.test.ts`; la salida TAP identifica cada ejecución. La inicialización diferida/Admin y el adaptador Firestore también conservan sus pruebas existentes. Los tokens de prueba son cadenas interpretadas por mocks, no JWT válidos.

## Producción e interfaz pública

Entorno: frontend Vercel y API Render de US-01, Chrome headless/CDP con perfil temporal sin sesiones, diseño Figma publicado. **No se usaron credenciales de US-01 ni se seleccionó cuenta Google.** La fecha exacta y URL están en [navegador](evidencias/US-02/navegador.json) y [HTTP público](evidencias/US-02/publico.json).

| ID | Requisito/escenario | Precondiciones | Pasos | Esperado | Obtenido | Estado | Evidencia |
| --- | --- | --- | --- | --- | --- | --- | --- |
| G-P01 | Inicio registro Google | Página pública, sin sesión | Desde raíz enfocar Google, Enter y clic | Iniciar OAuth Firebase/selector Google | Mensaje de demostración; sin solicitudes Auth/API | FALLA | navegador afterEnter/afterClick; publico handler; google-desktop.png |
| G-P02 | Registro Google exitoso | OAuth integrado y cuenta Google de prueba con autorización específica | Elegir cuenta de prueba y completar OAuth | Identidad Google y token válido | No hay selector; no se usó cuenta | BLOQUEADO | G-P01; falta autorización de cuenta OAuth si se integra |
| G-P03 | Primera sesión / username obligatorio | Identidad Google nueva | Entrar sin perfil; elegir username; crear | Alta pendiente hasta username, luego perfil completo | No se obtiene identidad ni pantalla posterior | BLOQUEADO | G-P01 |
| G-P04 | Creación y persistencia | Cuenta OAuth autorizada, ID token y entorno correcto | POST perfil; GET y recargar | 201/200 y perfil persistido para mismo UID | No ejecutado con autenticación real | BLOQUEADO | G-P01; no se afirma persistencia |
| G-P05 | Duplicado y case-insensitive | Dos cuentas de prueba autorizadas, reserva | Solicitar mismo nombre cambiando mayúsculas | 409 y UI recuperable | Sin cuentas OAuth ni integración | BLOQUEADO | G-L04/G-L05 son solo locales |
| G-P06 | Username vacío/inválido tras Google | Sesión OAuth | Omitir o introducir nombre inválido | No completar perfil; explicación corregible | No existe flujo posterior Google operativo | BLOQUEADO | G-P01 |
| G-P07 | Token ausente/inválido | API pública | GET /users/me sin token y con token ficticio | 401 sanitizado | 401 en ambos | PASA | publico.json |
| G-P08 | Revocación real / perfil ajeno | OAuth integrado, cuentas autorizadas y permiso de revocación si aplica | Intentar token revocado y selección UID ajeno | Sin acceso ni cambios ajenos | No se actuó sobre usuarios reales | BLOQUEADO | No se reutilizan resultados de mocks |
| G-P09 | Cancelar Google | Selector OAuth activo | Cerrar/cancelar selector | Retorno seguro, sin perfil parcial | Selector no se abre | BLOQUEADO | G-P01 |
| G-P10 | Fallo de conexión / Firestore / reintento | Flujo integrado; simulación segura del cliente o staging | Interrumpir solo cliente, restaurar y consultar antes de repetir | Mensaje recuperable, sin duplicados | No hay petición real de registro que interrumpir | BLOQUEADO | No se indujo fallo productivo |
| G-P11 | Teclado Google | Página pública | 7 Tab, 4 Shift+Tab, Enter | Orden lógico, foco visible, activación | Google recibe foco, Enter muestra status; clic confirma misma respuesta | PASA para interacción; OAuth FALLA | navegador tabs/googleFocus/afterEnter |
| G-P12 | Contraste y nombre accesible | Página renderizada | AX y estilos, cálculo sRGB | Botón con nombre descriptivo; texto ≥4.5:1 | Nombre «G Registrarse con Google»; 9.361:1 normal y 8.670:1 hover | PASA muestra | contraste.json; googleAX |
| G-P13 | Responsive y referencia visual | Diseño publicado accesible | Comparar 1440×900 y 390×844; medir ancho 320 | Controles utilizables, diferencias documentadas | Botón visible al desplazar; sin desborde horizontal 320; posición/tamaño diferentes | PASA comprobación parcial; aprobación visual pendiente | Cuatro PNG y navegador designDesktop/designMobile |
| G-P14 | Lector, zoom y errores posteriores | Herramientas de asistencia y flujo completo | Lector real, zoom/espaciado, error de username duplicado | Mensajes y controles accesibles | Sin lector ejecutado; flujo posterior ausente | BLOQUEADO lector/flujo; zoom NO EJECUTADO | Informe A11/A12 |

Para el retest no modificar cuentas existentes ni publicar tokens/HAR crudo. Registrar fecha, versión desplegada, alias de cuenta, esperado/obtenido, HTTP real o «sin respuesta HTTP», código Firebase sanitizado y evidencia. Solicitar autorización específica para una cuenta Google cuando exista OAuth; la contraseña Firebase de US-01 no autoriza acceso al buzón o a Google. Mantener resultados fallidos y añadir retest, no sobrescribirlos.
