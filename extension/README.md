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

## How The Bridge Works

Applyline stores data in IndexedDB on the Applyline origin. A content script running on a job site cannot write to that database directly.

The extension uses a small bridge:

1. The overlay validates the editable draft.
2. The background service worker stores the draft temporarily in `chrome.storage.local` with a generated `draftId`.
3. Chrome opens or focuses `/capture?draftId=<draftId>` on the selected Applyline target.
4. `content/capture-bridge.js` runs only on Applyline `/capture*` pages.
5. The bridge reads the draft from extension storage and posts it into the Applyline page with `window.postMessage`.
6. Applyline validates the draft and shows the review screen.
7. After the user saves, Applyline posts a saved acknowledgement and the bridge clears the temporary draft from extension storage.

## Known Limitations

- Job extraction is best-effort.
- Some job sites hide content behind scripts, login walls, iframes, or dynamic rendering.
- Some pages may expose incomplete or misleading structured data.
- Always review the details in Applyline before saving.
- Direct multi-device sync requires future authentication and cloud sync; this MVP remains local-first.

## Security And Privacy

- The extension extracts page data only after you click the extension icon.
- It uses `activeTab` and `scripting` instead of broad `<all_urls>` host permissions.
- The Applyline capture bridge runs only on:
  - `https://applyline.vercel.app/capture*`
  - `http://localhost:3000/capture*`
- Drafts are temporary and stored under generated `draftId` keys in extension storage.
- Applyline does not save the draft until you confirm on the `/capture` review screen.
- Description text is treated as plain text. The app does not execute HTML from job pages.
