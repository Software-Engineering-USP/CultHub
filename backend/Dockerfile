FROM python:3.12.16-slim-trixie

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.lock ./
RUN pip install --no-cache-dir --only-binary :all: --require-hashes -r requirements.lock

COPY manage.py ./
COPY CultHubBackend ./CultHubBackend
COPY catalogo ./catalogo
COPY usuarios ./usuarios
COPY agenda ./agenda
COPY clima ./clima
COPY rotas ./rotas

# O banco do Compose fica em /data, em um volume com permissões deste usuário.
RUN useradd --uid 1000 --create-home app && mkdir /data && chown app:app /app /data
USER app

EXPOSE 8000
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
