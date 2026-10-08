# Build with mari/ as the context. Only this app's web code is built.
FROM node:22-alpine AS build
WORKDIR /app/apps/sources/web
COPY apps/sources/web/package*.json ./
RUN npm ci
COPY vendor/mari-design/components /app/vendor/mari-design/components
COPY apps/sources/web ./
RUN npm run build
FROM python:3.12-slim
WORKDIR /app
COPY apps/sources/web/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY apps/sources/mari.yaml /app/mari.yaml
COPY apps/sources/web/server.py ./server.py
COPY --from=build /app/apps/sources/web/dist ./static
ENV MARI_STATIC_DIR=/app/static MARI_APP_MANIFEST=/app/mari.yaml
USER 65532:65532
EXPOSE 8080
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8080"]
