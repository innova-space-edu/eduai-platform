FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN useradd -m -u 10001 eduai
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY engine ./engine
USER eduai
EXPOSE 8000
CMD ["uvicorn","engine.app:app","--host","0.0.0.0","--port","8000","--workers","1","--limit-concurrency","20"]
