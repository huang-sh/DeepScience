import { readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface ManifestSkill {
	name: string;
	category: string;
	categoryPath: string[];
	source: string;
	path: string;
}

interface SkillManifest {
	version: number;
	total: number;
	categoryHierarchy?: Record<string, Record<string, number>>;
	skills: ManifestSkill[];
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skillRoot = resolve(repoRoot, "packages", "science", "skills");
const manifest = JSON.parse(await readFile(resolve(skillRoot, "catalog.json"), "utf8")) as SkillManifest;
const errors: string[] = [];
const names = new Set<string>();
const paths = new Set<string>();
const hierarchyCounts = new Map<string, number>();
let checkedReferences = 0;

if (manifest.version < 2) errors.push(`Expected catalog version 2 or newer, got ${manifest.version}`);
if (manifest.total !== manifest.skills.length) {
	errors.push(`Manifest total ${manifest.total} does not match ${manifest.skills.length} entries`);
}

for (const skill of manifest.skills) {
	if (names.has(skill.name)) errors.push(`Duplicate skill name: ${skill.name}`);
	if (paths.has(skill.path)) errors.push(`Duplicate skill path: ${skill.path}`);
	names.add(skill.name);
	paths.add(skill.path);
	if (skill.categoryPath[0] !== skill.category) {
		errors.push(`${skill.name}: category ${skill.category} does not match categoryPath ${skill.categoryPath.join("/")}`);
	}
	const expectedPath = [...skill.categoryPath, skill.name, "SKILL.md"].join("/");
	if (skill.path !== expectedPath) errors.push(`${skill.name}: expected path ${expectedPath}, got ${skill.path}`);
	const filePath = resolve(skillRoot, skill.path);
	if (!(await stat(filePath).catch(() => undefined))?.isFile()) {
		errors.push(`${skill.name}: missing ${skill.path}`);
		continue;
	}
	const hierarchyPath = skill.categoryPath.join("/");
	hierarchyCounts.set(hierarchyPath, (hierarchyCounts.get(hierarchyPath) ?? 0) + 1);
	const raw = await readFile(filePath, "utf8");
	for (const match of raw.matchAll(/((?:\.\.\/)+[a-zA-Z0-9_.\/-]+\/SKILL\.md)/g)) {
		checkedReferences++;
		const target = resolve(dirname(filePath), match[1]);
		if (!(await stat(target).catch(() => undefined))?.isFile()) {
			errors.push(`${skill.name}: missing relative reference ${match[1]}`);
		}
	}
}

for (const [category, children] of Object.entries(manifest.categoryHierarchy ?? {})) {
	for (const [subcategory, expected] of Object.entries(children)) {
		const path = `${category}/${subcategory}`;
		const actual = hierarchyCounts.get(path) ?? 0;
		if (actual !== expected) errors.push(`${path}: expected ${expected} skills, found ${actual}`);
	}
}

if (errors.length > 0) throw new Error(`Skill library validation failed:\n${errors.join("\n")}`);
console.log(
	JSON.stringify({
		ok: true,
		total: manifest.skills.length,
		categoryPaths: hierarchyCounts.size,
		biologySubcategories: Object.keys(manifest.categoryHierarchy?.biology ?? {}).length,
		checkedReferences,
	}),
);
