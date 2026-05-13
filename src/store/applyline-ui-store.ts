"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type BoardDensity = "compact" | "comfortable";

type ApplylineUiState = {
  activeJobId: string | null;
  boardDensity: BoardDensity;
  createColumnId: string | null;
  isCreateOpen: boolean;
  closeJob: () => void;
  openCreate: (columnId?: string) => void;
  openJob: (jobId: string) => void;
  setBoardDensity: (density: BoardDensity) => void;
};

export const useApplylineUiStore = create<ApplylineUiState>()(
  persist(
    (set) => ({
      activeJobId: null,
      boardDensity: "compact",
      createColumnId: null,
      isCreateOpen: false,
      closeJob: () => set({ activeJobId: null, createColumnId: null, isCreateOpen: false }),
      openCreate: (createColumnId) =>
        set({ activeJobId: null, createColumnId: createColumnId ?? null, isCreateOpen: true }),
      openJob: (jobId) => set({ activeJobId: jobId, isCreateOpen: false }),
      setBoardDensity: (boardDensity) => set({ boardDensity }),
    }),
    {
      name: "applyline-ui",
      partialize: (state) => ({ boardDensity: state.boardDensity }),
    },
  ),
);
