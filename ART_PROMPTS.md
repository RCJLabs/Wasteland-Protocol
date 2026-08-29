# Art briefs

The portrait style the roster is drawn in, and the briefs each existing piece was drawn
from. Kept so the next portrait matches the ones already on the field rather than drifting.

Save every portrait as **WebP**, trimmed tight to its alpha with the long side at 640, in
the repo root. Anything listed in `PENDING_ART` at the top of `game.js` is commissioned but
not yet drawn: the preloader and the service worker skip it, and a delegated error handler
shows the stand-in Warlord portrait in its place, so the game stays playable while art is
outstanding. The list is currently empty.

## Shared style brief

Put this in front of every prompt:

> Grimy post-apocalyptic wasteland character portrait, hand-painted comic-book
> illustration, heavy black inking and cel shading, muted rust-and-sand palette
> with one saturated accent colour, dramatic low-angle hero framing, full body,
> centred, character only on a **flat transparent background**, no scenery, no
> ground shadow, no text, no logo, no border.

Reference pieces: `enemy_boss.webp`, `enemy_boss_mech.webp`, `enemy_boss_vulture.webp`. A
commander should read as roughly twice the bulk of a regular raider.

---

## Drawn

### `enemy_boss_vatborn.webp` — The Vatborn
*Doses itself every two turns: stronger each time, and further open.*

> A towering vat-grown mutant, pale waxy flesh streaked with green chemical burns, a
> pressurised chem tank strapped to its back feeding luminous green fluid through thick
> tubes into its neck and arms, a respirator mask over the lower face, improvised plate
> lashed across the chest, enormous spiked fists. Accent colour: toxic bioluminescent green.

### `enemy_boss_marshal.webp` — The Marshal
*Wears its lieutenant's cover until the hound goes down.*

> A wasteland lawman on foot: long dust-caked leather coat over improvised plate, a battered
> tin star hammered from scrap pinned at the chest, a wide-brimmed hat, a long-barrelled
> revolver cannon held across the body, bandoliers of mismatched shells. Composed, upright,
> unhurried - the posture of someone who expects other people to do the fighting. Accent
> colour: cold steel blue.

### `enemy_hound_bulldog.webp` — Bulldog
*The Marshal's hound, and the fight's actual first problem.*

> A heavy wasteland war-hound, thick-necked and scarred, an armoured muzzle plate and a
> spiked collar buckled over a leather harness, head low and shoulders bunched mid-stalk.
> Muted tan and leather, steel plate at the head.

### `enemy_boss_stormcaller.webp` — The Stormcaller
*Turns the sky over every three turns.*

> A gaunt figure in a billowing patchwork storm-cloak wired with copper rods and salvaged
> lightning arrestors, a cage-like antenna crown of scrap aerials, arms spread wide, static
> arcing between the rods and its raised hands, cloak and wiring caught mid-motion in a hard
> wind. Face lost in shadow under the crown. Accent colour: electric violet-white arc light.

### `enemy_boss_bastion.webp` — The Bastion
*Warded to near-invulnerability until its generator falls.*

> An enormous four-legged siege walker, slab-armoured hull of welded plate and riveted
> girders, a heavy shuttered viewport for a face, gun batteries folded against its flanks, a
> shimmering hexagonal energy shield haloing the front of the hull. Squat, immovable, far
> wider than tall - a building that walks. Accent colour: amber shield glow against grey steel.

---

## Adding a new portrait

1. Trim to the alpha bounding box, scale the long side to 640, save as WebP (quality ~88).
2. Add the filename to `ASSET_LIST` in `game.js`, and to `PENDING_ART` as well if the file
   is not in the repo yet.
3. Point the unit's `img` at it and check the `scale` on the field - a wide silhouette at
   the same scale reads much larger than a tall one. A commander that arrives with a
   retinue shares its row, and `fitEnemyRow` narrows the pair to fit, so check both units
   are legible together rather than only the commander alone.
