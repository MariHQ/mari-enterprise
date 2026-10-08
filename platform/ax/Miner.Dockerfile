FROM localhost:5001/mari-ax-runner@sha256:0f4d932f302bd1bfb55f2b377fac14b2fa04d7862f2c063562a4d3ca509c1535
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://claude.ai/install.sh -o /tmp/install-claude.sh && bash /tmp/install-claude.sh 2.1.283 && rm /tmp/install-claude.sh
ENV PATH=/root/.local/bin:$PATH
COPY mari/vendor/mari-kit/packages/mari-core /packages/core
COPY mari/vendor/mari-kit/packages/mari-knowledge /packages/knowledge
RUN pip install --no-cache-dir /packages/core /packages/knowledge && rm -rf /packages
COPY mari/platform/runtime/decision_miner.py /app/decision_miner.py
