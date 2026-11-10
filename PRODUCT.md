# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Personal médico y administrativo de clínicas pequeñas y medianas en México:
- **Médicos generales y especialistas:** Documentan consultas clínicas (formato SOAP), prescriben medicamentos, consultan signos vitales y antecedentes patológicos.
- **Enfermería:** Captura y actualiza signos vitales, somatometría y notas de evolución.
- **Recepción:** Da de alta pacientes, consulta el directorio de expedientes y agenda citas sin requerir códigos internos.
- **Administración:** Gestión de usuarios/personal clínico, asignación de roles normativos, canales de notificación (Telegram) y auditoría de eventos.

## Product Purpose
JDClinic es un sistema de Expediente Clínico Electrónico (ECE) que garantiza la continuidad de la atención médica con rigor clínico, facilidad de uso en turnos de alta demanda y estricto apego normativo a la NOM-004-SSA3-2012 y NOM-024-SSA3-2012, asegurando inmutabilidad mediante sellado criptográfico (SHA-256 / AES-256-GCM).

## Positioning
Diseñado para la jornada real de consulta ambulatoria: cero fricción en captura, cinta persistente del paciente que evita la pérdida de contexto en cualquier pantalla, y respeto al tiempo clínico mediante flujos directos y legibilidad editorial impecable.

## Operating Context
Consultorios médicos, estaciones de recepción y enfermería en pantallas de escritorio, tablets y portátiles. Iluminación clínica variable donde el contraste y la ausencia de distracciones visuales protegen la precisión de los datos.

## Capabilities and Constraints
- **Foliado clínico automático:** Asignación única e inmutable de expediente (p. ej. `EXP-2026-0001`).
- **Notas médicas SOAP selladas:** Subjetivo, Objetivo, Análisis, Plan, diagnóstico CIE-10 y prescripción farmacológica.
- **Seguridad y Cifrado:** Datos clínicos en reposo cifrados con AES-256-GCM y firmas digitales de consultas inmutables.
- **Normativa mexicana:** NOM-004-SSA3-2012 (expediente clínico) y NOM-024-SSA3-2012 (sistemas de información de registro electrónico para la salud).
- **Telegram bot:** Envío de recordatorios a pacientes y notificaciones a médicos.

## Brand Commitments
- Nombre: **JDClinic**
- Isotipo: Símbolo heráldico-clínico con cruz médica y hoja botánica.
- Voz: Rigurosa, sobria, humana y profesional. Sin jerga técnica vacía ni adornos innecesarios.

## Evidence on Hand
- Base de datos relacional y servidor Express en `backend`.
- Frontend SPA en React + Vite + Tailwind CSS en `frontend`.
- Sistema de diseño clínico documentado en `.interface-design/system.md`.

## Product Principles
1. **El contexto del paciente nunca se pierde:** La cinta de datos vitales y alergias acompaña la atención.
2. **Claridad sobre adorno:** Tipografía editorial legible, datos monocromáticos donde importa la precisión y colores semánticos estrictos.
3. **Inmutabilidad y confianza:** Cada registro clínico tiene trazabilidad jurídica y técnica garantizada.
4. **Ergonomía de alta velocidad:** Formularios accesibles por teclado, tiempos de respuesta instantáneos y acciones claras.
