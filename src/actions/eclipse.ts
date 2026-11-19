import {
	action,
	type Action,
	type DidReceiveSettingsEvent,
	type KeyDownEvent,
	SingletonAction,
	type TitleParametersDidChangeEvent,
	type WillAppearEvent,
	type WillDisappearEvent,
} from "@elgato/streamdeck";

import {
	eclipseIcon,
	type EclipseSettings,
	formatClock,
	formatCountdown,
	getEclipseSettings,
	isEclipseActive,
	upcomingEclipses,
} from "../eclipses";
import { cleanTitle, COLORS, composeKey, fitText, GRID, type KeyStyle, keySvg, label, pill, place, text, toDataUrl } from "../svg";

/** Countdowns are redrawn this often, from the locally computed schedule. */
const TICK_MS = 15_000;

type EclipseKeySettings = {
	/** "1" (default), "2", "3": that upcoming eclipse; "all": the three next ones. */
	rank?: string;
	textOnTop?: boolean;
};

/**
 * Eclipse schedule: time left before the next eclipse (or the 2nd / 3rd one), or the three next times on one key.
 * Computed locally; the schedule anchor and the eclipse duration come from the SoT Achievements site. Press to refresh.
 */
@action({ UUID: "com.powange.seaofthieves.eclipse" })
export class EclipseSchedule extends SingletonAction<EclipseKeySettings> {
	private readonly settings = new Map<string, EclipseKeySettings>();
	private readonly titles = new Map<string, string | undefined>();
	private ticker: ReturnType<typeof setInterval> | undefined;

	override async onWillAppear(ev: WillAppearEvent<EclipseKeySettings>): Promise<void> {
		this.settings.set(ev.action.id, ev.payload.settings);
		this.ticker ??= setInterval(() => void this.renderAll(), TICK_MS);
		await this.render(ev.action);
	}

	override onWillDisappear(ev: WillDisappearEvent<EclipseKeySettings>): void {
		this.settings.delete(ev.action.id);
		if (this.settings.size === 0 && this.ticker !== undefined) {
			clearInterval(this.ticker);
			this.ticker = undefined;
		}
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<EclipseKeySettings>): Promise<void> {
		this.settings.set(ev.action.id, ev.payload.settings);
		await this.render(ev.action);
	}

	override async onTitleParametersDidChange(ev: TitleParametersDidChangeEvent<EclipseKeySettings>): Promise<void> {
		this.titles.set(ev.action.id, cleanTitle(ev.payload.title));
		await this.render(ev.action);
	}

	override async onKeyDown(ev: KeyDownEvent<EclipseKeySettings>): Promise<void> {
		// Picks up a schedule re-anchored on the site.
		await getEclipseSettings(true);
		await this.renderAll();
		if (ev.action.isKey()) await ev.action.showOk();
	}

	private async renderAll(): Promise<void> {
		for (const action of this.actions) {
			await this.render(action);
		}
	}

	private async render(action: Action<EclipseKeySettings>): Promise<void> {
		if (!action.isKey()) return;
		const settings = this.settings.get(action.id) ?? {};
		const style = { title: this.titles.get(action.id), textOnTop: settings.textOnTop === true };
		await action.setImage(toDataUrl(renderEclipseKey(settings.rank, await getEclipseSettings(), Date.now(), style)));
	}
}

/**
 * Draws an eclipse key for a rank ("1" to "3", or "all") at a given time.
 */
export function renderEclipseKey(rank: string | undefined, schedule: EclipseSettings, now: number, style: KeyStyle = {}): string {
	const eclipses = upcomingEclipses(now, 3, schedule);

	if (rank === "all") {
		return keySvg(
			text(72, 22, style.title ?? "Éclipses", 16, COLORS.muted, "normal") +
				eclipses
					.map((start, i) => {
						const active = isEclipseActive(start, now, schedule);
						const y = 60 + i * 37;
						return (
							text(14, y, formatClock(start), 26, active ? COLORS.cooking : COLORS.text, "bold", "start") +
							text(132, y, active ? "en cours" : formatCountdown(start - now), 17, active ? COLORS.cooking : COLORS.muted, "normal", "end")
						);
					})
					.join(""),
		);
	}

	const index = Math.min(2, Math.max(0, (Number(rank) || 1) - 1));
	const start = eclipses[index];
	const active = isEclipseActive(start, now, schedule);
	return composeKey(
		{
			visual: place(eclipseIcon(active), 66, GRID.iconY) + pill(`+${index + 1}`),
			info:
				fitText(72, GRID.valueY, active ? "En cours" : formatCountdown(start - now), GRID.valueSize, active ? COLORS.cooking : COLORS.text) +
				label(style.title ?? `à ${formatClock(start)}`),
			split: GRID.split,
		},
		style,
	);
}
