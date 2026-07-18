"use client";

import { useMemo } from "react";
import { useSimStore } from "@/store/useSimStore";
import { acceptanceColor } from "@/lib/map/palette";
import type { NeighbourhoodProps, Persona } from "@/lib/sim/types";

const MINI_BINS = 12;

interface InspectorPanelProps {
  index: Map<string, NeighbourhoodProps>;
  personas: Persona[];
}

export function InspectorPanel({ index, personas }: InspectorPanelProps) {
  const selectedCode = useSimStore((s) => s.selectedCode);
  const result = useSimStore((s) => s.result);
  const select = useSimStore((s) => s.select);

  const local = useMemo(() => {
    if (!selectedCode || !result) return null;
    const bins = new Array<number>(MINI_BINS).fill(0);
    let sum = 0;
    let count = 0;
    for (const p of personas) {
      if (p.code !== selectedCode) continue;
      const a = result.acceptance[p.id];
      bins[Math.min(MINI_BINS - 1, Math.floor(a * MINI_BINS))]++;
      sum += a;
      count++;
    }
    return { bins, mean: count ? sum / count : 0.5, count };
  }, [selectedCode, result, personas]);

  if (!selectedCode || !local) return null;
  const props = index.get(selectedCode);
  if (!props) return null;

  const maxBin = Math.max(...local.bins, 1);
  const verdict =
    local.mean >= 0.6
      ? "leans supportive"
      : local.mean >= 0.52
        ? "cautiously positive"
        : local.mean > 0.48
          ? "split"
          : local.mean > 0.4
            ? "skeptical"
            : "leans opposed";

  return (
    <aside className="pointer-events-auto w-[288px] border border-hairline bg-panel">
      <header className="flex items-start justify-between gap-2 px-4 pt-3">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted/70">
            Neighbourhood {props.code}
          </div>
          <h2 className="mt-0.5 text-[14px] font-semibold leading-tight text-ink-bright">
            {props.name}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => select(null)}
          aria-label="Close neighbourhood details"
          className="mt-0.5 px-1 text-[16px] leading-none text-muted transition-colors hover:text-ink-bright"
        >
          ×
        </button>
      </header>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 px-4">
        <Fact label="Population" value={props.population.toLocaleString()} />
        <Fact
          label="Median hh income"
          value={props.income ? `$${props.income.toLocaleString()}` : "–"}
        />
        <Fact label="Residents shown" value={local.count.toLocaleString()} />
        <Fact
          label="Acceptance"
          value={`${(local.mean * 100).toFixed(0)}%`}
          accent={acceptanceColor(local.mean)}
        />
      </dl>

      <div className="mt-3 px-4 pb-3.5">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-[10px] uppercase tracking-[0.16em] text-muted">
            Local distribution
          </span>
          <span
            className="text-[10.5px] italic"
            style={{ color: acceptanceColor(local.mean) }}
          >
            {verdict}
          </span>
        </div>
        <svg width="100%" viewBox={`0 0 ${MINI_BINS * 22} 40`} aria-hidden>
          {local.bins.map((count, i) => {
            const h = Math.max(count > 0 ? 2 : 0, (count / maxBin) * 36);
            return (
              <rect
                key={i}
                x={i * 22}
                y={38 - h}
                width={20}
                height={h}
                rx={1.5}
                fill={acceptanceColor((i + 0.5) / MINI_BINS)}
              />
            );
          })}
          <line
            x1={0}
            y1={38.5}
            x2={MINI_BINS * 22}
            y2={38.5}
            stroke="rgba(235,242,236,0.16)"
          />
        </svg>
      </div>
    </aside>
  );
}

function Fact({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div>
      <dt className="text-[9.5px] uppercase tracking-[0.14em] text-muted/80">
        {label}
      </dt>
      <dd
        className="font-mono text-[13px] font-medium text-ink-bright"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </dd>
    </div>
  );
}
