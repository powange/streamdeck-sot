/**
 * Key images are drawn as 144×144 SVGs (the @2x key size) and sent to Stream Deck as data URLs.
 */
export const KEY_SIZE = 144;

export const COLORS = {
	sea: "#0d1f2a",
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
export function keySvg(content: string, background: string = COLORS.sea): string {
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
