import {
	action,
	type Action,
	type DidReceiveSettingsEvent,
	SingletonAction,
	type TitleParametersDidChangeEvent,
	type WillAppearEvent,
	type WillDisappearEvent,
} from "@elgato/streamdeck";

import { type GameTime, getGameTime, PERIOD_COLORS, PERIOD_LABELS, periodIcon, periodRanges } from "../game-clock";
import { cleanTitle, COLORS, composeKey, KEY_SIZE, type KeyStyle, place, text, toDataUrl } from "../svg";

/** One real second is one in-game minute. */
const TICK_MS = 1000;

const NIGHT_BACKGROUND = "#07121a";

/** The clock border runs along the edge of the key, this far inside it. */
const BORDER_INSET = 5;
const BORDER_SIDE = KEY_SIZE - 2 * BORDER_INSET;
const BORDER_LENGTH = 4 * BORDER_SIDE;

/** Border path, clockwise from the middle of the top edge (midnight). */
const BORDER_PATH = (() => {
	const min = BORDER_INSET;
	const max = KEY_SIZE - BORDER_INSET;
	const mid = KEY_SIZE / 2;
	return `M${mid},${min} H${max} V${max} H${min} V${min} Z`;
})();

/**
 * Point at a fraction (0-1) of the border, clockwise from the middle of the top edge.
 */
function borderPoint(fraction: number): [number, number] {
	const min = BORDER_INSET;
	const max = KEY_SIZE - BORDER_INSET;
	let d = (((fraction % 1) + 1) % 1) * BORDER_LENGTH;
	const half = BORDER_SIDE / 2;
	if (d <= half) return [KEY_SIZE / 2 + d, min];
	d -= half;
	if (d <= BORDER_SIDE) return [max, min + d];
	d -= BORDER_SIDE;
	if (d <= BORDER_SIDE) return [max - d, max];
	d -= BORDER_SIDE;
	if (d <= BORDER_SIDE) return [min, max - d];
	d -= BORDER_SIDE;
	return [min + d, min];
}

/**
 * Clock face drawn on the border of the key: each period of the day in its colour, and a red dot at the current time.
 */
function clockBorder(dayProgress: number): string {
	const segments = periodRanges()
		.map(
			({ period, from, to }) =>
				`<path d="${BORDER_PATH}" fill="none" stroke="${PERIOD_COLORS[period]}" stroke-width="4" stroke-opacity="0.8" ` +
				`stroke-dasharray="${((to - from) * BORDER_LENGTH).toFixed(1)} ${BORDER_LENGTH}" stroke-dashoffset="${(-from * BORDER_LENGTH).toFixed(1)}"/>`,
		)
		.join("");
	const [x, y] = borderPoint(dayProgress);
	return segments + `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="${COLORS.danger}" stroke="#ffffff" stroke-width="2"/>`;
}

/**
 * In-game clock: time, period of the day (sunrise, morning, afternoon, sunset, night) and day of the 30-day cycle,
 * computed locally from the real time.
 */
@action({ UUID: "com.powange.seaofthieves.game-clock" })
export class GameClock extends SingletonAction<ClockSettings> {
	private readonly settings = new Map<string, ClockSettings>();
	private readonly titles = new Map<string, string | undefined>();
	private ticker: ReturnType<typeof setInterval> | undefined;

	override async onWillAppear(ev: WillAppearEvent<ClockSettings>): Promise<void> {
		this.settings.set(ev.action.id, ev.payload.settings);
		this.ticker ??= setInterval(() => void this.tick(), TICK_MS);
		await this.render(ev.action);
	}

	override onWillDisappear(ev: WillDisappearEvent<ClockSettings>): void {
		this.settings.delete(ev.action.id);
		if (this.settings.size === 0 && this.ticker !== undefined) {
			clearInterval(this.ticker);
			this.ticker = undefined;
		}
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<ClockSettings>): Promise<void> {
		this.settings.set(ev.action.id, ev.payload.settings);
		await this.render(ev.action);
	}

	override async onTitleParametersDidChange(ev: TitleParametersDidChangeEvent<ClockSettings>): Promise<void> {
		this.titles.set(ev.action.id, cleanTitle(ev.payload.title));
		await this.render(ev.action);
	}

	private async tick(): Promise<void> {
		for (const action of this.actions) {
			await this.render(action);
		}
	}

	private async render(action: Action<ClockSettings>): Promise<void> {
		if (!action.isKey()) return;
		const settings = this.settings.get(action.id) ?? {};
		const style = { title: this.titles.get(action.id), textOnTop: settings.textOnTop === true };
		await action.setImage(toDataUrl(renderClockKey(getGameTime(), style)));
	}
}

/**
 * Draws the in-game clock; a Stream Deck title replaces the period name.
 */
export function renderClockKey(time: GameTime, style: KeyStyle = {}): string {
	const night = time.period === "night";
	const key = composeKey(
		{
			visual: place(periodIcon(time.period), 72, 40, 0.85) + text(130, 26, `J${time.day}`, 13, COLORS.gold, "bold", "end"),
			info:
				text(72, 98, `${time.hours}:${String(time.minutes).padStart(2, "0")}`, 32) +
				text(72, 120, style.title ?? PERIOD_LABELS[time.period], 13, COLORS.muted, "normal"),
			split: 66,
			background: night ? NIGHT_BACKGROUND : COLORS.sea,
		},
		style,
	);
	// The border goes on top of the content, whatever the layout.
	return key.replace("</svg>", `${clockBorder(time.dayProgress)}</svg>`);
}

type ClockSettings = {
	textOnTop?: boolean;
};
