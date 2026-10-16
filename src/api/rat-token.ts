import streamDeck from "@elgato/streamdeck";

import { getGlobalSettings, onGlobalSettingsChanged, updateGlobalSettings } from "../global-settings";

/** Keys show a warning when the token expires within this many days. */
const WARNING_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Accepts the raw cookie value, or a pasted `rat=...` / full cookie header.
 */
export function normalizeToken(value: string | undefined): string | undefined {
	if (!value) return undefined;
	const match = /(?:^|;\s*)rat=([^;]+)/.exec(value.trim());
	return (match ? match[1] : value).trim() || undefined;
}

export async function currentToken(): Promise<string | undefined> {
	return normalizeToken((await getGlobalSettings()).ratCookie);
}

/**
 * Expiry (ms timestamp) read from the `exp` claim of a JWT; `undefined` if it cannot be read. The current RAT tokens are
 * encrypted JWE (5 segments), whose claims only Rare can read: their expiry is unknown.
 */
export function tokenExpiry(token: string | undefined): number | undefined {
	const payload = token?.split(".")[1];
	if (!payload) return undefined;
	try {
		const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: unknown };
		return typeof claims.exp === "number" ? claims.exp * 1000 : undefined;
	} catch {
		return undefined;
	}
}

/**
 * Short warning for keys ("2 j", "< 1 j") when the token expires soon, or `undefined`.
 */
export async function tokenWarning(now = Date.now()): Promise<string | undefined> {
	const expiry = tokenExpiry(await currentToken());
	if (expiry === undefined || expiry <= now || expiry - now > WARNING_DAYS * DAY_MS) return undefined;
	const days = Math.floor((expiry - now) / DAY_MS);
	return days < 1 ? "< 1 j" : `${days} j`;
}

/**
 * Validity of the token, for the property inspector: its expiry when readable, otherwise when the site last renewed it.
 */
export async function tokenInfo(now = Date.now()): Promise<string> {
	const settings = await getGlobalSettings();
	const token = normalizeToken(settings.ratCookie);
	if (!token) return "";

	const expiry = tokenExpiry(token);
	if (expiry !== undefined) {
		if (expiry <= now) return `Token expiré le ${formatDate(expiry)} : colle un nouveau cookie « rat ».`;
		const days = Math.floor((expiry - now) / DAY_MS);
		return `Token valable jusqu'au ${formatDate(expiry)} (${days < 1 ? "moins d'un jour" : `encore ${days} j`}).`;
	}

	// Encrypted token: the expiry is unknown, but the site renews it while the keys refresh.
	return settings.ratRenewedAt
		? `Token renouvelé par le site le ${formatDate(settings.ratRenewedAt)}. Il reste valide tant que les boutons s'actualisent régulièrement.`
		: "Token chiffré : sa date d'expiration est illisible. Il sera renouvelé par le site à la prochaine actualisation.";
}

function formatDate(timestamp: number): string {
	const date = new Date(timestamp);
	return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} à ${date.getHours()}:${pad(date.getMinutes())}`;
}

function pad(value: number): string {
	return String(value).padStart(2, "0");
}

/** Tokens saved by the plugin itself after the site renewed them. */
const renewedTokens = new Set<string>();

/**
 * Saves a token sent back by the site (Set-Cookie), replacing the current one without reloading the keys.
 */
export async function saveRenewedToken(token: string): Promise<void> {
	renewedTokens.clear();
	renewedTokens.add(token);
	await updateGlobalSettings({ ratCookie: token, ratRenewedAt: Date.now() });
	streamDeck.logger.info("RAT token renewed by the site");
}

const listeners = new Set<() => void | Promise<void>>();
let knownToken: string | undefined;
let initialized = false;

onGlobalSettingsChanged(async (settings) => {
	const token = normalizeToken(settings.ratCookie);
	if (initialized && token === knownToken) return;
	initialized = true;
	knownToken = token;
	// A token renewed by the site belongs to the same account: cached data stays valid.
	if (token && renewedTokens.has(token)) return;
	for (const listener of listeners) await listener();
});

/**
 * Called when the user enters another token (not when the site renews it).
 */
export function onTokenChanged(listener: () => void | Promise<void>): void {
	listeners.add(listener);
}
