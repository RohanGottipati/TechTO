"use client";

import { create } from "zustand";
import type { ScenarioResult } from "@/lib/sim/types";

export type LayerKey = "routes" | "personas" | "districts";

interface SimState {
  status: "loading" | "ready" | "error";
  scenarioId: string;
  layers: Record<LayerKey, boolean>;
  selectedCode: string | null;
  result: ScenarioResult | null;
  personaCount: number;
  setStatus: (status: SimState["status"]) => void;
  setScenario: (id: string) => void;
  toggleLayer: (key: LayerKey) => void;
  select: (code: string | null) => void;
  setResult: (result: ScenarioResult) => void;
  setPersonaCount: (n: number) => void;
}

export const useSimStore = create<SimState>((set) => ({
  status: "loading",
  scenarioId: "baseline",
  layers: { routes: true, personas: true, districts: false },
  selectedCode: null,
  result: null,
  personaCount: 0,
  setStatus: (status) => set({ status }),
  setScenario: (scenarioId) => set({ scenarioId }),
  toggleLayer: (key) =>
    set((s) => ({ layers: { ...s.layers, [key]: !s.layers[key] } })),
  select: (selectedCode) => set({ selectedCode }),
  setResult: (result) => set({ result }),
  setPersonaCount: (personaCount) => set({ personaCount }),
}));
