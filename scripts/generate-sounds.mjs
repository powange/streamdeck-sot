// Generates the plugin sounds (16-bit mono WAV) by synthesis, so they carry no third-party rights.
// Usage: node scripts/generate-sounds.mjs
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import url from "node:url";

const RATE = 44100;
const OUT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "../com.powange.seaofthieves.sdPlugin/sounds");

/** Ship bell strike: inharmonic partials with exponential decay. */
function bell(samples, start, frequency, gain) {
	const partials = [
		[1, 1, 1.6],
		[2.0, 0.6, 1.1],
		[2.76, 0.45, 0.8],
		[5.4, 0.25, 0.4],
		[8.9, 0.12, 0.25],
	];
	const from = Math.floor(start * RATE);
	for (let i = from; i < samples.length; i++) {
		const t = (i - from) / RATE;
		const attack = Math.min(1, t / 0.004);
		let value = 0;
		for (const [ratio, amplitude, decay] of partials) {
			value += amplitude * Math.exp(-t / decay) * Math.sin(2 * Math.PI * frequency * ratio * t);
		}
		samples[i] += gain * attack * value;
	}
}

/** Short beep with soft edges. */
function beep(samples, start, duration, frequency, gain) {
	const from = Math.floor(start * RATE);
	const length = Math.floor(duration * RATE);
	for (let i = 0; i < length && from + i < samples.length; i++) {
		const t = i / RATE;
		const envelope = Math.min(1, t / 0.01, (duration - t) / 0.02);
		samples[from + i] += gain * envelope * (Math.sin(2 * Math.PI * frequency * t) + 0.25 * Math.sin(2 * Math.PI * frequency * 2 * t));
	}
}

function toWav(samples) {
	const peak = Math.max(...samples.map(Math.abs)) || 1;
	const data = Buffer.alloc(samples.length * 2);
	samples.forEach((s, i) => data.writeInt16LE(Math.round((s / peak) * 0.8 * 32767), i * 2));

	const header = Buffer.alloc(44);
	header.write("RIFF", 0);
	header.writeUInt32LE(36 + data.length, 4);
	header.write("WAVE", 8);
	header.write("fmt ", 12);
	header.writeUInt32LE(16, 16);
	header.writeUInt16LE(1, 20); // PCM
	header.writeUInt16LE(1, 22); // mono
	header.writeUInt32LE(RATE, 24);
	header.writeUInt32LE(RATE * 2, 28);
	header.writeUInt16LE(2, 32);
	header.writeUInt16LE(16, 34);
	header.write("data", 36);
	header.writeUInt32LE(data.length, 40);
	return Buffer.concat([header, data]);
}

const sounds = {
	// Single bell strike: food cooked, new in-game day.
	ding: (() => {
		const s = new Array(Math.floor(1.6 * RATE)).fill(0);
		bell(s, 0, 660, 1);
		return s;
	})(),
	// Three quick beeps: about to burn / timer almost over.
	warning: (() => {
		const s = new Array(Math.floor(0.75 * RATE)).fill(0);
		for (let i = 0; i < 3; i++) beep(s, i * 0.22, 0.12, 1320, 1);
		return s;
	})(),
	// Three bell strikes: food burnt / timer finished.
	alarm: (() => {
		const s = new Array(Math.floor(2.6 * RATE)).fill(0);
		for (let i = 0; i < 3; i++) bell(s, i * 0.45, 784, 1);
		return s;
	})(),
};

await mkdir(OUT, { recursive: true });
for (const [name, samples] of Object.entries(sounds)) {
	await writeFile(path.join(OUT, `${name}.wav`), toWav(samples));
	console.log(`${name}.wav`);
}
