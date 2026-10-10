import streamDeck from "@elgato/streamdeck";

/**
 * Plugin-wide settings, shared by every key and edited from any property inspector (`global` sdpi fields).
 * Stored locally by Stream Deck; never log them.
 */
export type GlobalSettings = {
	/** Value of the `rat` cookie of www.seaofthieves.com. */
	ratCookie?: string;
	/** OpenXBL API key (https://xbl.io). */
	xblApiKey?: string;
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

export function onGlobalSettingsChanged(listener: (settings: GlobalSettings) => void): void {
	listeners.add(listener);
}
