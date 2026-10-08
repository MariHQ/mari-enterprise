# Mari

Mari is a governance interface over knowledge stored in Iceberg on S3.
The application server reads through the Knowledge API and publishes changes
and retractions to Kafka. It never connects to PostgreSQL or maintains its own
record database. Temporal runs ingestion and background work; Flink materializes
changes into the lake. OrchidDB serves graph and structured reads through the
Knowledge API.

## Deployment

Deploy with Flux. See the [platform guide](platform/README.md#build-and-flux)
for prerequisites, configuration, release commands, and local access, and the
[deployment runbook](docs/deployment-runbook.md) for rollout checks.
Platform deployment commands run from the parent workspace containing `mari/`.

PostgreSQL is infrastructure for Temporal and the Iceberg catalog. Its credentials
belong to those services, never the Mari application. Mari receives only its owner
session configuration, Knowledge API service credentials, and Kafka/Temporal endpoints.

## Development

The web console is in `web/`, with presentation components supplied by the
`vendor/mari-design` submodule. The application API is in `platform/governance/`;
read services are in `platform/knowledge/`; ingestion and jobs are in
`platform/runtime/`. Reusable component packages remain in `vendor/mari-kit/`.

Use the platform environment described in [platform/README.md](platform/README.md).
From this repository, run:

```sh
make test-components
npm --prefix web run check
npm --prefix web run build
make check
```

`PYTHON` defaults to the parent workspace's `.platform-venv/bin/python` and can
be overridden. Live platform checks are documented in the platform guide.
Store credentials in ignored local environment files; never commit real secrets.

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution requirements and
[SECURITY.md](SECURITY.md) for private security reporting.

## License

Mari is licensed under [Apache License 2.0](LICENSE.md).
Copyright © 2026 Eric Disque and Daniel Henneberger. See [NOTICE](NOTICE).
