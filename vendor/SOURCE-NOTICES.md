# Bundled source data and notices

`source-assets.json` records exact local hashes and independently retrieved upstream pins. The Hanzi Writer engine and character data have different licenses.

- Hanzi Writer 3.7.3 (David Chanin), MIT: `hanzi-writer-LICENSE.txt`. The current `hanzi-writer.js` matches the pinned npm distribution byte for byte.
- Hanzi Writer Data 2.0.1 (David Chanin, Make Me a Hanzi contributors, Arphic Technology Co., Ltd.): the `strokes` and `medians` graphics are under the Arphic Public License. Full notices are in `hanzi-writer-data/ARPHICPL.TXT` and the unmodified upstream `APL/` translations. All 841 local JSON files match the pinned package byte for byte. Thirty records have been sourced directly from that archive into separate stroke files. The previously undocumented acquisition history of the other 811 files has not been reconstructed.
- Some JSON records additionally include `radStrokes`, derived from Make Me a Hanzi dictionary `radical`, `decomposition` and `matches` fields. Those fields are LGPL 3-or-later, as upstream `COPYING` states. The full LGPL notice, incorporated GPL 3 text, and unchanged corresponding 841-row dictionary source subset are bundled under `hanzi-writer-data/`; the manifest links exact upstream source and converter revisions. The pinned submodule is `9d54d6bbba93023078628589ffbffff1edf91335`. The dictionary source subset supports radical metadata verification; it supplies no definitions for the new study catalog.
- CC-CEDICT (MDBG/contributors), CC-BY-SA 4.0: `cc-cedict/LICENSE`, `cc-cedict/CHARACTERS-SOURCE.json`, and unchanged source lines in `cc-cedict/curriculum-characters.txt`. The new single-character subset is separately pinned from the pre-existing multi-character dictionary bank.

The reproducible curriculum builder uses only the cited CC-CEDICT lines, the school unit fixture and taught-reading compatibility facts. Its definitions and lexical readings have not received fluent instructional or pronunciation review. Existing example fields are deliberately empty in this pack.

The PDF-derived school unit fixture credits Better Chinese LLC. Fixture attribution and public availability do not settle permission for broader redistribution. The private original application history, original 847 recordings' publication rights, and remaining Grove asset provenance are separate release questions. This source record is not a public-release clearance or legal-completion claim. Independent pronunciation verification remains unfinished; the current source-reviewed MSU release is described below.

Rebuild/check offline with `node scripts/build-curriculum.cjs --check`; verify geometry, engine, notices and radical metadata with `node scripts/audit-source-assets.cjs`. Explicitly add these source and license files to the product exporter when integrating; merely committing them does not ship the notices.

## Complete offline Help dictionary

`cc-cedict/dictionary.json` contains the complete October 25, 2026 CC-CEDICT release (125,319 records), including single characters, mixed headwords and full definitions. MDBG and CC-CEDICT contributors, CC BY-SA 4.0; see `cc-cedict/LICENSE` and `cc-cedict/DICTIONARY-SOURCE.json` for the pinned source hash and representation changes. This general reference has not received teaching review. The older `words.json` bank remains unchanged for Build words compatibility.


## MSU Tone Perfect selected recordings

Tone Perfect MP3 Dataset. Michigan State University Libraries. East Lansing, MI. https://listings.lib.msu.edu/toneperfect/ (accessed October30,2026). Selected unchanged MP3 recordings are CC BY-NC4.0, https://creativecommons.org/licenses/by-nc/4.0/. See ../audio-sources/LICENSE-MSU.txt for attribution, source, processing and noncommercial terms. Only548selected readings are included; the full private archive is excluded. Source-review and unfinished automatic-check limits are disclosed in ../audio-sources/MSU-VERIFICATION.json. No MSU endorsement is implied.
