# Consultas de evaluación · JDClinic

El archivo [evaluacion_consultas.sql](evaluacion_consultas.sql) reúne ejemplos de **selección, proyección, unión, funciones de agregación, subconsultas, funciones numéricas, funciones de caracteres y reglas de precedencia** sobre el esquema real de PostgreSQL. La última sección incluye precedencia lógica y aritmética. Todas las sentencias son SELECT; no crean ni cambian registros.

## Ejecutar en la EC2 de PostgreSQL

La EC2 jdclinic-db necesita tener el archivo SQL. Después de actualizar el repositorio público, descárgalo y ejecútalo con psql:

    curl -fsSL https://raw.githubusercontent.com/Jaredcito-opsSoft/JDClinic/main/sql/evaluacion_consultas.sql -o /tmp/jdclinic-evaluacion.sql
    sudo -u postgres psql -X -v ON_ERROR_STOP=1 -d jdclinic -f /tmp/jdclinic-evaluacion.sql

También puedes abrir el archivo en pgAdmin o DBeaver conectado a jdclinic y ejecutar cada bloque por separado. Usa **datos ficticios** para la exposición. Si una tabla todavía está vacía, la consulta es válida y devolverá cero filas; crea los datos de demostración desde JDClinic para mostrar resultados. No ejecutes el seed de desarrollo en AWS.

| Bloque | Concepto demostrado | Tablas |
|---|---|---|
| 01 | Selección con WHERE | patients |
| 02 | Proyección de columnas | users |
| 03 | Unión de resultados compatibles | patients, users |
| 04 | COUNT, MIN, MAX, GROUP BY | appointments |
| 05 | Subconsulta correlacionada y EXISTS | users, appointments |
| 06 | POWER, ROUND, ABS, NULLIF | vital_signs, patients |
| 07 | CONCAT_WS, UPPER, TRIM, LENGTH | patients |
| 08 | Precedencia de AND/OR y de operaciones aritméticas | appointments, patients |

Los antecedentes, notas SOAP e indicaciones están cifrados por la aplicación. Estas consultas usan columnas operativas sin descifrar esos campos; no sustituyen los controles de acceso y auditoría de la interfaz clínica.
