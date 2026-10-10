import {
	action,
	type Action,
	type DidReceiveSettingsEvent,
	type KeyDownEvent,
	type KeyUpEvent,
	SingletonAction,
	type WillAppearEvent,
	type WillDisappearEvent,
} from "@elgato/streamdeck";

import { COLORS, keySvg, place, progressBar, text, toDataUrl } from "../svg";
import { getTimerPreset, type TimerPreset, timerIcon } from "../timer-presets";

/** How often running timers are redrawn. */
const TICK_MS = 250;

/** How long the key must be held to reset the timer. */
const LONG_PRESS_MS = 600;

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
	/** Actions already alerted for their current end time. */
	private readonly alerted = new Set<string>();
	private ticker: ReturnType<typeof setInterval> | undefined;

	override async onWillAppear(ev: WillAppearEvent<TimerSettings>): Promise<void> {
		this.settings.set(ev.action.id, ev.payload.settings);
		this.images.delete(ev.action.id);
		this.updateTicker();
		await this.render(ev.action);
	}

	override onWillDisappear(ev: WillDisappearEvent<TimerSettings>): void {
		this.images.delete(ev.action.id);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<TimerSettings>): Promise<void> {
		this.settings.set(ev.action.id, ev.payload.settings);
		this.images.delete(ev.action.id);
		this.updateTicker();
		await this.render(ev.action);
	}

	override onKeyDown(ev: KeyDownEvent<TimerSettings>): void {
		const { action } = ev;
		this.settings.set(action.id, ev.payload.settings);
		this.presses.set(
			action.id,
			setTimeout(async () => {
				this.presses.delete(action.id);
				await this.update(action, { endsAt: undefined, remainingMs: undefined });
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
				await this.update(ev.action, { endsAt: now + duration(settings) * 1000, remainingMs: undefined });
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
		this.alerted.delete(action.id);
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
		// Only visible actions are enumerated; hidden ones are redrawn by onWillAppear.
		for (const action of this.actions) {
			await this.render(action);
		}
	}

	private async render(action: Action<TimerSettings>): Promise<void> {
		if (!action.isKey()) {
			return;
		}

		let settings = this.settings.get(action.id) ?? {};
		const now = Date.now();

		// Repeating timers (in-game day) roll over to the next cycle instead of finishing.
		if (settings.endsAt !== undefined && settings.endsAt <= now && isRepeating(settings)) {
			const cycle = duration(settings) * 1000;
			const endsAt = settings.endsAt + Math.ceil((now - settings.endsAt + 1) / cycle) * cycle;
			settings = { ...settings, endsAt };
			this.settings.set(action.id, settings);
			await action.setSettings(settings);
			await action.showOk();
		}

		if (getPhase(settings, now) === "finished" && !this.alerted.has(action.id)) {
			this.alerted.add(action.id);
			await action.showAlert();
		}

		const image = toDataUrl(renderTimerKey(settings, now));
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

/** Duration in seconds: the custom duration if set, otherwise the preset's. */
function duration(settings: TimerSettings): number {
	const minutes = Number(settings.minutes);
	return settings.minutes !== "" && Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes * 60) : preset(settings).seconds;
}

function isRepeating(settings: TimerSettings): boolean {
	if (settings.repeat === "yes") return true;
	if (settings.repeat === "no") return false;
	return preset(settings).repeat;
}

function label(settings: TimerSettings): string {
	return settings.label?.trim() || preset(settings).label;
}

/**
 * Draws the key of a timer at a given time.
 */
export function renderTimerKey(settings: TimerSettings, now: number): string {
	const icon = timerIcon(preset(settings).id);
	const total = duration(settings);

	switch (getPhase(settings, now)) {
		case "idle":
			return keySvg(
				place(icon, 72, 48, 1.15) +
					text(72, 106, label(settings), 20) +
					text(72, 130, formatDuration(total), 16, COLORS.muted, "normal"),
			);

		case "running": {
			const remaining = (settings.endsAt! - now) / 1000;
			const warning = remaining <= 60;
			return keySvg(
				place(icon, 72, 40, 0.9) +
					text(72, 98, formatDuration(remaining), 30, warning ? COLORS.cooking : COLORS.text) +
					text(72, 120, label(settings), 15, COLORS.teal) +
					progressBar(1 - remaining / total, warning ? COLORS.cooking : COLORS.teal),
			);
		}

		case "paused": {
			const remaining = settings.remainingMs! / 1000;
			return keySvg(
				place(icon, 72, 40, 0.9) +
					text(72, 98, formatDuration(remaining), 30, COLORS.muted) +
					text(72, 120, "PAUSE", 15, COLORS.gold) +
					progressBar(1 - remaining / total, COLORS.muted),
			);
		}

		case "finished": {
			const flash = Math.floor(now / 500) % 2 === 0;
			return keySvg(
				place(icon, 72, 48, 1.15) + text(72, 106, label(settings), 20) + text(72, 130, "TERMINÉ", 16, COLORS.danger),
				flash ? "#4a1410" : COLORS.sea,
			);
		}
	}
}

function formatDuration(seconds: number): string {
	const total = Math.max(0, Math.ceil(seconds));
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = String(total % 60).padStart(2, "0");
	return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/**
 * Settings for {@link GameTimer}. `endsAt` / `remainingMs` hold the running state.
 */
type TimerSettings = {
	preset?: string;
	label?: string;
	/** Custom duration in minutes; the property inspector stores it as a string. */
	minutes?: number | string;
	/** "yes" / "no", or empty to follow the preset. */
	repeat?: string;
	/** Timestamp (ms) at which the running timer ends. */
	endsAt?: number;
	/** Remaining time (ms) of a paused timer. */
	remainingMs?: number;
};
