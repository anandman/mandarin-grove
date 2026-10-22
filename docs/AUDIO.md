# Automated pronunciation evaluation

This is release tooling. The student app remains static; it never downloads an
assessment model or receives a provider key. Evaluation uses the existing TTS
assets and synthetic pitch controls, without children's recordings or progress.

The workflow checks the assessor before trusting its judgments. A matching
transcript cannot establish the consonant, vowel or tone. Neither an API score nor
agreement with the printed answer automatically approves a file.

## Current findings — October 22, 2026

An actual CPU-only experiment used
[Charsiu tiny](https://huggingface.co/charsiu/zh_w2v2_tiny_fc_10ms) to predict
phones and tone categories from waveform samples, without expected text. It
matched the catalog tone on 14 of 22 existing clips. All eight third-tone targets
disagreed. Those catalog comparisons alone cannot distinguish a recording error
from a model error.

We then imposed four physical pitch contours on each of two recordings using
PSOLA. The model recognized six of eight interventions; both dip-then-rise
contours became tone 2. One had 0.838 tone-2 posterior mass. A deliberately
uncalibrated confidence gate even accepted three contradictory catalog-tone
references. This rejects that model as an approval mechanism. The controls are
acoustic interventions, not native-speaker gold-standard utterances.

The experiment used Torch 2.6.0 CPU, Transformers 4.44.2, SciPy 1.14.1 and
Praat-Parselmouth 0.4.7. Weight SHA-256:
`31be61b1c0e08e7545ebf8a72d1272f1e1d9e94ae7e67cac1ec529378194e02f`.
The upstream code is MIT, but a model/tokenizer weight license was not found;
weights are not redistributed. Model posteriors are not calibrated correctness
probabilities. This experiment does not test Apple Tingting playback.

### Live specialist trial

The authorized 44-check trial completed on October 22 using 43 distinct requests
and **43 free credits**, with **7 free credits remaining**. One identical
recording/reference request reused its cached response. No paid credits were used.
The returned model was `mandarin-hubert-baseline-85741cdf3967+fallback`, using
pinyin-only isolated-word assessment. These findings describe that configuration.

| Controlled target | Imposed tone | Heard tone | Confidence | Display score |
|---|---:|---:|---|---:|
| shi1 | 1 | 1 | high | 97.3 |
| shi2 | 2 | 2 | high | 96.2 |
| shi3 | 3 | 2 | medium | 75.5 |
| shi4 | 4 | 4 | high | 76.8 |
| yi1 | 1 | 3 | medium | 75.9 |
| yi2 | 2 | 2 | medium | 77.0 |
| yi3 | 3 | 3 | high | 98.2 |
| yi4 | 4 | 4 | medium | 76.0 |

Six of eight heard tone labels match the imposed contours. Three pass the
unchanged high-confidence / score-at-least-90 diagnostic gate. This is a small
physical-contour check, not a native-speaker accuracy benchmark. The two label
errors and remaining uncertainty prevent using this judge to approve recordings
automatically.

Of 13 existing candidate readings, 12 remain uncertain and 假 jià is flagged;
none passes the entire diagnostic gate. This does **not** establish that those
recordings are wrong. Seven of 23 deliberately altered references pass the strict
whole-control gate; 20 are rejected in the specifically changed component.
Heard labels remain consistent across all 12 repeated-audio groups, providing
evidence that the assessor is responding to audio rather than just echoing the
supplied reading.

The live response also exposed a legitimate absent initial consonant in yi
syllables. The adapter now reports that component as `not-applicable` while
retaining measured final/tone evidence. Reports were regenerated from retained
responses without additional calls; the diagnostic threshold was not relaxed.
No replacement audio was promoted. Evaluate another independent assessor or
validated reference source before enabling unattended acceptance.

## Local tools

Use Node 18+ and Python 3.11 with NumPy and system libsndfile. Pitch-control
generation also needs Praat-Parselmouth. An optional isolated environment:

```bash
python3 -m venv /tmp/grove-audio-venv
/tmp/grove-audio-venv/bin/pip install -r scripts/requirements-audio.txt
```

`scripts/audio-acoustics.py FILE ...` decodes audio and reports exact SHA-256,
duration, signal level, clipping, silence and absolute F0 frames. Its confidence
measures periodicity, not Mandarin correctness. Error entries remain explicit;
inspect `files[].status` rather than treating exit zero as batch success.
The periodicity estimator abstains over part of one altered third-tone control;
saved-PCM Praat measurements still show its intended dip and rise. Missing F0
frames must not be converted into a confident tone judgment.

```bash
/tmp/grove-audio-venv/bin/python scripts/audio-acoustics.py audio/止.mp3 audio/离.mp3
/tmp/grove-audio-venv/bin/python scripts/audio-tone-controls.py --out exports/audio-audit/tone-controls
node scripts/audio-audit.cjs plan --tone-controls exports/audio-audit/tone-controls/manifest.json
```

The default manifest contains 13 intended readings from 12 characters, including
both readings of 假, plus 23 deliberately contradictory references for the same
audio bytes. The eight pitch interventions bring the pilot to **44 assessments**.
Controls test a changed tone, consonant, or ü/u final separately. Missing assets
and alternate readings stay distinct; a character filename is not evidence that
it contains the intended reading.

Choose a smaller scope with `plan --characters 止离满`. Audit a generated Google
batch with `plan --generated-plan exports/audio-pilot/plan.json`. Preparing a
manifest makes no service requests.

## Specialist assessment trial

[TonePerfect's documentation](https://api.toneperfect.app/docs) lists 50 initial
credits without a card. A live account/key is required. The provider is
experimental, with [documented limitations](https://api.toneperfect.app/languages/mandarin-chinese/),
including neutral tones and some sound contrasts. It is a candidate judge to
evaluate, not an established source of correct answers. No paid plan or automatic
ongoing usage is configured.

1. Create an account at <https://api.toneperfect.app/signup>.
2. Open API keys and create a live key starting `tp_live_`. Test keys return fixed
   examples rather than evaluating uploaded audio; the tool rejects them.
3. Save only the key in `exports/audio-audit/toneperfect.key`, using `umask 077`
   before creating the file. `exports/` is ignored by Git and excluded from the
   static app. Do not put keys in command arguments, commits or chat.
4. Run the bounded batch:

```bash
AUDIO_PYTHON=/tmp/grove-audio-venv/bin/python node scripts/audio-audit.cjs assess \
  --key-file exports/audio-audit/toneperfect.key --max-requests 44
```

Alternatively supply `TONEPERFECT_API_KEY` through the process environment.
`--max-requests` is required. The CLI checks hashes and audio quality before
assessment and restricts clips to 0.15–15 seconds, limiting each to one credit
under the documented billing rules. It preflights the uncached request count,
sends sequentially, checkpoints responses, and reuses exact cached requests on
resume. It does not select a paid subscription or verify the account's remaining
free balance. Stop if the trial is exhausted; increasing the request limit does
not provide free credits.

All isolated candidates and contradictory controls use the same documented
[pinyin-only assessment mode](https://api.toneperfect.app/pinyin-pronunciation-api/).
This avoids character/pinyin lint failures and keeps request context comparable.
The retained model version must match across a candidate and its controls.
Reclassification uses the retained raw response, not a transcript or cached
verdict. HTTP fixtures are marked as such and cannot establish real evidence.

The provider's initial, final and tone evidence is kept separately. Missing
measurements, unsupported decisions, inconsistent expected phones, neutral tones
and connected-speech ambiguity remain uncertain. A display-score threshold of 90
is an **uncalibrated diagnostic setting**, not 90% correctness. Correct handling
of the physical controls is reported separately from candidate agreement.

Results are local under `exports/audio-audit/`: `report.md`, `report.json`,
`acoustics.json`, retained provider responses and checkpoints. These may contain
absolute workstation paths; do not publish them indiscriminately. To rebuild a
report without requests:

```bash
node scripts/audio-audit.cjs report
```

## Getting replacement recordings into the app

After the judge passes the relevant controls, use the existing Google generation
tool with explicit intended pinyin, then assess the resulting exact bytes. Google
credentials, billing setup and a generation budget are separate from the trial
assessment key. Do not infer the correctness of new recordings from old files or
from the synthesis request alone.

No automatic promotion is enabled in this diagnostic stage (`canPromote: false`).
Before enabling it, establish acceptable false-positive behavior, independent
reference coverage of the relevant sounds/tones, contextual-speech policy and
provider/audio usage rights. A fluent reviewer can still help later; their
availability is not required to run these experiments. Replace only accepted
files, use reading-aware cache keys, retain provenance, and leave uncertain
readings out of the approved set. The older manual listening-review command is
still available; these diagnostic reports are not that command's approvals.

## Verification

```bash
node tests/audio-assessment.test.cjs
node tests/audio-audit.test.cjs
/tmp/grove-audio-venv/bin/python tests/audio-acoustics.test.py
/tmp/grove-audio-venv/bin/python tests/audio-tone-controls.test.py
```

Transport fixtures test schema, budgeting, checkpoint/resume and credential
handling; they are not live acoustic validation. Synthetic signals test estimator
mechanics. Neither is presented as Mandarin accuracy. Static export tests should
continue to exclude scripts, reports, models and keys.
