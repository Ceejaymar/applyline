# Applyline Chrome Extension

Applyline Clipper is a local-development Manifest V3 Chrome extension for saving job postings into Applyline. It is intended for unpacked testing, not Chrome Web Store publishing.

## Build

Install extension dependencies from inside `extension/`:

```bash
cd extension
npm install
npm run build
```

From the repo root you can also run:

```bash
npm run build:extension
npm run typecheck:extension
```

The build output is written to `extension/dist`.

The extension build must include the MVP capture draft bearer token:

```bash
VITE_EXTENSION_BEARER_TOKEN=... npm run build:extension
```

Set the same value as `EXTENSION_BEARER_TOKEN` on the Applyline server. This is an abuse barrier for the MVP, not full user authentication.

## Load In Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select `extension/dist`.
5. Pin **Applyline Clipper** if you want toolbar access.

Reload the unpacked extension after each rebuild.

## Test With Local Applyline

1. Start Applyline from the repo root:

```bash
npm run dev
```

2. Confirm Applyline is running at `http://localhost:3000`.
3. Open a job posting page in Chrome.
4. Click the Applyline extension icon.
5. Review the overlay draft.
6. Set **Save target** to **Local: http://localhost:3000**.
7. Click **Save to Applyline**.
8. The extension opens `http://localhost:3000/capture?draftId=<draftId>`.
9. Review the job in Applyline and click **Save job**.

## Test With Deployed Applyline

1. Open a job posting page in Chrome.
2. Click the Applyline extension icon.
3. Set **Save target** to **Production: https://applyline.vercel.app**.
4. Click **Save to Applyline**.
5. The extension opens `https://applyline.vercel.app/capture?draftId=<draftId>`.
6. Review the job in Applyline and click **Save job**.

## How Capture Drafts Work

Applyline stores data in IndexedDB on the Applyline origin. A content script running on a job site cannot write to that database directly.

The extension uses a short-lived server draft:

1. The overlay validates the editable draft.
2. The background service worker posts the draft to `/api/capture-drafts` on the selected Applyline target.
3. The server stores the draft temporarily and returns a random `draftId` token.
4. Chrome opens or focuses `/capture?draftId=<draftId>`.
5. Applyline fetches the draft from `/api/capture-drafts/<draftId>`, validates it, and shows the review screen.
6. After the user saves, Applyline marks the temporary draft consumed.

## Known Limitations

- Job extraction is best-effort.
- Some job sites hide content behind scripts, login walls, iframes, or dynamic rendering.
- Some pages may expose incomplete or misleading structured data.
- Always review the details in Applyline before saving.
- Direct multi-device sync requires future authentication and cloud sync; this MVP remains local-first.

## Security And Privacy

- The extension extracts page data only after you click the extension icon.
- It uses `activeTab` and `scripting` instead of broad `<all_urls>` host permissions.
- Drafts are temporary and stored server-side under random `draftId` tokens.
- The extension does not receive Supabase or Brandfetch secret keys.
- The extension sends an MVP bearer token to create capture drafts; it should be replaced with user auth later.
- Applyline does not save the draft until you confirm on the `/capture` review screen.
- Description text is treated as plain text. The app does not execute HTML from job pages.
