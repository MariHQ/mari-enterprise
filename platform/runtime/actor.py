"""Read-only evidence miner. This HTTP server runs ONLY inside Agent Substrate."""
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from mari_kit.ingestion import mine_candidates


class Handler(BaseHTTPRequestHandler):
    def reply(self, status, payload):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        self.reply(200 if self.path == "/readyz" else 404, {"executor": "agent-substrate", "extractor": "rules-v1"})

    def do_POST(self):
        if self.path != "/mine":
            self.reply(404, {"error": "Unknown operation"})
            return
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 < size <= 12_000_000:
                self.reply(413, {"error": "Bounded evidence input required"})
                return
            payload = json.loads(self.rfile.read(size))
            self.reply(200, {"run_id": payload["run_id"], "candidates": mine_candidates(payload["evidence"])})
        except (ValueError, KeyError, TypeError):
            self.reply(400, {"error": "Malformed evidence"})


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", 80), Handler).serve_forever()
