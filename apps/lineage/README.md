# Lineage

The original Mari graph page now renders every returned record kind and the
published relationship names, including Temporal nodes and relationships.
`/api/lineage/catalog` exposes graph labels and property types from the published
OrchidDB manifest; it does not expose connector credentials or storage locations.
The existing node drawer displays property values. Without a focal ID, the app
starts at the most recently observed record. Focus a node to explore its neighbors.

Reads use bounded Cypher, including undirected edge traversal. All steps for a
neighborhood share one resolved catalog and physical metadata snapshot. The
catalog revision is returned with the neighborhood. The UI preserves exact edge
names instead of dropping unknown relationships or converting them to a fixed
list of document relations. The timeline shows recorded event dates; it is not
a reconstruction of an historical graph snapshot.

## Registration and rollout

Each app's `flux/register.py` calls `apps/sdk/provision.py`. Its Flux Job loads
existing Iceberg table UUIDs, upserts versioned datasets/entities/relationships,
and publishes the app graph. Lineage reads that published graph. It never
registers mappings or executes schema mutations from the browser.

To add a metric source, declare its normalized topic in `flink/ingestion.yaml`
and supply a producer of the existing `KnowledgeChange` contract. Store a
metric's attributes in `properties`; publish explicit edge records with
`from_id`, `to_id`, and `relation`, or add a computed relationship mapping in
`apps/sdk/data/relationships.py`. Add typed node/edge catalog definitions in
`apps/sdk/provision.py` when the source needs them. A new metric type does not
require a new Lineage screen. No metric producer is configured by this change.

Build and publish immutable runtime/app/Flink images, update their staged Flux
references, and commit the schema and registration changes together. The Flux
chain is topics → safe schema application → app graph registration/services →
Flink ingestion. Registration Job image changes cause a fresh Job through the
existing Flux force-recreation annotation. After successful registration and
consumer startup, enable the source producer/Temporal schedule and verify an
actual event through Kafka, Iceberg, catalog, and Cypher before wider rollout.

The staged chain is suspended and needs a `GitRepository` named `mari`. Nothing
is pushed to production automatically; image publication, Git push, and Flux
activation are deployment actions.
