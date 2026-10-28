# Draws Tycho's logo: the mark, the wordmark and the lockup, as SVG (runs of
# one color merged into rects) and a 512-pixel PNG. The mark is a world being
# built: the Tycho moon half made, its finished side amethyst rock with the
# crater's rays, the rest still an orange lattice of latitude and longitude,
# an orange ring of light round it all, and a blue star at the build front,
# welding the seam. It's painted the way Lodestar is: surfaces in short
# strokes of close tones by how lit they are, light that glows in stepped
# bands, motes in the dark. Every choice is seeded, so it draws the same
# every time.
#
#   python3 docs/brand/make.py      (needs numpy and Pillow)
import math, os, random
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))

from PIL import Image

def hexrgb(h):
    h = h.lstrip('#'); return np.array([int(h[i:i+2], 16) for i in (0, 2, 4)], float)

class Pic:
    def __init__(self, w, h, seed=1):
        self.w, self.h = w, h
        self.c = np.zeros((h, w, 3)); self.a = np.zeros((h, w))
        self.em = np.zeros((h, w), bool)   # emissive pixels (they glow)
        self.emc = np.zeros((h, w, 3))
        self.rng = random.Random(seed)
    def put(self, x, y, col, a=1.0, em=False):
        if 0 <= x < self.w and 0 <= y < self.h:
            col = hexrgb(col) if isinstance(col, str) else np.asarray(col, float)
            na = a + self.a[y, x] * (1 - a)
            if na > 0: self.c[y, x] = (col * a + self.c[y, x] * self.a[y, x] * (1 - a)) / na
            self.a[y, x] = na
            if em: self.em[y, x] = True; self.emc[y, x] = col
    # surfaces: a mask, a ramp dark to light, and a light value per pixel
    def paint(self, mask, ramp, light, stroke=(2, 4), jitter=0.12, em=False):
        ramp = [hexrgb(r) for r in ramp]
        for y in range(self.h):
            x = 0
            while x < self.w:
                if not mask[y, x]: x += 1; continue
                n = self.rng.randint(*stroke)
                xs = [xx for xx in range(x, min(self.w, x + n)) if mask[y, xx]]
                v = sum(light[y, xx] for xx in xs) / len(xs) + self.rng.uniform(-jitter, jitter)
                i = max(0, min(len(ramp) - 1, int(round(v * (len(ramp) - 1)))))
                for xx in xs: self.put(xx, y, ramp[i], 1, em)
                x += n
    # a glow round every emissive pixel, in stepped bands, only where it's dark
    def glow(self, radius=6, strength=0.55, bands=4, under=True, only=None):
        ys, xs = np.nonzero(self.em if only is None else (self.em & only))
        if not len(xs): return
        acc = np.zeros((self.h, self.w)); col = np.zeros((self.h, self.w, 3))
        for y, x in zip(ys, xs):
            c = self.emc[y, x]
            for dy in range(-radius, radius + 1):
                for dx in range(-radius, radius + 1):
                    yy, xx = y + dy, x + dx
                    if not (0 <= yy < self.h and 0 <= xx < self.w): continue
                    d = math.hypot(dx, dy)
                    if d > radius: continue
                    f = (1 - d / radius) ** 1.6
                    acc[yy, xx] += f; col[yy, xx] += c * f
        mx = acc.max() or 1
        for y in range(self.h):
            for x in range(self.w):
                if acc[y, x] <= 0 or (under and self.a[y, x] > 0.99): continue
                v = min(1, acc[y, x] / (mx * 0.35)) * strength
                v = math.floor(v * bands + 0.5) / bands   # (stepped, like the game's light)
                if v <= 0: continue
                self.put(x, y, col[y, x] / acc[y, x], v * (1 - self.a[y, x]) if under else v)
    def motes(self, n, cols, cx, cy, r0, r1, alpha=(0.35, 1.0)):
        for _ in range(n):
            ang = self.rng.uniform(0, math.tau); r = self.rng.uniform(r0, r1)
            x = int(round(cx + math.cos(ang) * r)); y = int(round(cy + math.sin(ang) * r))
            if 0 <= x < self.w and 0 <= y < self.h and self.a[y, x] < 0.5:
                self.put(x, y, self.rng.choice(cols), self.rng.uniform(*alpha))
    def svg(self, path, scale=1, ground=None, label='Tycho'):
        q = lambda v: tuple(int(round(t)) for t in v)
        runs = {}
        for y in range(self.h):
            x = 0
            while x < self.w:
                a = round(self.a[y, x], 2)
                if a <= 0.01: x += 1; continue
                key = (q(self.c[y, x]), a); x0 = x
                while x < self.w and round(self.a[y, x], 2) == a and q(self.c[y, x]) == key[0]: x += 1
                runs.setdefault(key, []).append(f'M{x0} {y}h{x - x0}v1h-{x - x0}z')
        out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {self.w} {self.h}" width="{self.w * scale}" height="{self.h * scale}" shape-rendering="crispEdges" role="img" aria-label="{label}">']
        if ground: out.append(f'<rect width="{self.w}" height="{self.h}" fill="{ground}"/>')
        for (c, a), ds in sorted(runs.items(), key=lambda kv: -len(kv[1])):
            op = '' if a >= 0.99 else f' fill-opacity="{a}"'
            out.append(f'<path fill="#{c[0]:02x}{c[1]:02x}{c[2]:02x}"{op} d="{"".join(ds)}"/>')
        out.append('</svg>')
        open(path, 'w').write('\n'.join(out))
    def png(self, path, scale=6, ground='#07080d'):
        g = hexrgb(ground); img = np.zeros((self.h, self.w, 3))
        for y in range(self.h):
            for x in range(self.w):
                a = self.a[y, x]; img[y, x] = self.c[y, x] * a + g * (1 - a)
        Image.fromarray(img.clip(0, 255).astype('uint8')).resize((self.w * scale, self.h * scale), Image.NEAREST).save(path)

def grid(w, h):
    ys, xs = np.mgrid[0:h, 0:w]; return xs.astype(float), ys.astype(float)

W = H = 64
X, Y = grid(W, H)
X += 0.5; Y += 0.5   # (pixel centers)

def noise(seed, scale):
    rng = np.random.default_rng(seed)
    g = rng.random((H // scale + 2, W // scale + 2))
    ys, xs = Y / scale, X / scale
    x0, y0 = np.floor(xs).astype(int), np.floor(ys).astype(int)
    fx, fy = xs - x0, ys - y0
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a, b, c, d = g[y0, x0], g[y0, x0 + 1], g[y0 + 1, x0], g[y0 + 1, x0 + 1]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy

def sphere(cx, cy, r, lx=-0.6, ly=-0.62, lz=0.5):
    dx, dy = (X - cx) / r, (Y - cy) / r
    d2 = dx * dx + dy * dy
    nz = np.sqrt(np.clip(1 - d2, 0, 1))
    return d2 <= 1, (dx * lx + dy * ly + nz * lz), dx, dy

def stars(p, n, cols=('#59607a', '#8a93ad', '#c6ccdc', '#5fd8f0')):
    for _ in range(n):
        x, y = p.rng.randrange(W), p.rng.randrange(H)
        if p.a[y, x] == 0: p.put(x, y, p.rng.choice(cols), p.rng.uniform(0.25, 0.75))

RING_ORANGE_STAR_ELECTRIC = dict(corona=['#ffe9c2', '#ffb24a', '#ff7a1f', '#a8340e'], rays=['#ffffff', '#c8f4ff', '#55dcff', '#1f8cff'], rim=['#6a4632', '#e08a3c'], lights=['#5fd8f0', '#ffb030'], core='#9feaff')
GROUND = {
    'amethyst': ['#07050d', '#110c1e', '#1c1430', '#2a1f46', '#3a2c60', '#4f3e7e', '#6a569e', '#8c78bf', '#b3a2dc', '#ddd2f4'],
}

def forge(front='meridian', star=RING_ORANGE_STAR_ELECTRIC, seed=71, ground='amethyst'):
    p = Pic(W, H, seed)
    cx, cy, r = 32, 34, 21
    stars(p, 44)
    dx, dy = X - cx, Y - cy
    d = np.hypot(dx, dy); a = np.arctan2(dy, dx)
    m = d <= r
    # where the build front is, and the star working at it
    if front == 'meridian':      # built from the left, the seam a line of longitude
        lon0 = 0.32
        fx = cx + r * math.sin(lon0) * np.sqrt(np.clip(1 - (dy / r) ** 2, 0, 1))
        built = X < fx
        bx, by = cx + r * math.sin(lon0) * math.sqrt(1 - 0.72 ** 2), cy - 0.72 * r
    elif front == 'rising':      # built from the bottom up, the seam a line of latitude
        fy = cy - 0.18 * r
        built = Y > fy + 0.9 * np.cos(dx / r * math.pi / 2) * 0
        bx, by = cx - math.sqrt(r * r - (fy - cy) ** 2), fy
    else:                        # built in blocks: a stepped edge of 4-pixel cells
        cell = 4
        k = ((X // cell) * 7 + (Y // cell) * 13) % 11
        built = (X + (Y - cy) * 0.35 + k * 0.9) < cx + 6
        bx, by = cx - 7, cy - r + 1
    burst = math.atan2(by - cy, bx - cx)
    # the ring of light round the world, brightest at the star
    for y in range(H):
        for x in range(W):
            dd = d[y, x]
            if r - 0.2 < dd < r + 6:
                da = abs((a[y, x] - burst + math.pi) % math.tau - math.pi)
                kk = (1 - (dd - r) / 6) * (0.45 + 0.55 * max(0, 1 - da / 1.6))
                c = star['corona']
                if kk > 0.72: p.put(x, y, c[0], 1, em=True)
                elif kk > 0.5: p.put(x, y, c[1], 0.9, em=True)
                elif kk > 0.32: p.put(x, y, c[2], 0.55)
                elif kk > 0.18: p.put(x, y, c[3], 0.3)
    # the built part: the Moon, craters and Tycho's rays, lit cool from the star
    mm, l, sdx, sdy = sphere(cx, cy, r, lx=(bx - cx) / r * 0.9, ly=(by - cy) / r * 0.9, lz=0.45)
    maria = noise(3, 7)
    light = 0.3 + 0.62 * l - 0.15 * (maria > 0.58)
    for (qx, qy, qr) in [(24, 27, 3.0), (29, 43, 2.2), (19, 37, 1.8), (27, 19, 1.5), (35, 31, 1.9)]:
        dq = np.hypot(X - qx, Y - qy)
        light = np.where(dq < qr, light - 0.28 + 0.3 * ((X - qx + Y - qy) / (qr * 1.4)), light)
    tx, ty = 23, 41
    for ang in [-2.6, -1.9, -1.2, -0.55, 0.3, 1.0, 1.9, 2.7]:
        for kk in np.arange(3, 18, 0.4):
            xi, yi = int(tx + math.cos(ang) * kk), int(ty + math.sin(ang) * kk)
            if 0 <= xi < W and 0 <= yi < H: light[yi, xi] += 0.38 * (1 - kk / 18)
    light = np.where(np.hypot(X - tx, Y - ty) < 2.4, light + 0.45, light)
    p.paint(m & built, GROUND[ground], np.clip(light, 0, 1), jitter=0.06)
    p.put(tx - 1, ty - 1, '#ffffff'); p.put(tx, ty - 1, '#f4f8ff')
    # the part still to make: dark, crossed by the orange lines it's laid out on
    todo = m & ~built
    for y in range(H):
        for x in range(W):
            if todo[y, x]: p.put(x, y, '#07080e' if (x + y) % 2 else '#0a0b13')
    lines = np.zeros((H, W), bool)
    for k in range(-4, 5):                       # parallels: straight across, every 20 degrees
        yy = cy + r * math.sin(math.radians(k * 20))
        for x in range(W):
            yi = int(math.floor(yy))
            if 0 <= yi < H and todo[yi, x]: lines[yi, x] = True
    for k in range(-4, 5):                       # meridians: arcs, every 20 degrees
        lon = math.radians(k * 20)
        for t in np.linspace(-math.pi / 2, math.pi / 2, 400):
            xi, yi = int(math.floor(cx + r * math.sin(lon) * math.cos(t))), int(math.floor(cy + r * math.sin(t)))
            if 0 <= xi < W and 0 <= yi < H and todo[yi, xi]: lines[yi, xi] = True
    nodes = np.zeros((H, W), bool)
    for y in range(H):
        for x in range(W):
            if not lines[y, x]: continue
            n = sum(lines[y + j, x + i] for i, j in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= y + j < H and 0 <= x + i < W)
            if n >= 3: nodes[y, x] = True
            p.put(x, y, '#ffb24a' if n >= 3 else '#b4581c' if p.rng.random() < 0.8 else '#d8742a', 1, em=n >= 3)
    grid_em = nodes.copy()
    # blocks on their way in, beside the seam
    for _ in range(10):
        yy = p.rng.randint(int(cy - r * 0.8), int(cy + r * 0.8))
        cand = [x for x in range(W) if built[yy, x] and m[yy, x]]
        if not cand: continue
        x0 = max(cand) + p.rng.randint(1, 4)
        for ddx in (0, 1):
            for ddy in (0, 1): p.put(x0 + ddx, yy + ddy, GROUND[ground][7] if ddy == 0 else GROUND[ground][5])
    # the seam itself, lit blue where the star welds it
    for y in range(H):
        row = [x for x in range(W) if m[y, x] and built[y, x]]
        if row and m[y, min(W - 1, max(row) + 1)]:
            sx = max(row)
            near = math.hypot(sx - bx, y - by)
            p.put(sx, y, star['rays'][1] if near < 8 else star['rays'][2], 1, em=True)
    # the star
    for ddx in (-1, 0, 1):
        for ddy in (-1, 0, 1):
            if ddx or ddy: p.put(int(round(bx)) + ddx, int(round(by)) + ddy, star['core'], 1, em=True)
    rc = star['rays']
    for (ang, n) in [(0, 13), (math.pi / 2, 13), (math.pi, 13), (-math.pi / 2, 13), (math.pi / 4, 6), (-math.pi / 4, 6), (3 * math.pi / 4, 6), (-3 * math.pi / 4, 6)]:
        for kk in range(n):
            col = rc[0] if kk < 2 else rc[1] if kk < 4 else rc[2] if kk < 8 else rc[3]
            p.put(int(round(bx + math.cos(ang) * kk)), int(round(by + math.sin(ang) * kk)), col, 1 if kk < 8 else 0.7, em=True)
    p.glow(radius=6, strength=0.55, bands=4, only=~grid_em)
    p.glow(radius=2, strength=0.4, bands=2, only=grid_em)
    p.motes(30, [star['rays'][2], star['corona'][1]], bx, by, 3, 12)
    return p

# the wordmark: TYCHO in a squared pixel face, 9 rows, two tones and a lit edge
GLYPHS = {
    'T': ['######', '######', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..'],
    'Y': ['##..##', '##..##', '##..##', '.####.', '..##..', '..##..', '..##..', '..##..', '..##..'],
    'C': ['.#####', '######', '##....', '##....', '##....', '##....', '##....', '######', '.#####'],
    'H': ['##..##', '##..##', '##..##', '######', '######', '##..##', '##..##', '##..##', '##..##'],
    'O': ['.####.', '######', '##..##', '##..##', '##..##', '##..##', '##..##', '######', '.####.'],
}
def word_paths(top, bot, edge):
    runs = {}
    for li, ch in enumerate('TYCHO'):
        for y, row in enumerate(GLYPHS[ch]):
            for x, c in enumerate(row):
                if c != '#': continue
                col = edge if (y == 0 or (x == 0 and y < 4)) else top if y < 4 else bot
                runs.setdefault(col, []).append(f'M{li * 8 + x} {y}h1v1h-1z')
    return [f'<path fill="{c}" d="{"".join(ds)}"/>' for c, ds in runs.items()]
def word_svg(top, bot, edge):
    return '\n'.join(['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 38 9" width="152" height="36" shape-rendering="crispEdges" role="img" aria-label="Tycho">'] + word_paths(top, bot, edge) + ['</svg>'])

if __name__ == '__main__':
    mark = forge()
    mark.svg(os.path.join(HERE, 'tycho-mark.svg'), label='Tycho')
    mark.png(os.path.join(HERE, 'tycho-512.png'), scale=8, ground='#05060a')
    light, dark = ('#c9d0e0', '#8692ac', '#f2f5fa'), ('#2a3042', '#171a25', '#3e4660')
    open(os.path.join(HERE, 'tycho-wordmark.svg'), 'w').write(word_svg(*light) + '\n')
    open(os.path.join(HERE, 'tycho-wordmark-dark.svg'), 'w').write(word_svg(*dark) + '\n')
    # the lockup: the mark, then the wordmark at three pixels to its one, centered
    inner = open(os.path.join(HERE, 'tycho-mark.svg')).read().split('\n')[1:-1]
    lock = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 186 64" width="372" height="128" shape-rendering="crispEdges" role="img" aria-label="Tycho">']
    lock += inner + ['<g transform="translate(72 19) scale(3)">'] + word_paths(*light) + ['</g>', '</svg>']
    open(os.path.join(HERE, 'tycho-lockup.svg'), 'w').write('\n'.join(lock) + '\n')
    # and for a light page, the wordmark dark
    lock = lock[:1 + len(inner) + 1] + word_paths(*dark) + ['</g>', '</svg>']
    open(os.path.join(HERE, 'tycho-lockup-on-light.svg'), 'w').write('\n'.join(lock) + '\n')
    print('drew tycho-mark.svg, tycho-512.png, tycho-wordmark.svg, tycho-wordmark-dark.svg, tycho-lockup.svg, tycho-lockup-on-light.svg')
