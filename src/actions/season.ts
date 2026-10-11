import { action } from "@elgato/streamdeck";

import { type ProgressItem } from "../api/progress";
import { clearProfile, getSeasonProgress } from "../api/sot";
import { onGlobalSettingsChanged } from "../global-settings";
import { seasonIcon } from "../progress-icons";
import { ProgressAction, type ProgressSettings } from "./progress-action";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Shows the renown level reached in the current season, from the seaofthieves.com profile. Press to refresh.
 */
@action({ UUID: "com.powange.seaofthieves.season" })
export class SeasonProgressAction extends ProgressAction<ProgressSettings> {
	protected override readonly fallbackIcon = seasonIcon();
	protected override readonly placeholder: [string, string] = ["Aucune", "saison"];

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

	protected override async fetchItem(_settings: ProgressSettings, force: boolean): Promise<ProgressItem | undefined> {
		const season = await getSeasonProgress(force);
		if (!season) return undefined;

		const daysLeft = season.endsAt === undefined ? undefined : Math.ceil((season.endsAt - Date.now()) / DAY_MS);
		return {
			id: season.title,
			name: season.title,
			description: `Palier ${season.tier}`,
			// Days left before the end of the season, in the corner.
			badge: daysLeft !== undefined && daysLeft > 0 ? `${daysLeft} j` : undefined,
			current: season.level,
			target: season.maxLevel,
			completed: season.level >= season.maxLevel,
			valueText: `Niv. ${season.level} / ${season.maxLevel}`,
		};
	}
}
