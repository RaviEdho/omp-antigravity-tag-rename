# omp-antigravity-tag-rename

An `omp` extension / plugin that works around the false `429 RESOURCE_EXHAUSTED` error on the `google-antigravity` (Cloud Code Assist) provider path.

## Background

Google's Cloud Code Assist API rejects agent-mode requests whose system prompt contains the `<system-conventions>` block opening tag with an immediate 429 quota exhaustion error, even on accounts with remaining quota.

This extension hooks `before_provider_request` to rewrite the wrapper tag `<system-conventions>` to `<SYSTEM-CONVENTIONS>` on outgoing Cloud Code Assist requests, bypassing the fingerprint filter while keeping `requestType: "agent"` and the rest of the payload byte-identical.

## Installation

```bash
omp install github:RaviEdho/omp-antigravity-tag-rename
```

Or manually copy `antigravity-tag-rename.ts` into your user extension directory:
```bash
mkdir -p "$(omp config path)/extensions"
cp antigravity-tag-rename.ts "$(omp config path)/extensions/"
```

## Verification

Run:
```bash
omp -p "reply with exactly: ok"
```
You should see `ok` with exit code 0.
