# Automated pronunciation evaluation

This is release tooling. The student app remains static; it never downloads an
assessment model or receives a provider key. Evaluation uses the existing TTS
assets and synthetic pitch controls, without children's recordings or progress.

The workflow checks the assessor before trusting its judgments. A matching
transcript cannot establish the consonant, vowel or tone. Neither an API score nor
agreement with the printed answer automatically approves a file.

## Shipped reference recordings

The student app now has a **Reference recordings · recommended** option. It uses
CNS11643’s published short Mandarin pronunciation files, keyed by pinyin plus tone,
instead of asking a speech synthesizer to infer the character’s reading. There are
557 distinct curriculum readings for 841 catalog characters, including all listed
alternate readings and nine neutral-tone syllables. A multi-reading card plays its
first displayed reading by default; `say(character, listedReading)` selects an
explicit listed alternative. Homophones share the same syllable file.

New installations use this option. Explicit saved browser/Google preferences stay
unchanged; existing families can switch in Grown-ups → Pronunciation voice. Failed
reference playback shows an error and never quietly changes voice or reading.
These changes do not alter grading, progress, backups, rewards or mastery.

The source is the Ministry of Digital Affairs’
[CNS11643 site](https://www.cns11643.gov.tw/), Voice.zip version 20250113, under the
[Open Government Data License 1.0](https://www.cns11643.gov.tw/pageView.jsp?ID=59).
The 548 selected MP3 files are unchanged. Nine neutral-tone float WAVs are
encoded as widely supported PCM16 WAVs, preserving sample rate and frame count
without trimming, resampling or volume changes. The manifest records both source
and output hashes and this encoding conversion. [Source manifest](../audio-sources/cns11643.json)
records exact file hashes, original archive members, Bopomofo/pinyin labels and
individual official URLs for repairs; [attribution](../audio-sources/LICENSE.txt)
is included in the static app. [Reproducible import commands](../audio-sources/README.md)
and the pinned original phonetic mapping accompany the manifest. This is reference-source provenance, not a claim
that every clip passed an infallible acoustic model or that the publisher endorses
the app. Speaker identity and recording technique are not independently established.

An automated collision audit found real archive defects: some `u` and `ü` entries
share identical bytes in both voices; the female bundle also merges `e` and `er`.
We use the male bundle and replace the two affected curriculum entries (`nu3` and
`lu4`) with separately numbered official recordings whose pinyin is verified on the
努 and 路 source pages. The corresponding `nv3` and `lv4` entries are separately
checked against the 女 and 綠 pages. Import checks reject missing labels, wrong
archive/repair hashes, unexpected cross-reading byte duplicates and missing
curriculum coverage. This avoids reproducing a source packaging error.

All shipped files receive decode, duration, silence and clipping checks.
Independent pitch analyses of reported trouble cases and alternative published
references are additional diagnostics: compatible tone contours support the
mapping but do not certify consonants or vowels. Short unprompted recognition
probes confirm the source clips are single utterances rather than dictionary
metadata; their transcripts are not pronunciation grades. Source-based reference
selection is the delivery path; neither experimental assessor below is used as
an approval oracle.

Limits: recordings reflect Taiwan Mandarin and isolated syllables. Accent,
third-tone realization and connected-speech changes can differ from classroom
phrases or mainland voices. Words/sentences outside the curriculum recording set,
English instructions and celebration audio retain their existing playback paths.
This does not add spoken-answer grading or guarantee an offline-installed website.
No student audio, provider key, neural model or ongoing per-student API call is
needed to play these static curriculum recordings.

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
uncalibrated confidence gate accepted three contradictory catalog-tone
references. This experiment did not establish an approval mechanism. The controls
are acoustic interventions, not native-speaker gold-standard utterances.

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
physical-contour check, not a native-speaker accuracy benchmark. It does not
establish a trustworthy automatic approval procedure.

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

### Native-reference audit changes the interpretation

The imposed profiles have unvalidated register, timing and voice quality. A
flat pitch is not automatically a valid first-tone reference: the imposed yi1
was about 16.5% below the existing speaker's first-tone register. A third-tone
reference can contain creak, missing pitch frames and little final rise. Two
separately licensed Beijing-speaker clips, zhǐ and nǚ, show those natural features.
Consequently, failure on our artificial profiles cannot establish a native-tone
error rate or prove an assessor wrong. The arbitrary display-score threshold
does not repair this limitation. The pilot remains inconclusive for approval.

Independent pitch estimators find an ordinary rise in the existing 离 recording
and a strong fall in 绿. Their model disagreements therefore do not justify
replacing those files. The existing 假 recording instead has a third-tone-family
contour, while the application uses its one filename for both jiǎ and jià. It
needs reading-specific selection. Pitch analysis supports these tone-family
observations; it does not certify consonants or vowels.

The next acceptance path uses published pronunciation-reference audio with exact
reading labels, reuse rights, immutable hashes and independent source checks.
Signal analysis checks mappings and corruption rather than imposing artificial
contours on native speech. Unverified synthesis remains a candidate.

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

## Optional synthesis workflow

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


Reference release checks (no provider calls):

```sh
python3 scripts/import-cns-audio.py --verify
node tests/reference-audio.test.cjs
python3 tests/import-cns-audio.test.py
# With localhost preview and the Playwright/Chromium environment described in README:
node tests/reference-audio-browser.cjs
```

The first reference release checked all 557 actual distributed clips: zero decode
errors, zero silence/clipping flags, no duplicate bytes across distinct readings;
durations 0.470–1.906 seconds, total 9,176,489 bytes. An independent reconstruction
from the pinned archive and numbered repairs matched every selected file and the
complete manifest. Each neutral WAV retained its frame count, 48kHz mono format
and quantized waveform within half a PCM16 step. Browser tests played eleven real
clips including reported cases, alternate readings, u/ü and neutral tone; verified
served bytes, saved progress/preferences and visible failure without substitution.
These checks establish usable files and source correspondence, not an individual
child's accent or a general automatic pronunciation-grading capability.
