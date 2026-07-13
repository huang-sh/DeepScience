/**
 * Loopback-only security guards for the DeepScience server.
 *
 * DNS-rebinding defense for the local DeepScience server.
 * via Host header validation, cross-origin defense via Origin + Sec-Fetch-Site
 * inspection, enforced before any route handler runs.
 */

const ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Reject any non-loopback Host header (DNS-rebinding defense).
 * Only localhost, 127.0.0.1, and [::1] are accepted.
 */
export function isAllowedHost(host: string): boolean {
	const bareHost = host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : host.split(":")[0]!;
	return ALLOWED_HOSTS.has(bareHost);
}

/**
 * Only accept origins from the local machine.
 * Matches http://localhost:*, http://127.0.0.1:*, and tauri://localhost.
 */
export function isAllowedOrigin(origin: string): boolean {
	if (origin.startsWith("http://localhost:") || origin === "http://localhost") return true;
	if (origin.startsWith("http://127.0.0.1:") || origin === "http://127.0.0.1") return true;
	if (origin === "tauri://localhost" || origin === "http://tauri.localhost") return true;
	return false;
}

/**
 * Decide whether a request is cross-origin and must be rejected.
 * - Origin present: check against allow-list
 * - No Origin but Sec-Fetch-Site is cross-site: reject
 * - No Origin, no cross-site header (non-browser clients): allow
 */
export function isCrossOrigin(origin: string | undefined, secFetchSite: string | undefined): boolean {
	if (origin !== undefined) return !isAllowedOrigin(origin);
	return secFetchSite === "cross-site";
}
