import streamDeck, { action, type DidReceiveSettingsEvent, type SendToPluginEvent } from "@elgato/streamdeck";
import type { JsonValue } from "@elgato/utils";

import { type ProgressItem } from "../api/progress";
import { clearProfile, type Commendation, getCommendations } from "../api/sot";
import { onGlobalSettingsChanged } from "../global-settings";
import { medalIcon } from "../progress-icons";
import { errorMessage, type ListItem, ProgressAction, type ProgressSettings } from "./progress-action";

type CommendationSettings = ProgressSettings & {
	faction?: string;
	campaign?: string;
};

/**
 * Shows the progress of a commendation from the seaofthieves.com pirate profile. Press to refresh.
 * The property inspector chains three lists: faction, then campaign (when the faction has some), then commendation.
 */
@action({ UUID: "com.powange.seaofthieves.commendation" })
export class CommendationProgress extends ProgressAction<CommendationSettings> {
	protected override readonly fallbackIcon = medalIcon();
	protected override readonly placeholder: [string, string] = ["Choisir une", "commendation"];

	private lastToken: string | undefined;

	constructor() {
		super();
		onGlobalSettingsChanged(async (settings) => {
			if (settings.ratCookie === this.lastToken) return;
			this.lastToken = settings.ratCookie;
			clearProfile();
			await this.refreshAll();
			await this.sendAllLists();
		});
	}

	protected override async fetchItem(settings: CommendationSettings, force: boolean): Promise<ProgressItem | undefined> {
		if (!settings.itemId) return undefined;
		const commendations = await getCommendations(force);
		return commendations.find((c) => c.id === settings.itemId);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<CommendationSettings>): Promise<void> {
		const previous = this.currentSettings(ev.action.id);
		await super.onDidReceiveSettings(ev);

		// Changing the faction or campaign changes the lists below it.
		const { faction, campaign } = ev.payload.settings;
		if (previous?.faction !== faction || previous?.campaign !== campaign) {
			await this.sendAllLists(ev.payload.settings);
		}
	}

	override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, CommendationSettings>): Promise<void> {
		const event = (ev.payload as { event?: string } | null)?.event;
		if (event === "getFactions" || event === "getCampaigns" || event === "getCommendations") {
			const settings = await ev.action.getSettings();
			await this.sendList(event, await this.buildList(event, settings));
		}
	}

	private async sendAllLists(settings?: CommendationSettings): Promise<void> {
		const current = settings ?? (await this.inspectedSettings());
		if (!current) return;
		for (const event of ["getFactions", "getCampaigns", "getCommendations"] as const) {
			await this.sendList(event, await this.buildList(event, current));
		}
	}

	/** Settings of the key currently shown in the property inspector, if it is one of ours. */
	private async inspectedSettings(): Promise<CommendationSettings | undefined> {
		const inspected = streamDeck.ui.action;
		return inspected && inspected.manifestId === this.manifestId ? ((await inspected.getSettings()) as CommendationSettings) : undefined;
	}

	private async buildList(event: "getFactions" | "getCampaigns" | "getCommendations", settings: CommendationSettings): Promise<ListItem[]> {
		let commendations: Commendation[];
		try {
			commendations = await getCommendations();
		} catch (error) {
			return [{ label: `⚠ ${errorMessage(error).join(" ")}`, value: "", disabled: true }];
		}

		switch (event) {
			case "getFactions":
				return factions(commendations);
			case "getCampaigns":
				return campaigns(commendations, settings.faction);
			case "getCommendations":
				return commendationList(commendations, settings.faction, settings.campaign);
		}
	}
}

function factions(commendations: Commendation[]): ListItem[] {
	const byKey = new Map<string, { label: string; done: number; total: number }>();
	for (const c of commendations) {
		const entry = byKey.get(c.faction.key) ?? { label: c.faction.label, done: 0, total: 0 };
		entry.total++;
		if (c.completed) entry.done++;
		byKey.set(c.faction.key, entry);
	}
	return [...byKey].map(([key, { label, done, total }]) => ({ label: `${label} (${done}/${total})`, value: key }));
}

function campaigns(commendations: Commendation[], faction: string | undefined): ListItem[] {
	const byKey = new Map<string, string>();
	for (const c of commendations) {
		if (c.faction.key === faction && c.campaign) byKey.set(c.campaign.key, c.campaign.label);
	}
	if (byKey.size === 0) return [];
	return [{ label: "Toutes les campagnes", value: "" }, ...[...byKey].map(([value, label]) => ({ label, value }))];
}

function commendationList(commendations: Commendation[], faction: string | undefined, campaign: string | undefined): ListItem[] {
	if (!faction) return [];

	const inFaction = commendations.filter((c) => c.faction.key === faction);
	// Ignore a campaign left over from a previously selected faction.
	const inCampaign = campaign ? inFaction.filter((c) => c.campaign?.key === campaign) : [];
	const selected = inCampaign.length > 0 ? inCampaign : inFaction;

	const option = (c: Commendation): ListItem => ({
		label: c.completed ? `✔ ${c.name}` : `${c.name} (${c.current}/${c.target})`,
		value: c.id,
	});

	if (inCampaign.length > 0 || !selected.some((c) => c.campaign)) {
		return selected.map(option);
	}

	// Whole faction with campaigns: group by campaign.
	const groups = new Map<string, ListItem[]>();
	for (const c of selected) {
		const label = c.campaign?.label ?? "";
		groups.set(label, [...(groups.get(label) ?? []), option(c)]);
	}
	return [...groups].map(([label, children]) => ({ label, children }));
}
