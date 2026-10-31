#!/usr/bin/env python3
"""Offline signal diagnostics, without text or expected pronunciation as input.

Usage: python3 scripts/audio-acoustics.py FILE [FILE ...]
Writes one JSON report to stdout. File failures are included and do not stop the
batch. Requires NumPy and libsndfile (system library or soundfile wheel).
F0 confidence measures periodicity, not the probability of correct Mandarin.
No signal result approves pronunciation, phonemes, lexical tones or sandhi.
"""
import argparse
import ctypes
import ctypes.util
import hashlib
import json
from pathlib import Path

import numpy as np

SETTINGS = {
    'frameSeconds': 0.060,
    'hopSeconds': 0.010,
    'minHz': 60,
    'maxHz': 600,
    'minimumPeriodicity': 0.80,
    'relativePeakThreshold': 0.90,
    'minimumFrameRms': 0.003,
    'relativeFrameRms': 0.08,
    'clippedAmplitude': 0.999,
    'maxDurationSeconds': 30,
    'maxFileBytes': 32 * 1024 * 1024,
    'maxDecodedSamples': 10_000_000,
}


class SFInfo(ctypes.Structure):
    _fields_ = [('frames', ctypes.c_int64), ('samplerate', ctypes.c_int),
                ('channels', ctypes.c_int), ('format', ctypes.c_int),
                ('sections', ctypes.c_int), ('seekable', ctypes.c_int)]


def decode_audio(path):
    """Decode a bounded audio file; always close a successfully opened handle."""
    name = ctypes.util.find_library('sndfile')
    if not name:
        # macOS wheels can include libsndfile without registering a system dylib.
        # Keep the same allocation limits before asking that decoder for samples.
        try:
            import soundfile
        except ImportError as exc:
            raise RuntimeError('Install soundfile or a system libsndfile') from exc
        with soundfile.SoundFile(str(path)) as stream:
            if not (8000 <= stream.samplerate <= 192000 and 1 <= stream.channels <= 8 and stream.frames > 0):
                raise ValueError('Unsupported or invalid decoded audio dimensions')
            if (stream.frames / stream.samplerate > SETTINGS['maxDurationSeconds']
                    or stream.frames * stream.channels > SETTINGS['maxDecodedSamples']):
                raise ValueError('Decoded audio exceeds the local analysis limit')
            samples = stream.read(dtype='float32', always_2d=True)
            if len(samples) != stream.frames:
                raise ValueError('Audio decoding did not complete successfully')
            return samples, stream.samplerate
    library = ctypes.CDLL(name)
    library.sf_open.argtypes = [ctypes.c_char_p, ctypes.c_int, ctypes.POINTER(SFInfo)]
    library.sf_open.restype = ctypes.c_void_p
    library.sf_readf_float.argtypes = [ctypes.c_void_p, ctypes.POINTER(ctypes.c_float), ctypes.c_int64]
    library.sf_readf_float.restype = ctypes.c_int64
    library.sf_close.argtypes = [ctypes.c_void_p]
    library.sf_close.restype = ctypes.c_int
    library.sf_error.argtypes = [ctypes.c_void_p]
    library.sf_error.restype = ctypes.c_int
    info = SFInfo()
    handle = library.sf_open(bytes(path), 0x10, ctypes.byref(info))
    if not handle:
        raise ValueError('Audio decoder could not open this file or codec')
    try:
        if not (8000 <= info.samplerate <= 192000 and 1 <= info.channels <= 8 and info.frames > 0):
            raise ValueError('Unsupported or invalid decoded audio dimensions')
        if (info.frames / info.samplerate > SETTINGS['maxDurationSeconds']
                or info.frames * info.channels > SETTINGS['maxDecodedSamples']):
            raise ValueError('Decoded audio exceeds the local analysis limit')
        samples = np.empty((info.frames, info.channels), dtype=np.float32)
        count = library.sf_readf_float(handle, samples.ctypes.data_as(ctypes.POINTER(ctypes.c_float)), info.frames)
        if count <= 0 or library.sf_error(handle):
            raise ValueError('Audio decoding did not complete successfully')
        return samples[:count], info.samplerate
    finally:
        library.sf_close(handle)


def periodicity_pitch(frame, sample_rate):
    """Normalized square-difference periodicity peaks, with parabolic lag fit.

    The first strong positive peak after the first zero crossing limits common
    subharmonic choices. Creaky voice, multiple speakers and octave ambiguity can
    still defeat this estimator. No contour smoothing or target correction runs.
    """
    frame = np.asarray(frame, dtype=np.float64)
    frame = frame - np.mean(frame)
    size = len(frame)
    transform_size = 1 << (2 * size - 1).bit_length()
    spectrum = np.fft.rfft(frame, n=transform_size)
    correlation = np.fft.irfft(spectrum * np.conj(spectrum), n=transform_size)[:size]
    energies = np.concatenate(([0.0], np.cumsum(frame * frame)))
    last = min(int(sample_rate / SETTINGS['minHz']), size - 2)
    first = max(2, int(np.ceil(sample_rate / SETTINGS['maxHz'])))
    if last <= first:
        return None, 0.0
    lags = np.arange(last + 2)
    denominator = energies[size - lags] + energies[size] - energies[lags]
    nsdf = np.divide(2 * correlation[:last + 2], denominator,
                     out=np.zeros(last + 2), where=denominator > 1e-15)
    nsdf = np.clip(nsdf, -1, 1)
    crossings = np.flatnonzero(nsdf <= 0)
    if not len(crossings):
        return None, 0.0
    first = max(first, int(crossings[0]) + 1)
    peaks = [lag for lag in range(first, last + 1)
             if nsdf[lag] >= nsdf[lag - 1] and nsdf[lag] > nsdf[lag + 1]]
    if not peaks:
        return None, 0.0
    best = float(max(nsdf[lag] for lag in peaks))
    threshold = max(SETTINGS['minimumPeriodicity'], best * SETTINGS['relativePeakThreshold'])
    eligible = [lag for lag in peaks if nsdf[lag] >= threshold]
    if not eligible:
        return None, max(0.0, best)
    lag = eligible[0]
    left, middle, right = nsdf[lag - 1:lag + 2]
    curvature = left - 2 * middle + right
    adjustment = float(0.5 * (left - right) / curvature) if abs(curvature) > 1e-12 else 0.0
    adjustment = float(np.clip(adjustment, -0.5, 0.5))
    frequency = float(sample_rate / (lag + adjustment))
    if not SETTINGS['minHz'] <= frequency <= SETTINGS['maxHz']:
        return None, float(middle)
    return frequency, float(middle)


def analyze_signal(samples, sample_rate):
    """Return waveform quality and unsmoothed absolute F0, never tone labels."""
    samples = np.asarray(samples, dtype=np.float64)
    if samples.ndim == 1:
        samples = samples[:, None]
    if samples.ndim != 2 or not samples.size or not 8000 <= sample_rate <= 192000:
        raise ValueError('A nonempty audio signal and supported sample rate are required')
    if not np.all(np.isfinite(samples)):
        raise ValueError('Audio contains non-finite samples')
    if samples.shape[0] / sample_rate > SETTINGS['maxDurationSeconds'] or samples.size > SETTINGS['maxDecodedSamples']:
        raise ValueError('Audio exceeds the local analysis limit')
    mono = np.mean(samples, axis=1)
    duration = len(mono) / sample_rate
    rms = float(np.sqrt(np.mean(samples * samples)))
    peak = float(np.max(np.abs(samples)))
    clipped = float(np.mean(np.abs(samples) >= SETTINGS['clippedAmplitude']))
    frame_size = round(SETTINGS['frameSeconds'] * sample_rate)
    hop = round(SETTINGS['hopSeconds'] * sample_rate)
    starts = list(range(0, len(mono) - frame_size + 1, hop))
    levels = [float(np.sqrt(np.mean(mono[start:start + frame_size]**2))) for start in starts]
    rms_gate = max(SETTINGS['minimumFrameRms'], max(levels, default=0) * SETTINGS['relativeFrameRms'])
    frames = []
    for start, level in zip(starts, levels):
        frequency, confidence = periodicity_pitch(mono[start:start + frame_size], sample_rate) if level >= rms_gate else (None, 0.0)
        frames.append({'timeSeconds': round((start + frame_size / 2) / sample_rate, 6),
                       'hz': round(frequency, 4) if frequency is not None else None,
                       'confidence': round(confidence, 6), 'voiced': frequency is not None,
                       'rms': round(level, 8)})
    voiced = [frame for frame in frames if frame['voiced']]
    coverage = len(voiced) / len(frames) if frames else 0.0
    flags = []
    if rms < 1e-5:
        flags.append('silent')
    if rms < SETTINGS['minimumFrameRms']:
        flags.append('low_level')
    if duration < 0.12:
        flags.append('too_short')
    if clipped >= 0.001:
        flags.append('clipping')
    if len(voiced) < 3 or coverage < 0.1:
        flags.append('insufficient_voicing')
    if any(abs(12 * np.log2(right['hz'] / left['hz'])) > 8
           for left, right in zip(frames, frames[1:]) if left['voiced'] and right['voiced']):
        flags.append('large_pitch_jump')
    if samples.shape[1] > 1 and rms > .001 and float(np.sqrt(np.mean(mono**2))) < .1 * rms:
        flags.append('channel_cancellation')
    return {'durationSeconds': round(duration, 6), 'sampleRate': int(sample_rate), 'channels': samples.shape[1],
            'signal': {'rms': round(rms, 8), 'peak': round(peak, 8), 'clippedFraction': round(clipped, 8),
                       'silenceFraction': round(sum(level < SETTINGS['minimumFrameRms'] for level in levels) / len(levels), 6) if levels else None,
                       'silenceMeasurement': 'fraction of analysis frames below minimumFrameRms'},
            'f0': {'frames': frames, 'voicedCoverage': round(coverage, 6),
                   'medianHz': round(float(np.median([frame['hz'] for frame in voiced])), 4) if voiced else None,
                   'medianConfidence': round(float(np.median([frame['confidence'] for frame in voiced])), 6) if voiced else None,
                   'confidenceMeaning': 'normalized periodicity, not pronunciation correctness'},
            'flags': flags}


def analyze_file(path):
    path = Path(path)
    result = {'path': str(path), 'status': 'error'}
    try:
        if path.stat().st_size > SETTINGS['maxFileBytes']:
            raise ValueError('Audio file exceeds the local analysis byte limit')
        result['sha256'] = hashlib.sha256(path.read_bytes()).hexdigest()
        samples, sample_rate = decode_audio(path)
        result.update(analyze_signal(samples, sample_rate))
        result['status'] = 'ok'
    except (OSError, ValueError, RuntimeError) as error:
        result['error'] = str(error)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('paths', nargs='+', help='Local audio files; each produces an ok/error result')
    args = parser.parse_args()
    report = {'schemaVersion': 1, 'method': 'normalized-square-difference-periodicity-v1',
              'limitations': 'Signal diagnostics only. No phoneme, lexical-tone, sandhi or pronunciation approval. F0 can contain octave errors.',
              'settings': SETTINGS, 'files': [analyze_file(path) for path in args.paths]}
    print(json.dumps(report, ensure_ascii=False, allow_nan=False))


if __name__ == '__main__':
    main()
