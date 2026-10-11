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

import { cleanTitle, COLORS, composeKey, fitText, type KeyStyle, place, text, toDataUrl, truncate } from "../svg";
import { stopwatchIcon } from "../timer-presets";

/** How often running stopwatches are redrawn. */
const TICK_MS = 250;

/** How long the key must be held to reset the stopwatch. */
const LONG_PRESS_MS = 600;

type Phase = "idle" | "running" | "paused";

/**
 * Stopwatch: press to start / pause / resume, hold to reset. The start time is stored in the key settings, so a
 * running stopwatch survives a Stream Deck restart.
 */
@action({ UUID: "com.powange.seaofthieves.stopwatch" })
export class Stopwatch extends SingletonAction<StopwatchSettings> {
	private readonly settings = new Map<string, StopwatchSettings>();
	private readonly presses = new Map<string, ReturnType<typeof setTimeout>>();
	private readonly titles = new Map<string, string | undefined>();
	/** Last image sent per action, to avoid re-sending identical frames. */
	private readonly images = new Map<string, string>();
	private ticker: ReturnType<typeof setInterval> | undefined;

	override async onWillAppear(ev: WillAppearEvent<StopwatchSettings>): Promise<void> {
		this.settings.set(ev.action.id, ev.payload.settings);
		this.images.delete(ev.action.id);
		this.updateTicker();
		await this.render(ev.action);
	}

	override onWillDisappear(ev: WillDisappearEvent<StopwatchSettings>): void {
		this.images.delete(ev.action.id);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<StopwatchSettings>): Promise<void> {
		this.settings.set(ev.action.id, ev.payload.settings);
		this.images.delete(ev.action.id);
		this.updateTicker();
		await this.render(ev.action);
	}

	override async onTitleParametersDidChange(ev: TitleParametersDidChangeEvent<StopwatchSettings>): Promise<void> {
		this.titles.set(ev.action.id, cleanTitle(ev.payload.title));
		this.images.delete(ev.action.id);
		await this.render(ev.action);
	}

	override onKeyDown(ev: KeyDownEvent<StopwatchSettings>): void {
		const { action } = ev;
		this.settings.set(action.id, ev.payload.settings);
		this.presses.set(
			action.id,
			setTimeout(async () => {
				this.presses.delete(action.id);
				await this.update(action, { startedAt: undefined, elapsedMs: undefined });
				if (action.isKey()) await action.showOk();
			}, LONG_PRESS_MS),
		);
	}

	override async onKeyUp(ev: KeyUpEvent<StopwatchSettings>): Promise<void> {
		const pending = this.presses.get(ev.action.id);
		if (pending === undefined) {
			// The long press already reset the stopwatch.
			return;
		}
		clearTimeout(pending);
		this.presses.delete(ev.action.id);

		const settings = this.settings.get(ev.action.id) ?? ev.payload.settings;
		const now = Date.now();
		switch (getPhase(settings)) {
			case "idle":
				await this.update(ev.action, { startedAt: now, elapsedMs: undefined });
				break;
			case "running":
				await this.update(ev.action, { startedAt: undefined, elapsedMs: now - settings.startedAt! });
				break;
			case "paused":
				await this.update(ev.action, { startedAt: now - settings.elapsedMs!, elapsedMs: undefined });
				break;
		}
	}

	private async update(action: Action<StopwatchSettings>, changes: Partial<StopwatchSettings>): Promise<void> {
		const settings = { ...(this.settings.get(action.id) ?? {}), ...changes };
		// JSON settings cannot hold undefined values.
		for (const key of Object.keys(changes) as (keyof StopwatchSettings)[]) {
			if (settings[key] === undefined) delete settings[key];
		}
		this.settings.set(action.id, settings);
		await action.setSettings(settings);
		this.updateTicker();
		await this.render(action);
	}

	private updateTicker(): void {
		const running = [...this.settings.values()].some((s) => s.startedAt !== undefined);
		if (running && this.ticker === undefined) {
			this.ticker = setInterval(() => void this.tick(), TICK_MS);
		} else if (!running && this.ticker !== undefined) {
			clearInterval(this.ticker);
			this.ticker = undefined;
		}
	}

	private async tick(): Promise<void> {
		for (const action of this.actions) {
			await this.render(action);
		}
	}

	private async render(action: Action<StopwatchSettings>): Promise<void> {
		if (!action.isKey()) {
			return;
		}

		const settings = this.settings.get(action.id) ?? {};
		const style = { title: this.titles.get(action.id), textOnTop: settings.textOnTop === true };
		const image = toDataUrl(renderStopwatchKey(settings, Date.now(), style));
		if (this.images.get(action.id) !== image) {
			this.images.set(action.id, image);
			await action.setImage(image);
		}
	}
}

function getPhase(settings: StopwatchSettings): Phase {
	if (settings.startedAt !== undefined) return "running";
	if (settings.elapsedMs !== undefined) return "paused";
	return "idle";
}

/**
 * Draws the key of a stopwatch at a given time.
 */
export function renderStopwatchKey(settings: StopwatchSettings, now: number, style: KeyStyle = {}): string {
	const name = style.title ?? "Chrono";

	switch (getPhase(settings)) {
		case "idle":
			return composeKey(
				{
					visual: place(stopwatchIcon(), 72, 46, 1.1),
					info: fitText(72, 106, name, 22) + text(72, 131, "0:00", 18, COLORS.muted, "normal"),
					split: 82,
				},
				style,
			);

		case "running":
			return composeKey(
				{
					visual: place(stopwatchIcon(), 72, 40, 0.9),
					info: fitText(72, 100, formatElapsed(now - settings.startedAt!), 32) + text(72, 126, truncate(name, 17, undefined, true), 17, COLORS.teal),
					split: 68,
				},
				style,
			);

		case "paused":
			return composeKey(
				{
					visual: place(stopwatchIcon(), 72, 40, 0.9),
					info: fitText(72, 100, formatElapsed(settings.elapsedMs!), 32, COLORS.muted) + text(72, 126, truncate(style.title ?? "PAUSE", 17, undefined, true), 17, COLORS.gold),
					split: 68,
				},
				style,
			);
	}
}

function formatElapsed(ms: number): string {
	const total = Math.max(0, Math.floor(ms / 1000));
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = String(total % 60).padStart(2, "0");
	return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/**
 * Settings for {@link Stopwatch}: `startedAt` while running, `elapsedMs` while paused.
 */
type StopwatchSettings = {
	textOnTop?: boolean;
	/** Timestamp (ms) at which the stopwatch would have started had it never been paused. */
	startedAt?: number;
	/** Elapsed time (ms) of a paused stopwatch. */
	elapsedMs?: number;
};
