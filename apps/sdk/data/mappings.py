"""Map discovered sink tables into OrchidDB relations; never provision tables."""

PREFIX = 'mari.records.'
NAMESPACE = 'mari_streams'
HISTORY_NAMESPACE = 'mari_history'


def topic_for(source, kind):
    return PREFIX + source + '.' + kind


def table_for(topic):
    return topic


def route_for(table):
    try:
        topic = table
        if not topic.startswith(PREFIX): return None
        source, kind = topic[len(PREFIX):].rsplit('.', 1)
        return source, kind
    except (ValueError, UnicodeError):
        return None


def operational(source, kind):
    return source == 'temporal' or kind in ('workflow', 'mining_receipt', 'principal', 'change', 'review', 'collection', 'trajectory', 'step')


# These are logical relations, not physical table definitions. A relation can
# include any number of discovered topic tables and is empty before first ingest.
KINDS = {
    'connector_configurations': {'temporal_connector', 'webhook_connector'},
    'workflow_runs': {'temporal_run'},
    'workflow_activities': {'temporal_activity'},
    'workflow_definitions': {'temporal_workflow', 'workflow'},
    'temporal_schedules': {'temporal_schedule'},
    'temporal_observations': {'temporal_observation'},
    'mining_receipts': {'mining_receipt'},
    'governance_changes': {'change'},
    'reviews': {'review'},
    'facts': {'fact'},
    'decisions': {'decision'},
    'collections': {'collection'},
    'agent_trajectories': {'trajectory'},
    'agent_steps': {'step'},
}


def accepts(view, source, kind):
    if view in KINDS: return kind in KINDS[view]
    if view == 'records': return not operational(source, kind)
    if view == 'operations': return operational(source, kind)
    return True
