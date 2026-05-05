---
name: obsidian-colored-tags-cli
description: Use this skill when an OpenClaw agent needs to list, set, or remove Colored Tags color mappings for Obsidian tags in a vault.
---

# Obsidian Colored Tags CLI

Use this repo's CLI to update Colored Tags settings. Always pass `--vault <vault>`.

```bash
PLUGIN_REPO=/path/to/obsidian-colored-tags
npm --prefix "$PLUGIN_REPO" run cli-build
node "$PLUGIN_REPO/openclaw-colored-tags-cli.cjs" list --vault <vault>
```

Set or remove a tag color:

```bash
node "$PLUGIN_REPO/openclaw-colored-tags-cli.cjs" set --vault <vault> --tag research --color "#4488ff"
node "$PLUGIN_REPO/openclaw-colored-tags-cli.cjs" remove --vault <vault> --tag research
```

If installed or linked, `colored-tags-cli ...` may be used instead. Tags may be passed with or without `#`.

## Safety

- Prefer `--dry-run` before mutating settings.
- Treat `ok: false` or nonzero exit as failure and report `error.message`.
- Secret-like settings are redacted unless `--include-secrets` is passed.

