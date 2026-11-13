FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 HF_HOME=/cache/huggingface TOKENIZERS_PARALLELISM=false
WORKDIR /app
RUN groupadd -g 10001 eduai && useradd -u 10001 -g 10001 -m -s /usr/sbin/nologin eduai
RUN pip install --no-cache-dir torch==2.11.0 --index-url https://download.pytorch.org/whl/cpu
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY --chmod=0444 server.py exact_verifier.py ./
RUN chmod 0755 /app
RUN mkdir -p /cache /models && chown -R eduai:eduai /cache
USER eduai
EXPOSE 8000
CMD ["uvicorn","server:app","--host","0.0.0.0","--port","8000","--workers","1"]
