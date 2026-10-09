FROM python:3.12-alpine
WORKDIR /app
COPY mari/temporal/actor.py .
COPY mari-kit/src/mari_kit/ingestion.py mari_kit/ingestion.py
EXPOSE 80
CMD ["python", "/app/actor.py"]
