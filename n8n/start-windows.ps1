$ErrorActionPreference = 'Stop'

$env:N8N_USER_FOLDER = Join-Path $env:LOCALAPPDATA 'JDClinic'
$env:N8N_HOST = 'localhost'
$env:N8N_PORT = '5679'
$env:N8N_LISTEN_ADDRESS = '127.0.0.1'
$env:N8N_RUNNERS_BROKER_PORT = '5681'
$env:N8N_RUNNERS_TASK_BROKER_URI = 'http://127.0.0.1:5681'
$env:N8N_PROTOCOL = 'http'
$env:N8N_EDITOR_BASE_URL = 'http://localhost:5679'
$env:N8N_WEBHOOK_URL = 'http://localhost:5679/'
$env:GENERIC_TIMEZONE = 'America/Mexico_City'
$env:TZ = 'America/Mexico_City'

n8n start
