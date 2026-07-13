import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";

const root = resolve(import.meta.dirname, "..");
const resourcesRoot = join(root, "packages/science/resources");
const skillsRoot = join(resourcesRoot, "skills");
const treePath = join(resourcesRoot, "resource_tree.json");

function collectExisting(node, result) {
	if (Array.isArray(node)) {
		for (const item of node) collectExisting(item, result);
		return;
	}
	if (!node || typeof node !== "object") return;
	if (typeof node["skill-name"] === "string") {
		const packageName = typeof node["package-name"] === "string" ? node["package-name"] : node["skill-name"];
		result.set(packageName, node);
		return;
	}
	for (const value of Object.values(node)) collectExisting(value, result);
}

function scalar(value) {
	const text = value.trim();
	if (text.startsWith('"') && text.endsWith('"')) return JSON.parse(text);
	if (text.startsWith("'") && text.endsWith("'")) return text.slice(1, -1);
	return text;
}

function metadata(document) {
	const end = document.indexOf("\n---\n", 4);
	if (!document.startsWith("---\n") || end < 0) throw new Error("Invalid RESOURCE.md frontmatter");
	const result = { metadata: {} };
	let nested = false;
	for (const line of document.slice(4, end).split("\n")) {
		if (line === "metadata:") {
			nested = true;
			continue;
		}
		if (nested && line.startsWith("  ") && line.includes(":")) {
			const index = line.indexOf(":");
			result.metadata[line.slice(0, index).trim()] = scalar(line.slice(index + 1));
			continue;
		}
		nested = false;
		if (!line.startsWith(" ") && line.includes(":")) {
			const index = line.indexOf(":");
			result[line.slice(0, index)] = scalar(line.slice(index + 1));
		}
	}
	return result;
}

async function walk(directory, predicate, result = []) {
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) await walk(path, predicate, result);
		else if (entry.isFile() && predicate(path)) result.push(path);
	}
	return result;
}

function label(segment) {
	const known = {
		"experimental-data": "Experimental Data",
		"biological-knowledge": "Biological Knowledge",
		literature: "Literature",
		"cellular-landscape": "Cellular Landscape",
		"clinical-and-phenotype": "Clinical & Phenotype",
		"dna-genome": "DNA & Genome",
		"functional-signatures": "Functional Signatures",
		"metabolic-landscape": "Metabolic Landscape",
		"protein-landscape": "Protein Landscape",
		"rna-regulation": "RNA Regulation",
	};
	return known[segment] ?? segment.replaceAll("-", " ").replace(/\b\w/g, (value) => value.toUpperCase());
}

const oldTree = JSON.parse(await readFile(treePath, "utf8"));
const existing = new Map();
collectExisting(oldTree, existing);
const documents = await walk(skillsRoot, (path) => path.endsWith(`${sep}RESOURCE.md`));
const packages = [];
for (const documentPath of documents) {
	const frontmatter = metadata(await readFile(documentPath, "utf8"));
	const packageDirectory = dirname(documentPath);
	const inferredCategory = dirname(relative(skillsRoot, packageDirectory)).split(sep).join("/");
	const category = frontmatter.category || inferredCategory;
	if (!frontmatter.name || !category) throw new Error(`Missing name/category: ${documentPath}`);
	const files = await walk(
		packageDirectory,
		(path) => !path.endsWith(`${sep}RESOURCE.md`) && !path.includes(`${sep}agents${sep}`),
	);
	const prior = existing.get(frontmatter.name) ?? {};
	const database = frontmatter.metadata.database || prior["db-name"] || frontmatter.name.replace(/^biomarker-/, "");
	packages.push({
		category: category.split("/").filter(Boolean),
		entry: {
			"db-name": prior["db-name"] || database,
			"show-name": prior["show-name"] || database,
			description: prior.description || frontmatter.description,
			reference: prior.reference || { "db-url": "", citation: "" },
			content: prior.content || [],
			paths: files
				.map((path) => `resource/${relative(resourcesRoot, path).split(sep).join("/")}`)
				.sort(),
			"skill-name": category.split("/")[0],
			"package-name": frontmatter.name,
			"access-mode": frontmatter.metadata["access-mode"] || "local",
		},
	});
}

packages.sort(
	(left, right) =>
		left.category.join("/").localeCompare(right.category.join("/")) ||
		left.entry["skill-name"].localeCompare(right.entry["skill-name"]),
);
const tree = {};
for (const item of packages) {
	let node = tree;
	for (const segment of item.category.slice(0, -1)) {
		const key = label(segment);
		if (Array.isArray(node[key])) {
			throw new Error(`Resource category is both a leaf and a parent: ${item.category.join("/")}`);
		}
		node[key] ??= {};
		node = node[key];
	}
	const leaf = label(item.category.at(-1));
	if (node[leaf] && !Array.isArray(node[leaf])) {
		throw new Error(`Resource category is both a parent and a leaf: ${item.category.join("/")}`);
	}
	node[leaf] ??= [];
	node[leaf].push(item.entry);
}
await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`);
console.log(JSON.stringify({ entries: packages.length }, null, 2));
