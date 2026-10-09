"""Only the physical node types read by the scheduled-tasks app."""
from apps.base.catalog.provision import register

LABELS = (
    'TemporalSchedule',
    'TemporalRun',
    'TemporalObservation',
)

if __name__ == '__main__':
    register('scheduled-tasks', LABELS)
