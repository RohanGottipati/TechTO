"use client";

import { AlertTriangle, CheckCircle2, ShieldAlert, XCircle } from "lucide-react";
import { GlassPanel } from "@/components/primitives/GlassPanel";
import { EmptyState } from "@/components/feedback/EmptyState";
import type { ConstraintViolation, SimulationResult } from "@/lib/grid/types";

export interface ConstraintStatusProps {
  simulation: SimulationResult | null;
  stressSimulation?: SimulationResult | null;
  title?: string;
}

function ViolationRow({ violation }: { violation: ConstraintViolation }) {
  const isError = violation.severity === "error";
  return (
    <li className="flex items-start gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
      {isError ? (
        <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FF6B6B]" />
      ) : (
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#F4B860]" />
      )}
      <div className="min-w-0">
        <p className={"text-xs font-medium " + (isError ? "text-[#FF6B6B]" : "text-[#F4B860]")}>
          {violation.code}
          {violation.hour >= 0 && (
            <span className="ml-1 font-normal text-[#9AA7B5]">hour {violation.hour}</span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-[#9AA7B5]">{violation.message}</p>
      </div>
    </li>
  );
}

export function ConstraintStatus({
  simulation,
  stressSimulation,
  title = "Constraint Validation",
}: ConstraintStatusProps) {
  return (
    <GlassPanel className="flex h-full flex-col p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-[#55D8E6]" />
          <h3 className="text-sm font-semibold text-[#F5F7FA]">{title}</h3>
        </div>
      </div>

      {!simulation ? (
        <div className="mt-3 flex-1">
          <EmptyState
            title="No candidate simulated yet"
            description="Constraint checks appear once the deterministic validator has evaluated a candidate plan."
          />
        </div>
      ) : (
        <div className="mt-3 flex-1 space-y-3 overflow-y-auto">
          <div className="flex items-center gap-2">
            {simulation.valid ? (
              <CheckCircle2 className="h-4 w-4 text-[#55D8E6]" />
            ) : (
              <XCircle className="h-4 w-4 text-[#FF6B6B]" />
            )}
            <span
              className={
                "text-sm font-medium " +
                (simulation.valid ? "text-[#55D8E6]" : "text-[#FF6B6B]")
              }
            >
              {simulation.valid
                ? "Passed visible-data validation"
                : "Failed visible-data validation"}
            </span>
          </div>

          {simulation.violations.length === 0 ? (
            <p className="text-xs text-[#9AA7B5]">No violations against visible conditions.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {simulation.violations.map((violation, index) => (
                <ViolationRow key={`${violation.code}-${index}`} violation={violation} />
              ))}
            </ul>
          )}

          {stressSimulation && (
            <div className="border-t border-white/10 pt-3">
              <div className="flex items-center gap-2">
                {stressSimulation.valid ? (
                  <CheckCircle2 className="h-4 w-4 text-[#55D8E6]" />
                ) : (
                  <XCircle className="h-4 w-4 text-[#FF6B6B]" />
                )}
                <span
                  className={
                    "text-sm font-medium " +
                    (stressSimulation.valid ? "text-[#55D8E6]" : "text-[#FF6B6B]")
                  }
                >
                  {stressSimulation.valid
                    ? "Survived hidden stress test"
                    : "Failed hidden stress test"}
                </span>
              </div>
              {!stressSimulation.valid && (
                <p className="mt-1 text-xs text-[#9AA7B5]">
                  Passed on visible data but broke once hidden stress conditions were applied.
                  Treat this candidate as high risk.
                </p>
              )}
              {stressSimulation.violations.length > 0 && (
                <ul className="mt-2 flex flex-col gap-2">
                  {stressSimulation.violations.map((violation, index) => (
                    <ViolationRow key={`stress-${violation.code}-${index}`} violation={violation} />
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </GlassPanel>
  );
}
