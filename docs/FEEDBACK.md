# Direct app feedback

Choose **Report a problem**, tap **Sound seems wrong**, **Meaning is confusing**, or **Something did not work**, and then tap **Send report**. A note is optional. Choosing a category, closing the dialog, reopening the app, and editing a note do not upload anything.

A report shares the selected category and note, app version, grade, current question or writing idea, requested voice settings, browser description, and session position with the app maker through a private GitHub issue. It does not include a child's profile name, identifier, progress history, recordings, screenshots, cookies, or a full backup. Typed notes can contain personal information, so the dialog asks users to leave it out. Requested voice metadata cannot prove what audio was actually heard.

**Sent to the app maker** appears only after the server confirms a GitHub issue receipt. An offline, unconfigured, or unsuccessful request remains marked **Not sent** or **Not sent or confirmed**, with a copy saved on the device and explicit **Retry** controls. A lost response can mean the issue was created but not confirmed locally; retry uses the same report ID. Nothing retries in the background. The latest 50 reports are kept locally, and an unsent report is never silently evicted to make space. When all 50 are awaiting confirmation, retry those reports first; new reports cannot be saved while that queue is full.

**Grown-ups: saved reports & manual sharing** retains the local-only save, raw report view, copy, native share (when available), and download helpers. Existing local reports remain readable; they are not automatically uploaded. Local feedback is browser storage, separate from learning backups.

## Owner setup on Vercel

The endpoint always uses `anandman/mandarin-grove`. It checks that the repository is still private before creating an issue. No child login or database is required.

1. Create a **new fine-grained personal access token** at [GitHub's token settings](https://github.com/settings/personal-access-tokens/new). Set resource owner to `anandman`, select **Only select repositories → mandarin-grove**, and enable **Repository permissions → Issues → Read and write**. Metadata read access is implicit. Use an expiration you can maintain. Do not reuse a broad GitHub CLI login, classic PAT, or OAuth token.
2. In the [Mandarin Grove Vercel project environment settings](https://vercel.com/anandmans-projects/mandarin-grove/settings/environment-variables), add `GH_FEEDBACK_TOKEN` as a **Sensitive** server environment variable for **Production**. Paste it directly into Vercel; do not put it in chat, source files, a public build variable, or browser storage. The function accepts the `github_pat_` fine-grained token format.
3. The allowed origin defaults to `https://mandarin-grove.vercel.app`. For a deliberate custom domain or local function development, set `FEEDBACK_ALLOWED_ORIGINS` to the exact comma-separated origins, including the production origin if it should continue working. There are no wildcard or reflected origins. Only add preview secrets/origins deliberately; unconfigured previews safely retain unsent reports.
4. Redeploy after adding or changing environment variables. `api/feedback.js` deploys as a Node.js Vercel Function alongside the static `dist` output. It is not copied into `dist`. `vercel.json` keeps the existing static build and gives this function 30 seconds. No package dependency or paid storage service is added.
5. Send a short synthetic report from the production app. Check that its issue appears in the private repository and the UI shows **Sent to the app maker**. A local mock test is not proof of production delivery. Until the scoped secret is configured and this check passes, treat direct delivery as unconfigured.

Missing/invalid token configuration returns a safe `503` response. The UI keeps the report locally and says sending is not set up. Token rotation/expiry and disabled repository issues can also prevent delivery; errors never return credentials or GitHub response details to the browser. Standard hosting and GitHub usage limits still apply.

## Validation, retries, and limits

The function accepts only same-origin JSON POSTs from the explicit origin allowlist, with a 16 KiB body limit and bounded allowlisted fields. It rejects profile names, progress objects, arbitrary issue destinations, labels, and assignees. All supplied content is escaped inside one preformatted data block, with an explicit untrusted-input notice for human and automated triage. Logs contain only a generic failure message. No raw report or IP address is logged by application code; Vercel and GitHub still process requests under their own service policies.

Retry deduplication checks report ID markers among the newest 100 repository issues, including closed issues, and coalesces simultaneous retries within one function instance. This is best-effort deduplication: concurrent requests on separate instances or a very old retry outside that window can still create duplicates. The same per-instance limitation applies to the small abuse cap of 10 attempts per source in 10 minutes. Origin checks restrict browser callers; they are not authentication against scripted clients. Stronger public abuse protection would require a platform rate rule or shared limiter. No claim of exactly-once delivery or distributed throttling is made.

The static Python preview does not run Vercel Functions. Use `vercel dev` with a privately configured test token for a real local endpoint, or run the automated tests below, which use synthetic data and mocked GitHub responses.

```sh
node tests/feedback-api.test.cjs
APP_URL=http://127.0.0.1:4181 node tests/feedback-send-browser.cjs
APP_URL=http://127.0.0.1:4181 node tests/feedback-browser.cjs
```

Browser tests require Playwright/Chromium as documented in the project test setup; optional `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` variables can point to an existing installation. They use isolated synthetic profiles and never create live GitHub issues.

References: [Vercel frameworkless Functions](https://vercel.com/docs/functions/quickstart), [Node.js handlers and parsed bodies](https://vercel.com/docs/functions/runtimes/node-js), [GitHub issue creation permissions](https://docs.github.com/en/rest/issues/issues#create-an-issue).
