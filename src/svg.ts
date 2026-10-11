/**
 * Key images are drawn as 144×144 SVGs (the @2x key size) and sent to Stream Deck as data URLs.
 */
export const KEY_SIZE = 144;

export const COLORS = {
	/** Pure black, to blend with the deep black of the Stream Deck screens. */
	background: "#000000",
	track: "#24343e",
	text: "#f4ecd8",
	muted: "#9fb3bf",
	teal: "#3fa7b5",
	cooking: "#f0a030",
	cooked: "#46c063",
	danger: "#e0473c",
	burnt: "#3a1512",
	gold: "#e8b93a",
	bone: "#efe6d2",
	ink: "#10161a",
} as const;

export function escapeXml(value: string): string {
	return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function toDataUrl(svg: string): string {
	return `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`;
}

/**
 * Wraps key content into a full 144×144 SVG document with a solid background.
 */
export function keySvg(content: string, background: string = COLORS.background): string {
	return (
		`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${KEY_SIZE}" height="${KEY_SIZE}" viewBox="0 0 ${KEY_SIZE} ${KEY_SIZE}">` +
		`<rect width="${KEY_SIZE}" height="${KEY_SIZE}" fill="${background}"/>` +
		content +
		`</svg>`
	);
}

export function text(
	x: number,
	y: number,
	value: string,
	size: number,
	color: string = COLORS.text,
	weight = "bold",
	anchor: "start" | "middle" | "end" = "middle",
): string {
	return (
		`<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" ` +
		`fill="${color}" text-anchor="${anchor}">${escapeXml(value)}</text>`
	);
}

/**
 * Splits a text into at most `maxLines` lines of about `maxChars` characters, adding an ellipsis when truncated.
 */
export function wrapLines(value: string, maxChars: number, maxLines: number): string[] {
	const lines: string[] = [];
	let line = "";
	for (const word of value.split(/\s+/).filter(Boolean)) {
		const candidate = line ? `${line} ${word}` : word;
		if (candidate.length <= maxChars || !line) {
			line = candidate;
			continue;
		}
		lines.push(line);
		line = word;
	}
	if (line) lines.push(line);

	if (lines.length > maxLines) {
		lines.length = maxLines;
		lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, maxChars - 1).trimEnd()}…`;
	}
	return lines.map((l) => (l.length > maxChars ? `${l.slice(0, maxChars - 1)}…` : l));
}

/**
 * Embeds a raster image (as a data URL) in the key.
 */
export function image(dataUrl: string, x: number, y: number, size: number): string {
	return `<image x="${x}" y="${y}" width="${size}" height="${size}" href="${dataUrl}" xlink:href="${dataUrl}"/>`;
}

/**
 * Places an icon drawn around (0, 0) at the given position and scale.
 */
export function place(icon: string, x: number, y: number, scale = 1): string {
	return `<g transform="translate(${x} ${y}) scale(${scale})">${icon}</g>`;
}

/** Options shared by every key: the Stream Deck title, and whether the text goes above the picture. */
export type KeyStyle = {
	/** Title typed in the Stream Deck title field; replaces the default label when set. */
	title?: string;
	/** Puts the text on top and the picture below it. */
	textOnTop?: boolean;
};

/** Top of the progress bar; content above it is swapped when the text goes on top. */
const BAR_TOP = 126;

/**
 * Builds a key from its parts. Normally `visual` (icon / picture) sits above `split` and `info` (texts) below it; with
 * `textOnTop` the two are swapped, while the progress `bar` stays at the bottom.
 */
export function composeKey(
	parts: { visual: string; info: string; bar?: string; split: number; background?: string },
	style: KeyStyle,
): string {
	const { visual, info, bar = "", split, background } = parts;
	if (!style.textOnTop) {
		return keySvg(visual + info + bar, background);
	}
	const infoBottom = bar ? BAR_TOP : KEY_SIZE;
	return keySvg(
		`<g transform="translate(0 ${-split})">${info}</g>` + `<g transform="translate(0 ${infoBottom - split})">${visual}</g>` + bar,
		background,
	);
}

/**
 * Normalizes a Stream Deck title (which may span several lines) to a single trimmed line.
 */
export function cleanTitle(title: string | undefined): string | undefined {
	return title?.replace(/\s+/g, " ").trim() || undefined;
}

/**
 * Draws a horizontal progress bar along the bottom of the key.
 */
export function progressBar(ratio: number, color: string): string {
	const x = 14;
	const width = KEY_SIZE - x * 2;
	const filled = Math.max(0, Math.min(1, ratio)) * width;
	return (
		`<rect x="${x}" y="130" width="${width}" height="8" rx="4" fill="${COLORS.track}"/>` +
		`<rect x="${x}" y="130" width="${filled.toFixed(1)}" height="8" rx="4" fill="${color}"/>`
	);
}
