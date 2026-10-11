import { COLORS } from "./svg";

/**
 * In-game clock of Sea of Thieves, computed from the real UTC time (same formula as the Merfolk's Lullaby map):
 * an in-game day lasts 24 real minutes, so one real second is one in-game minute, and days follow a 30-day cycle.
 */
export type GameTime = {
	/** Day of the 30-day cycle (1-30). */
	day: number;
	hours: number;
	minutes: number;
	period: GamePeriod;
	/** Fraction (0-1) of the in-game day elapsed. */
	dayProgress: number;
};

export type GamePeriod = "sunrise" | "morning" | "afternoon" | "sunset" | "night";

/** Start of each period, in in-game minutes since midnight (4:30, 6:00, 12:00, 19:30, 22:10). */
const PERIODS: Array<[number, GamePeriod]> = [
	[270, "sunrise"],
	[360, "morning"],
	[720, "afternoon"],
	[1170, "sunset"],
	[1330, "night"],
];

/** Colour of each period on the clock border. */
export const PERIOD_COLORS: Record<GamePeriod, string> = {
	sunrise: "#f6b14a",
	morning: "#e8b93a",
	afternoon: "#e8b93a",
	sunset: "#e8673a",
	night: "#3d5a80",
};

/** Periods with their start and end, as fractions (0-1) of the in-game day. */
export function periodRanges(): Array<{ period: GamePeriod; from: number; to: number }> {
	return PERIODS.map(([start, period], i) => ({ period, from: start / 1440, to: (PERIODS[i + 1]?.[0] ?? 1440) / 1440 }))
		// Night wraps around midnight.
		.concat({ period: "night", from: 0, to: PERIODS[0][0] / 1440 });
}

export const PERIOD_LABELS: Record<GamePeriod, string> = {
	sunrise: "Lever du soleil",
	morning: "Matin",
	afternoon: "Après-midi",
	sunset: "Coucher du soleil",
	night: "Nuit",
};

export function getGameTime(date: Date = new Date()): GameTime {
	const seconds = date.getUTCHours() * 3600 + date.getUTCMinutes() * 60 + date.getUTCSeconds();
	const minutesOfDay = seconds % 1440;
	const period = [...PERIODS].reverse().find(([start]) => minutesOfDay >= start)?.[1] ?? "night";
	return {
		day: (Math.floor(seconds / 1440) % 30) + 1,
		hours: Math.floor(minutesOfDay / 60),
		minutes: minutesOfDay % 60,
		period,
		dayProgress: minutesOfDay / 1440,
	};
}

/**
 * Icon of a period of the day, centred on (0, 0), roughly 60 units wide.
 */
export function periodIcon(period: GamePeriod): string {
	const rays = (color: string, from: number, to: number) =>
		Array.from({ length: 9 }, (_, i) => {
			const a = ((from + ((to - from) * i) / 8) * Math.PI) / 180;
			const p = (r: number) => `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`;
			return `<path d="M${p(18)} L${p(26)}" stroke="${color}" stroke-width="3" stroke-linecap="round"/>`;
		}).join("");
	const horizon = (sunColor: string, rayColor: string) =>
		`<g transform="translate(0 8)">${rays(rayColor, 180, 360)}<path d="M-14,0 A14,14 0 0 1 14,0 Z" fill="${sunColor}"/></g>` +
		`<path d="M-30,10 L30,10" stroke="${COLORS.teal}" stroke-width="4" stroke-linecap="round"/>` +
		`<path d="M-22,18 Q-14,14 -6,18 T10,18 T26,18" fill="none" stroke="${COLORS.teal}" stroke-width="3"/>`;

	switch (period) {
		case "sunrise":
			return horizon("#f6b14a", "#f6c46a");
		case "sunset":
			return horizon("#e8673a", "#f08a4a");
		case "morning":
		case "afternoon":
			return rays(COLORS.gold, 0, 320) + `<circle cx="0" cy="0" r="14" fill="${COLORS.gold}"/>`;
		case "night":
			return (
				`<path d="M6,-24 A22,22 0 1 0 22,10 A17,17 0 1 1 6,-24 Z" fill="${COLORS.bone}"/>` +
				`<circle cx="-18" cy="-16" r="2" fill="${COLORS.bone}"/>` +
				`<circle cx="18" cy="-20" r="1.5" fill="${COLORS.bone}"/>` +
				`<circle cx="24" cy="-6" r="1.5" fill="${COLORS.bone}"/>`
			);
	}
}
