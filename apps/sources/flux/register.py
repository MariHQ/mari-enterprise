"""Only the physical node types read by the sources app."""
from apps.base.catalog.provision import register

LABELS = (
    'TemporalConnector',
    'TemporalRun',
    'TemporalActivity',
    'TemporalObservation',
)

if __name__ == '__main__':
    register('sources', LABELS)
