import streamDeck, {
	type Action,
	type DidReceiveSettingsEvent,
	type KeyDownEvent,
	SingletonAction,
	type TitleParametersDidChangeEvent,
	type WillAppearEvent,
	type WillDisappearEvent,
} from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";

import { ApiError, type ProgressItem } from "../api/progress";
import { cleanTitle, COLORS, composeKey, image, type KeyStyle, place, progressBar, text, toDataUrl, wrapLines } from "../svg";

export type ProgressSettings = JsonObject & {
	itemId?: string;
	/** Automatic refresh interval in minutes; 0 or empty disables it. */
	refreshMinutes?: number | string;
	textOnTop?: boolean;
};

/** Item shown in an sdpi-select data source. */
export type ListItem = { label: string; value: string; disabled?: boolean } | { label: string; children: ListItem[] };

/**
 * Base for keys displaying the progress of a single item (commendation, achievement). Pressing the key refreshes it.
 */
export abstract class ProgressAction<T extends ProgressSettings> extends SingletonAction<T> {
	/** Icon drawn when the item has no image (yet). */
	protected abstract readonly fallbackIcon: string;
	/** Text shown when nothing is selected yet. */
	protected abstract readonly placeholder: [string, string];
	/** Minimum automatic refresh interval, to respect API limits. */
	protected readonly minRefreshMinutes: number = 5;

	private readonly settings = new Map<string, T>();
	private readonly refreshTimers = new Map<string, ReturnType<typeof setInterval>>();
	private readonly titles = new Map<string, string | undefined>();

	/** Loads the item configured on a key, or `undefined` if none is selected. */
	protected abstract fetchItem(settings: T, force: boolean): Promise<ProgressItem | undefined>;

	override async onWillAppear(ev: WillAppearEvent<T>): Promise<void> {
		this.settings.set(ev.action.id, ev.payload.settings);
		this.scheduleRefresh(ev.action, ev.payload.settings);
		await this.refresh(ev.action, false);
	}

	override onWillDisappear(ev: WillDisappearEvent<T>): void {
		this.settings.delete(ev.action.id);
		clearInterval(this.refreshTimers.get(ev.action.id));
		this.refreshTimers.delete(ev.action.id);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<T>): Promise<void> {
		this.settings.set(ev.action.id, ev.payload.settings);
		this.scheduleRefresh(ev.action, ev.payload.settings);
		await this.refresh(ev.action, false);
	}

	override async onTitleParametersDidChange(ev: TitleParametersDidChangeEvent<T>): Promise<void> {
		this.titles.set(ev.action.id, cleanTitle(ev.payload.title));
		await this.refresh(ev.action, false);
	}

	override async onKeyDown(ev: KeyDownEvent<T>): Promise<void> {
		this.settings.set(ev.action.id, ev.payload.settings);
		const ok = await this.refresh(ev.action, true);
		if (ev.action.isKey()) {
			await (ok ? ev.action.showOk() : ev.action.showAlert());
		}
	}

	/**
	 * Redraws every visible key, e.g. after the credentials changed.
	 */
	protected async refreshAll(): Promise<void> {
		for (const action of this.actions) {
			await this.refresh(action, false);
		}
	}

	/**
	 * Sends a data source result to the property inspector, if it is currently showing one of this action's keys.
	 */
	protected async sendList(event: string, items: ListItem[]): Promise<void> {
		if (streamDeck.ui.action?.manifestId === this.manifestId) {
			await streamDeck.ui.sendToPropertyInspector({ event, items });
		}
	}

	protected currentSettings(id: string): T | undefined {
		return this.settings.get(id);
	}

	private scheduleRefresh(action: Action<T>, settings: T): void {
		clearInterval(this.refreshTimers.get(action.id));
		this.refreshTimers.delete(action.id);

		const minutes = Number(settings.refreshMinutes) || 0;
		if (minutes > 0) {
			const interval = Math.max(minutes, this.minRefreshMinutes) * 60_000;
			this.refreshTimers.set(
				action.id,
				setInterval(() => void this.refresh(action, true), interval),
			);
		}
	}

	/**
	 * Fetches the item of a key and draws it. Returns `false` when it failed.
	 */
	private async refresh(action: Action<T>, force: boolean): Promise<boolean> {
		if (!action.isKey()) {
			return false;
		}

		const settings = this.settings.get(action.id) ?? ({} as T);
		const style: KeyStyle = { title: this.titles.get(action.id), textOnTop: settings.textOnTop === true };
		try {
			const item = await this.fetchItem(settings, force);
			if (!item) {
				await action.setImage(toDataUrl(renderMessageKey(this.fallbackIcon, ...this.placeholder, style)));
				return false;
			}

			const picture = item.imageUrl ? await loadImage(item.imageUrl) : undefined;
			await action.setImage(toDataUrl(renderProgressKey(item, picture, this.fallbackIcon, style)));
			return true;
		} catch (error) {
			streamDeck.logger.warn(`Refresh failed for ${this.manifestId}: ${error instanceof Error ? error.message : error}`);
			await action.setImage(toDataUrl(renderMessageKey(this.fallbackIcon, ...errorMessage(error), style)));
			return false;
		}
	}
}

export function errorMessage(error: unknown): [string, string] {
	if (error instanceof ApiError) {
		switch (error.kind) {
			case "missing-credentials":
				return ["Connexion", "à configurer"];
			case "auth":
				return ["Connexion", "expirée"];
			case "rate-limit":
				return ["Trop de", "requêtes"];
			case "http":
				return ["Erreur", error.message];
		}
	}
	return ["Erreur", "réseau"];
}

const images = new Map<string, Promise<string | undefined>>();

/**
 * Downloads an image once and returns it as a data URL, or `undefined` if it cannot be loaded.
 */
function loadImage(url: string): Promise<string | undefined> {
	let pending = images.get(url);
	if (!pending) {
		pending = fetch(url)
			.then(async (response) => {
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				const type = response.headers.get("content-type") ?? "image/png";
				return `data:${type};base64,${Buffer.from(await response.arrayBuffer()).toString("base64")}`;
			})
			.catch(() => {
				images.delete(url);
				return undefined;
			});
		images.set(url, pending);
	}
	return pending;
}

/**
 * Draws a progress key: image, name on two lines (or the Stream Deck title), value and progress bar.
 */
export function renderProgressKey(item: ProgressItem, picture: string | undefined, fallbackIcon: string, style: KeyStyle = {}): string {
	const lines = wrapLines(style.title ?? item.name, 16, 2);
	const ratio = item.target > 0 ? item.current / item.target : item.completed ? 1 : 0;
	const color = item.completed ? COLORS.cooked : COLORS.teal;

	return composeKey(
		{
			visual:
				(picture ? image(picture, 44, 4, 56) : place(item.icon ?? fallbackIcon, 72, 34)) +
				(item.badge ? text(138, 18, item.badge, 14, COLORS.gold, "bold", "end") : ""),
			info:
				lines.map((line, i) => text(72, (lines.length === 1 ? 84 : 76) + i * 16, line, 14)).join("") +
				text(72, 121, item.valueText ?? (item.completed ? "TERMINÉ" : `${compact(item.current)} / ${compact(item.target)}`), 16, item.completed ? COLORS.cooked : COLORS.text),
			bar: progressBar(ratio, color),
			split: 62,
		},
		style,
	);
}

export function renderMessageKey(icon: string, line1: string, line2: string, style: KeyStyle = {}): string {
	return composeKey(
		{
			visual: place(icon, 72, 40),
			info: text(72, 98, line1, 16) + text(72, 120, line2, 16, COLORS.muted, "normal"),
			split: 66,
		},
		style,
	);
}

function compact(value: number): string {
	if (value >= 1_000_000) return `${+(value / 1_000_000).toFixed(1)}M`;
	if (value >= 10_000) return `${+(value / 1000).toFixed(1)}k`;
	return String(value);
}
