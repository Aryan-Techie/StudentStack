import { getAllResources } from "@/lib/resources";
import { SOURCES } from "@/lib/ingestion/sources";
import { runIngestion } from "@/lib/ingestion/run-ingestion";
import { getExistingCandidateKeys, getSourceStates, insertCandidates, saveSourceRuns } from "@/lib/ingestion/queries";

export const maxDuration = 270;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const [resources, alreadySeenKeys, states] = await Promise.all([
    getAllResources(),
    getExistingCandidateKeys(),
    getSourceStates(),
  ]);
  const previousVersions = new Map(states.map((s) => [s.name, s.lastVersion]));
  const { toInsert, summary } = await runIngestion(SOURCES, resources, alreadySeenKeys, { previousVersions });
  await insertCandidates(toInsert);
  await saveSourceRuns(summary);

  console.log("ingestion run:", summary);
  return Response.json({ sources: summary, queued: toInsert.length });
}
