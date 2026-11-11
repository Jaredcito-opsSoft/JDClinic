# Avisos de agenda de JDClinic

Al registrar una cita, JDClinic prepara dos confirmaciones independientes: **correo** si el paciente tiene dirección registrada y **Telegram** si vinculó su chat y dio consentimiento. Al cambiar una cita, esas entregas pasan a ser avisos de **actualización**; al cancelarla, pasan a ser avisos de **cancelación**. También conserva el recordatorio por Telegram 24 horas antes y el aviso al médico al entrar en sala de espera. Los mensajes sólo incluyen la fecha y hora; no incluyen nombres, diagnósticos ni datos del expediente.

## Estado local

El flujo **JDClinic · avisos de agenda** está publicado en el contenedor Docker `jdclinic-n8n`: [localhost:5679](http://localhost:5679). El puerto 5678 pertenece a otro proyecto y no debe usarse para las citas de JDClinic. El webhook y su credencial Header Auth están vinculados al backend. La agenda actualiza automáticamente los estados de los avisos en curso.

Para encenderlo de nuevo desde la raíz del proyecto:

```powershell
docker compose -f n8n/compose.yaml up -d
```

También existe una instancia aislada en `%LOCALAPPDATA%\JDClinic\.n8n`, que se puede arrancar con `& .\n8n\start-windows.ps1` desde la raíz del proyecto cuando Docker no esté disponible. Usa el mismo puerto `5679`, pero mantiene una base de datos distinta. Ejecuta **una sola** instancia a la vez y comprueba cuál atiende el puerto antes de diagnosticar ejecuciones o credenciales.

El volumen externo `jdclinic_n8n_data` conserva el flujo, las cuentas de n8n y las credenciales cifradas. Ya está creado en este equipo. En un equipo nuevo, crea primero el volumen con `docker volume create jdclinic_n8n_data`, importa `n8n/telegram-ece.workflow.json` y configura las tres credenciales: Header Auth, Telegram API y SMTP. El JSON es una plantilla y no contiene los secretos.

1. El bot clínico [@JDClinicAvisosBot](https://t.me/JDClinicAvisosBot) y su credencial **Telegram API** ya están vinculados a **Enviar Telegram** en el n8n de Docker. Cada destinatario abre el bot y envía `/start`; vincula los chats de pacientes en **Pacientes → Telegram** y los de médicos en **Personal y permisos**. Si importas el flujo en otro n8n, vuelve a asignar la credencial de ese entorno.
2. El nodo **Enviar correo** usa una credencial SMTP configurada dentro de n8n. El archivo público del flujo tiene `avisos@ejemplo.com` como marcador: cambia el remitente y asigna una credencial antes de publicarlo. El 11 de noviembre de 2026 el servidor SMTP aceptó el correo de prueba y el destinatario confirmó que recibió las notificaciones en su bandeja. Si usas Gmail, configura allí una [contraseña de aplicación](https://support.google.com/accounts/answer/185833); no pongas la contraseña principal de Google en n8n.
3. El 11 de noviembre de 2026 se creó una cita temporal mediante la API de JDClinic, con un paciente ficticio, un chat de prueba y el correo configurado. La cola registró **Confirmación correo · enviado**, **Confirmación Telegram · enviado** y, tras pulsar el reintento manual por API, **Recordatorio Telegram · enviado**. n8n confirmó cada entrega con `ok:true` y el identificador correspondiente. Después se eliminaron la cita y el paciente de prueba. Un destinatario ausente aparecerá como **omitido**.

En JDClinic, el médico consulta sus propias citas en **Agenda clínica**. Telegram se usa para avisos breves, no para consultar expedientes ni listar citas con un comando. Para avisar a un paciente existente, registra su correo en **Pacientes → Contacto** o su chat y consentimiento en **Pacientes → Telegram**. Luego usa **Enviar ahora** en la agenda para un aviso omitido; la cola intenta procesarlo de inmediato y muestra el resultado en la cita. Si la cita se creó o reprogramó con menos de 24 horas de anticipación, no habrá recordatorio automático de 24 horas, pero puedes enviarlo manualmente antes de que empiece la cita.

Si se usa otra instalación de n8n, importa el JSON del flujo y crea también una credencial **Header Auth**: cabecera `X-ECE-Secret`, valor `N8N_WEBHOOK_SECRET` de `n8n/.env`. Asígnala a **Webhook ECE**.

`n8n/.env` es local y está excluido del control de versiones. El backend usa `http://localhost:5679/webhook/ece-telegram` en desarrollo. JDClinic conserva una cola con hasta cinco intentos y muestra los fallos en la agenda; el estado **enviado** sólo aparece cuando n8n confirma el envío. Si se pierde la respuesta después de enviar, podría llegar un duplicado.

El backend envía un `deliveryId` UUID por cada intento. **Validar aviso** exige ese identificador, un evento permitido, un destinatario válido y un texto breve que empiece por `JDClinic ·`. El correo usa un asunto distinto para alta, cambio y cancelación. Después de **Enviar correo** o **Enviar Telegram**, **Confirmar envío** responde `{ "ok": true, "deliveryId": "..." }`. JDClinic sólo marca el aviso como enviado si coincide con el identificador solicitado. Los errores de validación o de envío quedan para reintento en la cola.

Las credenciales de Telegram y SMTP pertenecen a n8n; no las guardes en el frontend.
