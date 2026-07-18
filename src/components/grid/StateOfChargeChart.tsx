"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BatteryCharging } from "lucide-react";
import { GlassPanel } from "@/components/primitives/GlassPanel";
import { EmptyState } from "@/components/feedback/EmptyState";
import { formatHourLabel, formatPercent } from "@/lib/gridtwin/format";
import type { IntervalTrace } from "@/lib/grid/types";

export interface StateOfChargeChartProps {
  trace: IntervalTrace[] | null;
  minSocFraction: number;
  maxSocFraction: number;
  title?: string;
}

interface ChartPoint {
  hour: number;
  label: string;
  socPercent: number;
}

export function StateOfChargeChart({
  trace,
  minSocFraction,
  maxSocFraction,
  title = "State of Charge",
}: StateOfChargeChartProps) {
  const data: ChartPoint[] = (trace ?? []).map((step) => ({
    hour: step.hour,
    label: formatHourLabel(step.hour),
    socPercent: Math.round(step.socFractionEnd * 1000) / 10,
  }));

  return (
    <GlassPanel className="flex h-full flex-col p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BatteryCharging className="h-4 w-4 text-[#6287FF]" />
          <h3 className="text-sm font-semibold text-[#F5F7FA]">{title}</h3>
        </div>
        <span className="text-[11px] text-[#9AA7B5]">
          Simulated trace, not live SOC
        </span>
      </div>

      {data.length === 0 ? (
        <div className="mt-3 flex-1">
          <EmptyState
            title="No dispatch trace yet"
            description="Start a control room run to simulate a state-of-charge trace for this scenario."
          />
        </div>
      ) : (
        <div className="mt-2 h-[220px] flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
              <defs>
                <linearGradient id="socFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6287FF" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#6287FF" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "#9AA7B5", fontSize: 11 }}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                tickLine={false}
                interval={2}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: "#9AA7B5", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={36}
                tickFormatter={(value: number) => `${value}%`}
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(8,13,21,0.95)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 10,
                  fontSize: 12,
                  color: "#F5F7FA",
                }}
                formatter={(value) => [`${value}%`, "SOC"]}
                labelFormatter={(label) => `Hour ${label}`}
              />
              <ReferenceLine
                y={minSocFraction * 100}
                stroke="#FF6B6B"
                strokeDasharray="4 4"
                label={{
                  value: `min ${formatPercent(minSocFraction)}`,
                  position: "insideBottomLeft",
                  fill: "#FF6B6B",
                  fontSize: 10,
                }}
              />
              <ReferenceLine
                y={maxSocFraction * 100}
                stroke="#F4B860"
                strokeDasharray="4 4"
                label={{
                  value: `max ${formatPercent(maxSocFraction)}`,
                  position: "insideTopLeft",
                  fill: "#F4B860",
                  fontSize: 10,
                }}
              />
              <Area
                type="monotone"
                dataKey="socPercent"
                stroke="#6287FF"
                strokeWidth={2}
                fill="url(#socFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </GlassPanel>
  );
}
