---
name: obsidian-colored-tags-cli
description: Use this skill when an OpenClaw agent needs to list, set, or remove Colored Tags color mappings for Obsidian tags in a vault.
---

# Obsidian Colored Tags CLI

Use the CLI shipped in the installed plugin folder. Always pass `--vault <vault>`.

```bash
VAULT=/path/to/vault
CLI="$VAULT/.obsidian/plugins/colored-tags/openclaw-colored-tags-cli.cjs"
node "$CLI" list --vault "$VAULT"
```

Set or remove a tag color:

```bash
node "$CLI" set --vault "$VAULT" --tag research --color "#4488ff"
node "$CLI" remove --vault "$VAULT" --tag research
```

If the installed plugin does not include the CLI yet, use `colored-tags-cli` from `PATH` or `node "$PLUGIN_REPO/openclaw-colored-tags-cli.cjs"` from a checkout. Tags may be passed with or without `#`.

## Safety

- Prefer `--dry-run` before mutating settings.
- Treat `ok: false` or nonzero exit as failure and report `error.message`.
- Secret-like settings are redacted unless `--include-secrets` is passed.

