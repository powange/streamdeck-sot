import { COLORS } from "./svg";

export type TimerPresetId = "megalodon" | "day" | "custom";

export type TimerPreset = {
	id: TimerPresetId;
	label: string;
	seconds: number;
	/** Restart automatically when finished, e.g. to follow the in-game day cycle. */
	repeat: boolean;
};

export const TIMER_PRESETS: Record<TimerPresetId, TimerPreset> = {
	megalodon: { id: "megalodon", label: "Méga AFK", seconds: 90 * 60, repeat: false },
	day: { id: "day", label: "Journée", seconds: 24 * 60, repeat: true },
	custom: { id: "custom", label: "Minuteur", seconds: 10 * 60, repeat: false },
};

export function getTimerPreset(id: string | undefined): TimerPreset {
	return TIMER_PRESETS[id as TimerPresetId] ?? TIMER_PRESETS.megalodon;
}

/**
 * Draws a timer icon centred on (0, 0), roughly 64 units wide.
 */
export function timerIcon(preset: TimerPresetId): string {
	switch (preset) {
		case "megalodon":
			// Open jaws of a megalodon seen from the front.
			return (
				`<path d="M-30,-6 C-30,-24 30,-24 30,-6 L30,6 C30,24 -30,24 -30,6 Z" fill="#3f5f7d"/>` +
				`<path d="M-22,-4 C-22,-14 22,-14 22,-4 L22,4 C22,14 -22,14 -22,4 Z" fill="#5a1a16"/>` +
				`<polygon points="-20,-8 -16,0 -12,-9 -8,0 -4,-10 0,0 4,-10 8,0 12,-9 16,0 20,-8" fill="${COLORS.bone}"/>` +
				`<polygon points="-20,8 -16,0 -12,9 -8,0 -4,10 0,0 4,10 8,0 12,9 16,0 20,8" fill="${COLORS.bone}"/>` +
				`<circle cx="-24" cy="-14" r="3" fill="${COLORS.ink}"/>` +
				`<circle cx="24" cy="-14" r="3" fill="${COLORS.ink}"/>`
			);
		case "day":
			// Sun setting behind the horizon, with a crescent moon.
			return (
				`<g stroke="${COLORS.gold}" stroke-width="3" stroke-linecap="round">` +
				`<path d="M-8,-4 L-8,-12 M-20,0 L-26,-6 M4,0 L10,-6 M-26,10 L-32,10 M10,10 L16,10"/>` +
				`</g>` +
				`<path d="M-22,12 A14,14 0 0 1 6,12 Z" fill="${COLORS.gold}"/>` +
				`<path d="M22,-22 A12,12 0 1 0 30,-2 A9,9 0 1 1 22,-22 Z" fill="${COLORS.bone}"/>` +
				`<path d="M-32,14 L32,14" stroke="${COLORS.teal}" stroke-width="4" stroke-linecap="round"/>` +
				`<path d="M-24,22 Q-16,18 -8,22 T8,22 T24,22" fill="none" stroke="${COLORS.teal}" stroke-width="3"/>`
			);
		case "custom":
			// Hourglass.
			return (
				`<rect x="-18" y="-28" width="36" height="5" rx="2" fill="#8a5a2b"/>` +
				`<rect x="-18" y="23" width="36" height="5" rx="2" fill="#8a5a2b"/>` +
				`<path d="M-13,-23 L13,-23 L13,-17 C13,-8 3,-4 3,0 C3,4 13,8 13,17 L13,23 L-13,23 L-13,17 C-13,8 -3,4 -3,0 C-3,-4 -13,-8 -13,-17 Z" fill="none" stroke="${COLORS.bone}" stroke-width="3"/>` +
				`<path d="M-9,-14 L9,-14 C7,-8 2,-5 0,-2 C-2,-5 -7,-8 -9,-14 Z" fill="${COLORS.gold}"/>` +
				`<path d="M0,4 L9,19 L-9,19 Z" fill="${COLORS.gold}"/>`
			);
	}
}

/**
 * Stopwatch icon, centred on (0, 0), roughly 60 units wide.
 */
export function stopwatchIcon(): string {
	return (
		`<rect x="-5" y="-30" width="10" height="6" rx="2" fill="${COLORS.gold}"/>` +
		`<rect x="-2" y="-25" width="4" height="5" fill="${COLORS.gold}"/>` +
		`<path d="M18,-17 L23,-22" stroke="${COLORS.gold}" stroke-width="4" stroke-linecap="round"/>` +
		`<circle cx="0" cy="2" r="22" fill="${COLORS.bone}" stroke="${COLORS.gold}" stroke-width="4"/>` +
		`<path d="M0,-14 V-10 M0,14 V18 M-16,2 H-12 M12,2 H16" stroke="${COLORS.ink}" stroke-width="2"/>` +
		`<path d="M0,2 L8,-8" stroke="${COLORS.danger}" stroke-width="3" stroke-linecap="round"/>` +
		`<circle cx="0" cy="2" r="3" fill="${COLORS.ink}"/>`
	);
}
