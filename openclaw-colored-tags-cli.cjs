#!/usr/bin/env node
"use strict";

process.env.OPENCLAW_PLUGIN_CONFIG = JSON.stringify({
  pluginId: "colored-tags",
  installedId: "colored-tags",
  bin: "colored-tags-cli",
  domain: "tag-colors",
  capabilities: ["settings", "tag-color-settings"],
  commands: ["list", "set", "remove"],
});
require("./openclaw-plugin-cli.cjs");
