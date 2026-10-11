import { action, type Action, type WillAppearEvent, type WillDisappearEvent } from "@elgato/streamdeck";

import { getElementName, getStormForecast, type StormPosition } from "../api/merfolk";
import { type ProgressItem } from "../api/progress";
import { stormIcon } from "../progress-icons";
import { ProgressAction, type ProgressSettings } from "./progress-action";

/** The "in N min" text is redrawn this often, from the cached forecast. */
const REDRAW_MS = 30_000;

/** Fetch a new forecast when the current one ends sooner than this. */
const MIN_FORECAST_AHEAD_MS = 20 * 60_000;

/** Furthest island that can be shown: the 5th one after the current island. */
const MAX_OFFSET = 5;

type StormSettings = ProgressSettings & {
	/** Island to show: 0 = the island under the storm now, 1 = the next one... up to 5. */
	offset?: number | string;
};

/**
 * Storm tracker based on the Merfolk's Lullaby forecasts: shows the island the storm is over, or one of the next five
 * islands it will hit and when. Press to refresh.
 */
@action({ UUID: "com.powange.seaofthieves.storm" })
export class StormTracker extends ProgressAction<StormSettings> {
	protected override readonly fallbackIcon = stormIcon();
	protected override readonly placeholder: [string, string] = ["Tempête", "indisponible"];

	private readonly redraws = new Map<string, ReturnType<typeof setInterval>>();

	override async onWillAppear(ev: WillAppearEvent<StormSettings>): Promise<void> {
		await super.onWillAppear(ev);
		this.startRedraw(ev.action);
	}

	override onWillDisappear(ev: WillDisappearEvent<StormSettings>): void {
		super.onWillDisappear(ev);
		clearInterval(this.redraws.get(ev.action.id));
		this.redraws.delete(ev.action.id);
	}

	private startRedraw(action: Action<StormSettings>): void {
		clearInterval(this.redraws.get(action.id));
		this.redraws.set(
			action.id,
			setInterval(() => void this.refresh(action, false), REDRAW_MS),
		);
	}

	protected override async fetchItem(settings: StormSettings, force: boolean): Promise<ProgressItem | undefined> {
		const now = Date.now();
		let positions = await getStormForecast(force);
		if (positions.length === 0 || positions[positions.length - 1].at < now + MIN_FORECAST_AHEAD_MS) {
			positions = await getStormForecast(true);
		}
		if (positions.length === 0) return undefined;

		// Islands in the order the storm reaches them, starting with the one it is over now.
		const current = currentPosition(positions, now);
		const route = [current];
		for (const position of positions) {
			if (position.at > now && position.elementId && position.elementId !== route[route.length - 1].elementId) {
				route.push(position);
			}
		}

		const offset = Math.min(MAX_OFFSET, Math.max(0, Math.round(Number(settings.offset) || 0)));
		const target = route[offset];
		const badge = offset > 0 ? `+${offset}` : undefined;
		if (!target) {
			// The forecast (about 1h20) does not reach that far.
			return {
				id: "unknown",
				name: "Île suivante",
				description: "",
				badge,
				current: 0,
				target: 0,
				completed: false,
				valueText: "hors prévision",
				noBar: true,
			};
		}

		const island = (target.elementId && (await getElementName(target.elementId))) || "En pleine mer";
		const minutes = Math.ceil((target.at - now) / 60_000);

		return {
			id: target.elementId ?? "sea",
			name: island,
			description: "",
			badge,
			current: 0,
			target: 0,
			completed: false,
			valueText: offset === 0 ? "maintenant" : minutes <= 1 ? "dans 1 min" : `dans ${minutes} min`,
			noBar: true,
		};
	}
}

/** Last forecast position already reached, or the first one. */
function currentPosition(positions: StormPosition[], now: number): StormPosition {
	let current = positions[0];
	for (const position of positions) {
		if (position.at <= now) current = position;
	}
	return current;
}
