"""Metadata-only cleanup for obsolete deletes on a single unpartitioned spec."""

def _files(reader):
    iterator = reader.iterator()
    try:
        while iterator.hasNext():
            yield iterator.next()
    finally:
        iterator.close()


def remove_obsolete_deletes(table, manifest_files):
    table.refresh()
    snapshot = table.currentSnapshot()
    if snapshot is None or table.specs().size() != 1 or not table.spec().isUnpartitioned():
        return 0
    minimum = None
    for manifest in snapshot.dataManifests(table.io()):
        reader = manifest_files.read(manifest, table.io())
        try:
            for data in _files(reader):
                sequence = data.dataSequenceNumber()
                # Unknown sequence means we cannot prove any delete is obsolete.
                if sequence is None or sequence <= 0:
                    return 0
                minimum = sequence if minimum is None else min(minimum, sequence)
        finally:
            reader.close()
    if minimum is None:
        return 0
    rewrite = table.newRewrite().validateFromSnapshot(snapshot.snapshotId())
    removed = 0
    for manifest in snapshot.deleteManifests(table.io()):
        reader = manifest_files.readDeleteManifest(manifest, table.io(), table.specs())
        try:
            for delete in _files(reader):
                sequence = delete.dataSequenceNumber()
                # Equality deletes apply only to strictly older data; position
                # deletes can apply within the same sequence.
                equality = str(delete.content()) == 'EQUALITY_DELETES'
                if sequence is not None and sequence > 0 and (sequence < minimum or (equality and sequence == minimum)):
                    rewrite.deleteFile(delete.copy())
                    removed += 1
        finally:
            reader.close()
    if removed:
        rewrite.commit()
    return removed
