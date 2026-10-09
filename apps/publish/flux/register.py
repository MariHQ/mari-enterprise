"""Only the physical node types read by the publish app."""
from apps.base.catalog.provision import register

LABELS = (
    'MariDestination',
)

if __name__ == '__main__':
    register('publish', LABELS)
