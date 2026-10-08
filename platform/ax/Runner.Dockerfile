FROM python:3.12-slim
COPY ax-task-runner /usr/local/bin/ax-task-runner
ENTRYPOINT ["/usr/local/bin/ax-task-runner"]
