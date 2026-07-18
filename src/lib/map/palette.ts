// Acceptance ramp validated with the dataviz palette checker against the dark
// surface (#111417): poles #db6055 / #38ad6b pass lightness, chroma, CVD
// separation and contrast; the midpoint is a deliberate neutral gray.
export const ACCEPT_OPPOSE = "#db6055";
export const ACCEPT_NEUTRAL = "#8a8f8a";
export const ACCEPT_SUPPORT = "#38ad6b";

export function acceptanceColor(a: number): string {
  const t = Math.max(0, Math.min(1, a));
  const mix = (c1: string, c2: string, k: number) => {
    const p = (c: string) => [
      parseInt(c.slice(1, 3), 16),
      parseInt(c.slice(3, 5), 16),
      parseInt(c.slice(5, 7), 16),
    ];
    const [r1, g1, b1] = p(c1);
    const [r2, g2, b2] = p(c2);
    const h = (x: number) => Math.round(x).toString(16).padStart(2, "0");
    return `#${h(r1 + (r2 - r1) * k)}${h(g1 + (g2 - g1) * k)}${h(b1 + (b2 - b1) * k)}`;
  };
  return t < 0.5
    ? mix(ACCEPT_OPPOSE, ACCEPT_NEUTRAL, t * 2)
    : mix(ACCEPT_NEUTRAL, ACCEPT_SUPPORT, (t - 0.5) * 2);
}

// Rail lines keep their official GTFS colours (lifted slightly for the dark
// basemap). TTC paints every streetcar route the same red, so for legibility
// the streetcars get a fixed cartographic palette instead — one hue per route,
// in route-number order, Skyline style.
export const ROUTE_COLORS: Record<string, string> = {
  "1": "#e0cb3c",
  "2": "#2fa356",
  "4": "#c245c2",
  "5": "#f28b3c",
  "6": "#a7adb3",
  "501": "#e8564a",
  "503": "#e89b3c",
  "504": "#f2c14e",
  "505": "#7f6ff0",
  "506": "#4fc3e8",
  "507": "#e87eb8",
  "509": "#5aa7e8",
  "510": "#b48ce8",
  "511": "#e8788a",
  "512": "#48cdd4",
};

export const ROUTE_FALLBACK = "#9aa0a6";

// Buses run ~180 routes deep, so per-line hues would be noise, not signal.
// One shared dark red keeps the bus network legible as a network, bold
// enough to read clearly against the dark basemap despite the route count.
export const BUS_COLOR = "#c0152f";
