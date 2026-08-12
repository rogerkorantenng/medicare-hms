# The API image. Used by docker compose locally and by App Runner in
# production, so what runs on AWS is the image that was tested here.
FROM python:3.12-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/usr/local

COPY --from=ghcr.io/astral-sh/uv:0.5.11 /uv /usr/local/bin/uv

WORKDIR /srv

# Dependencies first, so editing application code does not reinstall them.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project --no-dev

COPY app ./app
COPY sql ./sql
COPY scripts ./scripts
RUN uv sync --frozen --no-dev

# Nothing here needs to write to disk or bind a privileged port.
RUN useradd --create-home --uid 10001 api && chown -R api /srv
USER api

EXPOSE 8000

# App Runner health-checks /health, which touches the database.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4).status == 200 else 1)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
