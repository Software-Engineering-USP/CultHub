# CultHub

O CultHub é uma aplicação web que reúne e apresenta eventos culturais – como sessões de cinema, shows, oficinas e exposições – que irão acontecer em uma certa localização.

A aplicação permite que o usuário descubra eventos de acordo com critérios como localização, distância a partir de onde ele se encontra e período de interesse (um dia específico, a semana ou o mês). A partir dessas informações, a plataforma também poderá sugerir rotas até os eventos e apresentar a previsão do tempo para o dia escolhido, ajudando o usuário a planejar melhor seus momentos de lazer.


## Rodando com Docker

```bash
docker compose up --build
```

O backend fica em http://localhost:8000 e o frontend em http://localhost:5173. As portas só aceitam conexões desta máquina, porque o backend roda com `DEBUG` ligado. Para abrir o app em outro dispositivo, remova o `127.0.0.1:` das portas no `docker-compose.yml`, de preferência só em uma rede confiável.

### Carregar eventos reais

A página inicial lista os eventos cadastrados no backend. Para importar eventos do Ticketmaster, copie `backend/.env.example` para `backend/.env`, preencha `TICKETMASTER_API_KEY` e, com o Docker Compose ativo, rode:

```bash
docker compose exec backend python manage.py importar_ticketmaster
```

Sem importar eventos, a API e a página inicial mostram o catálogo vazio.

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
