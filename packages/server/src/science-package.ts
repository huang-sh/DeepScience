import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scienceEntry = fileURLToPath(import.meta.resolve("@shying/ds-science"));

/** Package root in both source workspaces (`src/index.ts`) and installed builds (`dist/index.js`). */
export const SCIENCE_PACKAGE_ROOT = resolve(dirname(scienceEntry), "..");
export const SCIENCE_SKILLS_ROOT = resolve(SCIENCE_PACKAGE_ROOT, "skills");
export const SCIENCE_RESOURCES_ROOT = resolve(SCIENCE_PACKAGE_ROOT, "resources");
