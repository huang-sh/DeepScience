import { For, Show } from "solid-js";
import type { ComposerImage } from "../image-input";

export function ImageUploadButton(props: {
	disabled?: boolean;
	onFiles: (files: File[]) => void;
}) {
	let input: HTMLInputElement | undefined;
	return (
		<>
			<input
				ref={input}
				class="composer-image-input"
				type="file"
				accept="image/png,image/jpeg,image/webp,image/gif"
				multiple
				onChange={(event) => {
					props.onFiles(Array.from(event.currentTarget.files ?? []));
					event.currentTarget.value = "";
				}}
			/>
			<button
				type="button"
				class="composer-image-upload"
				disabled={props.disabled}
				onClick={() => input?.click()}
				title="Upload images"
				aria-label="Upload images"
			>
				<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d="M12 5v14M5 12h14" />
				</svg>
			</button>
		</>
	);
}

export function ImageAttachmentTray(props: {
	images: ComposerImage[];
	error?: string;
	disabled?: boolean;
	onRemove: (id: string) => void;
}) {
	return (
		<Show when={props.images.length > 0 || props.error}>
			<div class="composer-images">
				<Show when={props.images.length > 0}>
					<div class="composer-images__list">
						<For each={props.images}>
							{(image) => (
								<div class="composer-image" title={`${image.name} · ${formatBytes(image.size)}`}>
									<img src={`data:${image.mimeType};base64,${image.data}`} alt={image.name} />
									<button
										type="button"
										disabled={props.disabled}
										onClick={() => props.onRemove(image.id)}
										aria-label={`Remove ${image.name}`}
									>
										×
									</button>
								</div>
							)}
						</For>
					</div>
				</Show>
				<Show when={props.error}>
					<div class="composer-images__error">{props.error}</div>
				</Show>
			</div>
		</Show>
	);
}

function formatBytes(bytes: number): string {
	return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}
