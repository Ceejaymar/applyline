const DRAFT_STORAGE_PREFIX = "applylineDraft:";
const RETRY_INTERVAL_MS = 250;
const MAX_RETRY_MS = 30_000;
const DEBUG = import.meta.env.DEV;

type StoredDraft = {
  createdAt: string;
  draft: unknown;
};

type AppCaptureMessage = {
  draftId: string;
  source: "applyline-app";
  type:
    | "APPLYLINE_CAPTURE_READY"
    | "APPLYLINE_CAPTURE_RECEIVED"
    | "APPLYLINE_CAPTURE_SAVED";
};

function debugLog(message: string, data?: Record<string, unknown>) {
  if (!DEBUG) {
    return;
  }

  console.info(`[Applyline Capture Bridge] ${message}`, data ?? {});
}

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

function isAppCaptureMessage(message: unknown): message is AppCaptureMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    "source" in message &&
    message.source === "applyline-app" &&
    "type" in message &&
    (message.type === "APPLYLINE_CAPTURE_READY" ||
      message.type === "APPLYLINE_CAPTURE_RECEIVED" ||
      message.type === "APPLYLINE_CAPTURE_SAVED") &&
    "draftId" in message &&
    typeof message.draftId === "string"
  );
}

function getDescriptionLength(draft: unknown) {
  if (typeof draft !== "object" || draft === null || !("description" in draft)) {
    return 0;
  }

  const description = (draft as { description?: unknown }).description;
  return typeof description === "string" ? description.length : 0;
}

function postDraftToPage(draftId: string, draft: unknown, reason: string) {
  debugLog("posting APPLYLINE_JOB_DRAFT", {
    descriptionLength: getDescriptionLength(draft),
    draftId,
    reason,
  });

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

let currentDraft: unknown;
let currentDraftId: string | undefined;
let retryIntervalId: number | undefined;
let retryStartedAt = 0;
let hasCaptureReceived = false;

function stopPostingDraft() {
  if (retryIntervalId !== undefined) {
    window.clearInterval(retryIntervalId);
    retryIntervalId = undefined;
  }
}

function startPostingDraft(draftId: string, draft: unknown) {
  currentDraft = draft;
  currentDraftId = draftId;
  hasCaptureReceived = false;
  retryStartedAt = Date.now();
  stopPostingDraft();
  postDraftToPage(draftId, draft, "initial");

  retryIntervalId = window.setInterval(() => {
    if (hasCaptureReceived) {
      stopPostingDraft();
      return;
    }

    if (Date.now() - retryStartedAt >= MAX_RETRY_MS) {
      debugLog("stopping draft retry after timeout", { draftId });
      stopPostingDraft();
      return;
    }

    postDraftToPage(draftId, draft, "retry");
  }, RETRY_INTERVAL_MS);
}

async function loadDraft() {
  if (!window.location.pathname.startsWith("/capture")) {
    return;
  }

  const draftId = getDraftId();

  debugLog("bridge loaded", {
    currentUrl: window.location.href,
    draftId,
  });

  if (!draftId) {
    return;
  }

  const key = draftStorageKey(draftId);

  debugLog("loading draft from storage", { draftId, storageKey: key });

  chrome.storage.local.get(key, (items) => {
    const storedDraft = items[key];
    const draftFound = isStoredDraft(storedDraft);

    debugLog("draft storage lookup complete", {
      descriptionLength: draftFound ? getDescriptionLength(storedDraft.draft) : 0,
      draftFound,
      draftId,
      storageKey: key,
    });

    if (draftFound) {
      startPostingDraft(draftId, storedDraft.draft);
      return;
    }

    window.postMessage(
      {
        source: "applyline-extension",
        type: "APPLYLINE_JOB_DRAFT_MISSING",
        draftId,
      },
      window.location.origin,
    );
  });
}

window.addEventListener("message", (event: MessageEvent<unknown>) => {
  if (event.source !== window || !isAppCaptureMessage(event.data)) {
    return;
  }

  const message = event.data;

  if (message.type === "APPLYLINE_CAPTURE_READY") {
    debugLog("received APPLYLINE_CAPTURE_READY", { draftId: message.draftId });

    if (
      currentDraft &&
      currentDraftId === message.draftId &&
      !hasCaptureReceived
    ) {
      postDraftToPage(message.draftId, currentDraft, "ready");
    }

    return;
  }

  if (message.type === "APPLYLINE_CAPTURE_RECEIVED") {
    debugLog("received APPLYLINE_CAPTURE_RECEIVED", { draftId: message.draftId });
    hasCaptureReceived = true;
    stopPostingDraft();
    return;
  }

  debugLog("received APPLYLINE_CAPTURE_SAVED", { draftId: message.draftId });
  hasCaptureReceived = true;
  stopPostingDraft();
  const storageKey = draftStorageKey(message.draftId);

  void chrome.storage.local.remove(storageKey).then(() => {
    debugLog("removed draft from storage", {
      draftId: message.draftId,
      storageKey,
    });
  });
});

void loadDraft();
