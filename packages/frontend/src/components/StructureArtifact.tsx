import { Show, createEffect, createSignal, onCleanup } from "solid-js";
import * as $3Dmol from "3dmol";
import type { AtomSelectionSpec, AtomSpec, GLViewer, Label } from "3dmol";
import { theme } from "../store";
import { describeStructureAtom, type StructureAtomDetails, type StructureFormat } from "../structure";

function atomSelection(atom: AtomSpec): AtomSelectionSpec {
	if (atom.index !== undefined) return { index: atom.index };
	if (atom.serial !== undefined) return { serial: atom.serial };
	return {
		chain: atom.chain,
		resi: atom.resi,
		atom: atom.atom,
	};
}

function atomLabel(atom: AtomSpec): string {
	const details = describeStructureAtom(atom);
	return `${details.residue} · ${details.atom} (${details.element})`;
}

function applyBaseStyle(viewer: GLViewer, format: StructureFormat): void {
	if (format === "mol2") {
		viewer.setStyle({}, {
			stick: { radius: 0.18, colorscheme: "Jmol" },
			sphere: { scale: 0.25, colorscheme: "Jmol" },
		});
		return;
	}
	viewer.setStyle({ hetflag: false }, { cartoon: { color: "spectrum" } });
	viewer.setStyle({ hetflag: true }, {
		stick: { radius: 0.16, colorscheme: "Jmol" },
		sphere: { scale: 0.24, colorscheme: "Jmol" },
	});
}

export default function StructureArtifact(props: {
	data: string;
	format: StructureFormat;
	title?: string;
}) {
	let container: HTMLDivElement | undefined;
	const [loading, setLoading] = createSignal(true);
	const [error, setError] = createSignal("");
	const [hoveredAtom, setHoveredAtom] = createSignal<StructureAtomDetails | null>(null);
	const [selectedAtom, setSelectedAtom] = createSignal<StructureAtomDetails | null>(null);
	const inspectedAtom = () => selectedAtom() ?? hoveredAtom();

	createEffect(() => {
		const data = props.data;
		const format = props.format;
		const activeTheme = theme();
		let disposed = false;
		let viewer: GLViewer | undefined;
		let observer: ResizeObserver | undefined;
		let hoverLabel: Label | undefined;
		let selectedLabel: Label | undefined;
		let selectedKey = "";
		setLoading(true);
		setError("");
		setHoveredAtom(null);
		setSelectedAtom(null);

		void Promise.resolve()
			.then(() => {
				if (disposed || !container) return;
				container.replaceChildren();
				viewer = $3Dmol.createViewer(container, {
					backgroundColor: activeTheme === "light" ? "white" : "#131923",
				});
				viewer.addModel(data, format);
				applyBaseStyle(viewer, format);
				viewer.setHoverable(
					{},
					true,
					(atom: AtomSpec, target: GLViewer) => {
						if (disposed) return;
						if (hoverLabel) target.removeLabel(hoverLabel);
						hoverLabel = target.addLabel(atomLabel(atom), {
							position: { x: atom.x ?? 0, y: atom.y ?? 0, z: atom.z ?? 0 },
							fontSize: 12,
							fontColor: activeTheme === "light" ? "#18212f" : "#f8fafc",
							backgroundColor: activeTheme === "light" ? "#f8fafc" : "#18212f",
							backgroundOpacity: 0.9,
							borderColor: "#0d9488",
							borderThickness: 1,
						});
						setHoveredAtom(describeStructureAtom(atom));
						target.render();
					},
					(_atom: AtomSpec, target: GLViewer) => {
						if (hoverLabel) target.removeLabel(hoverLabel);
						hoverLabel = undefined;
						setHoveredAtom(null);
						target.render();
					},
				);
				viewer.setClickable({}, true, (atom: AtomSpec, target: GLViewer) => {
					if (disposed) return;
					const details = describeStructureAtom(atom);
					if (selectedLabel) target.removeLabel(selectedLabel);
					selectedLabel = undefined;
					applyBaseStyle(target, format);
					if (selectedKey === details.key) {
						selectedKey = "";
						setSelectedAtom(null);
					} else {
						selectedKey = details.key;
						setSelectedAtom(details);
						target.addStyle(atomSelection(atom), {
							stick: { radius: 0.24, color: "#f59e0b" },
							sphere: { radius: 0.55, color: "#f59e0b" },
						});
						selectedLabel = target.addLabel(atomLabel(atom), {
							position: { x: atom.x ?? 0, y: atom.y ?? 0, z: atom.z ?? 0 },
							fontSize: 12,
							fontColor: "#ffffff",
							backgroundColor: "#b45309",
							backgroundOpacity: 0.92,
							borderColor: "#fbbf24",
							borderThickness: 1,
						});
					}
					target.render();
				});
				viewer.zoomTo();
				viewer.render();
				viewer.resize();
				observer = new ResizeObserver(() => viewer?.resize());
				observer.observe(container);
				setLoading(false);
			})
			.catch((cause: unknown) => {
				if (!disposed) {
					setError(cause instanceof Error ? cause.message : String(cause));
					setLoading(false);
				}
			});

		onCleanup(() => {
			disposed = true;
			observer?.disconnect();
			if (hoverLabel) viewer?.removeLabel(hoverLabel);
			if (selectedLabel) viewer?.removeLabel(selectedLabel);
			viewer?.clear();
		});
	});

	return (
		<section class="artifact-structure" aria-label={props.title ?? "Interactive molecular structure"}>
			<div class="artifact-structure__notice">
				<span>Structure</span>
				Hover an atom to inspect · click to pin · drag to rotate · scroll to zoom
			</div>
			<div ref={container} class="artifact-structure__viewer" />
			<Show
				when={inspectedAtom()}
				fallback={<div class="artifact-structure__inspection-empty">Move over an atom to inspect its identity and coordinates.</div>}
			>
				{(atom) => (
					<div class={`artifact-structure__inspection ${selectedAtom() ? "is-selected" : ""}`}>
						<div class="artifact-structure__inspection-title">
							<span>{selectedAtom() ? "Selected atom" : "Hovered atom"}</span>
							<strong>{atom().residue} · {atom().atom}</strong>
						</div>
						<dl>
							<div><dt>Element</dt><dd>{atom().element}</dd></div>
							<div><dt>Chain</dt><dd>{atom().chain}</dd></div>
							<div><dt>Serial</dt><dd>{atom().serial}</dd></div>
							<div><dt>Bonds</dt><dd>{atom().bonds}</dd></div>
							<div><dt>B-factor</dt><dd>{atom().bFactor}</dd></div>
							<div class="is-wide"><dt>Coordinates</dt><dd>{atom().coordinates}</dd></div>
						</dl>
					</div>
				)}
			</Show>
			<Show when={loading()}>
				<div class="artifact-structure__state">Loading 3D structure…</div>
			</Show>
			<Show when={error()}>
				<div class="artifact-structure__state is-error">Unable to render structure: {error()}</div>
			</Show>
		</section>
	);
}
