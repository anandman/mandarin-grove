"""Signal-level checks; synthetic signals are not pronunciation references."""
import importlib.util
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import wave

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/audio-acoustics.py"


class AcousticsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if SCRIPT.exists():
            spec = importlib.util.spec_from_file_location("audio_acoustics", SCRIPT)
            cls.module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(cls.module)

    def module_required(self):
        self.assertTrue(SCRIPT.exists(), "Offline acoustic diagnostics are not implemented")
        return self.module

    def signal(self, start=180, end=None, duration=0.6, amplitude=0.3, rate=24000):
        time = np.arange(round(duration * rate)) / rate
        end = start if end is None else end
        phase = 2 * np.pi * (start * time + (end - start) * time**2 / (2 * duration))
        return amplitude * np.sin(phase)

    def voiced(self, report):
        return [frame for frame in report['f0']['frames'] if frame['voiced']]

    def test_absolute_pitch_retains_hz_without_target_reading(self):
        module = self.module_required()
        for frequency in [85, 180, 390]:
            result = module.analyze_signal(self.signal(frequency), 24000)
            voiced = self.voiced(result)
            self.assertGreater(len(voiced), 30)
            self.assertAlmostEqual(float(np.median([f['hz'] for f in voiced])), frequency, delta=frequency * 0.02)
            self.assertGreater(result['f0']['voicedCoverage'], 0.9)
            self.assertGreater(result['f0']['medianConfidence'], 0.95)

    def test_chirps_preserve_rising_and_falling_contours(self):
        module = self.module_required()
        for start, end in [(120, 250), (250, 120)]:
            voiced = self.voiced(module.analyze_signal(self.signal(start, end), 24000))
            self.assertGreater(len(voiced), 20)
            first = float(np.median([f['hz'] for f in voiced[:5]]))
            last = float(np.median([f['hz'] for f in voiced[-5:]]))
            self.assertGreater((last - first) * (end - start), 6000)
            for frame in voiced:
                expected = start + (end - start) * frame['timeSeconds'] / 0.6
                self.assertAlmostEqual(frame['hz'], expected, delta=expected * 0.06)

    def test_harmonics_do_not_replace_fundamental_or_invent_contour(self):
        module = self.module_required()
        signal = self.signal(180, amplitude=.18) + self.signal(360, amplitude=.3)
        result = module.analyze_signal(signal, 24000)
        self.assertAlmostEqual(result['f0']['medianHz'], 180, delta=4)
        self.assertNotIn('large_pitch_jump', result['flags'])

    def test_silence_noise_short_and_clipped_signals_are_explicit(self):
        module = self.module_required()
        silence = module.analyze_signal(np.zeros(24000), 24000)
        self.assertIn('silent', silence['flags'])
        self.assertEqual(silence['f0']['voicedCoverage'], 0)
        self.assertEqual(silence['f0']['medianHz'], None)
        noise = module.analyze_signal(np.random.default_rng(42).normal(0, .1, 24000), 24000)
        self.assertLess(noise['f0']['voicedCoverage'], .05)
        self.assertIn('insufficient_voicing', noise['flags'])
        short = module.analyze_signal(self.signal(duration=.02), 24000)
        self.assertIn('too_short', short['flags'])
        self.assertEqual(self.voiced(short), [])
        clipped = module.analyze_signal(np.clip(self.signal(amplitude=1.5), -1, 1), 24000)
        self.assertIn('clipping', clipped['flags'])
        self.assertGreater(clipped['signal']['clippedFraction'], .1)

    def test_native_mp3_decoder_handles_real_bundled_audio(self):
        module = self.module_required()
        report = module.analyze_file(ROOT / 'audio/满.mp3')
        self.assertEqual(report['status'], 'ok')
        self.assertEqual(report['sha256'], hashlib.sha256((ROOT / 'audio/满.mp3').read_bytes()).hexdigest())
        self.assertEqual(report['sampleRate'], 24000)
        self.assertAlmostEqual(report['durationSeconds'], .912, delta=.05)
        self.assertGreater(report['signal']['rms'], .01)
        self.assertGreater(len(report['f0']['frames']), 20)
        self.assertNotIn('approved', json.dumps(report))

    def test_cli_continues_after_missing_and_invalid_files(self):
        self.module_required()
        with tempfile.TemporaryDirectory(prefix='grove-acoustics-') as temp:
            folder = Path(temp)
            invalid = folder / 'invalid.mp3'
            invalid.write_text('not audio')
            wav = folder / 'sine.wav'
            with wave.open(str(wav), 'wb') as output:
                output.setnchannels(1)
                output.setsampwidth(2)
                output.setframerate(24000)
                output.writeframes((self.signal() * 32767).astype('<i2').tobytes())
            result = subprocess.run([sys.executable, str(SCRIPT), str(folder / 'missing.mp3'), str(invalid), str(wav)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            report = json.loads(result.stdout)
            self.assertEqual([f['status'] for f in report['files']], ['error', 'error', 'ok'])
            self.assertIn('error', report['files'][0])
            self.assertAlmostEqual(report['files'][2]['f0']['medianHz'], 180, delta=4)
            self.assertEqual(report['schemaVersion'], 1)


if __name__ == '__main__':
    unittest.main()
