import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createRoot } from "react-dom/client";

import { extractJobDraft } from "./extract-page";
import {
  APPLYLINE_ORIGINS,
  cleanInlineText,
  cleanMultilineText,
  type ApplylineJobDraft,
  type ApplylineTarget,
  type SaveDraftMessage,
} from "../shared/job-draft";

const HOST_ID = "applyline-clipper-root";
const CLOSE_EVENT = "applyline-clipper-close";

type SaveState = "idle" | "saving" | "saved" | "error";

const SOURCE_OPTIONS = [
  { id: "source_linkedin", name: "LinkedIn" },
  { id: "source_indeed", name: "Indeed" },
  { id: "source_wellfound", name: "Wellfound" },
  { id: "source_greenhouse", name: "Greenhouse" },
  { id: "source_lever", name: "Lever" },
  { id: "source_workday", name: "Workday" },
  { id: "source_company_website", name: "Current page" },
  { id: "source_other", name: "Other" },
];

function emptyToUndefined(value: string) {
  const clean = cleanInlineText(value);
  return clean ? clean : undefined;
}

function multilineEmptyToUndefined(value: string) {
  const clean = cleanMultilineText(value);
  return clean ? clean : undefined;
}

function parseTags(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map(cleanInlineText)
        .filter(Boolean),
    ),
  );
}

function normalizeDraft(draft: ApplylineJobDraft, tagsText: string): ApplylineJobDraft {
  const timestamp = new Date().toISOString();

  return {
    ...draft,
    title: cleanInlineText(draft.title),
    companyName: cleanInlineText(draft.companyName),
    link: cleanInlineText(draft.link),
    location: emptyToUndefined(draft.location ?? ""),
    compensation: emptyToUndefined(draft.compensation ?? ""),
    description: multilineEmptyToUndefined(draft.description ?? ""),
    notes: multilineEmptyToUndefined(draft.notes ?? ""),
    tags: parseTags(tagsText),
    clientEditedAt: timestamp,
    updatedAt: timestamp,
  };
}

function Field({
  children,
  id,
  label,
}: {
  children: ReactNode;
  id: string;
  label: string;
}) {
  return (
    <div className="applyline-field">
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

function App({ initialDraft, onClose }: { initialDraft: ApplylineJobDraft; onClose: () => void }) {
  const formId = useId();
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState(initialDraft);
  const [tagsText, setTagsText] = useState(initialDraft.tags?.join(", ") ?? "");
  const [target, setTarget] = useState<ApplylineTarget>("production");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState("");
  const canSave = Boolean(cleanInlineText(draft.title) && cleanInlineText(draft.companyName));
  const targetLabel = useMemo(() => APPLYLINE_ORIGINS[target].replace(/^https?:\/\//, ""), [target]);
  const sourceLabel = draft.sourceName || "Current page";
  const confidence = draft.extractionConfidence === "high" ? "Detected" : "Needs review";
  const confidenceClass =
    draft.extractionConfidence === "high" ? "applyline-pill applyline-pill-good" : "applyline-pill";

  useEffect(() => {
    chrome.storage.local.get("applylineTarget", (result) => {
      if (result.applylineTarget === "local" || result.applylineTarget === "production") {
        setTarget(result.applylineTarget);
      }
    });
  }, []);

  useEffect(() => {
    titleInputRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function updateSource(sourceId: string) {
    const source = SOURCE_OPTIONS.find((option) => option.id === sourceId);

    setDraft((value) => ({
      ...value,
      sourceId: sourceId || undefined,
      sourceName: source?.name ?? undefined,
    }));
  }

  function openApplyline() {
    window.open(APPLYLINE_ORIGINS[target], "_blank", "noopener,noreferrer");
  }

  function updateTarget(nextTarget: ApplylineTarget) {
    setTarget(nextTarget);
    void chrome.storage.local.set({ applylineTarget: nextTarget });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSave) {
      setError("Role, company, and URL are required.");
      setSaveState("error");
      return;
    }

    if (draft.link && !URL.canParse(draft.link)) {
      setError("Enter a valid job URL.");
      setSaveState("error");
      return;
    }

    setSaveState("saving");
    setError("");

    const normalizedDraft = normalizeDraft(draft, tagsText);
    const message: SaveDraftMessage = {
      type: "APPLYLINE_SAVE_DRAFT",
      draft: normalizedDraft,
      target,
    };

    chrome.runtime.sendMessage(message, (response) => {
      const saveResponse = response as { ok: boolean; error?: string } | undefined;

      if (chrome.runtime.lastError) {
        setError(chrome.runtime.lastError.message ?? "Could not send this job to Applyline.");
        setSaveState("error");
        return;
      }

      if (!saveResponse?.ok) {
        setError(saveResponse?.error ?? "Could not send this job to Applyline.");
        setSaveState("error");
        return;
      }

      setSaveState("saved");
      window.setTimeout(onClose, 150);
    });
  }

  return (
    <div className="applyline-panel" role="dialog" aria-label="Save job to Applyline">
      <div className="applyline-header">
        <div>
          <p>{sourceLabel}</p>
          <h2>Save to Applyline</h2>
        </div>
        <button aria-label="Close Applyline clipper" className="applyline-icon-button" onClick={onClose} type="button">
          ×
        </button>
      </div>

      <div className="applyline-meta" aria-live="polite">
        <span className={confidenceClass}>{confidence}</span>
        <span>Review details before saving. Some job sites may not expose every field.</span>
      </div>

      <form onSubmit={onSubmit}>
        <div className="applyline-grid">
          <Field id={`${formId}-title`} label="Job title">
            <input
              id={`${formId}-title`}
              onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))}
              placeholder="Product Manager"
              ref={titleInputRef}
              required
              value={draft.title}
            />
          </Field>
          <Field id={`${formId}-company`} label="Company name">
            <input
              id={`${formId}-company`}
              onChange={(event) => setDraft((value) => ({ ...value, companyName: event.target.value }))}
              placeholder="Acme"
              required
              value={draft.companyName}
            />
          </Field>
        </div>

        <Field id={`${formId}-link`} label="Job URL">
          <input
            id={`${formId}-link`}
            onChange={(event) => setDraft((value) => ({ ...value, link: event.target.value }))}
            placeholder="https://..."
            type="url"
            value={draft.link}
          />
        </Field>

        <div className="applyline-grid">
          <Field id={`${formId}-source`} label="Source/platform">
            <select id={`${formId}-source`} onChange={(event) => updateSource(event.target.value)} value={draft.sourceId ?? ""}>
              {SOURCE_OPTIONS.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id={`${formId}-location`} label="Location">
            <input
              id={`${formId}-location`}
              onChange={(event) => setDraft((value) => ({ ...value, location: event.target.value }))}
              placeholder="New York, NY"
              value={draft.location ?? ""}
            />
          </Field>
        </div>

        <div className="applyline-grid">
          <Field id={`${formId}-role-type`} label="Workplace type">
            <select
              id={`${formId}-role-type`}
              onChange={(event) =>
                setDraft((value) => ({
                  ...value,
                  roleType: event.target.value ? (event.target.value as ApplylineJobDraft["roleType"]) : undefined,
                }))
              }
              value={draft.roleType ?? ""}
            >
              <option value="">Unknown</option>
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
              <option value="in_person">On-site</option>
            </select>
          </Field>
          <Field id={`${formId}-compensation`} label="Salary/compensation">
            <input
              id={`${formId}-compensation`}
              onChange={(event) => setDraft((value) => ({ ...value, compensation: event.target.value }))}
              placeholder="$120k - $150k"
              value={draft.compensation ?? ""}
            />
          </Field>
        </div>

        <Field id={`${formId}-description`} label="Description">
          <textarea
            id={`${formId}-description`}
            onChange={(event) => setDraft((value) => ({ ...value, description: event.target.value }))}
            placeholder="Responsibilities, requirements, or posting details"
            rows={4}
            value={draft.description ?? ""}
          />
        </Field>

        <Field id={`${formId}-tags`} label="Tags">
          <input
            id={`${formId}-tags`}
            onChange={(event) => setTagsText(event.target.value)}
            placeholder="frontend, referral, priority"
            value={tagsText}
          />
        </Field>

        <Field id={`${formId}-target`} label="Save target">
          <select id={`${formId}-target`} onChange={(event) => updateTarget(event.target.value as ApplylineTarget)} value={target}>
            <option value="production">Production: https://applyline.vercel.app</option>
            <option value="local">Local: http://localhost:3000</option>
          </select>
        </Field>

        <div className="applyline-footer">
          <span className="applyline-target">{targetLabel}</span>
          <div className="applyline-actions">
            <button aria-label="Save job draft to Applyline" disabled={!canSave || saveState === "saving"} type="submit">
              {saveState === "saving" ? "Opening..." : "Save to Applyline"}
            </button>
            <button aria-label="Open Applyline in a new tab" className="applyline-button-secondary" onClick={openApplyline} type="button">
              Open Applyline
            </button>
            <button aria-label="Cancel and close Applyline clipper" className="applyline-button-ghost" onClick={onClose} type="button">
              Cancel
            </button>
          </div>
        </div>

        {saveState === "saved" ? <p className="applyline-status">Opened Applyline capture.</p> : null}
        {saveState === "error" ? <p className="applyline-error">{error}</p> : null}
      </form>
    </div>
  );
}

function injectStyles(shadowRoot: ShadowRoot) {
  const style = document.createElement("style");
  style.textContent = `
    :host {
      all: initial;
      color-scheme: light;
      font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --applyline-bg: #fbfaf7;
      --applyline-panel: #ffffff;
      --applyline-ink: #20231f;
      --applyline-muted: #667067;
      --applyline-line: #ded9cc;
      --applyline-soft: #f1eee7;
      --applyline-primary: #0f766e;
      --applyline-primary-dark: #115e59;
      --applyline-danger: #b42318;
    }

    .applyline-panel {
      position: fixed;
      right: 22px;
      bottom: 22px;
      z-index: 2147483647;
      width: min(440px, calc(100vw - 32px));
      max-height: calc(100vh - 44px);
      overflow: auto;
      box-sizing: border-box;
      border: 1px solid rgba(15, 23, 42, 0.16);
      border-radius: 8px;
      background: var(--applyline-bg);
      box-shadow: 0 12px 34px rgba(15, 23, 42, 0.18), 0 1px 4px rgba(15, 23, 42, 0.12);
      color: var(--applyline-ink);
      padding: 16px;
    }

    .applyline-header,
    .applyline-footer,
    .applyline-grid,
    .applyline-meta,
    .applyline-actions {
      display: grid;
      gap: 10px;
    }

    .applyline-header {
      grid-template-columns: 1fr auto;
      align-items: start;
      margin-bottom: 12px;
    }

    .applyline-header p {
      margin: 0 0 3px;
      color: var(--applyline-muted);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .applyline-header h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 760;
      letter-spacing: 0;
      line-height: 1.1;
    }

    .applyline-meta {
      grid-template-columns: auto 1fr;
      align-items: center;
      border: 1px solid var(--applyline-line);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.64);
      color: var(--applyline-muted);
      font-size: 12px;
      font-weight: 600;
      line-height: 1.35;
      margin-bottom: 12px;
      padding: 9px 10px;
    }

    .applyline-pill {
      display: inline-flex;
      align-items: center;
      min-height: 22px;
      border: 1px solid #d7b56d;
      border-radius: 999px;
      background: #fff7df;
      color: #7a4d08;
      font-size: 11px;
      font-weight: 800;
      padding: 0 8px;
      white-space: nowrap;
    }

    .applyline-pill-good {
      border-color: #9bd1c8;
      background: #e8f7f4;
      color: var(--applyline-primary-dark);
    }

    .applyline-grid {
      grid-template-columns: 1fr 1fr;
    }

    .applyline-field {
      display: grid;
      gap: 6px;
      margin-bottom: 10px;
    }

    .applyline-field label {
      color: #30362f;
      font-size: 12px;
      font-weight: 700;
    }

    input,
    select,
    textarea {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid var(--applyline-line);
      border-radius: 6px;
      background: var(--applyline-panel);
      color: var(--applyline-ink);
      font: inherit;
      font-size: 13px;
      font-weight: 500;
      outline: none;
      padding: 9px 10px;
      transition: border-color 120ms ease, box-shadow 120ms ease;
    }

    textarea {
      min-height: 92px;
      resize: vertical;
    }

    input:focus,
    select:focus,
    textarea:focus {
      border-color: var(--applyline-primary);
      box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.14);
    }

    button {
      border: 0;
      border-radius: 6px;
      background: var(--applyline-primary);
      color: #ffffff;
      cursor: pointer;
      font: inherit;
      font-size: 13px;
      font-weight: 760;
      min-height: 38px;
      padding: 0 14px;
    }

    button:disabled {
      cursor: not-allowed;
      opacity: 0.58;
    }

    button:not(:disabled):hover {
      background: var(--applyline-primary-dark);
    }

    .applyline-icon-button {
      display: grid;
      place-items: center;
      width: 32px;
      min-height: 32px;
      padding: 0;
      background: var(--applyline-soft);
      color: #30362f;
      font-size: 22px;
      line-height: 1;
    }

    .applyline-icon-button:hover,
    .applyline-button-secondary:hover,
    .applyline-button-ghost:hover {
      background: #e5e0d4;
    }

    .applyline-button-secondary,
    .applyline-button-ghost {
      background: var(--applyline-soft);
      color: #30362f;
    }

    .applyline-button-ghost {
      background: transparent;
      border: 1px solid var(--applyline-line);
    }

    .applyline-footer {
      grid-template-columns: 1fr;
      align-items: center;
      border-top: 1px solid var(--applyline-line);
      margin-top: 4px;
      padding-top: 12px;
    }

    .applyline-actions {
      grid-template-columns: 1.16fr 1fr 0.78fr;
    }

    .applyline-target,
    .applyline-status,
    .applyline-error {
      margin: 0;
      font-size: 12px;
      font-weight: 650;
    }

    .applyline-target {
      color: var(--applyline-muted);
      overflow-wrap: anywhere;
    }

    .applyline-status {
      color: var(--applyline-primary);
      margin-top: 10px;
    }

    .applyline-error {
      color: var(--applyline-danger);
      margin-top: 10px;
    }

    @media (max-width: 520px) {
      .applyline-panel {
        right: 12px;
        bottom: 12px;
        width: calc(100vw - 24px);
      }

      .applyline-grid,
      .applyline-footer,
      .applyline-meta,
      .applyline-actions {
        grid-template-columns: 1fr;
      }
    }
  `;
  shadowRoot.append(style);
}

function mountOverlay() {
  const existingHost = document.getElementById(HOST_ID);

  if (existingHost) {
    existingHost.dispatchEvent(new Event(CLOSE_EVENT));
    return;
  }

  const host = document.createElement("div");
  host.id = HOST_ID;
  const shadowRoot = host.attachShadow({ mode: "open" });
  injectStyles(shadowRoot);
  const rootElement = document.createElement("div");
  shadowRoot.append(rootElement);
  document.documentElement.append(host);
  const root = createRoot(rootElement);

  function closeOverlay() {
    root.unmount();
    host.remove();
  }

  host.addEventListener(CLOSE_EVENT, closeOverlay, { once: true });

  root.render(
    <App
      initialDraft={extractJobDraft()}
      onClose={closeOverlay}
    />,
  );
}

mountOverlay();
