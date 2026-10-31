"""Synthetic archives only: no licensed corpus or learner data required."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zipfile


MODULE = Path(__file__).parents[1] / 'scripts/audio-msu-inventory.py'


class InventoryTests(unittest.TestCase):
    def setUp(self):
        self.assertTrue(MODULE.exists(), 'MSU inventory implementation is missing')
        spec = importlib.util.spec_from_file_location('msu_inventory', MODULE)
        self.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.module)
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def run_inventory(self, rows, audio=None, curriculum=('lv4', 'lu4', 'ma5')):
        audio = audio if audio is not None else [(f'{key}_MP3.mp3', payload) for key, _, payload in rows]
        with zipfile.ZipFile(self.root / 'xml.zip', 'w') as archive:
            for key, fields, _ in rows:
                values = {'identifier': key, 'syllable': key.split('_')[0],
                          'sound': key.split('_')[0][:-1], 'tone': key.split('_')[0][-1],
                          'speaker': key.split('_')[1], 'lexical_gap': 'No', **fields}
                xml = '<custom>' + ''.join(f'<{k}>{v}</{k}>' for k, v in values.items()) + '</custom>'
                archive.writestr(f'xml/{key}_CUSTOM.xml', xml)
                archive.writestr(f'xml/{key}_DC.xml', '<dc/>')
        with zipfile.ZipFile(self.root / 'audio.zip', 'w') as archive:
            for name, payload in audio:
                archive.writestr('audio/' + name, payload)
        return self.module.inventory(self.root / 'audio.zip', self.root / 'xml.zip', curriculum)

    def test_umlaut_is_distinct_and_neutral_is_a_gap_without_approval(self):
        r = self.run_inventory([('lv4_FV1', {}, b'one'), ('lu4_FV1', {}, b'two')])
        self.assertEqual(r['errors'], [])
        self.assertEqual(r['coverage']['missing'], ['ma5'])
        self.assertEqual(r['coverage']['available']['lv4'], ['lv4_FV1'])
        self.assertEqual(r['coverage']['available']['lu4'], ['lu4_FV1'])
        self.assertFalse(r['canPromote'])

    def test_canonical_umlaut_spelling_does_not_drop_diaeresis(self):
        self.assertEqual(self.module.reading_key('LÜE4'), 'lve4')
        self.assertEqual(self.module.reading_key('lu:4'), 'lv4')
        with self.assertRaises(ValueError):
            self.module.reading_key('lǜ')

    def test_conflicting_identity_and_tone_are_quarantined(self):
        r = self.run_inventory([('lv4_FV1', {'identifier': 'lu4_FV1'}, b'one'),
                                ('lu4_FV1', {'tone': '3'}, b'two')])
        self.assertEqual(len(r['errors']), 2)
        self.assertEqual(r['coverage']['available'], {})

    def test_lexical_gap_is_reported_and_not_accepted_as_curriculum_reference(self):
        r = self.run_inventory([('lv4_FV1', {'lexical_gap': 'Yes'}, b'one')])
        self.assertEqual(r['lexicalGapClips'], 1)
        self.assertNotIn('lv4', r['coverage']['available'])
        self.assertEqual(r['coverage']['lexicalGapOnly'], ['lv4'])

    def test_missing_empty_orphan_and_duplicate_member_are_visible(self):
        rows = [('lv4_FV1', {}, b'one'), ('lu4_FV1', {}, b'two')]
        r = self.run_inventory(rows, [('lv4_FV1_MP3.mp3', b''), ('ma1_FV1_MP3.mp3', b'x')])
        codes = [e['code'] for e in r['errors']]
        self.assertIn('empty_audio', codes)
        self.assertIn('missing_audio', codes)
        self.assertIn('orphan_audio', codes)
        self.assertEqual(r['coverage']['available'], {})
        r = self.run_inventory(rows, [('lv4_FV1_MP3.mp3', b'x'), ('lv4_FV1_MP3.mp3', b'y')])
        self.assertIn('duplicate_member', [e['code'] for e in r['errors']])
        self.assertNotIn('lv4', r['coverage']['available'])

    def test_cross_reading_identical_audio_is_quarantined(self):
        r = self.run_inventory([('lv4_FV1', {}, b'same'), ('lu4_FV2', {}, b'same')])
        self.assertEqual(len(r['crossReadingDuplicates']), 1)
        self.assertEqual(r['coverage']['available'], {})

    def test_invalid_xml_and_duplicate_metadata_are_not_silently_used(self):
        r = self.run_inventory([('lv4_FV1', {}, b'one'), ('lv4_FV1', {}, b'two')])
        self.assertIn('duplicate_member', [e['code'] for e in r['errors']])
        self.assertEqual(r['coverage']['available'], {})
        with zipfile.ZipFile(self.root / 'xml.zip', 'w') as archive:
            archive.writestr('xml/lv4_FV1_CUSTOM.xml', '<broken')
        r = self.module.inventory(self.root / 'audio.zip', self.root / 'xml.zip', ['lv4'])
        self.assertIn('invalid_metadata', [e['code'] for e in r['errors']])
        self.assertEqual(r['coverage']['available'], {})

    def test_utf16_dtd_and_entities_are_quarantined_by_parser(self):
        self.run_inventory([('lv4_FV1', {}, b'one')])
        xml = ('<?xml version="1.0" encoding="UTF-16"?>'
               '<!DOCTYPE custom [<!ENTITY word "lv4">]><custom>'
               '<identifier>lv4_FV1</identifier><syllable>&word;</syllable>'
               '<sound>lv</sound><tone>4</tone><speaker>FV1</speaker>'
               '<lexical_gap>No</lexical_gap></custom>')
        with zipfile.ZipFile(self.root / 'xml.zip', 'w') as archive:
            archive.writestr('xml/lv4_FV1_CUSTOM.xml', xml.encode('utf-16'))
        r = self.module.inventory(self.root / 'audio.zip', self.root / 'xml.zip', ['lv4'])
        self.assertEqual(r['coverage']['available'], {})
        self.assertIn('invalid_metadata', [e['code'] for e in r['errors']])

    def test_cli_never_overwrites_inputs_existing_reports_or_aliases(self):
        self.run_inventory([('lv4_FV1', {}, b'one')])
        (self.root / 'curriculum.json').write_text(json.dumps({'readings': {'lv4': {}}}))
        original = {p: p.read_bytes() for p in self.root.iterdir()}
        (self.root / 'symlink.zip').symlink_to(self.root / 'audio.zip')
        os.link(self.root / 'audio.zip', self.root / 'hardlink.zip')
        (self.root / 'existing-report.json').write_text('preserve earlier report')
        for output in ['audio.zip', 'xml.zip', 'curriculum.json', 'symlink.zip',
                       'hardlink.zip', 'existing-report.json']:
            before = (self.root / output).read_bytes()
            result = subprocess.run([sys.executable, str(MODULE), '--audio-zip', str(self.root / 'audio.zip'),
                                     '--xml-zip', str(self.root / 'xml.zip'), '--curriculum',
                                     str(self.root / 'curriculum.json'), '--output', str(self.root / output)],
                                    capture_output=True)
            self.assertNotEqual(result.returncode, 0, output)
            self.assertEqual((self.root / output).read_bytes(), before, output)
        for path, payload in original.items():
            self.assertEqual(path.read_bytes(), payload)


if __name__ == '__main__':
    unittest.main()
