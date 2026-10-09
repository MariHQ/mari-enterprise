.PHONY: up publish status forward test smoke credentials
up:
	./scripts/up.sh
publish:
	./scripts/publish.sh
status:
	./scripts/status.sh
forward:
	./scripts/forward.sh
credentials:
	python3 scripts/credentials.py
test:
	./bin/terraform -chdir=terraform validate
smoke:
	.local/venv/bin/python -u scripts/smoke.py

.PHONY: smoke-knative
smoke-knative:
	python3 scripts/knative-smoke.py

.PHONY: substrate-up
substrate-up:
	./scripts/substrate-up.sh
