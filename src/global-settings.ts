import streamDeck from "@elgato/streamdeck";

/**
 * Plugin-wide settings, shared by every key and edited from any property inspector (`global` sdpi fields).
 * Stored locally by Stream Deck; never log them.
 */
export type GlobalSettings = {
	/** Value of the `rat` cookie of www.seaofthieves.com. */
	ratCookie?: string;
	/** Timestamp (ms) of the last time the site sent back a renewed `rat` cookie. */
	ratRenewedAt?: number;
	/** OpenXBL API key (https://xbl.io). */
	xblApiKey?: string;
	/** Balance recorded when the game was last launched. */
	gameSession?: GameSession;
	/** In-game day counters of the in-game time keys, by action id. */
	dayCounters?: Record<string, DayCounter>;
};

/**
 * Counter of in-game days: `startedAt` while counting, `elapsedMs` once stopped by the game closing.
 */
export type DayCounter = {
	/** Timestamp (ms) at which the count started. */
	startedAt?: number;
	/** Time (ms) counted, once stopped. */
	elapsedMs?: number;
};

export type GameSession = {
	/** Timestamp (ms) of the game launch. */
	startedAt: number;
	/** Timestamp (ms) at which the game was closed, if it was. */
	endedAt?: number;
	gold: number;
	doubloons: number;
	ancientCoins: number;
};

let current: GlobalSettings | undefined;
const listeners = new Set<(settings: GlobalSettings) => void>();

streamDeck.settings.onDidReceiveGlobalSettings<GlobalSettings>((ev) => {
	current = ev.settings ?? {};
	for (const listener of listeners) {
		listener(current);
	}
});

export async function getGlobalSettings(): Promise<GlobalSettings> {
	current ??= (await streamDeck.settings.getGlobalSettings<GlobalSettings>()) ?? {};
	return current;
}

/**
 * Merges changes into the global settings. Stream Deck does not echo the plugin's own changes, so listeners are
 * notified here.
 */
export async function updateGlobalSettings(changes: Partial<GlobalSettings>): Promise<void> {
	current = { ...(await getGlobalSettings()), ...changes };
	await streamDeck.settings.setGlobalSettings(current);
	for (const listener of listeners) {
		listener(current);
	}
}

export function onGlobalSettingsChanged(listener: (settings: GlobalSettings) => void): void {
	listeners.add(listener);
}
