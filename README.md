# JDClinic — Expediente Clínico Electrónico para Clínicas Pequeñas y Policonsultorios
**Diseñado tomando como referencia NOM-004-SSA3-2012 y NOM-024-SSA3-2012. Requiere validación formal antes de usarse en atención real.**

---

## 🏛️ Arquitectura del Sistema

### Backend: Arquitectura Hexagonal (Ports & Adapters)
- **Domain Layer (`src/core/domain`)**: Entidades clínicas puras (`ConsultationSoap`, `Patient`, etc.), Value Objects (`EncryptedClinicalData`) y contratos de puertos secundarios (`IEncryptionService`, `IConsultationRepository`, `IAuditLogRepository`).
- **Application Layer (`src/core/application`)**: Casos de uso de negocio (`CreateSoapConsultationUseCase`, `SignSoapConsultationUseCase`), garantizando la regla de inmutabilidad y cálculo de firmas electrónicas.
- **Infrastructure Layer (`src/infrastructure`)**: 
  - *Driven Adapters*: Cifrado AES-256-GCM nativo con `node:crypto`, persistencia en PostgreSQL con Prisma ORM, generación de hash encadenado SHA-256 para auditoría.
  - *Driving Adapters*: Controladores HTTP Express, validadores Zod, middlewares de RBAC y autenticación.

### Frontend: Arquitectura Modular (Feature-Driven)
- Módulos independientes por dominio clínico (`modules/patients`, `modules/consultations`, `modules/vitals`, `modules/prescriptions`, `modules/auth`, `modules/audit`).
- Estilizado con Tailwind CSS. La identidad visual vigente está documentada en [`DESIGN.md`](DESIGN.md).
- Split-View ergonómico para redacción en formato SOAP con banner persistente de paciente y alertas críticas de alergias en tiempo real.

---

## 🔐 Seguridad y Cifrado FLE (Field-Level Encryption)
Los datos clínicos sensibles se cifran antes de persistirse en base de datos:
- Algoritmo: `AES-256-GCM` (NIST SP 800-38D).
- Cada registro almacena: `ciphertext` (Base64), `iv` (12 bytes Hex) y `tag` (16 bytes Hex).
- Verificación criptográfica automática en cada consulta para detectar alteraciones no autorizadas.

---

## 🚀 Puesta en Marcha

### Preparar datos locales de desarrollo

```bash
npm --prefix backend run db:generate
npm --prefix backend run db:sync
npm --prefix backend run seed:dev
```

El seed local crea un médico y un paciente de prueba:

- Usuario: `medico@clinica.local`
- Administrador: `admin@clinica.local`
- Contraseña local inicial: `Clinica2026!`

Para cambiar esos valores usa `DEV_SEED_EMAIL` y `DEV_SEED_PASSWORD` antes de ejecutar el seed. No utilices las credenciales de desarrollo en producción.
En la instalación local, `DEV_SEED_EMAIL` en `backend/.env` y `VITE_DEMO_DOCTOR_EMAIL` en `frontend/.env.local` pueden apuntar el acceso rápido a la misma cuenta médica de demostración. El personal inicia sesión en JDClinic; n8n usa una cuenta administrativa separada para automatizar avisos.

### 1. Pruebas Criptográficas del Backend
```bash
cd backend
npm test
```

### 2. Ejecutar Servidor Backend
```bash
cd backend
npm run dev
```

### 3. Ejecutar Aplicación Frontend
```bash
cd frontend
npm run dev
```

## Flujo clínico implementado

1. Autenticación JWT con identidad y rol del personal.
2. Inicio operativo con jornada del día, sala de espera, notas firmadas y accesos directos.
3. Búsqueda y alta de pacientes por nombre, folio o CURP.
4. Agenda diaria con alta y reprogramación de citas; evita solapamientos del paciente o médico por intervalos, incluso ante reservas simultáneas. Los estados avanzan hacia la atención o el cierre; una cita cancelada, completada o marcada como no asistida conserva su historial y deja de mostrar acciones de reprogramación. Los avisos aún pendientes se omiten al finalizarla.
5. Cinta clínica persistente con riesgos y últimos signos vitales.
6. Captura de signos vitales con validación y persistencia en PostgreSQL.
7. Creación cifrada de nota SOAP y firma exclusiva del médico autor.
8. Historial cronológico descifrado únicamente para roles clínicos autorizados.
9. Adendas firmadas que conservan la trazabilidad de la nota original.
10. Receta digital ligada a una nota firmada, con medicamentos, vigencia y QR de verificación mínima.
11. Auditoría visible para administración y navegación adaptada al rol.
12. Verificación pública del QR sin exponer paciente, diagnóstico, medicamentos ni indicaciones.
13. Desactivación lógica de usuarios con revocación efectiva en la siguiente solicitud autenticada.
14. Cadena de auditoría serializada mediante bloqueo transaccional de PostgreSQL.
15. Antecedentes heredofamiliares, patológicos, no patológicos, gineco-obstétricos y alergias editables con cifrado por campo.
16. Administración de personal con roles, cédula obligatoria para médicos y desactivación lógica.
17. Cierre de sesión e intentos de acceso por rol registrados en auditoría.

La revisión vigente de reglas de negocio está en [`output/pdf/Reglas_de_Negocio_ECE_Taller_III_actualizadas.pdf`](output/pdf/Reglas_de_Negocio_ECE_Taller_III_actualizadas.pdf).

La cola de avisos n8n/Telegram está implementada. La instancia local de JDClinic responde en `http://localhost:5679`; consulta [n8n/README.md](n8n/README.md) para encenderla y configurar el flujo. El token del bot se guarda en n8n. El envío por correo requiere que la conexión SMTP del entorno esté disponible.

La agenda y el panel usan la fecha de la clínica (`America/Mexico_City` por defecto), aunque el servidor esté en UTC. Si la clínica cambia de zona, configura el mismo identificador IANA en `CLINIC_TIME_ZONE` del backend y `VITE_CLINIC_TIME_ZONE` del frontend antes de compilarlo.

Las recetas nuevas se exportan como PDF con folio único, sello de integridad y QR. Los estudios clínicos usan carga y lectura temporales de S3; configura bucket, permisos y CORS según [s3/README.md](s3/README.md). Estas integraciones requieren credenciales reales para probarse contra Telegram y AWS.

Para el laboratorio escolar, [aws/README.md](aws/README.md) documenta el despliegue mediante GitHub en **tres EC2**: React/Nginx, API Node/n8n y PostgreSQL. Esta variante no usa RDS y deja el módulo S3 deshabilitado hasta configurar un bucket; consulta la diferencia con el documento maestro antes de presentarla como cumplimiento completo.
