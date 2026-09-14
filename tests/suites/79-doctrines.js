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
  run: async ({ page, ok, base, engineUp }) => {
    await page.goto(`${base}/index.html`);
    await engineUp(page);

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

    // ── O11: NO HANDS, the one edge in the table nothing held ────────────────────────────
    // Found while checking a null. Measuring what a doctrine is WORTH came back as "the score
    // multiplier and nothing separable", and before publishing that the D06 question has to be
    // asked of every edge in the mix: is the code even running? Six of the seven were already
    // held - here, and in suite 59 for LIGHT ORDER, FIELD SURGERY and CONSCRIPTS. NO HANDS' was
    // not held anywhere. It contributes nothing to that null either way, because the default
    // draft never takes it (O10: offered 76 times in 150 expeditions, live zero), but "no test
    // and never taken" is how a card quietly stops working and nobody finds out.
    //
    // Exact rather than sampled, on mitigate's own returned figure - the reduction is a single
    // Math.floor(cd * 0.8), so there is nothing here a tolerance would be protecting against.
    const hands = await page.evaluate(() => {
      const mk = (id, pos) => ({ id, name: id, isPlayer: true, gridPos: pos, armor: 0,
                                 corrodedTurns: 0, oiledTurns: 0, venomStacks: 0,
                                 resistances: { phys: 0, bio: 0, energy: 0 } });
      const front = mk('p1', 1), back = mk('p2', 2);
      const brawler = { id: 'e1', name: 'B', isPlayer: false, gridPos: 0, range: 'melee' };
      const shooter = { id: 'e2', name: 'S', isPlayer: false, gridPos: 0, range: 'ranged' };
      const hit = (atk, tgt) => mitigate(atk, tgt, 100, 'phys', 'BASIC').n;
      const out = {};
      activeDoctrine = null; doctrineBroken = false;
      out.offMelee = hit(brawler, front); out.offShot = hit(shooter, front);
      out.offBack = hit(brawler, back);
      activeDoctrine = 'NO_HANDS'; doctrineBroken = false;
      out.onMelee = hit(brawler, front); out.onShot = hit(shooter, front);
      out.onBack = hit(brawler, back);
      activeDoctrine = null; doctrineBroken = false;
      return out;
    });
    ok(`NO HANDS takes a fifth off enemy melee that reaches the front rank ` +
       `(${hands.offMelee} -> ${hands.onMelee})`,
      hands.onMelee === Math.floor(hands.offMelee * 0.8));
    // The half the engine's own comment states and nothing checked: "the doctrine is about
    // giving up reach, not about being harder to shoot".
    ok(`and nothing off being shot (${hands.offShot} -> ${hands.onShot})`,
      hands.onShot === hands.offShot);
    ok(`nor off a rank that is not the front one (${hands.offBack} -> ${hands.onBack})`,
      hands.onBack === hands.offBack);

    // ── O18: AND THE RULE DOES NOT HOLD IN PLAY, which is why the card cannot be priced ──
    // O18 set out to pay NO HANDS in the currency it charges in - the line gives up its knives,
    // so what it still carries hits harder. Three careers against a paired baseline moved the
    // gap from O13's -7.00 wins to -6.00, which is inside K06's floor of about fourteen, and
    // the measurement turned up the reason on the way: THE LINE IS STILL SWINGING. 22-27% of
    // the damage a NO HANDS career deals is melee, on a card whose whole rule is that nobody in
    // the line owns a melee ability.
    //
    // carriesMelee reads deckFor(), and deckFor GROWS: at mastery rank 3 it appends the class's
    // fourth ability, and the Scavenger's fourth is SHIV, reach melee. A line legal at the
    // muster stops being legal as the career goes on. Separately, moveReachFor returns melee for
    // PIPE_RIFLE on any body wearing a BAYONET - a mod turns the Scavenger's most-thrown move
    // into a melee swing, and a deck read cannot see that at all.
    //
    // AND NOTHING RE-ASKS. checkDoctrine has three callers: two in the draft and one in
    // assignSlot. Not promotion, not gear. So the promise is checked when it is made and when a
    // body moves rank, and never again - which is the same shape as the doctrine's own comment
    // about offerable-but-unkeepable, one step later in the run.
    const leak = await page.evaluate(() => {
      const scav = playerRoster.find(c => c.classType === 'SCAVENGER');
      const base = (ABILITIES.SCAVENGER || []).map(a => a.reach);
      const fourth = FOURTH_ABILITIES.SCAVENGER;
      return { baseHasMelee: base.includes('melee'),
               fourthMove: fourth && fourth.move, fourthReach: fourth && fourth.reach,
               carriesNow: carriesMelee(scav),
               // The mod half: what the engine calls the reach of a rifle with a bayonet on it.
               // hasMod reads ent.weaponMod on a player, so the probe hands it exactly that
               // rather than a shape of my own invention - the first cut passed a gear array and
               // the row went red against a mod the engine never saw.
               bayonet: moveReachFor('PIPE_RIFLE', { isPlayer: true, weaponMod: 'BAYONET' }),
               plain: moveReachFor('PIPE_RIFLE', { isPlayer: true, weaponMod: null }) };
    });
    ok(`the Scavenger's own three carry no melee, so the line is legal at the muster ` +
       `(carriesMelee ${leak.carriesNow})`,
      leak.baseHasMelee === false && leak.carriesNow === false);
    ok(`but its fourth ability is melee, and deckFor appends it at mastery rank 3 ` +
       `(${leak.fourthMove}:${leak.fourthReach})`,
      leak.fourthReach === 'melee');
    // The mod is the half a deck read can never see, because it changes the MOVE at throw time.
    ok(`and a BAYONET makes the rifle a melee swing without touching the deck ` +
       `(PIPE_RIFLE ${leak.plain} -> ${leak.bayonet})`,
      leak.plain === 'ranged' && leak.bayonet === 'melee');
    // O19: AND BOTH HOLES ARE CLOSED. The row here used to assert the opposite - that
    // checkDoctrine was asked from three places, none of them promotion or gear - and it reddened
    // the moment the calls went in, which is what it was written for. It now holds the fix.
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'game.js'), 'utf8');
    ok('a promotion re-asks the doctrine, gated on the RANK moving rather than every award',
      /const rankWas = masteryRank\(char\.classType\);[\s\S]{0,260}?if \(masteryRank\(char\.classType\) !== rankWas\) checkDoctrine\(\);/.test(src));
    ok('and fitting a piece of gear re-asks it too',
      /if \(g\.apply\) g\.apply\(ch\);[\s\S]{0,420}?checkDoctrine\(\);/.test(src));
    // THE ONE THAT MATTERS MORE, because the call above cannot help without it: carriesMelee has
    // to ask the same question the fight asks. A deck read cannot see a mod.
    ok('and carriesMelee reads reach through moveReachFor rather than off the declaration',
      /function carriesMelee\(ch\) \{\s*\n\s*return deckFor\(ch\)\.some\(a => moveReachFor\(a\.move, ch\) === 'melee'\);/.test(src));

    // ── AND BOTH MECHANISMS, CONSTRUCTED ────────────────────────────────────────────────
    // Forced rather than sampled: O18 found this at 150 expeditions a career and it took a
    // paired measurement to notice. Two lines of setup reproduce each half exactly.
    const closed = await page.evaluate(() => {
      currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
      const scav = playerRoster.find(c => c.classType === 'SCAVENGER');
      const out = {};
      // THE MOD. A clean Scavenger, then a bayonet on the same body.
      scav.weaponMod = null;
      out.cleanDeck = carriesMelee(scav);
      scav.weaponMod = 'BAYONET';
      out.withBayonet = carriesMelee(scav);
      scav.weaponMod = null;
      // THE PROMOTION, and it needs one more thing than O18's write-up said. deckFor appends the
      // fourth at rank 3 - the Scavenger's is SHIV, melee - but benchedFor DEFAULTS TO BENCHING
      // THE FOURTH, so rank alone changes nothing and the first cut of this row went red saying
      // so. The hole opens only when the operator brings the fourth by benching something else,
      // which is a choice the player makes on the promotion screen and which the simulator's own
      // policy makes for every rank III body it fields.
      const before = mastery.SCAVENGER, benchWas = scav.benchedMove;
      mastery.SCAVENGER = 10 ** 9;
      out.rankNow = masteryRank('SCAVENGER');
      scav.benchedMove = null;                       // the default: the fourth sits out
      out.rank3Default = carriesMelee(scav);
      scav.benchedMove = 'PIPE_RIFLE';               // bring the fourth instead, as the sim does
      out.rank3Bringing = carriesMelee(scav);
      out.deckThen = deckFor(scav).map(a => a.move);
      mastery.SCAVENGER = before; scav.benchedMove = benchWas;
      return out;
    });
    ok(`a bayonet alone puts melee in a clean Scavenger's hands ` +
       `(${closed.cleanDeck} -> ${closed.withBayonet})`,
      closed.cleanDeck === false && closed.withBayonet === true);
    // The default is SAFE, which is the half O18's write-up got wrong and this row now states.
    ok(`ranking up to ${closed.rankNow} alone does not, because the fourth is benched by default ` +
       `(${closed.rank3Default})`,
      closed.rankNow === 3 && closed.rank3Default === false);
    ok(`but bringing it instead of a basic does (${closed.rank3Bringing}, deck ${closed.deckThen.join('/')})`,
      closed.rank3Bringing === true && closed.deckThen.includes('SHIV'));

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
