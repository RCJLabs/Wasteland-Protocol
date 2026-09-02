// A doctrine is a promise about the shape of the line, and for four doctrines running it was a
// promise nobody could make. Every one of the original four is a prohibition - no Medic, nobody
// carrying melee, nobody above 55 health, none of your three most-fielded classes - and each
// asks all three deployed slots to give something up at once. The line a player actually wants
// satisfies none of them, so the muster showed all three offers greyed with "the line as it
// stands does not keep this", and a draw of three from four was the same non-decision three
// times over.
//
// (The other half of the evidence, zero doctrines taken across 24 expeditions, turned out to be
// the simulator: its default draft policy had no branch that could take one, so the zero was
// guaranteed by the instrument rather than measured from the game. Repaired alongside this.)
//
// Three doctrines now ask for a composition instead. What this suite holds is the property the
// phase is FOR - that a line somebody would field keeps at least one of them - and then each
// new rule and each new edge, because a doctrine whose edge does nothing is a prohibition with
// extra steps.
module.exports = {
  name: 'Doctrines somebody can take',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    await page.evaluate(() => {
      // A line built by class, standing in the ranks given. Returns what each doctrine says.
      window.__line = (classes) => {
        currentSlot = 1; confirmNewGame(1.0);
        playerRoster.forEach(p => { p.gridPos = 0; });
        classes.forEach((cls, i) => {
          const c = playerRoster.find(p => p.classType === cls && p.gridPos === 0);
          if (c) c.gridPos = i + 1;
        });
        return playerRoster.filter(p => p.gridPos > 0).sort((a, b) => a.gridPos - b.gridPos);
      };
      window.__holds = (classes) => {
        const line = window.__line(classes);
        return Object.fromEntries(DOCTRINES.map(d => [d.id, !!d.holds(line)]));
      };
      // What the muster would actually put in front of you: a doctrine whose offerable() gate
      // is shut is not a live option however true its rule happens to be. CONSCRIPTS holds
      // vacuously on a save with no fielding history - every class is an unfamiliar one - and
      // counting that as an answer would let this suite pass on a doctrine nobody can be offered.
      window.__live = (classes) => {
        const line = window.__line(classes);
        return DOCTRINES.filter(d => (!d.offerable || d.offerable()) && d.holds(line)).map(d => d.id);
      };
    });

    // ── The table ────────────────────────────────────────────────────────────────────────
    const table = await page.evaluate(() => ({
      ids: DOCTRINES.map(d => d.id),
      complete: DOCTRINES.every(d => d.id && d.name && d.rule && d.edge
                                  && typeof d.holds === 'function' && d.bonus > 0),
      draw: DOCTRINE_DRAW,
      emptyLine: DOCTRINES.map(d => !!d.holds([]))
    }));
    ok(`${table.ids.length} doctrines, drawn ${table.draw} at a time`, table.ids.length >= 7 && table.draw === 3);
    ok('no two share an id', new Set(table.ids).size === table.ids.length);
    ok('every doctrine has a rule, an edge and a bonus', table.complete);
    ok('none of them holds for an empty line', table.emptyLine.every(h => h === false));

    // ── The property the phase is for ────────────────────────────────────────────────────
    // Not "some line somewhere keeps one" - lines a player would actually field.
    const wanted = await page.evaluate(() => {
      const lines = [
        ['BRUISER', 'MEDIC', 'SCAVENGER'],      // the roster as it starts
        ['BRUISER', 'MEDIC', 'PYROMANIAC'],
        ['SHOTGUNNER', 'MEDIC', 'SNIPER'],
        ['BRUISER', 'SCAVENGER', 'SNIPER'],
        ['SHOTGUNNER', 'HOUND', 'PYROMANIAC']
      ];
      mastery = {}; doctrineFavourites = [];
      return lines.map(l => ({ line: l.join('+'), kept: window.__live(l) }));
    });
    wanted.forEach(w => ok(`${w.line} keeps something (${w.kept.join(', ') || 'NOTHING'})`, w.kept.length > 0));
    ok('and none of them is keeping a doctrine the muster could not have offered',
       wanted.every(w => !w.kept.includes('CONSCRIPTS') && !w.kept.includes('OLD_GUARD')));
    ok('the old prohibitions are still hard - no line keeps three of them at once',
       wanted.every(w => ['FIELD_SURGERY', 'NO_HANDS', 'LIGHT_ORDER'].filter(id => w.kept.includes(id)).length < 3));

    // ── BROAD SPECTRUM: the line answers in all three types ──────────────────────────────
    const spec = await page.evaluate(() => ({
      medicPyro:  window.__holds(['BRUISER', 'MEDIC', 'PYROMANIAC']).BROAD_SPECTRUM,
      medicScav:  window.__holds(['BRUISER', 'MEDIC', 'SCAVENGER']).BROAD_SPECTRUM,
      allPhys:    window.__holds(['BRUISER', 'SHOTGUNNER', 'SNIPER']).BROAD_SPECTRUM,
      noEnergy:   window.__holds(['BRUISER', 'MEDIC', 'SHOTGUNNER']).BROAD_SPECTRUM,
      noBio:      window.__holds(['BRUISER', 'SCAVENGER', 'SNIPER']).BROAD_SPECTRUM
    }));
    ok('a bio carrier and an energy carrier keep BROAD SPECTRUM', spec.medicPyro && spec.medicScav);
    ok('three physical operators do not', !spec.allPhys);
    ok('nor does a line with nothing that lands energy', !spec.noEnergy);
    ok('nor one with nothing that lands bio', !spec.noBio);

    const seam = await page.evaluate(() => {
      const wall = (res) => ({ id: 'x', name: 'D', isPlayer: false, hp: 500, maxHp: 500, armor: 0,
        gridPos: 0, corrodedTurns: 0, oiledTurns: 0, venomStacks: 0,
        resistances: Object.assign({ phys: 0, bio: 0, energy: 0 }, res) });
      const shooter = { id: 'p', name: 'M', isPlayer: true, gridPos: 1, traits: [], augments: [] };
      const raider  = { id: 'e', name: 'R', isPlayer: false, gridPos: 0 };
      const hit = (atk, tgt) => mitigate(atk, tgt, 100, 'phys', 'PISTOL').n;
      const out = {};
      activeDoctrine = null; doctrineBroken = false;
      out.offPlain = hit(shooter, wall({ phys: 30 }));
      out.offImmune = hit(shooter, wall({ phys: 100 }));
      out.offWeak = hit(shooter, wall({ phys: -20 }));
      activeDoctrine = 'BROAD_SPECTRUM';
      out.onPlain = hit(shooter, wall({ phys: 30 }));
      out.onImmune = hit(shooter, wall({ phys: 100 }));
      out.onWeak = hit(shooter, wall({ phys: -20 }));
      out.onNoResist = hit(shooter, wall({}));
      out.offNoResist = (activeDoctrine = null, hit(shooter, wall({})));
      activeDoctrine = 'BROAD_SPECTRUM';
      // A hostile swinging back is not the squad, and must not be handed the seam.
      const op = { id: 'q', name: 'O', isPlayer: true, gridPos: 2, armor: 0, corrodedTurns: 0,
                   oiledTurns: 0, venomStacks: 0, resistances: { phys: 30, bio: 0, energy: 0 } };
      out.onEnemySwing = mitigate(raider, op, 100, 'phys', 'BASIC').n;
      activeDoctrine = null;
      out.offEnemySwing = mitigate(raider, op, 100, 'phys', 'BASIC').n;
      activeDoctrine = null; doctrineBroken = false;
      return out;
    });
    ok(`BROAD SPECTRUM eases a resistance by 10 (${seam.offPlain} -> ${seam.onPlain})`,
       seam.onPlain - seam.offPlain === 10);
    ok(`it does not open an immunity (${seam.onImmune})`, seam.onImmune === 0 && seam.offImmune === 0);
    ok('it does not make a weakness weaker still', seam.onWeak === seam.offWeak);
    ok('and does nothing to a target that resists nothing', seam.onNoResist === seam.offNoResist);
    ok('a hostile swinging back gets no seam of its own', seam.onEnemySwing === seam.offEnemySwing);

    // ── THE WALL: the front rank is the toughest, and swings ─────────────────────────────
    const wall = await page.evaluate(() => ({
      bruiserFront: window.__holds(['BRUISER', 'MEDIC', 'SCAVENGER']).THE_WALL,
      sniperFront:  window.__holds(['SNIPER', 'BRUISER', 'MEDIC']).THE_WALL,
      noMelee:      window.__holds(['MEDIC', 'SNIPER', 'SCAVENGER']).THE_WALL,
      lightMelee:   window.__holds(['HOUND', 'BRUISER', 'MEDIC']).THE_WALL,
      gunFront:     window.__holds(['SHOTGUNNER', 'MEDIC', 'SNIPER']).THE_WALL
    }));
    ok('a Bruiser holding the front keeps THE WALL', wall.bruiserFront);
    ok('a Shotgunner does too - it owns a melee shot', wall.gunFront);
    ok('putting the sniper in front does not', !wall.sniperFront);
    ok('a line with nothing that swings does not', !wall.noMelee);
    ok('and neither does the lightest operator holding the door', !wall.lightMelee);

    const braced = await page.evaluate(() => {
      const open = (doc) => {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        activeDoctrine = doc; doctrineBroken = false;
        initiateCombat('RAIDERS', false);
        const f = playerRoster.find(p => p.gridPos === 1);
        const b = playerRoster.find(p => p.gridPos === 2);
        combatActive = false;
        return { frontArmor: f.armor, frontGuard: f.guardTurns || 0,
                 frontTurns: f.armorTurns || 0, backArmor: b.armor, backGuard: b.guardTurns || 0 };
      };
      const on = open('THE_WALL'), off = open(null);
      activeDoctrine = null; doctrineBroken = false;
      return { on, off };
    });
    ok(`THE WALL opens the fight with the front rank plated (${braced.on.frontArmor})`,
       braced.on.frontArmor > 0 && braced.off.frontArmor === 0);
    ok('and covering the ranks behind it', braced.on.frontGuard > 0 && braced.off.frontGuard === 0);
    ok('the brace is temporary, not a permanent stat', braced.on.frontTurns > 0);
    ok('nobody behind the front gets it', braced.on.backArmor === 0 && braced.on.backGuard === 0);

    // ── OLD GUARD: veterans only ─────────────────────────────────────────────────────────
    const guard = await page.evaluate(() => {
      const vet = MASTERY_RANKS[VETERAN_RANK];
      const set = (m) => { mastery = m; };
      const out = {};
      // A doctrine with no offerable() at all is always offerable, which is exactly the
      // regression this pair is watching for - so read it that way rather than calling into
      // a property that might not be there and turning a failure into a crash.
      const canOffer = () => { const d = DOCTRINES.find(x => x.id === 'OLD_GUARD');
                               return !d.offerable || !!d.offerable(); };
      set({});
      out.offerableGreen = canOffer();
      out.holdsGreen = window.__holds(['BRUISER', 'MEDIC', 'SCAVENGER']).OLD_GUARD;
      set({ BRUISER: vet, MEDIC: vet, SCAVENGER: vet });
      out.offerableVet = canOffer();
      out.holdsVet = window.__holds(['BRUISER', 'MEDIC', 'SCAVENGER']).OLD_GUARD;
      out.holdsMixed = window.__holds(['BRUISER', 'MEDIC', 'SNIPER']).OLD_GUARD;
      set({ BRUISER: vet - 1, MEDIC: vet, SCAVENGER: vet });
      out.holdsOneShort = window.__holds(['BRUISER', 'MEDIC', 'SCAVENGER']).OLD_GUARD;
      set({});
      return out;
    });
    ok('OLD GUARD is not offered on a save with no veterans', !guard.offerableGreen);
    ok('and does not hold there either', !guard.holdsGreen);
    ok('three veterans make it offerable', guard.offerableVet);
    ok('a line of veterans keeps it', guard.holdsVet);
    ok('one green operator in the line breaks it', !guard.holdsMixed);
    ok('and so does one operator a single point short of rank', !guard.holdsOneShort);

    const vetHit = await page.evaluate(() => {
      const swing = (doc) => {
        currentSlot = 1; confirmNewGame(1.0); sectorFront = null; activeRelics = [];
        activeDoctrine = doc; doctrineBroken = false;
        initiateCombat('RAIDERS', false);
        const hero = playerRoster.find(p => p.gridPos === 1);
        const foe = activeEntities.find(e => !e.isPlayer);
        hero.dmgBase = 100; hero.traits = []; hero.augments = []; hero.quirk = null;
        foe.maxHp = 1e6; foe.armor = 0; foe.resistances = { phys: 0, bio: 0, energy: 0 };
        activeEntities = [hero, foe]; turnQueue = [hero, foe];
        const hits = [];
        for (let i = 0; i < 25; i++) {
          foe.hp = 1e6; activeIndex = 0; combatActive = true; pendingAction = 'SCRAP_BLADE';
          resolveAction(foe.id);
          hits.push(1e6 - foe.hp);
        }
        combatActive = false;
        return hits.sort((a, b) => a - b)[12];
      };
      const on = swing('OLD_GUARD'), off = swing(null);
      activeDoctrine = null; doctrineBroken = false;
      return { on, off };
    });
    ok(`OLD GUARD's veterans hit about 10% harder (${vetHit.off} -> ${vetHit.on})`,
       vetHit.on > vetHit.off && Math.abs((vetHit.on / vetHit.off) - 1.10) < 0.04);

    // ── The draw, and the break ──────────────────────────────────────────────────────────
    const draw = await page.evaluate(() => {
      mastery = {}; doctrineFavourites = [];
      const runs = [];
      for (let i = 0; i < 40; i++) runs.push(rollDoctrines());
      return { runs, pool: DOCTRINES.filter(d => !d.offerable || d.offerable()).map(d => d.id) };
    });
    ok(`every muster offers ${table.draw}`, draw.runs.every(r => r.length === table.draw));
    ok('and never the same doctrine twice in one draw', draw.runs.every(r => new Set(r).size === r.length));
    ok('nothing un-offerable is ever drawn',
       draw.runs.every(r => r.every(id => draw.pool.includes(id))));
    ok(`the draw reaches every offerable doctrine across 40 musters (${draw.pool.length} in the pool)`,
       draw.pool.every(id => draw.runs.some(r => r.includes(id))));

    const broke = await page.evaluate(() => {
      window.__line(['BRUISER', 'MEDIC', 'PYROMANIAC']);
      activeDoctrine = 'BROAD_SPECTRUM'; doctrineBroken = false;
      const before = doctrineMult();
      // Lose the only operator who lands energy.
      playerRoster.find(p => p.classType === 'PYROMANIAC').gridPos = 0;
      checkDoctrine();
      const after = doctrineMult(), latched = doctrineBroken;
      // Putting them back does not un-break the promise.
      playerRoster.find(p => p.classType === 'PYROMANIAC').gridPos = 3;
      checkDoctrine();
      const restored = doctrineMult();
      activeDoctrine = null; doctrineBroken = false;
      return { before, after, latched, restored };
    });
    ok(`a kept BROAD SPECTRUM pays (${broke.before.toFixed(2)})`, broke.before > 1);
    ok('losing the energy carrier breaks it', broke.latched && broke.after === 1);
    ok('and shuffling them back does not un-break it', broke.restored === 1);

    // The codex is generated from the table, so a new doctrine cannot go undocumented.
    const codex = await page.evaluate(() => {
      const body = CODEX.find(c => c.id === 'DOCTRINES').body().join(' | ');
      return DOCTRINES.every(d => body.includes(d.name) && body.includes(d.rule) && body.includes(d.edge));
    });
    ok('the codex names every doctrine, its rule and its edge', codex);
  }
};
