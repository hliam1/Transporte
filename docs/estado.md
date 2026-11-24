# Estado del proyecto

Registro vivo de avance. Se actualiza al cerrar cada fase.

**Última actualización:** 24 de noviembre de 2026 — cierre de la Fase 3.

## Fases

| Fase | Estado |
|---|---|
| 1. Arquitectura | ✅ Terminada (`docs/arquitectura.md`) |
| 2. Diseño (identidad visual, pantallas) | ⏳ Pendiente — falta decidir Kotlin o Flutter para la app del conductor y el nombre de la app |
| 3. Backend y autenticación | ✅ Terminada |
| 4. Salas | ⏳ Siguiente |
| 5. Confirmaciones | ⏳ Pendiente |
| 6. Mapas y optimización | ⏳ Pendiente |
| 7. GPS | ⏳ Pendiente |
| 8. Notificaciones | ⏳ Pendiente |
| 9. Asistencia e historial | ⏳ Pendiente |
| 10. Pruebas y despliegue | ⏳ Pendiente |

## Funcionalidades terminadas (Fase 3)

**Base de datos (PostgreSQL 16 + PostGIS)**
- Esquema completo de las 28 tablas del diseño: usuarios, perfiles, conductores, viajeros, sesiones, salas, códigos, solicitudes, miembros, horarios, direcciones, confirmaciones (con auditoría y excepciones), vehículos, recorridos, pasajeros, rutas, paradas, asistencia (con auditoría), GPS en vivo, notificaciones e historial.
- Reglas garantizadas por la base de datos: confirmaciones sin duplicados; un solo código activo por sala; una sola solicitud pendiente por viajero y sala; formatos de hora; coordenadas válidas; correos en minúsculas.
- Columnas geográficas que se llenan solas desde latitud/longitud (triggers) e índices espaciales.
- GPS en vivo en tabla particionada por día, con función de retención de 30 días.

**Autenticación y cuenta (API `/v1`)**
- `POST /auth/register` — registro como viajero o conductor.
- `POST /auth/login` — inicio de sesión (mismo mensaje si el correo no existe: no revela cuentas).
- `POST /auth/refresh` — renovación de sesión con tokens de un solo uso; si se reutiliza uno viejo (posible robo) se cierra toda la sesión.
- `POST /auth/logout` y `POST /auth/logout-all` — efecto inmediato, también sobre los tokens de acceso.
- `POST /auth/forgot-password` y `POST /auth/reset-password` — enlace por correo de 30 minutos, de un solo uso; solo vale el más reciente; cierra todas las sesiones.
- `GET /me`, `PATCH /me` — ver y editar perfil (nombre, teléfono, zona horaria).
- `POST /me/password` — cambio de contraseña; cierra las otras sesiones.
- `GET /health` — estado del servicio y la base de datos.
- Roles (`@Roles('DRIVER')`) aplicados en el servidor; todas las rutas exigen sesión salvo las marcadas como públicas.
- Contraseñas con Argon2id; límite de 10 intentos por minuto en inicio de sesión y registro; rechazo de campos no permitidos (no se puede inyectar rol ni estado); mensajes de error en español.

## Pruebas realizadas

| Tipo | Cantidad | Resultado |
|---|---|---|
| Unitarias | 18 | ✅ Todas pasan |
| Integración (API + PostgreSQL real) | 35 | ✅ Todas pasan |
| Prueba de mutación (romper a propósito la detección de tokens robados) | 1 | ✅ Las pruebas detectaron el error |

Se ejecutan con `pnpm --filter @transporte/api test` y `test:e2e`, y automáticamente en GitHub Actions en cada cambio.

## Pendientes y decisiones

- **Foto de perfil:** requiere almacenamiento de archivos (Cloud Storage). Se hará junto con la foto de vehículos.
- **Verificación de correo:** la columna existe; el flujo se activa cuando se configure el proveedor de correo.
- **Límite de intentos con varias instancias:** hoy se guarda en memoria; pasará a Redis en la Fase 7.
- **Renovación simultánea de sesión:** si la app envía dos renovaciones a la vez con el mismo token, la segunda cierra la sesión (comportamiento estricto de seguridad). La app Android y la PWA deben renovar de a una.

## Cambios respecto a la arquitectura

- **Prisma → Drizzle ORM.** Prisma requiere descargar binarios nativos; Drizzle es TypeScript puro, más liviano en producción y da control total del SQL (PostGIS, triggers, particiones).

## Integraciones pendientes

| Servicio | Cuándo |
|---|---|
| Proveedor de correo (Resend) | Antes del piloto — hoy los correos se imprimen en consola |
| Google Cloud + Maps Platform | Fase 6 |
| Firebase Cloud Messaging y claves VAPID | Fase 8 |
| Hosting (Cloud Run, Postgres administrado, Vercel) | Fase 10 |

## Errores conocidos

Ninguno abierto.
