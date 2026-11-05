# Phones and budgets

What a phone allows a plain-JS canvas game, and how fast it runs the study's workloads, so generation and frames can be budgeted before anything is timed on a real phone. On browser benchmarks the iPhone 15 and newer beat the 2019 laptop every number in the study was measured on; a mid-range Android such as the Pixel 6a takes about 2.8 times as long, and a budget one such as the Moto G15 about 3.8 times. **Budget at four times the laptop**: 8 ms of frame work on the laptop is 30 fps on the slowest phones, the geography page's 1.25 s world becomes about 5 s, and a quest-sized 256×256 world (28 ms on the laptop) stays near a tenth of a second everywhere. No canvas limit is near a 320×180 frame. What does bite is memory on iOS (a tab is killed past a soft limit near 1.5 GB and reloads), Low Power Mode and Energy Saver halving the frame rate, Safari deleting a site's storage after seven days without a visit unless the game is installed, and the main thread freezing during generation, which a worker built from a Blob URL removes for a few milliseconds of startup. The bench card below is for running on a phone and pasting the numbers back.

**Proposed: none of this is in Tycho yet.** The demos run here in the page, written in plain JS with the study's own kit (`demos/kit.js`), not Tycho; each says how it would run in Tycho: per frame (the GPU stand-in's calls), pre-bake (painted once offscreen), or shader (per-pixel work every frame). What would move into Tycho, and when, is in [the roadmap](roadmap.md).

Text marked *(inference)* is reasoning from the sources, not a sourced fact. Times marked "measured" were measured for this page on the study's reference laptop: a 2019 MacBook Pro 16-inch, Intel Core i9-9880H at 2.3 GHz (8 cores), 32 GB, macOS 15.7, in headless Chrome 157, which drew canvases on the laptop's GPU through ANGLE and Metal. It's the same machine as [the geography page's](geography.md) bench. JetStream 2.2 scored 213 on it. No phone was measured.

- [The bench card](#the-bench-card)
- [How fast phones are](#how-fast-phones-are)
- [A budget for generation and frames](#a-budget-for-generation-and-frames)
- [Frame rates, heat and battery](#frame-rates-heat-and-battery)
- [Memory and canvas limits](#memory-and-canvas-limits)
- [GPU APIs on phones](#gpu-apis-on-phones)
- [Generation off the main thread](#generation-off-the-main-thread)
- [Saving worlds](#saving-worlds)
- [Measuring on a phone](#measuring-on-a-phone)
- [What it means for Tycho](#what-it-means-for-tycho)
- [Sources](#sources)

## The bench card

The card times five of the study's typical jobs on whatever device opens it and sets each beside the laptop's time. Then it watches three seconds of real frames while drawing 600 sprites a frame. Every job is timed in batches of at least 200 ms, after two warm-up calls, so Safari's coarse clock still gives a usable number.

<figure class="demo"><div class="stage" data-demo="phone-bench"></div>
<figcaption><b>A phone bench.</b> Tap <i>Run</i> on a phone (plugged in, screen on). It times a 256×256 priority-flood, a 256×256 six-octave noise fill, one falling-sand step over the whole 320×180 frame, an indexed-to-RGBA blit at 320×180 scaled ×4 to 1280×720, and a frame of 600 <code>drawImage</code> sprites. The amber bar is this device and the gray bar is the 2019 laptop, scaled per row. Then it graphs three seconds of frame gaps: 16.7 ms is 60 Hz, 8.3 is 120 and 33.3 is 30 (Low Power Mode). <i>Copy results</i> puts the numbers, the screen, DPR, cores, GPU and browser on the clipboard as plain text. The canvas jobs time only the CPU side; the frame graph shows what the GPU keeps up with.</figcaption></figure>

The laptop's reference, the median of three runs of the card in headless Chrome (measured):

| Job | What it is | Laptop, ms per call |
|---|---|---|
| Priority-flood 256×256 | A binary-heap flood with epsilon fill, recording each cell's receiver and the flood order, as [geography](geography.md) uses | 9.08 |
| Noise fill 256×256 | Six octaves of hashed gradient noise, 393,216 noise calls | 17.3 |
| Falling-sand step | 57,600 cells of sand, water and wall, a bottom-up scan with alternating direction and a clock byte | 0.475 |
| Indexed blit ×4 | 57,600 palette lookups through a `Uint32Array`, `putImageData`, then `drawImage` to 1280×720 | 0.266 (CPU side) |
| 600 sprites | `fillRect` the background, then 600 16×16 `drawImage` calls from an atlas | 2.36 (CPU side) |

Two of these say something already. A full-frame sand step costs under half a millisecond on the laptop, so the whole 320×180 frame can be sand even at four times slower. And 600 `drawImage` calls cost 2.4 ms of CPU, about 4 µs a call, which is the number to watch on phones: a frame's sprite count is bounded by draw calls more than by pixels *(inference)*.

## How fast phones are

Notebookcheck runs the same browser suites on every phone it reviews. JetStream 2 is pure JavaScript (and some WebAssembly), the nearest public proxy for a game's generation code. Speedometer adds DOM work. Every iOS browser runs on WebKit, so the iPhone scores Notebookcheck lists under "Chrome" are WebKit numbers.

| Device (browser) | JetStream 2 | Speedometer 2.0 | Speedometer 3.0 | Time against the laptop *(inference)* |
|---|---|---|---|---|
| **The 2019 laptop, i9-9880H (headless Chrome 157)** | **213 (2.2, measured)** | | | **1** |
| iPhone 17 Pro, A19 Pro (Safari 26) | 329.1 | 621 | 41.7 | 0.65 |
| iPhone 16 Pro (Safari 18) | 386.7 | 569 | 33.5 | 0.55 |
| iPhone 15 Pro (WebKit) | 351.1 | 396 | | 0.61 |
| iPhone 15, A16 (WebKit) | 259.7 | 327 | | 0.82 |
| iPhone 14 (Safari 16) | 189.9 | 341 | | 1.12 |
| iPhone SE 2022, A15 (WebKit) | 182.6 | 239 | | 1.17 |
| Galaxy S25 Ultra (Chrome 132) | 315.1 | 425 | 29.3 | 0.68 |
| Pixel 10 Pro (Chrome 140) | 193.3 | 345 | 20.6 | 1.10 |
| Galaxy S23 (Chrome 109) | 158.6 | 136 | | 1.34 |
| Pixel 6 (Chrome 96) | 90.1 | 104 | | 2.36 |
| Pixel 6a, Tensor (Chrome 105) | 75.3 | 90.4 | | 2.83 |
| Galaxy A53 (Chrome 101) | 63.5 | 51.2 | | 3.35 |
| Moto G15, Helio G81 (Chrome 134) | 56.4 | 49.3 | 3.06 | 3.78 |
| Galaxy A15 (Chrome 122) | | 60.4 | 3.66 | about 3.5 |
| Redmi A3 (Chrome 126) | | 15.2 | 1.03 | over 10 |
| Notebookcheck's smartphone average | 153.3 | 224 | 14.3 | 1.39 |

Scores are from Notebookcheck's reviews of the [iPhone 17 Pro](https://www.notebookcheck.net/Apple-iPhone-17-Pro-review-Faster-longer-further-Is-that-enough.1140998.0.html), the [iPhone 15](https://www.notebookcheck.net/Apple-iPhone-15-smartphone-in-review-The-Apple-phone-finally-zooms-in-closer.762555.0.html), the [Pixel 6a](https://www.notebookcheck.net/Google-Pixel-6a-review-Powerful-mid-range-smartphone-with-a-small-display-handicap.657128.0.html) and the [Moto G15](https://www.notebookcheck.net/A-stylish-bargain-Motorola-Moto-G15-smartphone-review.997054.0.html), each with its comparison devices. The last column is 213 divided by the phone's JetStream score. The Galaxy A15 and Redmi A3 rows are estimated from Speedometer instead. JetStream's versions differ (2.0 and 2.1 in older reviews, 2.2 here), and the scores move a little between them, so read the ratios to one figure. Notebookcheck lists the Pixel 6a's JetStream run under Firefox, but its Speedometer ratio to the iPhone 15 (3.6) matches its JetStream ratio (3.4).

Phones split into three groups *(inference)*:

- **Recent iPhones and Android flagships** run JS faster than the laptop (0.55 to 0.8 of its time).
- **Older iPhones and the Pixel 10 Pro** are about level with it.
- **Mid-range and budget Android** take three to four times as long. Below that (the Redmi A3, an entry phone with a 2018-class CPU) a phone is over ten times slower and out of reach for generation on the device.

Elsewhere's players will have all three. So budget for the slow group, about four times the laptop, and treat the Redmi class as a fallback (smaller worlds, prebaked regions) rather than a target.

## A budget for generation and frames

The worker demo below generates a world the way the study does: a fbm height field on an island falloff, priority-flood, flow accumulation in reverse flood order, then a paint into palette indexes with lakes, rivers and a two-tone hillshade. Its stages on the laptop, the median of five runs (measured):

| Stage | 256×256 | 512×512 |
|---|---|---|
| Noise, six octaves | 18.4 ms | 68.8 ms |
| Priority-flood | 8.9 ms | 36.0 ms |
| Flow accumulation | 0.5 ms | 2.5 ms |
| Paint to indexes | 0.6 ms | 1.8 ms |
| **Total** | **28.4 ms** | **111 ms** |

Noise is two thirds of the time. Its cost scales with octaves × cells, so a region painted at a coarser noise resolution and upsampled is the first saving *(inference)*. Scaled by each phone's ratio, the same work comes to:

| Device | 256×256 world | 512×512 world | The geography demo's world (1.25 s on the laptop) |
|---|---|---|---|
| iPhone 17 Pro | 18 ms | 72 ms | 0.8 s |
| iPhone 15 | 23 ms | 91 ms | 1.0 s |
| iPhone SE 2022 | 33 ms | 129 ms | 1.5 s |
| Pixel 10 Pro | 31 ms | 122 ms | 1.4 s |
| Pixel 6a | 80 ms | 314 ms | 3.5 s |
| Galaxy A53 | 95 ms | 372 ms | 4.2 s |
| Moto G15 | 107 ms | 419 ms | 4.7 s |

These are estimates from a benchmark ratio, not measurements; the bench card exists to replace them *(inference)*.

So, for Elsewhere *(inference)*:

- **A quest's world at 256×256** generates in about a tenth of a second on the slowest group. It can run as the handoff plays, even on the main thread behind a card.
- **A 512×512 world** takes up to half a second there. It belongs in a worker, started during the handoff, so the old quest's last frames stay smooth.
- **The geography demo's full pipeline** (plates, 16 erosion steps) takes about 5 s on a budget phone. It can't run while the player waits. Either run it in a worker during the opening and save the result, or precompute it per seed at build time.
- **A frame.** At four times the laptop, 4 ms of frame work on the laptop holds 60 fps on a Moto G15 and 8 ms holds 30. The study's rule for demos (a frame under 8 ms on the laptop) is the 30 fps line on budget phones.
- **Sand.** One full-frame sand step is about 1.9 ms at four times the laptop, so a quest that is all sand fits at 30 Hz with room for drawing, without sleeping chunks.
- **Sprites.** The 2.4 ms for 600 sprites becomes about 9 ms. Keep a busy quest to two or three hundred sprite draws, or bake static ones into the ground layer.
- **Generation while playing** (chunks ahead of the camera, regions on demand) gets a per-frame slice. Merryfolk gives 2 ms when nothing is needed, 6 ms while the camera moves, 16 ms when bare ground is on screen and 28 ms behind the intro card ([the zoom notes](notes/lod_zoom_chunks.md)). On a budget phone divide those by four to get laptop-side costs: 0.5 to 1.5 ms of laptop work per frame.

## Frame rates, heat and battery

A phone doesn't promise 60 frames a second. Several things change the rate a page gets, and a game's loop has to take the real `dt`:

| What | What happens to `requestAnimationFrame` | Source |
|---|---|---|
| iOS Low Power Mode | Capped at 30 fps, on purpose: a WebKit maintainer called it "a little bit rough but it is okay". WebKit's layout test expects under 35 frames a second | [WebKit bug 215745](https://bugs.webkit.org/show_bug.cgi?id=215745), [the test](https://webkit.googlesource.com/WebKit/+/328c7059694d84abb840ac5bccc406a3f989793f/LayoutTests/fast/animation/request-animation-frame-throttling-lowPowerMode.html) |
| Cross-origin iframes on iOS | Throttled to 30 fps (reported 2018) | [Popmotion](https://popmotion.io/blog/20180104-when-ios-throttles-requestanimationframe) |
| 120 Hz ProMotion iPhones | Kept near 60 by default. The feature flag "Prefer Page Rendering Updates near 60fps" is on; turning it off gives 120 Hz on iOS 18 and later | [Tom's Guide](https://www.tomsguide.com/phones/iphones/enable-120hz-safari-on-iphone) |
| Chrome Energy Saver | Lower display refresh rate; "a loop that assumes 16.67 ms between callbacks would run at roughly half speed" | [Chrome for Developers](https://developer.chrome.com/blog/memory-and-energy-saver-mode) |
| A hidden tab | Paused; on mobile, often frozen or discarded | [Page Lifecycle API](https://developer.chrome.com/docs/web-platform/page-lifecycle-api) |

The study's kit and `Tycho.loop.Stepper` both run fixed steps from the real elapsed time, so a 30 fps page plays at the right speed with half the frames drawn ([the core](../core.md)). A loop that steps once per callback runs at half speed in Low Power Mode, which is the bug Chrome's post warns about.

**Heat.** Phones slow down over minutes of load. Notebookcheck runs 3DMark's stress test 20 times in a row and reports the worst run against the best:

| Phone | Wild Life stress stability | Notes |
|---|---|---|
| iPhone 15 Pro | 84.9% | Wild Life Extreme 95.9% |
| iPhone 15 | 76.3% | The SoC "slowed by a minimum of 15.7% and up to 24.7%"; surface peak 43.7 °C |
| iPhone SE 2022 | 79.5% | |
| Galaxy A53 | 99.6% | A slow chip that never heats up |
| Pixel 6a | 42.9% | "quickly throttled under high load", "more than 55% in the worst case" |

That's a GPU test, and a 320×180 canvas game is far lighter than 3DMark. But the lesson carries: a phone that tops a short benchmark can lose half its speed after ten minutes *(inference)*. The bench card's three-second frame watch can't show this. Running it again after ten minutes of play would.

**Battery.** Halving the frame rate is the largest saving a game controls. Yan, He, Liu and Huang (Microsoft Research, HotPower 2015) measured ten Android games on a Nexus 5 with a Monsoon power monitor. Dropping from 60 to 30 fps cut whole-system power by **33.3% on average, from 16.0% to 55.7%**, and by 43.4% in 3D games. Dropping on to 0 fps saved little more, because the screen and CPU remain. Thirty-five of their forty games rendered at a fixed 60 fps whatever was happening, and 29 of 40 went fully or nearly static when the player stopped touching ([Yan et al. 2015](https://engineering.purdue.edu/~hotpower/HotPower_2015_paper_6.pdf)). Unity defaults mobile games to about 30 fps "due to need to conserve battery power" ([Unity docs](https://docs.unity3d.com/540/Documentation/ScriptReference/Application-targetFrameRate.html)).

For Elsewhere, that means *(inference)*:

- Simulate at 30 Hz, as the kit already does.
- Draw only when something changed. A talk scene, a still market or a paused puzzle can stop drawing entirely between inputs and idle animations.
- Use 60 Hz or the display's rate only for quests that scroll or chase.

## Memory and canvas limits

**Canvas size.** WebKit's own iOS tests print "Canvas area exceeds the maximum limit (width * height > 16777216)", which is 4096×4096 pixels ([WebKit test expectation](https://webkit.googlesource.com/WebKit/+/7b85620e1b56e83a406bb98bc219536f37bdbbe1/LayoutTests/platform/ios/fast/canvas/canvas-too-large-to-draw-expected.txt)). One developer measured that limit on iOS 17.7 and found it raised to 8192×8192 (67,108,864 pixels) on iOS 18.0, with the canvas-size package on several phones ([lionpuro, 2025](https://lionpuro-com.pages.dev/posts/canvas-is-finally-usable-on-safari)). MDN still gives 4096×4096 for iOS and notes that exceeding the limit "renders the canvas unusable — drawing commands will not work" ([MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/canvas)). A 320×180 frame, or a whole 512×512 world as one canvas, is far inside either limit.

**Total canvas memory.** Safari also caps all live canvases together and warns "Total canvas memory use exceeds the maximum limit". One developer reports "It's limited to 384MB on version 15", lower before and probably by device ([pqina](https://pqina.nl/blog/total-canvas-memory-use-exceeds-the-maximum-limit/)). Apple publishes no number. Canvases also outlive their references on iOS: WebKit bug 195325 found unreferenced canvases weren't collected promptly, and setting their width and height to 0 first avoided it ([WebKit bug 195325](https://bugs.webkit.org/show_bug.cgi?id=195325)). So a game that makes and drops chunk canvases should shrink each one to 1×1 before letting it go.

**The process limit.** Simon Fraser of WebKit, in 2024: "WebContent processes on iPhone are subject to a "soft" limit of around 1.5GB", past which they "are subject to getting killed by "jetsam""; "It will be somewhat lower on iPhone models with less RAM" ([WebKit bug 277848](https://bugs.webkit.org/show_bug.cgi?id=277848)). A killed tab reloads at once, and if it happens again Safari shows "A problem repeatedly occurred". Pages get no warning and no documented budget, which WebKit bug 300782 asks for ([WebKit bug 300782](https://bugs.webkit.org/show_bug.cgi?id=300782)). On Android, Chrome "kills background tabs aggressively in order to ensure memory usage is low" ([Chrome, tab discarding](https://developer.chrome.com/blog/tab-discarding/)).

**Being killed is normal on a phone,** so a game must save as it goes. The Page Lifecycle guide says to "treat the hidden state as the likely end to the user's session"; on mobile "the beforeunload, pagehide, and unload events are not fired" when a tab or the app is closed; and a discarded page can check `document.wasDiscarded` when it comes back ([Page Lifecycle API](https://developer.chrome.com/docs/web-platform/page-lifecycle-api)). Elsewhere's save should therefore be written on `visibilitychange` to hidden, not on unload *(inference)*.

What the numbers mean in bytes *(inference)*:

| Thing | Bytes |
|---|---|
| A 320×180 canvas | 230 KB |
| A 256×256 world as palette indexes (`Uint8Array`) | 64 KB |
| The same world as an RGBA canvas | 256 KB |
| A 512×512 world as indexes / as RGBA | 256 KB / 1 MB |
| Merryfolk's chunk cache at its cap (112 chunks of 512×512 RGBA) | about 117 MB ([the zoom notes](notes/lod_zoom_chunks.md)) |
| [The zoom page's](zoom.md) proposed three levels × 64 chunks of 128×128 | about 12 MB |

Elsewhere's frames are tiny. The risk is a cache. So count canvas bytes as w × h × 4 and cap the total (64 MB is a safe line on iOS), keep worlds as indexes, and bake RGBA only near the camera *(inference)*.

## GPU APIs on phones

| Feature | Safari / iOS | Chrome | Source |
|---|---|---|---|
| WebGL2 | Safari 15 (2021), on Metal | Long since | [WebKit, Safari 15](https://webkit.org/blog/11989/new-webkit-features-in-safari-15/) |
| ES modules in workers | Safari 15 | Chrome 80 | same; [web.dev, module workers](https://web.dev/articles/module-workers) |
| OffscreenCanvas, 2D, in workers | Safari 16.4 (2023) | Chrome 69 (2018) | [WebKit, Safari 16.4](https://webkit.org/blog/13966/webkit-features-in-safari-16-4/); [WebKit bug 253431](https://bugs.webkit.org/show_bug.cgi?id=253431) |
| OffscreenCanvas with WebGL | Safari 17.0 (2023) | Chrome 69 | [WebKit, Safari 17.0](https://webkit.org/blog/14445/webkit-features-in-safari-17-0/) |
| Compression Streams | Safari 16.4 | Chrome 80 | [Chrome, Compression Streams](https://developer.chrome.com/blog/compression-streams-api/) |
| WebGPU | Safari 26 (iOS 26, September 2025) | Chrome 121 on Android 12+ with Qualcomm and ARM GPUs (January 2024) | [WebKit, WWDC25](https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/), [Chrome, WebGPU 121](https://developer.chrome.com/blog/new-in-webgpu-121) |

For WebGPU, WebKit says it "supersedes WebGL on macOS, iOS, iPadOS, and visionOS and is preferred for new sites". Safari 16.4's half-done OffscreenCanvas (2D only) broke Construct 3's feature detection. A later report found WebGL in workers worked on Safari 17.1 on one macOS version and not the one before, so feature-detect inside the worker, not on the page ([WebKit bug 183720](https://bugs.webkit.org/show_bug.cgi?id=183720)).

For Tycho, this means *(inference)*:

- The GPU stand-in's WebGL2 path ([the renderer](../renderer.md)) is safe on every iPhone from iOS 15.
- A worker can paint with OffscreenCanvas 2D on iOS 16.4 and later.
- WebGPU reaches only iOS 26 and later, and only some Android GPUs, so it stays an option, never a requirement, for some years.

## Generation off the main thread

A worker made from a Blob URL needs no extra file: the job's source is put in a string, wrapped in a `Blob`, and handed to `new Worker(URL.createObjectURL(blob))`. The demo does this with the same function the page runs. The job reads nothing from the page, so its `toString()` runs unchanged in the worker.

<figure class="demo"><div class="stage" data-demo="worker-gen"></div>
<figcaption><b>Generation off the main thread.</b> One seeded world (noise, priority-flood, flow, paint into palette indexes) made three ways. <i>Main thread</i> runs it in one go and the windmill and ball stop. <i>Worker</i> starts a fresh worker from a Blob URL, sends it the size and seed, and gets the map back as a transferred buffer, while the animation never misses a frame. <i>Sliced</i> steps the same generator for at most 6 ms per animation frame on the main thread: smooth, but slower overall. The strip plots the gap before each frame, red past 50 ms. Each way's timings are below the controls: startup, work and the transfer back.</figcaption></figure>

On the laptop at 512×512, from runs of the demo (measured):

| Way | Work | Wall time | Longest frame gap |
|---|---|---|---|
| Main thread | 122–137 ms | the same | 124–139 ms (a visible hitch) |
| Worker (fresh) | 133–138 ms | 142–156 ms, including 7.5–13.6 ms of startup and 0.2–3.6 ms to transfer the map back | 18 ms |
| Sliced, 6 ms a frame | 140–148 ms | 368–374 ms over 22–23 frames | 18 ms |

A warm worker made from the same Blob URL started in a median of 5.1 ms over five starts (measured). At four times slower, the main-thread run is a half-second freeze on a budget phone. The worker costs one startup and a near-free transfer *(inference)*.

The sources agree:

- Transferring an `ArrayBuffer` is "extremely fast and independent of the size". Structured-cloning objects "up to 100KiB" stays within a frame budget "even on the slowest devices", and "everything up to 10KiB will not pose a risk" ([Surma, 2019](https://surma.dev/things/is-postmessage-slow/)).
- Worker startup measured about 40 ms on a 2015 Firefox OS phone, so make few workers and reuse them ([Mozilla Hacks, 2015](https://hacks.mozilla.org/2015/07/how-fast-are-web-workers/)).
- `performance.now()` in a worker counts from the worker's own start, so the demo compares threads with `performance.timeOrigin + performance.now()` ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Performance/now)).

**SharedArrayBuffer** would let a worker and the page share a world without copying. But it needs cross-origin isolation, which needs two response headers (COOP and COEP), and GitHub Pages can't send custom headers. The known workaround, coi-serviceworker, adds the headers from a service worker. The catch: "This script will reload the page on the user's first load", it must be its own file on the same origin, and it needs HTTPS ([coi-serviceworker](https://github.com/gzuidhof/coi-serviceworker)). Elsewhere already has a service worker ([installable games](../installable.md)), so this is possible. But generation doesn't need it: a world goes one way, once, and transferring its buffers is free *(inference)*. Keep SharedArrayBuffer for a simulation that both threads touch every frame, if one ever appears.

**Sliced generation** needs no worker at all. Writing the job as a generator that yields every few rows lets one function run three ways: to completion, in a worker, or a slice per frame under a millisecond budget, as the demo does. Merryfolk paints its ground the same way ([the zoom notes](notes/lod_zoom_chunks.md)). Slicing pays in wall time (2.7 times here, because 6 of every 16.7 ms go to the job), so use it for small, low-priority work such as chunks off screen, and use a worker for anything the player waits for *(inference)*.

**How many workers.** WebKit clamps `navigator.hardwareConcurrency` (caniuse says at most 2 on iOS and 8 elsewhere; sources disagree), so a pool can't be sized from it on an iPhone ([caniuse](https://caniuse.com/hardwareconcurrency)). One worker for generation is enough for a quest at a time *(inference)*.

## Saving worlds

A seeded world never has to be saved, only its seed and what the player changed. Generated chunks are a cache, and the browser treats storage the same way.

<figure class="demo"><div class="stage" data-demo="storage"></div>
<figcaption><b>Keeping a chunk.</b> What this browser reports: the storage estimate (used and allowed), whether the site's storage is persistent, whether the page runs installed, and whether it can compress. <i>Round trip</i> makes a 256×256 world (64 KB of palette indexes), compresses it with <code>CompressionStream</code>, writes it to IndexedDB, reads it back, decompresses it, checks every byte, and does the same through <code>localStorage</code> as base64. The map shown is the copy read back. <i>Ask to persist</i> calls <code>navigator.storage.persist()</code>; <i>Clear</i> removes everything the demo stored.</figcaption></figure>

On the laptop, one round trip (measured): 65.5 KB of indexes compressed to **5.0 KB** with deflate-raw (8%), 6.7 KB as base64. Compressing took 7.2 ms, the first IndexedDB open (creating the database) 107 ms, the write 5.1 ms, the read 0.9 ms, decompressing 0.6 ms, and a localStorage write and read of the base64 1.0 ms. Every byte matched. Indexed maps with large flat areas compress well, so a whole 512×512 world fits in about 20 KB, and even localStorage could hold dozens *(inference)*.

The limits:

| Store | Limit | Kept how long | Source |
|---|---|---|---|
| localStorage | About 5 MiB a site (MDN also says 10 MiB at most); strings only, synchronous; over the limit throws `QuotaExceededError` | Best effort | [MDN, storage quotas](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) |
| IndexedDB, Safari 17+ / iOS 17+ | Up to 60% of the disk per site, 80% for all sites, in a browser; the same for a Home Screen web app; 15% inside other apps' web views | Best effort, evicted least recently used, whole site at once | [WebKit, storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/) |
| IndexedDB, before Safari 17 | 1 GB to start, then Safari asked the user | | same |
| IndexedDB, Chrome | Up to 60% of the disk per site, 80% for the browser | Best effort unless persistent | MDN |
| IndexedDB, Firefox | The smaller of 10% of the disk or 10 GiB; persistent up to 50% | | MDN |

**Seven days.** Since 2020, Safari deletes all of a site's script-written storage (IndexedDB, localStorage, sessionStorage, service worker registrations and caches) "after seven days of Safari use without user interaction on the site". Home Screen web apps aren't part of Safari: they keep their own day count, reset each time the app is used, and WebKit does "not expect the first-party in such a web application to have its website data deleted" ([WebKit, 2020](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/)). MDN words it as "no user interaction, such as click or tap, in the last seven days of browser use". A player who leaves Elsewhere for a fortnight in a Safari tab can come back to no save. One who installed it keeps it.

**Persistence.** `navigator.storage.persist()` asks the browser to keep a site's data until the user clears it. Safari and Chrome decide silently "based on the user's history of interaction with the site", and Firefox prompts (MDN). WebKit grants it "based on heuristics like whether the website is opened as a Home Screen Web App" ([WebKit](https://webkit.org/blog/14403/updates-to-storage-policy/)). Asking from a browser tab on iOS will usually get no. Asking from the installed game should get yes *(inference)*.

So, for Elsewhere *(inference)*:

- **The save** (seed, quest states, the pack, the log, the player's edits) stays small and goes in localStorage, as Tycho's shell storage already does ([the shell](../shell.md)). Write it on `visibilitychange` to hidden.
- **Generated chunks and regions** go in IndexedDB as compressed index bytes, keyed by seed and position. Any missing key means regenerate, so eviction costs time, never progress.
- **Ask for `persist()`** once the game runs installed, and after the player has played a while.
- **Nudge players to install** before a long absence. On iOS it's the difference between a save that lasts and one deleted after a week.

## Measuring on a phone

**The clock is coarse.** `performance.now()` is rounded to 5 µs in a cross-origin-isolated page and 100 µs otherwise ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Performance/now)). A 2021 Chromium intent said desktop Safari and Firefox rounded to 1 ms ([blink-dev](https://groups.google.com/a/chromium.org/g/blink-dev/c/k6M3HJiqmkE)). So time anything shorter than a few milliseconds in batches: repeat until 100 to 200 ms have passed and divide, as the bench card does. The card also reports the smallest step its clock takes. Headless Chrome on the laptop showed 0.1 ms (measured).

**Frames, not tasks.** The reliable signal on every browser is the gap between `requestAnimationFrame` callbacks. Its median gives the refresh rate (16.7 ms at 60 Hz, 8.3 at 120, 33.3 in Low Power Mode), and its long tail gives hitches. `Tycho.loop.Samples` already keeps a window of frame times with percentiles, and the dev drawer has a frame line ([the core](../core.md), [the dev tools](../dev.md)). Chrome 123 added the Long Animation Frames API, which reports any frame whose rendering was "delayed beyond 50 milliseconds" with the scripts to blame. Safari and Firefox don't support it ([Chrome for Developers](https://developer.chrome.com/docs/web-platform/long-animation-frames)), so it can only be a desktop-Chrome extra.

**Remote debugging.**

- **iPhone:** turn on Settings > Safari > Advanced > Web Inspector, connect the phone to a Mac by cable (or wireless debugging set up in Xcode), and pick the page in the Mac Safari's Develop menu. Its Timelines tab profiles the page and, since Safari 26, each worker separately ([WebKit, Enabling Web Inspector](https://webkit.org/web-inspector/enabling-web-inspector/), [WebKit, WWDC25](https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/)).
- **Android:** `chrome://inspect` over USB with USB debugging on ([Chrome DevTools, remote debugging](https://developer.chrome.com/docs/devtools/remote-debugging)).

**Without cables,** the bench card's *Copy results* gives the numbers as plain text to paste anywhere. A game's dev drawer could do the same with its frame line and a run of the card's jobs *(inference)*.

**What to collect.** Run the card on at least one phone from each group: a recent iPhone, an older iPhone or the SE, and a budget Android such as a Galaxy A-series or Moto G. Run it once fresh and once after ten minutes of a quest, to see the heat. Those six numbers would replace every estimate in [A budget for generation and frames](#a-budget-for-generation-and-frames) *(inference)*.

## What it means for Tycho

Tycho already has a fixed-step loop with real `dt` and a step cap (`Stepper`), frame percentiles (`Samples`), a quality governor (`Governor`), a chunk cache that paints ahead under a millisecond budget (`Chunks.ahead`), shell storage that never throws, and a service worker. What it lacks, each as an option any game can use *(inference)*:

| Proposed | What it does | Why |
|---|---|---|
| `work`, a job runner | Runs one self-contained job function three ways: in a worker made from a Blob URL (one, reused), sliced across frames under a ms budget, or to completion; results come back as transferred typed arrays | A 512×512 world is half a second on a budget phone; this keeps the frame smooth with no extra file to ship |
| A byte budget for `Chunks` | Counts each cached canvas as w × h × 4, trims to a byte cap, and shrinks evicted canvases to 1×1 | iOS kills the tab near 1.5 GB and caps canvas memory without saying so |
| A chunk store | IndexedDB keyed by seed and chunk, compressed with `CompressionStream`, where a miss means regenerate | Saves regeneration time across visits and survives eviction by design |
| Save on hide | The shell writes the game's save on `visibilitychange` to hidden, and reports `document.wasDiscarded` | Mobile browsers don't fire unload; tabs are killed in the background |
| An idle frame rate | The loop stops drawing when a game says nothing moved, and can render at 30 Hz | 30 fps saves a third of system power on average (Yan et al.) |
| A bench in the dev drawer | The card's jobs and frame watch, with a copy button | Real phone numbers from playtesters, without cables |

None of these changes a default, so the three games keep their behavior.

## Sources

- Notebookcheck reviews (browser benchmarks and stress tests): [iPhone 17 Pro](https://www.notebookcheck.net/Apple-iPhone-17-Pro-review-Faster-longer-further-Is-that-enough.1140998.0.html), [iPhone 15](https://www.notebookcheck.net/Apple-iPhone-15-smartphone-in-review-The-Apple-phone-finally-zooms-in-closer.762555.0.html), [Pixel 6a](https://www.notebookcheck.net/Google-Pixel-6a-review-Powerful-mid-range-smartphone-with-a-small-display-handicap.657128.0.html), [Moto G15](https://www.notebookcheck.net/A-stylish-bargain-Motorola-Moto-G15-smartphone-review.997054.0.html)
- [JetStream 2.2](https://browserbench.org/JetStream2.2/), run on the reference laptop
- WebKit: [Safari 15](https://webkit.org/blog/11989/new-webkit-features-in-safari-15/), [Safari 16.4](https://webkit.org/blog/13966/webkit-features-in-safari-16-4/), [Safari 17.0](https://webkit.org/blog/14445/webkit-features-in-safari-17-0/), [Safari 26 (WWDC25)](https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/), [Updates to Storage Policy](https://webkit.org/blog/14403/updates-to-storage-policy/), [Full Third-Party Cookie Blocking and More](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/), [Enabling Web Inspector](https://webkit.org/web-inspector/enabling-web-inspector/)
- WebKit Bugzilla: [277848 (the 1.5 GB soft limit)](https://bugs.webkit.org/show_bug.cgi?id=277848), [300782 (kill and reload)](https://bugs.webkit.org/show_bug.cgi?id=300782), [215745 (Low Power Mode 30 fps)](https://bugs.webkit.org/show_bug.cgi?id=215745), [195325 (canvas collection)](https://bugs.webkit.org/show_bug.cgi?id=195325), [183720 (OffscreenCanvas)](https://bugs.webkit.org/show_bug.cgi?id=183720); [the iOS canvas-area test](https://webkit.googlesource.com/WebKit/+/7b85620e1b56e83a406bb98bc219536f37bdbbe1/LayoutTests/platform/ios/fast/canvas/canvas-too-large-to-draw-expected.txt); [the Low Power Mode rAF test](https://webkit.googlesource.com/WebKit/+/328c7059694d84abb840ac5bccc406a3f989793f/LayoutTests/fast/animation/request-animation-frame-throttling-lowPowerMode.html)
- [lionpuro, Canvas is finally usable on Safari (2025)](https://lionpuro-com.pages.dev/posts/canvas-is-finally-usable-on-safari) and [pqina, Total canvas memory use exceeds the maximum limit](https://pqina.nl/blog/total-canvas-memory-use-exceeds-the-maximum-limit/)
- MDN: [Storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria), [performance.now()](https://developer.mozilla.org/en-US/docs/Web/API/Performance/now), [the canvas element](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/canvas)
- Chrome for Developers: [Page Lifecycle API](https://developer.chrome.com/docs/web-platform/page-lifecycle-api), [Memory and Energy Saver](https://developer.chrome.com/blog/memory-and-energy-saver-mode), [Long Animation Frames](https://developer.chrome.com/docs/web-platform/long-animation-frames), [Compression Streams](https://developer.chrome.com/blog/compression-streams-api/), [tab discarding](https://developer.chrome.com/blog/tab-discarding/), [remote debugging](https://developer.chrome.com/docs/devtools/remote-debugging)
- [Yan, He, Liu and Huang, Optimizing Power Consumption of Mobile Games, HotPower 2015](https://engineering.purdue.edu/~hotpower/HotPower_2015_paper_6.pdf)
- [Unity, Application.targetFrameRate](https://docs.unity3d.com/540/Documentation/ScriptReference/Application-targetFrameRate.html)
- [Surma, Is postMessage slow? (2019)](https://surma.dev/things/is-postmessage-slow/) and [Mozilla Hacks, How fast are web workers? (2015)](https://hacks.mozilla.org/2015/07/how-fast-are-web-workers/)
- [coi-serviceworker](https://github.com/gzuidhof/coi-serviceworker)
- [Popmotion, When iOS throttles requestAnimationFrame](https://popmotion.io/blog/20180104-when-ios-throttles-requestanimationframe), [Tom's Guide, 120 Hz in Safari](https://www.tomsguide.com/phones/iphones/enable-120hz-safari-on-iphone), [caniuse, hardwareConcurrency](https://caniuse.com/hardwareconcurrency)
- Merryfolk's chunk budget and memory, via [the zoom notes](notes/lod_zoom_chunks.md)

The full research is in the note on [phone performance](notes/phone_performance.md).

<script src="demos/kit.js"></script>
<script src="demos/phones-shared.js"></script>
<script src="demos/phone-bench.js"></script>
<script src="demos/worker-gen.js"></script>
<script src="demos/storage.js"></script>
<script src="demos/start.js"></script>
