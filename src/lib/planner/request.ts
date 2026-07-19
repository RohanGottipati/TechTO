import { z } from "zod";

import { scenarioPatchSchema } from "@/lib/planner/scenario";

const overlaySchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("point"),
      id: z.string(),
      coordinates: z.tuple([z.number(), z.number()]),
      label: z.string(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("line"),
      id: z.string(),
      coordinates: z.array(z.tuple([z.number(), z.number()])),
      label: z.string(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("polygon"),
      id: z.string(),
      coordinates: z.array(z.tuple([z.number(), z.number()])),
      label: z.string(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("annotation"),
      id: z.string(),
      coordinates: z.tuple([z.number(), z.number()]),
      text: z.string(),
    })
    .strict(),
]);

export const plannerRunBodySchema = z.object({
  question: z.string().min(1),
  patches: z.array(scenarioPatchSchema).optional(),
  seed: z.number().optional(),
  agentOverlays: z.array(overlaySchema).optional(),
});

export type PlannerRunBody = z.infer<typeof plannerRunBodySchema>;
