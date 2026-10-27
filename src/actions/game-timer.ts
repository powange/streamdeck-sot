import {
	action,
	type Action,
	type DidReceiveSettingsEvent,
	type KeyDownEvent,
	type KeyUpEvent,
	SingletonAction,
	type TitleParametersDidChangeEvent,
	type WillAppearEvent,
	type WillDisappearEvent,
} from "@elgato/streamdeck";

import { playSound, type SoundSettings } from "../sound";
import { cleanTitle, COLORS, composeKey, fitText, type KeyStyle, pill, place, progressBar, text, toDataUrl, truncate } from "../svg";
import { getTimerPreset, type TimerPreset, timerIcon } from "../timer-presets";

/** How often running timers are redrawn. */
const TICK_MS = 250;

/** How long the key must be held to reset the timer. */
const LONG_PRESS_MS = 600;

/** A warning sound is played this long before the end of non-repeating timers. */
const WARNING_MS = 60_000;

/** Ends older than this are not signalled (e.g. a timer that expired while Stream Deck was closed). */
const STALE_MS = 5_000;

/** How long a finished key flashes before staying red. */
const FLASH_MS = 30_000;

type Phase = "idle" | "running" | "paused" | "finished";

/**
 * Generic timer (AFK megalodon, in-game day, custom). Press to start / pause / resume, hold to reset.
 * The end time is stored in the key settings, so a running timer survives a Stream Deck restart.
 */
@action({ UUID: "com.powange.seaofthieves.timer" })
export class GameTimer extends SingletonAction<TimerSettings> {
	private readonly settings = new Map<string, TimerSettings>();
	private readonly presses = new Map<string, ReturnType<typeof setTimeout>>();
	/** Last image sent per action, to avoid re-sending identical frames. */
	private readonly images = new Map<string, string>();
	/** End time already signalled per action, so each end plays its sound once. */
	private readonly signalled = new Map<string, number>();
	/** End time already warned per action. */
	private readonly warned = new Map<string, number>();
	private readonly titles = new Map<string, string | undefined>();
	private ticker: ReturnType<typeof setInterval> | undefined;

	override async onWillAppear(ev: WillAppearEvent<TimerSettings>): Promise<void> {
		this.settings.set(ev.action.id, ev.payload.settings);
		this.images.delete(ev.action.id);
		this.updateTicker();
		await this.checkTransitions(ev.action.id, ev.payload.settings, Date.now());
		await this.render(ev.action);
	}

	override onWillDisappear(ev: WillDisappearEvent<TimerSettings>): void {
		this.images.delete(ev.action.id);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<TimerSettings>): Promise<void> {
		this.settings.set(ev.action.id, ev.payload.settings);
		this.images.delete(ev.action.id);
		this.updateTicker();
		await this.checkTransitions(ev.action.id, ev.payload.settings, Date.now());
		await this.render(ev.action);
	}

	override async onTitleParametersDidChange(ev: TitleParametersDidChangeEvent<TimerSettings>): Promise<void> {
		this.titles.set(ev.action.id, cleanTitle(ev.payload.title));
		await this.render(ev.action);
	}

	override onKeyDown(ev: KeyDownEvent<TimerSettings>): void {
		const { action } = ev;
		this.settings.set(action.id, ev.payload.settings);
		this.presses.set(
			action.id,
			setTimeout(async () => {
				this.presses.delete(action.id);
				await this.update(action, { endsAt: undefined, remainingMs: undefined, cycles: undefined });
				if (action.isKey()) await action.showOk();
			}, LONG_PRESS_MS),
		);
	}

	override async onKeyUp(ev: KeyUpEvent<TimerSettings>): Promise<void> {
		const pending = this.presses.get(ev.action.id);
		if (pending === undefined) {
			// The long press already reset the timer.
			return;
		}
		clearTimeout(pending);
		this.presses.delete(ev.action.id);

		const settings = this.settings.get(ev.action.id) ?? ev.payload.settings;
		const now = Date.now();
		switch (getPhase(settings, now)) {
			case "idle":
				await this.update(ev.action, { endsAt: now + duration(settings) * 1000, remainingMs: undefined, cycles: undefined });
				break;
			case "running":
				await this.update(ev.action, { endsAt: undefined, remainingMs: settings.endsAt! - now });
				break;
			case "paused":
				await this.update(ev.action, { endsAt: now + settings.remainingMs!, remainingMs: undefined });
				break;
			case "finished":
				await this.update(ev.action, { endsAt: undefined, remainingMs: undefined });
				break;
		}
	}

	private async update(action: Action<TimerSettings>, changes: Partial<TimerSettings>): Promise<void> {
		const settings = { ...(this.settings.get(action.id) ?? {}), ...changes };
		// JSON settings cannot hold undefined values.
		for (const key of Object.keys(changes) as (keyof TimerSettings)[]) {
			if (settings[key] === undefined) delete settings[key];
		}
		this.settings.set(action.id, settings);
		await action.setSettings(settings);
		this.updateTicker();
		await this.render(action);
	}

	private updateTicker(): void {
		const running = [...this.settings.values()].some((s) => s.endsAt !== undefined);
		if (running && this.ticker === undefined) {
			this.ticker = setInterval(() => void this.tick(), TICK_MS);
		} else if (!running && this.ticker !== undefined) {
			clearInterval(this.ticker);
			this.ticker = undefined;
		}
	}

	private async tick(): Promise<void> {
		const now = Date.now();
		for (const [id, settings] of this.settings) {
			await this.checkTransitions(id, settings, now);
		}

		// Only visible actions are enumerated; hidden ones are redrawn by onWillAppear.
		for (const action of this.actions) {
			await this.render(action);
		}
	}

	/**
	 * Plays sounds and visual feedback near and at the end of a timer. Runs for every timer, including those on hidden
	 * pages.
	 */
	private async checkTransitions(id: string, settings: TimerSettings, now: number): Promise<void> {
		const { endsAt } = settings;
		if (endsAt === undefined) {
			return;
		}

		const visible = [...this.actions].find((a) => a.id === id);
		const remaining = endsAt - now;
		const repeating = isRepeating(settings);

		if (remaining > 0) {
			if (!repeating && remaining <= WARNING_MS && duration(settings) * 1000 > WARNING_MS && this.warned.get(id) !== endsAt) {
				this.warned.set(id, endsAt);
				playSound("warning", settings);
			}
			return;
		}

		const fresh = -remaining < STALE_MS;
		if (repeating) {
			// Repeating timers (in-game day) roll over to the next cycle instead of finishing.
			const cycle = duration(settings) * 1000;
			const elapsedCycles = Math.ceil((now - endsAt + 1) / cycle);
			const next = { ...settings, endsAt: endsAt + elapsedCycles * cycle, cycles: (settings.cycles ?? 0) + elapsedCycles };
			this.settings.set(id, next);
			if (visible) await visible.setSettings(next);
			if (fresh) {
				playSound("ding", settings);
				if (visible?.isKey()) await visible.showOk();
			}
		} else if (this.signalled.get(id) !== endsAt) {
			this.signalled.set(id, endsAt);
			if (fresh) {
				playSound("alarm", settings);
				if (visible?.isKey()) await visible.showAlert();
			}
		}
	}

	private async render(action: Action<TimerSettings>): Promise<void> {
		if (!action.isKey()) {
			return;
		}

		const settings = this.settings.get(action.id) ?? {};
		const now = Date.now();
		const style = { title: this.titles.get(action.id), textOnTop: settings.textOnTop === true };
		const image = toDataUrl(renderTimerKey(settings, now, style));
		if (this.images.get(action.id) !== image) {
			this.images.set(action.id, image);
			await action.setImage(image);
		}
	}
}

function getPhase(settings: TimerSettings, now: number): Phase {
	if (settings.remainingMs !== undefined) return "paused";
	if (settings.endsAt === undefined) return "idle";
	return settings.endsAt > now ? "running" : "finished";
}

function preset(settings: TimerSettings): TimerPreset {
	return getTimerPreset(settings.preset);
}

/**
 * Duration in seconds: the custom duration if set (or the minutes of older versions), otherwise the preset's.
 */
function duration(settings: TimerSettings): number {
	return parseDuration(settings.duration) ?? parseMinutes(settings.minutes) ?? preset(settings).seconds;
}

/**
 * Parses a duration typed as seconds ("90") or as m:ss / h:mm:ss ("1:30", "1:30:00").
 */
export function parseDuration(value: string | number | undefined): number | undefined {
	if (value === undefined || String(value).trim() === "") return undefined;
	const parts = String(value).trim().split(":");
	if (parts.length > 3 || parts.some((part) => !/^\d+$/.test(part))) return undefined;
	const seconds = parts.reduce((total, part) => total * 60 + Number(part), 0);
	return seconds > 0 ? seconds : undefined;
}

function parseMinutes(value: string | number | undefined): number | undefined {
	const minutes = Number(value);
	return value !== undefined && value !== "" && Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes * 60) : undefined;
}

function isRepeating(settings: TimerSettings): boolean {
	if (settings.repeat === "yes") return true;
	if (settings.repeat === "no") return false;
	return preset(settings).repeat;
}

/** The Stream Deck title, else the label of older versions, else the preset name. */
function label(settings: TimerSettings, style: KeyStyle): string {
	return style.title ?? (settings.label?.trim() || preset(settings).label);
}

/**
 * Draws the key of a timer at a given time. Once a non-repeating timer is over, it counts the time elapsed since its
 * end as a negative value.
 */
export function renderTimerKey(settings: TimerSettings, now: number, style: KeyStyle = {}): string {
	const total = duration(settings);
	const name = label(settings, style);
	const icon = timerIcon(preset(settings).id);
	// Number of completed cycles of a repeating timer, in the top-right corner.
	const cycles = settings.cycles ? pill(`×${settings.cycles}`) : "";

	switch (getPhase(settings, now)) {
		case "idle":
			return composeKey(
				{
					visual: place(icon, 72, 48, 1.15) + cycles,
					info: fitText(72, 106, name, 22) + text(72, 131, formatDuration(total), 18, COLORS.muted, "normal"),
					split: 84,
				},
				style,
			);

		case "running": {
			const remaining = (settings.endsAt! - now) / 1000;
			const warning = remaining <= 60;
			return composeKey(
				{
					visual: place(icon, 72, 40, 0.9) + cycles,
					info: fitText(72, 98, formatDuration(remaining), 32, warning ? COLORS.cooking : COLORS.text) + text(72, 121, truncate(name, 17, undefined, true), 17, COLORS.teal),
					bar: progressBar(1 - remaining / total, warning ? COLORS.cooking : COLORS.teal),
					split: 66,
				},
				style,
			);
		}

		case "paused": {
			const remaining = settings.remainingMs! / 1000;
			return composeKey(
				{
					visual: place(icon, 72, 40, 0.9) + cycles,
					info: fitText(72, 98, formatDuration(remaining), 32, COLORS.muted) + text(72, 121, truncate(style.title ?? "PAUSE", 17, undefined, true), 17, COLORS.gold),
					bar: progressBar(1 - remaining / total, COLORS.muted),
					split: 66,
				},
				style,
			);
		}

		case "finished": {
			const overtime = now - settings.endsAt!;
			const flash = overtime < FLASH_MS && Math.floor(now / 500) % 2 === 0;
			return composeKey(
				{
					visual: place(icon, 72, 40, 0.9) + cycles,
					info: fitText(72, 98, `-${formatDuration(overtime / 1000, Math.floor)}`, 32, COLORS.danger) + text(72, 121, truncate(name, 17, undefined, true), 17, COLORS.danger),
					bar: progressBar(1, COLORS.danger),
					split: 66,
					background: flash ? "#4a1410" : "#2a0f0c",
				},
				style,
			);
		}
	}
}

function formatDuration(seconds: number, round: (value: number) => number = Math.ceil): string {
	const total = Math.max(0, round(seconds));
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = String(total % 60).padStart(2, "0");
	return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/**
 * Settings for {@link GameTimer}. `endsAt` / `remainingMs` hold the running state.
 */
type TimerSettings = SoundSettings & {
	preset?: string;
	/** Label of versions before 0.3; the Stream Deck title is used instead now. */
	label?: string;
	textOnTop?: boolean;
	/** Custom duration in seconds, or as m:ss / h:mm:ss; the property inspector stores it as a string. */
	duration?: string;
	/** Custom duration in minutes, from versions before 0.7.5 (used when `duration` is empty). */
	minutes?: number | string;
	/** "yes" / "no", or empty to follow the preset. */
	repeat?: string;
	/** Timestamp (ms) at which the running timer ends. */
	endsAt?: number;
	/** Remaining time (ms) of a paused timer. */
	remainingMs?: number;
	/** Completed cycles of a repeating timer. */
	cycles?: number;
};
