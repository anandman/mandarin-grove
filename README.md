# Mandarin Grove

Grow your Mandarin through reading, writing, listening, and pinyin practice.

Editable recovery of https://hanzi-practice-9uq.pages.dev, fetched October 18, 2026. The deployed app delivers its frontend directly, so its HTML, styles, scripts, and referenced assets were recovered rather than reimplemented.

## Run locally

Requires Python 3; Node/npm is optional for the convenience scripts.

```sh
npm run dev
# Or, without Node:
python3 scripts/serve.py
```

Open http://localhost:4173. The server binds to all IPv4 interfaces and serves only app assets. No package installation or build is needed. Run `npm run check` to check JavaScript syntax.

## Source layout

- `index.html`: page shell and original script ordering.
- `styles.css`: original stylesheet.
- `app.js`: curriculum data, embedded stroke data, practice modes, profiles, quizzes, rewards, and backup/restore.
- `vendor/hanzi-writer.js`: original bundled Hanzi Writer library; retains its license header.
- `version-check.js` and `version.txt`: original update notification mechanism.
- `audio/` and `strokes/`: recovered curriculum assets.
- `icon*.png`: Mandarin Grove orchard/book identity at browser, installation, and native source sizes.
- `manifest.webmanifest`: standalone installation name, colors, and icons.

Scripts remain classic scripts because the existing UI uses inline event handlers and shared globals. This preserves behavior while providing separate editable files. The initial recovery was verified to reproduce the downloaded HTML exactly; subsequent feature changes are described below. Original authoring files, repository history, and deployment configuration are not available from the website.

Progress is stored in browser localStorage. Localhost has separate storage from the deployed site. Use Grown-ups → Copy backup code on the original, then restore it in the local app to transfer progress. Backups contain children's names; do not commit them.

The original credits and license links remain in the Grown-ups screen. They cover Hanzi Writer (MIT), Make Me a Hanzi stroke data and Arphic font licensing, and Google Cloud Text-to-Speech recordings. Preserve those credits and check applicable licenses before redistribution.

Validation: `npm run check` checks syntax; `npm test` covers curriculum, pinyin, speech selection and cancellation. `tests/browser.cjs` checks the five cram flows, saved progress, quiz grading, and mobile layout in an isolated browser. Real iPhone voice quality and touch handwriting still need device verification.

## LAN and Tailnet access

While `npm run dev` is running on this machine:

- Same LAN: http://192.168.50.67:4173
- Connected to the Tailnet: http://100.107.28.110:4173 or http://strixhalo.monitor-piranha.ts.net:4173

LAN addresses may change with DHCP. Tailnet access follows existing Tailscale access rules. No router port forwarding is required. The server stops when its process exits; it is not installed as a startup service.

For loopback-only access, use `npm run dev -- --host 127.0.0.1`. To change the port, use `npm run dev -- --port 4174`.

Each URL has separate browser progress storage. Use backup/restore to transfer progress. Over plain HTTP, automatic clipboard copying may be unavailable; the app provides a manual-copy fallback.

## Curriculum and practice updates

The K–5 unit lists match [Better Immersion New Edition](https://www.pgcps.org/globalassets/schools/elementary/paint-branch/docs---paint-branch/better-immersion-chinese-character-list.pdf), pages 1–2. Starter Unit 1 is basic strokes and has no character quiz. The app does not yet include Levels 6–8 on page 3. Extra kindergarten characters remain supplemental practice. Grade 2 unit order was corrected; saved quizzes with the same characters are recognized in the new order. Progress remains keyed by character.

**Cram mode** lets each child check any number of units or supplemental sets shown in My Characters, including added units from other grades, nonconsecutive units, or all units/sets. The picker groups choices by grade; same-number units from different grades can be selected independently. **Start all modes** mixes Listen & Tap, Trace, Flip Cards, and Draw from Memory, plus Hear/Write/Pinyin for Grade 2–5 profiles, question by question in one shuffled session: up to 30 unique character/mode questions are sampled, with balanced mode counts. Small selections produce fewer questions. A secondary expandable section retains single-mode practice and the Hear/Write/Pinyin quiz. Cram bypasses unlocks and flashcard due dates. Earned stars and per-skill learning records persist. Normal selected characters and the saved daily session are not replaced. Unit selections save immediately per child and grade, including added-grade units, and survive refresh before a session starts. Clear and All selections also persist. The question queue and completed-answer cursor survive reload; Resume cram on Home continues the same session. Unsubmitted drawings restart the current question. All unit quizzes are also accessible from every grade's home screen.

**Pronunciation:** Grown-ups → Pronunciation voice offers **Browser default Mandarin**, individual browser-exposed Mandarin voices, and **Google Cloud TTS recordings** (the bundled original audio files). Browser default requests Mandarin without forcing a named voice; it is not a promise to use the voice selected in iOS Accessibility. The sample plays 狗, 子, and 假. Ambiguous characters use word context with browser speech. Exact duplicate voice entries are collapsed; distinct same-name entries are labeled as variants and retain separate selection identities. Existing saved voice URI preferences still work.

Downloaded iPhone/iPad Accessibility voices can be absent from Safari's speech API even when installed and enabled ([WebKit issue 290497](https://bugs.webkit.org/show_bug.cgi?id=290497)). Refreshing or returning from Settings rechecks the browser catalog, but the app cannot force an unexposed voice such as Lanlan to appear. **Browser voice report** shows the unfiltered catalog to distinguish a browser limitation from filtering. It contains voice metadata only, not kids' progress. Voice preferences stay local to this browser/device. A missing previously selected voice is explicitly labeled and uses browser-default Mandarin until available again. If speech synthesis itself is unsupported, playback uses the Google Cloud recordings. These audio files were not regenerated or acoustically verified.

Pinyin quizzes accept each listed reading independently (including jià and jiǎ for 假), preserve ü, and offer an explicit neutral-tone button. Listen choices exclude known homophones. Speech from a previous screen is cancelled on navigation.

Implementation helpers: `practice.js` (pure data rules), `speech.js` (audio and device voices), `cram.js` (unit selection), `learning.js` (learning evidence and scheduling), `review.js` (session persistence and parent dashboard). Tests run with no npm dependencies. Browser integration tests optionally require Playwright and a Chromium installation: `PLAYWRIGHT_MODULE=/path/to/playwright-core CHROMIUM_PATH=/path/to/chrome node tests/browser.cjs` with the preview server running. They use isolated synthetic profiles, not your browser's saved progress.

“My Characters” displays full PDF units for the current grade and for additional selected characters from other grades. Extra characters that have no PDF unit are explicitly labeled Supplemental practice. Stars are shown from saved progress even when a character is outside the active practice selection. Displaying a full unit does not automatically add its remaining characters to normal practice.

Voice-picker UI regressions can be run with the same Playwright environment using `node tests/voices-browser.cjs`. Its simulated catalog tests duplicate variants and delayed Lanlan availability; it does not verify actual iOS audio quality or availability.

Learning and mastery: all practice modes record per-character skill outcomes. Daily practice prioritizes due skills and introduces at most three new characters per session; manual practice also prioritizes due reviews. Successful scheduled reviews use 1, 3, 7, 14, 30, then 60-day intervals. Mistakes/help return a skill in ten minutes, and same-day repetition cannot increase its spaced level. Intervals count elapsed days, not sessions; extra same-day sessions record evidence without advancing the interval early. Tracing tolerates two rejected strokes without Show me, matching the memory-mode tolerance. Stars and zoo rewards remain separate. Mastery requires three spaced successes in listening and writing recall, plus pinyin for characters first introduced in Grade 2 or later (earliest official curriculum grade, with catalog grade fallback for supplemental characters); self-rated writing evidence is labeled.

Hold the gear, then choose **Parent dashboard** to view local child profiles, grade/unit mastery, due characters, recent results and skill histories. Earlier reward points are labeled Previously practiced; no detailed past evidence is invented. Records and resumable cram sessions are included in existing backups. There is no cross-device sync. `tests/learning-browser.cjs` verifies cap, saved queue/cursor, single scoring, skill outcomes, local profile isolation, dashboard layout and pinyin resume.

Grade 2–5 daily practice includes combined Hear/Write/Pinyin questions, prioritizing due or missing writing/pinyin evidence. A combined question records writing and pinyin independently and counts as one session activity. Mixed cram balances five modes (six each in a full30-question session); K/Grade1 retain four. Both daily and mixed-cram queues resume combined questions after refresh; unsubmitted drawings/tiles restart. Existing saved queues keep their original questions—start a new session to get the new mix.

Grade2–5 children have a discreet **My progress** link on Home. It opens their own read-only mastery view, with simpler explanations and no child switcher. Parent dashboard access remains in Grown-ups for every grade. Cram settings are reloaded from saved state when opening the picker; routine saves merge the latest unit selections so a stale tab cannot overwrite them. App scripts/styles now have versioned URLs to avoid mixing cached releases. Reload open tabs after updating.

满 remains mǎn (third tone) and is included in the voice preview. The one-character speech workaround was removed: the reported pronunciation mismatches vary by voice and affect multiple characters. Device voices have not been acoustically verified against the curriculum. Displayed pinyin is curriculum data, not speech transcription.

Feedback stays static: **Report a problem** below the current screen captures question/pinyin/mode, grade, app version, browser and requested voice/prompt, plus a typed note. **Save on this device** keeps the latest50 reports separately in localStorage (no automatic upload, child names, or progress snapshot). Grown-ups → Feedback / saved reports opens the same form; View saved feedback exports a batch. Copy, downloadable text and native sharing when available let a parent bring the report into ChatGPT. Plain-HTTP clipboard fallback exposes selectable text. Reports are not included in learning-progress backups; export them separately. No automatic screenshot/audio capture or direct delivery to Codex.


Every child sees **My badges** and progress toward the next practice ribbon on Home and during questions. A ribbon is earned for every 10 graded skill steps, including helped attempts and mistakes; skips do not count. Hear/Write/Pinyin contributes two independently graded skills. Practice challenges reward variety, listening, writing/tracing and collecting characters without a calendar gate. Streak badges remain optional bonuses in the zoo.

Permanent character badges start after two independent correct answers in each required badge skill: listening for K, listening plus writing recall for Grade1+, and pinyin for Grade2+ learners when the character first appears in Grade2 or later. Writing recall combines memory and self-rated writing successes. Bronze can be earned in one day; silver and gold require scheduled skill levels2 and3. Badges stay earned after mistakes or overdue reviews. Dashboard mastery and review timing remain separate and unchanged. Existing detailed learning records receive credit automatically; historical stars alone cannot reconstruct skill evidence. Rewards are stored per child and included in progress backups.

See CHANGELOG.md for the reconstructed Git stages and their provenance. The original author’s Git history was unavailable; grouped reconstruction commits are explicitly distinguished from subsequent development.

Dictation shows an English meaning clue before answering, in standalone, daily and cram sessions. This distinguishes homophones such as 祖 (ancestor) and 组 (group) without revealing the character or pinyin. Device speech quality still depends on the selected browser voice; feedback captures requested speech, not recorded audio.

## Mandarin Grove identity

The orange-fruited tree grows from an open violet book marked 中文 (Chinese). The default/dark icon uses charcoal with a cream tree; the light icon uses cream with a charcoal tree. Both source variants are in `assets/brand/`, created with image generation and exported at the required web sizes. The web app currently uses the default/dark variant. Brand colors draw on mdview and Highgain: charcoal `#14161C`, paper cream `#F4F1EA`, orange `#F97316`, and violet `#AD96DC`. The palette is independent of the sports teams' marks. Existing local progress keys, quiz settings, learning records, and rewards remain compatible. The GitHub repository retains its existing address.

Browser and iOS Home Screen names/icons now use Mandarin Grove. An existing iOS Home Screen shortcut may retain its saved label or icon; if it does, back up progress, open the same app address in Safari, and add a fresh Home Screen shortcut. Restore a backup if the standalone shortcut uses a separate storage container. A manifest supplies installation metadata; it does not add offline caching or background sync.
