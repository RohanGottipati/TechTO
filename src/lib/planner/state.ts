import type { CityEdit, ScenarioPatch } from "@/lib/planner/scenario";

export interface TwinPoi {
  id: string;
  label: string;
  lng: number;
  lat: number;
  kind: string;
}

export interface TwinCorridor {
  id: string;
  label: string;
  alignment: [number, number][];
  reachKm: number;
}

export interface TwinSnapshot {
  version: number;
  closedRoutes: string[];
  pois: TwinPoi[];
  corridors: TwinCorridor[];
  policies: Record<string, number | string | boolean>;
  landUse: Record<string, string>;
  appliedPatchIds: string[];
}

export function emptyTwinSnapshot(): TwinSnapshot {
  return {
    version: 0,
    closedRoutes: [],
    pois: [],
    corridors: [],
    policies: {},
    landUse: {},
    appliedPatchIds: [],
  };
}

function applyEdit(snap: TwinSnapshot, edit: CityEdit): void {
  if (edit.type === "add_poi") {
    snap.pois = snap.pois.filter((p) => p.id !== edit.id);
    snap.pois.push({
      id: edit.id,
      label: edit.label,
      lng: edit.lng,
      lat: edit.lat,
      kind: edit.kind,
    });
  } else if (edit.type === "close_route") {
    if (!snap.closedRoutes.includes(edit.routeRef)) {
      snap.closedRoutes.push(edit.routeRef);
    }
  } else if (edit.type === "add_corridor") {
    snap.corridors = snap.corridors.filter((c) => c.id !== edit.id);
    snap.corridors.push({
      id: edit.id,
      label: edit.label,
      alignment: edit.alignment,
      reachKm: edit.reachKm ?? 1.5,
    });
  } else if (edit.type === "set_policy") {
    snap.policies[edit.key] = edit.value;
  } else if (edit.type === "set_land_use") {
    snap.landUse[edit.neighbourhoodCode] = edit.use;
  }
}

/** Mutate a copy: apply one ScenarioPatch, bump version. */
export function patchTwin(base: TwinSnapshot, patch: ScenarioPatch): TwinSnapshot {
  const next: TwinSnapshot = {
    version: base.version + 1,
    closedRoutes: [...base.closedRoutes],
    pois: base.pois.map((p) => ({ ...p })),
    corridors: base.corridors.map((c) => ({
      ...c,
      alignment: c.alignment.map((xy) => [...xy] as [number, number]),
    })),
    policies: { ...base.policies },
    landUse: { ...base.landUse },
    appliedPatchIds: [...base.appliedPatchIds, patch.id],
  };
  for (const edit of patch.edits) applyEdit(next, edit);
  return next;
}

export function queryTwin(
  snap: TwinSnapshot,
  selector: { kind?: string; neighbourhoodCode?: string },
): unknown {
  if (selector.kind === "pois") return snap.pois;
  if (selector.kind === "corridors") return snap.corridors;
  if (selector.kind === "closed_routes") return snap.closedRoutes;
  if (selector.kind === "policies") return snap.policies;
  if (selector.kind === "land_use") {
    if (selector.neighbourhoodCode) {
      return { [selector.neighbourhoodCode]: snap.landUse[selector.neighbourhoodCode] ?? null };
    }
    return snap.landUse;
  }
  return {
    version: snap.version,
    poiCount: snap.pois.length,
    corridorCount: snap.corridors.length,
    closedRoutes: snap.closedRoutes,
    policies: snap.policies,
    landUseKeys: Object.keys(snap.landUse),
    appliedPatchIds: snap.appliedPatchIds,
  };
}
