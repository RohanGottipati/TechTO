import type { ScenarioPatch } from "@/lib/planner/scenario";

/** Demo asks: same principled agents, different patches. */
export const CANNED_CITY_ASKS = [
  {
    id: "new-station",
    question: "Where should I open a new train station?",
    patches: [
      {
        id: "station-parkdale",
        title: "Parkdale station",
        rationale: "Underserved west-end demand near Queen West.",
        edits: [
          {
            type: "add_poi" as const,
            id: "poi-station-parkdale",
            label: "Parkdale GO/TTC node",
            lng: -79.435,
            lat: 43.637,
            kind: "station",
          },
        ],
      },
      {
        id: "station-scarborough",
        title: "Scarborough Town Centre station boost",
        rationale: "East-end access near STC.",
        edits: [
          {
            type: "add_poi" as const,
            id: "poi-station-stc",
            label: "STC interchange",
            lng: -79.258,
            lat: 43.776,
            kind: "station",
          },
        ],
      },
    ] satisfies ScenarioPatch[],
  },
  {
    id: "stadium-alderwood",
    question:
      "What would happen if I close the yellow metro line and instead use that money to build a stadium in Alderwood?",
    patches: [
      {
        id: "close-line1-stadium-alderwood",
        title: "Close Line 1 + stadium in Alderwood",
        rationale: "Trade subway ops budget for a local stadium.",
        edits: [
          {
            type: "close_route" as const,
            routeRef: "1",
            label: "Line 1 Yonge-University",
          },
          {
            type: "add_poi" as const,
            id: "poi-stadium-alderwood",
            label: "Alderwood stadium",
            lng: -79.542,
            lat: 43.608,
            kind: "stadium",
          },
          {
            type: "set_land_use" as const,
            neighbourhoodCode: "020",
            use: "stadium",
            label: "Alderwood land use",
          },
        ],
      },
      {
        id: "keep-line1-no-stadium",
        title: "Keep Line 1, no stadium",
        rationale: "Status-quo counterfactual.",
        edits: [
          {
            type: "set_policy" as const,
            key: "status_quo",
            value: true,
            label: "No change",
          },
        ],
      },
    ] satisfies ScenarioPatch[],
  },
  {
    id: "nuclear-siting",
    question: "Find me where to put a nuclear power plant",
    patches: [
      {
        id: "nuke-portlands",
        title: "Port Lands energy site",
        rationale: "Industrial waterfront, farther from dense residential core.",
        edits: [
          {
            type: "add_poi" as const,
            id: "poi-nuke-portlands",
            label: "Port Lands nuclear plant",
            lng: -79.34,
            lat: 43.65,
            kind: "energy",
          },
          {
            type: "set_land_use" as const,
            neighbourhoodCode: "085",
            use: "heavy_industrial_energy",
          },
        ],
      },
      {
        id: "nuke-rouge",
        title: "Rouge industrial fringe",
        rationale: "Eastern fringe, lower downtown exposure.",
        edits: [
          {
            type: "add_poi" as const,
            id: "poi-nuke-rouge",
            label: "Rouge energy plant",
            lng: -79.18,
            lat: 43.82,
            kind: "energy",
          },
        ],
      },
      {
        id: "nuke-downtown-reject",
        title: "Downtown core (stress candidate)",
        rationale: "Deliberately bad siting for adversarial compare.",
        edits: [
          {
            type: "add_poi" as const,
            id: "poi-nuke-downtown",
            label: "Downtown nuclear plant",
            lng: -79.3832,
            lat: 43.6532,
            kind: "energy",
          },
        ],
      },
    ] satisfies ScenarioPatch[],
  },
] as const;

export type CannedCityAskId = (typeof CANNED_CITY_ASKS)[number]["id"];

export function getCannedAsk(id: string) {
  return CANNED_CITY_ASKS.find((a) => a.id === id) ?? null;
}

export function matchCannedAsk(question: string) {
  const q = question.toLowerCase();
  if (q.includes("nuclear") || q.includes("power plant")) {
    return getCannedAsk("nuclear-siting");
  }
  if (q.includes("stadium") || q.includes("alderwood") || q.includes("yellow")) {
    return getCannedAsk("stadium-alderwood");
  }
  if (q.includes("station") || q.includes("train")) {
    return getCannedAsk("new-station");
  }
  return null;
}
