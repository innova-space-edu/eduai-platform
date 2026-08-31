FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt ./requirements.txt
ARG WITH_DEMUCS=0
RUN if [ "$WITH_DEMUCS" = "1" ]; then \
      pip install -r requirements.txt demucs==4.0.1; \
    else \
      pip install -r requirements.txt; \
    fi
COPY app.py ./app.py

EXPOSE 7860
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
