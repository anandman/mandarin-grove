#!/usr/bin/env python3
"""Create eight offline acoustic pitch controls from bundled 失 and 姨 audio.

Usage: python3 scripts/audio-tone-controls.py --out FOLDER [--audio-dir FOLDER]
Optional local dependencies: NumPy, praat-parselmouth, and system libsndfile.
This changes pitch with Praat overlap-add synthesis; it does not establish native
pronunciation, initial/final correctness, lexical tone quality, or release approval.
No recognizer, model weights, network request or paid service is used.
"""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import wave

import numpy as np

try:
    import parselmouth
    from parselmouth.praat import call
except ImportError:
    parselmouth = None

ROOT = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location('audio_acoustics_for_controls', ROOT / 'scripts/audio-acoustics.py')
acoustics = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(acoustics)

METHOD = 'praat-pitch-tier-overlap-add-v1'
LIMITATIONS = ('Physical F0 interventions only. The contours are not native-speaker verified '
               'Mandarin pronunciation references. Initials, finals, duration and voice quality '
               'can contain artifacts; no generated control approves an audio candidate.')
SOURCES = [('失', 'shi', 'shi1'), ('姨', 'yi', 'yi2')]
# Time fractions and pitch ratios relative to the source's voiced median F0.
PROFILES = {1: ([0., 1.], [1.15, 1.15]),
            2: ([0., 1.], [.70, 1.30]),
            3: ([0., .45, 1.], [.85, .55, 1.15]),
            4: ([0., 1.], [1.40, .65])}


def _measure_bins(sound, start, end, floor, ceiling):
    measurement = sound.to_pitch_ac(time_step=.005, pitch_floor=floor, pitch_ceiling=ceiling)
    measured = measurement.selected_array['frequency']
    times = measurement.xs()
    bins = []
    for index in range(5):
        left = start + (end - start) * index / 5
        right = start + (end - start) * (index + 1) / 5
        mask = (times >= left) & (times <= right) & (measured > 0)
        if not np.any(mask):
            raise ValueError('A generated control has an unmeasurable pitch interval')
        value = float(np.median(measured[mask]))
        if not np.isfinite(value) or value <= 0:
            raise ValueError('A generated control has an invalid pitch interval')
        bins.append(round(value, 4))
    return bins


def impose_contour(samples, sample_rate, tone):
    """Return mono samples plus measured evidence for a physical F0 intervention."""
    if parselmouth is None:
        raise ValueError('Tone-control generation requires optional praat-parselmouth; install it in a local Python environment')
    if not isinstance(tone, int) or isinstance(tone, bool) or tone not in PROFILES:
        raise ValueError('The imposed contour must be an integer from 1 to 4')
    values = np.asarray(samples, dtype=np.float64)
    if values.ndim == 2 and 1 <= values.shape[1] <= 8:
        values = values.mean(axis=1)
    if (values.ndim != 1 or not values.size or not np.all(np.isfinite(values))
            or not 8000 <= sample_rate <= 192000
            or not .12 <= len(values) / sample_rate <= 30
            or values.size > acoustics.SETTINGS['maxDecodedSamples']):
        raise ValueError('A finite, bounded audio signal and supported sample rate are required')
    if float(np.sqrt(np.mean(values**2))) < 1e-5:
        raise ValueError('The source is silent')
    sound = parselmouth.Sound(values, sample_rate)
    pitch = sound.to_pitch_ac(time_step=.005, pitch_floor=50, pitch_ceiling=1200)
    frequencies = pitch.selected_array['frequency']
    voiced = frequencies > 0
    if np.count_nonzero(voiced) < 6:
        raise ValueError('The source has insufficient measurable voicing')
    start, end = float(pitch.xs()[voiced][0]), float(pitch.xs()[voiced][-1])
    if end - start < .10:
        raise ValueError('The source voiced interval is too short for a contour')
    baseline = float(np.median(frequencies[voiced]))
    floor, ceiling = max(30., baseline * .25), min(1800., max(300., baseline * 3.))
    manipulation = call(sound, 'To Manipulation', .005, floor, ceiling)
    tier = call('Create PitchTier', 'physical-control', sound.xmin, sound.xmax)
    fractions, ratios = PROFILES[tone]
    for fraction, ratio in zip(fractions, ratios):
        call(tier, 'Add point', start + fraction * (end - start), baseline * ratio)
    call([tier, manipulation], 'Replace pitch tier')
    changed = call(manipulation, 'Get resynthesis (overlap-add)')
    changed.scale_peak(.8)
    output = changed.values[0].copy()
    bins = _measure_bins(changed, start, end, floor, ceiling)
    if not np.all(np.isfinite(output)) or float(np.sqrt(np.mean(output**2))) < .001:
        raise ValueError('Pitch manipulation returned invalid or silent audio')
    return output, {'component': 'tone', 'imposedTone': tone, 'method': METHOD,
                    'sourceMedianF0Hz': round(baseline, 4),
                    'voicedIntervalSeconds': [round(start, 6), round(end, 6)],
                    'imposedTimeFractions': fractions, 'imposedF0Ratios': ratios,
                    'measuredF0Hz': bins, 'measuredF0FiveBinsHz': bins,
                    'measurementPitchFloorHz': floor, 'measurementPitchCeilingHz': ceiling,
                    'measurementMethod': 'Praat raw autocorrelation; median in five equal time bins',
                    'nativeCorrectnessVerified': False, 'limitations': LIMITATIONS}


def _output_path(folder, name):
    destination = folder / name
    if destination.resolve().parent != folder or (destination.exists() and not destination.is_file()):
        raise ValueError('A control output path escapes the requested folder or is not a file')
    return destination


def _write_wav(destination, samples, sample_rate):
    with tempfile.NamedTemporaryFile(dir=destination.parent, suffix='.wav', delete=False) as temporary:
        temporary_path = Path(temporary.name)
    try:
        with wave.open(str(temporary_path), 'wb') as output:
            output.setnchannels(1)
            output.setsampwidth(2)
            output.setframerate(sample_rate)
            output.writeframes(np.rint(samples * 32767).astype('<i2').tobytes())
        os.replace(temporary_path, destination)
    finally:
        temporary_path.unlink(missing_ok=True)


def generate_controls(out, audio_dir=ROOT / 'audio'):
    """Preflight fixed local source/output paths and write eight hashed controls."""
    folder, source_folder = Path(out).resolve(), Path(audio_dir).resolve()
    sources = []
    for text, pinyin_base, original_pinyin in SOURCES:
        file = source_folder / (text + '.mp3')
        if file.resolve().parent != source_folder or not file.is_file():
            raise ValueError('Missing or escaped calibration source: ' + file.name)
        if file.stat().st_size > acoustics.SETTINGS['maxFileBytes']:
            raise ValueError('A calibration source exceeds the local byte limit')
        sha256 = hashlib.sha256(file.read_bytes()).hexdigest()
        samples, sample_rate = acoustics.decode_audio(file)
        sources.append((text, pinyin_base, original_pinyin, sha256, samples, sample_rate))
    folder.mkdir(parents=True, exist_ok=True)
    # Check every destination before touching any existing output.
    for _, base, _, _, _, _ in sources:
        for tone in range(1, 5):
            _output_path(folder, f'control-{base}-tone{tone}.wav')
    manifest_path = _output_path(folder, 'manifest.json')
    prepared = []
    for text, base, original_pinyin, source_sha256, samples, rate in sources:
        for tone in range(1, 5):
            changed, evidence = impose_contour(samples, rate, tone)
            evidence.update(sourceSha256=source_sha256, sourceText=text, sourcePinyin=original_pinyin)
            prepared.append((text, base, tone, source_sha256, changed, rate, evidence))
    clips = []
    for text, base, tone, source_sha256, samples, rate, evidence in prepared:
        destination = _output_path(folder, f'control-{base}-tone{tone}.wav')
        _write_wav(destination, samples, rate)
        sha256 = hashlib.sha256(destination.read_bytes()).hexdigest()
        # Bind the measurement to the encoded PCM bytes that the assessor receives,
        # rather than to the in-memory signal before WAV quantization.
        saved_samples, saved_rate = acoustics.decode_audio(destination)
        saved_sound = parselmouth.Sound(saved_samples.mean(axis=1), saved_rate)
        start, end = evidence['voicedIntervalSeconds']
        measured = _measure_bins(saved_sound, start, end, evidence['measurementPitchFloorHz'],
                                 evidence['measurementPitchCeilingHz'])
        if hashlib.sha256(destination.read_bytes()).hexdigest() != sha256:
            raise ValueError('A generated WAV changed during pitch measurement')
        evidence.update(measuredF0Hz=measured, measuredF0FiveBinsHz=measured,
                        measuredAudioSha256=sha256, measurementStage='saved-pcm')
        clips.append({'id': f'physical-{base}-tone{tone}-{sha256[:16]}',
                      'text': text, 'pinyin': base + str(tone), 'kind': 'character',
                      'file': str(destination), 'sha256': sha256, 'expectedSha256': sha256,
                      'role': 'calibration', 'availability': 'available', 'calibration': evidence})
    manifest = {'schemaVersion': 1, 'method': METHOD, 'limitations': LIMITATIONS, 'clips': clips}
    with tempfile.NamedTemporaryFile(dir=folder, suffix='.json', mode='w', encoding='utf-8', delete=False) as temporary:
        temporary_path = Path(temporary.name)
        json.dump(manifest, temporary, ensure_ascii=False, allow_nan=False, indent=2)
        temporary.write('\n')
    try:
        os.replace(temporary_path, manifest_path)
    finally:
        temporary_path.unlink(missing_ok=True)
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', required=True, help='Folder for eight WAV controls and manifest.json')
    parser.add_argument('--audio-dir', type=Path, default=ROOT / 'audio', help='Folder containing source 失.mp3 and 姨.mp3')
    args = parser.parse_args()
    try:
        manifest = generate_controls(args.out, args.audio_dir)
    except (OSError, ValueError, RuntimeError) as error:
        parser.exit(1, 'Tone-control generation failed: ' + str(error) + '\n')
    print(json.dumps({'clips': len(manifest['clips']), 'manifest': str(Path(args.out).resolve() / 'manifest.json'),
                      'limitations': LIMITATIONS}, ensure_ascii=False))


if __name__ == '__main__':
    main()
