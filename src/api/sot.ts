import { getGlobalSettings } from "../global-settings";
import { ApiError, CachedLoader, type ProgressItem, toNumber } from "./progress";

/**
 * Unofficial www.seaofthieves.com profile API, authenticated with the `rat` cookie of a logged-in browser session.
 * The French prefix returns French names. Response format documented from the sot-reputations project.
 */
const PROFILE_URL = "https://www.seaofthieves.com/fr/api/profilev2";

/** Faction names; `PirateLord` and `Flameheart` are the Guardians of Fortune and the Servants of the Flame. */
const FACTION_LABELS: Record<string, string> = {
	AthenasFortune: "Fortune d'Athéna",
	BilgeRats: "Rats de cale",
	CreatorCrew: "Équipage des créateurs",
	Flameheart: "Serviteurs de la flamme",
	GoldHoarders: "Chercheurs d'or",
	HuntersCall: "Appel du chasseur",
	MerchantAlliance: "Alliance des marchands",
	OrderOfSouls: "Ordre des âmes",
	PirateLord: "Gardiens de la fortune",
	ReapersBones: "Os du Faucheur",
	SeaDogs: "Loups de mer",
	TallTales: "Légendes",
};

/** Short names that fit on a key. */
const FACTION_SHORT_LABELS: Record<string, string> = {
	AthenasFortune: "Athéna",
	Flameheart: "Serviteurs",
	GoldHoarders: "Chercheurs d'or",
	HuntersCall: "Chasseurs",
	MerchantAlliance: "Marchands",
	OrderOfSouls: "Ordre des âmes",
	PirateLord: "Gardiens",
	ReapersBones: "Faucheurs",
	SeaDogs: "Loups de mer",
};

type Emblem = {
	"#Name"?: string;
	DisplayName?: string;
	Description?: string;
	Image?: string;
	image?: string;
	Grade?: number;
	MaxGrade?: number;
	Value?: number;
	Threshold?: number;
	HasScalar?: boolean;
	/** Omitted when the commendation is not completed. */
	Completed?: boolean;
};

type Faction = {
	IsGuild?: boolean;
	GuildName?: string;
	Level?: number;
	DistinctionLevel?: number;
	/** Fraction (0-1) of the way to the next level. */
	Progress?: number;
	Rank?: string;
	Emblems?: { Emblems?: Emblem[] };
	Campaigns?: Record<string, { Title?: string; Emblems?: Emblem[] }>;
};

/**
 * A commendation, with the faction and (for Hunter's Call, Bilge Rats, Tall Tales) the campaign it belongs to.
 */
export type Commendation = ProgressItem & {
	faction: { key: string; label: string };
	campaign?: { key: string; label: string };
};

/**
 * Level of a trading company, a faction or a guild.
 */
export type FactionLevel = {
	key: string;
	label: string;
	shortLabel: string;
	isGuild: boolean;
	level: number;
	distinction: number;
	/** Fraction (0-1) of the way to the next level. */
	progress: number;
	rank?: string;
};

type Reputation = { commendations: Commendation[]; factions: FactionLevel[] };

const reputation = new CachedLoader(loadReputation, 5 * 60_000, 10_000);

export async function getCommendations(force = false): Promise<Commendation[]> {
	return (await reputation.get(force)).commendations;
}

export async function getFactionLevels(force = false): Promise<FactionLevel[]> {
	return (await reputation.get(force)).factions;
}

/** Forgets cached profile data, e.g. after the token changed. */
export function clearProfile(): void {
	reputation.clear();
	balance.clear();
	seasons.clear();
}

async function loadReputation(): Promise<Reputation> {
	const json = await fetchProfile<Record<string, Faction>>("reputation");
	return { commendations: parseReputation(json), factions: parseFactionLevels(json) };
}

export type Balance = {
	gold: number;
	doubloons: number;
	doubloonsLimit: number;
	ancientCoins: number;
};

const balance = new CachedLoader(loadBalance, 2 * 60_000, 10_000);

export function getBalance(force = false): Promise<Balance> {
	return balance.get(force);
}

async function loadBalance(): Promise<Balance> {
	const json = await fetchProfile<Record<string, unknown>>("balance");
	return {
		gold: toNumber(json.gold),
		doubloons: toNumber(json.doubloons),
		doubloonsLimit: toNumber(json.doubloonsLimit),
		ancientCoins: toNumber(json.ancientCoins),
	};
}

/**
 * Progress in a season (renown levels of the season / Plunder Pass).
 */
export type SeasonProgress = {
	title: string;
	/** Renown level reached. */
	level: number;
	maxLevel: number;
	/** Tier reached (5 levels per tier). */
	tier: number;
	/** End of the season (ms timestamp), if known. */
	endsAt?: number;
};

type Season = {
	IsActive?: boolean;
	Title?: string;
	ActiveUntil?: string;
	LevelProgress?: number;
	Tier?: number;
	Levels?: unknown[];
};

const seasons = new CachedLoader(loadSeason, 5 * 60_000, 10_000);

export function getSeasonProgress(force = false): Promise<SeasonProgress | undefined> {
	return seasons.get(force);
}

async function loadSeason(): Promise<SeasonProgress | undefined> {
	return parseSeason(await fetchProfile<Season[]>("seasons-progress"));
}

/**
 * Picks the active season (or the latest one) of the seasons-progress response.
 */
export function parseSeason(json: Season[]): SeasonProgress | undefined {
	if (!Array.isArray(json) || json.length === 0) return undefined;
	const season = json.find((s) => s.IsActive) ?? json[json.length - 1];
	const endsAt = season.ActiveUntil ? Date.parse(season.ActiveUntil) : NaN;
	return {
		title: (season.Title ?? "Saison").replace(/\s+/g, " "),
		level: toNumber(season.LevelProgress),
		maxLevel: Array.isArray(season.Levels) && season.Levels.length > 0 ? season.Levels.length : 50,
		tier: toNumber(season.Tier),
		endsAt: Number.isFinite(endsAt) ? endsAt : undefined,
	};
}

/**
 * Calls an endpoint of the profile API (`reputation`, `balance`...) with the `rat` cookie.
 */
export async function fetchProfile<T>(endpoint: string): Promise<T> {
	const token = normalizeToken((await getGlobalSettings()).ratCookie);
	if (!token) {
		throw new ApiError("missing-credentials", "Token RAT manquant");
	}

	const response = await fetch(`${PROFILE_URL}/${endpoint}`, {
		headers: {
			Accept: "application/json",
			"Accept-Language": "fr-FR,fr;q=0.9",
			Cookie: `rat=${token}`,
			Referer: "https://www.seaofthieves.com/fr/profile/reputation",
			"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
		},
	});

	if (response.status === 401 || response.status === 403) {
		throw new ApiError("auth", `Token RAT refusé (HTTP ${response.status})`);
	}
	if (response.status === 429) {
		throw new ApiError("rate-limit", "Trop de requêtes");
	}
	if (!response.ok) {
		throw new ApiError("http", `HTTP ${response.status}`);
	}

	const body = await response.text();
	try {
		return JSON.parse(body) as T;
	} catch {
		// An expired session may be answered with the HTML login page instead of JSON.
		throw new ApiError("auth", "Réponse inattendue (token expiré ?)");
	}
}

export function parseReputation(json: Record<string, Faction>): Commendation[] {
	const items: Commendation[] = [];
	for (const [factionKey, faction] of Object.entries(json)) {
		if (!faction || typeof faction !== "object" || faction.IsGuild) {
			continue;
		}

		const factionInfo = { key: factionKey, label: FACTION_LABELS[factionKey] ?? factionKey };
		const campaigns = faction.Campaigns ?? {};
		if (Object.keys(campaigns).length > 0) {
			for (const [campaignKey, campaign] of Object.entries(campaigns)) {
				const campaignInfo = { key: campaignKey, label: campaign.Title || campaignKey };
				for (const emblem of campaign.Emblems ?? []) {
					items.push({ ...toItem(factionKey, emblem), faction: factionInfo, campaign: campaignInfo });
				}
			}
		} else {
			for (const emblem of faction.Emblems?.Emblems ?? []) {
				items.push({ ...toItem(factionKey, emblem), faction: factionInfo });
			}
		}
	}
	return items;
}

export function parseFactionLevels(json: Record<string, Faction>): FactionLevel[] {
	const levels: FactionLevel[] = [];
	const guildNames = new Map<string, number>();

	for (const [key, faction] of Object.entries(json)) {
		// Bilge Rats, Tall Tales and the Creator Crew have no levels.
		if (!faction || typeof faction !== "object" || typeof faction.Level !== "number") {
			continue;
		}

		let label: string;
		let shortLabel: string;
		if (faction.IsGuild) {
			// Several guilds may share a name.
			const name = faction.GuildName || "Guilde";
			const count = (guildNames.get(name) ?? 0) + 1;
			guildNames.set(name, count);
			label = `Guilde ${name}${count > 1 ? ` (${count})` : ""}`;
			shortLabel = name;
		} else {
			label = FACTION_LABELS[key] ?? key;
			shortLabel = FACTION_SHORT_LABELS[key] ?? label;
		}

		levels.push({
			key,
			label,
			shortLabel,
			isGuild: faction.IsGuild === true,
			level: faction.Level,
			distinction: toNumber(faction.DistinctionLevel),
			progress: Math.max(0, Math.min(1, toNumber(faction.Progress))),
			rank: faction.Rank || undefined,
		});
	}
	return levels;
}

function toItem(factionKey: string, emblem: Emblem): ProgressItem {
	const completed = emblem.Completed === true;
	const maxGrade = toNumber(emblem.MaxGrade) || 1;
	// Binary commendations stay at grade 0 even once completed.
	const grade = completed && maxGrade === 1 ? 1 : toNumber(emblem.Grade);
	const scalar = emblem.HasScalar !== false && toNumber(emblem.Threshold) > 0;

	// The image file name is the same in every language, unlike the display name.
	const key = emblem.Image?.replace(/\.png$/i, "") || emblem["#Name"] || emblem.DisplayName || "";

	return {
		id: `${factionKey}:${key}`,
		name: emblem.DisplayName ?? emblem["#Name"] ?? "?",
		description: emblem.Description ?? "",
		badge: maxGrade > 1 ? `${grade}/${maxGrade}` : undefined,
		current: scalar ? toNumber(emblem.Value) : completed ? 1 : 0,
		target: scalar ? toNumber(emblem.Threshold) : 1,
		completed,
		imageUrl: emblem.image,
	};
}

/**
 * Accepts the raw cookie value, or a pasted `rat=...` / full cookie header.
 */
function normalizeToken(value: string | undefined): string | undefined {
	if (!value) return undefined;
	const match = /(?:^|;\s*)rat=([^;]+)/.exec(value.trim());
	return (match ? match[1] : value).trim() || undefined;
}
