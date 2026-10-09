# Mari

Mari is a governance interface over knowledge stored in Iceberg on S3.
Each Knative app reads through its embedded OrchidDB runtime and publishes
changes and retractions to Kafka. Temporal runs background work; Flink
materializes normalized changes into Iceberg. Apps keep no local record database.

## Deployment

Shared infrastructure is managed in `~/stack` on local Kubernetes
(`kind-orchid-stack`). Mari's old infrastructure definitions and provisioners
have been removed. **Mari has not been deployed to the new stack.** See the
[Temporal worker notes](temporal/README.md) for retained Temporal jobs,
runtime bindings, and remaining lake/query integration work.

PostgreSQL is infrastructure for Temporal and the Iceberg catalog. Its credentials
belong to those services, never the Mari application. Mari receives only its owner
session configuration, Orchid/Polaris credentials, and Kafka/Temporal endpoints.

## Container

The new [container web app](container/README.md) owns JSON-configured app
navigation, local `demo/demo` login, and generic OpenID Connect authentication.
All eleven sidebar tabs are stateless apps with their own handlers and embedded OrchidDB read path.

## Application base

All migrated apps use the [shared base image and build script](apps/base/README.md).
The apps and container share runtime dependencies, app authentication,
OrchidDB bindings, and one web toolchain.

## Development

The host frontend lives in `container/web/`; each app owns `apps/<id>/web/`
and its backend handlers. Shared frontend tooling lives in `apps/base/web/`,
with original presentation components supplied by `vendor/mari-design`.
Temporal workflows, activities, and maintenance jobs live in `temporal/`;
normalized ingestion and its schema declaration live in `flink/`.

Use the environment described in [temporal/README.md](temporal/README.md).
From this repository, run:

```sh
make test-components
make test-web
node apps/base/web/build.mjs build apps/sources # or another app / container
make check
```

`PYTHON` defaults to the parent workspace's `.platform-venv/bin/python` and can
be overridden. Worker configuration is documented in the Temporal guide.
Store credentials in ignored local environment files; never commit real secrets.

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution requirements and
[SECURITY.md](SECURITY.md) for private security reporting.

## License

Mari is licensed under [Apache License 2.0](LICENSE.md).
Copyright © 2026 Eric Disque and Daniel Henneberger. See [NOTICE](NOTICE).
