import { describe, expect, it } from "vitest";

import { selectAssistantsForIntent } from "@/lib/backboard/assistants";
import { classifyPlanningIntent } from "@/lib/twinto/intent";

describe("classifyPlanningIntent", () => {
  it("falls back safely for unknown free text to a planning path", () => {
    expect(classifyPlanningIntent("tell me something useful about transit")).toBe("SCHEDULE_CHANGE");
  });

  it("keeps simple explanation bundles small", () => {
    expect(selectAssistantsForIntent(classifyPlanningIntent("What does load imbalance mean?")).length).toBeLessThanOrEqual(3);
  });
});
