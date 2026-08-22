/* ================================================================== */
/* LEGO BLOCK — the single admin-wide toggle for whether opening a PR    */
/* on a QA comment (regular or Jynx-meta) should immediately mark it     */
/* "Done" on its own, or leave that to a manual click as before (see     */
/* the "Opening a PR doesn't auto-close this..." hint in                 */
/* DevAnnotationsScreen.jsx / JynxFeedbackScreen.jsx, which is still      */
/* shown whenever this is off). Same global-not-per-session shape as     */
/* dataMode.js — this is an admin preference for how the pipeline        */
/* behaves, not a per-user setting.                                       */
/*                                                                        */
/* Git-tracked (unlike data-mode.json) because this is a real admin       */
/* decision worth surviving a redeploy, not throwaway demo state — same   */
/* githubPersist.js pattern as lib/devUsers.js.                           */
/*                                                                        */
/* IMPORTANT for the jynx-action-worker routine: it sets actionStatus to  */
/* "pr_opened" via a DIRECT git commit to the note file, bypassing this   */
/* server's HTTP API entirely — so this setting can't be enforced         */
/* reactively from a route handler. The routine's own prompt reads this   */
/* file directly from its checked-out working copy before that bookkeeping*/
/* commit, and also sets resolved:true/resolvedAt/resolvedBy at the same  */
/* time when autoResolveOnPrOpened is true. See FORCLAUDE.md.             */
/* ================================================================== */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileFromGithub, commitFileToGithub, githubPersistEnabled } from "./githubPersist.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, "..", "config", "annotation-settings.json");
const GITHUB_PATH = "data/config/annotation-settings.json";
const DEFAULTS = { autoResolveOnPrOpened: false };

export function readAnnotationSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(FILE, "utf8")) };
  } catch {
    return { ...DEFAULTS };
  }
}

function writeLocal(settings) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(settings, null, 2) + "\n");
}

export async function writeAnnotationSettings(patch) {
  const next = { ...readAnnotationSettings(), ...patch };
  writeLocal(next);
  if (githubPersistEnabled()) {
    await commitFileToGithub(GITHUB_PATH, JSON.stringify(next, null, 2) + "\n", `annotation settings: autoResolveOnPrOpened=${next.autoResolveOnPrOpened}`);
  }
  return next;
}

export async function hydrateAnnotationSettingsFromGithub() {
  if (!githubPersistEnabled()) return;
  const remote = await readFileFromGithub(GITHUB_PATH);
  if (remote) writeLocal(JSON.parse(remote.content));
}
