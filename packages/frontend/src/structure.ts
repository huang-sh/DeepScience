import type { AtomSpec } from "3dmol";

export type StructureFormat = "pdb" | "cif" | "mol2";

export interface EmbeddedStructure {
	data: string;
	format: StructureFormat;
}

export interface StructureAtomDetails {
	key: string;
	atom: string;
	element: string;
	residue: string;
	chain: string;
	serial: string;
	coordinates: string;
	bFactor: string;
	bonds: string;
}

export function structureFormatFromFilename(filename: string): StructureFormat | null {
	const extension = filename.toLowerCase().split(".").pop();
	if (extension === "pdb") return "pdb";
	if (extension === "cif" || extension === "mmcif") return "cif";
	if (extension === "mol2") return "mol2";
	return null;
}

export function extractEmbeddedStructure(html: string): EmbeddedStructure | null {
	const match = html.match(/\b(?:const|let|var)\s+data_\d+\s*=\s*`([\s\S]*?)`\s*;/);
	const data = match?.[1]?.trim();
	if (!data) return null;
	if (/^(?:ATOM|HETATM|MODEL)\b/m.test(data)) return { data, format: "pdb" };
	if (/^data_\S+/m.test(data) && /_atom_site\./.test(data)) return { data, format: "cif" };
	return null;
}

export function describeStructureAtom(atom: AtomSpec): StructureAtomDetails {
	const residueName = atom.resn || atom.lresn || "—";
	const residueNumber = atom.resi ?? atom.lresi;
	const residue = residueNumber === undefined ? residueName : `${residueName} ${residueNumber}${atom.icode ?? ""}`;
	const coordinate = (value: number | undefined) => (value === undefined ? "—" : value.toFixed(3));
	return {
		key: [atom.model ?? "", atom.index ?? atom.serial ?? "", atom.chain ?? "", residue, atom.atom ?? atom.elem ?? ""]
			.join(":")
			.trim(),
		atom: atom.atom || "—",
		element: atom.elem || "—",
		residue,
		chain: atom.chain || atom.lchain || "—",
		serial: atom.serial === undefined ? "—" : String(atom.serial),
		coordinates: `${coordinate(atom.x)}, ${coordinate(atom.y)}, ${coordinate(atom.z)}`,
		bFactor: atom.b === undefined ? "—" : atom.b.toFixed(2),
		bonds: String(atom.bonds?.length ?? 0),
	};
}
