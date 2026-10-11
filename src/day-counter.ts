import { type DayCounter, getGlobalSettings, updateGlobalSettings } from "./global-settings";

/** An in-game day lasts 24 real minutes. */
const DAY_MS = 24 * 60_000;

/**
 * Counters of in-game days, stored in the global settings so they can be paused when the game closes even for keys on
 * a hidden page, and survive restarts.
 */
export async function getDayCounter(id: string): Promise<DayCounter | undefined> {
	return (await getGlobalSettings()).dayCounters?.[id];
}

/** Day reached by a counter (day 1 when it starts) and whether it is paused. */
export function counterDay(counter: DayCounter, now = Date.now()): { day: number; paused: boolean } {
	const paused = counter.startedAt === undefined;
	const elapsed = paused ? (counter.elapsedMs ?? 0) : now - counter.startedAt!;
	return { day: Math.floor(Math.max(0, elapsed) / DAY_MS) + 1, paused };
}

/** Starts a counter, or pauses / resumes it. */
export async function toggleDayCounter(id: string): Promise<void> {
	const counter = await getDayCounter(id);
	const now = Date.now();
	if (!counter) {
		await setCounter(id, { startedAt: now });
	} else if (counter.startedAt !== undefined) {
		await setCounter(id, { elapsedMs: now - counter.startedAt });
	} else {
		await setCounter(id, { startedAt: now - (counter.elapsedMs ?? 0) });
	}
}

export async function resetDayCounter(id: string): Promise<void> {
	await setCounter(id, undefined);
}

/** Pauses every running counter when the game closes. */
export async function pauseCountersForGame(): Promise<void> {
	await updateCounters((counter, now) =>
		counter.startedAt !== undefined ? { elapsedMs: now - counter.startedAt, pausedByGame: true } : counter,
	);
}

/** Resumes the counters paused by the game closing, when it starts again. */
export async function resumeCountersForGame(): Promise<void> {
	await updateCounters((counter, now) =>
		counter.pausedByGame && counter.startedAt === undefined ? { startedAt: now - (counter.elapsedMs ?? 0) } : counter,
	);
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
