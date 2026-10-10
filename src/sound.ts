import streamDeck from "@elgato/streamdeck";
import { spawn } from "node:child_process";
import path from "node:path";

/** Sounds bundled in the plugin `sounds/` folder (see scripts/generate-sounds.mjs). */
export type SoundId = "ding" | "warning" | "alarm";

/**
 * Settings shared by actions that can play sounds.
 */
export type SoundSettings = {
	/** "off" disables sounds for the key. */
	sound?: string;
	/** Optional .wav file played instead of the alarm. */
	soundFile?: string;
};

/**
 * Plays a sound without blocking, if enabled for the key. Windows only: uses the .NET SoundPlayer through PowerShell,
 * which supports WAV files.
 */
export function playSound(id: SoundId, settings: SoundSettings): void {
	if (settings.sound === "off" || process.platform !== "win32") {
		return;
	}

	// The plugin runs from its .sdPlugin folder.
	const custom = id === "alarm" ? normalizePath(settings.soundFile) : undefined;
	const file = custom ?? path.resolve("sounds", `${id}.wav`);

	// The path goes through an environment variable to avoid any quoting issue in the command.
	const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "(New-Object System.Media.SoundPlayer $env:SOT_SOUND).PlaySync()"], {
		env: { ...process.env, SOT_SOUND: file },
		stdio: "ignore",
		windowsHide: true,
	});
	child.on("error", (error) => streamDeck.logger.warn(`Cannot play sound ${file}: ${error.message}`));
	child.unref();
}

/**
 * The property inspector file picker may return a URI-encoded path.
 */
function normalizePath(value: string | undefined): string | undefined {
	if (!value) return undefined;
	let result = value.replace(/^file:\/\/\/?/i, "");
	try {
		result = decodeURIComponent(result);
	} catch {
		// Keep the raw value.
	}
	return result || undefined;
}
