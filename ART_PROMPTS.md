# Art needed: four warlord portraits

Four portraits, nothing else. The Marshal's lieutenant, the Bastion's generator,
the Vat-Spawn and all four arenas reuse art already in the repo, so this is the
whole list.

The game is fully playable right now without them: each new warlord falls back to
the existing Warlord portrait until its file lands.

Save each as **WebP** into the repo root under the exact filename given. The game
already references them; until they exist it falls back to the existing Warlord
portrait, so nothing is broken in the meantime.

## Shared style brief

Put this in front of every prompt so the four match the existing roster:

> Grimy post-apocalyptic wasteland character portrait, hand-painted comic-book
> illustration, heavy black inking and cel shading, muted rust-and-sand palette
> with one saturated accent colour, dramatic low-angle hero framing, full body,
> centred, character only on a **flat transparent background**, no scenery, no
> ground shadow, no text, no logo, no border.

Existing portraits for reference: `enemy_boss.webp`, `enemy_boss_mech.webp`,
`enemy_boss_vulture.webp`. Match their weight and silhouette scale — these are
bosses, so they should read as roughly twice the bulk of a regular raider.

---

## 1. `enemy_boss_vatborn.webp` — The Vatborn

*Splits into two Vat-Spawn at half health.*

> A towering vat-grown mutant, pale waxy flesh streaked with green chemical
> burns, torso split by a wet vertical seam that looks ready to divide, too many
> arms of uneven length, a cracked containment collar of rusted steel still
> bolted around its neck with severed feed-tubes dripping luminous green fluid.
> Small lidless eyes clustered asymmetrically. Accent colour: toxic bioluminescent
> green.

Silhouette note: the vertical seam should read clearly even at small size — it is
the visual promise of the split.

## 2. `enemy_boss_marshal.webp` — The Marshal

*Arrives with a lieutenant called Bulldog and hides behind it.*

> A wasteland lawman on foot: long dust-caked leather coat over improvised plate,
> a battered tin star hammered from scrap pinned at the chest, mirrored gas-mask
> goggles under a wide-brimmed hat, a long-barrelled rifle held across the body,
> bandoliers of mismatched shells. Composed, upright, unhurried — the posture of
> someone who expects other people to do the fighting. Accent colour: cold steel
> blue.

## 3. `enemy_boss_stormcaller.webp` — The Stormcaller

*Turns the weather over every three turns.*

> A gaunt figure in a billowing patchwork storm-cloak wired with copper rods and
> salvaged lightning arrestors, a cage-like antenna crown of scrap aerials, arms
> spread wide, static arcing between the rods and its raised hands, cloak and
> wiring caught mid-motion in a hard wind. Face lost in shadow under the crown.
> Accent colour: electric violet-white arc light.

## 4. `enemy_boss_bastion.webp` — The Bastion

*Invulnerable until you destroy its ward generator.*

> An enormous four-legged siege walker, slab-armoured hull of welded plate and
> riveted girders, a heavy shuttered viewport for a face, gun batteries folded
> against its flanks, a shimmering hexagonal energy shield haloing the front of
> the hull. Squat, immovable, far wider than tall. Accent colour: amber shield
> glow against grey steel.

Silhouette note: it should read as a building that walks — the widest, heaviest
shape in the roster.

---

---

## After you generate them

1. Convert to WebP and drop them in the repo root with those exact filenames.
2. Open `game.js` and delete the matching line from the `PENDING_ART` list at the
   top — that is the list of art that is commissioned but not yet drawn, and it is
   what keeps the preloader from chasing files that do not exist yet.
3. If a name is misspelled the game quietly shows the stand-in Warlord portrait
   instead of a broken image, so check each new warlord actually shows its own art.
