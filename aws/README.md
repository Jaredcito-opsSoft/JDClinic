# JDClinic en AWS Academy: tres EC2

**Estado al 11 de noviembre de 2026:** tres EC2 y sus grupos de seguridad creados en el Learner Lab, región `us-east-1`. Nginx/React, API, PostgreSQL y el contenedor n8n ya responden. El flujo de avisos se importó a n8n, pero permanece inactivo hasta configurar las credenciales de Telegram, SMTP y Header Auth. Esta guía reproduce el esquema de TallerShop: clonar [JDClinic](https://github.com/Jaredcito-opsSoft/JDClinic) en una EC2 frontend y otra backend; instalar PostgreSQL en una tercera EC2. No se usa CloudFormation ni RDS.

## Topología

| Instancia Ubuntu 24.04 | Servicio | Puerto de entrada |
|---|---|---|
| `jdclinic-front` | Nginx y React compilado | 80 desde Internet |
| `jdclinic-back` | API Node, trabajador de avisos y n8n | 4000 solo desde el grupo de seguridad del frontend |
| `jdclinic-db` | PostgreSQL y volumen EBS persistente | 5432 solo desde el grupo de seguridad del backend |

Las tres instancias deben estar en la **misma VPC**. Usa las **IP privadas** para front → back y back → base de datos. La IP pública del frontend sirve para abrir la web. En la consola de EC2 crea tres grupos de seguridad con las reglas de la tabla; AWS permite referenciar otro grupo de seguridad como origen y así resuelve sus IP privadas. [Documentación de AWS](https://docs.aws.amazon.com/vpc/latest/userguide/security-group-rules.html).

> **Diferencia con el documento maestro:** este laboratorio usa PostgreSQL en EC2. El enunciado original pide RDS PostgreSQL cifrado, así que este despliegue demuestra la aplicación, pero no cumple literalmente el componente RDS. S3 sigue siendo opcional en esta guía; sin bucket, el módulo de estudios clínicos queda deshabilitado. Usa solo pacientes ficticios en el laboratorio.

Antes de empezar, anota `FRONT_PUBLIC_IP`, `BACK_PRIVATE_IP`, `DB_PRIVATE_IP` y la región del laboratorio. Elige tamaños de instancia permitidos por el laboratorio; backend necesita más memoria porque ejecuta API y n8n. Los recursos consumen el presupuesto de AWS Academy mientras permanecen encendidos. Si el laboratorio termina, las IP públicas pueden cambiar.

El README visible del **Learner Lab** indica un presupuesto de **USD 50**, acceso en `us-east-1` y `us-west-2`, hasta 9 EC2 simultáneas y tipos de instancia de nano a large. La cifra mostrada en el panel puede tardar entre 8 y 12 horas en actualizarse. En este laboratorio se eligieron `t3.small` para frontend y PostgreSQL, y `t3.medium` para backend con n8n. Los recursos consumen presupuesto mientras permanecen encendidos; detén las EC2 cuando no hagas pruebas.

## Registro de este laboratorio

| Componente | ID | IP privada | IP pública inicial | Disco raíz |
|---|---|---|---|---|
| Frontend | `i-07329b4e1b812f749` | `172.31.34.196` | `52.71.177.117` | 10 GiB gp3 |
| Backend | `i-08a1ba1ee7d0a9bf8` | `172.31.44.176` | `13.221.8.127` | 20 GiB gp3 |
| PostgreSQL | `i-01bf88c12813a7335` | `172.31.36.132` | `3.95.233.227` | 10 GiB gp3 |

La VPC es `vpc-027ba65903b78a33f` y la subred `subnet-076b780257d2022f9` (`us-east-1a`). Se usó Ubuntu 24.04, AMI `ami-08b275ac6cc5dbefb`, y el perfil `LabInstanceProfile` para Systems Manager. Los agentes SSM de las tres EC2 se verificaron `Online`. No se abrió SSH: `sg-01586986350954711` permite 80 desde Internet, `sg-0158b725d4fae1015` permite 4000 solo desde el grupo frontend y `sg-02a30e8e3c0f33360` permite 5432 solo desde el grupo backend. Las IP públicas pueden cambiar al detener/iniciar las instancias.

**Pruebas verificadas:** PostgreSQL y el instalador backend terminaron en estado `Success`; `http://52.71.177.117/` devolvió HTTP 200; `http://52.71.177.117/api/v1/health` devolvió HTTP 200 y `database.status = connected` con `currentDatabase = jdclinic`; el backend respondió localmente en `127.0.0.1:4000`; `http://127.0.0.1:5679/healthz` devolvió `{"status":"ok"}` y el contenedor `jdclinic-n8n` estaba `Up`. Se importó correctamente un flujo n8n. La primera orden frontend terminó con error porque verificó la API mientras PostgreSQL aún se instalaba; una orden posterior comprobó frontend y proxy en `Success`. La primera orden PostgreSQL falló porque Ubuntu no ofrecía `awscli` mediante APT; se corrigió el instalador para usar la distribución oficial de AWS. No se han probado todavía avisos reales en la instancia AWS. Por decisión del propietario, no se creó la cuenta administrativa inicial; la base AWS está vacía.

Los `CommandId` que dejaron evidencia del despliegue son: PostgreSQL `f694bec3-3517-4687-9275-e969722f7ef9`; backend `b2ff6a38-81d7-4e8d-b447-c0a86030df37`; prueba frontend/proxy `8c0b4165-502d-415d-a892-4d931e84142a`; prueba n8n `f39f94a7-872d-47b3-99bc-73a4c2006b25`; importación del flujo `3c2bf532-4576-4068-9935-4d7c3ea8348e`.

Los instaladores repetibles están en `aws/setup-db.sh`, `aws/setup-backend.sh` y `aws/setup-front.sh`. Desde AWS CloudShell, el comando para cada máquina usa SSM y devuelve un `CommandId` para consultar su resultado:

```bash
aws ssm send-command --region us-east-1 --instance-ids i-01bf88c12813a7335 --document-name AWS-RunShellScript --parameters '{"commands":["curl -fsSL https://raw.githubusercontent.com/Jaredcito-opsSoft/JDClinic/ab552e0/aws/setup-db.sh -o /tmp/jdclinic-setup-db.sh && bash /tmp/jdclinic-setup-db.sh 172.31.36.132 172.31.44.176 us-east-1"]}' --query Command.CommandId --output text
aws ssm send-command --region us-east-1 --instance-ids i-08a1ba1ee7d0a9bf8 --document-name AWS-RunShellScript --parameters '{"commands":["git clone https://github.com/Jaredcito-opsSoft/JDClinic.git /home/ubuntu/JDClinic && chown -R ubuntu:ubuntu /home/ubuntu/JDClinic && bash /home/ubuntu/JDClinic/aws/setup-backend.sh 172.31.36.132 52.71.177.117 us-east-1"]}' --query Command.CommandId --output text
aws ssm send-command --region us-east-1 --instance-ids i-07329b4e1b812f749 --document-name AWS-RunShellScript --parameters '{"commands":["git clone https://github.com/Jaredcito-opsSoft/JDClinic.git /home/ubuntu/JDClinic && chown -R ubuntu:ubuntu /home/ubuntu/JDClinic && bash /home/ubuntu/JDClinic/aws/setup-front.sh 172.31.44.176"]}' --query Command.CommandId --output text
```

```bash
aws ssm get-command-invocation --region us-east-1 --command-id COMMAND_ID --instance-id INSTANCE_ID --query '{Status:Status,Output:StandardOutputContent,Error:StandardErrorContent}'
```

Para verificar la web desde tu equipo:

```powershell
Invoke-WebRequest -Uri 'http://52.71.177.117/'
Invoke-RestMethod -Uri 'http://52.71.177.117/api/v1/health'
```

Antes del instalador de PostgreSQL, crea el parámetro `SecureString` `/jdclinic/lab/db-password` mediante CloudShell, introduciendo la contraseña directamente en la terminal y sin escribirla en el repositorio. Se lee con el perfil de las instancias. En una cuenta normal, restringe ese permiso a las dos EC2 que lo necesitan. **Si se escribe una contraseña en un chat o en la línea visible de CloudShell, no la reutilices; cámbiala desde la entrada oculta `read -rsp`.**

## 1. Crear las tres instancias

En AWS Academy abre el laboratorio y la consola de EC2. Lanza tres instancias **Ubuntu Server 24.04 LTS** en la misma VPC y asigna sus grupos de seguridad conforme a la tabla. En `us-east-1` el laboratorio ofrece la clave `vockey`; descarga su archivo **PEM** desde **AWS Details** y guárdalo fuera del repositorio. Para Ubuntu, el usuario SSH es `ubuntu`. Verifica que las tres EC2 puedan descargar paquetes de Ubuntu y clonar GitHub. No abras 4000, 5432 ni 5679 a `0.0.0.0/0`.

En este laboratorio se utilizó SSM y el puerto 22 permanece cerrado. Los comandos SSH siguientes solo funcionan si, por decisión tuya, agregas una regla 22 limitada a tu IP y descargas la clave PEM del laboratorio. No necesitas SSH para repetir las pruebas ni los instaladores.

En Windows, si habilitas SSH, conecta a cada instancia cambiando IP y clave:

```powershell
ssh -i "C:\ruta\a\tu-clave.pem" ubuntu@FRONT_PUBLIC_IP
ssh -i "C:\ruta\a\tu-clave.pem" ubuntu@BACK_PUBLIC_IP
ssh -i "C:\ruta\a\tu-clave.pem" ubuntu@DB_PUBLIC_IP
```

Las secciones siguientes indican **en qué EC2** ejecutar cada bloque. [EC2 explica cómo restringir SSH a tu IP](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/security-group-rules-reference.html).

También puedes abrir una terminal sin SSH desde la consola AWS: **EC2 → Instancias → selecciona la EC2 → Conectar → Session Manager → Conectar**. Para instalar o cambiar servicios, ejecuta `sudo -i` dentro de esa sesión. El perfil `LabInstanceProfile` permite la conexión en este laboratorio.

## 2. Base de datos: `jdclinic-db`

Ubuntu 24.04 incluye PostgreSQL 16. Crea un usuario con contraseña interactiva; no pongas la contraseña en un comando, GitHub o esta guía. [Guía de PostgreSQL de Ubuntu](https://ubuntu.com/server/docs/how-to/databases/install-postgresql/).

```bash
sudo apt update
sudo apt install -y postgresql postgresql-client
sudo -u postgres createuser --pwprompt jdclinic_app
sudo -u postgres createdb -O jdclinic_app jdclinic
PG_VERSION=$(pg_lsclusters --no-header | awk 'NR==1 {print $1}')
echo "$PG_VERSION"
```

Edita `/etc/postgresql/$PG_VERSION/main/postgresql.conf`: ajusta `listen_addresses` a la **IP privada de la EC2 de base de datos**. Luego permite solo la IP privada del backend:

```bash
sudo nano "/etc/postgresql/$PG_VERSION/main/postgresql.conf"
# En el archivo: listen_addresses = 'DB_PRIVATE_IP,localhost'
echo 'host jdclinic jdclinic_app BACK_PRIVATE_IP/32 scram-sha-256' | sudo tee -a "/etc/postgresql/$PG_VERSION/main/pg_hba.conf"
sudo systemctl restart postgresql
sudo systemctl status postgresql --no-pager
sudo ss -lntp | grep 5432
```

Sustituye `BACK_PRIVATE_IP` y `DB_PRIVATE_IP` por direcciones reales. El disco EBS de esta EC2 guarda la base; antes de terminar el laboratorio crea un respaldo si la cuenta lo permite. Apagar o reemplazar la instancia sin conservar el disco puede perder los datos.

## 3. Backend: `jdclinic-back`

Instala Node.js 22 usando el repositorio [NodeSource para Ubuntu](https://github.com/nodesource/distributions/blob/master/DEV_README.md), clona el repositorio público y compila:

```bash
sudo apt update
sudo apt install -y git curl python3
curl -fsSL https://deb.nodesource.com/setup_22.x -o nodesource_setup.sh
sudo -E bash nodesource_setup.sh
sudo apt install -y nodejs
git clone https://github.com/Jaredcito-opsSoft/JDClinic.git
cd JDClinic
npm ci
npm --prefix backend run db:generate
npm --prefix backend run build
```

Crea el archivo local de configuración con claves aleatorias. El script pide la contraseña de PostgreSQL sin mostrarla y no reemplaza claves existentes:

```bash
sudo bash aws/make-backend-env.sh DB_PRIVATE_IP http://FRONT_PUBLIC_IP us-east-1
set -a
source /etc/jdclinic/backend.env
set +a
npm --prefix backend run db:sync
```

Si tu laboratorio usa otra región, sustituye `us-east-1`. Si configuraste un bucket S3 privado y permisos en el rol de esta EC2, añade su nombre como cuarto argumento; si no, el sistema funcionará sin carga de estudios. `db:sync` aplica el esquema Prisma a una base vacía. El proyecto aún no tiene migraciones versionadas: antes de repetirlo con datos, respalda PostgreSQL y revisa los cambios de esquema.

Crea el primer administrador con una contraseña nueva, distinta de la contraseña local de demostración:

```bash
export JDCLINIC_ADMIN_EMAIL='tu-correo@ejemplo.com'
read -rsp 'Contraseña de JDClinic (mínimo 12 caracteres): ' JDCLINIC_ADMIN_PASSWORD; echo
export JDCLINIC_ADMIN_PASSWORD
npm --prefix backend run admin:create
unset JDCLINIC_ADMIN_PASSWORD
```

Para hacerlo más tarde en el laboratorio ya desplegado, abre una sesión de **Session Manager** hacia `i-08a1ba1ee7d0a9bf8` y usa `sudo -i`, `cd /home/ubuntu/JDClinic`, `set -a; source /etc/jdclinic/backend.env; set +a`, y después el bloque anterior. Escribe la contraseña solo en el prompt oculto; no la pongas en CloudShell, GitHub ni el chat. El correo elegido anteriormente fue `robertope2016@gmail.com`, pero puedes usar otro al crear la cuenta.

Instala la API como servicio para que arranque tras reiniciar la EC2:

```bash
sudo cp aws/jdclinic-backend.service /etc/systemd/system/jdclinic-backend.service
sudo systemctl daemon-reload
sudo systemctl enable --now jdclinic-backend
sudo systemctl status jdclinic-backend --no-pager
curl -fsS http://127.0.0.1:4000/api/v1/health
```

La configuración secreta queda en `/etc/jdclinic/backend.env`, fuera del repositorio y con permisos `600`. **Conserva `CLINICAL_FLE_MASTER_KEY` al actualizar o reconstruir la instancia:** esa clave es necesaria para descifrar las notas clínicas guardadas. Nunca ejecutes `seed:dev` en esta EC2.

## 4. n8n en la instancia backend

La API y n8n comparten la EC2 backend; el webhook usa `127.0.0.1:5679`, así que no necesita un cuarto servidor. Instala Docker y Compose desde los paquetes de Ubuntu 24.04. [Paquete Compose de Ubuntu](https://packages.ubuntu.com/noble/docker-compose-v2).

```bash
sudo apt install -y docker.io docker-compose-v2
sudo systemctl enable --now docker
sudo docker volume create jdclinic_n8n_data
cd ~/JDClinic
sudo docker compose -f n8n/compose.yaml up -d
sudo docker compose -f n8n/compose.yaml ps
curl -fsS http://127.0.0.1:5679/healthz
```

El flujo se importó sin credenciales y quedó inactivo mediante:

```bash
sudo docker cp ~/JDClinic/n8n/telegram-ece.workflow.json jdclinic-n8n:/tmp/jdclinic-workflow.json
sudo docker exec jdclinic-n8n n8n import:workflow --input=/tmp/jdclinic-workflow.json
```

En el laboratorio actual, 5679 y 22 permanecen cerrados al público. Para abrir el editor n8n sin cambiar el grupo de seguridad, instala AWS CLI y Session Manager Plugin en tu equipo, carga temporalmente las credenciales del Learner Lab desde **AWS Details** y ejecuta:

```powershell
aws ssm start-session --region us-east-1 --target i-08a1ba1ee7d0a9bf8 --document-name AWS-StartPortForwardingSession --parameters '{"portNumber":["5679"],"localPortNumber":["5679"]}'
```

Con esa terminal abierta, visita `http://localhost:5679`. La instalación es nueva: crea el propietario de n8n, conecta Telegram API, SMTP y Header Auth, reemplaza el remitente de ejemplo y activa el flujo antes de probar una cita ficticia. No compartas tokens ni contraseñas en GitHub.

Como alternativa al túnel SSM anterior, si habilitas SSH de forma temporal, crea un túnel SSH desde Windows dejando la terminal abierta:

```powershell
ssh -i "C:\ruta\a\tu-clave.pem" -L 5679:127.0.0.1:5679 ubuntu@BACK_PUBLIC_IP
```

Abre `http://localhost:5679` en Windows. Importa `n8n/telegram-ece.workflow.json` en el editor, configura **Header Auth** (`X-ECE-Secret` con el valor `N8N_WEBHOOK_SECRET` del backend), **Telegram API** y **SMTP**, cambia `avisos@ejemplo.com` por el correo remitente real y publica el flujo. El JSON público no contiene tokens ni contraseñas. Las credenciales del n8n local no se trasladan automáticamente a la EC2. El correo local se verificó de extremo a extremo el 11 de noviembre de 2026; repite la prueba en AWS porque la red de la EC2 es distinta.

## 5. Frontend: `jdclinic-front`

Instala Node.js 22 y Nginx. Clona el mismo repositorio y compila React:

```bash
sudo apt update
sudo apt install -y git curl nginx
curl -fsSL https://deb.nodesource.com/setup_22.x -o nodesource_setup.sh
sudo -E bash nodesource_setup.sh
sudo apt install -y nodejs
git clone https://github.com/Jaredcito-opsSoft/JDClinic.git
cd JDClinic
npm ci
npm --prefix frontend run build
sudo mkdir -p /var/www/jdclinic
sudo cp -a frontend/dist/. /var/www/jdclinic/
```

Instala la configuración Nginx del repositorio, cambiando el marcador por la **IP privada del backend**:

```bash
sed 's/__BACKEND_PRIVATE_IP__/BACK_PRIVATE_IP/g' aws/nginx-front.conf | sudo tee /etc/nginx/sites-available/default > /dev/null
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx
curl -fsS http://127.0.0.1/api/v1/health
```

Abre `http://FRONT_PUBLIC_IP/` desde Windows. El navegador llama a `/api/v1` en el mismo origen; Nginx reenvía esas solicitudes al backend por su IP privada. El inicio de sesión rápido de demostración no aparece en la compilación de producción.

## 6. Prueba del sistema completo

1. Abre `http://FRONT_PUBLIC_IP/api/v1/health`: debe indicar `database.status = connected`.
2. Entra con la cuenta administrativa creada en el paso 3. Crea un médico y un **paciente ficticio**.
3. Programa una cita futura; confirma que aparezca en la agenda del médico. Comprueba que no puedas reservar otra que se solape.
4. Vincula un chat de prueba de Telegram con consentimiento y un correo de prueba; observa `enviado`, `reintentando` u `omitido` en la cita. Un envío fallido no debe aparecer como enviado.
5. Reinicia cada servicio y comprueba que el frontend, API, PostgreSQL y n8n vuelvan a estar disponibles.

## 7. Actualizar desde GitHub

En **backend**:

```bash
cd ~/JDClinic
git pull --ff-only
npm ci
npm --prefix backend run db:generate
npm --prefix backend run build
set -a; source /etc/jdclinic/backend.env; set +a
npm --prefix backend run db:sync
sudo systemctl restart jdclinic-backend
```

En **frontend**:

```bash
cd ~/JDClinic
git pull --ff-only
npm ci
npm --prefix frontend run build
sudo cp -a frontend/dist/. /var/www/jdclinic/
sudo systemctl reload nginx
```

Si cambias el flujo de n8n, vuelve a importarlo, revisa sus credenciales y publícalo. Conserva el volumen `jdclinic_n8n_data`. Para respaldar la base de datos desde `jdclinic-db`:

```bash
sudo -u postgres pg_dump -Fc jdclinic > jdclinic.dump
```

Guarda el respaldo fuera de esa EC2 antes de destruir el laboratorio. La guía documenta una demostración escolar en HTTP con datos ficticios; para cumplir literalmente el documento maestro y usar expedientes reales harían falta RDS, HTTPS, S3 y una revisión de seguridad y cumplimiento.
