#!/usr/bin/env python3
"""Copy a separately reviewed MSU subset; this importer does not judge speech.

The full private archive stays private. Inputs must come from the documented
frozen evaluation and explicit recording-selection review. No network, synthesis,
trimming, resampling, volume or pitch changes are performed.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import zipfile

SOURCE_SHA256 = 'e2ced57c6bb5f48342dc7c72ff8b06d94dbe785895435ab8b3d7c2fb3e69843f'
ROOT = Path(__file__).resolve().parents[1]


def file_hash(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def import_subset(selection, archive_path, output_root, curriculum_keys):
    basis = selection.get('acceptanceBasis', 'qualified-component-method')
    source_reviewed = basis == 'native-source-review'
    review = selection.get('sourceReview', {})
    if source_reviewed:
        if (selection.get('methodQualified') is not False
                or not re.fullmatch(r'[a-f0-9]{64}', selection.get('ownerAuthorizationSha256', ''))
                or not isinstance(review, dict)
                or review.get('nativeReviewDocumented') is not True
                or review.get('productionPaperURL') != 'https://ideah.pubpub.org/pub/hh90jpsu/release/5'):
            raise ValueError('Source-reviewed release requires owner authorization and documented native curation; method remains unqualified')
    elif basis != 'qualified-component-method' or selection.get('methodQualified') is not True:
        raise ValueError('Expected a separately qualified method or explicit source-reviewed release')
    if (selection.get('schemaVersion') != 1 or selection.get('releaseApproved') is not True
            or selection.get('sourceArchiveSha256') != SOURCE_SHA256
            or file_hash(archive_path) != SOURCE_SHA256
            or any(not re.fullmatch(r'[a-f0-9]{64}', selection.get(key, ''))
                   for key in ('frozenMethodSha256', 'evaluationSha256'))):
        raise ValueError('Expected separately approved, hash-bound MSU subset')
    rows = selection['readings']
    if not 0 < len(rows) <= min(557, len(curriculum_keys)):
        raise ValueError('Only a finite curriculum subset may be imported')
    output_root = Path(output_root).resolve()
    assets, manifest_rows, hashes = {}, {}, set()
    with zipfile.ZipFile(archive_path) as archive:
        for row in rows:
            key, speaker = row['reading'], row['speaker']
            if (not re.fullmatch(r'[a-z]+[1-4]', key) or key not in curriculum_keys
                    or key in manifest_rows or speaker not in ('FV3', 'MV3')
                    or row['sourceId'] != key + '_' + speaker
                    or row['member'] != 'tone_perfect/' + row['sourceId'] + '_MP3.mp3'):
                raise ValueError('Unapproved reading, source speaker, duplicate or component evidence')
            components = row.get('components')
            if (not isinstance(components, dict) or set(components) != {'initial', 'final', 'tone'}
                    or any(v not in ('matches', 'abstained') for v in components.values())
                    or (not source_reviewed and any(v != 'matches' for v in components.values()))):
                raise ValueError('Incomplete or disputed component evidence for release basis')
            gap = row.get('originalSourceLexicalGap', False)
            exception = row.get('lexicalMetadataException')
            if not isinstance(gap, bool):
                raise ValueError('Original lexical-gap flag must be preserved explicitly')
            if gap and (key not in ('cuo4', 'she4', 'xing2', 'zuo3')
                        or not isinstance(exception, dict) or exception.get('reading') != key
                        or not re.fullmatch(r'[a-f0-9]{64}', exception.get('evidenceSha256', ''))
                        or not exception.get('schoolCharacters')
                        or not isinstance(exception['schoolCharacters'], list)
                        or any(not isinstance(c, str) or len(c) != 1 for c in exception['schoolCharacters'])):
                raise ValueError('Flagged source requires separately reviewed lexical evidence')
            if not gap and exception is not None:
                raise ValueError('Unexpected lexical metadata exception')
            info = archive.getinfo(row['member'])
            if not 0 < info.file_size <= 256000:
                raise ValueError('Unexpected source recording size')
            body = archive.read(row['member'])
            if hashlib.sha256(body).hexdigest() != row['sha256'] or row['sha256'] in hashes:
                raise ValueError('Source audio hash changed or duplicated across readings')
            hashes.add(row['sha256'])
            file = f"audio/msu-{key}-{speaker.lower()}-{row['sha256'][:12]}.mp3"
            assets[file] = body
            manifest_rows[key] = {'file': file, 'sha256': row['sha256'], 'bytes': len(body),
                                  'speaker': speaker, 'sourceId': row['sourceId'],
                                  'sourceMember': row['member'], 'processing': 'Unchanged original MP3 bytes',
                                  'originalSourceLexicalGap': gap, 'componentChecks': components,
                                  'automaticCheckStatus': 'components-match' if all(v == 'matches' for v in components.values()) else 'pending'}
            if exception is not None:
                manifest_rows[key]['lexicalMetadataException'] = exception
    manifest = {'schemaVersion': 1, 'source': {'title': 'Tone Perfect MP3 Dataset',
                'publisher': 'Michigan State University Libraries',
                'url': 'https://listings.lib.msu.edu/toneperfect/',
                'license': 'CC-BY-NC-4.0', 'licenseURL': 'https://creativecommons.org/licenses/by-nc/4.0/',
                'archiveSha256': SOURCE_SHA256},
                'verification': {'frozenMethodSha256': selection['frozenMethodSha256'],
                                 'evaluationSha256': selection['evaluationSha256'],
                                 'acceptanceBasis': basis,
                                 'methodQualified': selection['methodQualified'],
                                 'scope': 'Selected adult-source isolated Putonghua readings; not child-speech grading or connected-speech certification'},
                'readings': dict(sorted(manifest_rows.items())),
                'unsupported': sorted(set(curriculum_keys) - set(manifest_rows))}
    if source_reviewed:
        manifest['verification'].update(sourceReview=review, ownerAuthorizationSha256=selection['ownerAuthorizationSha256'])
    runtime = {'source': 'MSU Tone Perfect', 'acceptanceBasis': basis,
               'pendingReadings': [k for k, v in manifest['readings'].items() if v['automaticCheckStatus'] == 'pending'],
               'readings': {k: v['file'] for k, v in manifest['readings'].items()}}
    assets['audio-sources/mainland.json'] = (json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode()
    assets['mainland-pronunciations.js'] = ('// Selected original MSU recordings; source, checks and limits: audio-sources/mainland.json\nconst MAINLAND_AUDIO=' + json.dumps(runtime, ensure_ascii=False, indent=2) + ';\n').encode()
    # Validate every destination before creating any public file. Repeat imports
    # may reuse identical outputs, but never replace a changed or symlinked file.
    for relative, body in assets.items():
        destination = output_root / relative
        if (destination.is_symlink() or not destination.resolve().is_relative_to(output_root)
                or (destination.exists() and (not destination.is_file() or destination.read_bytes() != body))):
            raise ValueError('Refusing to replace existing source or output: ' + relative)
    for relative, body in assets.items():
        destination = output_root / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        if not destination.exists():
            with destination.open('xb') as stream:
                stream.write(body)
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--approved-selection', type=Path, required=True)
    parser.add_argument('--archive', type=Path, required=True)
    parser.add_argument('--output-root', type=Path, required=True)
    args = parser.parse_args()
    # Reuse the exact public curriculum reading keys; no source dictionary is imported.
    keys = set(json.loads((ROOT / 'audio-sources/cns11643.json').read_text())['readings'])
    manifest = import_subset(json.loads(args.approved_selection.read_text()), args.archive, args.output_root, keys)
    print(json.dumps({'selected': len(manifest['readings']), 'unsupported': len(manifest['unsupported'])}))


if __name__ == '__main__':
    main()
