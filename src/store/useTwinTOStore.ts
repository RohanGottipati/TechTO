import { create } from "zustand";

/** Which panel the TwinTO chat/results UI should bring to the foreground. */
export type TwinTOPanelFocus = "chat" | "citizens" | "map" | "recommendation" | "history";

interface TwinTOState {
  activeRunId: string | null;
  selectedCandidateId: string | null;
  panelFocus: TwinTOPanelFocus;
}

interface TwinTOActions {
  setActiveRun: (runId: string | null) => void;
  setSelectedCandidate: (candidateId: string | null) => void;
  setPanelFocus: (focus: TwinTOPanelFocus) => void;
  reset: () => void;
}

export type TwinTOStore = TwinTOState & TwinTOActions;

const initialState: TwinTOState = {
  activeRunId: null,
  selectedCandidateId: null,
  panelFocus: "chat",
};

export const useTwinTOStore = create<TwinTOStore>((set) => ({
  ...initialState,

  // Switching runs invalidates any candidate selection from the previous run.
  setActiveRun: (activeRunId) => set({ activeRunId, selectedCandidateId: null }),
  setSelectedCandidate: (selectedCandidateId) => set({ selectedCandidateId }),
  setPanelFocus: (panelFocus) => set({ panelFocus }),

  reset: () => set({ ...initialState }),
}));
