import { errorMessage, jsonError } from "@/lib/backboard/route-helpers";
import { getTransitRepository } from "@/lib/transit/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Serves the active repository's cohorts (fixture or Mongo-backed) to the client. Keeps Mongo access server-only. */
export async function GET() {
  try {
    const repo = await getTransitRepository();
    return Response.json({ cohorts: repo.listCohorts() });
  } catch (error) {
    return jsonError(errorMessage(error), 500);
  }
}
