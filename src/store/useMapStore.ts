import { create } from "zustand";

import type { SelectedMapPlace } from "@/lib/techto/place-context";
import type { AgentMapOverlay } from "@/lib/techto/map-overlays";

export interface MapLayerVisibility {
  transit: boolean;
  parcels: boolean;
  zoning: boolean;
  sentimentHeatmap: boolean;
  policyOverlay: boolean;
}

export interface CandidateMarker {
  candidateId: string;
  coordinates: [number, number];
  rank: number;
  label: string;
}

interface MapState {
  selectedStationId: string | null;
  selectedScenarioId: string | null;
  playbackMinute: number;
  layers: MapLayerVisibility;
  cameraTarget: {
    center: [number, number];
    zoom: number;
    durationMs?: number;
  } | null;
  boundsTarget: {
    bounds: [number, number, number, number];
    padding?: number;
    durationMs?: number;
  } | null;
  highlightedNeighbourhoodIds: string[];
  candidateMarkers: CandidateMarker[];
  agentOverlays: AgentMapOverlay[];
  /** Place selected for the floating mini chat (building footprint or station). */
  selectedPlace: SelectedMapPlace | null;
  buildingMiniChatOpen: boolean;
}

interface MapActions {
  setSelectedStation: (stationId: string | null) => void;
  setSelectedScenario: (scenarioId: string | null) => void;
  setPlaybackMinute: (minute: number) => void;
  toggleLayer: (layer: keyof MapLayerVisibility, visible?: boolean) => void;
  setLayerVisibility: (layers: Partial<MapLayerVisibility>) => void;
  setCameraTarget: (
    target: { center: [number, number]; zoom: number; durationMs?: number } | null,
  ) => void;
  setBoundsTarget: (
    target: {
      bounds: [number, number, number, number];
      padding?: number;
      durationMs?: number;
    } | null,
  ) => void;
  setHighlightedNeighbourhoods: (ids: string[]) => void;
  setCandidateMarkers: (markers: CandidateMarker[]) => void;
  upsertAgentOverlay: (overlay: AgentMapOverlay) => void;
  removeAgentOverlays: (ids: string[]) => void;
  clearMapOverlays: (
    what: "markers" | "highlights" | "drawings" | "annotations" | "all",
  ) => void;
  setAgentOverlays: (overlays: AgentMapOverlay[]) => void;
  selectPlace: (place: SelectedMapPlace) => void;
  clearPlaceSelection: () => void;
  setBuildingMiniChatOpen: (open: boolean) => void;
  reset: () => void;
}

export type MapStore = MapState & MapActions;

const DEFAULT_LAYERS: MapLayerVisibility = {
  transit: true,
  parcels: false,
  zoning: false,
  sentimentHeatmap: true,
  policyOverlay: true,
};

const initialState: MapState = {
  selectedStationId: null,
  selectedScenarioId: null,
  playbackMinute: 0,
  layers: DEFAULT_LAYERS,
  cameraTarget: null,
  boundsTarget: null,
  highlightedNeighbourhoodIds: [],
  candidateMarkers: [],
  agentOverlays: [],
  selectedPlace: null,
  buildingMiniChatOpen: false,
};

export const useMapStore = create<MapStore>((set) => ({
  ...initialState,

  setSelectedStation: (selectedStationId) => set({ selectedStationId }),
  setSelectedScenario: (selectedScenarioId) => set({ selectedScenarioId }),
  setPlaybackMinute: (minute) => set({ playbackMinute: Math.max(0, minute) }),

  toggleLayer: (layer, visible) =>
    set((state) => ({
      layers: { ...state.layers, [layer]: visible ?? !state.layers[layer] },
    })),
  setLayerVisibility: (layers) =>
    set((state) => ({
      layers: { ...state.layers, ...layers },
    })),

  setCameraTarget: (cameraTarget) => set({ cameraTarget }),
  setBoundsTarget: (boundsTarget) => set({ boundsTarget }),
  setHighlightedNeighbourhoods: (highlightedNeighbourhoodIds) => set({ highlightedNeighbourhoodIds }),
  setCandidateMarkers: (candidateMarkers) => set({ candidateMarkers }),
  setAgentOverlays: (agentOverlays) => set({ agentOverlays }),

  upsertAgentOverlay: (overlay) =>
    set((state) => ({
      agentOverlays: [
        ...state.agentOverlays.filter((o) => o.id !== overlay.id),
        overlay,
      ],
    })),
  removeAgentOverlays: (ids) =>
    set((state) => ({
      agentOverlays: state.agentOverlays.filter((o) => !ids.includes(o.id)),
    })),
  clearMapOverlays: (what) =>
    set((state) => {
      if (what === "all") {
        return {
          candidateMarkers: [],
          highlightedNeighbourhoodIds: [],
          agentOverlays: [],
        };
      }
      if (what === "markers") return { candidateMarkers: [] };
      if (what === "highlights") return { highlightedNeighbourhoodIds: [] };
      if (what === "annotations") {
        return {
          agentOverlays: state.agentOverlays.filter((o) => o.kind !== "annotation"),
        };
      }
      // drawings: points, lines, polygons
      return {
        agentOverlays: state.agentOverlays.filter((o) => o.kind === "annotation"),
      };
    }),

  selectPlace: (place) =>
    set({
      selectedPlace: place,
      buildingMiniChatOpen: true,
      selectedStationId: place.stationId,
    }),
  clearPlaceSelection: () =>
    set({
      selectedPlace: null,
      buildingMiniChatOpen: false,
      selectedStationId: null,
    }),
  setBuildingMiniChatOpen: (buildingMiniChatOpen) => set({ buildingMiniChatOpen }),

  reset: () => set({ ...initialState, layers: DEFAULT_LAYERS }),
}));
