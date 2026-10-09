ARG AX_RUNNER_IMAGE
FROM ${AX_RUNNER_IMAGE}
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://claude.ai/install.sh -o /tmp/install-claude.sh && bash /tmp/install-claude.sh 2.1.283 && rm /tmp/install-claude.sh
ENV PATH=/root/.local/bin:$PATH
COPY vendor/mari-kit/packages/mari-core /packages/core
COPY vendor/mari-kit/packages/mari-knowledge /packages/knowledge
RUN pip install --no-cache-dir /packages/core /packages/knowledge && rm -rf /packages
COPY temporal/decision_miner.py /app/decision_miner.py
COPY vendor/mari-kit-runtime/src /kit
ENV PYTHONPATH=/kit
