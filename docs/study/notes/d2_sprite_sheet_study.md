# Diablo II player sprite sheet: a measured style study

Source: a fan rip of one Diablo II (Lord of Destruction) player character's full animation set, 2605×6736 GIF, from The Spriters Resource (asset 54300), supplied by the user as a style study. It was measured for statistics only. Nothing from it is copied into any demo or shipped asset. The measuring scripts are throwaway Node and PIL code that treated the sheet's flat greys (170, 196, 255) as background and grouped non-background pixels into frames.

## Layout

- 2,103 frames in about a dozen panels, one per animation mode. The labels include Town Neutral, Town Walk, Neutral, Walk, Run, Get Hit, Kick, Block, Attack 1, Attack 2 and two Special rows.
- **16 rows per mode, one per direction.** This confirms the postmortem's "16 for player characters".
- Frames per direction: walk and run 8; town idle 16; attacks about 20 (320 frames ÷ 16). One character, with one weapon class and one armor set, is about 2,100 frames.

## Size

- Frame bounding boxes have median 37×67 px. Height percentiles 10/50/90 are 61/67/80. The 90th percentile includes raised weapons and lunges.
- The commonly cited 75 px (from the postmortem-era descriptions) sits inside that range. A standing body reads about 65–70 px including hair. At Elsewhere's 320×180 (half of 640×480 each way), that is about 33–35 px.

## Color

- **220 distinct colors on the whole sheet**, a single shared palette, consistent with D2's one 256-color palette per act.
- **47–65 colors per frame, median 56.** A D2 sprite is not a limited-ink sprite. It uses a large slice of a shared palette.
- The palette sorted by hue shows long ramps for each hue that run down into near-black: red-browns, oranges and golds, skin tones, one teal-green costume hue, olive, and a short steel blue. There is almost nothing above mid-value except gold, orange and the occasional skin highlight.
- Color plan of this character:
  - one saturated costume hue (teal green) over black cloth;
  - warm skin and leather;
  - gold and orange trim that takes the brightest highlights;
  - a cool blue-grey accent on the weapon head.

## Value (luma, 0–255, over all sprite pixels)

| Percentile | 10 | 25 | 50 | 75 | 90 | 99 |
|---|---|---|---|---|---|---|
| Luma | 5 | 8 | 32 | 61 | 86 | 184 |

- It is very low key. A quarter of all sprite pixels are luma 8 or below. Highlights above 150 are around 1–2% of pixels, small specular hits on metal trim and skin.
- The bottom half of each frame is lighter than the top half on average (mean luma 46.2 against 36.3). This says more about this costume than about the light: dark hair and a black bodice sit high, and bare legs sit low. Averaged over 16 directions, the left/right split (36.8 vs 44.1) means nothing on its own.

## Edges and texture

- **No drawn outline.** 56% of silhouette-edge pixels are near-black (luma under 40), against 55% of interior pixels. The edge is no darker than the body, and it reads dark only because the whole sprite is dark. This contradicts the "dark rim" in my earlier style note.
- Edges against the background are hard 1-bit alpha with no anti-aliasing (the sheet has no in-between greys at the silhouette).
- Surfaces are mottled. One-pixel value variation everywhere, no flat fills, the signature of a lit 3D render with material texture quantized to a shared palette. This is the opposite of Elsewhere's frogs' rule (dark outline, flat color, few marks, no noise).

## What this means for a generator

- The D2 look is a render-and-quantize result with these numbers as targets: about 56 colors per sprite from one shared palette of hue ramps ending in near-black, a luma median around 30, a quarter of pixels in deep shadow, sparse warm specular highlights, no outline, hard alpha edges, and fine texture.
- These numbers are what a `check.style` pack would hold for a D2-like target: colors per sprite, luma percentiles, near-black share, edge-to-interior darkness ratio, and highlight share.
- Volume is the other lesson. 16 directions × about 12 modes × 8–20 frames per character is far beyond hand pixeling for a small team. It only makes sense as an offline render, which is why D2 rendered and why a build-step pre-render is the honest route to this style.
- For Elsewhere, the D2 look breaks the house style (eight inks, outlines, flat color). It belongs to a quest that deliberately changes look, and should be built from a style pack and a pre-render step, not the frogs' painter.
