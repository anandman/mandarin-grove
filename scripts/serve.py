"""Serve the app on LAN/Tailnet without exposing workspace files."""
import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent.parent
FILES = {
    "index.html", "styles.css", "app.js", "practice.js", "speech.js", "cram.js", "learning.js", "review.js", "feedback.js", "version-check.js", "version.txt",
    "icon64.png", "icon180.png", "icon192.png", "icon512.png", "manifest.webmanifest", "vendor/hanzi-writer.js",
}


class AppHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_head(self):
        path = unquote(urlsplit(self.path).path).lstrip("/") or "index.html"
        parts = Path(path).parts
        allowed = path in FILES or (
            len(parts) == 2
            and ((parts[0] == "audio" and parts[1].endswith(".mp3"))
                 or (parts[0] == "strokes" and parts[1].endswith(".json")))
        )
        target = ROOT / path
        if not allowed or target.is_symlink() or not target.resolve().is_relative_to(ROOT) or not target.is_file():
            self.send_error(404)
            return None
        return super().send_head()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=4173)
    args = parser.parse_args()
    with ThreadingHTTPServer((args.host, args.port), AppHandler) as server:
        print(f"Serving Mandarin Grove on {args.host}:{args.port}", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
