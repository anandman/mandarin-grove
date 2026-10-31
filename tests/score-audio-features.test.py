"""Research scorer guard tests; no publisher weights or source audio required."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
import numpy as np

MODULE = Path(__file__).parents[1] / 'scripts/score-audio-features.py'


class ScoringTests(unittest.TestCase):
    def setUp(self):
        self.assertTrue(MODULE.exists(), 'Reproducible feature scorer is missing')
        spec = importlib.util.spec_from_file_location('scoring', MODULE)
        self.scorer = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.scorer)

    def test_ensemble_rejects_reordered_classes_and_invalid_probabilities(self):
        p = np.array([[.2, .8]])
        result = self.scorer.average_scores([(p, ['a', 'b']), (p, ['a', 'b'])])
        np.testing.assert_allclose(result, p)
        for parts in [[(p, ['a', 'b']), (p, ['b', 'a'])],
                      [(np.array([[.3, .8]]), ['a', 'b'])],
                      [(np.array([[np.nan, .8]]), ['a', 'b'])]]:
            with self.assertRaises(ValueError):
                self.scorer.average_scores(parts)

    def test_weight_integrity_is_checked_before_deserialization(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / 'model.pt').write_bytes(b'not trusted model bytes')
            with self.assertRaisesRegex(ValueError, 'hash|pinned'):
                self.scorer.checked_model_file(root, {'file': 'model.pt', 'sha256': '0'*64})
            with self.assertRaises(ValueError):
                self.scorer.checked_model_file(root, {'file': '../outside', 'sha256': '0'*64})

    def test_missing_pitch_cannot_appear_in_exported_tone_scores(self):
        rows = [{'id': 'one', 'sha256': 'a'*64}, {'id': 'two', 'sha256': 'b'*64}]
        parts = {name: (np.array([[.2, .8], [.4, .6]]), ['x', 'y'])
                 for name in ('initial', 'final', 'tone')}
        predictions = self.scorer.make_predictions(rows, parts, [True, False])
        self.assertEqual(predictions[0]['scores']['tone'], {'x': .2, 'y': .8})
        self.assertEqual(predictions[1]['scores']['tone'], {})
        self.assertEqual(predictions[1]['sha256'], 'b'*64)

    def test_output_is_exclusive_and_retains_prior_evidence(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / 'capture.json'
            self.scorer.write_new_json(path, {'first': True})
            with self.assertRaises(FileExistsError):
                self.scorer.write_new_json(path, {'first': False})
            self.assertIn('true', path.read_text())


if __name__ == '__main__':
    unittest.main()
