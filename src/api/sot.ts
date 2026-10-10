import { getGlobalSettings } from "../global-settings";
import { ApiError, CachedLoader, type ProgressItem, toNumber } from "./progress";

/**
 * Unofficial www.seaofthieves.com profile API, authenticated with the `rat` cookie of a logged-in browser session.
 * The French prefix returns French names. Response format documented from the sot-reputations project.
 */
const REPUTATION_URL = "https://www.seaofthieves.com/fr/api/profilev2/reputation";

const FACTION_LABELS: Record<string, string> = {
	AthenasFortune: "Fortune d'Athéna",
	BilgeRats: "Rats de cale",
	CreatorCrew: "Équipage des créateurs",
	Flameheart: "Flameheart",
	GoldHoarders: "Chercheurs d'or",
	HuntersCall: "Appel du chasseur",
	MerchantAlliance: "Alliance des marchands",
	OrderOfSouls: "Ordre des âmes",
	PirateLord: "Seigneur des pirates",
	ReapersBones: "Os du Faucheur",
	SeaDogs: "Loups de mer",
	TallTales: "Légendes",
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

const reputation = new CachedLoader(loadCommendations, 5 * 60_000, 10_000);

export function getCommendations(force = false): Promise<Commendation[]> {
	return reputation.get(force);
}

export function clearCommendations(): void {
	reputation.clear();
}

async function loadCommendations(): Promise<Commendation[]> {
	const token = normalizeToken((await getGlobalSettings()).ratCookie);
	if (!token) {
		throw new ApiError("missing-credentials", "Token RAT manquant");
	}

	const response = await fetch(REPUTATION_URL, {
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
		return parseReputation(JSON.parse(body) as Record<string, Faction>);
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
