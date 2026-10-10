import { action, type Action, type DidReceiveSettingsEvent, type KeyDownEvent, type KeyUpEvent, SingletonAction, type WillAppearEvent } from "@elgato/streamdeck";

import { COUNTER_LABELS, counterIcon, type CounterKind, isCounterKind } from "../counter-icons";
import { COLORS, keySvg, place, text, toDataUrl } from "../svg";

/** How long the key must be held to reset the counter. */
const LONG_PRESS_MS = 600;

/**
 * Session counter: press to add one, hold to reset to zero.
 */
@action({ UUID: "com.powange.seaofthieves.counter" })
export class SessionCounter extends SingletonAction<CounterSettings> {
	/** Pending long-press timeouts, per action. */
	private readonly presses = new Map<string, ReturnType<typeof setTimeout>>();

	override async onWillAppear(ev: WillAppearEvent<CounterSettings>): Promise<void> {
		await render(ev.action, ev.payload.settings);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<CounterSettings>): Promise<void> {
		await render(ev.action, ev.payload.settings);
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
				await render(action, settings);
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
		await render(ev.action, settings);
	}
}

async function render(action: Action<CounterSettings>, settings: CounterSettings): Promise<void> {
	if (action.isKey()) {
		await action.setImage(toDataUrl(renderCounterKey(settings)));
	}
}

export function renderCounterKey(settings: CounterSettings): string {
	const kind: CounterKind = isCounterKind(settings.kind) ? settings.kind : "chest";
	const label = settings.label?.trim() || COUNTER_LABELS[kind];
	const count = Number(settings.count) || 0;
	return keySvg(
		place(counterIcon(kind), 72, 38) + text(72, 104, String(count), 40) + text(72, 130, label, 16, COLORS.muted, "normal"),
	);
}

/**
 * Settings for {@link SessionCounter}.
 */
type CounterSettings = {
	kind?: string;
	label?: string;
	count?: number;
};
