## What does this change?

<!-- Brief description of the change and why it's needed. Link issues with #123. -->

## How was it tested?

<!-- Commands run, manual steps, environment. -->

## Checklist

- [ ] All commits are signed off (`git commit -s`), agreeing to the [CLA](../CLA.md)
- [ ] `make test-web` and the changed app’s shared frontend build pass (if the UI changed)
- [ ] Mari reads through embedded OrchidDB and writes through Kafka, with no PostgreSQL connection
- [ ] Visual changes went to the [mari-design](https://github.com/MariHQ/mari-design) library, with app adapters in `apps/<id>/web/src/`
- [ ] Page adapters map API responses only — no values invented in app adapters
- [ ] No credentials, tokens, or canned/placeholder data added
