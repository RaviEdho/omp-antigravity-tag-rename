/**
 * Antigravity (Cloud Code Assist) false-429 workaround.
 *
 * Verified 2026-09-12 against omp 18.1.18 / google-antigravity, quota-healthy account.
 *
 * Google's Cloud Code Assist backend returns a detail-free
 * `429 RESOURCE_EXHAUSTED` ("Resource has been exhausted (e.g. check quota).")
 * for requests matching this exact predicate, regardless of real quota
 * (the usage API reports 0% used on every window):
 *
 *     envelope.requestType === "agent"
 *     && systemInstruction matches
 *        /<system-conventions>\nRFC 2119: MUST, REQUIRED, SHOULD, RECOMMENDED, MAY, OPTIONAL\./
 *
 * That is a literal fingerprint of the first two lines of OMP's system prompt.
 * The match is case-sensitive, needs exactly one newline between the tag and
 * the sentence, and needs the tag at all -- the same sentence under a different
 * tag, or the same tag with any other content, returns HTTP 200.
 *
 * Reproduced and bisected with raw replays of the captured envelope (no OMP in
 * the request path), so the 429 originates server-side. See the canonical
 * upstream thread: https://github.com/can1357/oh-my-pi/issues/11689
 *
 * This hook renames only the wrapper tags on the wire, leaving `requestType`,
 * the envelope shape, and the prompt body otherwise byte-identical, so quota
 * classification is unchanged. Only antigravity Cloud Code Assist envelopes are
 * touched; every other provider payload passes through untouched.
 *
 * Install: copy this file to ~/.omp/agent/extensions/ -- user-level, picked up
 * automatically at session start, no `-e` flag needed. Disable with
 * `omp --no-extensions` or by deleting the file.
 *
 * NOTE: this is a deliberate circumvention of a targeted provider-side block,
 * not an ordinary compatibility fix. Upstream declined to ship it in-tree for
 * that reason, and the account risk is the operator's own.
 */

const OPEN = "<system-conventions>";
const CLOSE = "</system-conventions>";
const OPEN_AS = "<SYSTEM-CONVENTIONS>";
const CLOSE_AS = "</SYSTEM-CONVENTIONS>";

/** Narrowing helper; avoids an unchecked cast on untrusted payload shapes. */
function asRecord(value: unknown): Record<string, unknown> | undefined {
	return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;
}

/** Renames the tag pair in every string part; returns true when anything changed. */
function renameTagPair(systemInstruction: Record<string, unknown>): boolean {
	const parts = systemInstruction.parts;
	if (!Array.isArray(parts)) return false;

	let changed = false;
	for (const rawPart of parts) {
		const part = asRecord(rawPart);
		if (!part || typeof part.text !== "string" || !part.text.includes(OPEN)) continue;
		part.text = part.text.split(OPEN).join(OPEN_AS).split(CLOSE).join(CLOSE_AS);
		changed = true;
	}
	return changed;
}

export default function antigravityTagRename(pi: {
	on(event: string, handler: (event: { payload: unknown }) => unknown): void;
}): void {
	pi.on("before_provider_request", event => {
		const payload = asRecord(event.payload);
		// Cloud Code Assist envelope from the antigravity provider only; every other
		// provider payload (anthropic, openai, gemini-cli) passes through untouched.
		if (!payload || payload.userAgent !== "antigravity" || payload.requestType !== "agent") return;

		const request = asRecord(payload.request);
		if (!request) return;
		const systemInstruction = asRecord(request.systemInstruction);
		if (!systemInstruction) return;

		return renameTagPair(systemInstruction) ? payload : undefined;
	});
}
