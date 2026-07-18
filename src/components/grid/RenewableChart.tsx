"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Wind } from "lucide-react";
import { GlassPanel } from "@/components/primitives/GlassPanel";
import { formatHourLabel } from "@/lib/gridtwin/format";
import type { ConditionHour } from "@/lib/grid/types";

export interface RenewableChartProps {
  hours: ConditionHour[];
  title?: string;
}

interface ChartPoint {
  hour: number;
  label: string;
  windMw: number;
  solarMw: number;
  ambientTemperatureC: number;
}

export function RenewableChart({ hours, title = "Renewable Forecast" }: RenewableChartProps) {
  const data: ChartPoint[] = hours.map((hour) => ({
    hour: hour.hour,
    label: formatHourLabel(hour.hour),
    windMw: hour.windMw,
    solarMw: hour.solarMw,
    ambientTemperatureC: hour.ambientTemperatureC,
  }));

  return (
    <GlassPanel className="flex h-full flex-col p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wind className="h-4 w-4 text-[#55D8E6]" />
          <h3 className="text-sm font-semibold text-[#F5F7FA]">{title}</h3>
        </div>
        <span className="text-[11px] text-[#9AA7B5]">
          Fixture generation + ambient temp
        </span>
      </div>

      <div className="mt-2 h-[220px] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <defs>
              <linearGradient id="windFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#55D8E6" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#55D8E6" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="solarFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F4B860" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#F4B860" stopOpacity={0.02} />
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
              yAxisId="power"
              tick={{ fill: "#9AA7B5", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={44}
              tickFormatter={(value: number) => `${value}MW`}
            />
            <YAxis
              yAxisId="temp"
              orientation="right"
              tick={{ fill: "#9AA7B5", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={36}
              tickFormatter={(value: number) => `${value}\u00b0`}
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
                if (name === "windMw") return [`${value} MW`, "Wind"];
                if (name === "solarMw") return [`${value} MW`, "Solar"];
                return [`${value}\u00b0C`, "Ambient temp"];
              }}
            />
            <Area
              yAxisId="power"
              type="monotone"
              dataKey="windMw"
              stroke="#55D8E6"
              strokeWidth={2}
              fill="url(#windFill)"
              stackId="renewable"
            />
            <Area
              yAxisId="power"
              type="monotone"
              dataKey="solarMw"
              stroke="#F4B860"
              strokeWidth={2}
              fill="url(#solarFill)"
              stackId="renewable"
            />
            <Line
              yAxisId="temp"
              type="monotone"
              dataKey="ambientTemperatureC"
              stroke="#FF6B6B"
              strokeWidth={1.5}
              strokeDasharray="3 3"
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </GlassPanel>
  );
}
