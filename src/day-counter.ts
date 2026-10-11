import { type DayCounter, getGlobalSettings, updateGlobalSettings } from "./global-settings";

/** An in-game day lasts 24 real minutes. */
const DAY_MS = 24 * 60_000;

/**
 * Counters of in-game days, stored in the global settings so they can be stopped when the game closes even for keys on
 * a hidden page, and survive restarts.
 */
export async function getDayCounter(id: string): Promise<DayCounter | undefined> {
	return (await getGlobalSettings()).dayCounters?.[id];
}

/** Day reached by a counter (day 1 when it starts) and whether it was stopped by the game closing. */
export function counterDay(counter: DayCounter, now = Date.now()): { day: number; stopped: boolean } {
	const stopped = counter.startedAt === undefined;
	const elapsed = stopped ? (counter.elapsedMs ?? 0) : now - counter.startedAt!;
	return { day: Math.floor(Math.max(0, elapsed) / DAY_MS) + 1, stopped };
}

/**
 * Starts counting from day 1, unless the counter is already running. A counter stopped by the game closing starts over.
 * Returns whether a new count was started.
 */
export async function startDayCounter(id: string): Promise<boolean> {
	const counter = await getDayCounter(id);
	if (counter?.startedAt !== undefined) {
		return false;
	}
	await setCounter(id, { startedAt: Date.now() });
	return true;
}

export async function resetDayCounter(id: string): Promise<void> {
	await setCounter(id, undefined);
}

/**
 * Stops every running counter when the game closes, keeping the number of days reached on display. Counters do not
 * restart with the game: a new session is started with a key press.
 */
export async function stopCountersForGame(): Promise<void> {
	await updateCounters((counter, now) => (counter.startedAt !== undefined ? { elapsedMs: now - counter.startedAt } : counter));
}

async function setCounter(id: string, counter: DayCounter | undefined): Promise<void> {
	const counters = { ...((await getGlobalSettings()).dayCounters ?? {}) };
	if (counter) {
		counters[id] = counter;
	} else {
		delete counters[id];
	}
	await updateGlobalSettings({ dayCounters: counters });
}

async function updateCounters(change: (counter: DayCounter, now: number) => DayCounter): Promise<void> {
	const counters = (await getGlobalSettings()).dayCounters ?? {};
	const now = Date.now();
	const updated = Object.fromEntries(Object.entries(counters).map(([id, counter]) => [id, change(counter, now)]));
	if (JSON.stringify(updated) !== JSON.stringify(counters)) {
		await updateGlobalSettings({ dayCounters: updated });
	}
}
