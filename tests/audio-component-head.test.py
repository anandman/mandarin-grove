"""Separate segment and tone heads share audio inputs, never expected text."""
import importlib.util
from pathlib import Path
import unittest

MODULE = Path(__file__).parents[1] / 'scripts/audio-component-head.py'


class ComponentHeadTests(unittest.TestCase):
    def test_three_component_shapes_and_independent_trainable_tone_path(self):
        self.assertTrue(MODULE.exists(), 'Three-component temporal head is missing')
        spec = importlib.util.spec_from_file_location('component_head', MODULE)
        module = importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        import torch
        torch.manual_seed(42)
        model = module.make_component_head(22,38,4)
        outputs=model(torch.randn(2,2048,48))
        self.assertEqual(set(outputs),{'initial','final','tone'})
        self.assertEqual(outputs['tone'].shape,(2,4))
        before=model.phonetic.encoder[0].weight.detach().clone()
        outputs['tone'].square().mean().backward()
        self.assertIsNone(model.phonetic.encoder[0].weight.grad)
        self.assertTrue(torch.isfinite(model.tone_encoder[0].weight.grad).all())
        self.assertTrue(torch.equal(before,model.phonetic.encoder[0].weight))


if __name__ == '__main__':unittest.main()
