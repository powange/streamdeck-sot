import { action, type Action, type DidReceiveSettingsEvent, type KeyDownEvent, type KeyUpEvent } from "@elgato/streamdeck";

import { type ProgressItem } from "../api/progress";
import { clearProfile, getBalance } from "../api/sot";
import { onGlobalSettingsChanged } from "../global-settings";
import { type Currency, currencyIcon } from "../progress-icons";
import { ProgressAction, type ProgressSettings } from "./progress-action";

/** How long the key must be held to start a new session. */
const LONG_PRESS_MS = 600;

const CURRENCY_LABELS: Record<Currency, string> = {
	gold: "Or",
	doubloons: "Doublons",
	ancientCoins: "Pièces anciennes",
};

type BalanceSettings = ProgressSettings & {
	currency?: string;
	/** "total" (default) or "session" (gains since the session start). */
	mode?: string;
	/** Amount of the currency when the session started. */
	sessionStart?: number;
	/** Timestamp (ms) of the session start. */
	sessionStartedAt?: number;
};

/**
 * Shows the gold, doubloons or ancient coins of the seaofthieves.com profile, either in total or as the gains since
 * the start of the session. Press to refresh; in session mode, hold to start a new session.
 */
@action({ UUID: "com.powange.seaofthieves.balance" })
export class BalanceProgress extends ProgressAction<BalanceSettings> {
	protected override readonly fallbackIcon = currencyIcon("gold");
	protected override readonly placeholder: [string, string] = ["Appui long", "pour démarrer"];

	private readonly presses = new Map<string, ReturnType<typeof setTimeout>>();
	private lastToken: string | undefined;

	constructor() {
		super();
		onGlobalSettingsChanged(async (settings) => {
			if (settings.ratCookie === this.lastToken) return;
			this.lastToken = settings.ratCookie;
			clearProfile();
			await this.refreshAll();
		});
	}

	protected override async fetchItem(settings: BalanceSettings, force: boolean): Promise<ProgressItem | undefined> {
		const currency = toCurrency(settings.currency);
		const session = settings.mode === "session";
		if (session && settings.sessionStart === undefined) {
			// Nothing to show until a session is started.
			return undefined;
		}

		const balance = await getBalance(force);
		const amount = balance[currency];
		const isDoubloons = currency === "doubloons" && balance.doubloonsLimit > 0;

		return {
			id: currency,
			name: CURRENCY_LABELS[currency],
			description: "",
			badge: session ? formatClock(settings.sessionStartedAt) : undefined,
			current: amount,
			target: isDoubloons ? balance.doubloonsLimit : 0,
			completed: false,
			icon: currencyIcon(currency),
			valueText: session ? formatSigned(amount - settings.sessionStart!) : formatAmount(amount),
			noBar: session || !isDoubloons,
		};
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<BalanceSettings>): Promise<void> {
		const previous = this.currentSettings(ev.action.id);
		const settings = ev.payload.settings;
		// The session start amount belongs to the previous currency.
		if (previous && previous.currency !== settings.currency && settings.sessionStart !== undefined) {
			const { sessionStart: _amount, sessionStartedAt: _time, ...rest } = settings;
			await this.saveSettings(ev.action, rest);
			return;
		}
		await super.onDidReceiveSettings(ev);
	}

	override async onKeyDown(ev: KeyDownEvent<BalanceSettings>): Promise<void> {
		const { action } = ev;
		const settings = ev.payload.settings;
		if (settings.mode !== "session") {
			// No long press in total mode: refresh on key up.
			return;
		}

		this.presses.set(
			action.id,
			setTimeout(async () => {
				this.presses.delete(action.id);
				await this.startSession(action, settings);
			}, LONG_PRESS_MS),
		);
	}

	override async onKeyUp(ev: KeyUpEvent<BalanceSettings>): Promise<void> {
		const pending = this.presses.get(ev.action.id);
		if (ev.payload.settings.mode === "session" && pending === undefined) {
			// The long press already started a session.
			return;
		}
		clearTimeout(pending);
		this.presses.delete(ev.action.id);

		const ok = await this.refresh(ev.action, true);
		if (ev.action.isKey()) {
			await (ok ? ev.action.showOk() : ev.action.showAlert());
		}
	}

	private async startSession(action: Action<BalanceSettings>, settings: BalanceSettings): Promise<void> {
		try {
			const balance = await getBalance(true);
			await this.saveSettings(action, {
				...settings,
				sessionStart: balance[toCurrency(settings.currency)],
				sessionStartedAt: Date.now(),
			});
			if (action.isKey()) await action.showOk();
		} catch {
			// The key already shows the error after the refresh below.
			await this.refresh(action, false);
			if (action.isKey()) await action.showAlert();
		}
	}
}

function toCurrency(value: string | undefined): Currency {
	return value === "doubloons" || value === "ancientCoins" ? value : "gold";
}

/** Formats an amount with spaces between thousands (regular spaces, which every font has). */
function formatAmount(value: number): string {
	return Math.round(value)
		.toString()
		.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function formatSigned(value: number): string {
	return `${value >= 0 ? "+" : "−"}${formatAmount(Math.abs(value))}`;
}

/** Local time of the session start, shown in the corner. */
function formatClock(timestamp: number | undefined): string | undefined {
	if (!timestamp) return undefined;
	const date = new Date(timestamp);
	return `${date.getHours()}h${String(date.getMinutes()).padStart(2, "0")}`;
}
