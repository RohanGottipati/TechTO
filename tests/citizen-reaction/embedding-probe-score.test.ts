// @vitest-environment node
// onnxruntime-node's native tensor binding does an instanceof check against
// Node's native Float32Array; jsdom's realm provides a different one, which
// this project's default vitest environment otherwise uses for DOM tests.
import { describe, expect, it } from "vitest";

import { embeddingProbeMetadata, scoreOpinionWithEmbeddingProbe } from "@/lib/citizen-reaction/embedding-probe-score";

describe("scoreOpinionWithEmbeddingProbe", () => {
  it("returns a bounded score for real-looking opinion text", async () => {
    const score = await scoreOpinionWithEmbeddingProbe(
      "I support this plan, it would make things better for people like me in this neighbourhood.",
    );
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("returns neutral (0.5) for empty text", async () => {
    expect(await scoreOpinionWithEmbeddingProbe("")).toBe(0.5);
  });

  it("is deterministic for the same input", async () => {
    const text = "This tax increase is unfair to working families and should be reconsidered.";
    const [a, b] = await Promise.all([
      scoreOpinionWithEmbeddingProbe(text),
      scoreOpinionWithEmbeddingProbe(text),
    ]);
    expect(a).toBe(b);
  });

  it("exposes real training provenance beating the TF-IDF probe", () => {
    const meta = embeddingProbeMetadata();
    expect(meta.nExamples).toBeGreaterThan(1000);
    expect(meta.valAuc).toBeGreaterThan(0.7);
  });

  it("separates clearly polar opinions instead of clustering everything near 0.5", async () => {
    // Regression guard: the pre-calibration probe scored blatantly positive
    // and negative text within ~0.03 of neutral (dot products barely left
    // zero). Platt scaling (temperature/calibrationBias in the weights file)
    // should now visibly spread these apart.
    const [positive, negative] = await Promise.all([
      scoreOpinionWithEmbeddingProbe(
        "I think it is important to make sure that we have a publicly run charging hub for those that need it.",
      ),
      scoreOpinionWithEmbeddingProbe(
        "I am completely against this. It wastes taxpayer money and helps nobody in my neighbourhood.",
      ),
    ]);
    expect(positive).toBeGreaterThan(0.55);
    expect(negative).toBeLessThan(0.45);
  });
}, 30000);
