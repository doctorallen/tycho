# Text, interface and legibility at 320×180, and colorblind-safe palettes under an eight-ink limit

Notes compiled 2026-11-05 for Elsewhere and the Tycho study. Target: a 320×180 pixel frame (Elsewhere's short side is 180 art pixels), scaled by whole numbers on a phone, eight inks to a frame, plain JavaScript drawing into palette-indexed buffers. Sibling notes: `styles_resolution_perspective.md` (palettes, OKLab ramps, integer scaling) and `style_matching.md`. This file covers how words and buttons fit that frame, and how a palette of eight inks stays readable for people with color vision deficiency.

Note on sourcing: the libDaltonLens C source was downloaded and read in full (its matrices are used in the demos). The PICO-8 manual, the BMFont format page, the Xbox Accessibility Guidelines (XAG 101), WCAG 2.2's Understanding pages, the IGDA GASIG filter page, the CSS Color 4 spec, and the font pages for m5x7, Fusion Pixel and Ark Pixel were fetched. Items marked "(search summary)" come from search-result summaries only. Phone figures not given by a source are arithmetic from published screen sizes and are marked *(arithmetic)*. Anything marked *(inference)* is reasoning, not a source's claim.

## 1. What exists today

### Takeaway
Tycho has no bitmap text at all. Its only text machinery is DOM: `Tycho.ui.Typer`, a letter-at-a-time revealer for HTML lines, at 40 characters a second with breaths after sentences and clauses. Elsewhere's talk box is HTML over the canvas in the system sans at 15 px; its answer buttons are about 35 CSS px tall.

### Findings
- **Tycho `Typer`** (`src/shell/ui.ts`, documented in `docs/ui.md`): defaults `{ cps: 40, stop: 260, pause: 110, first: 160, gap: 320, after: 200 }`: 40 letters a second, a 260 ms breath where a word ends a sentence, 110 ms at a clause, 160 ms before the first spoken line, 320 ms between spoken lines, 200 ms before a line shown whole. `finish()` shows the rest (a tap hurries it); reduced motion shows everything at once. Its model is Merryfolk's talk sheet. It works on DOM spans (said and unsaid, the unsaid hidden but keeping room so the bubble holds its shape).
- No glyph, font or `fillText` code in `src/` (grep for `font|glyph|fillText`: only the dev panel's CSS).
- **Elsewhere `js/talk.js`**: one box for every conversation, over Tyrell's Voice. Lines are `<p>` with a gold name in `<b>`; answers are `<button>`s, numbered 1 to 9 on a keyboard (`<kbd>` hidden on touch). Old lines fade to 55% opacity.
- **Elsewhere `css/elsewhere.css`**: `#talk` sits at `bottom: max(10px, env(safe-area-inset-bottom))`, `width: min(94vw, 620px)`, `max-height: 62vh`; `#talkLines` 15 px at line-height 1.35; `#talkAnswers button` 14 px with `padding: 8px 10px`, a 1 px border, 6 px gaps. At a normal line height of about 1.2, that's 14 × 1.2 + 16 + 2 ≈ **35 CSS px** tall *(arithmetic)*: above WCAG 2.2's 24 px minimum, below Apple's 44 pt. In landscape the box moves right and narrows to `min(58vw, 520px)`. The pads are 64 px circles.
- **Elsewhere `js/view.js`**: `k = floor(min(innerWidth, innerHeight) / px)` with `px = 180`, in **CSS pixels**; the canvas is `ceil(W/k) × ceil(H/k)` art pixels, so the frame widens to fill the screen rather than letterboxing. Because `k` counts CSS pixels, on a phone whose device pixel ratio isn't a whole number (Pixel 8: 2.625) an art pixel becomes 2 × 2.625 = 5.25 device pixels, and rows alternate 5 and 6 device pixels wide *(arithmetic)*.

## 2. Pixel fonts: sizes, metrics, famous examples

### Takeaway
At 320×180, the workable range runs from 3×5 caps-only (labels, numbers) to 5×7 with 2-pixel descenders (body text, a 10-pixel line), up to 6×11-ish faces for headline-friendly reading. Proportional faces save 10 to 20% of the width over monospace. Accents need extra rows above the cap height; CJK needs about 12 pixels to be comfortable and 8 pixels at the absolute minimum.

### Findings
- **PICO-8** (128×128): the default font is 4 pixels wide and 6 high per character cell (`print` control codes: "x set character width (default: 4)", "y set character height (default: 6)"), so a 3×5 glyph plus a 1-pixel gap; characters 128 and up are 8 wide. 128 / 4 = 32 characters a line. A custom font lives at `0x5600`: 8 bytes a glyph × 256 = 2048 bytes, each glyph an 8×8 bitfield, one byte a row, lowest bit on the left; `0x5600` width, `0x5601` width for 128+, `0x5602` height, `0x5603/4` draw offsets, `0x5605` flags (size adjustments, tabs). A per-character adjustment table can "draw the character one pixel higher (useful for latin accents)". The code editor has hiragana, katakana and a "puny" (small caps) font. — [PICO-8 manual](https://www.lexaloffle.com/dl/docs/pico-8_manual.html)
- Community PICO-8 fonts go proportional: "mostly 3x5 but occasionally 2x5 and 3x6 with a few descenders yet still with a vertical of 6", widths stored in 4 bits per character — [Lexaloffle BBS](https://lexaloffle.com/bbs/?tid=49808) (search summary).
- **m5x7** by Daniel Linssen: "average width +5", "ascender height +7", "descender height -2", "x-height +5"; "uppercase and lowercase letters, including many accented letters, numbers and most common symbols"; CC0, "free to use but attribution appreciated"; use at multiples of 16 px. — [managore.itch.io/m5x7](https://managore.itch.io/m5x7). Siblings: m3x6 and m6x11 ([m6x11](https://managore.itch.io/m6x11), "6px by 11px", free with attribution).
- **Balatro** uses m6x11 throughout, often with a bouncing animation — [Fonts In Use](https://fontsinuse.com/uses/65816/balatro-computer-game). A commercial hit whose whole interface is a free 11-pixel-tall pixel font.
- **Press Start 2P** by codeman38 (Cody Boisclair): based on 1980s Namco arcade lettering, OFL 1.1, best at multiples of 8 px, with pan-European characters the original ROM lacked — [Google Fonts](https://fonts.google.com/specimen/Press+Start+2P/about), [Fontsource](https://fontsource.org/fonts/press-start-2p/about) (search summary). An 8×8 all-caps-height face: about 40 characters across 320 px *(arithmetic)*, wide for its size.
- **Undertale** uses 8-Bit Operator JVE (Jayvee Enaguas, 2011) for dialogue and interface; menus use tighter spacing, dialogue looser. "Determination" is a fan recreation from a spritesheet — [Fonts In Use](https://fontsinuse.com/uses/51307/undertale-dialogue-and-interfaces) (search summary).
- **Celeste** keeps its dialogue fonts as BMFont `.fnt` files with PNG pages in `Content/Dialog/Fonts` (Renogare for Latin; `japanese.fnt`, `chinese.fnt`, `korean.fnt`, `russian.fnt`), shipping only partial CJK fonts (the characters its own text uses); modders regenerate them from Noto Sans CJK with BMFont or a community tool — [Everest wiki: Adding Custom Dialogue](https://github-wiki-see.page/m/EverestAPI/Resources/wiki/Adding-Custom-Dialogue) (search summary).
- **Stardew Valley** ships Latin text as XNA sprite fonts and Japanese, Korean, Chinese and Russian as BMFont `.fnt` text files plus image pages (e.g. `Content/Fonts/Japanese.fnt`, `Japanese_0`); custom languages set `UseLatinFont: false` and may set `FontApplyYOffset` to shift taller CJK glyphs — [Stardew Valley Wiki: Modding:Custom languages](https://stardewvalleywiki.com/Modding:Custom_languages) (search summary).
- **Pattern** *(inference)*: shipped pixel games keep a hand-drawn bitmap face for Latin and generate per-language bitmap atlases (BMFont) from a vector CJK font at a fixed pixel size, holding only the glyphs the game's text uses.

### Metrics at 320×180 *(arithmetic)*
Line text width in a talk box 304 px wide with 8 px padding = 288 px.

| Face | Cell / advance | Line | Chars per 288 px | Lines in a 40 px box |
|---|---|---|---|---|
| 3×5 caps (PICO-8-like) | 4 | 6 | 72 | 6 |
| 5×7 mono, 2 px descenders | 6 | 10 | 48 | 4 |
| 5×7 proportional (avg advance ≈ 5) | ≈5 | 10 | ≈57 | 4 |
| 6×11 (m6x11-like, avg advance ≈ 6) | ≈6 to 7 | 12 | ≈44 | 3 |
| 8×8 (Press Start-like) | 8 | 10 | 36 | 4 |
| 12 px CJK (full width) | 12 to 13 | 14 | 22 | 2 |

- Bringhurst's measure, 45 to 75 characters with 66 ideal, is the print reference; game subtitle guidance wants at most 38 to 40 (below).

## 3. How big is big enough

### Takeaway
On every current phone, holding the 180-pixel short side at a whole device-pixel scale makes one art pixel about a third of a millimeter. A 7-pixel cap height is then about 2.3 mm, about the size of iOS body text's capitals. A 3×5 face is at the floor. Accessibility guidance for games (XAG) asks for more.

### Findings
- **XAG 101 (text display)** minimum body text height: console 26 px at 1080p; PC 18 px at 1080p; mobile 18 px at 100 DPI, 36 at 200, 72 at 400, "scale linearly as DPI increases". Blocks over two lines: line width ≤ 80 characters (40 for CJK), line spacing ≥ 1.5× ascender-to-ascender, paragraph spacing ≥ 2× line spacing, letter spacing ≥ 0.12× font size, word spacing ≥ 0.16×. "Include colored-outline pixels only if their contrast to the background exceeds 2:1" (when measuring size). Text should scale to 200%. — [XAG 101](https://devdocs.xbox.com/build/game-principles/accessibility/xag-deep-dives/xag-101-text-display.md)
- 18 px at 100 DPI is 4.6 mm. If that is the font size (em), a 0.33 mm art pixel needs an em of about 14 art pixels for body text: an 11-pixel cap height *(arithmetic, inference on what "height" measures)*. By that bar even m6x11 is at the minimum on a phone and 5×7 is below it; by iOS's own default body text, 5×7 is on par.
- **Game Accessibility Guidelines**: subtitles at least 46 px at 1080p, ideally by default or by option; at most 40 characters a line, 2 lines (3 in exceptional cases), on a solid or semi-opaque backing, ideally with an outline or shadow — [GAG: subtitle size](https://gameaccessibilityguidelines.com/?p=111), [GAG: clear subtitles](https://gameaccessibilityguidelines.com/?p=3272). Ian Hamilton: at most 38 characters a line — [80.lv](https://80.lv/articles/10-golden-rules-on-subtitles-for-games). IGDA GASIG: 46 px for subtitles, 32 px for other text — [IGDA GASIG](https://igda-gasig.org/?p=1478) (search summary).
- 320×180 at 1080p is 6 device px per art px, so 46 px is about 8 art px: a 5×7 face on a 10-pixel line is 60 px at 1080p and passes the TV subtitle bar *(arithmetic)*.
- **Reading rate**: adults read English silently at about 238 words a minute for non-fiction and 260 for fiction (190 studies); aloud about 183 — [Brysbaert 2019, Journal of Memory and Language](https://www.Gwern.net/doc/psychology/linguistics/2019-brysbaert.pdf). At about 6 characters a word including the space, that's 24 to 26 characters a second *(arithmetic)*: Tycho's 40 cps runs ahead of a reader, which is why the breaths at sentence ends matter, and why a tap must always complete the line.
- iOS body text defaults to 17 pt and captions to 11 pt (Apple HIG, general knowledge; the HIG page didn't render for fetching). With capitals at about 70% of the em, 17 pt caps are about 12 pt ≈ 2.0 mm on an iPhone 15 (153 pt to the inch) *(arithmetic, the 70% an assumption)*.

### Phones *(arithmetic from published sizes)*
Device scale = floor(short side in device px / 180). iPhone sizes from [Use Your Loaf](https://useyourloaf.com/blog/iphone-15-screen-sizes/); Android sizes are general knowledge.

| Phone (CSS px, ratio, ppi) | Device px per art px | Screen in art px (landscape) | One art px | 7-px cap | 44 pt or 48 dp | 9 mm fingertip |
|---|---|---|---|---|---|---|
| iPhone 15 (393×852, 3, 460) | 6 | 426×196 | 0.33 mm | 2.3 mm | 22 px | 27 px |
| iPhone 15 Pro Max (430×932, 3, 460) | 7 | 399×184 | 0.39 mm | 2.7 mm | 19 px | 23 px |
| iPhone SE 3 (375×667, 2, 326) | 4 | 333×187 | 0.31 mm | 2.2 mm | 22 px | 29 px |
| Pixel 8 (412×915, 2.625, 428) | 6 | 400×180 | 0.36 mm | 2.5 mm | 21 px | 25 px |
| Galaxy S24 (360×780, 3, 416) | 6 | 390×180 | 0.37 mm | 2.6 mm | 24 px | 25 px |

- **Safe areas**, iPhone 15: portrait insets 59 pt top, 34 bottom; landscape 59 left and right, 21 bottom, 0 top — [Use Your Loaf](https://useyourloaf.com/blog/iphone-15-screen-sizes/). In art px at 6 device px (2 pt): 29.5 px at each side and 10.5 px at the bottom in landscape. A 320×180 frame centered in the 426×196 screen has 53 px spare at each side, clear of the island, and 8 px top and bottom, so the bottom 2 to 3 rows sit under the home indicator *(arithmetic)*. Safari reports nonzero side insets only with `viewport-fit=cover` — [WebKit bug 272779](https://bugs.webkit.org/show_bug.cgi?id=272779).

## 4. Touch targets

### Takeaway
Every guideline lands between 7 and 10 mm. On a phone, that's 20 to 29 art pixels at 320×180: a choice button can't be shorter than about 22 pixels, an eighth of the frame's height. Three stacked choices plus three lines of text take two thirds of the frame; in landscape, choices belong side by side.

### Findings
- **Apple HIG**: at least 44×44 pt for controls (general knowledge; widely cited, see [W3C issue 1831](https://github.com/w3c/wcag/issues/1831)).
- **Android**: "at least 48 dp", which "results in a physical size of about 9 mm, regardless of screen size", "separated by 8 dp of space or more" — [Android accessibility help](https://support.google.com/accessibility/android/answer/7101858?hl=en-GB).
- **WCAG 2.2 SC 2.5.8 (AA)**: at least 24×24 CSS px, or spaced so a 24 px circle on each undersized target touches no other target; SC 2.5.5 (AAA) asks 44×44 — [W3C Understanding 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).
- **Parhi, Karlson & Bederson 2006** (MobileHCI): for one-handed thumb use, 9.2 mm for discrete targets and 9.6 mm for serial ones; errors stopped falling at or above 9.6 mm (discrete) and 7.7 mm (serial) — [Microsoft Research](https://www.microsoft.com/en-us/research/?p=155150) (search summary).
- Note that 44 pt is 7.3 mm on an iPhone 15 and 48 dp is 7.6 mm at Android's nominal 160 dp to the inch; Google's "about 9 mm" is generous *(arithmetic)*.

## 5. Text over busy art

### Takeaway
At 320×180, a 1-pixel 8-neighbor outline in the frame's darkest ink is the standard way to keep light text on any background, at the cost of 2 pixels of width and height a glyph and some closing-up of counters. A drop shadow (1 pixel down and right) keeps more of the counter but fails over dark ground. A plate (a box behind the text) is safest and is what subtitle guidelines ask for.

### Findings
- GAG asks for a solid or semi-opaque backing, ideally plus an outline or shadow ([GAG](https://gameaccessibilityguidelines.com/?p=3272)); XAG counts outline pixels toward text size only at contrast above 2:1 ([XAG 101](https://devdocs.xbox.com/build/game-principles/accessibility/xag-deep-dives/xag-101-text-display.md)).
- WCAG text contrast: 4.5:1 for normal text, 3:1 for large (18 pt, or 14 pt bold); "20/40 calculates to approximately 4.5:1"; luminance contrast is used because it doesn't depend on hue, which covers color deficiencies. Relative luminance `L = 0.2126 R + 0.7152 G + 0.0722 B` on linearized channels; ratio `(L1 + 0.05) / (L2 + 0.05)` — [W3C Understanding 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
- In an eight-ink frame the outline must be one of the eight, so the darkest and lightest inks double as the text pair; checking their ratio is a one-line test per palette *(inference)*.

## 6. Accents and other scripts

### Takeaway
Lowercase accents fit in a 5×7 face's ascender rows; capital accents don't, and need 2 to 3 rows above the cap height, so a font that supports them needs a taller line (12 instead of 10). Decomposing with Unicode NFD lets one small table of marks cover most Latin accents. CJK needs separate bitmap fonts: 8×8 is legible only with care (Misaki), 10 to 12 px is the practical minimum, and XAG halves the characters per line.

### Findings
- **Misaki** is an 8×8 Japanese bitmap font, made for the PC-E500 pocket computer, covering kana and JIS level 1 kanji (2,965 kanji in JIS X 0208 level 1, general knowledge; level 2 adds 3,390); the related Misaki Gothic 2 covers levels 1 and 2 — [littlelimit.net](https://littlelimit.net/misaki.htm) via search summaries ([Arduboy port](https://www.github.com/emutyworks/8x8DotJPFont)).
- **Fusion Pixel Font** (OFL 1.1) comes in 8, 10 and 12 px, monospaced and proportional, in latin, zh-Hans, zh-Hant, zh-HK, zh-TW, ja and ko builds. Its 8 px takes kanji from Misaki and Korean from Galmuri; 10 and 12 px build on Ark Pixel Font. Monospaced mode compresses the design space so that some complex glyphs "cannot be drawn clearly"; proportional is recommended — [Fusion Pixel Font](https://github.com/TakWolf/fusion-pixel-font).
- **Ark Pixel Font** (OFL 1.1) now ships 10 and 12 px; 16 px was deprecated in 2026 (Unifont suggested instead); "still missing many characters" — [Ark Pixel Font](https://github.com/TakWolf/ark-pixel-font).
- XAG: 40 characters a line for CJK, against 80 for alphabetic text ([XAG 101](https://devdocs.xbox.com/build/game-principles/accessibility/xag-deep-dives/xag-101-text-display.md)).
- At 12 px plus 2 px leading, 180 rows hold 12 lines, a 3-line talk box is 42 px plus padding, and 288 px holds 22 full-width characters a line *(arithmetic)*. The atlas for a game's own text (a few hundred to a couple of thousand distinct characters) at 12×12, 1 bit a pixel, is 18 bytes a glyph: 36 KB for 2,000 glyphs *(arithmetic)*.

## 7. Fonts as data: BMFont and index buffers

### Takeaway
BMFont's text format is the de facto bitmap font interchange: one `common` line (line height, baseline), one `char` line per glyph (atlas rectangle, offsets, advance), optional `kerning` pairs. A pixel font in an indexed engine needs only 1 bit a pixel, and drawing it is writing one ink index per set bit, with the outline a second pass in another index.

### Findings
- **BMFont** text format: `info` (face, size, padding, spacing, outline), `common` (`lineHeight`: distance between lines; `base`: top of line to baseline; `scaleW/H`; `pages`; `packed`), `page` (id, file), `char` (`id`, `x`, `y`, `width`, `height`, `xoffset`, `yoffset`, `xadvance`, `page`, `chnl`), `kerning` (`first`, `second`, `amount`) — [AngelCode BMFont file format](https://www.angelcode.com/products/bmfont/doc/file_format.html).
- Both Celeste and Stardew Valley load BMFont files for their non-Latin text (above).
- In an indexed buffer, text is just more ink: glyph bits → `set(x, y, ink)`; outline → the same bits dilated by one pixel, written first in the outline ink; shadow → the same bits offset by (1, 1) in the shadow ink. The text then obeys the palette like everything else and reprints with the world *(inference)*.
- Automatic pixel kerning: compare the right profile of one glyph with the left profile of the next (each row's last and first set column, checking neighboring rows so diagonals never touch) and close up by one pixel where at least two empty columns would remain (the "To", "LT", "r." cases) *(inference; the BMFont `kerning` tag is where such pairs are stored)*.

## 8. Talk boxes

### Takeaway
The talk-box conventions are stable across decades: a framed box at the bottom, a portrait at one end, a name tab, text revealed at a set speed with pauses at punctuation, the first tap completing the line and the second advancing, a small blinking marker when a line is done, and choices as a short list. Each has a pixel-specific detail: nine-slice frames must tile their edges in whole pattern periods; word wrap must measure in the font's own advances; choices must be finger-sized.

### Findings
- Typewriter speed: Tycho's Typer uses 40 cps with 260/110 ms breaths (above); GAG recommends letting players control text speed and display ([GAG](https://gameaccessibilityguidelines.com/?p=3272)).
- Nine-slice: corners drawn once, edges repeated (or stretched), centre filled. In pixel art, a plain edge stretched equals one tiled; a patterned edge must repeat in whole periods, so box sizes snap to the period *(inference)*.
- Word wrap: greedy, by measured advance, breaking at spaces; with a proportional face the measure must include kerning, or wrapped lines overflow by a pixel or two *(inference)*.
- Choices and fingers: see section 4. At 22 px a choice and 2 px gaps, three stacked choices take 70 of 180 rows; with a 3-line box (30 px text + 12 px frame) that's 112 rows, 62% of the frame *(arithmetic)*.

## 9. Colorblind-safe palettes

### Takeaway
About 8% of men and 0.4% of women have a color vision deficiency, nearly all red-green; protans also see reds darker. The robust design rule is that inks that must be told apart differ in lightness, because lightness survives every deficiency; checking an eight-ink palette means simulating it (Brettel 1997 for all three types; Viénot 1999 for protan and deutan; Machado 2009 for partial deficiency) and measuring every one of its 28 pairs. Games that bolt filters onto the whole screen get criticized; redundancy (shape plus color) and per-element palettes are what accessibility groups recommend.

### Findings
- **Prevalence** (Wikipedia, from population studies): protanopia 1.3% of men, deuteranopia 1.2%, tritanopia 0.008%; protanomaly 1.3%, deuteranomaly 5.0%, tritanomaly 0.0001%; women 0.02%, 0.01%, 0.008%, 0.02%, 0.35%. For a protanope, "the brightness of red is much reduced", so reds may look nearly black — [Wikipedia: Color blindness](https://en.wikipedia.org/wiki/Color_blindness). DaltonLens: 8% of males, 0.4% of females — [DaltonLens](https://daltonlens.org/opensource-cvd-simulation/).
- **Simulation methods** (DaltonLens's review): "Viénot 1999, Brettel 1997 and Machado 2009 are solid choices [for protan and deutan], with a slight advantage for Viénot"; for tritanopia Brettel 1997 is "the most solid and basically only valid choice"; Machado's authors chose not to model tritanopia; Machado is best kept for anomalous trichromacy; "Coblis V1 (ColorMatrix) should never be used"; many copied matrices skip sRGB decoding and come out too dark — [DaltonLens review](https://daltonlens.org/opensource-cvd-simulation/).
- **libDaltonLens** (public domain C, read in full): Brettel 1997 as two 3×3 matrices in linear RGB plus a separation-plane normal: `dot(rgb, n) >= 0 ? M1 : M2`. Protan `M1 = [0.14980, 1.19548, -0.34528; 0.10764, 0.84864, 0.04372; 0.00384, -0.00540, 1.00156]`, `M2 = [0.14570, 1.16172, -0.30742; 0.10816, 0.85291, 0.03892; 0.00386, -0.00524, 1.00139]`, `n = [0.00048, 0.00393, -0.00441]`; deutan `M1 = [0.36477, 0.86381, -0.22858; 0.26294, 0.64245, 0.09462; -0.02006, 0.02728, 0.99278]`, `M2 = [0.37298, 0.88166, -0.25464; 0.25954, 0.63506, 0.10540; -0.01980, 0.02784, 0.99196]`, `n = [-0.00281, -0.00611, 0.00892]`; tritan `M1 = [1.01277, 0.13548, -0.14826; -0.01243, 0.86812, 0.14431; 0.07589, 0.80500, 0.11911]`, `M2 = [0.93678, 0.18979, -0.12657; 0.06154, 0.81526, 0.12320; -0.37562, 1.12767, 0.24796]`, `n = [0.03901, -0.02788, -0.01113]`. Viénot 1999 is one matrix each (protan `[0.11238, 0.88762, 0; 0.11238, 0.88762, 0; 0.00401, -0.00401, 1]`). Severity is a linear blend with the original. — [libDaltonLens.c](https://github.com/DaltonLens/libDaltonLens/blob/master/libDaltonLens.c)
- Papers: Brettel, Viénot & Mollon 1997, "Computerized simulation of color appearance for dichromats", JOSA A 14(10) ([doi:10.1364/JOSAA.14.002647](https://doi.org/10.1364/JOSAA.14.002647)); Viénot, Brettel & Mollon 1999, "Digital video colourmaps for checking the legibility of displays by dichromats", Color Research & Application 24(4) ([doi:10.1002/(SICI)1520-6378(199908)24:4<243::AID-COL5>3.0.CO;2-3](https://doi.org/10.1002/(SICI)1520-6378(199908)24:4%3C243::AID-COL5%3E3.0.CO;2-3)); Machado, Oliveira & Fernandes 2009, "A Physiologically-based Model for Simulation of Color Vision Deficiency", IEEE TVCG 15(6), 1291–1298, severity as a cone shift where 20 nm equals dichromacy ([project page](https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html)).
- **Small-field tritanopia**: for small, centrally fixated fields (about 20 arcminutes), normal observers match colors with two primaries, losing blue-yellow discrimination — Willmer & Wright 1945, "Colour Sensitivity of the Fovea Centralis", [Nature 156:119](https://www.nature.com/articles/156119a0.pdf) (search summary). A 1-pixel mark at 0.33 mm, held at 30 cm, subtends about 4 arcminutes, so a small blue-versus-grey or yellow-versus-white mark can vanish for everyone *(arithmetic, inference)*: marks should differ in lightness, not only in hue.
- **A just noticeable difference**: CSS Color 4's gamut mapping takes "one JND is an OkLCh difference of 0.02" — [CSS Color 4](https://www.w3.org/TR/css-color-4/). Ink pairs that must read as different objects in small pixel clusters need many JNDs; the demos flag pairs under 0.08 *(inference: a working threshold, not a source's)*.
- **Okabe & Ito, Color Universal Design** (2002 web page, 2008 publication): an eight-color qualitative palette safe across deficiencies: black `#000000`, orange `#E69F00`, sky blue `#56B4E9`, bluish green `#009E73`, yellow `#F0E442`, blue `#0072B2`, vermillion `#D55E00`, reddish purple `#CC79A7` — [jfly](https://jfly.uni-koeln.de/color/), via [R `see` docs](https://rdrr.io/cran/see/man/scale_color_okabeito.html) (search summary).
- **What games do**:
  - The Last of Us Part II: more than 60 accessibility settings; High Contrast Display (off plus three levels) mutes the environment and colors allies, enemies, items and interactables; HUD Colorblind Mode (protanopia, deuteranopia, tritanopia) changes only HUD accents; HUD color choosable — [PlayStation Blog](https://blog.playstation.com/2020/06/09/the-last-of-us-part-ii-accessibility-features-detailed).
  - Fortnite: protanope, deuteranope and tritanope modes with a strength slider (community guides; no official figures found) — [Dot Esports](https://dotesports.com/fortnite/guides/the-best-colorblind-settings-for-fortnite) (search summary).
  - Celeste's Assist Mode changes rules, not color: game speed down to 50% in 10% steps, infinite stamina, extra or infinite dashes, invincibility — [Vice](https://www.vice.com/en/article/celeste-assist-mode-change-and-accessibility) (search summary). It's the model for opt-in settings that never judge the player.
  - IGDA GASIG, "Do not implement colorblind filters": filters "bunch hues up closer together" and change colors that didn't need changing (all greens to blue, so grass stops looking like grass); first reduce color reliance with shapes and symbols, then adjust only the elements that must stand apart, ideally letting players choose; Destiny's hand-made presets for key UI elements are the better example, Overwatch's filters the cautionary one — [IGDA GASIG](https://igda-gasig.org/how/platform-level-accessibility-recommendations/do-not-implement-colorblind-filters/).
  - SimCity (2013) added three Daltonizing filters after its creative director saw the color coding fail — [PC Gamer](https://www.pcgamer.com/why-games-need-color-blind-modes-see-simcity-with-simulated-color-blindness) (search summary). A 2022 study of four online games found partial (Valorant, League of Legends) or full (Overwatch) daltonization and concluded that shape, outline and text should lead, color second — [Kerac et al. 2022](https://www.grid.uns.ac.rs/symposium/download/2022/30.pdf) (search summary).
- **Elsewhere's own palettes** (from the quests' source): frogs `DAY = #0c2c34 #1f7a6a #8cc84c #f0f4a8 #d8483a #b87a3c #2a5aa0 #f08a30`; Mrs. Pell's `SUN = #3a1620 #b0442c #f0a050 #fff0c8 #4a5478 #f8c850 #3f7a52 #3a62b8`; the road's `DUSK = #1a1030 #6a2a6a #a83c6a #e0683c #ffd890 #3d7a52 #8fbf6a #3f5fa8`; the lighthouse's `LIT = #060a24 #1e3a78 #7aa0c0 #fff0a8 #ffc84a #b0602c #e0642c #2c6ab0`. The colorblind demo measures them.

### An eight-ink check *(inference)*
1. Simulate the eight inks under protanopia, deuteranopia and tritanopia (Brettel 1997 via libDaltonLens's matrices) and greyscale (OKLab L).
2. Measure all 28 pairs in OKLab under each; flag pairs under a threshold (0.08 here) in any view.
3. For pairs that must stay distinct (figure on ground, a person's coat on grass), push lightness apart in OKLCH, keeping hue and lowering chroma to stay in gamut, until no flag remains. Lightness is preserved under all three dichromacies, so separating L separates every view.
4. Check the text pair (darkest on lightest) for WCAG 4.5:1.
5. Not every pair matters: two greens in one ramp may collide by design. The flag list is for a person to read, not a gate.
