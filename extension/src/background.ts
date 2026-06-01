import {
  APPLYLINE_ORIGINS,
  type ApplylineJobDraft,
  type ApplylineTarget,
  type SaveDraftMessage,
} from "./shared/job-draft";

async function getTargetBaseUrl(target: ApplylineTarget) {
  return APPLYLINE_ORIGINS[target] ?? APPLYLINE_ORIGINS.production;
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

async function createCaptureDraft(baseUrl: string, draft: ApplylineJobDraft) {
  const response = await fetch(`${baseUrl}/api/capture-drafts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ draft }),
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      typeof body?.error === "string"
        ? body.error
        : "Could not create Applyline capture draft.",
    );
  }

  if (typeof body?.draftId !== "string" || !body.draftId) {
    throw new Error("Applyline did not return a capture draft token.");
  }

  return body.draftId;
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
      const draft = message.draft;

      if (import.meta.env.DEV) {
        console.info("[Applyline Clipper] creating server capture draft", {
          companyName: draft.companyName,
          descriptionLength: draft.description?.length ?? 0,
          target: message.target,
          title: draft.title,
        });
      }

      await chrome.storage.local.set({
        applylineTarget: message.target,
      });
      const draftId = await createCaptureDraft(baseUrl, draft);
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
