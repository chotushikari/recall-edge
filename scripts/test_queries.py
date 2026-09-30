"""Run the curated demo queries against a running Recall Edge API."""
from __future__ import annotations

import json
from pathlib import Path

import httpx


def main() -> None:
    queries = json.loads(Path("scripts/judge_queries.json").read_text(encoding="utf-8"))
    passed = 0
    for item in queries:
        results = httpx.post("http://localhost:8000/memory/search", json={"query": item["query"], "top_k": 1}, timeout=20).json()
        summary = results[0]["payload"]["summary"] if results else "NO RESULT"
        ok = bool(results)
        passed += ok
        print(f"{'PASS' if ok else 'FAIL'} {item['id']}: {summary}")
    print(f"{passed}/{len(queries)} queries returned evidence")
    if passed != len(queries):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
