import importlib.util
import io
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zipfile

import numpy as np
import soundfile as sf


class SignalTests(unittest.TestCase):
    def setUp(self):
        path = Path(__file__).parents[1] / 'scripts/audio-msu-signals.py'
        self.assertTrue(path.exists(), 'MSU decode/signal implementation is missing')
        spec = importlib.util.spec_from_file_location('msu_signals', path)
        self.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.module)

    def wav(self, samples):
        output = io.BytesIO()
        sf.write(output, samples, 16000, format='WAV', subtype='FLOAT')
        return output.getvalue()

    def test_clean_signal_is_measured_without_any_pronunciation_verdict(self):
        samples = .2 * np.sin(2 * np.pi * 220 * np.arange(8000) / 16000)
        r = self.module.measure(self.wav(samples))
        self.assertEqual(r['flags'], [])
        self.assertAlmostEqual(r['durationSeconds'], .5)
        self.assertAlmostEqual(r['peak'], .2, places=5)
        self.assertEqual(r['channels'], 1)
        self.assertNotIn('tone', r)
        self.assertNotIn('correct', r)

    def test_silence_clipping_and_channel_cancellation_remain_flagged(self):
        self.assertIn('silent', self.module.measure(self.wav(np.zeros(8000)))['flags'])
        self.assertIn('clipping', self.module.measure(self.wav(np.ones(8000)))['flags'])
        s = .2 * np.sin(2 * np.pi * 200 * np.arange(8000) / 16000)
        self.assertIn('channel_cancellation', self.module.measure(self.wav(np.stack([s, -s], axis=1)))['flags'])

    def test_bad_nonfinite_and_unbounded_signals_are_rejected(self):
        with self.assertRaises((ValueError, RuntimeError)):
            self.module.measure(b'not audio')
        with self.assertRaises(ValueError):
            self.module.measure(self.wav(np.full(8000, np.nan)))
        with self.assertRaises(ValueError):
            self.module.measure(self.wav(np.zeros(31 * 16000)))

    def cli_fixture(self, root, usable=True):
        payload = self.wav(.2 * np.sin(2 * np.pi * 220 * np.arange(8000) / 16000))
        archive = root / 'audio.zip'
        with zipfile.ZipFile(archive, 'w') as stream:
            stream.writestr('audio/lv4_FV1_MP3.mp3', payload)
        inventory = {'sources': {'audioZipSha256': hashlib.sha256(archive.read_bytes()).hexdigest()},
                     'errors': [], 'clips': [{'id': 'lv4_FV1', 'reading': 'lv4', 'speaker': 'FV1',
                     'audioMember': 'audio/lv4_FV1_MP3.mp3', 'sha256': hashlib.sha256(payload).hexdigest(),
                     'usableMetadata': usable}]}
        (root / 'inventory.json').write_text(json.dumps(inventory))

    def run_cli(self, root, output):
        return subprocess.run([sys.executable, str(Path(self.module.__file__)), '--audio-zip',
                               str(root / 'audio.zip'), '--inventory', str(root / 'inventory.json'),
                               '--output', str(output)], capture_output=True)

    def test_cli_preserves_all_inputs_and_existing_reports_including_aliases(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.cli_fixture(root)
            (root / 'alias.zip').symlink_to(root / 'audio.zip')
            os.link(root / 'audio.zip', root / 'hardlink.zip')
            (root / 'previous.json').write_text('earlier results')
            originals = {p: p.read_bytes() for p in root.iterdir()}
            for target in originals:
                self.assertNotEqual(self.run_cli(root, target).returncode, 0, target)
                self.assertEqual(target.read_bytes(), originals[target])
            result = self.run_cli(root, root / 'new-report.json')
            self.assertEqual(result.returncode, 0, result.stderr)

    def test_excluded_metadata_has_explicit_denominators_and_incomplete_status(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.cli_fixture(root, usable=False)
            result = self.run_cli(root, root / 'report.json')
            self.assertNotEqual(result.returncode, 0)
            report = json.loads((root / 'report.json').read_text())
            self.assertEqual(report['summary']['inventoryClips'], 1)
            self.assertEqual(report['summary']['skipped'], 1)
            self.assertEqual(report['summary']['total'], 0)
            self.assertEqual(report['skipped'][0]['id'], 'lv4_FV1')


if __name__ == '__main__':
    unittest.main()
