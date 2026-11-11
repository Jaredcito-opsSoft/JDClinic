-- JDClinic | Evidencia de consultas PostgreSQL para Taller III
-- Todas las sentencias son de solo lectura. Ejecutar con pacientes ficticios.
-- Los nombres de tablas y columnas corresponden a backend/prisma/schema.prisma.
-- Los campos clínicos cifrados no se consultan ni descifran aquí.

-- 01. SELECCIÓN (sigma): filtrar filas de pacientes activos con tipo sanguíneo conocido.
SELECT expediente_folio, first_name, last_name, blood_type
FROM patients
WHERE is_active = true
  AND deleted_at IS NULL
  AND blood_type <> 'DESCONOCIDO'
ORDER BY last_name, first_name
LIMIT 20;

-- 02. PROYECCIÓN (pi): elegir únicamente nombre, apellido y rol del personal.
SELECT first_name, last_name, role
FROM users
ORDER BY role, last_name, first_name;

-- 03. UNIÓN: combinar dos conjuntos con las mismas tres columnas.
-- UNION elimina filas idénticas; UNION ALL conservaría los duplicados.
SELECT 'PACIENTE' AS tipo, first_name AS nombre, last_name AS apellido
FROM patients
WHERE is_active = true AND deleted_at IS NULL
UNION
SELECT 'PERSONAL' AS tipo, first_name AS nombre, last_name AS apellido
FROM users
WHERE is_active = true
ORDER BY tipo, apellido, nombre;

-- 04. FUNCIONES DE AGREGACIÓN: contar citas y hallar fechas mínima y máxima por estado.
SELECT status, COUNT(*) AS total_citas,
       MIN(scheduled_at) AS primera_cita,
       MAX(scheduled_at) AS ultima_cita
FROM appointments
GROUP BY status
ORDER BY total_citas DESC, status;

-- 05. SUBCONSULTAS: EXISTS filtra médicos con citas y la subconsulta
-- correlacionada del SELECT cuenta sus citas no canceladas.
SELECT u.first_name, u.last_name,
       (SELECT COUNT(*)
        FROM appointments a
        WHERE a.doctor_id = u.id
          AND a.status NOT IN ('CANCELADA', 'NO_ASISTIO')) AS citas_vigentes
FROM users u
WHERE u.is_active = true
  AND u.role IN ('MEDICO_GENERAL', 'MEDICO_ESPECIALISTA')
  AND EXISTS (SELECT 1 FROM appointments a WHERE a.doctor_id = u.id)
ORDER BY citas_vigentes DESC, u.last_name;

-- 06. FUNCIONES NUMÉRICAS: POWER, ROUND y ABS sobre signos vitales.
-- NULLIF evita dividir entre cero; se muestra el IMC registrado y el calculado.
SELECT p.expediente_folio, v.weight_kg, v.height_cm,
       v.bmi AS imc_registrado,
       ROUND(v.weight_kg / POWER(NULLIF(v.height_cm, 0) / 100, 2), 2) AS imc_calculado,
       ABS(v.bmi - ROUND(v.weight_kg / POWER(NULLIF(v.height_cm, 0) / 100, 2), 2)) AS diferencia_imc
FROM vital_signs v
JOIN patients p ON p.id = v.patient_id
WHERE p.is_active = true AND p.deleted_at IS NULL
ORDER BY v.created_at DESC
LIMIT 20;

-- 07. FUNCIONES DE CARACTERES: CONCAT_WS, UPPER, TRIM y LENGTH.
SELECT expediente_folio,
       CONCAT_WS(' ', TRIM(first_name), TRIM(last_name)) AS nombre_completo,
       UPPER(last_name) AS apellido_mayusculas,
       LENGTH(TRIM(first_name)) AS letras_nombre
FROM patients
WHERE is_active = true AND deleted_at IS NULL
ORDER BY last_name, first_name
LIMIT 20;

-- 08. PRECEDENCIA LÓGICA: los paréntesis agrupan OR antes de AND.
-- Sin ellos, AND se aplicaría primero y entrarían citas PROGRAMADA pasadas.
SELECT p.expediente_folio, a.scheduled_at, a.status
FROM appointments a
JOIN patients p ON p.id = a.patient_id
WHERE (a.status = 'PROGRAMADA' OR a.status = 'CONFIRMADA')
  AND a.scheduled_at >= CURRENT_TIMESTAMP
  AND p.is_active = true AND p.deleted_at IS NULL
ORDER BY a.scheduled_at
LIMIT 20;

-- 08b. PRECEDENCIA ARITMÉTICA: multiplicación antes que suma.
SELECT 2 + 3 * 4 AS sin_parentesis,
       (2 + 3) * 4 AS con_parentesis;
