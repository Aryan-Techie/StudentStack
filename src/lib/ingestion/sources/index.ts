// Registered ingestion sources (issues #40, #83). Adding one means: write a
// file in this directory implementing IngestionSource (see ../types.ts),
// then add it below. No changes needed anywhere else — not the cron route,
// not the dedup logic, not the schema.
import type { IngestionSource } from "../types";
import { apifySources } from "./apify";
import { brabble, scholars4dev } from "./feeds";
import { ayushPrograms, deepanshuPrograms, eduPerks, githubStudentPack, yashisraniPrograms } from "./github";
import { vendorWatchSources } from "./vendor-watch";

// Built fresh for every cron run: some sources cache their fetch for the
// length of one run (see vendor-watch.ts).
export function getSources(env: NodeJS.ProcessEnv = process.env): IngestionSource[] {
  return [
    scholars4dev,
    brabble,
    yashisraniPrograms,
    ayushPrograms,
    deepanshuPrograms,
    eduPerks,
    githubStudentPack,
    // Official vendor student pages, re-queued for review when their offer
    // text changes (issue #40).
    ...vendorWatchSources(),
    // Paid per run, so only when the maintainer opts in with a token.
    ...apifySources(env.APIFY_TOKEN?.trim()),
  ];
}

// Names only, for the admin source-health table. Building the sources
// is cheap and fetches nothing.
export function sourceNames(env: NodeJS.ProcessEnv = process.env): string[] {
  return getSources(env).map((s) => s.name);
}
