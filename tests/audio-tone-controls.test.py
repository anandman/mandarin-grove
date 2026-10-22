"""Pitch interventions are acoustic controls, never native pronunciation gold."""
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / 'scripts/audio-tone-controls.py'


class ToneControlTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if SCRIPT.exists():
            spec = importlib.util.spec_from_file_location('audio_tone_controls', SCRIPT)
            cls.module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(cls.module)

    def required(self):
        self.assertTrue(SCRIPT.exists(), 'Physical tone-control generator is missing')
        return self.module

    def assert_shape(self, bins, tone):
        self.assertEqual(len(bins), 5)
        self.assertTrue(all(np.isfinite(bins)))
        if tone == 1:
            self.assertLess(max(bins) / min(bins), 1.08)
        elif tone == 2:
            self.assertGreater(bins[-1] / bins[0], 1.35)
            self.assertTrue(all(b > a for a, b in zip(bins, bins[1:])))
        elif tone == 3:
            self.assertLess(min(bins[1:3]) / bins[0], .9)
            self.assertGreater(bins[-1] / min(bins[1:3]), 1.4)
        else:
            self.assertGreater(bins[0] / bins[-1], 1.4)
            self.assertTrue(all(b < a for a, b in zip(bins, bins[1:])))

    def test_cli_generates_eight_distinct_hashed_unclipped_controls(self):
        module = self.required()
        with tempfile.TemporaryDirectory(prefix='grove-tone-controls-') as temp:
            folder = Path(temp) / 'output'
            result = subprocess.run([sys.executable, str(SCRIPT), '--out', str(folder)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            report = json.loads((folder / 'manifest.json').read_text())
            self.assertEqual(len(report['clips']), 8)
            self.assertEqual({c['pinyin'] for c in report['clips']}, {'shi1', 'shi2', 'shi3', 'shi4', 'yi1', 'yi2', 'yi3', 'yi4'})
            self.assertEqual(len({c['id'] for c in report['clips']}), 8)
            for source in ['失', '姨']:
                clips = [c for c in report['clips'] if c['text'] == source]
                self.assertEqual(len({c['sha256'] for c in clips}), 4)
            for clip in report['clips']:
                file = Path(clip['file'])
                self.assertTrue(file.is_absolute())
                self.assertEqual(file.parent, folder.resolve())
                self.assertRegex(clip['id'], '^[a-zA-Z0-9_-]+$')
                self.assertEqual(clip['sha256'], hashlib.sha256(file.read_bytes()).hexdigest())
                self.assertEqual(clip['expectedSha256'], clip['sha256'])
                self.assertEqual(clip['kind'], 'character')
                self.assertEqual(clip['role'], 'calibration')
                self.assertEqual(clip['availability'], 'available')
                calibration = clip['calibration']
                self.assertEqual(calibration.get('measuredAudioSha256'), clip['sha256'])
                self.assertFalse(calibration['nativeCorrectnessVerified'])
                self.assertEqual(calibration['component'], 'tone')
                source_bytes = (ROOT / 'audio' / (clip['text'] + '.mp3')).read_bytes()
                self.assertEqual(calibration['sourceSha256'], hashlib.sha256(source_bytes).hexdigest())
                samples, rate = module.acoustics.decode_audio(file)
                self.assertGreater(float(np.sqrt(np.mean(samples**2))), .005)
                self.assertLess(float(np.max(np.abs(samples))), .85)
                self.assertFalse(np.any(np.abs(samples) >= .999))
                self.assert_shape(calibration['measuredF0FiveBinsHz'], calibration['imposedTone'])
                # Remeasure the saved PCM independently of the manifest: a wrong
                # WAV write must fail even if the pre-quantization evidence is right.
                # NSDF can abstain on irregular PSOLA dip periods, so it is not a
                # complete reference measurement for this deliberately altered audio.
                sound = module.parselmouth.Sound(samples.mean(axis=1), rate)
                pitch = sound.to_pitch_ac(time_step=.005,
                                          pitch_floor=calibration['measurementPitchFloorHz'],
                                          pitch_ceiling=calibration['measurementPitchCeilingHz'])
                frequencies = pitch.selected_array['frequency']
                times = pitch.xs()
                left, right = calibration['voicedIntervalSeconds']
                measured = []
                for index in range(5):
                    start = left + (right - left) * index / 5
                    end = left + (right - left) * (index + 1) / 5
                    values = frequencies[(times >= start) & (times <= end) & (frequencies > 0)]
                    self.assertGreater(len(values), 0)
                    measured.append(float(np.median(values)))
                self.assert_shape(measured, calibration['imposedTone'])
                np.testing.assert_allclose(calibration['measuredF0Hz'], measured, rtol=0, atol=.000051)
                self.assertEqual(calibration['measuredF0Hz'], calibration['measuredF0FiveBinsHz'])

    def test_pitch_targets_adapt_to_source_voice_range(self):
        module = self.required()
        for frequency in [120, 350]:
            time = np.arange(24000) / 24000
            signal = .2 * np.sin(2 * np.pi * frequency * time)
            generated, measured = module.impose_contour(signal, 24000, 3)
            self.assert_shape(measured['measuredF0FiveBinsHz'], 3)
            self.assertAlmostEqual(measured['sourceMedianF0Hz'], frequency, delta=frequency * .04)
            self.assertGreater(float(np.max(np.abs(generated))), .1)
            self.assertLessEqual(float(np.max(np.abs(generated))), .801)

    def test_silence_nonfinite_and_invalid_tones_do_not_generate_controls(self):
        module = self.required()
        for samples, tone in [(np.zeros(24000), 1), (np.full(24000, np.nan), 2), (np.ones(24000), 0)]:
            with self.assertRaises(ValueError):
                module.impose_contour(samples, 24000, tone)

    def test_output_symlink_cannot_write_outside_requested_folder(self):
        module = self.required()
        with tempfile.TemporaryDirectory(prefix='grove-tone-boundary-') as temp:
            root = Path(temp)
            folder = root / 'output'
            folder.mkdir()
            sentinel = root / 'outside.wav'
            sentinel.write_bytes(b'untouched')
            (folder / 'control-shi-tone1.wav').symlink_to(sentinel)
            with self.assertRaises(ValueError):
                module.generate_controls(folder, ROOT / 'audio')
            self.assertEqual(sentinel.read_bytes(), b'untouched')
            self.assertFalse((folder / 'manifest.json').exists())

    def test_missing_source_fails_before_any_control_is_written(self):
        module = self.required()
        with tempfile.TemporaryDirectory(prefix='grove-tone-missing-') as temp:
            root = Path(temp)
            source = root / 'source'
            source.mkdir()
            with self.assertRaises(ValueError):
                module.generate_controls(root / 'output', source)
            self.assertFalse(list(root.rglob('*.wav')))


if __name__ == '__main__':
    unittest.main()
