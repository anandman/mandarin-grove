# Automated pronunciation evaluation

This is release tooling. The student app remains static; it never downloads an
assessment model or receives a provider key. Evaluation uses the existing TTS
assets, natural Mainland reference recordings and synthetic pitch controls,
without children's recordings or progress.

The workflow checks the assessor before trusting its judgments. A matching
transcript cannot establish the consonant, vowel or tone. Neither an API score nor
agreement with the printed answer automatically approves a file.

## Mainland target and optional Taiwan recordings

The app targets **Mainland Standard Mandarin (Putonghua), Hanyu Pinyin and
simplified Chinese**. The initial audio-34 recommendation of Taiwan recordings
was too broad for that target. Release mainland-35 restores the `zh-CN` browser
default when no voice choice is saved and labels the recordings **Taiwan Mandarin
recordings · optional**. Explicit saved choices are preserved. A `zh-CN` request
is not verification of the browser's actual output; a verified Mainland static
recording set is still required.

The optional CNS11643 source uses 557 reading-specific clips for 841 catalog
characters, including all listed alternatives and nine neutral syllables.
Each file is matched to the existing curriculum pinyin, rather than importing
Taiwan's character-to-reading dictionary. The curriculum's simplified characters,
expected pinyin, grading, progress, backups, rewards and mastery remain unchanged.
A multi-reading card plays its first displayed reading; `say(character,
listedReading)` selects a listed alternative. Homophones share a syllable file.
Failed reference playback never quietly changes voice or reading.

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

Published labels, reuse rights and immutable hashes do not finish pronunciation
verification. The acceptance method itself needs independently reviewed natural
references and real near-miss controls. The following benchmark tests that step;
it does not establish a release-capable method. Unverified synthesis remains a
candidate.

### Natural Mainland benchmark and complete recording scan

An additional experiment evaluated **87 actual natural recordings**, 29 readings
from each of three Beijing speakers in the Chinese Academy of Social Sciences'
[Syllable Corpus of Standard Chinese (SCSC)](https://multi.ucass.edu.cn/resources/detail/3).
M01/M02 were designated development speakers and M03 a held-out speaker before
inference. Only waveform features went into either model; expected characters,
pinyin and filenames were not model inputs. The models and extraction methods
are fixed in [the captured observations](../data/audio-reference-observations.json).

| Acoustic method | Whole-reading agreement with published label | Held-out speaker |
|---|---:|---:|
| Charsiu frame classifier, dominant initial/final | 45/87 | 14/29 |
| SenseVoice dual pinyin CTC, one decoded syllable | 60/87 | 17/29 |
| Both agree on every component | 33/87 | 8/29 |

An exploratory follow-up tested a third local model,
[`asolanki/distilhubert-finetuned-mandarin`](https://huggingface.co/asolanki/distilhubert-finetuned-mandarin/tree/12b383b74f5561b7060ff300bcee663fa4af9f74),
which classifies 1,640 isolated syllable/tone combinations. It matched **28/87**
whole readings, including **10/29** for M03. Its initial, final and tone labels
matched 53, 66 and 57 of the 87 references respectively. It accepted **18/222**
wrong-reading controls, including 17 wrong-tone references. The model therefore
does not supply a dependable approval check either. Its published preprocessing
was used, and its exact weight revision, hash and audio-only outputs are retained
in a [separate capture](../data/audio-reference-observations-distilhubert.json).
Its training corpus and reuse license were not established; no weights are
redistributed. This follow-up was chosen after inspecting the earlier results,
so M03 is not a fresh untouched holdout for this model-selection step. The
two-model joint results above retain their original meaning.

The original two models' blind outputs were tested against **222 deliberately wrong references**:
156 tone contrasts, 36 initial contrasts, 24 final contrasts and six zhi/zi
contrasts whose apical vowel changes along with the consonant. Charsiu accepted
13 wrong references and SenseVoice nine. Requiring both to agree accepted none
of these wrong references, but supported only eight of 29 held-out positive
references. The controls reuse recordings and overlap in their contrasts; they
are not 222 independent samples and do not establish a general error rate.
SenseVoice can give nearly 1.0 token posterior to a reading that disagrees with
the source, including zhi2 for the held-out zhi3 and ke4 for ke1. No posterior or
consensus score is treated as a correctness probability.

This is **reference-label agreement, not independently established accuracy**.
SCSC describes selected professional Standard Mandarin recordings, but we have
not obtained independent auditory review records for these individual files.
Its public metadata also maps 狗 to `gao3`, across all 15 speakers; we excluded
that entry rather than relabeling the sound or claiming gǒu coverage. The
[benchmark manifest](../data/audio-reference-benchmark.json) retains that missing
contrast and the corpus's access/reuse limits. No SCSC audio or model weights are
redistributed. The benchmark covers only adult male speakers and no neutral tones.

Both models also processed **all 557 actual optional CNS recording files**.
SenseVoice matched the expected reading on 434; Charsiu on 248; both on 207.
Those are diagnostics, not a claim that the other recordings are wrong or that
the agreeing recordings are verified Mainland teaching models. All remain
unverified for that purpose. The scan did not change any audio, playback defaults,
curriculum answers or child progress.

Michigan State's separate university
[Tone Perfect corpus production paper](https://ideah.pubpub.org/pub/hh90jpsu/release/5)
documents a stronger reference process: native specialists independently
listened to complete sets without seeing production error logs, problematic
tokens were re-recorded, and mastered sets were reviewed again. This is evidence
of actual listening review rather than a pinyin label alone. Its current
[access and citation terms](https://tone.lib.msu.edu/cite) must be checked before
reuse; automated access is blocked in this environment. It is **not** the
commercial TonePerfect assessment API used in the earlier trial.

Two further live **free-credit** assessments used one natural Beijing zhǐ
recording with correct `zhi3` and wrong `zhi4` references. Both responses heard
tone 3; the correct target received display score 85 and the wrong one 61.8.
This is useful evidence but one recording cannot calibrate the service. The
arbitrary 90-point threshold was not lowered to make it pass. Five trial credits
remain after these two requests; no paid credits were used.

Reproduce the natural benchmark report from the committed observations without
models, services or network requests:

```bash
node scripts/audio-natural-benchmark.cjs data/audio-reference-benchmark.json data/audio-reference-observations.json /tmp/grove-natural-benchmark.json
node tests/audio-natural-benchmark.test.cjs
```

Reproduce the separate follow-up using the same benchmark and scorer:

```bash
node scripts/audio-natural-benchmark.cjs data/audio-reference-benchmark.json data/audio-reference-observations-distilhubert.json /tmp/grove-distilhubert-benchmark.json
```

Optionally retrieve the exact original research audio through its intended
public player path. This does not grant redistribution rights. Omit `--download`
to verify an existing local copy without making requests. Changed or missing
bytes fail explicitly; they are never replaced with a similarly named clip.

```bash
python3 scripts/fetch-audio-references.py --out /tmp/grove-natural-references --download
```

**Pronunciation verification remains unfinished.** The next step is obtaining
the independently reviewed Mainland reference set, then either using reviewed,
permitted originals directly or calibrating a conservative acoustic method
against them. Neutral readings and any uncovered contrasts must remain explicit
gaps. No model agreement, filename or source's nationality closes that gap.

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

## MSU source suitability — October 30, 2026

Pronunciation verification has resumed by explicit owner instruction. The
university **Tone Perfect** corpus is distinct from the commercial TonePerfect
assessment API. Original downloads and the requested citation are preserved in
a separate private local Git archive and recovery bundle; no corpus files,
access links, credentials or detailed reports are distributed here.

The [MSU team's production paper](https://ideah.pubpub.org/pub/hh90jpsu/release/5)
describes six speakers recruited from Beijing, coached sessions, independent
native-speaker listening review and re-recording of flagged sets. This supports
using the corpus as a candidate Mainland reference. It does not independently
certify every file or validate an automatic pronunciation judge.

Measured from the unchanged bulk MP3/XML archives:

- 9,839 paired recordings/custom XML records; filenames, identifiers, speakers,
  syllables and tone fields agree. All files decode: 44.1 kHz stereo, durations
  0.236–2.187 seconds. No silence, low-level, clipping, channel-cancellation or
  duplicate decoded-audio flags under the documented diagnostic thresholds.
- 548 of 557 app reading keys have recordings. Nine neutral-tone keys are
  absent: `a5 ba5 de5 le5 ma5 me5 men5 ne5 zhe5`. Four-tone isolated syllables
  cannot establish contextual neutral-tone behavior or connected-speech rules.
- Only 544 keys pass the conservative metadata screen: every speaker labels
  `cuo4 she4 xing2 zuo3` as lexical gaps while also supplying real character
  forms. These contradictory labels are retained and quarantined for review;
  no pronunciation error or nonword status is inferred from that flag.
- `jiao1` has five voices because the publisher deleted FV3; no replacement is
  invented. The preserved empty individual `ben1_FV1` download is distinct from
  its nonempty bulk-ZIP counterpart; the measured bulk file is valid.

Reproduce the structural inventory without extracting the corpus:

```sh
python3 scripts/audio-msu-inventory.py --audio-zip PRIVATE_MP3.zip \
  --xml-zip PRIVATE_XML.zip --curriculum audio-sources/cns11643.json \
  --output PRIVATE_INVENTORY.json
python3 scripts/audio-msu-signals.py --audio-zip PRIVATE_MP3.zip \
  --inventory PRIVATE_INVENTORY.json --output PRIVATE_SIGNALS.json
```

The first command needs only Python's standard library; the second uses the
optional packages in `scripts/requirements-audio.txt`. Both reports explicitly
set `canPromote: false`. Signal flags and metadata coverage are source QA, not
acoustic acceptance. The full archive and each member are hash-checked; the
signal pass also checks decoded-byte duplicates. No audio is normalized,
trimmed, relabeled or copied into the student application.
Report outputs must be new files: neither command overwrites inputs or prior
reports, including symlink/hardlink aliases. Signal reports include skipped
metadata denominators and return an incomplete status if any are excluded.

Before any new acoustic inference, speaker roles were fixed: FV1/MV1 for
development, FV2/MV2 for calibration, FV3/MV3 reserved for final testing.
Structural/decode QA covers all speakers; held-out acoustic outputs must not
be used for feature/threshold tuning. SCSC M03 was inspected in previous work
and is no longer an untouched holdout. Initials, finals and tones still require
separate measured acceptance, natural wrong-reading controls and abstentions.
No MSU audio is approved or shipped by this checkpoint; the student app,
explicit voice preferences and learner state are unchanged. Issues #11/#14
remain open.

## Continuous verification contract — October 30, 2026

`scripts/audio-acceptance.cjs` evaluates captured acoustic component scores
against natural reference readings. It is release research tooling, with no
student-runtime dependency. Its report remains `canPromote: false`: a qualified
method still needs exact source/candidate evidence and a separately reviewed
recording selection before anything ships.

The evaluator reports initials, finals and tones separately: observed precision
among accepted predictions, coverage, mismatches and abstentions. It records
speaker, reading-base and expected-label strata. A score is a model output,
not a probability that a pronunciation is correct. Missing components, changed
audio hashes and unsupported isolated neutral tones abstain.

Calibrated confidence floors may depend on the predicted component label; the
expected reading never chooses its threshold. The global floor always applies.
Label floors and allowlists are validated and included in the frozen policy.
Such selective calibration needs subsequent held-out confirmation; fitting the
thresholds is not itself an independent accuracy result.

The report distinguishes fully measured whole readings from partial decisions,
and expected-label strata from observed-label precision. Critical coverage lists
untested pairs, represented pairs, directed comparisons and distinct clips.
Component results do not imply 99% whole-reading agreement or equal results for
every phonetic label.

For each clip and component, the negative test uses at most one hardest
represented natural reading that changes only that component. Explicit critical
pairs also cover changes such as `zhi`/`zi`. These tests reuse recordings; their
counts are not independent additional speakers or trials. Repeated audio bytes
cannot inflate the reference count. The same recording must not serve as its
own independent validation reference.

Qualification requires measured critical pairs, at least 80% critical decision
coverage and no critical false acceptance. Merely listing a pair whose outcomes
all abstain cannot qualify a method.

The current development target is at least 99% observed accepted-component
precision and at most 1% false acceptance of nearby wrong references, with a
desired 80% component coverage. Thresholds must be calibrated, then frozen
before final-speaker evaluation. The tool checks frozen policy, feature/model
and evaluator identities, excludes fitted speakers from validation, requires
multiple evaluation speakers and checks precision/coverage for each speaker.
The frozen identity includes the imported pinyin parser, exact reference scope,
critical pairs and qualification settings. Those empirical results describe the tested adult reference set; they do not
establish universal pronunciation accuracy or child-speech grading validity.

```sh
node scripts/audio-acceptance.cjs PRIVATE_REFERENCES.json PRIVATE_CAPTURE.json \
  PRIVATE_POLICY.json NEW_PRIVATE_REPORT.json
node --test tests/audio-acceptance.test.cjs
```

Add a frozen-identity JSON path as the final argument for held-out evaluation.
Reports use exclusive file creation, preserving inputs and earlier results.

Optional local feature extraction and scoring are reproducible with
`scripts/audio-verification.py` and `scripts/score-audio-features.py`. Create a
separate Python environment using `scripts/requirements-audio-verification.txt`,
then run `npm run audio:verification:test` with that environment active. No
publisher weights or corpus recordings are downloaded by these tests. Models,
source recordings and experiment manifests remain private and are separate from
the static application and its ordinary Node checks.

Feature extraction takes only waveforms, pins the local encoder, retains missing
pitch and checks source speakers before inference. The scorer uses two temporal
phonetic heads and two physical-pitch classifiers with pinned locally trained
weights. An optional pinned `audio-component-head.py` architecture adds an
independently trainable temporal tone path; its tone scores are combined with the
physical-pitch classifiers, and missing usable pitch still abstains. This is a
development method, not approval of its training or candidate recordings.
The scorer removes unlabelled speaker-batch channel bias and pitch register;
the exact complete normalization population must therefore be frozen with each
experiment. These are batch checks of adult reference recordings, not a method
for scoring a single child. Missing usable pitch abstains. Final runs require
matching pipeline/model/protocol/source identities; old caches and reports are
preserved rather than overwritten. Hash checks do not make an unknown serialized
model trustworthy: only the researcher's own trusted fitted estimators may be
loaded. Publisher model weights are never redistributed.

The current acoustic methods remain in development. Strong within-source tone
agreement failed to generalize sufficiently to an independent corpus, so it
has not approved any recordings. Further source/cross-speaker calibration is
ongoing; this checkpoint changes no playback, saved voice or learner data.

`scripts/audio-annotation.cjs` compares supported Hanyu Pinyin spelling variants
in reference metadata, separately from acoustic verification. It implements the
ordinary-u `uei/ui` and `uen/un` conventions in the
[Pinyin Scheme's spelling rules](https://yywz.ecnu.edu.cn/1f/56/c30556a335702/page.htm),
also explained by [Hunan First Normal University](https://jwc.hnfnu.edu.cn/info/1055/3129.htm).
It preserves initials, tones and u/ü distinctions. Literal `üen` remains unresolved
under the established sources. Annotation agreement does not establish what a
waveform actually says, and neither raw source labels nor earlier failed results
are rewritten by this formatting comparison.
