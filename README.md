# Mandarin Grove

<picture>
  <source media="(prefers-color-scheme: light)" srcset="assets/brand/mandarin-grove-light.png">
  <img src="assets/brand/mandarin-grove-dark.png" alt="Mandarin Grove: an orange-fruited tree above a violet book marked 中文" width="160">
</picture>

[Open Mandarin Grove](https://mandarin-grove.vercel.app/) · [Roadmap](https://github.com/anandman/mandarin-grove/issues/19)

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
- `version-check.js` and `version.txt`: version checks and a full-screen update prompt with explicit Update now / Keep practicing controls. Updating waits for the new offline worker to control the page; a failed download keeps the current page and offers retry. Saved profiles, progress, readings and resumable sessions stay intact. Keep practicing retains an unfinished answer without immediately repeating the same notice. Grown-ups shows the running app version. Static export rejects mismatched versions in the checker, worker or HTML asset URLs.
- `audio/` and `strokes/`: recovered curriculum assets.
- `icon*.png`: Mandarin Grove orchard/book identity at browser, installation, and native source sizes.
- `manifest.webmanifest`: standalone installation name, colors, and icons.
- `help.js`: local curriculum/dictionary lookup and the homework Help hub.
- `summary-help.js`: fixed summary-planning prompts and per-child local drafts.
- `writing.js` and `vendor/writing-spark/`: Writing ideas interface, local idea collection, source attribution, and MIT license.
- `theme.js` and `theme.css`: appearance preference, shared colors/components, and the complete Grove presentation.

Scripts remain classic scripts because the existing UI uses inline event handlers and shared globals. This preserves behavior while providing separate editable files. The initial recovery was verified to reproduce the downloaded HTML exactly; subsequent feature changes are described below. Original authoring files, repository history, and deployment configuration are not available from the website.

Progress is stored in browser localStorage. Localhost has separate storage from the deployed site. Use Grown-ups → Download backup file (or Copy backup code) on the original, then restore that file or code in the local app to transfer progress. Backups contain children's names; do not commit them.

**Compatibility principle: earned progress must survive app updates and supported backup migrations.** Original-app backups retain per-character star counts (including counts beyond five), total stars, earned zoo friends and badges, review fields, profiles and saved settings. New learning and reward systems add to that history. Unit trees recognize original character practice. An older backup cannot prove the separate listening, writing and pinyin results that the original app never recorded; those characters are labeled “Previously practiced” rather than losing their historical progress or receiving invented mastery evidence.

Keep the original backup until the restored profiles and progress have been checked. Restore replaces the saved snapshot; it does not merge an older backup with more recent practice on the destination device. Export the destination's current backup before replacing it.

`tests/legacy-backup-browser.cjs` checks the actual restore controls and backup round trip with synthetic original-format profiles, including exact legacy fields, zoo unlocks, and visible practiced trees.

## Grow your grove

Open **Your grove** beside the orange balance. Twenty decorations can be combined across five areas: sky, trees, ground, reading spot and visitors. Start with a one-orange flower patch, save for a larger feature, or build a four-piece reading nook (12 oranges total) or treehouse (14 total). Each purchased piece appears immediately. Swapping owned decorations, putting projects away and inviting already-earned zoo friends are free. A pinned goal shows the next item or project piece and how many oranges remain on Home and in the catalog.

Complete an area's four decorations to earn a permanent collection stamp. Undo the last unlock or project piece for the actual oranges paid, using the balance/Undo bar while browsing. Existing purchases, orange balances, legacy-star credits, sentence rewards and original stars remain intact; wallets, projects, goals and equipped decorations are included in each child's backup. Catalog/prices, earning policy, state changes and presentation stay separate so family feedback can change the rewards without resetting progress.

### Compact phone and tablet layout

Home has two learning entries: **Practice** and **Review**. Both open the same setup sheet for units across K–5, individual characters, activities and a question limit. Recent choices save per child, grade and entry as editable starting points. Each round snapshots its own choices, queue, first attempts and cursor, so changing another session’s setup does not rewrite a paused round. Choices collapse away during questions; **Change** opens the sheet and **Pause** preserves the round. Closing the sheet keeps the current question and unfinished input.

Practice defaults to 10 questions, prioritizing due skills within each selected activity and introducing at most three new characters. Review defaults to 30 questions sampled across the selection. Both balance the selected activities and stop at the chosen question limit (5, 10, 20 or 30), or earlier when there are fewer unique character/activity pairs. The default goal is **90% correct on first attempts**. The end screen shows Goal reached or Round finished, offers an optional separate round for missed questions, and always allows Finish. Original results remain in a bounded local history; retries do not rewrite them. Flip-card ratings and handwriting self-ratings are identified. This session goal does not replace spaced mastery or change earned rewards.

Trace, Listen & Tap, Flip Cards and Draw from Memory are selectable for every grade. Grade 2+ adds **Listen & Write**, with character handwriting and pinyin tracked separately. **Build words (组词)** is an optional activity in both flows. **Help** on Home contains character/word lookup, Writing ideas and local summary planning for homework. School unit quiz links open Review setup; legacy saved daily/unit-review/Listen & Write rounds can still be continued after importing an older backup.

Your grove keeps its category tabs, compact decorations and large preview. iPad dictation places handwriting beside pinyin; phone screens can scroll without shrinking the writing area. Appearance and all existing reward collections remain available.

## Adding units at school or at home

Choose units and individual characters explicitly before each session; school units can be studied in any order. You can include earlier units and previous grades without changing school quiz settings or erasing earlier progress. **I haven’t learned this yet** sets a character aside across activities and future/resumed rounds, without recording a wrong answer or skip. The setup sheet shows deferred characters and lets the child add them back. These preferences and eligibility choices are included in ordinary backups. A forgotten character can still receive help and spaced review; it need not be excluded.

## Homework Help

Choose **Help** on Home for a specific homework question. These tools run without model calls and do not score homework or manufacture character mastery.

**Find a character or word** searches school characters from all grades and the bundled word dictionary. Enter Chinese (including supported traditional aliases), pinyin such as `xué`, `xue2`, `nǚ`/`nv3`/`nu:3`, or an English meaning. Multiple readings remain visible. Open a result for pronunciation, available stroke guides and example words from existing curriculum/Writing ideas vocabulary. Choose known characters from one or more results, then **Practice selected** opens the ordinary session choices for that selection. Lookup alone does not alter units, learning evidence, stars or oranges. Query and temporary selection stay in the current child's browser session.

The general CC-CEDICT word bank loads only when needed and is shared with Build words. Searches run locally; typed queries are not sent to a dictionary/model service. Initial dictionary/asset loading needs a connection. School characters remain searchable if the dictionary fails, with an explicit retry. Bundled dictionary coverage and examples are not claimed to be a teacher-reviewed vocabulary list. Audio follows the shared voice setting; curriculum characters can use the reference recordings described below, while dictionary words are outside that recording set.

**Plan a summary** gives fixed prompts for the main idea, two or three important details and the child's own summary. Pasting the reading is optional; a book can stay open alongside the app. It does not generate an answer, check comprehension/grammar or award new rewards. Drafts save per child on this device and are included in normal backups. Merely opening the tool creates no saved draft. Clear draft asks for confirmation and preserves other progress. Save failures retain visible text and show an error; type again to retry after storage is available. Reading/draft text is not automatically attached to feedback reports or uploaded.

## Writing ideas

Choose **Help → Writing ideas** on Home and type a Chinese character or whole word. A character can suggest related words; a compound must match a listed word as a whole. Traditional input aliases are accepted and suggestions display simplified Chinese. Browse available words by meaning or choose a character if you need a starting point. Ideas vary without repeating until that input's collection has been used.

The orange tree and violet book frame each “writing seed”: a suggested word, its meaning, and a situation for the child to write about on paper. The collection reuses 969 curated ideas from [Writing Spark](vendor/writing-spark/README.md); it does not generate or grade a sentence. It runs locally without model calls or a writing server.

**I wrote my sentence** awards one orange on the honor system, once per displayed idea. There is no timer. This celebrates effort separately from assessed character skills: it does not advance mastery, change quiz scores, or count as a practice ribbon. Sentence counts and oranges are saved per child and included in backups; the app does not collect the child's sentence. Typed inputs and displayed ideas stay in memory unless the user explicitly saves a feedback report. Reward amounts live in `REWARD_POLICY` in `rewards.js` so they can be adjusted independently of the interface and SRS.

`tests/writing-ideas.test.cjs` checks matching and deck behavior. `tests/writing-ideas-browser.cjs` checks IME event handling, keyboard browsing, reward deduplication, progress preservation, backups, profile isolation, and responsive layout in an isolated browser. Chinese keyboard behavior on actual iPads still needs family testing.

The original credits and license links remain in the Grown-ups screen. They cover Hanzi Writer (MIT), Make Me a Hanzi stroke data and Arphic font licensing, and Google Cloud Text-to-Speech recordings. Preserve those credits and check applicable licenses before redistribution.

Validation: `npm run check` checks syntax; `npm test` covers curriculum, pinyin, speech selection and cancellation. `tests/browser.cjs` checks the five cram flows, saved progress, quiz grading, and mobile layout in an isolated browser. Real iPhone voice quality and touch handwriting still need device verification.

## LAN and Tailnet access

While `npm run dev` is running on this machine:

- Same LAN: http://192.168.50.67:4173
- Connected to the Tailnet: http://100.107.28.110:4173 or http://strixhalo.monitor-piranha.ts.net:4173

LAN addresses may change with DHCP. Tailnet access follows existing Tailscale access rules. No router port forwarding is required. The server stops when its process exits; it is not installed as a startup service.

For loopback-only access, use `npm run dev -- --host 127.0.0.1`. To change the port, use `npm run dev -- --port 4174`.

Each URL has separate browser progress storage. Use backup/restore to transfer progress. Over plain HTTP, automatic clipboard copying may be unavailable. Grown-ups → Download backup file exports the same code as a .txt file; Restore from backup file previews its profiles before you choose Replace. The manual-copy fallback has an explicit Select backup code button and selectable text.

## Curriculum and practice updates

The K–5 unit lists match [Better Immersion New Edition](https://www.pgcps.org/globalassets/schools/elementary/paint-branch/docs---paint-branch/better-immersion-chinese-character-list.pdf), pages 1–2. Starter Unit 1 is basic strokes and has no character quiz. The app does not yet include Levels 6–8 on page 3. Extra kindergarten characters remain supplemental practice. Grade 2 unit order was corrected; saved quizzes with the same characters are recognized in the new order. Progress remains keyed by character.

**Practice** and **Review** share arbitrary multi-unit, cross-grade and individual-character selection. Current setup and result behavior is described above. Existing `cfg.rs`, `cfg.cram`, `cfg.cramDict` and `cfg.cramUnits` records remain readable for older backups; new rounds and recent choices are additive fields. Untaught characters are omitted from remaining legacy questions on resume. All question formats continue to update the same per-skill learning history and earned rewards.

**Pronunciation target:** Mainland Standard Mandarin (Putonghua), Hanyu Pinyin and simplified Chinese. New/unset installations use **MSU Mainland recordings**:548 exact-reading human recordings from MSU Tone Perfect's natively curated corpus. Explicit saved voice choices are preserved. Choose MSU in Grown-ups → Pronunciation to change an existing saved voice.

These are source-reviewed recordings, not a claim that the app's automatic checker passed.521 selected readings have matching initial/final/tone checks;27 have unfinished checks and show a short pending-check notice. The checker failed its independent vowel qualification, which remains disclosed in the [verification summary](audio-sources/MSU-VERIFICATION.json). Nine neutral readings are absent from MSU and use existing Google/device audio marked unchecked. Longer words and sentences use device speech. All548selected original MP3s remain unchanged (14.1MB); the full preserved corpus stays private.

**Taiwan Mandarin recordings · optional** retains all557 CNS11643 reading-specific clips as a regional voice. Older **Google Cloud TTS recordings** and individually exposed browser voices remain available. MSU improves alignment to the Mainland target, source review and exact-reading control over variable device/character-keyed Google playback; no numerical head-to-head accuracy claim is made. Failed selected assets show a retry message without switching pronunciation. Existing characters, answers, progress and backups are unchanged.

MSU attribution and noncommercial reuse terms: [Tone Perfect citation and CC BY-NC4.0](audio-sources/LICENSE-MSU.txt). [Source comparison and verification limits](docs/AUDIO.md). The preview plays 狗,子,假 and满. Browser default still does not force a named voice or follow iOS Accessibility settings.

Downloaded iPhone/iPad Accessibility voices can be absent from Safari's speech API even when installed and enabled ([WebKit issue 290497](https://bugs.webkit.org/show_bug.cgi?id=290497)). Refreshing or returning from Settings rechecks the browser catalog, but the app cannot force an unexposed voice such as Lanlan to appear. **Browser voice report** shows the unfiltered catalog to distinguish a browser limitation from filtering. It contains voice metadata only, not kids' progress. Voice preferences stay local to this browser/device. A missing previously selected voice is explicitly labeled and uses browser-default Mandarin until available again. If speech synthesis itself is unsupported, playback uses the Google Cloud recordings. The older Google recordings and browser output do not acquire reference validation by being selectable.

Pinyin quizzes accept each listed reading independently (including jià and jiǎ for 假), preserve ü, and offer an explicit neutral-tone button. Listen choices exclude known homophones. Speech from a previous screen is cancelled on navigation.

Implementation helpers: `practice.js` (pure data rules), `speech.js` (audio and device voices), `cram.js` (unit selection), `learning.js` (learning evidence and scheduling), `review.js` (session persistence and parent dashboard). Tests run with no npm dependencies. Browser integration tests optionally require Playwright and a Chromium installation: `PLAYWRIGHT_MODULE=/path/to/playwright-core CHROMIUM_PATH=/path/to/chrome node tests/browser.cjs` with the preview server running. They use isolated synthetic profiles, not your browser's saved progress.

“My Characters” displays full PDF units for the current grade and for additional selected characters from other grades. Extra characters that have no PDF unit are explicitly labeled Supplemental practice. Stars are shown from saved progress even when a character is outside the active practice selection. Displaying a full unit does not automatically add its remaining characters to normal practice.

Voice-picker UI regressions can be run with the same Playwright environment using `node tests/voices-browser.cjs`. Its simulated catalog tests duplicate variants and delayed Lanlan availability; it does not verify actual iOS audio quality or availability.

Learning and mastery: all practice modes record per-character skill outcomes. Practice prioritizes due skills within selected activities and introduces at most three new characters per round; manual practice also prioritizes due reviews. Successful scheduled reviews use 1, 3, 7, 14, 30, then 60-day intervals. Mistakes/help return a skill in ten minutes, and same-day repetition cannot increase its spaced level. Intervals count elapsed days, not sessions; extra same-day sessions record evidence without advancing the interval early. Tracing tolerates two rejected strokes without Show me, matching the memory-mode tolerance. Stars and zoo rewards remain separate. Mastery requires three spaced successes in listening and writing recall, plus pinyin for characters first introduced in Grade 2 or later (earliest official curriculum grade, with catalog grade fallback for supplemental characters); self-rated writing evidence is labeled.

Hold the gear, then choose **Parent dashboard** to view local child profiles, grade/unit mastery, due characters, recent results and skill histories. Earlier reward points are labeled Previously practiced; no detailed past evidence is invented. Records and resumable unit review sessions are included in existing backups. There is no cross-device sync. `tests/learning-browser.cjs` verifies cap, saved queue/cursor, single scoring, skill outcomes, local profile isolation, dashboard layout and pinyin resume.

Grade 2–5 daily practice includes combined Listen & Write questions, prioritizing due or missing writing/pinyin evidence. A combined question records writing and pinyin independently and counts as one session activity. Mixed unit review balances five modes (six each in a full30-question session); K/Grade1 retain four. Both daily and mixed unit review queues resume combined questions after refresh; unsubmitted drawings/tiles restart. Existing saved queues keep their original questions—start a new session to get the new mix.

Grade2–5 children have a discreet **My progress** link on Home. It opens their own read-only mastery view, with simpler explanations and no child switcher. Parent dashboard access remains in Grown-ups for every grade. Unit review settings are reloaded from saved state when opening the picker; routine saves merge the latest unit selections so a stale tab cannot overwrite them. App scripts/styles now have versioned URLs to avoid mixing cached releases. Reload open tabs after updating.

满 remains mǎn (third tone) and is included in the voice preview. The one-character speech workaround was removed: the reported pronunciation mismatches vary by voice and affect multiple characters. Device voices have not been acoustically verified against the curriculum. Displayed pinyin is curriculum data, not speech transcription.

**Report a problem** captures the current question and requested voice metadata. Children select a problem category and explicitly tap **Send report**; an optional note can add detail. The small Vercel Function forwards reports to a fixed private GitHub inbox, without child accounts, automatic background upload or learning-history transmission. A server-confirmed receipt is required before saying Sent; unconfirmed/offline reports remain locally saved for an explicit retry. A dedicated repository-scoped server secret must be configured before live delivery works. See [Direct feedback setup and limits](docs/FEEDBACK.md). Manual copy/download/share and older local reports remain available under the grown-up disclosure. Feedback stays separate from progress backups.


Every child sees **My badges** and progress toward the next practice ribbon on Home and during questions. A ribbon is earned for every 10 graded skill steps, including helped attempts and mistakes; skips do not count. Listen & Write contributes two independently graded skills. Practice challenges reward variety, listening, writing/tracing and collecting characters without a calendar gate. Streak badges remain optional bonuses in the zoo.

Permanent character badges start after two independent correct answers in each required badge skill: listening for K, listening plus writing recall for Grade1+, and pinyin for Grade2+ learners when the character first appears in Grade2 or later. Writing recall combines memory and self-rated writing successes. Bronze can be earned in one day; silver and gold require scheduled skill levels2 and3. Badges stay earned after mistakes or overdue reviews. Dashboard mastery and review timing remain separate and unchanged. Existing detailed learning records receive credit automatically; historical stars alone cannot reconstruct skill evidence. Rewards are stored per child and included in progress backups.

See CHANGELOG.md for the reconstructed Git stages and their provenance. The original author’s Git history was unavailable; grouped reconstruction commits are explicitly distinguished from subsequent development.

Dictation shows an English meaning clue before answering, in standalone, daily and cram sessions. This distinguishes homophones such as 祖 (ancestor) and 组 (group) without revealing the character or pinyin. Device speech quality still depends on the selected browser voice; feedback captures requested speech, not recorded audio.

## Mandarin Grove identity

The orange-fruited tree grows from an open violet book marked 中文 (Chinese). The default/dark icon uses charcoal with a cream tree; the light icon uses cream with a charcoal tree. Both source variants are in `assets/brand/`, created with image generation and exported at the required web sizes. The web app currently uses the default/dark variant. Brand colors draw on mdview and Highgain: charcoal `#14161C`, paper cream `#F4F1EA`, orange `#F97316`, and violet `#AD96DC`. The palette is independent of the sports teams' marks. Existing local progress keys, quiz settings, learning records, and rewards remain compatible. The private GitHub repository is [anandman/mandarin-grove](https://github.com/anandman/mandarin-grove).

Browser and iOS Home Screen names/icons now use Mandarin Grove. An existing iOS Home Screen shortcut may retain its saved label or icon; if it does, back up progress, open the same app address in Safari, and add a fresh Home Screen shortcut. Restore a backup if the standalone shortcut uses a separate storage container. A manifest supplies installation metadata; it does not add offline caching or background sync.

## Delivery roadmap

See [the ordered roadmap](https://github.com/anandman/mandarin-grove/issues/19). Static hosting comes first, followed by the staged Grove experience and modular rewards, then an owner-reviewed Writing Spark prompt-ideas UX. Speech and tutoring services follow quality and funding evaluation.

## Static deployment

`npm run build` exports the files listed in `scripts/static-files.json`, plus approved audio/stroke assets, into `dist/`. The local preview and export share that allowlist. Agent notes, tests, backups, exports, source history and project metadata are not published. `vercel.json` serves the allowlisted frontend from `dist/` and deploys `api/feedback.js` separately as a Vercel Function. Practice, review, writing tools and progress require no model service; direct feedback uses the optional configured GitHub delivery endpoint.

### Move existing progress to the hosted app

The temporary Strixhalo server and migration service were retired on October 20, 2026, after both children’s progress was migrated. Use <https://mandarin-grove.vercel.app/>. The steps below remain as a reference for future transfers between browser origins.

1. On each child's device, open the exact old address they used (for example `http://strixhalo:4173` or `http://strixhalo.local:4173`). Use the same Safari tab or existing Home Screen app where the child's progress appears. Hold the gear to open Grown-ups, then Download backup file and save the .txt file in Files/Downloads. Copy backup code remains available too. Keep the file/code private: it includes local profile names.
2. Open <https://mandarin-grove.vercel.app/>, use Grown-ups → Restore from backup file (or paste the code), check the preview, choose Replace, and check each child's stars, selected units and learning progress.
3. Add the new address to the Home Screen. Check the installed app too and restore the same backup if it starts in a separate storage container.
4. Keep the old preview available until both children are verified at the new address; the hosted app itself has no Strixhalo dependency. No progress is sent to a server during backup/restore. If the local preview is needed for recovery, a temporary `mandarin-grove-migration.service` user service can keep it running independently of a terminal; stop it only after the actual child migrations are confirmed.

## Grove experience and rewards

The whole app uses the Grove palette, orchard Home scene, practice paths, tree cards, violet books, and matching practice, reward, dashboard and settings surfaces. Choose **Appearance** (◐) in the header or Grown-ups → Appearance: **System** follows the device automatically; **Light** and **Dark** override it. System is the default. The choice survives refresh and updates across tabs without interrupting a question, drawing, or pinyin answer. This is a browser/device preference, separate from per-child backup data. Handwriting paper stays cream in both modes so existing ink remains readable.

On first upgrade or restore, earlier work receives a **one-time credit of one orange per 10 existing stars**, rounded down, less oranges already credited from practice ribbons. For example, 149 old stars earn 14 oranges; if 12 ribbon oranges were already credited, the additional credit is 2. Stars are never spent or reduced. The credit and calculation are stored in the wallet, survive backups, and never become assessed skill evidence. Children who already upgraded receive it automatically, without restoring an old backup. New practice keeps earning oranges normally after the credit.

Practice modes have distinct tree visuals. My Characters offers a Grove view with growing unit trees and a compact List view; the preference saves per child. Every unit remains accessible in any order, including added-grade units. Tree growth reflects characters practiced and permanent badges; it does not impose curriculum locks or redefine spaced mastery.

Oranges are local reward currency: each earned practice ribbon credits one orange. Existing detailed practice/ribbons receive credit once; stars, zoo friends, badges, and learning records stay intact. The first reward catalog offers cosmetic violet leaves, a butterfly visitor, and sunrise scenery. Unlocking spends oranges, and Undo last unlock refunds the actual cost. One decoration is active at a time; owned decorations can be switched freely.

Reward code is deliberately separate for alpha feedback: `rewards.js` owns `REWARD_POLICY`, `GROVE_REWARD_CATALOG`, evidence-to-achievement rules, the versioned local wallet, and transactions. `grove.js` owns tree/reward presentation, while `learning.js` owns SRS evidence and timing. Earning-rate changes affect new ribbons, not previously credited ribbons; price changes do not alter past refund amounts. Backup/restore includes the wallet. There is no server balance, purchase, or real-money redemption.

`tests/theme-browser.cjs` checks System/Light/Dark, OS changes, persistence, active-answer preservation, contrast, handwriting paper and phone layout. The original-backup regression also checks the one-time credit and a spent wallet's export/re-import.

## Pronunciation references and experimental evaluation

**Current delivery:** source-reviewed MSU Mainland recordings cover548readings; nine neutral gaps retain unchecked fallback. Independent automatic pronunciation verification remains open; optional Taiwan recordings retain all557readings. See the Pronunciation section above and the [source manifest](audio-sources/cns11643.json).

**Experimental evaluation:** [Audio tooling and current findings](docs/AUDIO.md) describe the offline signal audit, an inconclusive small phonetic-model experiment, physical pitch controls and a bounded specialist-assessment trial. Preparing an audit requires no fluent reviewer. Actual acoustic calibration remains necessary before using model judgments to approve generated replacements. The shipped reference corpus uses independently published pronunciation labels and verified source bytes instead.

`npm run audio:plan` prepares an independently written, draft speech review set: 40 distinct characters, 12 alternate readings, and 15 short sentences, compared across two Mandarin WaveNet voices. It writes generation requests and a local listening-review page into ignored `exports/audio-pilot/`. Planning makes no service requests and changes no practice audio. The printed estimate includes SSML characters and assumes no remaining free allowance; confirm the provider rate and project billing before generating.

After configuring `GOOGLE_TTS_API_KEY` or `GOOGLE_TTS_ACCESS_TOKEN` in your local environment, run `node scripts/audio-pilot.cjs generate --max-characters 20000`. Credentials stay outside the repository and app. Generation checkpoints completed files; matching audio is reused on resume. Open `exports/audio-pilot/review.html`, have a fluent speaker check the intended readings and actual audio, and download the review. Isolated-character candidates use explicit pinyin; sentence candidates use natural synthesis to expose contextual readings and tone changes. The initial reading data is **not yet fluent-speaker reviewed**.

`node scripts/audio-pilot.cjs promote --review /path/to/audio-review.json` stages only approved clips in ignored `exports/audio-approved/`. Approvals must match the exact audio digest; changed audio needs another review. Promotion does not publish anything or replace the app's default recordings. The staged manifest preserves text, reading, voice, synthesis settings, generation time and review information. Provider voices can change without a weight-version identifier, so retain the generated files and their digests.

Primary references: [Mandarin phoneme controls](https://docs.cloud.google.com/text-to-speech/docs/phonemes#chinese_mandarin_simplified_china_cmn-hans-cn), [supported voices](https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types), [generation pricing](https://cloud.google.com/text-to-speech/pricing). The review workflow records human judgment; it does not certify pronunciation using a transcript.

## Build words · 组词

Choose **Practice** or **Review**, select your units and characters, then enable **Build words · 组词** under Activities. It can be the only activity or mixed with the others. Give **one word or short expression per question**, using **2–8 Chinese characters** including the displayed character. A single character can be a word too; this activity asks for longer answers. Recognized dictionary entries show pinyin and meaning and join that child's word collection. Traditional input is accepted where the dictionary lists it. Previously collected words can answer a new question without duplicating the collection.

Known matches contribute to the round's first-attempt score and track word-building separately in learning history and spaced review. Omitting the target character marks the first attempt as missed, including across Pause/reload. An unfamiliar expression simply says **Not in our word bank yet.**, without a reporting prompt. A previous wrong-target attempt still counts as a miss. Otherwise, continue with **Next question** to leave it ungraded: it counts toward the finite round length but creates no SRS mistake or skip, is excluded from accuracy, and does not appear in missed-question practice. A round with no checked answers cannot reach the accuracy goal. Collections, word-building history and activity choices are included in ordinary backups. Use **I don’t know a word yet** to record a missed answer honestly. Saved words are hidden until grading. Existing character-mastery requirements and reward rates stay unchanged.

Checking uses a pinned, locally hosted [CC-CEDICT](https://www.mdbg.net/chinese/dictionary?page=cc-cedict) snapshot, lazily loaded when entering the activity (about 8.8 MB before transfer compression). No typed answer is sent to a model or dictionary server. The bank recognizes listed words and expressions; it cannot certify an arbitrary expression's grammar or intended meaning. It is a general dictionary, not a teacher-reviewed lesson list. Initial loading needs a connection; a failed load provides Retry without grading the answer.

The dictionary extract is credited to MDBG and CC-CEDICT contributors under [CC BY-SA 4.0](vendor/cc-cedict/LICENSE). Its pinned download digest and extraction changes are recorded in [SOURCE.json](vendor/cc-cedict/SOURCE.json); the derivative data retains that license. `node scripts/build-word-bank.cjs /path/to/pinned-cedict.txt.gz` rebuilds the lookup bank from that licensed snapshot. Code and data for these new features were developed independently of the original author's GitHub repository.
