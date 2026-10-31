#!/usr/bin/env python3
"""Inventory private MSU Tone Perfect ZIPs without extracting or approving audio.

Stdlib only. Full reports stay private; this tool never copies corpus files into
the application. Metadata agreement and hashes are not acoustic verification.
"""
import argparse
from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path
import re
import unicodedata
import xml.etree.ElementTree as ET
import zipfile


SPEAKERS = {'FV1', 'FV2', 'FV3', 'MV1', 'MV2', 'MV3'}
MAX_AUDIO_BYTES = 32 * 1024 * 1024
MAX_XML_BYTES = 256 * 1024


class NoDTDTreeBuilder(ET.TreeBuilder):
    def doctype(self, name, pubid, system):
        raise ValueError('DTD/entity declarations are unsupported')


def reading_key(value):
    value = unicodedata.normalize('NFC', value).lower().replace('u:', 'v').replace('ü', 'v')
    if not re.fullmatch(r'[a-z]+[1-5]', value):
        raise ValueError('Expected numbered pinyin; diacritics are not silently inferred')
    return value


def sha256_file(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def inventory(audio_zip, xml_zip, curriculum):
    requested = sorted({reading_key(key) for key in curriculum})
    errors, clips, blocked = [], {}, set()

    def error(code, identifier, detail=None):
        entry = {'code': code, 'id': identifier}
        if detail is not None:
            entry['detail'] = detail
        errors.append(entry)
        blocked.add(identifier)

    def members(archive, suffix):
        found = {}
        for item in archive.infolist():
            if item.is_dir() or not item.filename.endswith(suffix):
                continue
            identifier = Path(item.filename).name[:-len(suffix)]
            if identifier in found:
                error('duplicate_member', identifier, item.filename)
            else:
                found[identifier] = item
        return found

    with zipfile.ZipFile(audio_zip) as audio, zipfile.ZipFile(xml_zip) as metadata:
        audio_members = members(audio, '_MP3.mp3')
        xml_members = members(metadata, '_CUSTOM.xml')
        for identifier, member in sorted(xml_members.items()):
            try:
                if member.file_size > MAX_XML_BYTES:
                    raise ValueError('XML exceeds analysis limit')
                payload = metadata.read(member)
                # Parser-level rejection also covers UTF-16/32 declarations.
                root = ET.fromstring(payload, parser=ET.XMLParser(target=NoDTDTreeBuilder()))
                fields = {}
                for key in ('identifier', 'syllable', 'sound', 'tone', 'speaker', 'lexical_gap'):
                    matches = root.findall(key)
                    if len(matches) != 1 or not matches[0].text:
                        raise ValueError(f'Expected one nonempty {key}')
                    fields[key] = matches[0].text.strip()
                reading = reading_key(fields['syllable'])
                expected = f"{fields['syllable']}_{fields['speaker']}"
                if (root.tag != 'custom' or fields['identifier'] != identifier or expected != identifier
                        or fields['speaker'] not in SPEAKERS or reading[-1] not in '1234'
                        or fields['tone'] != reading[-1]
                        or reading_key(fields['sound'] + fields['tone']) != reading
                        or fields['lexical_gap'] not in ('Yes', 'No')):
                    raise ValueError('Filename, identifier, reading, speaker or tone conflicts')
                clips[identifier] = {
                    'id': identifier, 'reading': reading, 'speaker': fields['speaker'],
                    'lexicalGap': fields['lexical_gap'] == 'Yes', 'xmlMember': member.filename,
                    'xmlSha256': hashlib.sha256(payload).hexdigest(),
                }
            except (ValueError, ET.ParseError, zipfile.BadZipFile, RuntimeError) as exc:
                error('invalid_metadata', identifier, str(exc))

        hashes = defaultdict(list)
        for identifier, member in sorted(audio_members.items()):
            if identifier not in xml_members:
                error('orphan_audio', identifier)
            if member.file_size == 0:
                error('empty_audio', identifier)
                continue
            if member.file_size > MAX_AUDIO_BYTES:
                error('oversize_audio', identifier)
                continue
            try:
                payload = audio.read(member)  # zipfile verifies CRC on complete reads.
            except (zipfile.BadZipFile, RuntimeError) as exc:
                error('unreadable_audio', identifier, str(exc))
                continue
            if identifier in clips:
                digest = hashlib.sha256(payload).hexdigest()
                clips[identifier].update(audioMember=member.filename, bytes=len(payload), sha256=digest)
                hashes[digest].append(identifier)
        for identifier in sorted(xml_members.keys() - audio_members.keys()):
            error('missing_audio', identifier)

    duplicates = []
    same_reading_duplicates = []
    for digest, identifiers in sorted(hashes.items()):
        if len(identifiers) < 2:
            continue
        group = {'sha256': digest, 'ids': sorted(identifiers)}
        if len({clips[key]['reading'] for key in identifiers}) > 1:
            duplicates.append(group)
            for key in identifiers:
                error('cross_reading_duplicate', key)
        else:
            same_reading_duplicates.append(group)

    available, gaps = defaultdict(list), defaultdict(list)
    for identifier, clip in sorted(clips.items()):
        clip['usableMetadata'] = identifier not in blocked and 'sha256' in clip
        if clip['usableMetadata']:
            (gaps if clip['lexicalGap'] else available)[clip['reading']].append(identifier)
    coverage = {key: available[key] for key in requested if key in available}
    return {
        'schemaVersion': 1, 'canPromote': False,
        'limitations': 'Source inventory only. No acoustic, phoneme, tone, locale or release approval.',
        'sources': {'audioZipSha256': sha256_file(audio_zip), 'xmlZipSha256': sha256_file(xml_zip)},
        'audioMembers': len(audio_members), 'metadataMembers': len(xml_members),
        'speakers': dict(sorted(Counter(c['speaker'] for c in clips.values()).items())),
        'lexicalGapClips': sum(c['lexicalGap'] for c in clips.values()),
        'coverage': {'requested': len(requested), 'covered': len(coverage), 'available': coverage,
                     'missing': [key for key in requested if key not in available],
                     'lexicalGapOnly': [key for key in requested if key not in available and key in gaps]},
        'errors': errors, 'crossReadingDuplicates': duplicates,
        'sameReadingDuplicates': same_reading_duplicates,
        'clips': list(clips.values()),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--audio-zip', required=True, type=Path)
    parser.add_argument('--xml-zip', required=True, type=Path)
    parser.add_argument('--curriculum', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    if args.output.exists() or args.output.is_symlink():
        parser.error('Output must be a new file; inputs and earlier reports are preserved')
    report = inventory(args.audio_zip, args.xml_zip, json.loads(args.curriculum.read_text())['readings'])
    # Exclusive creation prevents aliases/races from replacing any existing file.
    with args.output.open('x', encoding='utf-8') as output:
        output.write(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({key: report[key] for key in ('canPromote', 'audioMembers', 'metadataMembers', 'speakers',
                                                  'lexicalGapClips')}))
    print(json.dumps({'covered': report['coverage']['covered'], 'missing': report['coverage']['missing'],
                      'lexicalGapOnly': report['coverage']['lexicalGapOnly'], 'errors': len(report['errors'])}))
    return 1 if report['errors'] else 0


if __name__ == '__main__':
    raise SystemExit(main())
