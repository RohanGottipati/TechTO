import { z } from "zod";

/**
 * Allowlisted MapLibre actions the Explanation / Map Action agent may emit.
 * The frontend validates with Zod and remains the final executor.
 */

const lonLat = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);

export const mapActionSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("fly_to_center"),
      center: lonLat,
      zoom: z.number().min(8).max(20),
      durationMs: z.number().int().min(0).max(10_000),
    })
    .strict(),
  z
    .object({
      type: z.literal("fit_bounds"),
      bounds: z.tuple([z.number(), z.number(), z.number(), z.number()]),
      padding: z.number().min(0).max(200),
      durationMs: z.number().int().min(0).max(10_000),
    })
    .strict(),
  z
    .object({
      type: z.literal("highlight_neighbourhoods"),
      neighbourhoodIds: z.array(z.string().min(1)).min(1).max(20),
    })
    .strict(),
  z
    .object({
      type: z.literal("show_candidate_markers"),
      candidates: z
        .array(
          z
            .object({
              candidateId: z.string().min(1),
              coordinates: lonLat,
              rank: z.number().int().positive(),
              label: z.string().min(1).max(120),
            })
            .strict(),
        )
        .min(1)
        .max(20),
    })
    .strict(),
  z
    .object({
      type: z.literal("show_route_overlay"),
      routeGeoJsonId: z.string().min(1).max(80),
    })
    .strict(),
  z
    .object({
      type: z.literal("show_accessibility_area"),
      geometryId: z.string().min(1).max(80),
    })
    .strict(),
  z
    .object({
      type: z.literal("set_layer_visibility"),
      layerId: z.string().min(1).max(80),
      visible: z.boolean(),
    })
    .strict(),
  z
    .object({
      type: z.literal("select_candidate"),
      candidateId: z.string().min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal("open_panel"),
      panel: z.enum([
        "candidate_details",
        "policy_comparison",
        "citizen_reactions",
        "evidence",
        "stress_tests",
      ]),
    })
    .strict(),
]);

export type MapAction = z.output<typeof mapActionSchema>;

export const mapActionListSchema = z.array(mapActionSchema).max(30);

export type MapActionParseResult =
  | { ok: true; actions: MapAction[] }
  | { ok: false; rejected: unknown[]; errors: string[] };

/**
 * Validates a list of proposed map actions. Unknown or invalid actions are
 * rejected and logged via the returned errors array; valid ones still apply.
 */
export function parseMapActions(input: unknown): MapActionParseResult {
  if (!Array.isArray(input)) {
    return { ok: false, rejected: [input], errors: ["Map actions payload must be an array."] };
  }
  const actions: MapAction[] = [];
  const rejected: unknown[] = [];
  const errors: string[] = [];
  for (const item of input) {
    const parsed = mapActionSchema.safeParse(item);
    if (parsed.success) {
      actions.push(parsed.data);
    } else {
      rejected.push(item);
      errors.push(parsed.error.issues.map((i) => i.message).join("; "));
    }
  }
  if (rejected.length > 0 && actions.length === 0) {
    return { ok: false, rejected, errors };
  }
  return { ok: true, actions };
}
