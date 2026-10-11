import {
	action,
	type Action,
	type DidReceiveSettingsEvent,
	type KeyDownEvent,
	type KeyUpEvent,
	SingletonAction,
	type TitleParametersDidChangeEvent,
	type WillAppearEvent,
} from "@elgato/streamdeck";

import { COUNTER_LABELS, counterIcon, type CounterKind, isCounterKind } from "../counter-icons";
import { cleanTitle, COLORS, composeKey, type KeyStyle, place, text, toDataUrl } from "../svg";

/** How long the key must be held to reset the counter. */
const LONG_PRESS_MS = 600;

/**
 * Session counter: press to add one, hold to reset to zero.
 */
@action({ UUID: "com.powange.seaofthieves.counter" })
export class SessionCounter extends SingletonAction<CounterSettings> {
	/** Pending long-press timeouts, per action. */
	private readonly presses = new Map<string, ReturnType<typeof setTimeout>>();
	private readonly titles = new Map<string, string | undefined>();

	override async onWillAppear(ev: WillAppearEvent<CounterSettings>): Promise<void> {
		await this.render(ev.action, ev.payload.settings);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<CounterSettings>): Promise<void> {
		await this.render(ev.action, ev.payload.settings);
	}

	override async onTitleParametersDidChange(ev: TitleParametersDidChangeEvent<CounterSettings>): Promise<void> {
		this.titles.set(ev.action.id, cleanTitle(ev.payload.title));
		await this.render(ev.action, ev.payload.settings);
	}

	override onKeyDown(ev: KeyDownEvent<CounterSettings>): void {
		const { action } = ev;
		const settings = ev.payload.settings;
		this.presses.set(
			action.id,
			setTimeout(async () => {
				this.presses.delete(action.id);
				settings.count = 0;
				await action.setSettings(settings);
				await this.render(action, settings);
				if (action.isKey()) {
					await action.showOk();
				}
			}, LONG_PRESS_MS),
		);
	}

	override async onKeyUp(ev: KeyUpEvent<CounterSettings>): Promise<void> {
		const pending = this.presses.get(ev.action.id);
		if (pending === undefined) {
			// The long press already reset the counter.
			return;
		}

		clearTimeout(pending);
		this.presses.delete(ev.action.id);

		const settings = ev.payload.settings;
		settings.count = (Number(settings.count) || 0) + 1;
		await ev.action.setSettings(settings);
		await this.render(ev.action, settings);
	}

	private async render(action: Action<CounterSettings>, settings: CounterSettings): Promise<void> {
		if (action.isKey()) {
			const style = { title: this.titles.get(action.id), textOnTop: settings.textOnTop === true };
			await action.setImage(toDataUrl(renderCounterKey(settings, style)));
		}
	}
}

export function renderCounterKey(settings: CounterSettings, style: KeyStyle = {}): string {
	const kind: CounterKind = isCounterKind(settings.kind) ? settings.kind : "chest";
	// The Stream Deck title, else the label of versions before 0.3, else the icon name.
	const label = style.title ?? (settings.label?.trim() || COUNTER_LABELS[kind]);
	const count = Number(settings.count) || 0;
	return composeKey(
		{
			visual: place(counterIcon(kind), 72, 38),
			info: text(72, 104, String(count), 40) + text(72, 130, label, 16, COLORS.muted, "normal"),
			split: 66,
		},
		style,
	);
}

/**
 * Settings for {@link SessionCounter}.
 */
type CounterSettings = {
	kind?: string;
	/** Label of versions before 0.3; the Stream Deck title is used instead now. */
	label?: string;
	textOnTop?: boolean;
	count?: number;
};
