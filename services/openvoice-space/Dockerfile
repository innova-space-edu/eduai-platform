FROM python:3.9-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ffmpeg \
    git \
    libsndfile1 \
    pkg-config \
    python3-dev \
    libavformat-dev \
    libavcodec-dev \
    libavdevice-dev \
    libavutil-dev \
    libswscale-dev \
    libswresample-dev \
    libavfilter-dev \
    unzip \
    wget \
  && rm -rf /var/lib/apt/lists/*

RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    VOICE_STORE_DIR=/data/voices \
    OPENVOICE_CHECKPOINT_DIR=/home/user/app/checkpoints_v2
WORKDIR $HOME/app

COPY --chown=user requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --upgrade pip setuptools wheel \
  && pip install --no-cache-dir -r requirements.txt \
  && git clone --depth 1 https://github.com/myshell-ai/OpenVoice.git /home/user/OpenVoice \
  && pip install --no-cache-dir -e /home/user/OpenVoice \
  && pip install --no-cache-dir git+https://github.com/myshell-ai/MeloTTS.git \
  && python -m unidic download \
  && wget -q https://myshell-public-repo-host.s3.amazonaws.com/openvoice/checkpoints_v2_0417.zip -O /tmp/checkpoints_v2.zip \
  && unzip -q /tmp/checkpoints_v2.zip -d /home/user/app \
  && rm -f /tmp/checkpoints_v2.zip

COPY --chown=user app.py ./app.py

USER root
RUN mkdir -p /data/voices && chmod 777 /data/voices
USER user

EXPOSE 7860
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
