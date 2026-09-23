// Y04. The route map sat on the same bare grid in all seven sectors, so a Blood Moon and a
// Machine Uprising looked alike until you read the badge. It is drawn over the front now: the home
// picture of the faction the front leans the roads toward, the open road for the two fronts that
// lean on none, the front's own sky as a wash over either, and in the last sector - which is not a
// road sector - the commander's arena the road ends at.
//
// THE ROADS WERE THE COST, AND THE ROWS THAT HOLD THEM ARE MEASURED IN PIXELS. On the bare grid a
// grey road read at 2.2:1 against the dark behind it. Over the pictures that dark is gone, and the
// same road fell to 1.3:1 under the smog - a map you plan on, with the plan drawn in lines you can
// barely see. Every road still in play is drawn over a dark casing now, as a printed map draws its
// roads, and these rows read each road's centre against what is either side of it as painted.
//
// And the picture each front gets is held against what the roads CARRY, counted off generated
// maps, rather than against the field the map reads it from - a row that compared the map with
// the table would pass on a table that was wrong.
module.exports = {
  name: 'A map that looks like the front',
  run: async ({ page, ok, base, engineUp, resized, until }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);
    await resized(page, { width: 390, height: 844 });

    // A sector on the map, settled: the map scrolls itself to the squad a moment after it draws,
    // and the picture has to be decoded before a pixel of it means anything.
    const onMap = async (sector, front, opts = {}) => {
      const art = await page.evaluate(({ sector, front, opts }) => {
        localStorage.clear(); currentSlot = 1; loadMeta(); promptsOn = false; confirmNewGame(1.0);
        currentSector = sector - 1; crossSector(); sectorFront = front; frontBannerPending = false;
        sectorMap = generateSectorMap(mulberry32(seedFromString(`y04|${sector}|${opts.seed || front}`)));
        clearedNodeIds = []; currentNodeId = null;
        if (opts.secured) currentTier = TOTAL_TIERS + 1;
        renderMap();
        document.getElementById('front-banner').classList.remove('front-banner-show');
        const vp = document.getElementById('map-nodes');
        const art = vp.style.getPropertyValue('--map-art').replace(/^url\(['"]?|['"]?\)$/g, '');
        window.__y04 = { top: null, still: 0, ready: false };
        const img = new Image(); img.src = art;
        img.decode().then(() => { window.__y04.ready = true; }, () => { window.__y04.ready = true; });
        return art;
      }, { sector, front, opts });
      await until(page, () => {
        const s = document.getElementById('map-nodes').scrollTop, w = window.__y04;
        w.still = w.top === s ? w.still + 1 : 0; w.top = s;
        return w.ready && w.still >= 2;
      }, `the map of sector ${sector} under ${front} to settle`);
      return art;
    };
    const FRONT_IDS = await page.evaluate(() => FRONTS.map(f => f.id));

    // ---- which picture: what the roads carry, counted, not what the table says ----
    const road = await page.evaluate(() => {
      localStorage.clear(); currentSlot = 1; loadMeta(); confirmNewGame(1.0); sectorFront = null;
      currentSector = 1; currentTier = openingTier(); initiateCombat('RAIDERS', false); combatActive = false;
      return combatBgFile;
    });
    const heavy = await page.evaluate(() => {
      localStorage.clear(); currentSlot = 1; loadMeta(); confirmNewGame(1.0); currentSector = 4;
      // The roads' factions and the roads' weather, off the same maps. A front's sky is the one
      // its roads are under several times as often as roads with no front are: 4.8x and up for
      // the four that tilt one, 1.7x at most for the three that do not.
      const count = front => {
        sectorFront = front; const c = {}, w = {}; let n = 0;
        for (let i = 0; i < 40; i++)
          generateSectorMap(mulberry32(seedFromString(`y04-count|${front}|${i}`))).nodes
            .filter(x => FACTIONS[x.type]).forEach(x => { c[x.type] = (c[x.type] || 0) + 1; w[x.weather] = (w[x.weather] || 0) + 1; n++; });
        return { c, w, n };
      };
      const none = count(null);
      const top = (m, key, ids) => {
        let best = null, lift = 0;
        for (const k of ids) { const l = ((m[key][k] || 0) / m.n) / (((none[key][k] || 0) + 1) / none.n); if (l > lift) { lift = l; best = k; } }
        return { best, lift };
      };
      return Object.fromEntries(FRONTS.map(f => {
        const m = count(f.id), fa = top(m, 'c', Object.keys(FACTIONS)), sk = top(m, 'w', WEATHER_IDS.filter(x => x !== 'CLEAR'));
        return [f.id, { faction: fa.lift >= 1.5 ? fa.best : null, lift: +fa.lift.toFixed(2), home: fa.lift >= 1.5 ? FACTIONS[fa.best].bg : null,
                        sky: sk.lift >= 3 ? sk.best : null, tint: sk.lift >= 3 ? WEATHER[sk.best].fx.tint.slice(0, 3).join(', ') : '0, 0, 0' }];
      }));
    });
    const shown = {}, washed = {};
    for (const f of FRONT_IDS) {
      shown[f] = await onMap(3, f);
      washed[f] = await page.evaluate(() => document.getElementById('map-nodes').style.getPropertyValue('--map-tint').trim());
    }
    const wrong = FRONT_IDS.filter(f => shown[f] !== (heavy[f].home || road));
    ok(`each front is drawn as the place its roads are heavy with, counted over 40 maps each (${FRONT_IDS.map(f => `${f.toLowerCase()} ${heavy[f].faction ? heavy[f].faction.toLowerCase() + ' x' + heavy[f].lift : 'none'}`).join(', ')})`,
      wrong.length === 0 && FRONT_IDS.filter(f => heavy[f].faction).length === 5);
    ok(`and the two that lean on no faction are the open road, the picture the opening fight is drawn on (${road})`,
      FRONT_IDS.filter(f => !heavy[f].faction).every(f => shown[f] === road));
    ok(`each is washed in the sky its roads are counted under, and a front that tilts no sky is not washed (${FRONT_IDS.filter(f => heavy[f].sky).map(f => `${f.toLowerCase()} ${heavy[f].sky.toLowerCase()}`).join(', ')})`,
      FRONT_IDS.every(f => washed[f] === heavy[f].tint) && FRONT_IDS.filter(f => heavy[f].sky).length === 4);

    // ---- the last sector is not a road sector ----
    const last = await page.evaluate(() => ({ final: FINAL_SECTOR, arena: FINAL_BOSS.bg,
      arenas: [...new Set(BOSS_POOL.map(b => b.bg).filter(Boolean))] }));
    const lastShown = {};
    for (const f of FRONT_IDS) lastShown[f] = await onMap(last.final, f, { seed: 'last' });
    ok(`the last sector shows the arena the road ends at, under every front (${last.arena})`,
      FRONT_IDS.every(f => lastShown[f] === last.arena));
    ok('and no road sector shows a commander’s arena', Object.values(shown).every(a => !last.arenas.includes(a)));

    // ---- only what is drawn ----
    const files = [...new Set([road, ...Object.values(shown), ...Object.values(lastShown)])];
    const served = await page.evaluate(async files => {
      const out = [];
      for (const f of files) out.push({ f, listed: ASSET_LIST.includes(f), pending: PENDING_ART.includes(f), ok: (await fetch(f, { method: 'HEAD' })).ok });
      return out;
    }, files);
    ok(`every picture the map can show is drawn, listed and served (${files.length}: ${files.map(f => f.replace('bg_', '').replace('.webp', '')).join(', ')})`,
      served.every(s => s.listed && !s.pending && s.ok));

    // ---- a secured sector stands on the same ground as the route it ends ----
    const secured = await onMap(3, 'BLOOD_MOON', { secured: true });
    const securedText = await page.evaluate(() => document.getElementById('map-nodes').innerText);
    ok(`a secured sector keeps its picture (${secured})`, secured === shown.BLOOD_MOON && /SECURED/.test(securedText));

    // ---- the pixels ----
    // Three shots of the same settled map: as drawn; with only the labels taken out, so a road
    // crossing a label's box is not mistaken for its text; and with the whole route taken out,
    // which is the picture alone. The page decodes them and measures; nothing is assumed.
    const measure = async () => {
      const geo = await page.evaluate(() => {
        const vp = document.getElementById('map-nodes'), vb = vp.getBoundingClientRect();
        const svg = document.querySelector('.map-edges'), sb = svg.getBoundingClientRect();
        const X = v => sb.left + parseFloat(v) / 100 * sb.width, Y = v => sb.top + parseFloat(v);
        return {
          view: [vb.left + 2, vb.top + 2, vb.right - 2, vb.bottom - 2],
          lines: [...svg.querySelectorAll('line')].map(l => ({ cls: l.getAttribute('class'),
            x1: X(l.getAttribute('x1')), y1: Y(l.getAttribute('y1')), x2: X(l.getAttribute('x2')), y2: Y(l.getAttribute('y2')) })),
          nodes: [...document.querySelectorAll('.map-graph .map-node')].map(n => { const b = n.getBoundingClientRect();
            return { cx: b.left + b.width / 2, cy: b.top + b.height / 2, r: Math.max(b.width, b.height) / 2 + 8 }; }),
          labels: [...document.querySelectorAll('.map-graph .map-node')].map(n => { const l = n.querySelector('.node-lbl');
            if (!l || !l.innerText.trim()) return null; const b = l.getBoundingClientRect();
            return { locked: n.classList.contains('node-locked'), box: [b.left, b.top, b.right, b.bottom] }; }).filter(Boolean)
        };
      });
      const shot = async css => {
        const tag = css ? await page.addStyleTag({ content: css }) : null;
        const png = await page.screenshot();
        if (tag) await tag.evaluate(el => el.remove());
        return 'data:image/png;base64,' + png.toString('base64');
      };
      const a = await shot(null);
      const b = await shot('.node-lbl { color: transparent !important; text-shadow: none !important; }');
      const c = await shot('.map-graph { visibility: hidden !important; }');
      return page.evaluate(async ({ a, b, c, g }) => {
        const load = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src; });
        const [A, B, C] = await Promise.all([load(a), load(b), load(c)]);
        const cv = document.createElement('canvas'); cv.width = A.width; cv.height = A.height;
        const cx = cv.getContext('2d', { willReadFrequently: true });
        const read = I => { cx.drawImage(I, 0, 0); return cx.getImageData(0, 0, I.width, I.height).data; };
        const da = read(A), db = read(B), dc = read(C);
        const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
        const L = (d, x, y) => { const i = (Math.round(y) * A.width + Math.round(x)) * 4; return 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]); };
        const cr = (p, q) => (Math.max(p, q) + 0.05) / (Math.min(p, q) + 0.05);
        const v = g.view, inside = (x, y) => x >= v[0] && x <= v[2] && y >= v[1] && y <= v[3];
        const nearNode = (x, y) => g.nodes.some(n => Math.hypot(x - n.cx, y - n.cy) < n.r)
          || g.labels.some(l => x >= l.box[0] - 2 && x <= l.box[2] + 2 && y >= l.box[1] - 2 && y <= l.box[3] + 2);
        // Roads: each still in play, sampled every 3px along its centre, against the clearest edge
        // 2-4px out on either side - the casing's width - and the worse of the two sides counts.
        const roads = [];
        g.lines.filter(l => l.cls === 'edge-base').forEach(l => {
          const len = Math.hypot(l.x2 - l.x1, l.y2 - l.y1), nx = -(l.y2 - l.y1) / len, ny = (l.x2 - l.x1) / len;
          for (let s = 0; s <= len; s += 3) {
            const x = l.x1 + (l.x2 - l.x1) * s / len, y = l.y1 + (l.y2 - l.y1) * s / len;
            const far = [[x + 4 * nx, y + 4 * ny], [x - 4 * nx, y - 4 * ny]];
            if (!inside(x, y) || nearNode(x, y) || far.some(p => !inside(...p) || nearNode(...p))) continue;
            const c = L(da, x, y);
            const side = sg => Math.max(...[2, 3, 4].map(d => cr(c, L(da, x + sg * d * nx, y + sg * d * ny))));
            roads.push(Math.min(side(1), side(-1)));
          }
        });
        // Labels: the pixel the text moved furthest, against the median of what is behind it.
        const labels = g.labels.map(lb => {
          const [x0, y0, x1, y1] = lb.box.map(Math.round); const bg = []; let best = null, bestD = -1;
          for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
            if (!inside(x, y)) continue;
            const i = (y * A.width + x) * 4; bg.push(L(db, x, y));
            const d = Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]);
            if (d > bestD) { bestD = d; best = L(da, x, y); }
          }
          if (!bg.length) return null;
          bg.sort((p, q) => p - q);
          return { locked: lb.locked, c: cr(best, bg[Math.floor(bg.length / 2)]) };
        }).filter(Boolean);
        // What the map looks like with nothing on it, eight by eight, for telling two apart.
        const cells = [];
        for (let gy = 0; gy < 8; gy++) for (let gx = 0; gx < 8; gx++) {
          let r = 0, gg = 0, bb = 0, n = 0;
          for (let y = v[1] + (v[3] - v[1]) * gy / 8; y < v[1] + (v[3] - v[1]) * (gy + 1) / 8; y += 2)
            for (let x = v[0] + (v[2] - v[0]) * gx / 8; x < v[0] + (v[2] - v[0]) * (gx + 1) / 8; x += 2) {
              const i = (Math.round(y) * A.width + Math.round(x)) * 4; r += dc[i]; gg += dc[i + 1]; bb += dc[i + 2]; n++;
            }
          cells.push([r / n, gg / n, bb / n]);
        }
        const med = a => a.length ? a.slice().sort((p, q) => p - q)[Math.floor(a.length / 2)] : 0;
        return { roads: med(roads), roadN: roads.length, open: labels.filter(l => !l.locked).map(l => l.c),
                 locked: med(labels.filter(l => l.locked).map(l => l.c)), cells };
      }, { a, b, c, g: geo });
    };

    const px = {};
    for (const f of FRONT_IDS) { await onMap(3, f); px[f] = await measure(); }
    await onMap(last.final, 'IRRADIATED', { seed: 'last' }); px.LAST = await measure();
    const cases = [...FRONT_IDS, 'LAST'];
    const worstRoad = cases.reduce((w, k) => px[k].roads < px[w].roads ? k : w, cases[0]);
    ok(`the roads read over every picture as they did on the bare grid, 2.2:1 (median of each map at least 2.0, lowest ${px[worstRoad].roads.toFixed(2)} on ${worstRoad.toLowerCase()})`,
      cases.every(k => px[k].roadN >= 20 && px[k].roads >= 2.0));
    const openLabels = cases.flatMap(k => px[k].open);
    ok(`the nodes you can take keep their names readable (${openLabels.length} labels, lowest ${Math.min(...openLabels).toFixed(2)}:1)`,
      openLabels.length >= cases.length && Math.min(...openLabels) >= 4.5);
    const worstLocked = cases.reduce((w, k) => px[k].locked < px[w].locked ? k : w, cases[0]);
    ok(`and the ones you cannot take yet are no fainter than the bare grid drew them, about 1.2:1 (lowest median ${px[worstLocked].locked.toFixed(2)} on ${worstLocked.toLowerCase()})`,
      cases.every(k => px[k].locked >= 1.15));

    const dist = (a, b) => a.cells.reduce((s, c, i) => s + Math.abs(c[0] - b.cells[i][0]) + Math.abs(c[1] - b.cells[i][1]) + Math.abs(c[2] - b.cells[i][2]), 0) / (a.cells.length * 3);
    let closest = null;
    cases.forEach((p, i) => cases.slice(i + 1).forEach(q => { const d = dist(px[p], px[q]); if (!closest || d < closest.d) closest = { p, q, d }; }));
    ok(`every front looks unlike every other, and the last sector unlike all of them (closest pair ${closest.p.toLowerCase()} and ${closest.q.toLowerCase()}, ${closest.d.toFixed(1)} a channel)`,
      closest.d >= 3);
    ok(`the two fronts that share the road are told apart by their sky (${dist(px.IRRADIATED, px.QUIET_ROADS).toFixed(1)} a channel)`,
      shown.IRRADIATED === shown.QUIET_ROADS && dist(px.IRRADIATED, px.QUIET_ROADS) >= 3);
  }
};
