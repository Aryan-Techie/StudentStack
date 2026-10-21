// Registered ingestion sources (issues #40, #83). Adding one means: write a
// file in this directory implementing IngestionSource (see ../types.ts),
// then add it below. No changes needed anywhere else — not the cron route,
// not the dedup logic, not the schema.
import type { IngestionSource } from "../types";
import { apifySources } from "./apify";
import { brabble, scholars4dev } from "./feeds";
import { ayushPrograms, deepanshuPrograms, eduPerks, githubStudentPack, yashisraniPrograms } from "./github";

export function getSources(env: NodeJS.ProcessEnv = process.env): IngestionSource[] {
  return [
    scholars4dev,
    brabble,
    yashisraniPrograms,
    ayushPrograms,
    deepanshuPrograms,
    eduPerks,
    githubStudentPack,
    // Paid per run, so only when the maintainer opts in with a token.
    ...apifySources(env.APIFY_TOKEN?.trim()),
  ];
}

export const SOURCES: IngestionSource[] = getSources();
