#!/usr/bin/env python3
"""Build a local wheel from matching client sources and an existing native artifact.

The 0.4.0 release reused a native binary but stamped the packaging commit into
CORE_REVISION. Preserve published artifacts and emit a distinct local version.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile
import io

ROOT=Path(__file__).resolve().parents[3]
SOURCE_REV='0cf28656cc97b5f77ace9f7f997a4954508a939b'
BINARY_REV='dc1dad23a1f19bcec062b3efc14b876e84fd3470'


def main():
    p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
    source=a.source.resolve();output=a.output.resolve();output.mkdir(parents=True,exist_ok=True)
    unchanged=subprocess.check_output(['git','diff',BINARY_REV,SOURCE_REV,'--','clients/python','clients/native','src'],cwd=source)
    if unchanged:raise RuntimeError('Native and client sources differ; refusing to reuse the binary')
    release=source/'target/releases/orchiddb-v0.4.0'/SOURCE_REV
    pins={'version':'0.4.0+mari.1','revision':BINARY_REV,'packaging_revision':SOURCE_REV,'wheels':{}}
    for arch,target,platform in [('arm64','linux_arm64','manylinux_2_28_aarch64'),('amd64','linux_amd64','manylinux_2_28_x86_64')]:
        manifest=json.loads((release/('build-'+target+'.json')).read_text())
        if manifest.get('binary_commit')!=BINARY_REV:raise RuntimeError('Unexpected binary provenance')
        binary=release/'binaries'/target/'liborchiddb_compiler.so'
        if hashlib.sha256(binary.read_bytes()).hexdigest()!=manifest['files'][str(binary.relative_to(source))]:raise RuntimeError('Native artifact checksum mismatch')
        with tempfile.TemporaryDirectory(prefix='mari-orchid-package-') as tmp:
            stage=Path(tmp)
            archive=subprocess.check_output(['git','archive',BINARY_REV,'clients/python'],cwd=source)
            with tarfile.open(fileobj=io.BytesIO(archive)) as tar:tar.extractall(stage,filter='data')
            package=stage/'clients/python';native=package/'src/orchiddb/native';native.mkdir(exist_ok=True)
            shutil.copy2(binary,native/binary.name)
            (package/'src/orchiddb/CORE_REVISION').write_text(BINARY_REV+'\n')
            project=package/'pyproject.toml';project.write_text(project.read_text().replace('version = "0.4.0"','version = "0.4.0+mari.1"'))
            subprocess.run([str(ROOT/'.platform-venv/bin/python'),'setup.py','bdist_wheel','--plat-name',platform,'--dist-dir',str(output)],cwd=package,check=True,stdout=subprocess.DEVNULL,env={**os.environ,'SOURCE_DATE_EPOCH':subprocess.check_output(['git','show','-s','--format=%ct',BINARY_REV],cwd=source,text=True).strip()})
        wheel=output/f'orchiddb-0.4.0+mari.1-py3-none-{platform}.whl'
        pins['wheels'][arch]={'file':wheel.name,'sha256':hashlib.sha256(wheel.read_bytes()).hexdigest()}
        print('Packaged',wheel.name)
    (ROOT/'mari/platform/config/orchiddb.json').write_text(json.dumps(pins,indent=2)+'\n')
if __name__=='__main__':main()
