// Must be imported FIRST to ensure env vars are available for all module-level initializations
import { config } from "dotenv";
import { resolve } from "path";
import { existsSync } from "fs";

// Local dev: load from project root .env
// Production (Railway): vars are already in process.env, skip dotenv
const localEnv = resolve(import.meta.dir, "../../.env");
if (existsSync(localEnv)) {
  config({ path: localEnv });
  console.log("[env] loaded from", localEnv);
} else {
  console.log("[env] using process.env (production mode)");
}
