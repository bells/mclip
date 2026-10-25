# Maple icon source

`maple-app.png` is the exact second Image Gen concept selected by the owner on 2026-10-25: a rounded, muted russet maple leaf with a flowing lowercase m cutout. It is an RGBA image on a transparent canvas, 1254 × 1254 pixels.

SHA-256: `e16cbeb5215f567afd2f3361e5e3e3d3427948ea938451bb4b5373b8bb1f26dc`.

The original edit reference was the pre-refresh `src-tauri/icons/128x128@2x.png`. The selected concept was generated with the built-in Image Gen tool. The other concepts and the rejected white conversion are not production sources.

## Reproduce exports

```bash
pnpm run icons:generate-maple
node --test tests/mapleIconAssets.test.mjs tests/menuBarIconAssets.test.mjs
```

The exporter uses the official Tauri CLI and temporary SVG wrappers containing this real source image. A color matrix preserves its alpha while rendering the monochrome template. It updates desktop PNG/ICO/ICNS files, leaf tray assets and `site/public/app-icon.png`, and writes `mclip-maple-icon-preview.png` to the system temporary directory. It does not alter the notebook resources, mobile resources, versioned videos or historical screenshots.

Settings remain `appIcon` (color maple), `light` (monochrome maple, default), and `m` (existing notebook). macOS marks the last two as native template images; Windows/Linux retain explicit contrast derivatives. The shared contrast palette is in `scripts/maple-icon-palette.mjs`.

## Selected concept prompt

```text
Use case: logo-brand. Asset: mclip application icon concept titled 柔角枫叶 (metadata only, do not draw a title). Redesign the attached existing green-leaf+m app icon into a new brand mark. Replace the oval green leaf completely with one clearly recognizable FIVE-LOBED MAPLE LEAF. Target dimensions 1024 x 1024 square. ONE single isolated logo, centered, genuinely transparent background and transparent lowercase m cutout. This direction is a compact, broad, softly rounded maple silhouette: five distinct lobes with rounded pointed tips, relaxed organic shoulders and smooth carefully balanced contour, short gently curved stem. It must still read instantly as a maple leaf rather than a flower or oak leaf. Within the middle-lower broad body, create one friendly lowercase 'm' with two open, rounded arches as a generous negative-space knockout. The m is a distinctive integrated monogram, slightly softer and more flowing than a standard geometric typeface, with ample cutout width for tiny menu-bar use. Color is a single understated muted chestnut/umber-russet close to #996B59. Calm, modern, precise flat symbol; clean crisp edges, uniform solid color, no gradients, no highlights, no shadows, no texture, no leaf veins, no decoration. Preserve real alpha transparency both around the leaf and inside the m. Do not print a checkerboard or white plate. Keep the whole silhouette within approximately 78% of canvas and allow generous optical margins. No rounded-square background, no badge, no lettering outside the m, no labels, no watermarks, no notebook and no UI. Produce one polished standalone maple+m mark.
```
