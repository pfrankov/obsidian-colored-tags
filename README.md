# Colored Tags Plugin for Obsidian

![demo](https://github.com/pfrankov/obsidian-colored-tags/assets/584632/b9aacb23-1433-4775-8142-5af223634f62)
<img width="700" alt="Settings" src="https://github.com/pfrankov/obsidian-colored-tags/assets/584632/829b84da-ff37-460c-9daf-5b110c414fe3">

Colorizes tags in different colors. Colors of nested tags are mixed with parent tags.
Text color contrast is automatically matched to comply with AA level of WCAG 2.1.
The colors are adjusted for the dark theme as well.

## Roadmap
- [x] ~~Settings for palette size, base chroma, and base lightness.~~
- [x] ~~Optimization: store existing, already calculated colors of tags. Render only new ones.~~
- [x] ~~Optimization: append styles instead of replacing each time.~~
- [x] ~~Change color assignments to predictable cycle from one color to another (breaking change).~~
- [ ] Ability to color non-latin tags
- [ ] Optimization: calculating order in group must be better than O(n^2)
- [ ] Optimization: remove outdated tags from config on start of plugin
- [ ] Optimization: save already calculated palettes to avoid unnecessary computations
- [ ] Color blending must use only Hue property
- [ ] First child's tag color must differ from its parent. It might be a good idea to make it also differ from next parent's color. So +2 should be enough (breaking change)
- [ ] Optimization: speed up loading Obsidian by using Web Workers or delaying massive calculations
- [ ] Optimization: temporary save all colors to avoid flashing tag's colors on start of Obsidian 

## Installation

### Obsidian plugin store
This plugin is available in the Obsidian community plugin store https://obsidian.md/plugins?id=colored-tags

### BRAT
You can install this plugin via [BRAT](https://obsidian.md/plugins?id=obsidian42-brat): `pfrankov/obsidian-colored-tags`

## Inspired by
- [Colorful Tag plugin](https://github.com/rien7/obsidian-colorful-tag).
