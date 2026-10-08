SELECT record_id, source, kind, title, observed_at
FROM records
ORDER BY observed_at DESC
LIMIT 25
