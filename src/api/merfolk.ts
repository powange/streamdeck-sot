import { ApiError, CachedLoader, toNumber } from "./progress";

/**
 * Storm forecasts of Merfolk's Lullaby (https://www.merfolkslullaby.com/map?tab=weather), from their GraphQL API.
 * Their own map polls the forecast every 24 minutes (one in-game day); the plugin does not poll more often.
 */
const API_URL = "https://api.merfolkslullaby.com/api";
const USER_AGENT = "streamdeck-sot (https://github.com/powange/streamdeck-sot)";

/** Same interval as the Merfolk's Lullaby map. */
const FORECAST_TTL_MS = 24 * 60_000;
const MIN_FORCE_INTERVAL_MS = 2 * 60_000;

export type StormPosition = {
	/** Time (ms) at which the storm is at this position. */
	at: number;
	/** Element (usually an island) the storm is over. */
	elementId?: string;
	/** Speed in m/s. */
	speed: number;
};

type RawPosition = { eid?: string; speed?: number; date?: string };

async function graphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
	const response = await fetch(API_URL, {
		method: "POST",
		headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": USER_AGENT },
		body: JSON.stringify({ query, variables }),
	});
	if (response.status === 429) {
		throw new ApiError("rate-limit", "Trop de requêtes");
	}
	if (!response.ok) {
		throw new ApiError("http", `HTTP ${response.status}`);
	}
	const json = (await response.json()) as { data?: T; errors?: Array<{ message?: string }> };
	if (!json.data) {
		throw new ApiError("http", json.errors?.[0]?.message ?? "Réponse vide");
	}
	return json.data;
}

const forecast = new CachedLoader(loadForecast, FORECAST_TTL_MS, MIN_FORCE_INTERVAL_MS);

/**
 * Upcoming storm positions (from a few minutes ago to about 1h20 ahead), sorted by time.
 */
export function getStormForecast(force = false): Promise<StormPosition[]> {
	return forecast.get(force);
}

async function loadForecast(): Promise<StormPosition[]> {
	const data = await graphql<{ getBetaWeather?: RawPosition[] }>(
		"query getBetaWeather($offset: Int, $limit: Int) { getBetaWeather(offset: $offset, limit: $limit) { eid speed date } }",
	);
	return (data.getBetaWeather ?? [])
		.map((p) => ({ at: Date.parse(p.date ?? ""), elementId: p.eid || undefined, speed: toNumber(p.speed) }))
		.filter((p) => Number.isFinite(p.at))
		.sort((a, b) => a.at - b.at);
}

type Localization = { locale?: string; value?: string };

const names = new Map<string, Promise<string | undefined>>();

/**
 * English name of an island (names never change, so each one is fetched once).
 */
export function getElementName(id: string): Promise<string | undefined> {
	let name = names.get(id);
	if (!name) {
		name = graphql<{ getElement?: { attributes?: Array<{ type?: string; localization?: Localization | Localization[] | null }> } }>(
			"query getElement($id: UUID) { getElement(id: $id) { attributes { type localization { locale value } } } }",
			{ id },
		)
			.then((data) => {
				const localization = data.getElement?.attributes?.find((a) => a.type === "name")?.localization;
				// A single localization object, or a list of them.
				const localizations = Array.isArray(localization) ? localization : localization ? [localization] : [];
				return (localizations.find((l) => l.locale === "en") ?? localizations[0])?.value || undefined;
			})
			.catch(() => {
				// Retry on the next refresh.
				names.delete(id);
				return undefined;
			});
		names.set(id, name);
	}
	return name;
}
