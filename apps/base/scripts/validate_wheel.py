"""Reject wrong-platform or legacy wheels before starting the Docker build."""
from pathlib import Path
import sys
import zipfile


def validate(path, target):
    path = Path(path)
    arch = {'linux/arm64': 'aarch64', 'linux/amd64': 'x86_64'}[target]
    if path.suffix != '.whl' or not path.is_file(): raise ValueError('Supply an existing .whl file')
    with zipfile.ZipFile(path) as wheel:
        metadata = next(name for name in wheel.namelist() if name.endswith('.dist-info/WHEEL'))
        tags = [line[5:] for line in wheel.read(metadata).decode().splitlines() if line.startswith('Tag: ')]
        if not any(('linux' in tag and tag.endswith(arch)) for tag in tags):
            raise ValueError(f'Wheel must target Linux {arch}, not macOS or a universal platform')
        names = set(wheel.namelist())
        required = {'orchiddb/catalog.py', 'orchiddb/CORE_REVISION', 'orchiddb/native/liborchiddb_compiler.so'}
        if not required.issubset(names):
            raise ValueError('Wheel lacks the catalog-capable OrchidDB client/native release')
    print('Compatible wheel layout:', path.name)


if __name__ == '__main__':
    try: validate(sys.argv[1],sys.argv[2])
    except (ValueError, KeyError, StopIteration, zipfile.BadZipFile) as error: raise SystemExit(str(error))
