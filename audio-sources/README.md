Current recommended source: **MSU Mainland recordings**. The finite548-reading selection in `mainland.json` uses unchanged MP3 bytes from Michigan State University Libraries' Tone Perfect dataset. `LICENSE-MSU.txt` contains the requested citation and CC BY-NC4.0 notice. `MSU-VERIFICATION.json` discloses source comparison,521component-concordant/27pending readings and the failed independent automatic qualification. This is a native-source-reviewed release, not a certified automatic-accuracy claim. The full preservation archive and research models remain private. Nine neutral gaps retain clearly unchecked Google/device support; saved voice choices remain intact.

The CNS11643 description below remains valid for the optional Taiwan voice.

The app offers CNS11643 Taiwan Mandarin recordings as an optional voice matched to each existing curriculum pinyin reading. The app targets Mainland Standard Mandarin; these source recordings are not verified as a Mainland pronunciation model. The source mapping distinguishes every tone and writes ü as `v`. These isolated syllables are suitable for character prompts; they do not demonstrate tone changes within phrases. The publisher supplies pronunciation labels, but does not publish the speakers' personal identities or native-language biographies.

The government [dataset](https://data.gov.tw/dataset/5961) explicitly includes the voice archive under the [Open Government Data License 1.0](https://data.gov.tw/license). Attribution and processing details are in [LICENSE.txt](LICENSE.txt). The [release list](https://www.cns11643.gov.tw/opendata/release.txt) identifies Voice.zip version 20250113.

The selected set contains 548 unchanged MP3 files and nine neutral-tone WAV files converted from IEEE Float32 to PCM16 for browser compatibility. Conversion preserves every sample frame, the original 48kHz mono rate and volume, with no trimming, resampling, normalization or pitch changes. Source and distributed SHA256 values are separate in the manifest. Non-audio WAV metadata is omitted during conversion. Asset filenames include the distributed hash to prevent stale audio after a future update.

The archive has duplicate bytes under some distinct phonetic labels. We use the male voice because the female archive also duplicates e and er. The two affected male curriculum entries are replaced with separately labeled files from the same official site:

| Reading | Official label page | Official recording |
| --- | --- | --- |
| 努 nǔ, ㄋㄨˇ | [努](https://www.cns11643.gov.tw/wordView.jsp?ID=84280) | [M0598.mp3](https://www.cns11643.gov.tw/voice/male/M0598.mp3) |
| 路 lù, ㄌㄨˋ | [路](https://www.cns11643.gov.tw/wordView.jsp?ID=91771) | [M0724.mp3](https://www.cns11643.gov.tw/voice/male/M0724.mp3) |

The comparison recordings [女 nǚ](https://www.cns11643.gov.tw/wordView.jsp?ID=83020&la=1), M0618, and [綠 lǜ](https://www.cns11643.gov.tw/wordView.jsp?ID=92730), M0749, match the archive's `nv3` and `lv4` files. The replacements differ from these comparison recordings. All 557 distributed readings have distinct SHA256 hashes.

To reproduce the import using Python 3.9+ and its standard library, download these public source files into a temporary directory:

```sh
mkdir -p /tmp/grove-cns-source
curl --fail --location --output /tmp/grove-cns-source/Voice.zip https://www.cns11643.gov.tw/opendata/Voice.zip
curl --fail --location --output /tmp/grove-cns-source/M0598.mp3 https://www.cns11643.gov.tw/voice/male/M0598.mp3
curl --fail --location --output /tmp/grove-cns-source/M0724.mp3 https://www.cns11643.gov.tw/voice/male/M0724.mp3
python3 scripts/import-cns-audio.py --archive /tmp/grove-cns-source/Voice.zip --repair-dir /tmp/grove-cns-source
```

The importer checks the reviewed 58,524,582-byte archive's SHA256, the original phonetic mapping hash, both replacement hashes, complete current curriculum coverage, each file's source and distributed hashes, and conflicting audio duplicates. It stops if the source release changes. It writes only the selected audio files, their manifest and mapping, and `pronunciations.js`. Use `--output-root /tmp/grove-cns-preview` to inspect a separate result. Source downloads and the full archive are not shipped with the app.

Verify the installed assets without downloading anything:

```sh
python3 scripts/import-cns-audio.py --verify
python3 tests/import-cns-audio.test.py
node tests/reference-audio.test.cjs
```

The acoustic checks establish file integrity and bounded usable audio. Neither generic speech transcription, pitch contours, nor the earlier experimental pronunciation judges establish native correctness. Curriculum labels and grading remain separate from the recorded source labels; no character or expected tone is changed by this import.
