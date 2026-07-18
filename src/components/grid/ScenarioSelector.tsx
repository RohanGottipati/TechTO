"use client";

import { AlertOctagon, Battery, CloudSun, LineChart, Layers } from "lucide-react";
import { GlassPanel } from "@/components/primitives/GlassPanel";
import { cn } from "@/lib/utils/cn";
import type { ScenarioDefinition } from "@/lib/grid/types";

export interface ScenarioSelectorProps {
  scenarios: ScenarioDefinition[];
  selectedScenarioId: string;
  onSelect: (scenarioId: string) => void;
  disabled?: boolean;
}

const CATEGORY_ICON: Record<string, typeof Layers> = {
  baseline: Layers,
  renewable: CloudSun,
  market: LineChart,
  asset: Battery,
  stress: AlertOctagon,
};

export function ScenarioSelector({
  scenarios,
  selectedScenarioId,
  onSelect,
  disabled = false,
}: ScenarioSelectorProps) {
  return (
    <GlassPanel className="flex h-full flex-col p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#F5F7FA]">Scenario</h3>
        <span className="text-[11px] text-[#9AA7B5]">From fixture catalog</span>
      </div>

      <div className="mt-3 flex-1 space-y-2 overflow-y-auto">
        {scenarios.map((scenario) => {
          const Icon = CATEGORY_ICON[scenario.category] ?? Layers;
          const selected = scenario.id === selectedScenarioId;
          return (
            <button
              key={scenario.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(scenario.id)}
              aria-pressed={selected}
              data-testid={`scenario-${scenario.id}`}
              className={cn(
                "w-full rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55D8E6]",
                "disabled:cursor-not-allowed disabled:opacity-50",
                selected
                  ? "border-[#55D8E6]/50 bg-[#55D8E6]/10"
                  : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
              )}
            >
              <div className="flex items-center gap-2">
                <Icon
                  className={cn(
                    "h-3.5 w-3.5 shrink-0",
                    selected ? "text-[#55D8E6]" : "text-[#9AA7B5]"
                  )}
                />
                <span
                  className={cn(
                    "text-sm font-medium",
                    selected ? "text-[#55D8E6]" : "text-[#F5F7FA]"
                  )}
                >
                  {scenario.name}
                </span>
                {scenario.hiddenStress && (
                  <span className="ml-auto rounded-full bg-[#FF6B6B]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#FF6B6B]">
                    hidden stress
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-[#9AA7B5]">
                {scenario.description}
              </p>
            </button>
          );
        })}
      </div>
    </GlassPanel>
  );
}
