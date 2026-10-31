"""Optional offline research tests; no model downloads or corpus audio required."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

import numpy as np

MODULE = Path(__file__).parents[1] / 'scripts/audio-verification.py'


class VerificationTests(unittest.TestCase):
    def setUp(self):
        self.assertTrue(MODULE.exists(), 'Reusable acoustic verification pipeline is missing')
        spec = importlib.util.spec_from_file_location('verification', MODULE)
        self.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.module)

    def test_pitch_measurements_retain_real_frequency_and_missing_voicing(self):
        rate = 16000
        t = np.arange(9600) / rate
        features = self.module.pitch_signature(.2 * np.sin(2 * np.pi * 180 * t), rate)
        self.assertEqual(features.shape, (203,))
        self.assertAlmostEqual(2**(features[-2] / 12), 180, delta=4)
        self.assertAlmostEqual(2**(features[-1] / 12), 180, delta=4)
        with self.assertRaises(ValueError):
            self.module.pitch_signature(np.zeros(9600), rate)

    def test_register_normalization_removes_shift_without_erasing_contour_or_gaps(self):
        base = np.zeros((4, 203), dtype=np.float32)
        base[:, :40] = np.linspace(70, 90, 40)
        base[:, 80:120] = np.linspace(70, 90, 40)
        base[:, -2:] = 80
        base[:, 0] = np.nan
        shifted = base.copy()
        shifted[:, :40] += 12
        shifted[:, 80:120] += 12
        shifted[:, -2:] += 12
        joined = np.concatenate([base, shifted])
        result, stats = self.module.normalize_pitch(joined, ['A']*4 + ['B']*4)
        np.testing.assert_allclose(result[:4], result[4:], equal_nan=True, atol=1e-6)
        self.assertGreater(result[0, 39], result[0, 1])
        self.assertTrue(np.isnan(result[0, 0]))
        self.assertEqual(set(stats), {'A', 'B'})
        np.testing.assert_allclose(joined[:4], base, equal_nan=True)

    def test_hidden_normalization_is_speaker_bias_invariant_and_preserves_input(self):
        random = np.random.default_rng(42)
        first = random.normal(size=(2, 4, 48, 1024)).astype(np.float16)
        # Integer bias is exactly representable for this controlled signal.
        first[:] = np.round(first)
        second = first + 2
        values = np.concatenate([first, second]);original = values.copy()
        result, stats = self.module.normalize_hidden(values, ['A', 'A', 'B', 'B'])
        self.assertEqual(result.shape, (4, 2048, 48))
        np.testing.assert_allclose(result[:2], result[2:], atol=1e-6)
        np.testing.assert_array_equal(values, original)
        self.assertEqual(set(stats), {'A', 'B'})

    def test_final_roles_are_checked_before_audio_or_models_are_opened(self):
        protocol = {'training': ['MSU-FV1'], 'calibration': ['CASS-M08'], 'final': ['MSU-FV3']}
        self.module.check_roles(['CASS-M08'], 'calibration', protocol, None, {'pipeline': 'a'})
        with self.assertRaisesRegex(ValueError, 'final|frozen'):
            self.module.check_roles(['MSU-FV3'], 'calibration', protocol, None, {'pipeline': 'a'})
        with self.assertRaisesRegex(ValueError, 'frozen'):
            self.module.check_roles(['MSU-FV3'], 'final', protocol, {'pipeline': 'b'}, {'pipeline': 'a'})
        self.module.check_roles(['MSU-FV3'], 'final', protocol, {'pipeline': 'a'}, {'pipeline': 'a'})
        with self.assertRaises(ValueError):
            self.module.check_roles(['unknown'], 'calibration', protocol, None, {'pipeline': 'a'})

    def test_audio_dimensions_and_nonfinite_input_fail_without_clipping_or_repair(self):
        for samples, rate in [(np.zeros(1600), 100), (np.zeros(64000), 16000),
                              (np.full(9600, np.nan), 16000)]:
            with self.assertRaises(ValueError):
                self.module.validate_wave(samples, rate)

    def test_source_speaker_mismatch_cannot_bypass_final_role_guard(self):
        self.module.check_source_speaker({'speaker': 'MSU-FV3', 'member': 'tone_perfect/ma1_FV3_MP3.mp3'})
        with self.assertRaisesRegex(ValueError, 'speaker'):
            self.module.check_source_speaker({'speaker': 'MSU-FV1', 'member': 'tone_perfect/ma1_FV3_MP3.mp3'})
        with self.assertRaisesRegex(ValueError, 'speaker'):
            self.module.check_source_speaker({'speaker': 'CASS-M04', 'file': '/private/wav/M06-ma1-123-original.wav'})

    def test_missing_pitch_cannot_become_a_confident_tone(self):
        missing = np.zeros(203, dtype=np.float32)
        missing[-2:] = np.nan
        self.assertFalse(self.module.pitch_supported(missing))
        measured = missing.copy()
        measured[40:80] = 1
        measured[120:160] = 1
        measured[-2:] = 90
        self.assertTrue(self.module.pitch_supported(measured))

    def test_output_cache_cannot_contaminate_or_replace_an_original_directory(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            original = root / 'original.mp3'
            original.write_bytes(b'preserve original')
            identity = {'pipelineSha256': 'one', 'encoderLockSha256': 'two'}
            with self.assertRaisesRegex(ValueError, 'output|directory|cache'):
                self.module.prepare_output(root, identity, 'manifest')
            self.assertEqual(original.read_bytes(), b'preserve original')
            output = root / 'generated'
            self.module.prepare_output(output, identity, 'manifest')
            self.module.prepare_output(output, identity, 'manifest')
            with self.assertRaises(ValueError):
                self.module.prepare_output(output, identity, 'changed-manifest')

    def test_temporal_head_uses_expected_shapes_without_reference_text(self):
        import torch
        torch.manual_seed(42)
        model = self.module.make_phonetic_head(22, 38).eval()
        with torch.inference_mode():
            result = model(torch.zeros(2, 2048, 48))
        self.assertEqual(tuple(result['initial'].shape), (2, 22))
        self.assertEqual(tuple(result['final'].shape), (2, 38))
        self.assertTrue(torch.isfinite(result['initial']).all())

    def test_final_extraction_checks_frozen_source_before_opening_audio(self):
        with self.assertRaisesRegex(ValueError, 'source|scope'):
            self.module.check_final_scope('final', {'sourceManifestSha256': ['a'*64]}, 'b'*64)
        self.module.check_final_scope('final', {'sourceManifestSha256': ['a'*64]}, 'a'*64)

    def test_encoder_explicitly_loads_the_hash_checked_weight_format(self):
        # The loader must not silently prefer an adjacent unpinned safetensors file.
        from unittest.mock import patch, MagicMock
        import hashlib
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            for name in ('config.json', 'pytorch_model.bin', 'model.safetensors'):
                (root / name).write_bytes(name.encode())
            lock = {'files': {name: {'sha256': hashlib.sha256(name.encode()).hexdigest()}
                              for name in ('config.json', 'pytorch_model.bin')}}
            with patch('transformers.Wav2Vec2ForCTC.from_pretrained',
                       return_value=(MagicMock(), {'missing_keys': [], 'unexpected_keys': []})) as load:
                self.module.load_encoder(root, lock, 'cpu')
                self.assertIs(load.call_args.kwargs.get('use_safetensors'), False)
                self.assertIs(load.call_args.kwargs.get('local_files_only'), True)
                self.assertIs(load.call_args.kwargs.get('weights_only'), True)


if __name__ == '__main__':
    unittest.main()
