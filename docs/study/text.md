# Text and interface

How words, talk boxes and buttons fit a 320×180 frame on a phone, and what it takes for them to stay readable. On every current phone, holding the 180-pixel short side at a whole device-pixel scale makes one art pixel about a third of a millimeter (0.31 to 0.39 mm). A 5×7 pixel font with 2-pixel descenders on a 10-pixel line then has capitals about 2.3 mm tall, near iOS body text, and fits 48 characters across a talk box in monospace or about 65 in a proportional face squeezed from the same glyphs; a 3×5 face is the floor, good for labels and numbers. A fingertip is 21 to 29 art pixels, an eighth to a sixth of the frame's height, so three stacked choices and a three-line box take two thirds of the frame, and in landscape choices belong side by side. Text over busy art needs a 1-pixel outline in the frame's darkest ink or a plate behind it. Accented capitals need 2 to 3 more rows of line height, and Chinese, Japanese and Korean need their own bitmap fonts at 10 to 12 pixels. Tycho has no bitmap text at all today, only a DOM typewriter (`Typer`), and Elsewhere's talk box is HTML over the canvas. Palettes everyone can read are on [Palette and resolution](looks.md#palettes-everyone-can-read).

**Proposed: none of this is in Tycho yet.** The demos run here in the page, written in plain JS with the study's own kit (`demos/kit.js`), not Tycho; each says how it would run in Tycho: per frame (the GPU stand-in's calls), pre-bake (painted once offscreen), or shader (per-pixel work every frame). What would move into Tycho, and when, is in [the roadmap](roadmap.md).

Text marked *(inference)* is reasoning from the sources, not a sourced fact. Figures marked *(arithmetic)* are computed from published screen sizes and the demos' own fonts.

- [What there is today](#what-there-is-today)
- [Pixel fonts at 320×180](#pixel-fonts-at-320180)
- [How big is big enough](#how-big-is-big-enough)
- [Text over busy art](#text-over-busy-art)
- [Accents and other scripts](#accents-and-other-scripts)
- [Fonts as data](#fonts-as-data)
- [Talk boxes](#talk-boxes)
- [Fingers and pixels](#fingers-and-pixels)
- [What 320×180 becomes on a phone](#what-320180-becomes-on-a-phone)
- [Color is a second channel](#color-is-a-second-channel)
- [What it means for Tycho](#what-it-means-for-tycho)
- [Sources](#sources)

## What there is today

Tycho's only text machinery is in the interface kit, and it works on DOM elements, not pixels ([ui.md](../ui.md)). `Typer` reveals the newest lines of a conversation a letter at a time, as Merryfolk's talk sheet does:

| Setting | Default | What it does |
|---|---|---|
| `cps` | 40 | Letters a second |
| `stop` | 260 ms | A breath where a word ends a sentence |
| `pause` | 110 ms | A breath where a word ends a clause |
| `first` | 160 ms | A beat before the first spoken line |
| `gap` | 320 ms | A beat between spoken lines |
| `after` | 200 ms | A beat before a line shown whole (your own words, a note) |

`finish()` shows the rest at once (a tap hurries it), and with reduced motion everything shows at once. Each line keeps its room while hidden, so nothing below it moves. There is no glyph, font or `fillText` code anywhere in `src/` beyond the dev panel's CSS.

Elsewhere's talk box (`js/talk.js`, `css/elsewhere.css`) is one HTML box for every conversation in every world, laid over the canvas. Its lines are 15 px system sans at line-height 1.35, with the speaker's name in gold; old lines fade to 55%. Its answers are buttons in 14 px text with 8 px by 10 px padding and 6 px gaps, about **35 CSS px tall** *(arithmetic)*: above WCAG 2.2's 24 px minimum, below Apple's 44 pt. On a keyboard they're numbered 1 to 9; on touch the numbers hide. The box sits at `bottom: max(10px, env(safe-area-inset-bottom))` and moves to the right in landscape.

So the house style's own rule, eight inks to a frame, stops at the talk box: its words are in the browser's font, anti-aliased, in colors outside the palette. That may be the right call (it's sharp, it scales with the system, it handles every script), but it is a choice to make knowingly *(inference)*. The rest of this page is what a pixel-text path would take.

## Pixel fonts at 320×180

At 320 pixels across, the useful faces run from 3×5 capitals to about 6×11.

| Face | Glyph | Where it shipped |
|---|---|---|
| PICO-8's own | 3×5 in a 4×6 cell; 8 wide for characters 128 and up | PICO-8: 32 characters across its 128 pixels ([manual](https://www.lexaloffle.com/dl/docs/pico-8_manual.html)) |
| m5x7 (Daniel Linssen) | Average width 5, ascender 7, descender 2, x-height 5; many accented letters; CC0 | Countless jam games ([itch.io](https://managore.itch.io/m5x7)) |
| m6x11 (Daniel Linssen) | 6 by 11 | Balatro, the whole interface, often bouncing ([itch.io](https://managore.itch.io/m6x11); [Fonts In Use](https://fontsinuse.com/uses/65816/balatro-computer-game)) |
| Press Start 2P (codeman38) | 8 by 8, from 1980s Namco arcade lettering; OFL | Best at multiples of 8 px ([Google Fonts](https://fonts.google.com/specimen/Press+Start+2P/about)) |
| 8-Bit Operator JVE | Pixel sans, tighter in menus, looser in dialogue | Undertale ([Fonts In Use](https://fontsinuse.com/uses/51307/undertale-dialogue-and-interfaces)) |

PICO-8's custom fonts show what a pixel font is as data: 8 bytes a glyph times 256 glyphs, 2,048 bytes, each glyph an 8×8 bitfield, one byte a row, plus a width, a height, draw offsets and a per-character adjustment that can "draw the character one pixel higher (useful for latin accents)" ([PICO-8 manual](https://www.lexaloffle.com/dl/docs/pico-8_manual.html)). Community fonts for it go proportional: "mostly 3x5 but occasionally 2x5 and 3x6 with a few descenders", widths stored in 4 bits a character ([Lexaloffle BBS](https://lexaloffle.com/bbs/?tid=49808)).

The study drew three faces of its own for the demos: a **3×5** face (capitals, figures, punctuation; lowercase prints as capitals), a **5×7** monospace face with lowercase on a 5-pixel x-height and 2-pixel descenders, and a **proportional** face made from the 5×7 by a rule rather than by hand. The rule is the squeeze: drop the middle column of a glyph wherever it only repeats a neighbor in every row, then trim empty columns. O, A, H, e, s and n go 4 wide; M, W, T and x stay 5; i, l and punctuation shrink to 1 to 3. On the demo's paragraph the average advance falls from 5.99 to 4.37 pixels, 27% narrower *(arithmetic)*.

<figure class="demo"><div class="stage" data-demo="pixel-font"></div>
<figcaption><b>Three pixel fonts at 320×180.</b> The same paragraph in a 3×5 capitals face, a 5×7 monospace face with descenders, and a proportional face squeezed from it (with or without automatic kerning), over a deliberately busy seeded ground in the frame's eight inks: bare, with a shadow, with a 1-pixel outline, or on a plate. <i>Width</i> moves the measure; <i>Leading</i> adds rows between lines (accented capitals need about 3). The readout gives characters a line, lines a box, and the capitals' height in millimeters on an iPhone 15. The faces were drawn for the study, not copied.</figcaption></figure>

What fits, at the demo's own advances *(arithmetic)*:

| Face | Advance | Line | Characters in 288 px | Lines in a 40 px box | Lines in 172 px |
|---|---|---|---|---|---|
| 3×5 | 4.0 | 6 | 72 | 6 | 28 |
| 5×7 mono | 6.0 | 10 | 48 | 4 | 17 |
| 5×7 proportional | 4.4 | 10 | 65 | 4 | 17 |
| 8×8 (Press Start-like) | 8 | 10 | 36 | 4 | 17 |
| 12 px CJK, full width | 12 to 13 | 14 | 22 | 2 | 12 |

288 px is a talk box 304 px wide with 8 px of padding; with a 32-pixel portrait in it, the 5×7 mono line drops to 43 characters, the proportional to 59. Bringhurst's print measure is 45 to 75 characters; subtitle guidance for games caps a line at 38 to 40 ([Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/?p=3272); [80.lv, Ian Hamilton](https://80.lv/articles/10-golden-rules-on-subtitles-for-games)). In portrait the frame is about 196 pixels wide, so a 5×7 mono line holds about 30 characters, and a proportional one about 41 *(arithmetic)*.

Proportional faces need kerning more than monospace ones do. The demo's automatic kerning compares the right edge of one glyph with the left edge of the next, row by row and against the rows above and below so that diagonals never touch, and closes the pair up by one pixel wherever at least two clear columns would otherwise sit between them: "To", "LT", "r." *(inference)*. In a BMFont file the result is a list of `kerning first second amount` lines ([AngelCode](https://www.angelcode.com/products/bmfont/doc/file_format.html)).

## How big is big enough

On a phone, an art pixel at 320×180 is about 0.33 mm. Accessibility guidance for games asks for bigger text than most pixel fonts give.

| Guideline | Asks for | At 320×180 |
|---|---|---|
| XAG 101, console | Body text at least 26 px at 1080p | 4.3 art px (at 6 device px each) |
| XAG 101, mobile | 18 px at 100 DPI, 36 at 200, 72 at 400, scaled with DPI | 4.6 mm: about 14 art px if that is the em *(inference)* |
| Game Accessibility Guidelines, subtitles | At least 46 px at 1080p | About 8 art px |
| IGDA GASIG | 46 px for subtitles, 32 px for other text | 8 and 5 art px |
| iOS default body text | 17 pt; caps about 12 pt ≈ 2.0 mm on an iPhone 15 *(arithmetic, caps at 70% of the em assumed)* | 6 art px of cap height |

XAG also asks, for blocks over two lines, for at most 80 characters a line (40 for CJK), line spacing of at least 1.5 times, paragraph spacing of twice that, and text that players can scale to 200% ([XAG 101](https://devdocs.xbox.com/build/game-principles/accessibility/xag-deep-dives/xag-101-text-display.md)). Game subtitles get 46 px at 1080p, at most 40 characters a line and two lines (three in exceptional cases), on a solid or semi-opaque backing ([GAG: size](https://gameaccessibilityguidelines.com/?p=111); [GAG: presentation](https://gameaccessibilityguidelines.com/?p=3272); [IGDA GASIG](https://igda-gasig.org/?p=1478)).

Read against that table:

- **5×7 on a 10-pixel line** passes the TV subtitle bar (60 px a line at 1080p).
- It matches iOS body text: 7-pixel capitals are 2.3 mm on an iPhone 15.
- It falls short of XAG's mobile figure, if that figure is the em.
- **m6x11-sized text** is the smallest that meets every row of the table *(inference)*.
- **3×5** is a label face: its 5-pixel capitals are 1.7 mm, a little above the capitals of iOS's smallest text, 11 pt (about 1.3 mm) *(arithmetic)*.

<div class="finding"><p>At 320×180 on a phone, a 5×7 face with descenders on a 10-pixel line is about the size of iOS body text, and fits about 48 monospace or 65 proportional characters across a talk box. A 3×5 face is for labels and numbers. Players who need larger text need a setting that scales the text, not the world: a second, larger face, or the talk drawn at a finer scale than the art.</p></div>

A larger-text setting has two honest paths in a pixel game *(inference)*:

- **A second, larger face** (6×11 or 8×12) at the same pixel scale, with fewer words a box.
- **Talk at a finer scale than the art.** Draw the talk on its own canvas at twice the art's resolution, still in the frame's inks, the way Lodestar and Merryfolk already decouple art pixels from world pixels ([Palette and resolution](looks.md#resolution-sets-the-detail-budget)).

## Text over busy art

Light text over a busy pixel scene needs a ring of dark around it. At 320×180 the choices are:

| Backing | What it costs | Where it fails |
|---|---|---|
| Bare | Nothing | Over light or busy ground, which is most ground |
| Shadow (1 px down, or down and right) | 1 px of height | Over dark ground; counters stay open |
| Outline (1 px, all 8 neighbors) | 2 px of width and height a glyph; outlines of neighboring letters merge, which reads as a band | Never, if the outline is the frame's darkest ink; but small counters (e, a) close up at 3×5 |
| Plate (a box behind the text) | A rectangle of the frame | Never; it hides the art behind it |

The guidelines agree with the table's last row: a solid or semi-opaque backing, ideally with an outline or shadow ([GAG](https://gameaccessibilityguidelines.com/?p=3272)). XAG counts an outline's pixels toward text size only if their contrast to the background exceeds 2:1 ([XAG 101](https://devdocs.xbox.com/build/game-principles/accessibility/xag-deep-dives/xag-101-text-display.md)). WCAG's text contrast is 4.5:1 (3:1 for large text, 18 pt or 14 pt bold), measured on luminance precisely because luminance contrast doesn't depend on hue, which covers color deficiencies ([W3C Understanding 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)).

Under an eight-ink rule the outline must be one of the eight, so the darkest and lightest inks become the text pair, and their ratio is a one-line check per palette. Elsewhere's four palettes measured in the colorblind demo give 12.8:1 (the frogs' day), 14.1:1 (Mrs. Pell's), 13.3:1 (the Road at dusk) and 17.0:1 (the lighthouse lit), all well over 4.5 *(arithmetic)*. The lighthouse's NIGHT palette is nearly black by design; text over it needs a plate or the lit print.

## Accents and other scripts

A 5×7 face with a 5-pixel x-height has two rows above its lowercase for accents (é, ü, ñ) and none above its capitals. The demo decomposes each character with Unicode NFD, so é becomes e plus a combining acute. It then draws the base glyph and a mark from a table of seven, one clear row above the letter's top. One table covers most Latin accents, and i and j lose their dots under one. Capital marks (É, Ü, Ñ) land 2 to 3 rows above the cap height, in the line above's descenders, so a face that supports them needs a 12- or 13-pixel line instead of 10 *(arithmetic)*. PICO-8's per-character "one pixel higher" flag is the same problem solved the other way ([PICO-8 manual](https://www.lexaloffle.com/dl/docs/pico-8_manual.html)); m5x7 includes many accented letters at its 9-pixel glyph height ([itch.io](https://managore.itch.io/m5x7)).

Chinese, Japanese and Korean are another matter:

| Font | Size | Coverage |
|---|---|---|
| Misaki | 8×8 | Japanese, made for the PC-E500 pocket computer: kana and JIS level 1 kanji (2,965 kanji, general knowledge) ([Arduboy port](https://www.github.com/emutyworks/8x8DotJPFont)) |
| Fusion Pixel Font | 8, 10, 12 px; monospaced and proportional | Latin, Simplified and Traditional Chinese, Japanese, Korean builds; 8 px borrows Misaki and Galmuri; OFL ([GitHub](https://github.com/TakWolf/fusion-pixel-font)) |
| Ark Pixel Font | 10, 12 px (16 px deprecated in 2026) | Still missing many characters; OFL ([GitHub](https://github.com/TakWolf/ark-pixel-font)) |

Fusion Pixel's own notes say that in monospaced mode some complex glyphs "cannot be drawn clearly", and recommend proportional ([GitHub](https://github.com/TakWolf/fusion-pixel-font)). At 12 px plus 2 of leading, the 180-pixel frame holds 12 lines and a talk box's 288 px holds 22 characters, under half the Latin count, which is exactly the halving XAG writes in (40 characters for CJK against 80) *(arithmetic)*.

What shipped games do:

- **Celeste** keeps a hand-made face for Latin and bitmap atlases per language for the rest. Its dialogue fonts are BMFont `.fnt` files with PNG pages: Renogare, and `japanese.fnt`, `chinese.fnt`, `korean.fnt`, `russian.fnt`. It ships only partial CJK fonts, the characters its own text uses, and modders regenerate them from Noto Sans CJK ([Everest wiki](https://github-wiki-see.page/m/EverestAPI/Resources/wiki/Adding-Custom-Dialogue)).
- **Stardew Valley** loads Japanese, Korean, Chinese and Russian from BMFont files beside its Latin sprite fonts. A custom language sets `UseLatinFont: false` and can shift taller glyphs with `FontApplyYOffset` ([Stardew Valley Wiki](https://stardewvalleywiki.com/Modding:Custom_languages)).

A game's own text needs a few hundred to a couple of thousand distinct characters. At 12×12 and 1 bit a pixel, that's 18 bytes a glyph, about 36 KB for 2,000 glyphs, small enough to pre-bake per language *(arithmetic)*.

## Fonts as data

BMFont's text format is the common interchange for bitmap fonts:

| Line | Fields |
|---|---|
| `info` | Face, size, padding, spacing, outline thickness |
| `common` | `lineHeight` (between lines), `base` (top of line to baseline), atlas size, pages, `packed` |
| `page` | Id and image file |
| `char` | `id`, atlas `x y width height`, `xoffset yoffset` (where to draw), `xadvance` (how far to move), `page`, `chnl` |
| `kerning` | `first second amount` |

That's from [AngelCode's format page](https://www.angelcode.com/products/bmfont/doc/file_format.html); Celeste and Stardew both load it.

In an engine that keeps pictures as palette indexes, as Elsewhere's `Ink` does, text is just more ink. Each set bit of a glyph writes one index; an outline is the same bits dilated by a pixel, written first in the outline's index; a shadow is the same bits offset. The text then obeys the palette like everything else and reprints with the world: the same words at the frog stall by day and at dusk *(inference)*. The demos' `drawText` does exactly that into a `Kit.Pix` in a few dozen lines. Drawing per frame within Tycho's GPU stand-in means pre-baking each face once into an atlas canvas per ink pair and drawing glyphs with `drawImage`, about 60 calls for a line of 60 characters, or caching each finished line as one canvas *(inference)*.

## Talk boxes

The talk box's conventions are old and stable: a framed box at the bottom, a portrait, a name tab, text revealed at a set speed with breaths at punctuation, the first tap completing the line and the second moving on, a small blinking marker when more waits, and choices as a short list. Each has a pixel-specific detail.

<figure class="demo"><div class="stage" data-demo="talk-box"></div>
<figcaption><b>A talk box at 320×180.</b> A nine-slice frame (3-pixel corners, edges repeated, the middle filled), a portrait slot and a name tab, text revealed with Tycho's <code>Typer</code> timings (40 letters a second, 260 ms after a sentence, 110 ms after a clause), wrapped in the font's own advances. Tap the frame: the first tap completes the line, the next moves on, and after the second line three choices appear. Their height is Apple's 44 pt or Android's 48 dp for the chosen phone, in this frame's pixels; the dotted circles are a 9 mm fingertip at the same scale. <i>Row</i> puts the choices side by side inside the box.</figcaption></figure>

The pixel-specific details:

- **Speed.** Adults read English silently at about 238 words a minute for non-fiction and 260 for fiction, across 190 studies ([Brysbaert 2019](https://www.Gwern.net/doc/psychology/linguistics/2019-brysbaert.pdf)). That's 24 to 26 characters a second at about 6 a word with the space *(arithmetic)*. Typer's 40 runs ahead of a reader, so its breaths do real work, the tap that completes a line must always work, and a speed setting belongs in the options, as the accessibility guidelines ask ([GAG](https://gameaccessibilityguidelines.com/?p=3272)).
- **Nine-slice.** In pixel art a plain edge stretched equals an edge tiled; a patterned edge (a rope, studs, a stripe) must repeat in whole periods, so box sizes snap to the period *(inference)*.
- **Wrap.** Greedy wrap at spaces, by measured advance including kerning, or proportional lines overflow by a pixel or two. A box of three lines pages its text in threes, and the reveal counts characters across the lines of a page, so wrapping never moves a word mid-reveal.
- **Portrait.** A 32-pixel portrait costs 36 pixels of line, 15% of the measure, and buys who is speaking at a glance *(arithmetic)*.
- **Choices.** See the next section: at 22 pixels a choice with 2-pixel gaps, three stacked choices take 70 of the frame's 180 rows. With a three-line box (44 pixels) they take 123 rows, 68% of the frame. Side by side inside the box, they take 52.

## Fingers and pixels

Every touch guideline lands between 7 and 10 mm:

| Source | Minimum target |
|---|---|
| Apple HIG | 44×44 pt (general knowledge; see [W3C issue 1831](https://github.com/w3c/wcag/issues/1831)) |
| Android accessibility | 48×48 dp, "about 9 mm, regardless of screen size", 8 dp apart ([Android help](https://support.google.com/accessibility/android/answer/7101858?hl=en-GB)) |
| WCAG 2.2, SC 2.5.8 (AA) | 24×24 CSS px, or spaced so a 24 px circle on each touches no other target ([W3C](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)) |
| WCAG 2.2, SC 2.5.5 (AAA) | 44×44 CSS px |
| Parhi, Karlson & Bederson 2006 | One-handed thumb: 9.2 mm for single taps, 9.6 mm for sequences; errors stopped falling at 9.6 and 7.7 mm ([Microsoft Research](https://www.microsoft.com/en-us/research/?p=155150)) |

44 pt is 7.3 mm on an iPhone 15, and 48 dp is 7.6 mm at Android's nominal 160 dp to the inch, so Google's "about 9 mm" is generous *(arithmetic)*.

In art pixels at 320×180 *(arithmetic)*:

| Phone | One art px | 44 pt or 48 dp | 9 mm fingertip |
|---|---|---|---|
| iPhone 15 | 0.33 mm | 22 px | 27 px |
| iPhone 15 Pro Max | 0.39 mm | 19 px | 23 px |
| iPhone SE 3 | 0.31 mm | 22 px | 29 px |
| Pixel 8 | 0.36 mm | 21 px | 25 px |
| Galaxy S24 | 0.37 mm | 24 px | 25 px |

So a fingertip covers 21 to 29 art pixels: as tall as two and a half lines of 5×7 text, an eighth to a sixth of the frame's height. Some consequences *(inference)*:

- **Choice height.** A choice can't be shorter than about 22 pixels, and its tap area can be larger than its drawn box (the box's gaps count as its own).
- **Choice layout.** In landscape, choices go side by side: three across a box are about 85 pixels wide each, room for 19 proportional characters.
- **Answer length.** Answers short enough to fit, "I'll help.", "Why a fly?", are a writing constraint, and a good one for Elsewhere's dry tone.
- **The thumb covers what it taps.** It covers the choice it presses and the words above it. Highlighting on press, not on release, and keeping the question visible above the choices, both help.
- **Elsewhere's HTML answers.** At about 35 CSS px they're above WCAG's AA line; growing them to 44 px costs 27 px of box, under Apple's line.

## What 320×180 becomes on a phone

Integer scaling on a phone is a choice between letterboxing and widening. Elsewhere's View widens: it fixes the short side at 180 art pixels and fills the rest of the screen, which is what [Palette and resolution](looks.md#phones-force-integer-scaling) recommends. The table below holds the short side at a whole number of **device** pixels *(arithmetic; iPhone sizes from [Use Your Loaf](https://useyourloaf.com/blog/iphone-15-screen-sizes/), Android sizes general knowledge)*:

| Phone | CSS px, device ratio, ppi | Device px per art px | Screen in art px (landscape) | 7-px capitals |
|---|---|---|---|---|
| iPhone 15 | 393×852, 3, 460 | 6 | 426×196 | 2.3 mm |
| iPhone 15 Pro Max | 430×932, 3, 460 | 7 | 399×184 | 2.7 mm |
| iPhone SE 3 | 375×667, 2, 326 | 4 | 333×187 | 2.2 mm |
| Pixel 8 | 412×915, 2.625, 428 | 6 | 400×180 | 2.5 mm |
| Galaxy S24 | 360×780, 3, 416 | 6 | 390×180 | 2.6 mm |

Two findings for Elsewhere follow from this table.

<div class="finding"><p>Elsewhere's View picks its scale in CSS pixels, <code>floor(min(innerWidth, innerHeight) / 180)</code>. On a phone whose device pixel ratio isn't whole, such as the Pixel 8 at 2.625, that makes an art pixel 2 × 2.625 = 5.25 device pixels, so rows and columns alternate 5 and 6 device pixels: uneven pixels, and text that shimmers as it scrolls. Choosing the scale in device pixels, <code>floor(min(w, h) × devicePixelRatio / 180)</code>, then sizing the canvas in CSS pixels as that over the ratio, gives an exact 6 on the Pixel 8. The study's own kit already does this.</p></div>

The same change helps wherever the browser's bars eat the short side. Below 360 CSS px of height, View's `k` falls from 2 to 1, which on a 3× phone halves the art from 6 device pixels to 3. A device-pixel scale steps down only to 5 *(arithmetic, inference)*.

The **safe areas** of an iPhone 15 are 59 pt at the top and 34 at the bottom in portrait, and 59 at each side and 21 at the bottom in landscape ([Use Your Loaf](https://useyourloaf.com/blog/iphone-15-screen-sizes/)). In art pixels at 2 pt each, that's 29.5 pixels at each side and 10.5 at the bottom in landscape. A centered 320×180 frame has 53 spare pixels at each side, clear of the camera island, and 8 above and below, so only its bottom 2 or 3 rows sit under the home indicator *(arithmetic)*. A widened frame's edges fall under the island, which suits art that runs off every edge (the house style's full bleed) and doesn't suit text: talk boxes and choices should be laid out inside `env(safe-area-inset-*)` converted to art pixels, while the land keeps going under the notch *(inference)*. Safari reports side insets only with `viewport-fit=cover` ([WebKit bug 272779](https://bugs.webkit.org/show_bug.cgi?id=272779)).

## Color is a second channel

About 8% of men and 0.4% of women see color differently, nearly all of them on the red-green axis ([DaltonLens](https://daltonlens.org/opensource-cvd-simulation/)). Interface conventions that lean on color fail them first: a red "no" and a green "yes", a highlighted choice told only by hue, a quest marker in a red that a protanope sees as near black ([Wikipedia](https://en.wikipedia.org/wiki/Color_blindness)).

The rule for the interface is redundancy *(inference)*:

- A chosen answer gets a frame or an inverted plate, not only a new color.
- A disabled one gets a pattern or dimmed lightness.
- A name tab carries the name.

The demo's picked choice turns lighter, not only bluer, for that reason. For the palette itself, how to check that eight inks stay distinct under protanopia, deuteranopia and tritanopia, and how to fix them when they don't, see [Palettes everyone can read](looks.md#palettes-everyone-can-read) on the palette page.

## What it means for Tycho

Each of these would be an option any game can use, following Tycho's rules; none changes a default.

| Part | What it would be | How it runs |
|---|---|---|
| `Tycho.text` bitmap fonts | A font as 1-bit glyph rows plus metrics (cell, advance, line, baseline), loaded from a small JSON or a BMFont `.fnt` text file; a mark table for NFD accents | Pre-bake: an atlas canvas per face and ink pair |
| Layout | `measure`, greedy `wrap`, paging in N lines, optional automatic pixel kerning | Plain JS, once per line |
| Drawing | Into an index buffer (glyph bits as one index, outline and shadow as others), or from the atlas with `drawImage` within the GPU stand-in | Per frame |
| `Typer` for pixels | The same timeline (`typeTimeline` already gives each step's time and letters) driving a character count, not DOM spans | Per frame |
| A nine-slice frame | Corners, repeated edges in whole periods, a filled middle, from a small sheet | Pre-bake per size |
| Scale in device pixels | A view helper choosing the whole device-pixel scale for a short side in art pixels, and the safe-area insets in art pixels | Once per resize |
| Touch sizes in art pixels | `targetPx()`: 44 pt or 48 dp, and a 9 mm fingertip, in the current art pixel | Once per resize |

The DOM `Typer` stays as it is for games whose talk is HTML; Elsewhere could keep its HTML box and still take the device-pixel scale *(inference)*. The fonts in the demos are the study's own and could seed Tycho's default faces. Accessible defaults for the text kit:

- a text-speed option;
- an "instant text" option;
- a larger-text face;
- choices sized by `targetPx()`.

The research behind this page is in [the notes on text, interface and legibility](notes/text_interface_legibility.md).

## Sources

- Tycho: [the interface kit](../ui.md) (`Typer`), [the renderer](../renderer.md); Elsewhere's `js/talk.js`, `js/view.js` and `css/elsewhere.css`
- [PICO-8 manual](https://www.lexaloffle.com/dl/docs/pico-8_manual.html) and [Lexaloffle BBS, a proportional PICO-8 font](https://lexaloffle.com/bbs/?tid=49808)
- Daniel Linssen, [m5x7](https://managore.itch.io/m5x7) and [m6x11](https://managore.itch.io/m6x11); [Fonts In Use, Balatro](https://fontsinuse.com/uses/65816/balatro-computer-game) and [Undertale](https://fontsinuse.com/uses/51307/undertale-dialogue-and-interfaces); [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P/about)
- [AngelCode, BMFont file format](https://www.angelcode.com/products/bmfont/doc/file_format.html)
- [Everest wiki, adding custom dialogue to Celeste](https://github-wiki-see.page/m/EverestAPI/Resources/wiki/Adding-Custom-Dialogue); [Stardew Valley Wiki, custom languages](https://stardewvalleywiki.com/Modding:Custom_languages)
- [Fusion Pixel Font](https://github.com/TakWolf/fusion-pixel-font), [Ark Pixel Font](https://github.com/TakWolf/ark-pixel-font), [an 8×8 Misaki port](https://www.github.com/emutyworks/8x8DotJPFont)
- [Xbox Accessibility Guideline 101, text display](https://devdocs.xbox.com/build/game-principles/accessibility/xag-deep-dives/xag-101-text-display.md)
- Game Accessibility Guidelines, [subtitle size](https://gameaccessibilityguidelines.com/?p=111) and [subtitle presentation](https://gameaccessibilityguidelines.com/?p=3272); [80.lv, Ian Hamilton's subtitle rules](https://80.lv/articles/10-golden-rules-on-subtitles-for-games); [IGDA GASIG, certification considerations](https://igda-gasig.org/?p=1478)
- [Brysbaert 2019, How many words do we read per minute?](https://www.Gwern.net/doc/psychology/linguistics/2019-brysbaert.pdf)
- W3C: [Understanding 1.4.3, contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) and [2.5.8, target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html); [W3C issue 1831](https://github.com/w3c/wcag/issues/1831)
- [Android accessibility help, touch target size](https://support.google.com/accessibility/android/answer/7101858?hl=en-GB)
- [Parhi, Karlson & Bederson 2006, target size for one-handed thumb use](https://www.microsoft.com/en-us/research/?p=155150)
- [Use Your Loaf, iPhone 15 screen sizes](https://useyourloaf.com/blog/iphone-15-screen-sizes/); [WebKit bug 272779](https://bugs.webkit.org/show_bug.cgi?id=272779)
- [DaltonLens, open-source color vision deficiency simulations](https://daltonlens.org/opensource-cvd-simulation/); [Wikipedia, color blindness](https://en.wikipedia.org/wiki/Color_blindness)

<script src="demos/kit.js"></script>
<script src="demos/text-shared.js"></script>
<script src="demos/pixel-font.js"></script>
<script src="demos/talk-box.js"></script>
<script src="demos/start.js"></script>
