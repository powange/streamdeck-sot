import { COLORS } from "./svg";

/**
 * Generic medal, shown for a commendation while its own image is not available. Centred on (0, 0), ~50 units wide.
 */
export function medalIcon(): string {
	return (
		`<polygon points="-14,-26 -4,-26 4,-6 -6,-6" fill="${COLORS.teal}"/>` +
		`<polygon points="14,-26 4,-26 -4,-6 6,-6" fill="#2b7c88"/>` +
		`<circle cx="0" cy="8" r="17" fill="${COLORS.gold}"/>` +
		`<circle cx="0" cy="8" r="12" fill="none" stroke="#9c7414" stroke-width="2"/>` +
		`<polygon points="0,0 2.5,5.5 8,5.5 3.5,9 5,15 0,11.5 -5,15 -3.5,9 -8,5.5 -2.5,5.5" fill="#9c7414"/>`
	);
}

/**
 * Generic trophy, shown for an Xbox achievement while its icon is not available. Centred on (0, 0), ~50 units wide.
 */
export function trophyIcon(): string {
	return (
		`<path d="M-16,-24 H16 V-8 C16,6 8,12 0,12 C-8,12 -16,6 -16,-8 Z" fill="${COLORS.gold}"/>` +
		`<path d="M-16,-18 H-24 C-24,-6 -20,0 -12,2 M16,-18 H24 C24,-6 20,0 12,2" fill="none" stroke="${COLORS.gold}" stroke-width="4"/>` +
		`<rect x="-4" y="12" width="8" height="8" fill="#9c7414"/>` +
		`<rect x="-14" y="20" width="28" height="6" rx="2" fill="#9c7414"/>`
	);
}
