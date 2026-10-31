#!/usr/bin/env python3
"""Private ZIP decode/signal QA; never extracts pitch or approves pronunciation.

Optional release-research dependencies: numpy and soundfile (libsndfile).
Input inventory must match the original ZIP SHA256. Reports remain private.
"""
import argparse
from collections import Counter, defaultdict
import hashlib
import io
import json
from pathlib import Path
import zipfile

import numpy as np
import soundfile as sf


def measure(payload):
    with sf.SoundFile(io.BytesIO(payload)) as stream:
        if not (8000 <= stream.samplerate <= 192000 and 1 <= stream.channels <= 8
                and 0 < stream.frames <= 30 * stream.samplerate
                and stream.frames * stream.channels <= 10_000_000):
            raise ValueError('Unsupported or excessive decoded dimensions')
        rate = stream.samplerate
        samples = stream.read(dtype='float32', always_2d=True)
        if len(samples) != stream.frames or not np.isfinite(samples).all():
            raise ValueError('Incomplete or non-finite decode')
    mono = samples.mean(axis=1)
    rms = float(np.sqrt(np.mean(samples.astype(np.float64)**2)))
    mono_rms = float(np.sqrt(np.mean(mono.astype(np.float64)**2)))
    peak = float(np.abs(samples).max())
    clipped = float(np.mean(np.abs(samples) >= .999))
    flags = []
    if rms < 1e-5:
        flags.append('silent')
    if rms < .003:
        flags.append('low_level')
    if len(samples) / rate < .12:
        flags.append('too_short')
    if clipped >= .001:
        flags.append('clipping')
    if samples.shape[1] > 1 and rms > .001 and mono_rms < .1 * rms:
        flags.append('channel_cancellation')
    return {'sampleRate': rate, 'channels': samples.shape[1], 'frames': len(samples),
            'durationSeconds': len(samples) / rate, 'rms': rms, 'peak': peak,
            'clippedFraction': clipped, 'flags': flags,
            'decodedSha256': hashlib.sha256(samples.astype('<f4').tobytes()).hexdigest()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--audio-zip', required=True, type=Path)
    parser.add_argument('--inventory', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    if args.output.exists() or args.output.is_symlink():
        parser.error('Output must be a new file; inputs and earlier reports are preserved')
    manifest = json.loads(args.inventory.read_text())
    with args.audio_zip.open('rb') as stream:
        digest = hashlib.file_digest(stream, 'sha256').hexdigest()
    if digest != manifest['sources']['audioZipSha256']:
        raise ValueError('Audio archive differs from inventory')
    records, skipped = [], []
    with zipfile.ZipFile(args.audio_zip) as archive:
        for clip in manifest['clips']:
            if not clip['usableMetadata']:
                skipped.append({'id': clip['id'], 'reason': 'quarantined or incomplete inventory metadata'})
                continue
            record = {'id': clip['id'], 'reading': clip['reading'], 'speaker': clip['speaker'],
                      'sha256': clip['sha256']}
            try:
                member = archive.getinfo(clip['audioMember'])
                if not 0 < member.file_size <= 32 * 1024 * 1024:
                    raise ValueError('Audio exceeds input limit')
                payload = archive.read(member)
                if hashlib.sha256(payload).hexdigest() != clip['sha256']:
                    raise ValueError('Member differs from inventory')
                record.update(measure(payload), status='ok')
            except (ValueError, RuntimeError, KeyError, zipfile.BadZipFile) as exc:
                record.update(status='error', error=str(exc))
            records.append(record)
    groups = defaultdict(list)
    for record in records:
        if record['status'] == 'ok':
            groups[(record['sampleRate'], record['channels'], record['decodedSha256'])].append(record['id'])
    duplicate_groups = [ids for ids in groups.values() if len(ids) > 1]
    report = {'schemaVersion': 1, 'canPromote': False, 'audioZipSha256': digest,
              'limitations': 'Decode/waveform diagnostics only. No phoneme, lexical-tone or locale verdict.',
              'decoder': {'soundfile': sf.__version__, 'libsndfile': sf.__libsndfile_version__, 'numpy': np.__version__},
              'records': records, 'skipped': skipped, 'decodedDuplicateGroups': duplicate_groups,
              'summary': {'inventoryClips': len(manifest['clips']), 'skipped': len(skipped),
                          'inventoryErrors': len(manifest.get('errors', [])),
                          'total': len(records), 'errors': sum(r['status'] != 'ok' for r in records),
                          'flags': dict(Counter(flag for r in records for flag in r.get('flags', []))),
                          'decodedDuplicateGroups': len(duplicate_groups)}}
    with args.output.open('x', encoding='utf-8') as output:
        output.write(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False) + '\n')
    print(json.dumps(report['summary']))
    return 1 if report['summary']['errors'] or report['summary']['inventoryErrors'] or skipped else 0


if __name__ == '__main__':
    raise SystemExit(main())
