import streamDeck from "@elgato/streamdeck";

import { getBalance } from "./api/sot";
import { getGlobalSettings, updateGlobalSettings } from "./global-settings";

/** Executable of Sea of Thieves (Steam and Xbox app), also listed in the manifest's ApplicationsToMonitor. */
const GAME_EXECUTABLE = "SoTGame.exe";

/** Launch events received this soon after the plugin started describe a game that was already running. */
const STARTUP_GRACE_MS = 15_000;

const RETRY_DELAY_MS = 30_000;
const MAX_ATTEMPTS = 5;

const pluginStartedAt = Date.now();

const closeListeners = new Set<() => void | Promise<void>>();

/** Called each time Sea of Thieves is closed. */
export function onGameClosed(listener: () => void | Promise<void>): void {
	closeListeners.add(listener);
}

/**
 * Records the balance each time the game starts, so balance keys can show the gains of the current game session.
 */
export function watchGameSessions(): void {
	streamDeck.system.onApplicationDidLaunch(async (ev) => {
		if (ev.application.toLowerCase() !== GAME_EXECUTABLE.toLowerCase()) return;

		// After a plugin restart (e.g. an update) while playing, keep the session that is still running.
		const session = (await getGlobalSettings()).gameSession;
		if (session && session.endedAt === undefined && Date.now() - pluginStartedAt < STARTUP_GRACE_MS) {
			return;
		}
		await startGameSession();
	});

	streamDeck.system.onApplicationDidTerminate(async (ev) => {
		if (ev.application.toLowerCase() !== GAME_EXECUTABLE.toLowerCase()) return;
		for (const listener of closeListeners) await listener();

		const session = (await getGlobalSettings()).gameSession;
		if (session && session.endedAt === undefined) {
			await updateGlobalSettings({ gameSession: { ...session, endedAt: Date.now() } });
		}
	});
}

/**
 * Records the current balance as the start of a game session (at game launch, or on demand from a balance key).
 */
export async function startGameSession(): Promise<void> {
	const startedAt = Date.now();
	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
		try {
			const balance = await getBalance(true);
			await updateGlobalSettings({
				gameSession: { startedAt, gold: balance.gold, doubloons: balance.doubloons, ancientCoins: balance.ancientCoins },
			});
			streamDeck.logger.info("Game session started");
			return;
		} catch (error) {
			streamDeck.logger.warn(`Cannot record the balance at game launch (attempt ${attempt}): ${error instanceof Error ? error.message : error}`);
			await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
		}
	}
}
