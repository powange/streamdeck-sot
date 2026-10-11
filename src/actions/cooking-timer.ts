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

import { foodIcon } from "../food-icons";
import { type Food, getFood } from "../foods";
import { playSound, type SoundSettings } from "../sound";
import { cleanTitle, COLORS, composeKey, fitText, type KeyStyle, place, progressBar, text, toDataUrl, truncate } from "../svg";

/** How often running timers are redrawn. */
const TICK_MS = 250;

/** Seconds before burning at which the key starts flashing. */
const WARNING_SECONDS = 10;

/** Seconds after burning at which a forgotten timer resets itself. */
const AUTO_RESET_SECONDS = 300;

type Phase = "idle" | "cooking" | "cooked" | "burnt";

type RunningTimer = {
	startedAt: number;
	phase: Phase;
	/** Whether the "about to burn" warning was given. */
	warned: boolean;
};

/**
 * Cooking timer: press when the food goes on the fire, the key counts down until it is cooked, then until it burns.
 * Press again at any time to stop the timer.
 */
@action({ UUID: "com.powange.seaofthieves.cooking" })
export class CookingTimer extends SingletonAction<CookingSettings> {
	private readonly settings = new Map<string, CookingSettings>();
	private readonly timers = new Map<string, RunningTimer>();
	/** Last image sent per action, to avoid re-sending identical frames. */
	private readonly images = new Map<string, string>();
	private readonly titles = new Map<string, string | undefined>();
	private ticker: ReturnType<typeof setInterval> | undefined;

	override async onWillAppear(ev: WillAppearEvent<CookingSettings>): Promise<void> {
		this.settings.set(ev.action.id, ev.payload.settings);
		this.images.delete(ev.action.id);
		await this.render(ev.action);
	}

	override onWillDisappear(ev: WillDisappearEvent<CookingSettings>): void {
		// Keep the timer running while the key is hidden (page / folder switch), but force a redraw when it comes back.
		this.images.delete(ev.action.id);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<CookingSettings>): Promise<void> {
		this.settings.set(ev.action.id, ev.payload.settings);
		this.images.delete(ev.action.id);
		await this.render(ev.action);
	}

	override async onTitleParametersDidChange(ev: TitleParametersDidChangeEvent<CookingSettings>): Promise<void> {
		this.titles.set(ev.action.id, cleanTitle(ev.payload.title));
		await this.render(ev.action);
	}

	override async onKeyDown(ev: KeyDownEvent<CookingSettings>): Promise<void> {
		const { id } = ev.action;
		if (this.timers.has(id)) {
			this.timers.delete(id);
		} else {
			this.timers.set(id, { startedAt: Date.now(), phase: "cooking", warned: false });
		}

		this.updateTicker();
		await this.render(ev.action);
	}

	private updateTicker(): void {
		if (this.timers.size > 0 && this.ticker === undefined) {
			this.ticker = setInterval(() => void this.tick(), TICK_MS);
		} else if (this.timers.size === 0 && this.ticker !== undefined) {
			clearInterval(this.ticker);
			this.ticker = undefined;
		}
	}

	private async tick(): Promise<void> {
		const now = Date.now();
		for (const [id, timer] of this.timers) {
			if (timer.phase === "burnt" && now - timer.startedAt > (this.timing(id).burnSeconds + AUTO_RESET_SECONDS) * 1000) {
				this.timers.delete(id);
			} else {
				await this.checkTransitions(id, timer, now);
			}
		}

		// Only visible actions are enumerated; hidden ones are redrawn by onWillAppear.
		for (const action of this.actions) {
			await this.render(action);
		}

		this.updateTicker();
	}

	private timing(id: string): Food {
		const settings = this.settings.get(id) ?? {};
		const food = getFood(settings.food);
		const cookSeconds = positive(settings.cookSeconds) ?? food.cookSeconds;
		const burnSeconds = Math.max(positive(settings.burnSeconds) ?? food.burnSeconds, cookSeconds + 1);
		return { ...food, cookSeconds, burnSeconds };
	}

	/**
	 * Plays sounds and visual feedback when a timer changes phase. Runs for every timer, including those on hidden pages.
	 */
	private async checkTransitions(id: string, timer: RunningTimer, now: number): Promise<void> {
		const food = this.timing(id);
		const elapsed = (now - timer.startedAt) / 1000;
		const phase = getPhase(food, elapsed);
		const settings = this.settings.get(id) ?? {};
		const visible = [...this.actions].find((a) => a.id === id);

		if (phase !== timer.phase) {
			timer.phase = phase;
			if (phase === "cooked") {
				playSound("ding", settings);
				if (visible?.isKey()) await visible.showOk();
			} else if (phase === "burnt") {
				playSound("alarm", settings);
				if (visible?.isKey()) await visible.showAlert();
			}
		}

		if (phase === "cooked" && !timer.warned && food.burnSeconds - elapsed <= WARNING_SECONDS) {
			timer.warned = true;
			playSound("warning", settings);
		}
	}

	private async render(action: Action<CookingSettings>): Promise<void> {
		if (!action.isKey()) {
			return;
		}

		const food = this.timing(action.id);
		const timer = this.timers.get(action.id);
		const elapsed = timer ? (Date.now() - timer.startedAt) / 1000 : undefined;

		const settings = this.settings.get(action.id) ?? {};
		const style = { title: this.titles.get(action.id), textOnTop: settings.textOnTop === true };
		const image = toDataUrl(renderCookingKey(food, elapsed, style));
		if (this.images.get(action.id) !== image) {
			this.images.set(action.id, image);
			await action.setImage(image);
		}
	}
}

function getPhase(food: Food, elapsed: number | undefined): Phase {
	if (elapsed === undefined) return "idle";
	if (elapsed < food.cookSeconds) return "cooking";
	if (elapsed < food.burnSeconds) return "cooked";
	return "burnt";
}

/**
 * Draws the key for a food, given the seconds elapsed since it was put on the fire (`undefined` when idle).
 * A title replaces the food name, and the status line while cooking (except the "remove it" warning).
 */
export function renderCookingKey(food: Food, elapsed: number | undefined, style: KeyStyle = {}): string {
	switch (getPhase(food, elapsed)) {
		case "idle":
			return composeKey(
				{
					visual: place(foodIcon(food.id, "raw"), 72, 50, 1.25),
					info: fitText(72, 106, style.title ?? food.label, 24) + text(72, 131, formatDuration(food.cookSeconds), 18, COLORS.muted, "normal"),
					split: 84,
				},
				style,
			);

		case "cooking": {
			const remaining = food.cookSeconds - elapsed!;
			return composeKey(
				{
					visual: place(foodIcon(food.id, "raw"), 72, 40),
					info: fitText(72, 98, formatDuration(remaining), 34) + text(72, 121, truncate(style.title ?? "CUISSON", 17, undefined, true), 17, COLORS.cooking),
					bar: progressBar(elapsed! / food.cookSeconds, COLORS.cooking),
					split: 66,
				},
				style,
			);
		}

		case "cooked": {
			const remaining = food.burnSeconds - elapsed!;
			const warning = remaining <= WARNING_SECONDS;
			const flash = warning && Math.floor(elapsed! * 2) % 2 === 0;
			const status = warning ? "RETIRE !" : (style.title ?? "CUIT !");
			return composeKey(
				{
					visual: place(foodIcon(food.id, "cooked"), 72, 40),
					info:
						fitText(72, 98, formatDuration(remaining), 34, warning ? COLORS.danger : COLORS.text) +
						text(72, 121, truncate(status, 17, undefined, true), 17, warning ? COLORS.danger : COLORS.cooked),
					bar: progressBar(remaining / (food.burnSeconds - food.cookSeconds), warning ? COLORS.danger : COLORS.cooked),
					split: 66,
					background: flash ? "#4a1410" : COLORS.background,
				},
				style,
			);
		}

		case "burnt":
			return composeKey(
				{
					visual: place(foodIcon(food.id, "burnt"), 72, 50, 1.25),
					info: text(72, 112, "BRÛLÉ", 26, COLORS.danger) + (style.title ? text(72, 134, truncate(style.title, 16), 16, COLORS.muted, "normal") : ""),
					split: 86,
					background: COLORS.burnt,
				},
				style,
			);
	}
}

function formatDuration(seconds: number): string {
	const total = Math.max(0, Math.ceil(seconds));
	if (total < 60) {
		return `${total}s`;
	}
	return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function positive(value: unknown): number | undefined {
	const number = Number(value);
	return value !== "" && value !== undefined && Number.isFinite(number) && number > 0 ? number : undefined;
}

/**
 * Settings for {@link CookingTimer}. Times are optional overrides of the food's defaults; the property inspector stores
 * them as strings.
 */
type CookingSettings = SoundSettings & {
	textOnTop?: boolean;
	food?: string;
	cookSeconds?: number | string;
	burnSeconds?: number | string;
};
