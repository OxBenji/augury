// Must be imported FIRST to ensure env vars are available for all module-level initializations
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(import.meta.dir, "../../.env") });
