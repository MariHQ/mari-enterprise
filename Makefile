PYTHON ?= ../.platform-venv/bin/python
.PHONY: test test-components test-web check

test: test-components test-web

test-components:
	cd vendor/mari-kit && $(abspath $(PYTHON)) -m unittest discover -s tests -v
	for package in vendor/mari-kit/packages/*; do \
	  if [ -d "$$package/tests" ]; then \
	    (cd "$$package" && $(abspath $(PYTHON)) -m unittest discover -s tests -v) || exit 1; \
	  fi; \
	done

test-web:
	npm --prefix web run check

check:
	$(PYTHON) -m compileall -q platform
	kubectl kustomize platform/deploy/operators >/dev/null
	kubectl kustomize platform/deploy/infrastructure >/dev/null
	kubectl kustomize platform/deploy/streaming >/dev/null
	kubectl kustomize platform/deploy/apps >/dev/null
