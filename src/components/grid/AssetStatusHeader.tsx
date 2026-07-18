"use client";

import Link from "next/link";
import { ArrowLeft, Battery, FlaskConical, Loader2, ServerCog } from "lucide-react";
import { StatusPill } from "@/components/primitives/StatusPill";
import type { BatteryAsset } from "@/lib/grid/types";

export interface AssetStatusHeaderProps {
  asset: BatteryAsset;
  scenarioName: string;
  isMockMode: boolean;
  isRunning: boolean;
}

export function AssetStatusHeader({
  asset,
  scenarioName,
  isMockMode,
  isRunning,
}: AssetStatusHeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[rgba(8,13,21,0.78)] px-4 py-3 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          data-testid="back-to-world-from-control"
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[#9AA7B5] transition-colors hover:bg-white/[0.08] hover:text-[#F5F7FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55D8E6]"
          aria-label="Back to world view"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#6287FF]/40 bg-[#6287FF]/10 text-[#6287FF]">
          <Battery className="h-4 w-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-[#F5F7FA]">{asset.name}</h1>
            <span className="text-xs text-[#9AA7B5]">{asset.id}</span>
          </div>
          <p className="text-xs text-[#9AA7B5]">
            {asset.location.label} &middot; {asset.market} &middot; Scenario: {scenarioName}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone="loading" className="border-[#6287FF]/30 text-[#6287FF]">
          <FlaskConical className="h-3 w-3" />
          Simulated Asset
        </StatusPill>
        <StatusPill tone="warning">Fixture data</StatusPill>
        {isMockMode && (
          <StatusPill tone="warning" className="border-[#F4B860]/30">
            <ServerCog className="h-3 w-3" />
            Mock Backboard Mode
          </StatusPill>
        )}
        {isRunning && (
          <StatusPill tone="loading">
            <Loader2 className="h-3 w-3 animate-spin" />
            Run in progress
          </StatusPill>
        )}
      </div>
    </header>
  );
}
