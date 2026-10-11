import { readFile } from "node:fs/promises";
import path from "node:path";

const images = new Map<string, Promise<string | undefined>>();

/**
 * Reads a PNG bundled in the plugin's imgs folder as a data URL, or `undefined` if it is missing.
 * @param file Path relative to the imgs folder, e.g. "factions/GoldHoarders.png".
 */
export function loadBundledImage(file: string): Promise<string | undefined> {
	let image = images.get(file);
	if (!image) {
		// The plugin runs from its .sdPlugin folder.
		image = readFile(path.resolve("imgs", file))
			.then((data) => `data:image/png;base64,${data.toString("base64")}`)
			.catch(() => undefined);
		images.set(file, image);
	}
	return image;
}
