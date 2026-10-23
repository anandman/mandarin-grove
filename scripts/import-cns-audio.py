#!/usr/bin/env python3
"""Import pinned CNS11643 recordings for the curriculum's exact readings.

Offline and stdlib only. Download Voice.zip and the two documented numbered
repairs separately; this script never contacts a network or synthesizes audio.
MP3 bytes are unchanged; neutral Float32 WAV files become compatible PCM16 WAVs.
"""
import argparse
import hashlib
import io
import json
import math
from pathlib import Path
import re
import struct
import unicodedata
import wave
import zipfile

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE_SHA256 = "6e6793d532e800a75df423cf337adeb2bafe0ee4fee12813c00260102e0a9efa"
MAPPING_SHA256 = "04878e82c0e7368d90f3778f2340b8b9987efb70751b2b03368772ee67ad0e7b"
ARCHIVE_URL = "https://www.cns11643.gov.tw/opendata/Voice.zip"
SOURCE_URL = "https://www.cns11643.gov.tw/"
ATTRIBUTION = "數位發展部，CNS11643中文標準交換碼全字庫網站，https://www.cns11643.gov.tw。"
REPAIRS = {
    "nu3": {
        "filename": "M0598.mp3", "text": "努", "pinyin": "nǔ", "bopomofo": "ㄋㄨˇ",
        "page": "https://www.cns11643.gov.tw/wordView.jsp?ID=84280",
        "sha256": "1dfaa4683ed565732da0d052468bc959a0ec0eeeb2fc361cdfc3f8bdc0459d31",
        "rejectedArchiveSha256": "f4f805f08ee13706f25d7595f45d2c7e608268873e55f18a9bd4401761ad006d",
        "conflictingReading": "nv3",
    },
    "lu4": {
        "filename": "M0724.mp3", "text": "路", "pinyin": "lù", "bopomofo": "ㄌㄨˋ",
        "page": "https://www.cns11643.gov.tw/wordView.jsp?ID=91771",
        "sha256": "e1fe7d1a4acb154c5db3e511054c22b63ab61ae7fe73b97d7901c6c50f99d18d",
        "rejectedArchiveSha256": "8ed18b63cc20f666c78041bb6eafe31e0072e11691cee974309efa95a813cd45",
        "conflictingReading": "lv4",
    },
}
VERIFIED_BUNDLE_LABELS = {
    "nv3": {"text": "女", "pinyin": "nǚ", "bopomofo": "ㄋㄩˇ",
            "page": "https://www.cns11643.gov.tw/wordView.jsp?ID=83020&la=1",
            "url": SOURCE_URL + "voice/male/M0618.mp3",
            "sha256": "f4f805f08ee13706f25d7595f45d2c7e608268873e55f18a9bd4401761ad006d"},
    "lv4": {"text": "綠", "pinyin": "lǜ", "bopomofo": "ㄌㄩˋ",
            "page": "https://www.cns11643.gov.tw/wordView.jsp?ID=92730",
            "url": SOURCE_URL + "voice/male/M0749.mp3",
            "sha256": "8ed18b63cc20f666c78041bb6eafe31e0072e11691cee974309efa95a813cd45"},
}


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def reading_key(pinyin):
    result, tone = [], 5
    for char in unicodedata.normalize("NFD", pinyin.strip().lower()):
        if char in "\u0304\u0301\u030c\u0300":
            tone = "\u0304\u0301\u030c\u0300".index(char) + 1
        elif char == "\u0308" and result and result[-1] == "u":
            result[-1] = "v"
        elif char in "12345":
            tone = int(char)
        elif "a" <= char <= "z":
            result.append(char)
        elif char not in " '’":
            raise ValueError(f"Unsupported pinyin character: {pinyin!r}")
    key = "".join(result) + str(tone)
    if not re.fullmatch(r"[a-z]+[1-5]", key):
        raise ValueError(f"Unsafe reading key: {key!r}")
    return key


def curriculum_readings():
    source = (ROOT / "content/curriculum.json").read_text(encoding="utf-8")
    cards = json.loads(source)["cards"]
    readings = {}
    for card in cards:
        for label in re.split(r"\s*/\s*", card["p"]):
            key = reading_key(label)
            row = readings.setdefault(key, {"characters": [], "displayPinyin": []})
            if card["c"] not in row["characters"]:
                row["characters"].append(card["c"])
            if label not in row["displayPinyin"]:
                row["displayPinyin"].append(label)
    return dict(sorted(readings.items()))


def mapping_rows(data):
    if sha256(data) != MAPPING_SHA256:
        raise ValueError("The official phonetic mapping differs from the reviewed version")
    result = {}
    for line in data.decode("utf-8-sig").splitlines():
        parts = line.split("\t")
        if len(parts) == 2 and re.fullmatch(r"[a-z]+[2-5]?", parts[1]):
            key = parts[1] if parts[1][-1].isdigit() else parts[1] + "1"
            result[key] = parts[0]
    if len(result) != 1467:
        raise ValueError("Incomplete official phonetic mapping")
    return result


def runtime_script(readings):
    data = {"source": "CNS11643", "readings": {k: v["file"] for k, v in readings.items()}}
    return ("// Original CNS11643 recordings; attribution and provenance: audio-sources/.\n"
            "const REFERENCE_AUDIO=" + json.dumps(data, ensure_ascii=False, indent=2) + ";\n")


def float_wav_to_pcm16(data):
    """Convert reviewed mono IEEE Float32 RIFF audio without changing its timing."""
    if len(data) < 12 or data[:4] != b"RIFF" or data[8:12] != b"WAVE":
        raise ValueError("Expected little-endian RIFF/WAVE")
    if struct.unpack_from("<I", data, 4)[0] + 8 != len(data):
        raise ValueError("RIFF size mismatch")
    chunks, position = {}, 12
    while position + 8 <= len(data):
        name, size = struct.unpack_from("<4sI", data, position)
        start = position + 8
        if start + size > len(data):
            raise ValueError("Truncated RIFF chunk")
        if name in {b"fmt ", b"data"}:
            if name in chunks:
                raise ValueError("Ambiguous RIFF audio chunks")
            chunks[name] = data[start:start + size]
        position = start + size + size % 2
    fmt, pcm = chunks.get(b"fmt ", b""), chunks.get(b"data", b"")
    if len(fmt) < 16 or not pcm or len(pcm) % 4:
        raise ValueError("Missing format or incomplete Float32 samples")
    tag, channels, rate, byte_rate, alignment, bits = struct.unpack_from("<HHIIHH", fmt)
    if (tag, channels, rate, byte_rate, alignment, bits) != (3, 1, 48000, 192000, 4, 32):
        raise ValueError("Only reviewed 48kHz mono IEEE Float32 source WAVs are accepted")
    samples = [value for (value,) in struct.iter_unpack("<f", pcm)]
    if any(not math.isfinite(value) or abs(value) > 1 for value in samples):
        raise ValueError("Non-finite or out-of-range source sample")
    integers = [max(-32768, min(32767, round(value * 32768))) for value in samples]
    output = io.BytesIO()
    with wave.open(output, "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(rate)
        audio.writeframes(struct.pack("<" + "h" * len(integers), *integers))
    return output.getvalue(), {
        "method": "IEEE Float32 WAV to PCM16 WAV for browser compatibility",
        "sourceSha256": sha256(data), "sourceBytes": len(data),
        "sourceFormat": "RIFF IEEE Float32 (format tag 3)", "outputFormat": "RIFF signed PCM16 (format tag 1)",
        "sampleRateHz": rate, "channels": channels, "sampleFrames": len(samples),
        "maxAbsoluteQuantizationError": max(abs(source - encoded / 32768) for source, encoded in zip(samples, integers)),
        "processing": "No trimming, resampling, normalization, gain, or pitch changes; non-audio RIFF metadata omitted.",
    }


def safe_path(root, relative):
    path = root / relative
    if not path.resolve().is_relative_to(root.resolve()):
        raise ValueError(f"Output path escapes destination: {relative}")
    return path


def verify(output_root):
    manifest = json.loads((output_root / "audio-sources/cns11643.json").read_text())
    if set(manifest["readings"]) != set(curriculum_readings()):
        raise ValueError("Manifest does not cover the current exact curriculum reading set")
    if manifest["source"]["archive"]["sha256"] != ARCHIVE_SHA256:
        raise ValueError("Wrong archive provenance")
    mapping = mapping_rows(safe_path(output_root, manifest["source"]["mapping"]["file"]).read_bytes())
    seen = {}
    for key, row in manifest["readings"].items():
        if row["bopomofo"] != mapping[key]:
            raise ValueError(f"Wrong official phonetic label: {key}")
        expected = f"audio/cns-{key}-{row['sha256'][:12]}.{row['format']}"
        if row["file"] != expected or row["format"] not in {"mp3", "wav"}:
            raise ValueError(f"Unsafe asset path: {key}")
        data = safe_path(output_root, row["file"]).read_bytes()
        if len(data) != row["bytes"] or sha256(data) != row["sha256"]:
            raise ValueError(f"Asset bytes differ: {key}")
        if row["sha256"] in seen:
            raise ValueError(f"Conflicting readings share bytes: {key}/{seen[row['sha256']]}")
        seen[row["sha256"]] = key
        if key in REPAIRS and row["sha256"] != REPAIRS[key]["sha256"]:
            raise ValueError(f"Unreviewed repair bytes: {key}")
        if key in VERIFIED_BUNDLE_LABELS and row["sha256"] != VERIFIED_BUNDLE_LABELS[key]["sha256"]:
            raise ValueError(f"Unreviewed u/ü comparison bytes: {key}")
        if key.endswith("5"):
            conversion = row["conversion"]
            with wave.open(io.BytesIO(data), "rb") as audio:
                if (audio.getsampwidth(), audio.getframerate(), audio.getnchannels(), audio.getnframes()) != (
                        2, conversion["sampleRateHz"], conversion["channels"], conversion["sampleFrames"]):
                    raise ValueError(f"Compatibility WAV format/timing changed: {key}")
            if conversion["sourceSha256"] != row["source"]["sha256"]:
                raise ValueError(f"Conversion provenance mismatch: {key}")
    if (output_root / "pronunciations.js").read_text() != runtime_script(manifest["readings"]):
        raise ValueError("Runtime asset table differs from source manifest")
    return len(manifest["readings"])


def import_audio(archive_path, repair_dir, output_root):
    archive_data = archive_path.read_bytes()
    if len(archive_data) != 58524582 or sha256(archive_data) != ARCHIVE_SHA256:
        raise ValueError("Voice.zip is not the reviewed 20250113 archive (size/SHA256 mismatch)")
    with zipfile.ZipFile(io.BytesIO(archive_data)) as outer:
        readme = outer.read("全字庫音檔說明文件.txt")
        mapping = mapping_rows(readme)
        male_data = outer.read("male.zip")
    requested = curriculum_readings()
    readings, files, seen = {}, {}, {}
    with zipfile.ZipFile(io.BytesIO(male_data)) as male:
        for key, curriculum in requested.items():
            if key not in mapping:
                raise ValueError(f"No authoritative source mapping: {key}")
            stem = key[:-1] if key.endswith("1") else key
            matches = [f"M_{stem}.{ext}" for ext in ["mp3", "wav"] if f"M_{stem}.{ext}" in male.namelist()]
            if len(matches) != 1:
                raise ValueError(f"Missing or ambiguous source audio: {key}")
            member = matches[0]
            data = male.read(member)
            source = {"archiveMember": "male.zip", "filename": member}
            if key in REPAIRS:
                repair = REPAIRS[key]
                if sha256(data) != repair["rejectedArchiveSha256"] or mapping[key] != repair["bopomofo"]:
                    raise ValueError(f"Source defect changed: {key}")
                data = (repair_dir / repair["filename"]).read_bytes()
                if sha256(data) != repair["sha256"]:
                    raise ValueError(f"Wrong official replacement recording: {key}")
                source = {"url": SOURCE_URL + "voice/male/" + repair["filename"],
                          "labelPage": repair["page"], "text": repair["text"],
                          "pinyin": repair["pinyin"], "replacesArchiveFilename": member,
                          "rejectedArchiveSha256": repair["rejectedArchiveSha256"],
                          "reason": "Archive file duplicates a distinct u/ü reading; numbered live source is separate."}
            elif key in VERIFIED_BUNDLE_LABELS:
                proof = VERIFIED_BUNDLE_LABELS[key]
                if sha256(data) != proof["sha256"]:
                    raise ValueError(f"Verified comparison recording changed: {key}")
                source["verifiedLabel"] = proof
            source["sha256"], source["bytes"] = sha256(data), len(data)
            conversion = None
            fmt = Path(member).suffix.lstrip(".")
            if fmt == "wav":
                if not key.endswith("5"):
                    raise ValueError(f"Unexpected non-neutral WAV requires review: {key}")
                data, conversion = float_wav_to_pcm16(data)
            digest = sha256(data)
            if digest in seen:
                raise ValueError(f"Distinct readings share audio bytes: {seen[digest]}/{key}")
            seen[digest] = key
            file = f"audio/cns-{key}-{digest[:12]}.{fmt}"
            readings[key] = {"file": file, "sha256": digest, "bytes": len(data),
                             "format": fmt, "voice": "male", "bopomofo": mapping[key],
                             "curriculum": curriculum, "source": source}
            if conversion is not None:
                readings[key]["conversion"] = conversion
            files[file] = data
    manifest = {
        "schemaVersion": 1,
        "source": {"id": "CNS11643", "publisher": "數位發展部", "url": SOURCE_URL,
                   "dataset": "https://data.gov.tw/dataset/5961", "attribution": ATTRIBUTION,
                   "license": "政府資料開放授權條款－第1版 (Open Government Data License 1.0)",
                   "licenseUrl": "https://data.gov.tw/license",
                   "publisherLicenseUrl": SOURCE_URL + "pageView.jsp?ID=59",
                   "releaseUrl": SOURCE_URL + "opendata/release.txt",
                   "archive": {"url": ARCHIVE_URL, "version": "20250113", "bytes": len(archive_data),
                               "sha256": ARCHIVE_SHA256, "nestedMember": "male.zip", "nestedSha256": sha256(male_data)},
                   "mapping": {"file": "audio-sources/cns11643-phonetics.txt",
                               "archiveMember": "全字庫音檔說明文件.txt", "sha256": MAPPING_SHA256}},
        "scope": {"readings": len(readings), "voice": "male", "audioEdits": "548 MP3 files unchanged; nine neutral-tone Float32 WAV files converted to PCM16 without trimming, resampling or gain changes.",
                  "selection": "Each existing curriculum reading is matched to the publisher's exact Bopomofo/pinyin mapping, preserving every tone and ü.",
                  "speakerIdentity": "Personal speaker identity and native-language biography are not published in the archive.",
                  "validationLimit": "Publisher-labeled pronunciation references, not a fluent-listener certification or an ASR tone judgment. Isolated readings do not model tone sandhi in phrases.",
                  "excluded": ["All female recordings (female e/er tones 1–4 duplicate distinct labels).",
                               "Bundled M_nu3.mp3 and M_lu4.mp3 (wrong u/ü duplicates; replaced with labeled numbered source files).",
                               "Unused male lu/lv tones 1–3, luan/lvan tones 2–3 and nu/nv tones 2/4 also collide; not imported.",
                               "MOE long dictionary narration, TTS candidates, PSOLA controls and ASR predictions are not these reference assets."]},
        "readings": readings,
    }
    files["audio-sources/cns11643-phonetics.txt"] = readme
    files["audio-sources/cns11643.json"] = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode()
    files["pronunciations.js"] = runtime_script(readings).encode()
    for relative, data in files.items():
        path = safe_path(output_root, relative)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    return verify(output_root)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, help="Downloaded original official Voice.zip (20250113)")
    parser.add_argument("--repair-dir", type=Path, help="Directory containing unchanged M0598.mp3 and M0724.mp3")
    parser.add_argument("--output-root", type=Path, default=ROOT)
    parser.add_argument("--verify", action="store_true", help="Only verify existing imported assets, without downloads")
    args = parser.parse_args()
    try:
        if args.verify:
            count = verify(args.output_root)
        else:
            if args.archive is None or args.repair_dir is None:
                parser.error("--archive and --repair-dir are required to import")
            count = import_audio(args.archive, args.repair_dir, args.output_root)
    except (ValueError, OSError, zipfile.BadZipFile, KeyError) as error:
        parser.exit(1, f"CNS import failed: {error}\n")
    print(f"Verified {count} CNS11643 recordings (548 original MP3, nine PCM16 compatibility WAV), with exact-tone and u/ü separation.")


if __name__ == "__main__":
    main()
