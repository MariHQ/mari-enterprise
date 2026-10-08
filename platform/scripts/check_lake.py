#!/usr/bin/env python3
"""Read live Iceberg state through OrchidDB without launching another Flink job."""
from sql import query
query("SELECT source, kind, count(*) AS records FROM records GROUP BY source, kind ORDER BY source, kind")
query("SELECT operation, count(*) AS events FROM history GROUP BY operation ORDER BY operation")
