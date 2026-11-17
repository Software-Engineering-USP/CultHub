# CultHub

O CultHub é uma aplicação web que reúne e apresenta eventos culturais – como sessões de cinema, shows, oficinas e exposições – que irão acontecer em uma certa localização.

A aplicação permite que o usuário descubra eventos de acordo com critérios como localização, distância a partir de onde ele se encontra e período de interesse (um dia específico, a semana ou o mês). A partir dessas informações, a plataforma também poderá sugerir rotas até os eventos e apresentar a previsão do tempo para o dia escolhido, ajudando o usuário a planejar melhor seus momentos de lazer.


## Rodando com Docker

```bash
docker compose up --build
```

O backend fica em http://localhost:8000 e o frontend em http://localhost:5173. As portas só aceitam conexões desta máquina, porque o backend roda com `DEBUG` ligado. Para abrir o app em outro dispositivo, remova o `127.0.0.1:` das portas no `docker-compose.yml`, de preferência só em uma rede confiável.

### Problemas comuns

| Quando | O que acontece | O que fazer |
|---|---|---|
| O `package-lock.json` mudou | `GET /` responde 200, mas a aplicação quebra com `Failed to resolve import` | `docker compose down -v` e depois `docker compose up --build` |
| O `node_modules` foi criado como root | Frontend falha com `EACCES` | `docker compose down -v` e depois `docker compose up --build` |
| Banco local do Compose falha por permissão | Backend falha ao abrir o SQLite | O Compose guarda o banco no volume Docker `backend_data`, separado da pasta do código. Se esse volume estiver com permissões antigas, faça backup antes de removê-lo; isso apaga apenas o banco do Compose. |
| `admin.0001_initial` foi aplicada antes de `usuarios.0001_initial` | Django informa `InconsistentMigrationHistory` ao iniciar o backend | Se não precisa dos dados do banco local, rode `docker compose down -v` e depois `docker compose up --build` para recriar os volumes. Isso também recria o volume do frontend. |

O projeto usa `usuarios.Usuario` como modelo de usuário. Um banco criado antes dessa configuração pode ter o histórico de migrações do usuário padrão do Django, que não pode ser reaproveitado automaticamente pelo modelo atual. O banco do Compose fica no volume `backend_data`; não o apague se precisar preservar os dados. O arquivo antigo `backend/db.sqlite3`, se existir, é mantido fora do Compose.

O `node_modules` fica em um volume anônimo, que sobrevive ao `--build`. O banco do Compose fica no volume nomeado `backend_data`; ambos sobrevivem ao `--build` e ao `docker compose down` sem `-v`. `docker compose down -v` apaga esses volumes. O `db.sqlite3` usado fora do Compose continua na pasta `backend`.

Se o `up --build` já tiver rodado depois da mudança, o volume antigo pode ficar no disco, sem uso. Isso não afeta o app. O `docker volume prune` libera esse espaço, mas apaga os volumes anônimos sem uso de todos os projetos da máquina.

### Ao mudar dependências ou arquivos

- **`requirements.txt`:** a imagem e o CI instalam pelo `backend/requirements.lock`, então regenere o lock. Na raiz do repositório:

  ```bash
  docker run --rm -v ./backend:/work -w /work python:3.12.16-slim-trixie sh -c "pip install pip-tools && pip-compile --generate-hashes --allow-unsafe --strip-extras --output-file=requirements.lock requirements.txt && chown 1000:1000 requirements.lock"
  ```

  Em host com UID diferente de 1000, ajuste o `chown`.
- **Versão do Python ou do Node:** atualize o `mise.toml` e o `FROM` do Dockerfile correspondente, além da imagem no comando acima.
- **App Django novo ou arquivo novo necessário em runtime:** adicione um `COPY` no Dockerfile. No Compose, o bind mount esconde essa falta; o job `imagens` do CI é que a detecta.

### Rodando a imagem sem o Compose

A imagem do backend não roda as migrações sozinha, e a do frontend precisa saber onde está a API:

```bash
docker build -t culthub-backend backend
docker run --rm -p 127.0.0.1:8000:8000 culthub-backend sh -c "python manage.py migrate && python manage.py runserver 0.0.0.0:8000"

docker build -t culthub-frontend frontend
docker run --rm -p 127.0.0.1:5173:5173 -e API_PROXY_TARGET=<url-do-backend> culthub-frontend
```

## Deploy

A produção roda em um serviço só: a imagem do `Dockerfile` da raiz builda o frontend e o Django serve a API e o front na mesma origem, com gunicorn e WhiteNoise. O banco é um Postgres externo. Hoje o serviço fica no Render (plano gratuito) e o banco no Neon; qualquer hospedagem que rode Docker serve.

Ao iniciar, o container aplica as migrações e sobe o gunicorn na porta de `PORT` (padrão 10000).

| Variável | Valor |
|---|---|
| `DATABASE_URL` | URL do Postgres |
| `DJANGO_SECRET_KEY` | chave aleatória longa |
| `DJANGO_ALLOWED_HOSTS` | domínio público, sem esquema |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | origem pública, com `https://` |
| `DJANGO_NUM_PROXIES` | quantos proxies a hospedagem põe na frente (para o limite de pedidos por IP); o log de acesso mostra o `X-Forwarded-For` de cada pedido |
| `FRONTEND_URL` | origem pública; é a base do link do e-mail de recuperação de senha |
| `TICKETMASTER_API_KEY` | chave da Ticketmaster |
| `EMAIL_BACKEND`, `BREVO_API_KEY`, `DEFAULT_FROM_EMAIL` | envio de e-mail por API HTTP (`anymail.backends.brevo.EmailBackend`); sem isso, em produção o e-mail de recuperação de senha não é enviado nem registrado |

A imagem já define `DJANGO_DEBUG=0`. O plano gratuito do Render não tem disco persistente, tarefa agendada nem SMTP: por isso o banco é externo, a importação da Ticketmaster roda pelo workflow `Importar eventos` (segredos `DATABASE_URL` e `TICKETMASTER_API_KEY` no environment `producao` do repositório, restrito à `main`) e o e-mail sai por API.

Para testar a imagem localmente:

```bash
docker build -t culthub-producao .
docker run --rm -p 127.0.0.1:10000:10000 -e DATABASE_URL=<url-do-postgres> -e DJANGO_SECRET_KEY=<chave> -e DJANGO_ALLOWED_HOSTS=localhost culthub-producao
```
