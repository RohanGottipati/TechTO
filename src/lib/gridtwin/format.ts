/** Shared display formatting for the GridTwin control room UI. All inputs are fixture-derived, not live telemetry. */

export function formatHourLabel(hour: number): string {
  const clamped = ((hour % 24) + 24) % 24;
  return `${clamped.toString().padStart(2, "0")}:00`;
}

export function formatCad(value: number): string {
  if (!Number.isFinite(value)) return "--";
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export function formatMw(value: number): string {
  if (!Number.isFinite(value)) return "--";
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} MW`;
}

export function formatMwh(value: number): string {
  if (!Number.isFinite(value)) return "--";
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} MWh`;
}

export function formatKg(value: number): string {
  if (!Number.isFinite(value)) return "--";
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} t`;
  }
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg`;
}

export function formatPercent(fraction: number, digits = 0): string {
  if (!Number.isFinite(fraction)) return "--";
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function formatConfidence(value: number): string {
  return formatPercent(value, 0);
}

export function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
