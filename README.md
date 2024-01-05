# Colored Tags Plugin for Obsidian

<img width="446" alt="Demo" src="https://github.com/pfrankov/obsidian-colored-tags/assets/584632/9ff98fb1-f397-449c-9a22-d5ba1e7bf3d9">

### Settings with custom palette
<img width="621" alt="Settings" src="https://github.com/pfrankov/obsidian-colored-tags/assets/584632/033e3cb9-10b5-47fd-acea-2f2ed1a51a23">

Colorizes tags in different colors. Colors of nested tags are mixed with the root tag to improve readability.
Text color contrast is automatically matched to comply with AA level of WCAG 2.1.
The colors are adjusted for the dark theme as well.

The main idea of the plugin is to make tags visually different from each other, so you should expect that the **colors may change with upcoming updates**.

If you need to color individual tags, this plugin is not suitable. Try [Colored Tag Wrangler](https://github.com/code-of-chaos/obsidian-colored_tags_wrangler) instead.

>**Limitations:**
>- Properties tags can not be styled until fixes in Obsidian.

## Roadmap
- [x] ~~Settings for palette size, base chroma, and base lightness.~~
- [x] ~~Optimization: store existing, already calculated colors of tags. Render only new ones.~~
- [x] ~~Optimization: append styles instead of replacing each time.~~
- [x] ~~Change color assignments to predictable cycle from one color to another (breaking change).~~
- [x] ~~Ability to color non-latin tags~~
- [ ] Optimization: calculating order in group must be better than O(n^2)
- [ ] Optimization: remove outdated tags from config on start of plugin
- [ ] Optimization: save already calculated palettes to avoid unnecessary computations
- [x] ~~Color blending must use only Hue property~~
- [x] ~~Optimization: speed up loading Obsidian by using Web Workers or delaying massive calculations~~
- [ ] Optimization: temporary save all colors to avoid flashing tag's colors on start of Obsidian 

## Installation

### Obsidian plugin store
This plugin is available in the Obsidian community plugin store https://obsidian.md/plugins?id=colored-tags

### BRAT
You can install this plugin via [BRAT](https://obsidian.md/plugins?id=obsidian42-brat): `pfrankov/obsidian-colored-tags`

## My other Obsidian plugins
- [Local GPT](https://github.com/pfrankov/obsidian-local-gpt) that assists with local AI for maximum privacy and offline access.

## Inspired by
- [Colorful Tag plugin](https://github.com/rien7/obsidian-colorful-tag).
