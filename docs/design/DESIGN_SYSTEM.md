# Dino Browser design system

This document describes the current UI foundation in `tokens.css` and `styles.css`. Keep design values local; the browser has no remote font, image, analytics, or styling dependency.

## Tokens

`tokens.css` owns the named palette values and shared browser scales:

- Semantic surfaces: window, toolbar, active/hovered tab, elevated surface, and input.
- Semantic text, accent, status, Shields, border, focus, hover, and pressed colors.
- Five palette themes, contrast-aware accent label colors, and legacy aliases while components migrate.
- A 4px spacing rhythm; 6/10/14/20/pill corner scale; three elevations and an accent glow; glass blur; three motion durations and easing curves.

`styles.css` imports the token values through `index.html` and applies them to the browser chrome and internal pages. Some older component declarations still contain direct values and need token migration during the next UI batches; do not add new raw values where a semantic token fits. Existing layout measurements are still component-specific.

## Palettes

| Setting value | Name | Character |
| --- | --- | --- |
| `night` | Dino Night | Dark slate, violet and teal; default for new profiles |
| `daylight` | Daylight | Cool light surfaces, violet and teal |
| `aurora` | Aurora | Deep teal with green and blue accents |
| `ember` | Ember | Warm plum with coral and gold accents |
| `green` | Dino Green | Deep green with green and lime accents |
| `system` | System | Resolves to Daylight or Dino Night from Windows appearance |
| `high-contrast` | High contrast | App high contrast palette; follows Windows light/dark for its base |

Legacy saved values `light` and `dark` remain valid and resolve to Daylight and Dino Night. The accessibility section's High contrast switch remains available independently.

An accent can follow the theme, use one of the local swatches or a valid custom hex value, or use the current start-page wallpaper. Built-in wallpaper choices use fixed local accent colors; a custom wallpaper is sampled locally with a small canvas. The result clamps saturation/lightness and chooses whichever of white or dark label text gives the better contrast. No wallpaper bytes leave the app. If a local image cannot be sampled, the prior accent remains in place.

## Appearance controls

Appearance offers preview cards, density, custom/theme/wallpaper accent sources, corner roundness, ambient glow, reduced effects, and bookmarks-bar visibility. Accessibility exposes Reduce motion and High contrast. Reduce motion also respects the Windows `prefers-reduced-motion` signal. Reduce effects disables ambient glow, glass blur, and elevation shadows.

## Theme gallery

From a source checkout run:

```powershell
npm run theme-gallery
```

This launches `docs/design/theme-gallery.html` in a dedicated development-only Electron window. The window does not load the browser preload or initialize browser IPC. Its strict local CSP only permits local stylesheets and assets, and the gallery is excluded from the packaged application. The screenshot evidence is in [`screenshots/themes`](screenshots/themes/).

The preview uses the same tab, toolbar, address field, button, privacy-stat, and toast class names as the browser. When adding a palette, add semantic variables to `tokens.css`, a palette card to the gallery, an allowlisted setting value and renderer mapping, and contrast pairs to `check-theme-contrast.js`.

## Motion and accessibility

- Use transform and opacity for moving elements; use token durations for feedback and respect reduced motion.
- Keep labels at 11px or larger. Theme cards are native buttons with names and `aria-pressed` state.
- For each theme, run `npm run check:theme-contrast`. The checker reads palette values from `tokens.css` and checks primary, secondary and disabled text, accent labels, accents, strong boundaries and focus indicators. It also checks the fixed accents used by built-in wallpapers.
- The current contrast script checks token pairs, not every rendered component. Full rendered axe coverage, forced-colors review and DPI/zoom coverage remain Phase 5 work.

