# Estudios clínicos en S3

JDClinic crea una carga prefirmada de 15 minutos para PDF, JPG y PNG de hasta 10 MB. Sólo registra el estudio como disponible después de comprobar tamaño, tipo, encabezado de archivo y cifrado en S3. La lectura genera un enlace temporal nuevo de 15 minutos y registra la acción en auditoría.

## Preparar AWS

1. Crea un bucket privado con **Block Public Access** activo y cifrado predeterminado. Evita una política pública de lectura.
2. Da al backend permisos `s3:PutObject`, `s3:GetObject` y `s3:HeadObject` sobre `arn:aws:s3:::NOMBRE_DEL_BUCKET/patients/*`. En EC2 usa un rol IAM. En desarrollo local usa un perfil AWS o variables de entorno; no pongas claves en el frontend.
3. En `backend/.env`, configura `AWS_REGION` y `AWS_S3_BUCKET_NAME`. Si usas KMS, configura `AWS_S3_KMS_KEY_ID` y concede al rol `kms:GenerateDataKey` y `kms:Decrypt` para esa clave. Sin esa variable se solicita SSE-S3 (`AES256`).
4. Configura CORS del bucket para el origen exacto del frontend. Ejemplo local:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["POST"],
    "AllowedOrigins": ["http://localhost:5175", "http://127.0.0.1:5175"],
    "ExposeHeaders": [],
    "MaxAgeSeconds": 300
  }
]
```

5. En producción, sustituye ambos orígenes locales por el dominio HTTPS real y define `FRONTEND_URL` con ese mismo origen. Prueba cargar un PDF pequeño desde **Historial de notas → Estudios y documentos** y abrirlo desde la lista.

El bucket y las credenciales de AWS no están incluidos en el proyecto. Un archivo que S3 rechace o cuya verificación falle nunca aparece como estudio disponible. Las cargas pendientes quedan en la base de datos para diagnóstico; conviene limpiar periódicamente los objetos huérfanos en el bucket según la política operativa de la clínica.
