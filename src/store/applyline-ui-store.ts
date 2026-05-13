"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { JobSortMode } from "@/features/jobs/job-helpers";

type BoardDensity = "compact" | "comfortable";

type ApplylineUiState = {
  activeJobId: string | null;
  boardDensity: BoardDensity;
  columnSorts: Record<string, JobSortMode>;
  createColumnId: string | null;
  isCreateOpen: boolean;
  closeJob: () => void;
  getColumnSort: (columnId: string) => JobSortMode;
  openCreate: (columnId?: string) => void;
  openJob: (jobId: string) => void;
  setBoardDensity: (density: BoardDensity) => void;
  setColumnSort: (columnId: string, sort: JobSortMode) => void;
};

export const useApplylineUiStore = create<ApplylineUiState>()(
  persist(
    (set, get) => ({
      activeJobId: null,
      boardDensity: "compact",
      columnSorts: {},
      createColumnId: null,
      isCreateOpen: false,
      closeJob: () => set({ activeJobId: null, createColumnId: null, isCreateOpen: false }),
      getColumnSort: (columnId) => get().columnSorts[columnId] ?? "latest",
      openCreate: (createColumnId) =>
        set({ activeJobId: null, createColumnId: createColumnId ?? null, isCreateOpen: true }),
      openJob: (jobId) => set({ activeJobId: jobId, isCreateOpen: false }),
      setBoardDensity: (boardDensity) => set({ boardDensity }),
      setColumnSort: (columnId, sort) =>
        set((state) => ({
          columnSorts: {
            ...state.columnSorts,
            [columnId]: sort,
          },
        })),
    }),
    {
      name: "applyline-ui",
      partialize: (state) => ({
        boardDensity: state.boardDensity,
        columnSorts: state.columnSorts,
      }),
    },
  ),
);
