/**
 * Common shape of anything with a progress to display on a key: a Sea of Thieves commendation or an Xbox achievement.
 */
export type ProgressItem = {
	/** Stable identifier, stored in the key settings. */
	id: string;
	name: string;
	description: string;
	/** Small text shown in the corner, e.g. the commendation grade. */
	badge?: string;
	current: number;
	target: number;
	completed: boolean;
	imageUrl?: string;
	/** Image already loaded as a data URL (e.g. bundled with the plugin); takes precedence over `imageUrl`. */
	imageData?: string;
	/** Icon (SVG drawn around 0, 0) shown when there is no image; defaults to the action's icon. */
	icon?: string;
	/** Replaces the "current / target" text. */
	valueText?: string;
	/** Hides the progress bar, for plain values. */
	noBar?: boolean;
	/** Warning in the top-left corner, e.g. the login expiring soon. */
	warning?: string;
};

export type ApiErrorKind = "missing-credentials" | "auth" | "rate-limit" | "http";

export class ApiError extends Error {
	constructor(
		readonly kind: ApiErrorKind,
		message: string,
	) {
		super(message);
	}
}

/**
 * Caches the result of a loader for `ttlMs`, and shares in-flight requests between keys.
 */
export class CachedLoader<T> {
	private value: T | undefined;
	private loadedAt = 0;
	private pending: Promise<T> | undefined;

	constructor(
		private readonly loader: () => Promise<T>,
		private readonly ttlMs: number,
		/** Minimum delay between two forced refreshes, to protect rate limits. */
		private readonly minForceIntervalMs: number,
	) {}

	async get(force = false): Promise<T> {
		const age = Date.now() - this.loadedAt;
		const fresh = this.value !== undefined && age < (force ? this.minForceIntervalMs : this.ttlMs);
		if (fresh) {
			return this.value!;
		}

		this.pending ??= this.loader()
			.then((value) => {
				this.value = value;
				this.loadedAt = Date.now();
				return value;
			})
			.finally(() => (this.pending = undefined));
		return this.pending;
	}

	clear(): void {
		this.value = undefined;
		this.loadedAt = 0;
	}
}

export function toNumber(value: unknown): number {
	const number = Number(value);
	return Number.isFinite(number) ? number : 0;
}
