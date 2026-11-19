import { CachedLoader, toNumber } from "./api/progress";
import { COLORS } from "./svg";

/**
 * Eclipse schedule, ported from the SoT Achievements site (sot-reputations, shared/utils/eclipses.ts). Community rule,
 * no official data: eclipses come in series of 4, at +0, +24, +57 and +81 min from the start of the series, and a new
 * series starts every 11 h 12 (672 min = 28 in-game days). Everything is computed in UTC from a known series start.
 */

/** Default start of a known series (1st eclipse): 30/12/2024 03:32 UTC. */
const DEFAULT_ANCHOR = Date.UTC(2024, 11, 30, 3, 32);
const SERIES_MS = 672 * 60_000;
const OFFSETS_MINUTES = [0, 24, 57, 81];

/**
 * The site lets an admin re-anchor the schedule on an observed eclipse and set the duration of an eclipse.
 */
const SETTINGS_URL = "https://achievements-sot.powange.com/api/eclipses-settings";
const SETTINGS_TTL_MS = 6 * 60 * 60_000;

export type EclipseSettings = {
	/** Start (ms UTC) of a series, anchoring the schedule. */
	anchor: number;
	/** Duration of an eclipse in minutes; 0 when unknown. */
	durationMinutes: number;
};

const DEFAULT_SETTINGS: EclipseSettings = { anchor: DEFAULT_ANCHOR, durationMinutes: 0 };

const settings = new CachedLoader(loadSettings, SETTINGS_TTL_MS, 60_000);

/**
 * Schedule settings from the site, or the defaults when it cannot be reached (the schedule then still works).
 */
export async function getEclipseSettings(force = false): Promise<EclipseSettings> {
	try {
		return await settings.get(force);
	} catch {
		return DEFAULT_SETTINGS;
	}
}

async function loadSettings(): Promise<EclipseSettings> {
	const response = await fetch(SETTINGS_URL, { headers: { Accept: "application/json", "User-Agent": "streamdeck-sot (https://github.com/powange/streamdeck-sot)" } });
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	const json = (await response.json()) as { anchor?: unknown; durationMinutes?: unknown };
	const anchor = toNumber(json.anchor);
	const durationMinutes = toNumber(json.durationMinutes);
	return {
		anchor: anchor > 0 ? anchor : DEFAULT_ANCHOR,
		durationMinutes: durationMinutes >= 0 && durationMinutes <= 23 ? Math.floor(durationMinutes) : 0,
	};
}

/** Starts (ms UTC) of the eclipses of a series. */
function seriesEclipses(series: number, anchor: number): number[] {
	const base = anchor + series * SERIES_MS;
	return OFFSETS_MINUTES.map((offset) => base + offset * 60_000);
}

/**
 * The `count` next eclipses after `time`, an eclipse still in progress included (it comes first).
 */
export function upcomingEclipses(time: number, count: number, { anchor, durationMinutes }: EclipseSettings): number[] {
	const from = time - durationMinutes * 60_000;
	const out: number[] = [];
	for (let series = Math.floor((from - anchor) / SERIES_MS); out.length < count; series++) {
		for (const start of seriesEclipses(series, anchor)) {
			if (start > from && out.length < count) out.push(start);
		}
	}
	return out;
}

export function isEclipseActive(start: number, time: number, { durationMinutes }: EclipseSettings): boolean {
	return durationMinutes > 0 && time >= start && time < start + durationMinutes * 60_000;
}

/** Local time of an eclipse ("14:32"). */
export function formatClock(timestamp: number): string {
	const date = new Date(timestamp);
	return `${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** Time left before an eclipse ("12 min", "3 h 20", "< 1 min"). */
export function formatCountdown(ms: number): string {
	const minutes = Math.ceil(ms / 60_000);
	if (minutes <= 1) return ms <= 0 ? "Maintenant" : "< 1 min";
	if (minutes < 60) return `${minutes} min`;
	return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
}

/**
 * Eclipse icon: the sun partly hidden by the moon, with a corona. Centred on (0, 0), ~56 units wide.
 */
export function eclipseIcon(active = false): string {
	const corona = active ? COLORS.cooking : COLORS.gold;
	const rays = Array.from({ length: 12 }, (_, i) => {
		const a = (i * Math.PI) / 6;
		const p = (r: number) => `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`;
		return `<path d="M${p(22)} L${p(28)}" stroke="${corona}" stroke-width="3" stroke-linecap="round"/>`;
	}).join("");
	return (
		rays +
		`<circle cx="0" cy="0" r="18" fill="${corona}"/>` +
		`<circle cx="7" cy="-4" r="17" fill="#1b2630" stroke="#0d141a" stroke-width="1"/>`
	);
}
