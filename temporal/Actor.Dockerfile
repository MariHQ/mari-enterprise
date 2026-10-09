FROM python:3.12-alpine
WORKDIR /app
COPY temporal/actor.py .
COPY vendor/mari-kit-runtime/src/mari_kit/ingestion.py mari_kit/ingestion.py
EXPOSE 80
CMD ["python", "/app/actor.py"]
