/**
 * Key images are drawn as 144×144 SVGs (the @2x key size) and sent to Stream Deck as data URLs.
 */
export const KEY_SIZE = 144;

export const COLORS = {
	/** Pure black, to blend with the deep black of the Stream Deck screens. */
	background: "#000000",
	/** Empty part of progress bars, light enough to stay visible on black. */
	track: "#34464f",
	text: "#f4ecd8",
	muted: "#b4c4cc",
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

/** Average width of an Arial bold glyph, in em, used to fit texts in the key. */
const CHAR_WIDTH = 0.58;

/** Same for regular (non-bold) text, which is narrower. */
const CHAR_WIDTH_REGULAR = 0.5;

/** Usable width of the key for texts. */
const TEXT_WIDTH = 128;

/** Smallest font size used on keys: smaller texts are unreadable on the device. */
export const MIN_FONT_SIZE = 16;

/**
 * Standard key grid: picture on top, main value in the middle, short label below, progress bar at the bottom.
 */
export const GRID = {
	/** Centre of icons drawn around (0, 0). */
	iconY: 36,
	/** Top and size of raster pictures. */
	pictureY: 8,
	pictureSize: 54,
	valueY: 98,
	valueSize: 30,
	labelY: 121,
	labelSize: 16,
	/** Boundary between the picture and the texts, for the "text on top" layout. */
	split: 66,
} as const;

/**
 * Largest font size (up to `maxSize`) at which a text fits the width of the key.
 */
export function fitSize(value: string, maxSize: number, maxWidth = TEXT_WIDTH): number {
	const fitting = Math.floor(maxWidth / (Math.max(1, value.length) * CHAR_WIDTH));
	return Math.max(MIN_FONT_SIZE - 2, Math.min(maxSize, fitting));
}

/**
 * Text shrunk if needed to fit the width of the key.
 */
export function fitText(x: number, y: number, value: string, maxSize: number, color: string = COLORS.text, weight = "bold"): string {
	return text(x, y, value, fitSize(value, maxSize), color, weight);
}

/**
 * Cuts a text with an ellipsis so that it fits the width of the key at the given size.
 */
export function truncate(value: string, size: number, maxWidth = TEXT_WIDTH, bold = false): string {
	const maxChars = Math.floor(maxWidth / (size * (bold ? CHAR_WIDTH : CHAR_WIDTH_REGULAR)));
	return value.length > maxChars ? `${value.slice(0, maxChars - 1).trimEnd()}…` : value;
}

/**
 * Short label in the standard label slot, at the minimum readable size.
 */
export function label(value: string, color: string = COLORS.muted, y: number = GRID.labelY): string {
	return text(72, y, truncate(value, GRID.labelSize), GRID.labelSize, color, "normal");
}

/**
 * Badge in a rounded pill: in the top-right corner by default, or aligned on `left`.
 */
export function pill(
	value: string,
	{ left, right = KEY_SIZE - 6, top = 4, fill = COLORS.gold, color = COLORS.ink }: { left?: number; right?: number; top?: number; fill?: string; color?: string } = {},
): string {
	const size = 15;
	const width = value.length * size * CHAR_WIDTH + 12;
	const x = left ?? right - width;
	return (
		`<rect x="${x.toFixed(1)}" y="${top}" width="${width.toFixed(1)}" height="21" rx="10.5" fill="${fill}"/>` +
		text(x + width / 2, top + 16, value, size, color)
	);
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
const BAR_TOP = 128;

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
	const x = 12;
	const width = KEY_SIZE - x * 2;
	const filled = Math.max(0, Math.min(1, ratio)) * width;
	return (
		`<rect x="${x}" y="${BAR_TOP}" width="${width}" height="10" rx="5" fill="${COLORS.track}"/>` +
		`<rect x="${x}" y="${BAR_TOP}" width="${filled.toFixed(1)}" height="10" rx="5" fill="${color}"/>`
	);
}
