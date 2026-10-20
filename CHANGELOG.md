# Change history

This Git history was reconstructed on 2026-10-18 from a downloaded deployed page, saved source snapshots, and the current application. It is grouped for review; these are not original development commits or timestamps. No original author Git history was available. Original source and third-party notices are preserved. Agent notes and local development handoffs are excluded.

The original deployed HTML SHA-256 is `66061dd94928b6b0b2dd9d9a33daafd48ea0480efe05fe90de0094887c13358a`. The recovered app JavaScript and Hanzi Writer match the inline originals byte-for-byte. Later groups are functional reconstructions; some companion tooling/tests are taken from later snapshots where exact earlier copies were unavailable. They should not be represented as exact historical releases.

## Recover original deployed application

Exact downloaded single-page HTML plus recovered static assets. This is the comparison baseline, not the original author repository.

## Split recovered source and enable LAN serving

Separate unchanged inline scripts/styles into editable files and add an app-only static server plus local run commands. Serving/tooling is reconstructed from available files.

## Align curriculum and add voices and mixed cross-grade cram

Use the saved pre-learning app/cram snapshots for PDF-aligned units, pinyin grading, device voices, My Characters grouping and shuffled cross-grade cram. Companion helpers/tests reconstructed from compatible later files.

## Add spaced learning, mastery, saved sessions and mixed pinyin

Reconstruct learning records, per-skill review scheduling, parent dashboard, capped30-question cram, unit-selection persistence and Grade2+ mixed pinyin from saved snapshots. Existing reward rules are preserved at this stage.

## Add child progress, robust settings persistence and static feedback

Exact public application snapshot saved before the current reward work, including child dashboard, stale-tab selection fix, versioned assets, voice corrections and local-only feedback reports. Companion browser tests are included.

## Add everyday practice rewards (new development)

Persistent ribbon progress for every child, same-day practice challenges and permanent character badges, with later memory upgrades. Existing detailed records receive retroactive credit; skips are excluded. Mastery scheduling remains separate. The child dashboard is now available from Grade2. This is a new feature commit after the reconstructed history.

## Disambiguate dictation homophones

Show the target meaning before writing in every dictation flow, so identical pronunciations do not require guessing the intended character. Keep curriculum, pronunciation requests and tone grading unchanged.

## Rename the app Mandarin Grove

Introduce dark and light orchard/book icons with 中文 lettering, and a charcoal, cream, orange, and violet identity. Update page, install, feedback, and package branding. Keep original-source provenance, existing progress keys, quizzes, and earned rewards. Tree progression and redeemable fruit remain future design ideas.

## Host the app and grow the Grove experience

Deploy an explicit app-only static export to Vercel; keep the repository private and publish the README icon and live-app link. Add mode trees, growing unit cards, a persistent Grove/List choice and arbitrary unit access. Extract reward policy/state from learning/UI code, retro-credit one orange per existing ribbon once, and add reversible local cosmetic unlocks. Existing stars, badges, curriculum, saved quizzes and spaced mastery remain compatible. Writing ideas UX is pending owner review.
