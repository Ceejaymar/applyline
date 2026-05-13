"use client";

import type { ChangeEvent } from "react";
import { useRef, useState } from "react";
import { AlertTriangle, Database, Download, FileJson, Keyboard, MonitorCog, Upload } from "lucide-react";
import { z } from "zod";

import { ThemeToggle } from "@/components/app/theme-toggle";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  createBackupPreview,
  downloadApplylineBackup,
  downloadJobsCsv,
  importApplylineBackup,
  parseApplylineBackup,
  type ApplylineBackup,
  type BackupImportMode,
  type BackupPreview,
} from "@/lib/backup";

type ImportState = {
  backup: ApplylineBackup;
  fileName: string;
  preview: BackupPreview;
};

type StatusState = {
  tone: "error" | "success";
  message: string;
};

const previewItems: Array<{ key: keyof BackupPreview; label: string }> = [
  { key: "jobs", label: "Jobs" },
  { key: "companies", label: "Companies" },
  { key: "contacts", label: "Contacts" },
  { key: "columns", label: "Columns" },
  { key: "activities", label: "Activities" },
  { key: "sources", label: "Sources" },
];

function getImportErrorMessage(error: unknown) {
  if (error instanceof z.ZodError) {
    return `Backup validation failed: ${error.issues[0]?.message ?? "Invalid file."}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Backup could not be imported.";
}

function DataSection() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importMode, setImportMode] = useState<BackupImportMode>("merge");
  const [importState, setImportState] = useState<ImportState | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [status, setStatus] = useState<StatusState | null>(null);

  async function onExportBackup() {
    try {
      setIsBusy(true);
      setStatus(null);
      await downloadApplylineBackup();
      setStatus({ tone: "success", message: "Backup JSON exported." });
    } catch (error) {
      setStatus({ tone: "error", message: getImportErrorMessage(error) });
    } finally {
      setIsBusy(false);
    }
  }

  async function onExportCsv() {
    try {
      setIsBusy(true);
      setStatus(null);
      await downloadJobsCsv();
      setStatus({ tone: "success", message: "Jobs CSV exported." });
    } catch (error) {
      setStatus({ tone: "error", message: getImportErrorMessage(error) });
    } finally {
      setIsBusy(false);
    }
  }

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      setStatus(null);
      setIsConfirmed(false);
      const text = await file.text();
      const parsedJson = JSON.parse(text) as unknown;
      const backup = parseApplylineBackup(parsedJson);
      setImportState({
        backup,
        fileName: file.name,
        preview: createBackupPreview(backup),
      });
      setStatus({ tone: "success", message: "Backup validated. Review the preview before importing." });
    } catch (error) {
      setImportState(null);
      setStatus({ tone: "error", message: getImportErrorMessage(error) });
    } finally {
      event.target.value = "";
    }
  }

  async function onImport() {
    if (!importState || !isConfirmed) {
      return;
    }

    try {
      setIsBusy(true);
      setStatus(null);
      await importApplylineBackup(importState.backup, importMode);
      setStatus({
        tone: "success",
        message:
          importMode === "replace"
            ? "Backup imported. Local data was replaced."
            : "Backup merged. Existing records with matching IDs were skipped.",
      });
      setImportState(null);
      setIsConfirmed(false);
      setImportMode("merge");
    } catch (error) {
      setStatus({ tone: "error", message: getImportErrorMessage(error) });
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section className="grid gap-4 rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-md bg-secondary">
            <Database className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Data</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Export, restore, or move your local IndexedDB data.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 rounded-md border bg-background/55 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={isBusy} onClick={onExportBackup}>
            <Download />
            Export Backup JSON
          </Button>
          <Button disabled={isBusy} onClick={onExportCsv} variant="outline">
            <FileJson />
            Export Jobs CSV
          </Button>
          <Button
            disabled={isBusy}
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
          >
            <Upload />
            Import Backup JSON
          </Button>
          <input
            accept="application/json,.json"
            className="hidden"
            onChange={onFileChange}
            ref={fileInputRef}
            type="file"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Backup JSON includes columns, jobs, companies, contacts, job links, activities, and sources.
        </p>
      </div>

      {importState ? (
        <div className="grid gap-4 rounded-md border bg-background/55 p-4">
          <div>
            <h3 className="text-sm font-semibold">Import preview</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {importState.fileName} · exported {new Date(importState.backup.metadata.exportedAt).toLocaleString()}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {previewItems.map((item) => (
              <div className="rounded-md border bg-card p-3" key={item.key}>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-xl font-semibold">{importState.preview[item.key]}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="import-mode">
              Import mode
            </label>
            <Select
              id="import-mode"
              onChange={(event) => {
                setImportMode(event.target.value as BackupImportMode);
                setIsConfirmed(false);
              }}
              value={importMode}
            >
              <option value="merge">Merge with existing data</option>
              <option value="replace">Replace all local data</option>
            </Select>
            <p className="text-xs text-muted-foreground">
              {importMode === "replace"
                ? "Replace clears current local data before importing this backup."
                : "Merge adds records with new IDs and skips records whose IDs already exist."}
            </p>
          </div>
          <label className="flex items-start gap-2 rounded-md border bg-card p-3 text-sm">
            <input
              checked={isConfirmed}
              className="mt-1"
              onChange={(event) => setIsConfirmed(event.target.checked)}
              type="checkbox"
            />
            <span>
              I understand this import will {importMode === "replace" ? "replace all current local data" : "change local data"}.
            </span>
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              onClick={() => {
                setImportState(null);
                setIsConfirmed(false);
              }}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={isBusy || !isConfirmed}
              onClick={onImport}
              variant={importMode === "replace" ? "destructive" : "default"}
            >
              <Upload />
              {importMode === "replace" ? "Import and Replace" : "Import and Merge"}
            </Button>
          </div>
        </div>
      ) : null}

      {status ? (
        <div
          className={
            status.tone === "error"
              ? "flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
              : "rounded-md border bg-background/55 p-3 text-sm text-muted-foreground"
          }
        >
          {status.tone === "error" ? <AlertTriangle className="size-4" /> : null}
          {status.message}
        </div>
      ) : null}
    </section>
  );
}

const settingsSections = [
  {
    title: "Theme",
    description: "Match system, light, or dark.",
    icon: MonitorCog,
    action: <ThemeToggle />,
  },
  {
    title: "Storage",
    description: "Applications are stored in this browser.",
    icon: Database,
    action: <span className="text-sm text-muted-foreground">IndexedDB</span>,
  },
  {
    title: "Input",
    description: "Drag cards by pointer or keyboard.",
    icon: Keyboard,
    action: <span className="text-sm text-muted-foreground">dnd-kit</span>,
  },
];

export function SettingsPage() {
  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Workspace preferences and local data controls.</p>
      </div>
      <DataSection />
      <div className="grid gap-3">
        {settingsSections.map((section) => (
          <section
            className="flex items-center justify-between gap-4 rounded-lg border bg-card p-4"
            key={section.title}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-md bg-secondary">
                <section.icon className="size-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold">{section.title}</h2>
                <p className="truncate text-sm text-muted-foreground">{section.description}</p>
              </div>
            </div>
            {section.action}
          </section>
        ))}
      </div>
    </div>
  );
}
