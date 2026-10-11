import { action, type Action, type DidReceiveSettingsEvent, type KeyDownEvent, type KeyUpEvent } from "@elgato/streamdeck";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { type ProgressItem } from "../api/progress";
import { clearProfile, getBalance } from "../api/sot";
import { getGlobalSettings, onGlobalSettingsChanged } from "../global-settings";
import { type Currency, currencyIcon } from "../progress-icons";
import { ProgressAction, type ProgressSettings } from "./progress-action";

/** How long the key must be held to start a new session. */
const LONG_PRESS_MS = 600;

/** Currency icons of the seaofthieves.com profile, bundled in the plugin's imgs/currencies folder. */
const CURRENCY_IMAGES: Record<Currency, string> = {
	gold: "gold.png",
	doubloons: "doubloons.png",
	ancientCoins: "ancient-coins.png",
};

const CURRENCY_LABELS: Record<Currency, string> = {
	gold: "Or",
	doubloons: "Doublons",
	ancientCoins: "Pièces anciennes",
};

type BalanceSettings = ProgressSettings & {
	currency?: string;
	/** "total" (default), "session" (gains since a session started with a long press) or "game" (gains since the
	 * game was launched). */
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
	private lastGameSession: number | undefined;

	constructor() {
		super();
		onGlobalSettingsChanged(async (settings) => {
			const gameSession = settings.gameSession?.startedAt;
			if (settings.ratCookie !== this.lastToken) {
				this.lastToken = settings.ratCookie;
				clearProfile();
			} else if (gameSession === this.lastGameSession) {
				return;
			}
			this.lastGameSession = gameSession;
			await this.refreshAll();
		});
	}

	protected override placeholderFor(settings: BalanceSettings): [string, string] {
		return settings.mode === "game" ? ["Lance", "le jeu"] : this.placeholder;
	}

	protected override async fetchItem(settings: BalanceSettings, force: boolean): Promise<ProgressItem | undefined> {
		const currency = toCurrency(settings.currency);

		// Starting point of the gains, if the key shows gains.
		let start: { amount: number; at: number } | undefined;
		if (settings.mode === "session") {
			if (settings.sessionStart === undefined) return undefined;
			start = { amount: settings.sessionStart, at: settings.sessionStartedAt ?? 0 };
		} else if (settings.mode === "game") {
			const session = (await getGlobalSettings()).gameSession;
			if (!session) return undefined;
			start = { amount: session[currency], at: session.startedAt };
		}

		const balance = await getBalance(force);
		const amount = balance[currency];
		const isDoubloons = currency === "doubloons" && balance.doubloonsLimit > 0;

		return {
			id: currency,
			name: CURRENCY_LABELS[currency],
			description: "",
			badge: start ? formatClock(start.at) : undefined,
			current: amount,
			target: isDoubloons ? balance.doubloonsLimit : 0,
			completed: false,
			icon: currencyIcon(currency),
			imageData: await loadCurrencyImage(currency),
			valueText: start ? formatSigned(amount - start.amount) : formatAmount(amount),
			noBar: start !== undefined || !isDoubloons,
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

const currencyImages = new Map<Currency, Promise<string | undefined>>();

/**
 * Reads the bundled currency icon as a data URL, or `undefined` (the drawn icon is used instead) if it is missing.
 */
function loadCurrencyImage(currency: Currency): Promise<string | undefined> {
	let image = currencyImages.get(currency);
	if (!image) {
		// The plugin runs from its .sdPlugin folder.
		image = readFile(path.resolve("imgs", "currencies", CURRENCY_IMAGES[currency]))
			.then((data) => `data:image/png;base64,${data.toString("base64")}`)
			.catch(() => undefined);
		currencyImages.set(currency, image);
	}
	return image;
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
