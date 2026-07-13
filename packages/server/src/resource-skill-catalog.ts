import { resolve } from "node:path";
import { SCIENCE_RESOURCES_ROOT } from "./science-package.ts";
import { SkillCatalog } from "./skill-catalog.ts";

const RESOURCE_SKILLS_ROOT = resolve(SCIENCE_RESOURCES_ROOT, "skills");

export const resourceSkillCatalog = new SkillCatalog([
	{
		path: RESOURCE_SKILLS_ROOT,
		id: "deepscience",
		label: "DeepScience Resources",
		priority: 100,
		defaultCategory: "resources",
	},
]);
