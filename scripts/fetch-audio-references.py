"""Fetch the pinned public research samples; never part of the student app.

The source has not supplied redistribution rights. Keep downloaded audio outside
Git. Requests reproduce the public player's URL and page referrer, without login.
"""
import argparse
import hashlib
import json
from pathlib import Path
import urllib.request


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=Path(__file__).resolve().parents[1] / "data/audio-reference-benchmark.json")
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--download", action="store_true", help="Explicitly allow public sample requests; otherwise verify local files only")
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text())
    clips = manifest["clips"]
    if manifest["schemaVersion"] != 1 or len(clips) != 87:
        raise ValueError("Expected the pinned 87-clip research benchmark")
    args.out.mkdir(parents=True, exist_ok=True)
    for clip in clips:
        if not clip["id"].startswith("scsc-") or not clip["id"][5:].isdigit():
            raise ValueError("Unexpected source item ID")
        file = args.out / (clip["id"] + ".wav")
        if not file.exists():
            if not args.download:
                raise ValueError(f"Missing {file}; use --download to fetch public references")
            url = clip["sourceAudio"]
            if not url.startswith("https://multi.ucass.edu.cn/prod-api/profile/corpus/") or not url.endswith(".wav"):
                raise ValueError("Unexpected reference origin or format")
            request = urllib.request.Request(url, headers={"Referer": manifest["source"]["samples"]})
            with urllib.request.urlopen(request, timeout=30) as response:
                if response.geturl() != url:
                    raise ValueError("Unexpected source redirect")
                data = response.read(1024 * 1024 + 1)
            if len(data) > 1024 * 1024 or hashlib.sha256(data).hexdigest() != clip["sha256"]:
                raise ValueError("Source bytes differ from the pinned recording")
            file.write_bytes(data)
        if hashlib.sha256(file.read_bytes()).hexdigest() != clip["sha256"]:
            raise ValueError(f"Changed audio: {file}")
    print(f"Verified {len(clips)} original research recordings. No pronunciation verdict or app changes.")


if __name__ == "__main__":
    main()
