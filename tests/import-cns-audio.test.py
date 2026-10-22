"""Compatibility conversions must preserve the source speech samples and timing."""
import importlib.util
import io
from pathlib import Path
import struct
import unittest
import wave

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("cns_import", ROOT / "scripts/import-cns-audio.py")
cns = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cns)


def source_wav(samples, rate=48000, channels=1):
    pcm = struct.pack("<" + "f" * len(samples), *samples)
    fmt = struct.pack("<HHIIHH", 3, channels, rate, rate * channels * 4, channels * 4, 32)
    body = b"WAVEfmt " + struct.pack("<I", len(fmt)) + fmt + b"data" + struct.pack("<I", len(pcm)) + pcm
    return b"RIFF" + struct.pack("<I", len(body)) + body


class ConversionTests(unittest.TestCase):
    def test_float_conversion_preserves_count_rate_and_quantized_amplitude(self):
        original = source_wav([-1, -.5, 0, .5, 1])
        self.assertTrue(hasattr(cns, "float_wav_to_pcm16"), "a verified PCM16 compatibility converter is required")
        converted, meta = cns.float_wav_to_pcm16(original)
        with wave.open(io.BytesIO(converted), "rb") as audio:
            self.assertEqual((audio.getframerate(), audio.getnchannels(), audio.getnframes(), audio.getsampwidth()), (48000, 1, 5, 2))
            self.assertEqual(struct.unpack("<5h", audio.readframes(5)), (-32768, -16384, 0, 16384, 32767))
        self.assertEqual(meta["sourceSha256"], cns.sha256(original))
        self.assertEqual(meta["sampleFrames"], 5)
        self.assertEqual(meta["sampleRateHz"], 48000)
        self.assertEqual(converted, cns.float_wav_to_pcm16(original)[0])

    def test_invalid_floats_or_unexpected_channels_are_rejected(self):
        self.assertTrue(hasattr(cns, "float_wav_to_pcm16"), "source format validation is required")
        for samples, channels in [([float("nan")], 1), ([float("inf")], 1), ([1.1], 1), ([0, 0], 2)]:
            with self.subTest(samples=samples, channels=channels), self.assertRaises(ValueError):
                cns.float_wav_to_pcm16(source_wav(samples, channels=channels))

    def test_unsafe_output_symlinks_are_rejected(self):
        import tempfile
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder) / "root"
            root.mkdir()
            (root / "audio").symlink_to(Path(folder), target_is_directory=True)
            with self.assertRaises(ValueError):
                cns.safe_path(root, "audio/cns-ni3.mp3")

    def test_reading_keys_preserve_all_five_tones_and_u_umlaut(self):
        self.assertEqual([cns.reading_key(p) for p in ["nǔ", "nǚ", "lù", "lǜ", "de", "mān", "nü3"]],
                         ["nu3", "nv3", "lu4", "lv4", "de5", "man1", "nv3"])


if __name__ == "__main__":
    unittest.main()
