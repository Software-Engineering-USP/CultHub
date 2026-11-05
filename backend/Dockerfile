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
COPY clima ./clima

# UID 1000 coincide com o usuário padrão do Linux; o db.sqlite3 é criado em /app.
RUN useradd --uid 1000 --create-home app && chown app:app /app
USER app

EXPOSE 8000
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
