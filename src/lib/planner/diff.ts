import type { TwinSnapshot } from "@/lib/planner/state";

export interface TwinDiff {
  fromVersion: number;
  toVersion: number;
  addedPois: string[];
  removedPois: string[];
  addedCorridors: string[];
  removedCorridors: string[];
  closedRoutesAdded: string[];
  policyChanges: string[];
  landUseChanges: string[];
  patchesApplied: string[];
}

export function diffTwin(a: TwinSnapshot, b: TwinSnapshot): TwinDiff {
  const aPois = new Set(a.pois.map((p) => p.id));
  const bPois = new Set(b.pois.map((p) => p.id));
  const aCorr = new Set(a.corridors.map((c) => c.id));
  const bCorr = new Set(b.corridors.map((c) => c.id));
  const aClosed = new Set(a.closedRoutes);
  const bClosed = new Set(b.closedRoutes);

  const policyChanges: string[] = [];
  for (const key of new Set([...Object.keys(a.policies), ...Object.keys(b.policies)])) {
    if (a.policies[key] !== b.policies[key]) policyChanges.push(key);
  }
  const landUseChanges: string[] = [];
  for (const key of new Set([...Object.keys(a.landUse), ...Object.keys(b.landUse)])) {
    if (a.landUse[key] !== b.landUse[key]) landUseChanges.push(key);
  }

  return {
    fromVersion: a.version,
    toVersion: b.version,
    addedPois: [...bPois].filter((id) => !aPois.has(id)),
    removedPois: [...aPois].filter((id) => !bPois.has(id)),
    addedCorridors: [...bCorr].filter((id) => !aCorr.has(id)),
    removedCorridors: [...aCorr].filter((id) => !bCorr.has(id)),
    closedRoutesAdded: [...bClosed].filter((r) => !aClosed.has(r)),
    policyChanges,
    landUseChanges,
    patchesApplied: b.appliedPatchIds.filter((id) => !a.appliedPatchIds.includes(id)),
  };
}
