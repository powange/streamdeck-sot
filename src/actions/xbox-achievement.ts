import { action, type SendToPluginEvent } from "@elgato/streamdeck";
import type { JsonValue } from "@elgato/utils";

import { type ProgressItem } from "../api/progress";
import { clearAchievements, getAchievements } from "../api/xbox";
import { onGlobalSettingsChanged } from "../global-settings";
import { trophyIcon } from "../progress-icons";
import { errorMessage, type ListItem, ProgressAction, type ProgressSettings } from "./progress-action";

/**
 * Shows the progress of a Sea of Thieves Xbox achievement, through the OpenXBL API. Press to refresh.
 */
@action({ UUID: "com.powange.seaofthieves.xbox-achievement" })
export class XboxAchievementProgress extends ProgressAction<ProgressSettings> {
	protected override readonly fallbackIcon = trophyIcon();
	protected override readonly placeholder: [string, string] = ["Choisir un", "succès"];
	// OpenXBL free plan: ~150 requests per hour.
	protected override readonly minRefreshMinutes = 15;

	private lastKey: string | undefined;

	constructor() {
		super();
		onGlobalSettingsChanged(async (settings) => {
			if (settings.xblApiKey === this.lastKey) return;
			this.lastKey = settings.xblApiKey;
			clearAchievements();
			await this.refreshAll();
			await this.sendList("getAchievements", await buildList());
		});
	}

	protected override async fetchItem(settings: ProgressSettings, force: boolean): Promise<ProgressItem | undefined> {
		if (!settings.itemId) return undefined;
		const achievements = await getAchievements(force);
		return achievements.find((a) => a.id === settings.itemId);
	}

	override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, ProgressSettings>): Promise<void> {
		if ((ev.payload as { event?: string } | null)?.event === "getAchievements") {
			await this.sendList("getAchievements", await buildList());
		}
	}
}

async function buildList(): Promise<ListItem[]> {
	try {
		const achievements = await getAchievements();
		const option = (a: ProgressItem): ListItem => ({
			label: a.completed ? `✔ ${a.name}` : a.target > 1 ? `${a.name} (${a.current}/${a.target})` : a.name,
			value: a.id,
		});
		const sorted = [...achievements].sort((a, b) => a.name.localeCompare(b.name, "fr"));
		return [
			{ label: "À débloquer", children: sorted.filter((a) => !a.completed).map(option) },
			{ label: "Débloqués", children: sorted.filter((a) => a.completed).map(option) },
		];
	} catch (error) {
		return [{ label: `⚠ ${errorMessage(error).join(" ")}`, value: "", disabled: true }];
	}
}
