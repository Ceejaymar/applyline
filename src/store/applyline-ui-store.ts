"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type BoardDensity = "compact" | "comfortable";

type ApplylineUiState = {
  activeJobId: string | null;
  boardDensity: BoardDensity;
  isCreateOpen: boolean;
  closeJob: () => void;
  openCreate: () => void;
  openJob: (jobId: string) => void;
  setBoardDensity: (density: BoardDensity) => void;
};

export const useApplylineUiStore = create<ApplylineUiState>()(
  persist(
    (set) => ({
      activeJobId: null,
      boardDensity: "compact",
      isCreateOpen: false,
      closeJob: () => set({ activeJobId: null, isCreateOpen: false }),
      openCreate: () => set({ activeJobId: null, isCreateOpen: true }),
      openJob: (jobId) => set({ activeJobId: jobId, isCreateOpen: false }),
      setBoardDensity: (boardDensity) => set({ boardDensity }),
    }),
    {
      name: "applyline-ui",
      partialize: (state) => ({ boardDensity: state.boardDensity }),
    },
  ),
);
