// An operator at zero used to be a bill: fifty Scrap at the Outpost and they were back on the
// roster. Nothing in a run could actually be lost, so no fight was ever actually dangerous -
// only expensive.
//
// One rule replaces that. Going down starts a clock counted in that operator's own turns, and
// running it out takes them off the expedition for good. Every way a fight can end stops the
// clock, so the danger is not "somebody fell" - it is "somebody fell and this is still going".
module.exports = {
  name: 'The dead stay dead',
  run: async ({ page, ok, base }) => {
    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);

    // A fight with one operator and one dummy, both indestructible unless the suite says so.
    await page.evaluate(() => {
      window.__fight = (n = 1) => {
        activeContracts = []; currentSlot = 1; confirmNewGame(1.0); sectorFront = null;
        currentSector = 2; currentTier = 4; initiateCombat('RAIDERS', false);
        const squad = playerRoster.filter(c => c.gridPos > 0).slice(0, n);
        squad.forEach((h, i) => { h.maxHp = 100; h.hp = 100; h.gridPos = i + 1; h.quirk = null; h.traits = []; });
        const foe = activeEntities.find(e => !e.isPlayer);
        foe.maxHp = 100000; foe.hp = 100000; foe.armor = 0; foe.baseArmor = 0;
        foe.resistances = { phys: 0, bio: 0, energy: 0 };
        activeEntities = [...squad, foe]; turnQueue = [...squad, foe];
        activeIndex = 0; combatActive = true; pendingAction = null; bonds = {};
        return { squad, foe };
      };
      window.__drop = (ent) => { ent.hp = 0; goDown(ent); };
    });

    // ---- the clock ----
    const clock = await page.evaluate(() => {
      const { squad } = window.__fight(2);
      const [a] = squad;
      window.__drop(a);
      const started = a.downTurns;
      const inRoster = playerRoster.some(c => c.id === a.id);
      const ticks = [];
      for (let i = 0; i < BLEED_OUT + 1; i++) { tickBleedOut(a); ticks.push({ left: a.downTurns, fallen: !!a.fallen }); }
      return { started, inRoster, ticks, budget: BLEED_OUT,
               gone: !playerRoster.some(c => c.id === a.id),
               stillOnField: activeEntities.some(e => e.id === a.id),
               recorded: (runStats.fallen || []).map(f => f.name), name: a.name };
    });
    ok(`falling starts a clock of ${clock.budget} of their own turns`, clock.started === clock.budget);
    ok('and they are still on the roster while it runs', clock.inRoster);
    ok(`it counts down one turn at a time (${clock.ticks.map(t => t.left).join(' > ')})`,
      clock.ticks.slice(0, clock.budget).every((t, i) => t.left === clock.budget - 1 - i));
    ok('and only the last tick takes them',
      clock.ticks.slice(0, clock.budget - 1).every(t => !t.fallen) && clock.ticks[clock.budget - 1].fallen);
    ok(`running it out takes them off the roster (${clock.name})`, clock.gone);
    ok('the body stays on the field rather than blinking out of the fight', clock.stillOnField);
    ok('and the expedition records who it cost', clock.recorded.includes(clock.name));

    // Ticking a corpse must not tick twice, and must not tick somebody standing.
    const idempotent = await page.evaluate(() => {
      const { squad } = window.__fight(2);
      const [a, b] = squad;
      window.__drop(a);
      for (let i = 0; i < 12; i++) tickBleedOut(a);
      const rosterAfter = playerRoster.length;
      tickBleedOut(b);
      return { rosterAfter, standing: b.hp, bDown: b.downTurns || 0,
               logged: (runStats.fallen || []).length };
    });
    ok('a body that is already gone cannot be lost twice', idempotent.logged === 1);
    ok('and the clock never touches somebody still standing',
      idempotent.standing === 100 && idempotent.bDown === 0);

    // ---- what stops it ----
    const healed = await page.evaluate(() => {
      const at = (heal) => {
        const { squad } = window.__fight(2);
        const [a, medic] = squad;
        window.__drop(a);
        heal(a, medic);
        tickBleedOut(a);
        return { hp: a.hp, fallen: !!a.fallen, onRoster: playerRoster.some(c => c.id === a.id) };
      };
      return {
        stim:  at(a => { inventory.push('MED_STIM'); pendingAction = 'ITEM_MED'; resolveConsumableItem(a.id); }),
        tactic: at(a => { momentum = 100; addMomentum(0); spendTactic('STIM'); }),
        raw:   at(a => { a.hp = 30; })
      };
    });
    ok(`a Med-Stim in the field puts them back on their feet (${healed.stim.hp} HP)`,
      healed.stim.hp > 0 && !healed.stim.fallen && healed.stim.onRoster);
    ok(`so does the STIM tactic, which is the answer a squad with no medic has (${healed.tactic.hp} HP)`,
      healed.tactic.hp > 0 && !healed.tactic.fallen);
    ok('and any healing at all, because the clock is only read while they are at zero',
      healed.raw.hp === 30 && !healed.raw.fallen);

    // The tactic has to pick the operator on the floor over the one merely grazed.
    const priority = await page.evaluate(() => {
      const { squad } = window.__fight(2);
      const [a, b] = squad;
      b.hp = 90;
      window.__drop(a);
      const pick = stimTarget();
      return { picked: pick ? pick.id : null, down: a.id, grazed: b.id };
    });
    ok('a stim goes to whoever is on the floor before whoever is scratched',
      priority.picked === priority.down);

    // Heals can be pointed at a body; swings and swaps cannot.
    const reach = await page.evaluate(() => {
      const { squad } = window.__fight(2);
      const [a] = squad;
      window.__drop(a);
      const canPoint = move => { pendingAction = move; renderField();
        const el = document.getElementById(a.id);
        return !!el && el.className.includes('targetable-ally'); };
      const out = { cauterize: canPoint('CAUTERIZE'), med: canPoint('ITEM_MED'),
                    reposition: canPoint('REPOSITION'), blade: canPoint('SCRAP_BLADE') };
      pendingAction = null;
      return { ...out, list: REACHES_THE_DOWN };
    });
    ok(`the verbs that reach a body are the ones that could help (${reach.list.join(', ')})`,
      reach.cauterize && reach.med);
    ok('a swap is not one of them - you cannot trade places with somebody on the floor',
      !reach.reposition);
    ok('and neither is a weapon', !reach.blade);

    // ---- every way a fight ends stops it ----
    const ends = await page.evaluate(() => {
      const after = (finish) => {
        const { squad, foe } = window.__fight(2);
        const [a] = squad;
        window.__drop(a);
        // The share has to be measured against the health they had when they were dragged
        // clear, not the health they have afterwards. recoverDowned sets hp from maxHp and
        // THEN rolls scars, and CRACKED RIBS takes ten off the maximum - so a body that came
        // round at 20 of 100 reads as 20 of 90, or 22%, and the reading is of the scar rather
        // than of the rescue. About one run in sixty; it had been latent since scars shipped.
        const wasMax = a.maxHp;
        finish(squad, foe);
        return { hp: a.hp, fallen: !!a.fallen, onRoster: playerRoster.some(c => c.id === a.id),
                 share: a.hp / wasMax, scarred: (a.scars || []).length > 0 };
      };
      return {
        won: after((squad, foe) => { foe.hp = 0; checkWinState(); }),
        wiped: after(squad => { squad.forEach(c => { c.hp = 0; goDown(c); }); handleSquadWipe(); }),
        left: after(() => { scrap = 9000; armedExit = 'WITHDRAW'; withdraw(); }),
        floor: DRAGGED_CLEAR
      };
    });
    ok(`winning the fight drags them clear (${Math.round(ends.won.share * 100)}% health)`,
      !ends.won.fallen && ends.won.hp > 0 && Math.abs(ends.won.share - ends.floor) < 0.02);
    ok('being broken and dragged off does too - only the clock kills', !ends.wiped.fallen && ends.wiped.hp > 0);
    ok('and so does walking away from it', !ends.left.fallen && ends.left.hp > 0);

    // ---- gone is gone ----
    const gone = await page.evaluate(() => {
      const { squad } = window.__fight(3);
      const [a] = squad;
      a.trinket = 'PLATED_VEST'; a.weaponMod = 'JAGGED_EDGE';
      const stashBefore = gearStash.length;
      const rank = a.gridPos;
      window.__drop(a);
      for (let i = 0; i < BLEED_OUT; i++) tickBleedOut(a);
      const kit = [...gearStash];
      // the Outpost has nothing to sell that brings them back
      scrap = 99999;
      renderOutpost();
      const revive = document.querySelectorAll('[data-mode="REVIVE"]').length;
      const cards = document.getElementById('outpost-roster').innerText;
      renderMuster();
      const muster = document.getElementById('muster-body').innerText;
      return { rank, stashBefore, kit, name: a.name,
               onRoster: playerRoster.some(c => c.id === a.id),
               revive, inOutpost: cards.includes(a.name), inMuster: muster.includes(a.name) };
    });
    ok('their kit is not buried with them', gone.kit.length === gone.stashBefore + 2
      && gone.kit.includes('PLATED_VEST') && gone.kit.includes('JAGGED_EDGE'));
    ok('there is no reviving them at the Outpost', gone.revive === 0);
    ok('they are off the roster screen', !gone.onRoster && !gone.inOutpost);
    ok('and off the muster', !gone.inMuster);

    // ---- the line closes up ----
    const ranks = await page.evaluate(() => {
      const { squad } = window.__fight(3);
      const [a] = squad;
      const rank = a.gridPos;
      const benchBefore = playerRoster.filter(c => c.gridPos === 0).length;
      window.__drop(a);
      for (let i = 0; i < BLEED_OUT; i++) tickBleedOut(a);
      const beforeClose = playerRoster.filter(c => c.gridPos === rank).length;
      const filled = closeRanks();
      return { rank, benchBefore, beforeClose, filled,
               afterClose: playerRoster.filter(c => c.gridPos === rank).length,
               deployed: playerRoster.filter(c => c.gridPos > 0).length,
               bench: playerRoster.filter(c => c.gridPos === 0).length };
    });
    ok('the rank they held is empty the moment they are lost', ranks.beforeClose === 0);
    ok(`and the bench closes up into it (${ranks.filled.join(', ')})`,
      ranks.filled.length === 1 && ranks.afterClose === 1);
    ok('one for one, so a squad run short on purpose is not quietly filled out',
      ranks.deployed === 3 && ranks.bench === ranks.benchBefore - 1);

    const noBench = await page.evaluate(() => {
      const { squad } = window.__fight(3);
      playerRoster = playerRoster.filter(c => c.gridPos > 0);   // nobody in reserve
      const [a] = squad;
      window.__drop(a);
      for (let i = 0; i < BLEED_OUT; i++) tickBleedOut(a);
      const filled = closeRanks();
      return { filled, deployed: playerRoster.filter(c => c.gridPos > 0).length };
    });
    ok('with an empty bench the line simply runs short', noBench.filled.length === 0 && noBench.deployed === 2);

    // ---- the things that stop the fall in the first place ----
    const spared = await page.evaluate(() => {
      const wind = () => {
        const { squad, foe } = window.__fight(2);
        const [a] = squad;
        a.quirk = QUIRK_POOL.find(q => q.id === 'SECOND_WIND') || { id: 'SECOND_WIND' };
        a.hp = 10; a.secondWindUsed = false;
        applyDamageHit(foe, a, 500, 'phys', 'BASIC');
        return { hp: a.hp, down: (a.downTurns || 0) > 0 };
      };
      const bond = () => {
        const { squad, foe } = window.__fight(2);
        const [a, b] = squad;
        bonds[bondKey(a.id, b.id)] = BOND_LEVELS[1];
        bondSavesUsed = new Set();
        a.hp = 10;
        applyDamageHit(foe, a, 500, 'phys', 'BASIC');
        return { hp: a.hp, down: (a.downTurns || 0) > 0, partner: b.hp };
      };
      return { wind: wind(), bond: bond() };
    });
    ok('Second Wind still stops the fall rather than the clock', spared.wind.hp === 1 && !spared.wind.down);
    ok('and a bond that steps in front of a killing blow is now worth what it says',
      !spared.bond.down && spared.bond.partner < 100);

    // ---- the run ends when there is nobody left ----
    const empty = await page.evaluate(() => {
      const { squad } = window.__fight(3);
      playerRoster = playerRoster.filter(c => c.gridPos > 0);
      runStats.regroups = 5;
      squad.forEach(c => { c.hp = 0; c.fallen = true; });
      playerRoster = [];
      handleSquadWipe();
      const screen = document.getElementById('screen-runover');
      return { title: document.getElementById('runover-title').innerText,
               shown: getComputedStyle(screen).display, regroups: runStats.regroups };
    });
    ok('a squad with nobody left ends the expedition, whatever the fallbacks say',
      empty.title === 'RUN OVER' && empty.shown === 'flex' && empty.regroups === 5);

    // ---- and the player can see all of it ----
    const seen = await page.evaluate(() => {
      const { squad } = window.__fight(2);
      const [a] = squad;
      window.__drop(a);
      renderField();
      const el = document.getElementById(a.id);
      const tag = el.querySelector('.down-tag');
      const marked = el.className.includes('bleeding-out');
      tickBleedOut(a); tickBleedOut(a); tickBleedOut(a);
      renderField();
      const lost = document.getElementById(a.id).querySelector('.down-tag');
      return { tag: tag ? tag.innerText.trim() : null, marked, budget: BLEED_OUT,
               lost: lost ? lost.innerText.trim() : null,
               prompt: PROMPTS.some(p => p.id === 'BLEEDOUT') };
    });
    ok(`the clock is over their head with the count on it, not just in the log (${seen.tag})`,
      !!seen.tag && seen.tag.includes(String(seen.budget)));
    ok('and the operator is marked as down', seen.marked);
    ok(`a body reads as lost rather than as a number (${seen.lost})`, seen.lost === 'LOST');
    ok('there is a prompt explaining the rule the first time it happens', seen.prompt);

    // ---- the state survives a reload mid-fight ----
    const kept = await page.evaluate(() => {
      const { squad } = window.__fight(2);
      const [a] = squad;
      window.__drop(a);
      const before = a.downTurns;
      saveGameState();
      playerRoster = []; activeEntities = []; turnQueue = [];
      loadGameState();
      const back = playerRoster.find(c => c.id === a.id);
      return { before, after: back ? back.downTurns : null, hp: back ? back.hp : null };
    });
    ok(`a reload mid-fight remembers the clock (${kept.after} of ${kept.before})`,
      kept.after === kept.before && kept.hp === 0);

    const fresh = await page.evaluate(() => {
      window.__fight(2);
      const [a] = playerRoster.filter(c => c.gridPos > 0);
      window.__drop(a);
      for (let i = 0; i < BLEED_OUT; i++) tickBleedOut(a);
      const lostMid = (runStats.fallen || []).length;
      buildNewRun(1.0);
      return { lostMid, roster: playerRoster.length, template: ROSTER_TEMPLATE.length,
               fallen: (runStats.fallen || []).length, vacated: vacatedRanks.length };
    });
    ok('a new expedition starts with everyone again', fresh.lostMid === 1 && fresh.roster === fresh.template);
    ok('with an empty memorial and no ranks owed', fresh.fallen === 0 && fresh.vacated === 0);
  }
};
