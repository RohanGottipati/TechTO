"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { LineChart as LineChartIcon } from "lucide-react";
import { GlassPanel } from "@/components/primitives/GlassPanel";
import { formatCad, formatHourLabel, formatMw } from "@/lib/gridtwin/format";
import type { ConditionHour, IntervalTrace } from "@/lib/grid/types";

export interface PriceDispatchChartProps {
  hours: ConditionHour[];
  trace?: IntervalTrace[] | null;
  title?: string;
}

interface ChartPoint {
  hour: number;
  label: string;
  priceCadPerMwh: number;
  netDispatchMw: number;
}

export function PriceDispatchChart({
  hours,
  trace,
  title = "Market Price & Dispatch",
}: PriceDispatchChartProps) {
  const traceByHour = new Map((trace ?? []).map((step) => [step.hour, step]));

  const data: ChartPoint[] = hours.map((hour) => {
    const step = traceByHour.get(hour.hour);
    return {
      hour: hour.hour,
      label: formatHourLabel(hour.hour),
      priceCadPerMwh: hour.priceCadPerMwh,
      netDispatchMw: step ? step.dischargeMw - step.chargeMw : 0,
    };
  });

  return (
    <GlassPanel className="flex h-full flex-col p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LineChartIcon className="h-4 w-4 text-[#55D8E6]" />
          <h3 className="text-sm font-semibold text-[#F5F7FA]">{title}</h3>
        </div>
        <span className="text-[11px] text-[#9AA7B5]">
          IESO fixture, deterministic demo data
        </span>
      </div>

      <div className="mt-2 h-[220px] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "#9AA7B5", fontSize: 11 }}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              tickLine={false}
              interval={2}
            />
            <YAxis
              yAxisId="price"
              tick={{ fill: "#9AA7B5", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={40}
              tickFormatter={(value: number) => `$${value}`}
            />
            <YAxis
              yAxisId="dispatch"
              orientation="right"
              tick={{ fill: "#9AA7B5", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={44}
              tickFormatter={(value: number) => `${value}MW`}
            />
            <Tooltip
              contentStyle={{
                background: "rgba(8,13,21,0.95)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10,
                fontSize: 12,
                color: "#F5F7FA",
              }}
              labelFormatter={(label) => `Hour ${label}`}
              formatter={(value, name) => {
                if (name === "priceCadPerMwh") {
                  return [formatCad(Number(value)) + "/MWh", "Price"];
                }
                return [formatMw(Number(value)), "Net dispatch (discharge - charge)"];
              }}
            />
            <Bar
              yAxisId="dispatch"
              dataKey="netDispatchMw"
              fill="#55D8E6"
              radius={[3, 3, 3, 3]}
              opacity={0.75}
            />
            <Line
              yAxisId="price"
              type="monotone"
              dataKey="priceCadPerMwh"
              stroke="#F4B860"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {!trace && (
        <p className="mt-2 text-[11px] text-[#9AA7B5]">
          Dispatch bars appear once a control room run produces a recommended candidate.
        </p>
      )}
    </GlassPanel>
  );
}
