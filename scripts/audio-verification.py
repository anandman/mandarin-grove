#!/usr/bin/env python3
"""Optional local acoustic research pipeline; never loaded by the student app.

Waveforms alone enter the encoder. Reference labels are used by the separate
evaluation/training stages, not feature extraction. Final-speaker extraction
requires a previously frozen pipeline/model/protocol identity. No verdict here
approves audio for publication.
"""
import argparse
import hashlib
import io
import json
import math
from pathlib import Path
import re
import zipfile

import numpy as np
import parselmouth


LAYERS = (6, 12, 18, 24)
FRAME_COUNT = 48
MAX_SECONDS = 3
MAX_BYTES = 32 * 1024 * 1024


def file_hash(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def validate_wave(samples, rate):
    samples = np.asarray(samples)
    if (samples.ndim != 1 or not 8000 <= rate <= 192000
            or not 0 < len(samples) <= MAX_SECONDS * rate
            or not np.isfinite(samples).all()):
        raise ValueError('Unsupported, excessive or non-finite audio dimensions')


def pitch_signature(samples, rate):
    """Unsmoothed AC/CC pitch, gaps and energy; no tone label or pitch repair."""
    samples = np.asarray(samples, dtype=np.float64)
    validate_wave(samples, rate)
    size = max(1, round(rate * .01))
    count = len(samples) // size
    if count < 5:
        raise ValueError('Insufficient active sound')
    levels = np.sqrt(np.mean(samples[:count * size].reshape(count, size)**2, axis=1))
    active = np.flatnonzero(levels >= max(.003, float(levels.max()) * .04))
    if len(active) < 5:
        raise ValueError('Insufficient active sound')
    left = max(0, (int(active[0]) - 2) * size)
    right = min(len(samples), (int(active[-1]) + 3) * size)
    samples = samples[left:right]
    sound = parselmouth.Sound(samples, rate)
    grid = np.linspace(0, len(samples) / rate, 40)
    features, medians = [], []
    for method in ('ac', 'cc'):
        pitch = getattr(sound, 'to_pitch_' + method)(time_step=.01, pitch_floor=40, pitch_ceiling=650)
        hz, times = pitch.selected_array['frequency'], pitch.xs()
        voiced = hz > 0
        sampled = np.interp(grid, times, hz, left=0, right=0)
        nearest = np.clip(np.rint((grid - pitch.x1) / pitch.dx).astype(int), 0, len(hz) - 1)
        mask = voiced[nearest] & (grid >= times[0]) & (grid <= times[-1])
        sampled[~mask] = np.nan
        features.extend((12 * np.log2(sampled)).tolist())
        features.extend(mask.astype(float).tolist())
        medians.append(float(np.median(12 * np.log2(hz[voiced]))) if voiced.any() else np.nan)
    rms = []
    for time in grid:
        position = round(time * rate)
        segment = samples[max(0, position - round(.015 * rate)):min(len(samples), position + round(.015 * rate))]
        rms.append(float(np.sqrt(np.mean(segment**2))) if len(segment) else 0)
    rms = np.array(rms)
    features.extend((rms / (rms.max() + 1e-12)).tolist())
    features.extend([len(samples) / rate, *medians])
    return np.array(features, dtype=np.float32)


def normalize_pitch(features, speakers):
    """Unlabelled reference-batch register normalization, not child calibration."""
    values = np.asarray(features, dtype=np.float32).copy()
    if values.ndim != 2 or values.shape[1] != 203 or len(speakers) != len(values):
        raise ValueError('Invalid pitch feature batch')
    stats = {}
    for speaker in sorted(set(speakers)):
        index = np.array([name == speaker for name in speakers])
        centre = np.nanmedian(values[index, -2:])
        scale = np.nanpercentile(values[index, :40], 90) - np.nanpercentile(values[index, :40], 10)
        if not np.isfinite(centre) or not np.isfinite(scale):
            raise ValueError('Insufficient voiced reference batch for speaker register')
        for left, right in ((0, 40), (80, 120)):
            values[index, left:right] = (values[index, left:right] - centre) / max(scale, 1)
        values[index, -2:] = (values[index, -2:] - centre) / max(scale, 1)
        stats[speaker] = {'centreSemitones': float(centre), 'rangeSemitones': float(scale)}
    return values, stats


def pitch_supported(signature):
    signature = np.asarray(signature)
    return bool(signature.shape == (203,) and np.isfinite(signature[-2:]).all()
                and np.count_nonzero(signature[40:80] > .5) >= 5
                and np.count_nonzero(signature[120:160] > .5) >= 5)


def normalize_hidden(sequences, speakers):
    """Preserve temporal phonetic detail; remove unlabelled speaker-channel bias."""
    sequences = np.asarray(sequences)
    if sequences.ndim != 4 or sequences.shape[1:] != (4, FRAME_COUNT, 1024) or len(speakers) != len(sequences):
        raise ValueError('Invalid phonetic feature batch')
    values = np.concatenate([sequences[:, 1], sequences[:, 3]], axis=2).transpose(0, 2, 1).astype(np.float32)
    if not np.isfinite(values).all():
        raise ValueError('Non-finite phonetic features')
    stats = {}
    for speaker in sorted(set(speakers)):
        index = np.array([name == speaker for name in speakers])
        centre = values[index].mean(axis=(0, 2), keepdims=True)
        values[index] -= centre
        stats[speaker] = {'clips': int(index.sum()), 'centreSha256': hashlib.sha256(centre.tobytes()).hexdigest()}
    return values, stats


def check_roles(speakers, stage, protocol, frozen, identity):
    """Run before opening source audio or loading model weights."""
    if stage not in ('training', 'calibration', 'final'):
        raise ValueError('Unknown research stage')
    sets = {name: set(protocol.get(name, [])) for name in ('training', 'calibration', 'final')}
    if any(sets[a] & sets[b] for a, b in (('training', 'calibration'), ('training', 'final'), ('calibration', 'final'))):
        raise ValueError('Speaker crosses protocol roles')
    if set(speakers) & sets['final']:
        if stage != 'final' or frozen != identity:
            raise ValueError('Final speakers require the matching frozen extraction identity')
    if not speakers or not set(speakers) <= sets[stage]:
        raise ValueError('Speaker is not assigned to this stage')


def check_source_speaker(row):
    """Catch accidental speaker relabeling before source audio is opened."""
    member = row.get('member', '')
    match = re.search(r'_(FV[123]|MV[123])_MP3\.mp3$', member)
    if match and row['speaker'] != 'MSU-' + match[1]:
        raise ValueError('Source member and declared speaker differ')
    match = re.match(r'(M(?:0[1-9]|1[0-5]))-[a-zvü:]+[1-5]-\d+-original\.wav$', Path(row.get('file', '')).name)
    if match and row['speaker'] != 'CASS-' + match[1]:
        raise ValueError('Source filename and declared speaker differ')


def check_final_scope(stage, frozen, manifest_hash):
    if stage == 'final' and (not frozen or manifest_hash not in frozen.get('sourceManifestSha256', [])):
        raise ValueError('Final extraction requires an exact frozen source scope')


def prepare_output(directory, identity, manifest_hash):
    directory = Path(directory)
    receipt = directory / 'verification-cache.json'
    expected = {'schemaVersion': 1, 'identity': identity, 'manifestSha256': manifest_hash}
    if directory.is_symlink() or (directory.exists() and not directory.is_dir()):
        raise ValueError('Output must be a generated cache directory')
    if directory.exists() and any(directory.iterdir()):
        if not receipt.is_file() or receipt.is_symlink() or receipt.stat().st_size > 65536:
            raise ValueError('Existing output directory is not this pipeline cache')
        if json.loads(receipt.read_text()) != expected:
            raise ValueError('Existing output cache identity differs; preserve it and use a new directory')
    else:
        directory.mkdir(parents=True, exist_ok=True)
        with receipt.open('x', encoding='utf-8') as stream:
            json.dump(expected, stream, indent=2)


def make_phonetic_head(initials, finals):
    import torch
    from torch import nn

    class PhoneticHead(nn.Module):
        def __init__(self):
            super().__init__()
            self.encoder = nn.Sequential(
                nn.Conv1d(2048, 256, 3, padding=1), nn.GroupNorm(16, 256), nn.GELU(), nn.Dropout(.15),
                nn.Conv1d(256, 192, 3, padding=1), nn.GroupNorm(12, 192), nn.GELU())
            self.attention = nn.ModuleDict({name: nn.Conv1d(192, 1, 1) for name in ('initial', 'final')})
            self.classify = nn.ModuleDict({name: nn.Sequential(
                nn.Linear(384, 128), nn.GELU(), nn.Dropout(.2), nn.Linear(128, count))
                for name, count in (('initial', initials), ('final', finals))})

        def forward(self, values):
            hidden = self.encoder(values)
            outputs = {}
            for name in ('initial', 'final'):
                attention = self.attention[name](hidden)
                if name == 'initial':
                    attention[:, :, 24:] = -1e4
                attention = attention.softmax(-1)
                mean = (hidden * attention).sum(-1)
                deviation = ((hidden - mean[:, :, None]).square() * attention).sum(-1).clamp_min(1e-6).sqrt()
                outputs[name] = self.classify[name](torch.cat([mean, deviation], 1))
            return outputs

    return PhoneticHead()


def extract_batch(model, extractor, waves, rates, device):
    import torch
    from scipy.signal import resample_poly

    resampled, signatures = [], []
    for samples, rate in zip(waves, rates):
        validate_wave(samples, rate)
        signatures.append(pitch_signature(samples, rate))
        divisor = math.gcd(rate, 16000)
        resampled.append(resample_poly(samples.astype(np.float32), 16000 // divisor, rate // divisor).astype(np.float32))
    inputs = extractor(resampled, sampling_rate=16000, return_tensors='pt', padding=True, return_attention_mask=True)
    with torch.inference_mode():
        result = model(input_values=inputs.input_values.to(device), attention_mask=inputs.attention_mask.to(device), output_hidden_states=True)
        posterior = result.logits.softmax(-1).cpu().numpy()
        states = [result.hidden_states[layer].cpu().numpy() for layer in LAYERS]
    output = []
    for index, samples in enumerate(resampled):
        valid = int(model._get_feat_extract_output_lengths(torch.tensor(len(samples))))
        active = np.flatnonzero(posterior[index, :valid, 1] < .5)
        if not len(active):
            raise ValueError('No active phonetic interval')
        grid = np.linspace(active[0], active[-1], FRAME_COUNT)
        sequence = []
        for state in states:
            hidden = state[index, :valid]
            left = np.floor(grid).astype(int)
            right = np.minimum(left + 1, valid - 1)
            weight = (grid - left)[:, None]
            sequence.append(hidden[left] * (1 - weight) + hidden[right] * weight)
        output.append({'sequence': np.array(sequence, dtype=np.float16), 'pitch': signatures[index]})
    return output


def load_encoder(directory, lock, device):
    from transformers import Wav2Vec2ForCTC, Wav2Vec2FeatureExtractor
    directory = Path(directory)
    for name in ('config.json', 'pytorch_model.bin'):
        if file_hash(directory / name) != lock['files'][name]['sha256']:
            raise ValueError('Encoder file differs from pinned publisher bytes')
    model, info = Wav2Vec2ForCTC.from_pretrained(
        directory, local_files_only=True, weights_only=True, trust_remote_code=False,
        output_loading_info=True, attn_implementation='eager', use_safetensors=False)
    if info['missing_keys'] or info['unexpected_keys']:
        raise ValueError('Encoder did not load all expected weights')
    extractor = Wav2Vec2FeatureExtractor(feature_size=1, sampling_rate=16000,
                                        padding_value=0, do_normalize=True, return_attention_mask=True)
    return model.eval().to(device), extractor


def extract_manifest(args):
    manifest = json.loads(args.manifest.read_text())
    protocol = json.loads(args.protocol.read_text())
    lock = json.loads(args.encoder_lock.read_text())
    identity = {'pipelineSha256': file_hash(__file__), 'encoderLockSha256': file_hash(args.encoder_lock),
                'protocolSha256': file_hash(args.protocol)}
    frozen = json.loads(args.frozen.read_text()) if args.frozen else None
    clips = manifest['clips']
    check_roles([row['speaker'] for row in clips], args.stage, protocol,
                frozen.get('extractionIdentity') if frozen else None, identity)
    check_final_scope(args.stage, frozen, file_hash(args.manifest))
    ids = set()
    for row in clips:
        check_source_speaker(row)
        if (not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,100}', row['id'])
                or row['id'] in ids or not re.fullmatch(r'[a-f0-9]{64}', row['sha256'])):
            raise ValueError('Invalid or duplicate source identity')
        ids.add(row['id'])
    prepare_output(args.output, identity, file_hash(args.manifest))
    # Source readers never extract archive paths onto disk. Every output is new.
    pending = []
    for row in clips:
        destination = args.output / (row['id'] + '.npz')
        if destination.exists():
            with np.load(destination, allow_pickle=False) as cached:
                if (str(cached['sourceSha256']) != row['sha256']
                        or str(cached['pipelineSha256']) != identity['pipelineSha256']
                        or str(cached['encoderLockSha256']) != identity['encoderLockSha256']):
                    raise ValueError('Existing feature cache differs; preserve it and use a new output directory')
        else:
            pending.append(row)
    if not pending:
        print(json.dumps({'total': len(clips), 'pending': 0, 'canPromote': False}))
        return
    import torch
    import soundfile as sf
    torch.set_num_threads(4)
    device = 'mps' if torch.backends.mps.is_available() else 'cpu'
    model, extractor = load_encoder(args.encoder_directory, lock, device)
    archives = {}
    try:
        for offset in range(0, len(pending), args.batch):
            batch = pending[offset:offset + args.batch]
            waves, rates = [], []
            for row in batch:
                if 'archive' in row:
                    key = (row['archive'], row['archiveSha256'])
                    if key not in archives:
                        if file_hash(row['archive']) != row['archiveSha256']:
                            raise ValueError('Source archive differs from manifest')
                        archives[key] = zipfile.ZipFile(row['archive'])
                    archive = archives[key]
                    if not 0 < archive.getinfo(row['member']).file_size <= MAX_BYTES:
                        raise ValueError('Source member exceeds input limit')
                    payload = archive.read(row['member'])
                else:
                    source = Path(row['file'])
                    if not 0 < source.stat().st_size <= MAX_BYTES:
                        raise ValueError('Source file exceeds input limit')
                    payload = source.read_bytes()
                if hashlib.sha256(payload).hexdigest() != row['sha256']:
                    raise ValueError('Source bytes differ from manifest')
                with sf.SoundFile(io.BytesIO(payload)) as source:
                    if (not 0 < source.frames <= MAX_SECONDS * source.samplerate
                            or not 8000 <= source.samplerate <= 192000 or not 1 <= source.channels <= 2):
                        raise ValueError('Unsupported decoded source dimensions')
                    samples = source.read(dtype='float64', always_2d=True)
                    if len(samples) != source.frames:
                        raise ValueError('Incomplete source decode')
                    waves.append(samples.mean(axis=1))
                    rates.append(source.samplerate)
            features = extract_batch(model, extractor, waves, rates, device)
            for row, feature in zip(batch, features):
                destination = args.output / (row['id'] + '.npz')
                with destination.open('xb') as stream:
                    np.savez_compressed(stream, **feature, sourceSha256=row['sha256'],
                                        pipelineSha256=identity['pipelineSha256'],
                                        encoderLockSha256=identity['encoderLockSha256'])
            if (offset + len(batch)) % 80 == 0 or offset + len(batch) == len(pending):
                print(json.dumps({'completed': offset + len(batch), 'total': len(pending), 'canPromote': False}), flush=True)
    finally:
        for archive in archives.values():
            archive.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', required=True, type=Path)
    parser.add_argument('--protocol', required=True, type=Path)
    parser.add_argument('--stage', required=True, choices=['training', 'calibration', 'final'])
    parser.add_argument('--encoder-directory', required=True, type=Path)
    parser.add_argument('--encoder-lock', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--frozen', type=Path)
    parser.add_argument('--batch', type=int, default=8, choices=range(1, 33))
    extract_manifest(parser.parse_args())


if __name__ == '__main__':
    main()
