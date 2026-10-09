# Sources app

This app imports the original `SourcesPage` and the original connector projection
adapter. Authentication, embedded data access and startup come from the shared
application base. The container lists it in `container/apps.json`; `flux/` holds
its staged Knative Service and graph-registration job.

See [the shared base instructions](../base/README.md) for builds and previews.
