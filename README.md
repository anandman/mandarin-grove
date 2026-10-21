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
- `version-check.js` and `version.txt`: original update notification mechanism.
- `audio/` and `strokes/`: recovered curriculum assets.
- `icon*.png`: Mandarin Grove orchard/book identity at browser, installation, and native source sizes.
- `manifest.webmanifest`: standalone installation name, colors, and icons.
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

**Daily practice** guides up to 10 activities from the active practice selection, prioritizing due skills and introducing up to three new characters. **Unit review** lets the child choose arbitrary units for up to 30 random activities balanced across the modes. Both update the same skill progress, spaced-review schedule and rewards; adding units remains a manual choice. “Daily practice or unit review?” on Home explains the distinction. Draw from Memory shows pinyin and meaning with stroke checking; Listen & Write uses audio and meaning, checks supplied pinyin and lets the child self-rate their handwriting.

Home shows Trace, Listen & Tap, Flip Cards and Draw from Memory for every grade, including kindergarten. Grade 2+ also has a direct **Listen & Write** path (Character + pinyin) using the active practice characters. Five paths fill a desktop row; the fifth uses a short full-width row on phones and smaller tablets. School quizzes remain available separately. Your grove uses **Build**, five decoration areas and **Stamps** tabs; your last category saves per child. Arrow keys, Home and End navigate the tabs. **Arrange your grove** opens the current decorations; **Pieces & prices** opens a project's full plan. Tap a decoration’s name for its description. Star a goal, or tap its filled star to clear it. Orange history, earlier-star credit and sentence counts live under Stamps.

Unit review keeps Start and the selected count above a scrollable multi-unit picker. Writing ideas keeps its prompt and sentence reward together, and iPad dictation places full-size handwriting beside pinyin. Short explanations open when needed. Smaller screens and expanded details can still scroll; handwriting and character targets remain usable.

## Adding units at school or at home

Home shows **Ready for more** once every character in the current practice unit has two independent successes in its grade's badge skills. Kindergarten requires listening; Grade 1 adds writing recall; Grade 2 and up add pinyin for characters first introduced in Grade 2 or later. Recall combines memory and self-rated writing successes. Same-day sessions count toward readiness, while spaced-review mastery keeps its existing elapsed-day requirements.

**Add another unit** opens a picker; nothing advances silently. **Choose units** is also available before readiness, and **My characters → any unit → Practice this unit** still works. Follow the current school week for as long as needed, choose units out of order, or explore ahead. Adding a unit retains earlier characters for review and does not change the assigned quiz or test date.

## Writing ideas

Choose **Writing ideas** on Home and type a Chinese character or whole word. A character can suggest related words; a compound must match a listed word as a whole. Traditional input aliases are accepted and suggestions display simplified Chinese. Browse available words by meaning or choose a character if you need a starting point. Ideas vary without repeating until that input's collection has been used.

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

**Unit review** lets each child check any number of units or supplemental sets shown in My Characters, including added units from other grades, nonconsecutive units, or all units/sets. The picker groups choices by grade; same-number units from different grades can be selected independently. **Start mixed review** mixes Listen & Tap, Trace, Flip Cards, and Draw from Memory, plus Listen & Write for Grade 2–5 profiles, question by question in one shuffled session: up to 30 unique character/mode questions are sampled, with balanced mode counts. Small selections produce fewer questions. A secondary expandable section retains single-mode practice and the Listen & Write quiz. Questions are sampled independently of due dates; answers still update the shared learning record. Earned stars and per-skill learning records persist. Normal selected characters and the saved daily session are not replaced. Unit selections save immediately per child and grade, including added-grade units, and survive refresh before a session starts. Clear and All selections also persist. The question queue and completed-answer cursor survive reload; Resume unit review on Home continues the same session. Unsubmitted drawings restart the current question. All unit quizzes are also accessible from every grade's home screen.

**Pronunciation:** Grown-ups → Pronunciation voice offers **Browser default Mandarin**, individual browser-exposed Mandarin voices, and **Google Cloud TTS recordings** (the bundled original audio files). Browser default requests Mandarin without forcing a named voice; it is not a promise to use the voice selected in iOS Accessibility. The sample plays 狗, 子, and 假. Ambiguous characters use word context with browser speech. Exact duplicate voice entries are collapsed; distinct same-name entries are labeled as variants and retain separate selection identities. Existing saved voice URI preferences still work.

Downloaded iPhone/iPad Accessibility voices can be absent from Safari's speech API even when installed and enabled ([WebKit issue 290497](https://bugs.webkit.org/show_bug.cgi?id=290497)). Refreshing or returning from Settings rechecks the browser catalog, but the app cannot force an unexposed voice such as Lanlan to appear. **Browser voice report** shows the unfiltered catalog to distinguish a browser limitation from filtering. It contains voice metadata only, not kids' progress. Voice preferences stay local to this browser/device. A missing previously selected voice is explicitly labeled and uses browser-default Mandarin until available again. If speech synthesis itself is unsupported, playback uses the Google Cloud recordings. These audio files were not regenerated or acoustically verified.

Pinyin quizzes accept each listed reading independently (including jià and jiǎ for 假), preserve ü, and offer an explicit neutral-tone button. Listen choices exclude known homophones. Speech from a previous screen is cancelled on navigation.

Implementation helpers: `practice.js` (pure data rules), `speech.js` (audio and device voices), `cram.js` (unit selection), `learning.js` (learning evidence and scheduling), `review.js` (session persistence and parent dashboard). Tests run with no npm dependencies. Browser integration tests optionally require Playwright and a Chromium installation: `PLAYWRIGHT_MODULE=/path/to/playwright-core CHROMIUM_PATH=/path/to/chrome node tests/browser.cjs` with the preview server running. They use isolated synthetic profiles, not your browser's saved progress.

“My Characters” displays full PDF units for the current grade and for additional selected characters from other grades. Extra characters that have no PDF unit are explicitly labeled Supplemental practice. Stars are shown from saved progress even when a character is outside the active practice selection. Displaying a full unit does not automatically add its remaining characters to normal practice.

Voice-picker UI regressions can be run with the same Playwright environment using `node tests/voices-browser.cjs`. Its simulated catalog tests duplicate variants and delayed Lanlan availability; it does not verify actual iOS audio quality or availability.

Learning and mastery: all practice modes record per-character skill outcomes. Daily practice prioritizes due skills and introduces at most three new characters per session; manual practice also prioritizes due reviews. Successful scheduled reviews use 1, 3, 7, 14, 30, then 60-day intervals. Mistakes/help return a skill in ten minutes, and same-day repetition cannot increase its spaced level. Intervals count elapsed days, not sessions; extra same-day sessions record evidence without advancing the interval early. Tracing tolerates two rejected strokes without Show me, matching the memory-mode tolerance. Stars and zoo rewards remain separate. Mastery requires three spaced successes in listening and writing recall, plus pinyin for characters first introduced in Grade 2 or later (earliest official curriculum grade, with catalog grade fallback for supplemental characters); self-rated writing evidence is labeled.

Hold the gear, then choose **Parent dashboard** to view local child profiles, grade/unit mastery, due characters, recent results and skill histories. Earlier reward points are labeled Previously practiced; no detailed past evidence is invented. Records and resumable unit review sessions are included in existing backups. There is no cross-device sync. `tests/learning-browser.cjs` verifies cap, saved queue/cursor, single scoring, skill outcomes, local profile isolation, dashboard layout and pinyin resume.

Grade 2–5 daily practice includes combined Listen & Write questions, prioritizing due or missing writing/pinyin evidence. A combined question records writing and pinyin independently and counts as one session activity. Mixed unit review balances five modes (six each in a full30-question session); K/Grade1 retain four. Both daily and mixed unit review queues resume combined questions after refresh; unsubmitted drawings/tiles restart. Existing saved queues keep their original questions—start a new session to get the new mix.

Grade2–5 children have a discreet **My progress** link on Home. It opens their own read-only mastery view, with simpler explanations and no child switcher. Parent dashboard access remains in Grown-ups for every grade. Unit review settings are reloaded from saved state when opening the picker; routine saves merge the latest unit selections so a stale tab cannot overwrite them. App scripts/styles now have versioned URLs to avoid mixing cached releases. Reload open tabs after updating.

满 remains mǎn (third tone) and is included in the voice preview. The one-character speech workaround was removed: the reported pronunciation mismatches vary by voice and affect multiple characters. Device voices have not been acoustically verified against the curriculum. Displayed pinyin is curriculum data, not speech transcription.

Feedback stays static: **Report a problem** below the current screen captures question/pinyin/mode, grade, app version, browser and requested voice/prompt, plus a typed note. **Save on this device** keeps the latest50 reports separately in localStorage (no automatic upload, child names, or progress snapshot). Grown-ups → Feedback / saved reports opens the same form; View saved feedback exports a batch. Copy, downloadable text and native sharing when available let a parent bring the report into ChatGPT. Plain-HTTP clipboard fallback exposes selectable text. Reports are not included in learning-progress backups; export them separately. No automatic screenshot/audio capture or direct delivery to Codex.


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

`npm run build` exports the files listed in `scripts/static-files.json`, plus approved audio/stroke assets, into `dist/`. The local preview and export share that allowlist. Agent notes, tests, backups, exports, source history and project metadata are not published. `vercel.json` builds and serves only `dist/`; no application backend or paid model service is required.

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
