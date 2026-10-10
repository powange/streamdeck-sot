/**
 * Food that can be cooked on a stove or campfire.
 *
 * Timings are measured from the moment the food is placed on the fire, and food burns once left on the fire for roughly
 * twice its cooking time. Sources disagree slightly, so the "cooked" value is the safest one of:
 * - https://sotfr.net/guides/gameplay/guide-peche-chasse/ (fish 45–80s, trophy fish 80–180s)
 * - https://seaofthieves.wiki.gg/wiki/Cooking (trophy fish is still under-cooked at 80s, cooked at 90s)
 */
export type FoodId = "fish" | "trophy-fish" | "chicken" | "pork" | "snake" | "shark" | "kraken" | "megalodon";

export type Food = {
	id: FoodId;
	label: string;
	cookSeconds: number;
	burnSeconds: number;
};

export const FOODS: Record<FoodId, Food> = {
	fish: { id: "fish", label: "Poisson", cookSeconds: 45, burnSeconds: 80 },
	"trophy-fish": { id: "trophy-fish", label: "Trophée", cookSeconds: 90, burnSeconds: 180 },
	chicken: { id: "chicken", label: "Poulet", cookSeconds: 60, burnSeconds: 120 },
	pork: { id: "pork", label: "Porc", cookSeconds: 60, burnSeconds: 120 },
	snake: { id: "snake", label: "Serpent", cookSeconds: 60, burnSeconds: 120 },
	shark: { id: "shark", label: "Requin", cookSeconds: 60, burnSeconds: 120 },
	kraken: { id: "kraken", label: "Kraken", cookSeconds: 120, burnSeconds: 240 },
	megalodon: { id: "megalodon", label: "Mégalodon", cookSeconds: 120, burnSeconds: 240 },
};

export const DEFAULT_FOOD: FoodId = "fish";

export function getFood(id: string | undefined): Food {
	return FOODS[id as FoodId] ?? FOODS[DEFAULT_FOOD];
}
