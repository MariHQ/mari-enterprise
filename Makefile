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
	@set -e; for app in $$(node -e 'const c=require("./container/apps.json"); console.log(c.apps.map(a=>"apps/"+a.id).concat("container").join(" "))'); do \
	  node apps/base/web/build.mjs check "$$app"; \
	done

check:
	$(PYTHON) -m compileall -q temporal container apps/sdk apps/base apps/sources/web/server.py
	$(PYTHON) -m unittest discover -s temporal/tests -v
	$(PYTHON) -m unittest discover -s container/tests -v
	$(PYTHON) -m unittest discover -s apps/base/tests -v
