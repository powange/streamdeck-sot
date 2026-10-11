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

/** The clock border runs along the edge of the key, this far inside it, with rounded corners like the keys. */
const BORDER_INSET = 7;
const BORDER_RADIUS = 18;

type Segment = { length: number; point: (distance: number) => [number, number] };

/** Border pieces, clockwise from the middle of the top edge (midnight): straight lines and quarter circles. */
const BORDER_SEGMENTS: Segment[] = (() => {
	const min = BORDER_INSET;
	const max = KEY_SIZE - BORDER_INSET;
	const mid = KEY_SIZE / 2;
	const r = BORDER_RADIUS;
	const line = (x1: number, y1: number, x2: number, y2: number): Segment => {
		const length = Math.hypot(x2 - x1, y2 - y1);
		return { length, point: (d) => [x1 + ((x2 - x1) * d) / length, y1 + ((y2 - y1) * d) / length] };
	};
	// Angles grow clockwise, as the y axis points down.
	const arc = (cx: number, cy: number, startAngle: number): Segment => ({
		length: (Math.PI * r) / 2,
		point: (d) => [cx + r * Math.cos(startAngle + d / r), cy + r * Math.sin(startAngle + d / r)],
	});
	return [
		line(mid, min, max - r, min),
		arc(max - r, min + r, -Math.PI / 2),
		line(max, min + r, max, max - r),
		arc(max - r, max - r, 0),
		line(max - r, max, min + r, max),
		arc(min + r, max - r, Math.PI / 2),
		line(min, max - r, min, min + r),
		arc(min + r, min + r, Math.PI),
		line(min + r, min, mid, min),
	];
})();

const BORDER_LENGTH = BORDER_SEGMENTS.reduce((total, segment) => total + segment.length, 0);

const BORDER_PATH = (() => {
	const min = BORDER_INSET;
	const max = KEY_SIZE - BORDER_INSET;
	const r = BORDER_RADIUS;
	const corner = (x: number, y: number) => `A${r},${r} 0 0 1 ${x},${y}`;
	return (
		`M${KEY_SIZE / 2},${min} H${max - r} ${corner(max, min + r)} V${max - r} ${corner(max - r, max)} ` +
		`H${min + r} ${corner(min, max - r)} V${min + r} ${corner(min + r, min)} Z`
	);
})();

/**
 * Point at a fraction (0-1) of the border, clockwise from the middle of the top edge.
 */
function borderPoint(fraction: number): [number, number] {
	let distance = (((fraction % 1) + 1) % 1) * BORDER_LENGTH;
	for (const segment of BORDER_SEGMENTS) {
		if (distance <= segment.length) return segment.point(distance);
		distance -= segment.length;
	}
	return [KEY_SIZE / 2, BORDER_INSET];
}

/**
 * Day of the cycle in a gold pill, readable from a distance.
 */
function dayBadge(day: number): string {
	const label = `Jour ${day}`;
	const width = label.length * 8.6 + 12;
	const right = KEY_SIZE - BORDER_INSET - 6;
	return (
		`<rect x="${(right - width).toFixed(1)}" y="15" width="${width.toFixed(1)}" height="21" rx="10.5" fill="${COLORS.gold}"/>` +
		text(right - width / 2, 31, label, 15, COLORS.ink)
	);
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
	return segments + `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5.5" fill="${COLORS.danger}" stroke="#ffffff" stroke-width="2"/>`;
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
			visual: place(periodIcon(time.period), 40, 42, 0.7) + dayBadge(time.day),
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
