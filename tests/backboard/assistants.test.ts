import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";

import {
  ASSISTANT_ROSTER,
  INTENT_BUNDLES,
  MODEL_PROFILES,
  TWINTO_ASSISTANT_KEYS,
  getAssistantRole,
  listAssistantRoles,
  selectAssistantsForIntent,
  selectAssistantBundle,
} from "@/lib/backboard/assistants";
import { TOOL_DEFINITIONS } from "@/lib/backboard/tools";
import { FLAGSHIP_SCENARIO_ID } from "@/data/transit/scenarios";

const OLD_SPECIALIST_KEYS = [
  "problem-definition",
  "passenger-arrival",
  "subway-scheduling",
  "mode-shift",
  "concert-event",
  "adversarial-stress",
  "memory-curator",
  "devils-advocate",
];

describe("ASSISTANT_ROSTER consolidated-16", () => {
  it("has exactly 16 unique role keys matching TWINTO_ASSISTANT_KEYS", () => {
    expect(TWINTO_ASSISTANT_KEYS).toHaveLength(16);
    expect(Object.keys(ASSISTANT_ROSTER)).toHaveLength(16);
    expect(new Set(Object.keys(ASSISTANT_ROSTER)).size).toBe(16);
    for (const key of TWINTO_ASSISTANT_KEYS) {
      expect(ASSISTANT_ROSTER[key]).toBeDefined();
    }
  });

  it("has unique TwinTO names and no GridTwin or battery roles", () => {
    const names = Object.values(ASSISTANT_ROSTER).map((role) => role.name);
    expect(new Set(names).size).toBe(16);
    for (const role of Object.values(ASSISTANT_ROSTER)) {
      expect(role.name).toMatch(/^TwinTO —/);
      expect(role.name).not.toMatch(/gridtwin/i);
      expect(role.name).not.toMatch(/battery/i);
    }
  });

  it("does not keep any old 54-agent specialist keys active", () => {
    for (const key of OLD_SPECIALIST_KEYS) {
      expect(ASSISTANT_ROSTER[key as keyof typeof ASSISTANT_ROSTER]).toBeUndefined();
    }
  });

  it("every system prompt carries the shared guard", () => {
    for (const role of Object.values(ASSISTANT_ROSTER)) {
      expect(role.systemPrompt).toContain("You must never represent simulated citizen reactions as real public opinion.");
      expect(role.systemPrompt).toContain("You must never reveal private chain-of-thought.");
    }
  });

  it("assigns only valid tools and existing knowledge documents", () => {
    for (const role of Object.values(ASSISTANT_ROSTER)) {
      for (const tool of role.toolNames) {
        expect(TOOL_DEFINITIONS[tool]).toBeDefined();
      }
      for (const doc of role.knowledgeDocuments) {
        expect(existsSync(path.join(process.cwd(), doc.repoPath))).toBe(true);
      }
    }
  });

  it("uses valid model profiles and memory policies", () => {
    expect(ASSISTANT_ROSTER["adversarial-reviewer"].memory).toBe("off");
    expect(ASSISTANT_ROSTER["city-copilot"].memory).toBe("Readonly");
    expect(ASSISTANT_ROSTER["final-policy-judge"].modelRequirement).toEqual(MODEL_PROFILES.RISK_REASONING);
    expect(getAssistantRole("final-policy-judge").name).toContain("Final Policy Judge");
    expect(listAssistantRoles()).toHaveLength(16);
  });
});

describe("intent bundles", () => {
  it("keeps simple navigation to 3 or fewer assistants", () => {
    expect(selectAssistantsForIntent("SIMPLE_MAP_NAVIGATION").length).toBeLessThanOrEqual(3);
  });

  it("activates Events and Incident Agent for EVENT_RESPONSE only when needed", () => {
    expect(selectAssistantsForIntent("EVENT_RESPONSE")).toContain("events-incidents-agent");
    expect(selectAssistantsForIntent("SCHEDULE_CHANGE")).not.toContain("events-incidents-agent");
    expect(selectAssistantsForIntent("NEW_STATION_LOCATION")).not.toContain("events-incidents-agent");
    expect(selectAssistantsForIntent("NEW_STATION_LOCATION", { includeEvents: true })).toContain(
      "events-incidents-agent",
    );
  });

  it("maps the flagship scenario to an event-aware planning bundle", () => {
    const bundle = selectAssistantBundle(FLAGSHIP_SCENARIO_ID);
    expect(bundle.length).toBeGreaterThanOrEqual(13);
    expect(bundle).toContain("final-policy-judge");
    expect(bundle).toContain("events-incidents-agent");
  });

  it("exposes every intent bundle as unique keys from the roster", () => {
    for (const [intent, bundle] of Object.entries(INTENT_BUNDLES)) {
      expect(new Set(bundle).size).toBe(bundle.length);
      for (const key of bundle) {
        expect(ASSISTANT_ROSTER[key], intent).toBeDefined();
      }
    }
  });
});
