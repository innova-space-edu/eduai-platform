FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \
    fastapi==0.116.1 \
    "uvicorn[standard]==0.35.0" \
    httpx==0.28.1

COPY main.py song_gateway.py voice_gateway.py /app/

EXPOSE 8080
CMD ["uvicorn","main:app","--host","0.0.0.0","--port","8080","--workers","1"]
