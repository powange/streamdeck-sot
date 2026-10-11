import streamDeck, { action, type SendToPluginEvent } from "@elgato/streamdeck";
import type { JsonValue } from "@elgato/utils";

import { type ProgressItem } from "../api/progress";
import { clearProfile, type FactionLevel, getFactionLevels } from "../api/sot";
import { onGlobalSettingsChanged } from "../global-settings";
import { factionIcon } from "../progress-icons";
import { errorMessage, type ListItem, ProgressAction, type ProgressSettings } from "./progress-action";

/**
 * Shows the level of a trading company, faction or guild from the seaofthieves.com profile, with the progress towards
 * the next level. Press to refresh.
 */
@action({ UUID: "com.powange.seaofthieves.faction-level" })
export class FactionLevelProgress extends ProgressAction<ProgressSettings> {
	protected override readonly fallbackIcon = factionIcon("");
	protected override readonly placeholder: [string, string] = ["Choisir une", "faction"];

	private lastToken: string | undefined;

	constructor() {
		super();
		onGlobalSettingsChanged(async (settings) => {
			if (settings.ratCookie === this.lastToken) return;
			this.lastToken = settings.ratCookie;
			clearProfile();
			await this.refreshAll();
			await this.sendList("getFactionLevels", await buildList());
		});
	}

	protected override async fetchItem(settings: ProgressSettings, force: boolean): Promise<ProgressItem | undefined> {
		if (!settings.itemId) return undefined;
		const faction = (await getFactionLevels(force)).find((f) => f.key === settings.itemId);
		return faction && toItem(faction);
	}

	override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, ProgressSettings>): Promise<void> {
		if ((ev.payload as { event?: string } | null)?.event === "getFactionLevels") {
			await this.sendList("getFactionLevels", await buildList());
		}
	}
}

function toItem(faction: FactionLevel): ProgressItem {
	return {
		id: faction.key,
		name: faction.shortLabel,
		description: faction.rank ?? "",
		badge: faction.distinction > 0 ? `D${faction.distinction}` : undefined,
		current: Math.round(faction.progress * 100),
		target: 100,
		completed: false,
		icon: factionIcon(faction.key, faction.isGuild),
		valueText: `Niv. ${faction.level}`,
	};
}

async function buildList(): Promise<ListItem[]> {
	try {
		const factions = await getFactionLevels();
		const option = (f: FactionLevel): ListItem => ({ label: `${f.label} (niv. ${f.level})`, value: f.key });
		const companies = factions.filter((f) => !f.isGuild).map(option);
		const guilds = factions.filter((f) => f.isGuild).map(option);
		return guilds.length > 0 ? [{ label: "Factions", children: companies }, { label: "Guildes", children: guilds }] : companies;
	} catch (error) {
		streamDeck.logger.warn(`Cannot list factions: ${error instanceof Error ? error.message : error}`);
		return [{ label: `⚠ ${errorMessage(error).join(" ")}`, value: "", disabled: true }];
	}
}
