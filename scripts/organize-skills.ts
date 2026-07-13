import { cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	SkillCatalog,
	type SkillCatalogEntry,
	type SkillSourceConfig,
	type SkillSourceId,
} from "../packages/server/src/skill-catalog.ts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const collectionRoot = resolve(repoRoot, "..");
const legacySkillRoot = resolve(repoRoot, "skills");
const skillRoot = resolve(repoRoot, "packages", "science", "skills");
const stagingRoot = resolve(repoRoot, "packages", "science", ".skills-staging");
const backupRoot = resolve(repoRoot, "packages", "science", ".skills-backup");
const openScienceSkillRoot = resolve(collectionRoot, "openscience", "backend", "cli", "skills");
const bioSkillsRoot = resolve(collectionRoot, "bioSkills");
const TAXONOMY = [
	"biology",
	"chemistry",
	"cloud-compute",
	"coding",
	"data-engineering",
	"databases",
	"document-parsing",
	"llm-tools",
	"ml-inference",
	"ml-training",
	"other",
	"physics",
	"quantum",
	"research",
	"scholar-evaluation",
	"visualization",
	"writing",
] as const;
type TaxonomyCategory = (typeof TAXONOMY)[number];
const TAXONOMY_SET = new Set<string>(TAXONOMY);

async function exists(path: string): Promise<boolean> {
	try {
		await stat(path);
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
		throw error;
	}
}

function safeSegment(value: string): string {
	const normalized = value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.replace(/-{2,}/g, "-");
	if (!normalized) throw new Error(`Unsafe empty path segment from ${JSON.stringify(value)}`);
	return normalized;
}

async function migrationSources(): Promise<SkillSourceConfig[]> {
	if (await exists(skillRoot)) {
		return [{ path: skillRoot, id: "deepscience", label: "DeepScience", priority: 50 }];
	}
	if (await exists(resolve(legacySkillRoot, "deepscience"))) {
		return [
			{ path: resolve(legacySkillRoot, "deepscience"), id: "deepscience", label: "DeepScience", priority: 50 },
			{
				path: resolve(legacySkillRoot, "tooluniverse"),
				id: "tooluniverse",
				label: "ToolUniverse",
				priority: 30,
				defaultCategory: "tooluniverse",
			},
			{ path: resolve(legacySkillRoot, "bioskills"), id: "bioskills", label: "bioSkills", priority: 40 },
		];
	}
	return [
		{ path: legacySkillRoot, id: "deepscience", label: "DeepScience", priority: 50 },
		{
			path: resolve(collectionRoot, "ToolUniverse", "skills"),
			id: "tooluniverse",
			label: "ToolUniverse",
			priority: 30,
			defaultCategory: "tooluniverse",
		},
		{ path: resolve(collectionRoot, "bioSkills"), id: "bioskills", label: "bioSkills", priority: 40 },
	];
}

interface PreviousManifestEntry {
	name: string;
	category: string;
	categoryPath?: string[];
	source: SkillSourceId;
}

async function previousManifest(): Promise<Map<string, PreviousManifestEntry>> {
	const root = (await exists(skillRoot)) ? skillRoot : legacySkillRoot;
	const path = resolve(root, "catalog.json");
	if (!(await exists(path))) return new Map();
	const value = JSON.parse(await readFile(path, "utf8")) as { skills?: PreviousManifestEntry[] };
	return new Map((value.skills ?? []).map((entry) => [entry.name, entry]));
}

async function openScienceCategories(): Promise<Map<string, TaxonomyCategory>> {
	const result = new Map<string, TaxonomyCategory>();
	if (!(await exists(openScienceSkillRoot))) return result;
	for (const categoryEntry of await readdir(openScienceSkillRoot, { withFileTypes: true })) {
		if (!categoryEntry.isDirectory() || !TAXONOMY_SET.has(categoryEntry.name)) continue;
		const category = categoryEntry.name as TaxonomyCategory;
		const categoryPath = resolve(openScienceSkillRoot, category);
		if (await exists(resolve(categoryPath, "SKILL.md"))) result.set(category, category);
		for (const skillEntry of await readdir(categoryPath, { withFileTypes: true })) {
			if (skillEntry.isDirectory() && (await exists(resolve(categoryPath, skillEntry.name, "SKILL.md")))) {
				result.set(skillEntry.name, category);
			}
		}
	}
	return result;
}

async function claudeCategories(): Promise<Map<string, TaxonomyCategory>> {
	const path = process.env.DEEPSCIENCE_SKILL_TAXONOMY ?? "/tmp/deepscience-skill-taxonomy.json";
	if (!(await exists(path))) return new Map();
	const value = JSON.parse(await readFile(path, "utf8")) as { skills?: Record<string, string> };
	const result = new Map<string, TaxonomyCategory>();
	for (const [name, category] of Object.entries(value.skills ?? {})) {
		if (TAXONOMY_SET.has(category)) result.set(name, category as TaxonomyCategory);
	}
	return result;
}

async function bioSkillsSubcategories(): Promise<Map<string, string>> {
	if (!(await exists(bioSkillsRoot))) return new Map();
	const catalog = new SkillCatalog([
		{ path: bioSkillsRoot, id: "bioskills", label: "bioSkills", priority: 100 },
	]);
	await catalog.reload();
	const skills = await catalog.list({ limit: 5_000 });
	return new Map(
		skills.map((skill) => [skill.name, safeSegment(relative(bioSkillsRoot, skill.filePath).split(/[\\/]/)[0])]),
	);
}

function inferredCategory(skill: SkillCatalogEntry, source: SkillSourceId): TaxonomyCategory {
	if (TAXONOMY_SET.has(skill.category)) return skill.category as TaxonomyCategory;
	const text = `${skill.name} ${skill.description} ${skill.category}`.toLowerCase();
	if (source === "bioskills") {
		if (["chemoinformatics", "metabolomics"].includes(skill.category)) return "chemistry";
		if (["clinical-databases", "database-access"].includes(skill.category)) return "databases";
		if (skill.category === "data-visualization") return "visualization";
		if (skill.category === "reporting") return "writing";
		if (skill.category === "machine-learning") return "ml-training";
		if (["workflow-management", "workflows"].includes(skill.category)) return "data-engineering";
		if (["clinical-biostatistics", "experimental-design"].includes(skill.category)) return "research";
		return "biology";
	}
	if (source === "tooluniverse") {
		const name = skill.name.replace(/^tooluniverse-/, "");
		if (/^devtu-|plugin|sdk|setup|install-skills|custom-tool|create-tool|self-review|^tooluniverse$/.test(skill.name)) {
			return "coding";
		}
		if (/retrieval|fact-lookup|dataset-discovery/.test(name)) return "databases";
		if (/literature|meta-analysis|clinical-trial-design|epidemiological|mendelian-randomization|statistical-modeling|diagnostic-test/.test(name)) {
			return "research";
		}
		if (/image-analysis|electron-microscopy/.test(name)) return "visualization";
		if (/computational-biophysics/.test(name)) return "physics";
		if (
			/admet|chemical|compound|drug|dose-response|enzyme-kinetics|gpcr|lipidomics|metabolomics|natural-product|organic-chemistry|inorganic-physical-chemistry|pharmac|small-molecule|toxicology/.test(
				name,
			)
		) {
			return "chemistry";
		}
		return "biology";
	}
	if (/quantum|qiskit|cirq|qutip|pennylane/.test(text)) return "quantum";
	if (/astronom|physics|pde|ode|fluid|mechanic|dynamical|spectral|wave/.test(text)) return "physics";
	if (/chem|molecul|compound|drug|admet|docking|smiles|pharmac|metabolomics/.test(text)) return "chemistry";
	if (/database|knowledge-base|retriev|lookup|pubmed|clinicaltrials|ontology/.test(text)) return "databases";
	if (/visual|plot|chart|diagram|figure|image-render/.test(text)) return "visualization";
	if (/paper|manuscript|writing|report|citation|publication|grant/.test(text)) return "writing";
	if (/pdf|document-pars|ocr|markitdown/.test(text)) return "document-parsing";
	if (/cloud|gpu|modal|tinker|tensorpool|skypilot|lambda-labs/.test(text)) return "cloud-compute";
	if (/inference|serving|vllm|sglang|quantization|gguf|tensorrt/.test(text)) return "ml-inference";
	if (/machine-learning|model-training|fine-tun|benchmark|embedding|neural-network/.test(text)) return "ml-training";
	if (/data-engineer|pipeline|workflow-management|nextflow|snakemake|data-format/.test(text)) return "data-engineering";
	if (/agent|llm|language-model|rag|prompt|vector-store/.test(text)) return "llm-tools";
	if (/code|software|github|statistic|algorithm|programming/.test(text)) return "coding";
	if (/scholar|researcher-evaluation|bibliometric/.test(text)) return "scholar-evaluation";
	if (source === "bioskills" || /gene|genom|protein|cell|rna|dna|clinical|disease|biolog/.test(text)) {
		return "biology";
	}
	if (/research|literature|hypothesis|evidence|experimental-design/.test(text)) return "research";
	return "other";
}

async function copySkill(skill: SkillCatalogEntry, categoryPath: string[]): Promise<{ path: string; files: number }> {
	const sourceDirectory = dirname(skill.filePath);
	const name = safeSegment(skill.name);
	const relativePath = [...categoryPath.map(safeSegment), name].join("/");
	const destination = resolve(stagingRoot, relativePath);
	await mkdir(dirname(destination), { recursive: true });
	await cp(sourceDirectory, destination, {
		recursive: true,
		preserveTimestamps: true,
		filter: (path) => !path.split("/").some((segment) => [".git", ".venv", "__pycache__", "node_modules"].includes(segment)),
	});
	if (!(await exists(resolve(destination, "SKILL.md")))) {
		throw new Error(`Copied skill is missing SKILL.md: ${relativePath}`);
	}

	let files = 0;
	const countFiles = async (directory: string): Promise<void> => {
		for (const entry of await readdir(directory, { withFileTypes: true })) {
			if (entry.isDirectory()) await countFiles(resolve(directory, entry.name));
			else if (entry.isFile()) files++;
		}
	};
	await countFiles(destination);
	return { path: `${relativePath}/SKILL.md`, files };
}

async function main(): Promise<void> {
	const catalog = new SkillCatalog(await migrationSources());
	await catalog.reload();
	const skills = await catalog.list({ limit: 5_000 });
	const stats = await catalog.getStats();
	const previous = await previousManifest();
	const openScience = await openScienceCategories();
	const claude = await claudeCategories();
	const bioSkills = await bioSkillsSubcategories();
	if (skills.length === 0) throw new Error("No skills were discovered; refusing to replace the skill library");
	if (skills.some((skill) => skill.source === "project" || skill.source === "user")) {
		throw new Error("Project or user skills must not be vendored into the DeepScience library");
	}
	const prepared = skills.map((skill) => {
		const prior = previous.get(skill.name);
		const source = prior?.source ?? skill.source;
		const openScienceCategory = openScience.get(skill.name);
		const claudeCategory = claude.get(skill.name);
		const category = openScienceCategory ?? claudeCategory ?? inferredCategory(skill, source);
		const priorCategoryPath = prior?.categoryPath?.map(safeSegment);
		const bioSkillsSubcategory = source === "bioskills" ? bioSkills.get(skill.name) : undefined;
		if (source === "bioskills" && category === "biology" && !bioSkillsSubcategory && !priorCategoryPath?.[1]) {
			throw new Error(`Missing bioSkills subcategory for biology skill: ${skill.name}`);
		}
		const categoryPath =
			category === "biology"
				? [category, bioSkillsSubcategory ?? priorCategoryPath?.[1] ?? "general"]
				: [category];
		return {
			skill,
			source,
			category,
			categoryPath,
			method: openScienceCategory ? "openscience" : claudeCategory ? "claude" : "inferred",
		};
	});
	const plannedCategoryCounts = Object.fromEntries(
		TAXONOMY.map((category) => [category, prepared.filter((entry) => entry.category === category).length]),
	);
	const methodCounts = Object.fromEntries(
		["openscience", "claude", "inferred"].map((method) => [
			method,
			prepared.filter((entry) => entry.method === method).length,
		]),
	);
	const plannedBiologySubcategoryCounts = Object.fromEntries(
		[...new Set(prepared.filter((entry) => entry.category === "biology").map((entry) => entry.categoryPath[1]))]
			.sort()
			.map((subcategory) => [
				subcategory,
				prepared.filter((entry) => entry.categoryPath[0] === "biology" && entry.categoryPath[1] === subcategory).length,
			]),
	);
	if (process.argv.includes("--dry-run")) {
		console.log(
			JSON.stringify({
				total: prepared.length,
				categories: plannedCategoryCounts,
				biologySubcategories: plannedBiologySubcategoryCounts,
				methods: methodCounts,
			}),
		);
		return;
	}

	await rm(stagingRoot, { recursive: true, force: true });
	await rm(backupRoot, { recursive: true, force: true });
	await mkdir(stagingRoot, { recursive: true });

	const manifestEntries: Array<{
		name: string;
		category: TaxonomyCategory;
		categoryPath: string[];
		source: SkillSourceId;
		path: string;
		aliases: string[];
		files: number;
	}> = [];
	let cursor = 0;
	const workers = Array.from({ length: 12 }, async () => {
		while (cursor < prepared.length) {
			const { skill, source, category, categoryPath } = prepared[cursor++];
			const copied = await copySkill(skill, categoryPath);
			manifestEntries.push({
				name: skill.name,
				category,
				categoryPath,
				source,
				path: copied.path,
				aliases: skill.aliases,
				files: copied.files,
			});
		}
	});
	await Promise.all(workers);
	manifestEntries.sort((left, right) => left.source.localeCompare(right.source) || left.name.localeCompare(right.name));

	const destinationByName = new Map(manifestEntries.map((entry) => [entry.name, dirname(entry.path)]));
	for (const entry of manifestEntries) {
		const path = resolve(stagingRoot, entry.path);
		const raw = await readFile(path, "utf8");
		const rewritten = raw.replace(/(?:\.\.\/)+(?:[a-z0-9-]+\/)*([a-z0-9-]+)\/(SKILL\.md|scripts\/[a-zA-Z0-9_./-]+)/g, (match, name: string, suffix: string) => {
			const target = destinationByName.get(name);
			if (!target) return match;
			const from = resolve(stagingRoot, dirname(entry.path));
			const to = resolve(stagingRoot, target);
			const link = relative(from, to).replace(/\\/g, "/") || ".";
			return `${link}/${suffix}`;
		});
		if (rewritten !== raw) await writeFile(path, rewritten, "utf8");
	}

	const sourceCounts = Object.fromEntries(
		["deepscience", "tooluniverse", "bioskills"].map((source) => [
			source,
			manifestEntries.filter((entry) => entry.source === source).length,
		]),
	);
	const categoryCounts = Object.fromEntries(
		TAXONOMY.map((category) => [category, manifestEntries.filter((entry) => entry.category === category).length]),
	);
	const biologySubcategoryCounts = Object.fromEntries(
		Object.entries(plannedBiologySubcategoryCounts).filter(([, count]) => count > 0),
	);
	await writeFile(
		resolve(stagingRoot, "catalog.json"),
		`${JSON.stringify(
			{
				version: 2,
				generatedAt: new Date().toISOString(),
				total: manifestEntries.length,
				duplicatesRemoved: stats.duplicates,
				taxonomy: TAXONOMY,
				categories: categoryCounts,
				categoryHierarchy: { biology: biologySubcategoryCounts },
				sources: sourceCounts,
				skills: manifestEntries,
			},
			null,
			2,
		)}\n`,
		"utf8",
	);

	for (const entry of manifestEntries) {
		const raw = await readFile(resolve(stagingRoot, entry.path), "utf8");
		if (!raw.trim()) throw new Error(`Empty skill file after migration: ${entry.path}`);
	}

	await mkdir(dirname(skillRoot), { recursive: true });
	const hadTarget = await exists(skillRoot);
	if (hadTarget) await rename(skillRoot, backupRoot);
	try {
		await rename(stagingRoot, skillRoot);
	} catch (error) {
		if (hadTarget) await rename(backupRoot, skillRoot);
		throw error;
	}
	await rm(backupRoot, { recursive: true, force: true });
	if (legacySkillRoot !== skillRoot) await rm(legacySkillRoot, { recursive: true, force: true });

	const fileCount = manifestEntries.reduce((sum, entry) => sum + entry.files, 0);
	console.log(
		JSON.stringify({
			total: manifestEntries.length,
			sources: sourceCounts,
			categories: categoryCounts,
			files: fileCount,
			duplicatesRemoved: stats.duplicates,
		}),
	);
}

await main();
