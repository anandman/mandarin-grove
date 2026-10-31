"""Optional reference-research head: independent temporal segment and tone paths."""
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location('audio_verification', Path(__file__).with_name('audio-verification.py'))
core = importlib.util.module_from_spec(spec)
spec.loader.exec_module(core)


def make_component_head(initials, finals, tones):
    from torch import nn

    class ComponentHead(nn.Module):
        def __init__(self):
            super().__init__()
            self.phonetic = core.make_phonetic_head(initials, finals)
            prototype = core.make_phonetic_head(1, tones)
            self.tone_encoder = prototype.encoder
            self.tone_attention = prototype.attention['final']
            self.tone_classifier = prototype.classify['final']

        def forward(self, values):
            outputs = self.phonetic(values)
            hidden = self.tone_encoder(values)
            attention = self.tone_attention(hidden).softmax(-1)
            mean = (hidden * attention).sum(-1)
            deviation = ((hidden - mean[:, :, None]).square() * attention).sum(-1).clamp_min(1e-6).sqrt()
            import torch
            outputs['tone'] = self.tone_classifier(torch.cat([mean, deviation], 1))
            return outputs

    return ComponentHead()
