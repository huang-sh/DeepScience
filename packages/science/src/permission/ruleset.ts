import os from "node:os";

export type Action = "allow" | "deny" | "ask";

export interface Rule {
	permission: string;
	pattern: string;
	action: Action;
}

export type Ruleset = Rule[];

export type PermissionConfig = Record<string, string | Record<string, string>>;

function expand(pattern: string): string {
	if (pattern.startsWith("~/")) return os.homedir() + pattern.slice(1);
	if (pattern === "~") return os.homedir();
	if (pattern.startsWith("$HOME/")) return os.homedir() + pattern.slice(5);
	if (pattern.startsWith("$HOME")) return os.homedir() + pattern.slice(5);
	return pattern;
}

export function fromConfig(permission: PermissionConfig): Ruleset {
	const ruleset: Ruleset = [];
	for (const [key, value] of Object.entries(permission)) {
		if (typeof value === "string") {
			ruleset.push({ permission: key, action: value as Action, pattern: "*" });
			continue;
		}
		for (const [pattern, action] of Object.entries(value)) {
			ruleset.push({ permission: key, pattern: expand(pattern), action: action as Action });
		}
	}
	return ruleset;
}

export function merge(...rulesets: Ruleset[]): Ruleset {
	return rulesets.flat();
}

export function wildcardMatch(text: string, pattern: string): boolean {
	// Convert glob pattern to regex: * matches anything, ? matches single char
	const regexStr = pattern
		.replace(/[.+^${}()|[\]\\]/g, "\\$&")
		.replace(/\*/g, ".*")
		.replace(/\?/g, ".");
	return new RegExp(`^${regexStr}$`, "i").test(text);
}

export function evaluate(permission: string, pattern: string, ...rulesets: Ruleset[]): Rule {
	const merged = merge(...rulesets);
	const match = merged.findLast(
		(rule: Rule) => wildcardMatch(permission, rule.permission) && wildcardMatch(pattern, rule.pattern),
	);
	return match ?? { action: "ask", permission, pattern: "*" };
}

export function isToolAllowed(toolName: string, ruleset: Ruleset): boolean {
	const rule = ruleset.findLast((r: Rule) => wildcardMatch(toolName, r.permission));
	if (!rule) return true;
	return rule.action !== "deny";
}
