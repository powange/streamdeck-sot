import type { FoodId } from "./foods";
import { COLORS } from "./svg";

export type Doneness = "raw" | "cooked" | "burnt";

/**
 * Colours of a piece of food: `flesh` for the main body, `skin` for edges / fins / shading.
 */
type Palette = { flesh: string; skin: string };

const COOKED: Palette = { flesh: "#b9733a", skin: "#7c4520" };
const BURNT: Palette = { flesh: "#2e2a28", skin: "#151312" };

const RAW: Record<FoodId, Palette> = {
	fish: { flesh: "#8fb9cf", skin: "#5d879e" },
	"trophy-fish": { flesh: "#8fb9cf", skin: "#5d879e" },
	chicken: { flesh: "#f2c2a8", skin: "#d8977a" },
	pork: { flesh: "#e58a8f", skin: "#f4e1d6" },
	snake: { flesh: "#9dbb63", skin: "#5e7a35" },
	shark: { flesh: "#e9a6a6", skin: "#7d8c97" },
	kraken: { flesh: "#a874c4", skin: "#6d3f8a" },
	megalodon: { flesh: "#e9a6a6", skin: "#3f5f7d" },
};

function palette(food: FoodId, doneness: Doneness): Palette {
	if (doneness === "cooked") return COOKED;
	if (doneness === "burnt") return BURNT;
	return RAW[food];
}

/**
 * Draws a food icon centred on (0, 0), roughly 64 units wide.
 */
export function foodIcon(food: FoodId, doneness: Doneness): string {
	const p = palette(food, doneness);
	switch (food) {
		case "fish":
			return fish(p);
		case "trophy-fish":
			return fish(p) + crown();
		case "chicken":
			return drumstick(p);
		case "pork":
			return porkChop(p);
		case "snake":
			return snake(p, doneness);
		case "shark":
			return sharkSteak(p);
		case "kraken":
			return tentacle(p, doneness);
		case "megalodon":
			return megalodonSteak(p);
	}
}

function fish({ flesh, skin }: Palette): string {
	return (
		`<polygon points="14,0 32,-14 32,14" fill="${skin}"/>` +
		`<ellipse cx="-4" cy="0" rx="24" ry="13" fill="${flesh}"/>` +
		`<path d="M-2,-12 Q4,-20 10,-10" fill="${skin}"/>` +
		`<path d="M-12,-9 Q-8,0 -12,9" fill="none" stroke="${skin}" stroke-width="2"/>` +
		`<circle cx="-19" cy="-3" r="3" fill="${COLORS.ink}"/>`
	);
}

function crown(): string {
	return `<polygon points="-16,-15 -16,-29 -10,-21 -4,-31 2,-21 8,-29 8,-15" fill="${COLORS.gold}" stroke="#9c7414" stroke-width="1"/>`;
}

function drumstick({ flesh, skin }: Palette): string {
	return (
		`<g transform="rotate(-35)">` +
		`<rect x="10" y="-4" width="22" height="8" fill="${COLORS.bone}"/>` +
		`<circle cx="33" cy="-5" r="5" fill="${COLORS.bone}"/>` +
		`<circle cx="33" cy="5" r="5" fill="${COLORS.bone}"/>` +
		`<ellipse cx="-6" cy="0" rx="22" ry="17" fill="${flesh}"/>` +
		`<ellipse cx="-10" cy="-6" rx="10" ry="5" fill="${skin}" opacity="0.6"/>` +
		`</g>`
	);
}

function porkChop({ flesh, skin }: Palette): string {
	// A chop with a white rind of fat around the meat and a bone along one side.
	return (
		`<path d="M-26,-6 C-26,-22 -4,-26 10,-20 C26,-14 30,4 20,16 C10,26 -14,26 -22,14 C-26,8 -26,2 -26,-6 Z" fill="${skin}"/>` +
		`<path d="M-21,-5 C-21,-17 -4,-20 8,-15 C21,-10 24,3 16,12 C8,20 -11,20 -17,11 C-21,6 -21,1 -21,-5 Z" fill="${flesh}"/>` +
		`<path d="M-8,-18 L-2,16" stroke="${COLORS.bone}" stroke-width="6" stroke-linecap="round"/>`
	);
}

function snake({ flesh, skin }: Palette, doneness: Doneness): string {
	const scale = doneness === "raw" ? "#c9dc8f" : skin;
	return (
		`<path d="M-26,14 C-26,-4 -6,-4 -6,8 C-6,20 14,20 14,4 C14,-10 0,-16 -4,-24" ` +
		`fill="none" stroke="${skin}" stroke-width="15" stroke-linecap="round"/>` +
		`<path d="M-26,14 C-26,-4 -6,-4 -6,8 C-6,20 14,20 14,4 C14,-10 0,-16 -4,-24" ` +
		`fill="none" stroke="${flesh}" stroke-width="9" stroke-linecap="round"/>` +
		`<path d="M-26,14 C-26,-4 -6,-4 -6,8 C-6,20 14,20 14,4 C14,-10 0,-16 -4,-24" ` +
		`fill="none" stroke="${scale}" stroke-width="3" stroke-dasharray="3 5"/>`
	);
}

function sharkSteak({ flesh, skin }: Palette): string {
	// A thick steak with grey skin on top and a dorsal fin.
	return (
		`<polygon points="-4,-12 6,-32 14,-12" fill="${skin}"/>` +
		`<rect x="-28" y="-14" width="56" height="34" rx="10" fill="${skin}"/>` +
		`<rect x="-24" y="-8" width="48" height="24" rx="8" fill="${flesh}"/>` +
		`<path d="M-14,-4 Q-8,4 -14,12 M2,-4 Q8,4 2,12" fill="none" stroke="${skin}" stroke-width="2" opacity="0.6"/>`
	);
}

function tentacle({ flesh }: Palette, doneness: Doneness): string {
	const sucker = doneness === "burnt" ? "#151312" : "#f0d9c0";
	return (
		`<path d="M-28,20 C-28,-10 -6,-26 14,-22 C30,-19 32,-2 20,2 C10,5 6,-6 14,-8" ` +
		`fill="none" stroke="${flesh}" stroke-width="15" stroke-linecap="round"/>` +
		`<circle cx="-22" cy="6" r="3" fill="${sucker}"/>` +
		`<circle cx="-14" cy="-8" r="3" fill="${sucker}"/>` +
		`<circle cx="-2" cy="-16" r="3" fill="${sucker}"/>` +
		`<circle cx="12" cy="-17" r="2.5" fill="${sucker}"/>`
	);
}

function megalodonSteak({ flesh, skin }: Palette): string {
	// A large dark-skinned slab with a big serrated tooth next to it.
	return (
		`<path d="M-30,-10 C-30,-22 18,-24 22,-10 L22,14 C18,26 -30,24 -30,14 Z" fill="${skin}"/>` +
		`<path d="M-25,-6 C-25,-15 14,-17 17,-6 L17,11 C14,19 -25,18 -25,11 Z" fill="${flesh}"/>` +
		`<path d="M-18,0 Q-6,6 8,0" fill="none" stroke="${skin}" stroke-width="2" opacity="0.6"/>` +
		`<polygon points="22,-26 34,-26 28,-6" fill="${COLORS.bone}" stroke="#bfb39a" stroke-width="1"/>`
	);
}
