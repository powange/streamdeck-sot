import { COLORS } from "./svg";

export type CounterKind = "chest" | "skull" | "death" | "ship" | "star";

export const COUNTER_LABELS: Record<CounterKind, string> = {
	chest: "Coffres",
	skull: "Crânes",
	death: "Morts",
	ship: "Coulés",
	star: "Compteur",
};

export function isCounterKind(value: unknown): value is CounterKind {
	return typeof value === "string" && value in COUNTER_LABELS;
}

/**
 * Draws a counter icon centred on (0, 0), roughly 60 units wide.
 */
export function counterIcon(kind: CounterKind): string {
	switch (kind) {
		case "chest":
			return (
				`<rect x="-26" y="-6" width="52" height="28" rx="3" fill="#8a5a2b"/>` +
				`<path d="M-26,-6 Q-26,-24 0,-24 Q26,-24 26,-6 Z" fill="#a8703a"/>` +
				`<rect x="-26" y="-8" width="52" height="5" fill="${COLORS.gold}"/>` +
				`<rect x="-5" y="-6" width="10" height="13" rx="2" fill="${COLORS.gold}"/>`
			);
		case "skull":
			return (
				`<circle cx="0" cy="-6" r="22" fill="${COLORS.bone}"/>` +
				`<rect x="-12" y="8" width="24" height="16" rx="4" fill="${COLORS.bone}"/>` +
				`<circle cx="-9" cy="-6" r="6" fill="${COLORS.ink}"/>` +
				`<circle cx="9" cy="-6" r="6" fill="${COLORS.ink}"/>` +
				`<polygon points="0,2 -4,9 4,9" fill="${COLORS.ink}"/>` +
				`<rect x="-5" y="16" width="2" height="8" fill="${COLORS.ink}"/>` +
				`<rect x="3" y="16" width="2" height="8" fill="${COLORS.ink}"/>`
			);
		case "death":
			return (
				`<path d="M-18,24 L-18,-10 Q-18,-26 0,-26 Q18,-26 18,-10 L18,24 Z" fill="#8c979e"/>` +
				`<rect x="-3" y="-18" width="6" height="26" fill="#3b464d"/>` +
				`<rect x="-10" y="-10" width="20" height="6" fill="#3b464d"/>` +
				`<rect x="-26" y="22" width="52" height="5" rx="2" fill="#4f6b3a"/>`
			);
		case "ship":
			return (
				`<g transform="rotate(18)">` +
				`<rect x="-2" y="-28" width="4" height="34" fill="#5b3a1e"/>` +
				`<polygon points="3,-26 22,2 3,2" fill="${COLORS.bone}"/>` +
				`<polygon points="-3,-22 -18,2 -3,2" fill="#d8ccb2"/>` +
				`<path d="M-28,6 L28,6 L18,20 L-18,20 Z" fill="#8a5a2b"/>` +
				`</g>` +
				`<path d="M-32,22 Q-24,16 -16,22 T0,22 T16,22 T32,22" fill="none" stroke="${COLORS.teal}" stroke-width="4"/>`
			);
		case "star":
			return `<polygon points="0,-26 7,-8 26,-8 11,4 17,22 0,11 -17,22 -11,4 -26,-8 -7,-8" fill="${COLORS.gold}"/>`;
	}
}
