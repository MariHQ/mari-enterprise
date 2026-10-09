"""Only the physical node types read by the settings app."""
from apps.base.catalog.provision import register

LABELS = (
    'MariPreferences',
    'MariProject',
    'MariConfiguration',
    'MariPrincipal',
    'MariModelProvider',
    'MariModel',
    'MariServicePrincipal',
    'MariChange',
    'MariPresentation',
)

if __name__ == '__main__':
    register('settings', LABELS)
