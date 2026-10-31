#!/usr/bin/env python3
"""Score pinned local reference features, without passing expected text to models.

Optional research tooling. Joblib models must be locally trained, trusted and
hash-pinned before loading; a hash is integrity evidence, not a trust decision.
The complete reference-speaker batches are part of the declared experiment.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

import numpy as np

PIPELINE = Path(__file__).with_name('audio-verification.py')
spec = importlib.util.spec_from_file_location('audio_verification', PIPELINE)
core = importlib.util.module_from_spec(spec)
spec.loader.exec_module(core)


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def average_scores(parts):
    if not parts:
        raise ValueError('No ensemble predictions')
    classes = list(parts[0][1])
    if not classes or len(set(classes)) != len(classes):
        raise ValueError('Invalid class legend')
    shape = np.asarray(parts[0][0]).shape
    values = []
    for scores, labels in parts:
        scores = np.asarray(scores, dtype=np.float64)
        if (list(labels) != classes or scores.ndim != 2 or scores.shape != shape
                or scores.shape[1] != len(classes) or not np.isfinite(scores).all()
                or np.any(scores < 0) or np.any(scores > 1)
                or not np.allclose(scores.sum(axis=1), 1, atol=1e-5, rtol=0)):
            raise ValueError('Inconsistent classes or invalid probability scores')
        values.append(scores)
    return np.mean(values, axis=0)


def checked_model_file(root, entry):
    relative = Path(entry['file'])
    root = Path(root).resolve()
    if relative.is_absolute() or '..' in relative.parts:
        raise ValueError('Model path must be inside its pinned bundle')
    path = (root / relative).resolve()
    if not path.is_relative_to(root) or core.file_hash(path) != entry['sha256']:
        raise ValueError('Model hash differs from pinned local training bytes')
    return path


def make_predictions(rows, parts, supported):
    if len(supported) != len(rows):
        raise ValueError('Pitch support count differs')
    for scores, classes in parts.values():
        average_scores([(scores, classes)])
        if len(scores) != len(rows):
            raise ValueError('Prediction count differs')
    return [{'clipId': row['id'], 'sha256': row['sha256'], 'scores': {
        name: ({str(label): float(value) for label, value in zip(classes, scores[i])}
               if name != 'tone' or supported[i] else {})
        for name, (scores, classes) in parts.items()}}
        for i, row in enumerate(rows)]


def write_new_json(path, value):
    with Path(path).open('x', encoding='utf-8') as stream:
        json.dump(value, stream, indent=2, allow_nan=False)
        stream.write('\n')


def score(args):
    manifest = json.loads(args.manifest.read_text())
    protocol = json.loads(args.protocol.read_text())
    bundle = json.loads(args.bundle.read_text())
    rows = manifest['clips']
    extraction = {'pipelineSha256': core.file_hash(PIPELINE),
                  'encoderLockSha256': bundle['encoderLockSha256'],
                  'protocolSha256': core.file_hash(args.protocol)}
    scoring = {'scorerSha256': core.file_hash(__file__), 'bundleSha256': core.file_hash(args.bundle),
               'extractionIdentity': extraction}
    frozen = json.loads(args.frozen.read_text()) if args.frozen else None
    core.check_roles([r['speaker'] for r in rows], args.stage, protocol,
                     frozen.get('extractionIdentity') if frozen else None, extraction)
    if args.stage == 'final':
        if frozen.get('scoringIdentity') != scoring or core.file_hash(args.manifest) not in frozen['sourceManifestSha256']:
            raise ValueError('Final scoring requires frozen model, source and pipeline identities')
    if set(bundle['fittedSpeakers']) != set(protocol['training']):
        raise ValueError('Fitted speaker list differs from training protocol')
    if set(bundle['fittedSpeakers']) & {r['speaker'] for r in rows}:
        raise ValueError('Evaluation speaker was used to fit the models')
    if bundle['featurePipelineSha256'] != extraction['pipelineSha256']:
        raise ValueError('Bundle feature pipeline differs')
    receipt = json.loads((args.cache / 'verification-cache.json').read_text())
    if receipt['identity'] != extraction or receipt['manifestSha256'] != core.file_hash(args.manifest):
        raise ValueError('Feature cache does not represent this complete declared source batch')
    paths = {entry['id']: checked_model_file(args.bundle.parent, entry)
             for entry in bundle['phoneticModels'] + bundle['toneModels']}
    if len(paths) != len(bundle['phoneticModels']) + len(bundle['toneModels']):
        raise ValueError('Duplicate model identifiers')
    sequences, signatures, ids = [], [], set()
    for row in rows:
        core.check_source_speaker(row)
        if row['id'] in ids:
            raise ValueError('Duplicate source identifier')
        ids.add(row['id'])
        with np.load(args.cache / (row['id'] + '.npz'), allow_pickle=False) as features:
            if (str(features['sourceSha256']) != row['sha256']
                    or str(features['pipelineSha256']) != extraction['pipelineSha256']
                    or str(features['encoderLockSha256']) != extraction['encoderLockSha256']):
                raise ValueError('Feature/source identity differs')
            sequences.append(features['sequence'])
            signatures.append(features['pitch'])
    speakers = [r['speaker'] for r in rows]
    hidden, hidden_stats = core.normalize_hidden(np.stack(sequences), speakers)
    pitch, pitch_stats = core.normalize_pitch(np.stack(signatures), speakers)
    supported = [core.pitch_supported(value) for value in signatures]
    import torch
    import joblib
    from threadpoolctl import threadpool_limits
    torch.set_num_threads(4)
    device = 'mps' if torch.backends.mps.is_available() else 'cpu'
    ensemble = {'initial': [], 'final': [], 'tone': []}
    for entry in bundle['phoneticModels']:
        categories = entry['categories']
        model = core.make_phonetic_head(len(categories['initial']), len(categories['final']))
        model.load_state_dict(torch.load(paths[entry['id']], map_location='cpu', weights_only=True), strict=True)
        model = model.to(device).eval()
        result = {'initial': [], 'final': []}
        with torch.inference_mode():
            for start in range(0, len(rows), 128):
                outputs = model(torch.tensor(hidden[start:start + 128], device=device))
                for name in result:
                    result[name].append(outputs[name].softmax(1).cpu().numpy())
        for name in result:
            ensemble[name].append((np.concatenate(result[name]), categories[name]))
        del model
    with threadpool_limits(limits=4):
        for entry in bundle['toneModels']:
            model = joblib.load(paths[entry['id']])
            # Only these locally fitted sklearn estimators are accepted.
            if type(model).__name__ not in ('HistGradientBoostingClassifier', 'RandomForestClassifier'):
                raise ValueError('Unexpected local tone estimator')
            ensemble['tone'].append((model.predict_proba(pitch), model.classes_.tolist()))
    parts = {name: (average_scores(values), list(values[0][1])) for name, values in ensemble.items()}
    capture = {'schemaVersion': 1, 'input': 'audio-only', 'canPromote': False,
               'fittedSpeakers': bundle['fittedSpeakers'],
               'weightsSha256': digest([{k: entry[k] for k in ('id', 'file', 'sha256')}
                                       for entry in bundle['phoneticModels'] + bundle['toneModels']]),
               'featureCodeSha256': digest(scoring), 'scoringIdentity': scoring,
               'sourceManifestSha256': core.file_hash(args.manifest),
               'normalization': {'phonetic': hidden_stats, 'pitch': pitch_stats},
               'predictions': make_predictions(rows, parts, supported)}
    write_new_json(args.output, capture)
    print(json.dumps({'scored': len(rows), 'pitchAbstentions': supported.count(False), 'canPromote': False}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('manifest', 'protocol', 'bundle', 'cache', 'output'):
        parser.add_argument('--' + name, required=True, type=Path)
    parser.add_argument('--stage', required=True, choices=['calibration', 'final'])
    parser.add_argument('--frozen', type=Path)
    score(parser.parse_args())


if __name__ == '__main__':
    main()
