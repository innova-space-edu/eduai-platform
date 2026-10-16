FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HUB_OFFLINE=1 \
    TRANSFORMERS_OFFLINE=1 \
    HF_DATASETS_OFFLINE=1 \
    PYTORCH_JIT=0 \
    PORT=8080
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg git ca-certificates libsndfile1 && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir \
    "fastapi==0.116.1" \
    "uvicorn[standard]==0.35.0" \
    "google-cloud-storage>=2.19,<4" \
    "chatterbox-tts==0.1.7"
COPY main.py /app/main.py
RUN useradd --uid 10001 --create-home worker && \
    mkdir -p /models && chown -R worker:worker /app /models
USER worker
EXPOSE 8080
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]
