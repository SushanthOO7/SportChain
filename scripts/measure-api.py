"""Measure sequential lookup latency against a running, seeded local stack."""
import json
import statistics
import time
import urllib.request
from pathlib import Path

samples = []
url = "http://127.0.0.1:8000/api/products/SC-PAIR-0006"
for i in range(31):
    start = time.perf_counter()
    with urllib.request.urlopen(url, timeout=30) as response:
        body = json.load(response)
        assert body["status"] == 5
    if i:
        samples.append((time.perf_counter() - start) * 1000)
report = {"workload": "30 sequential public lookups of SC-PAIR-0006 after one warmup; six seeded pairs; local Hardhat; request-triggered event synchronization", "samples": len(samples), "medianMs": round(statistics.median(samples), 2), "p95Ms": round(sorted(samples)[int(len(samples) * .95) - 1], 2), "maximumMs": round(max(samples), 2)}
Path(".runtime").mkdir(exist_ok=True)
Path(".runtime/latency-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps(report, indent=2))
