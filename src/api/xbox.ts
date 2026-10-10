import { getGlobalSettings } from "../global-settings";
import { ApiError, CachedLoader, type ProgressItem, toNumber } from "./progress";

/**
 * Xbox achievements through OpenXBL (https://xbl.io), a third-party Xbox Live API authenticated by a personal API key.
 * The free plan is limited to ~150 requests per hour, hence the long cache.
 */
const BASE_URL = "https://api.xbl.io/v2";
const SEA_OF_THIEVES = /sea of thieves/i;
const MAX_PAGES = 10;

type XboxAchievement = {
	id?: string;
	name?: string;
	description?: string;
	lockedDescription?: string;
	progressState?: string;
	progression?: { requirements?: Array<{ current?: string | number; target?: string | number }> };
	mediaAssets?: Array<{ type?: string; url?: string }>;
	rewards?: Array<{ type?: string; value?: string | number }>;
};

type AchievementsPage = {
	achievements?: XboxAchievement[];
	pagingInfo?: { continuationToken?: string | null };
};

let titleId: string | undefined;

const achievements = new CachedLoader(loadAchievements, 10 * 60_000, 60_000);

export function getAchievements(force = false): Promise<ProgressItem[]> {
	return achievements.get(force);
}

export function clearAchievements(): void {
	achievements.clear();
	titleId = undefined;
}

async function request<T>(path: string): Promise<T> {
	const apiKey = (await getGlobalSettings()).xblApiKey?.trim();
	if (!apiKey) {
		throw new ApiError("missing-credentials", "Clé OpenXBL manquante");
	}

	const response = await fetch(`${BASE_URL}${path}`, {
		headers: { Accept: "application/json", "Accept-Language": "fr-FR", "X-Authorization": apiKey },
	});
	if (response.status === 401 || response.status === 403) {
		throw new ApiError("auth", `Clé OpenXBL refusée (HTTP ${response.status})`);
	}
	if (response.status === 429) {
		throw new ApiError("rate-limit", "Limite OpenXBL atteinte");
	}
	if (!response.ok) {
		throw new ApiError("http", `HTTP ${response.status}`);
	}

	// OpenXBL sometimes wraps the Xbox Live payload as { content, code }.
	const json = (await response.json()) as { content?: T } & T;
	return (json.content ?? json) as T;
}

async function findTitleId(): Promise<string> {
	if (titleId) return titleId;

	const history = await request<{ titles?: Array<{ titleId?: string | number; name?: string }> }>("/titles");
	const title = history.titles?.find((t) => SEA_OF_THIEVES.test(t.name ?? ""));
	if (!title?.titleId) {
		throw new ApiError("http", "Sea of Thieves introuvable dans l'historique Xbox");
	}
	titleId = String(title.titleId);
	return titleId;
}

async function loadAchievements(): Promise<ProgressItem[]> {
	const id = await findTitleId();
	const items: ProgressItem[] = [];

	let token: string | null | undefined;
	for (let page = 0; page < MAX_PAGES; page++) {
		const query = token ? `?continuationToken=${encodeURIComponent(token)}` : "";
		const result = await request<AchievementsPage>(`/achievements/title/${id}${query}`);
		items.push(...(result.achievements ?? []).map(toItem));

		token = result.pagingInfo?.continuationToken;
		if (!token) break;
	}

	return items;
}

function toItem(achievement: XboxAchievement): ProgressItem {
	const completed = achievement.progressState === "Achieved";
	const requirement = achievement.progression?.requirements?.find((r) => toNumber(r.target) > 1);
	const target = requirement ? toNumber(requirement.target) : 1;
	const current = completed ? target : requirement ? Math.min(toNumber(requirement.current), target) : 0;
	const gamerscore = achievement.rewards?.find((r) => r.type === "Gamerscore")?.value;

	return {
		id: String(achievement.id ?? achievement.name),
		name: achievement.name ?? "?",
		description: (completed ? achievement.description : achievement.lockedDescription) || achievement.description || "",
		badge: gamerscore !== undefined ? `${gamerscore}G` : undefined,
		current,
		target,
		completed,
		imageUrl: achievement.mediaAssets?.find((m) => m.type === "Icon")?.url,
	};
}
