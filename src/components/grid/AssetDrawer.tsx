"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Battery, Gauge, Shield, Thermometer, X } from "lucide-react";
import { useWorldStore } from "@/store/useWorldStore";
import { GlassPanel } from "@/components/primitives/GlassPanel";
import { getAsset } from "@/lib/grid/fixtures";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * Preview drawer shown when a battery marker is selected on the globe. Shows
 * only static, fixture-derived spec values; live dispatch state only exists
 * once a planner opens the control room and starts a run.
 */
export function AssetDrawer() {
  const selectedGridAssetId = useWorldStore((s) => s.selectedGridAssetId);
  const clearSelectedGridAsset = useWorldStore(
    (s) => s.clearSelectedGridAsset
  );
  const isMobile = useIsMobile();
  const reducedMotion = useReducedMotion();

  const asset = selectedGridAssetId ? getAsset(selectedGridAssetId) : undefined;

  const desktopMotion = {
    initial: reducedMotion ? false : { opacity: 0, x: 40 },
    animate: { opacity: 1, x: 0 },
    exit: reducedMotion ? { opacity: 0 } : { opacity: 0, x: 40 },
  };

  const mobileMotion = {
    initial: reducedMotion ? false : { opacity: 0, y: 60 },
    animate: { opacity: 1, y: 0 },
    exit: reducedMotion ? { opacity: 0 } : { opacity: 0, y: 60 },
  };

  return (
    <AnimatePresence>
      {asset && (
        <motion.div
          {...(isMobile ? mobileMotion : desktopMotion)}
          transition={{ duration: 0.25 }}
          className={
            "pointer-events-auto " +
            (isMobile ? "w-full" : "w-[min(92vw,400px)]")
          }
          data-testid="asset-drawer"
          role="dialog"
          aria-label="Selected grid asset details"
        >
          <GlassPanel
            className={
              "flex flex-col overflow-hidden " +
              (isMobile ? "max-h-[70vh]" : "max-h-[calc(100dvh-9rem)]")
            }
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/10 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Battery className="h-3.5 w-3.5 text-[#6287FF]" />
                  <p className="text-[11px] uppercase tracking-widest text-[#6287FF]">
                    Simulated Asset
                  </p>
                </div>
                <h2 className="mt-1 truncate text-lg font-semibold text-[#F5F7FA]">
                  {asset.name}
                </h2>
                <p className="mt-0.5 text-xs text-[#9AA7B5]">
                  {asset.location.label} &middot; {asset.market}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close asset details"
                onClick={clearSelectedGridAsset}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#9AA7B5] transition-colors hover:bg-white/[0.06] hover:text-[#F5F7FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55D8E6]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <p className="text-sm text-[#F5F7FA]/90">{asset.description}</p>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full border border-[#6287FF]/40 bg-[#6287FF]/10 px-2.5 py-1 text-[11px] font-medium text-[#6287FF]">
                  Fixture data, not live telemetry
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <SpecTile label="Rated power" value={`${asset.ratedPowerMw} MW`} />
                <SpecTile
                  label="Usable energy"
                  value={`${asset.usableEnergyMwh} MWh`}
                />
                <SpecTile
                  icon={<Gauge className="h-3.5 w-3.5" />}
                  label="State of charge (baseline)"
                  value={`${Math.round(asset.startingSocFraction * 100)}%`}
                />
                <SpecTile
                  label="Power output"
                  value="Idle (no active run)"
                />
                <SpecTile
                  icon={<Thermometer className="h-3.5 w-3.5" />}
                  label="Thermal warning / max"
                  value={`${asset.thermal.warningTemperatureC}\u00b0C / ${asset.thermal.maxTemperatureC}\u00b0C`}
                />
                <SpecTile
                  icon={<Shield className="h-3.5 w-3.5" />}
                  label="Reserve requirement"
                  value={`${asset.reserveRequirementMw} MW`}
                />
              </div>

              <Link
                href={`/control/${asset.id}`}
                data-testid="open-control-room"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#55D8E6]/50 bg-[#55D8E6]/10 px-3 py-2.5 text-sm font-medium text-[#55D8E6] transition-colors hover:bg-[#55D8E6]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55D8E6]"
              >
                Open Control Room
                <ArrowUpRight className="h-4 w-4" />
              </Link>

              <p className="mt-3 text-[11px] leading-relaxed text-[#9AA7B5]">
                Decision-support demo only. This is not a real battery control
                interface and cannot dispatch physical hardware.
              </p>
            </div>
          </GlassPanel>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SpecTile({
  icon,
  label,
  value,
}: {
  icon?: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[#9AA7B5]">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-sm font-medium text-[#F5F7FA]">{value}</p>
    </div>
  );
}
