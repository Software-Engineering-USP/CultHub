# Imagem de produção: um serviço só, com a API do Django e o front buildado
# na mesma origem. Os Dockerfiles de `backend/` e `frontend/` continuam sendo
# os do desenvolvimento (docker compose).

FROM node:22.23.4-alpine3.24 AS frontend

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
# A versão do binding vem do lockfile para acompanhar o rolldown instalado pelo npm ci.
RUN npm ci --ignore-scripts \
    && ROLLDOWN_VERSION="$(node -p "require('./package-lock.json').packages['node_modules/rolldown'].version")" \
    && ROLLDOWN_BINDING="@rolldown/binding-linux-$(node -p 'process.arch')-musl@${ROLLDOWN_VERSION}" \
    && npm install --no-save --ignore-scripts "$ROLLDOWN_BINDING"

COPY frontend/index.html frontend/vite.config.ts frontend/tsconfig.json frontend/tsconfig.app.json frontend/tsconfig.node.json ./
COPY frontend/public ./public
COPY frontend/src ./src

RUN npx vite build


FROM python:3.12.16-slim-trixie

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_DEBUG=0 \
    DJANGO_FRONTEND_DIST=/app/frontend_dist

WORKDIR /app

COPY backend/requirements.lock ./
RUN pip install --no-cache-dir --only-binary :all: --require-hashes -r requirements.lock

COPY backend/manage.py backend/gunicorn.conf.py ./
COPY backend/CultHubBackend ./CultHubBackend
COPY backend/catalogo ./catalogo
COPY backend/usuarios ./usuarios
COPY backend/agenda ./agenda
COPY backend/clima ./clima
COPY backend/rotas ./rotas
COPY backend/comentarios ./comentarios
COPY backend/notificacoes ./notificacoes
COPY backend/localidades ./localidades
COPY --from=frontend /app/dist ./frontend_dist

# Estas variáveis só existem neste comando; as de verdade vêm do ambiente
# ao rodar.
RUN DJANGO_SECRET_KEY=somente-para-o-collectstatic FRONTEND_URL=http://localhost \
    DJANGO_NUM_PROXIES=0 python manage.py collectstatic --noinput

RUN useradd --uid 1000 --create-home app
USER app

EXPOSE 10000
# Porta, workers e log de acesso ficam em gunicorn.conf.py.
CMD ["sh", "-c", "python manage.py migrate --noinput && exec gunicorn CultHubBackend.wsgi"]
