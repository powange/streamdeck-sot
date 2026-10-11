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

const FACTION_COLORS: Record<string, string> = {
	AthenasFortune: "#2fb5a6",
	Flameheart: "#d9482b",
	GoldHoarders: "#e8b93a",
	HuntersCall: "#3c9a6e",
	MerchantAlliance: "#3d7fc4",
	OrderOfSouls: "#8a5bc4",
	PirateLord: "#4a90d9",
	ReapersBones: "#c0392b",
	SeaDogs: "#e07b39",
};

const GUILD_COLOR = "#b5577a";

/**
 * Waving flag in the colour of a faction (guilds share one colour). Centred on (0, 0), ~50 units wide.
 */
export function factionIcon(factionKey: string, isGuild = false): string {
	const color = isGuild ? GUILD_COLOR : (FACTION_COLORS[factionKey] ?? COLORS.teal);
	return (
		`<rect x="-22" y="-28" width="4" height="56" rx="2" fill="#8a5a2b"/>` +
		`<circle cx="-20" cy="-29" r="4" fill="${COLORS.gold}"/>` +
		`<path d="M-18,-24 C-6,-30 6,-18 26,-24 L26,8 C6,14 -6,2 -18,8 Z" fill="${color}"/>` +
		`<circle cx="4" cy="-8" r="7" fill="${COLORS.bone}"/>` +
		`<rect x="0" y="-3" width="8" height="5" rx="1" fill="${COLORS.bone}"/>` +
		`<circle cx="1.5" cy="-9" r="2" fill="${color}"/>` +
		`<circle cx="6.5" cy="-9" r="2" fill="${color}"/>`
	);
}

export type Currency = "gold" | "doubloons" | "ancientCoins";

/**
 * Currency icon centred on (0, 0), roughly 50 units wide: a stack of gold coins, a doubloon or an ancient coin.
 */
export function currencyIcon(currency: Currency): string {
	const coin = (cx: number, cy: number, face: string, edge: string) =>
		`<ellipse cx="${cx}" cy="${cy + 3}" rx="16" ry="6" fill="${edge}"/>` + `<ellipse cx="${cx}" cy="${cy}" rx="16" ry="6" fill="${face}"/>`;

	switch (currency) {
		case "gold":
			return (
				coin(-8, 16, COLORS.gold, "#9c7414") +
				coin(-8, 8, COLORS.gold, "#9c7414") +
				coin(-8, 0, COLORS.gold, "#9c7414") +
				coin(10, 16, COLORS.gold, "#9c7414") +
				`<circle cx="8" cy="-12" r="14" fill="${COLORS.gold}" stroke="#9c7414" stroke-width="3"/>` +
				`<text x="8" y="-7" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="bold" fill="#9c7414" text-anchor="middle">G</text>`
			);
		case "doubloons":
			return (
				`<circle cx="0" cy="0" r="24" fill="#9db4c8" stroke="#5d7a94" stroke-width="4"/>` +
				`<circle cx="0" cy="0" r="15" fill="none" stroke="#5d7a94" stroke-width="2"/>` +
				`<polygon points="0,-11 3,-3 11,-3 5,2 7,10 0,5 -7,10 -5,2 -11,-3 -3,-3" fill="#5d7a94"/>`
			);
		case "ancientCoins":
			return (
				`<circle cx="0" cy="0" r="27" fill="#2fb5a6" opacity="0.25"/>` +
				`<circle cx="0" cy="0" r="22" fill="#3fd0c0" stroke="#1d7f75" stroke-width="4"/>` +
				`<path d="M-8,-10 L8,-10 L12,0 L8,10 L-8,10 L-12,0 Z" fill="none" stroke="#1d7f75" stroke-width="3"/>` +
				`<circle cx="0" cy="0" r="4" fill="#1d7f75"/>`
			);
	}
}

/**
 * Ship's wheel, for the season renown. Centred on (0, 0), ~56 units wide.
 */
export function seasonIcon(): string {
	const spokes = Array.from({ length: 8 }, (_, i) => {
		const a = (i * Math.PI) / 4;
		const x = (r: number) => (Math.cos(a) * r).toFixed(1);
		const y = (r: number) => (Math.sin(a) * r).toFixed(1);
		return (
			`<path d="M${x(6)},${y(6)} L${x(27)},${y(27)}" stroke="#8a5a2b" stroke-width="4" stroke-linecap="round"/>` +
			`<circle cx="${x(28)}" cy="${y(28)}" r="3.5" fill="#a8703a"/>`
		);
	}).join("");
	return (
		spokes +
		`<circle cx="0" cy="0" r="19" fill="none" stroke="#a8703a" stroke-width="5"/>` +
		`<circle cx="0" cy="0" r="7" fill="${COLORS.gold}" stroke="#9c7414" stroke-width="2"/>`
	);
}
