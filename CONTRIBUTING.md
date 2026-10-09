# Contributing to Mari

Thanks for taking the time to contribute. This guide covers how to get the project
running, what we expect from a change, and how to sign your commits off.

## Contributor License Agreement

This project uses a lightweight [Contributor License Agreement](CLA.md). You
keep the copyright to your work; the CLA licenses it to the project broadly
enough that we can keep our licensing options open (the project is Apache 2.0
today, and paid offerings are built from the same tree). There is nothing to
mail in and no bot to argue with — every commit must carry a `Signed-off-by`
line, and that sign-off is your agreement to the CLA for that contribution:

```
Signed-off-by: Jane Doe <jane@example.com>
```

Git adds it for you with `-s`:

```sh
git commit -s -m "Fix chunk hash comparison on resync"
```

Use your real name, and make sure the name and email match the ones on the commit.
For the address, either one that reaches you or your GitHub noreply address works.
The noreply form is `<id>+<username>@users.noreply.github.com` and it's listed on
your [email settings](https://github.com/settings/emails) page. Nobody needs to
publish a personal address to contribute here, and if you've enabled "Block command
line pushes that expose my email" on GitHub, the noreply address is the one to use.

To make sign-off automatic for this repo:

```sh
git config user.name "Jane Doe"
git config user.email "jane@example.com"   # or 1234567+jane@users.noreply.github.com
git config format.signOff true
```

Forgot to sign off? Amend the last commit with `git commit -s --amend --no-edit`,
or fix a whole branch with `git rebase --signoff origin/main`, then force-push.

## Getting set up

Follow the [Temporal worker guide](temporal/README.md). Mari's
apps and workers read embedded OrchidDB and publishes changes to Kafka;
it must never connect to PostgreSQL. PostgreSQL backing Temporal and catalog
metadata is owned by those infrastructure services.

Frontends live in `container/web/` and `apps/<id>/web/`; their presentation library is the
`vendor/mari-design` submodule. Keep credentials in the ignored `temporal/.env`.

## Before you open a pull request

From this repository:

```sh
make test-components
make test-web
node apps/base/web/build.mjs build apps/sources # or the changed app / container
make check
```

Worker configuration is documented in
[temporal/README.md](temporal/README.md). Test meaningful changes at their service
boundary, including failures, duplicate delivery, and retractions where relevant.

## What we look for in a change

- Keep the Mari application free of database connections and local record storage.
- Publish normalized knowledge changes to Kafka; read through embedded OrchidDB.
- Keep UI presentation changes in the shared component library.
- Map real API responses; missing graph mappings and failed queries must remain explicit.
- Keep ingestion incremental and preserve stable event identities across retries.
- Keep credentials and source payloads out of logs and committed files.

## Adding a connector

Use the normalized ingestion contracts in `apps/base/ingestion/records.py` and
Temporal polling in `temporal/`. Webhook handling has been removed.
Exercise retry handling, cursor advancement, and retractions.

## Commit messages

Write a short imperative subject line (under ~72 characters) describing what the
commit does, and use the body to explain *why* when it isn't obvious. Reference
issues with `#123`. Every commit needs its `Signed-off-by` line.

## Reporting bugs and proposing features

Open an issue with what you expected, what happened, and the smallest set of steps
that reproduces it. Include the relevant log output verbatim, plus the relevant platform service
versions. For larger features, open an issue to
discuss the approach before writing the code — it saves everyone a rewrite.

## Security

Please do not open a public issue for security vulnerabilities. Report them
privately to the maintainers so a fix can ship before details are public.

## License

By contributing, you agree to the [Contributor License Agreement](CLA.md) as
described above. The project itself is licensed under Apache 2.0.
