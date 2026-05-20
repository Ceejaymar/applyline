import { type ApplylineJobDraft, type ApplylineTarget, type SaveDraftMessage } from "./shared/job-draft";

const DEFAULT_TARGET: ApplylineTarget = "local";
const DRAFT_STORAGE_PREFIX = "applylineDraft:";
const APPLYLINE_ORIGINS: Record<ApplylineTarget, string> = {
  local: "http://localhost:3000",
  production: "https://applyline.vercel.app",
};

async function getTargetBaseUrl(target: ApplylineTarget) {
  return APPLYLINE_ORIGINS[target] ?? APPLYLINE_ORIGINS[DEFAULT_TARGET];
}

function createDraftId() {
  return `draft_${crypto.randomUUID()}`;
}

function draftStorageKey(draftId: string) {
  return `${DRAFT_STORAGE_PREFIX}${draftId}`;
}

async function openOrFocusCapturePage(baseUrl: string, draftId: string, sourceTab?: ChromeTab) {
  const captureUrl = `${baseUrl}/capture?draftId=${encodeURIComponent(draftId)}`;
  const [existingTab] = await chrome.tabs.query({ url: `${baseUrl}/capture*` });

  if (existingTab?.id) {
    await chrome.tabs.update(existingTab.id, {
      active: true,
      url: captureUrl,
    });
    return;
  }

  await chrome.tabs.create({
    active: true,
    index: sourceTab?.index !== undefined ? sourceTab.index + 1 : undefined,
    openerTabId: sourceTab?.id,
    url: captureUrl,
  });
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) {
    return;
  }

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["content/overlay.js"],
  });
});

function isSaveDraftMessage(message: unknown): message is SaveDraftMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === "APPLYLINE_SAVE_DRAFT" &&
    "draft" in message &&
    isJobDraft(message.draft) &&
    "target" in message &&
    (message.target === "local" || message.target === "production")
  );
}

function isJobDraft(draft: unknown): draft is ApplylineJobDraft {
  return (
    typeof draft === "object" &&
    draft !== null &&
    "title" in draft &&
    typeof draft.title === "string" &&
    "companyName" in draft &&
    typeof draft.companyName === "string" &&
    "link" in draft &&
    typeof draft.link === "string" &&
    "capturedAt" in draft &&
    typeof draft.capturedAt === "string"
  );
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isSaveDraftMessage(message)) {
    return false;
  }

  void (async () => {
    try {
      const baseUrl = await getTargetBaseUrl(message.target);
      const draftId = createDraftId();

      await chrome.storage.local.set({
        applylineTarget: message.target,
        [draftStorageKey(draftId)]: {
          createdAt: new Date().toISOString(),
          draft: message.draft,
        },
      });
      await openOrFocusCapturePage(baseUrl, draftId, sender.tab);
      sendResponse({ ok: true, draftId });
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "Could not open Applyline.",
      });
    }
  })();

  return true;
});
