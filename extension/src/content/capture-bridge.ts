const DRAFT_STORAGE_PREFIX = "applylineDraft:";

type StoredDraft = {
  createdAt: string;
  draft: unknown;
};

function getDraftId() {
  return new URLSearchParams(window.location.search).get("draftId");
}

function draftStorageKey(draftId: string) {
  return `${DRAFT_STORAGE_PREFIX}${draftId}`;
}

function isStoredDraft(value: unknown): value is StoredDraft {
  return (
    typeof value === "object" &&
    value !== null &&
    "draft" in value &&
    "createdAt" in value &&
    typeof value.createdAt === "string"
  );
}

function postDraftToPage(draftId: string, draft: unknown) {
  window.postMessage(
    {
      source: "applyline-extension",
      type: "APPLYLINE_JOB_DRAFT",
      draftId,
      draft,
    },
    window.location.origin,
  );
}

function startPostingDraft(draftId: string, draft: unknown) {
  let attempts = 0;
  const maxAttempts = 20;
  const intervalMs = 250;

  postDraftToPage(draftId, draft);

  const intervalId = window.setInterval(() => {
    attempts += 1;

    if (attempts >= maxAttempts) {
      window.clearInterval(intervalId);
      return;
    }

    postDraftToPage(draftId, draft);
  }, intervalMs);

  return () => window.clearInterval(intervalId);
}

let stopPostingDraft: (() => void) | undefined;

async function loadDraft() {
  const draftId = getDraftId();

  if (!draftId) {
    return;
  }

  const key = draftStorageKey(draftId);
  chrome.storage.local.get(key, (items) => {
    const storedDraft = items[key];

    if (isStoredDraft(storedDraft)) {
      stopPostingDraft = startPostingDraft(draftId, storedDraft.draft);
    } else {
      window.postMessage(
        {
          source: "applyline-extension",
          type: "APPLYLINE_JOB_DRAFT_MISSING",
          draftId,
        },
        window.location.origin,
      );
    }
  });
}

window.addEventListener("message", (event: MessageEvent<unknown>) => {
  if (event.source !== window) {
    return;
  }

  const message = event.data;

  if (typeof message !== "object" || message === null) {
    return;
  }

  if (
    !("source" in message) ||
    message.source !== "applyline-app" ||
    !("type" in message) ||
    !("draftId" in message) ||
    typeof message.draftId !== "string"
  ) {
    return;
  }

  if (message.type === "APPLYLINE_CAPTURE_RECEIVED") {
    stopPostingDraft?.();
    stopPostingDraft = undefined;
    return;
  }

  if (message.type !== "APPLYLINE_CAPTURE_SAVED") {
    return;
  }

  stopPostingDraft?.();
  stopPostingDraft = undefined;
  void chrome.storage.local.remove(draftStorageKey(message.draftId));
});

void loadDraft();
