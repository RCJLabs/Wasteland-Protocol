# Art briefs

The portrait style the roster is drawn in, and the briefs each existing piece was drawn
from. Kept so the next portrait matches the ones already on the field rather than drifting.

Save every portrait as **WebP**, trimmed tight to its alpha with the long side at 640, in
the repo root. Anything listed in `PENDING_ART` at the top of `game.js` is commissioned but
not yet drawn: the preloader and the service worker skip it, and a delegated error handler
shows the stand-in Warlord portrait in its place, so the game stays playable while art is
outstanding.

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

## Drawn — the Choir and the Carrion

Eight hostiles across two factions, all delivered and wired in: `PENDING_ART` is empty
again, the `stand` keys are gone from `ENEMY_POOL`, and each faction fights on its own
ground now (`bg_congregation.webp` and `bg_carrionfield.webp`, briefs at the end of this
section). The briefs below are what each was drawn from.

Ordinary hostiles are smaller in frame than a commander: a rat should read as knee-high next
to an operator, an Acolyte as a person. Match the weight of `enemy_raider.webp` and
`enemy_chem.webp` rather than the boss portraits.

### The Choir
Irradiated cultists who fight for each other rather than for themselves. Shared look: rag
vestments over scavenged hazmat, exposed radiation burns, green-glass lenses, hand-daubed
symbols. Accent colour throughout: sickly radium green.

- **`enemy_choir_acolyte.webp` — Acolyte** *(sings over another hostile, making it hit harder)*
  > A gaunt cultist in patched radiation robes, hood back, arms raised mid-chant, mouth open,
  > throat and hands blistered with burns. A cracked dosimeter hangs at the belt. Rapt, not
  > threatening.

- **`enemy_choir_censer.webp` — Censer Bearer** *(douses the front rank, stripping armour)*
  > A cultist swinging a long-chained censer that trails luminous green vapour, face wrapped in
  > stained cloth over a half-mask, one arm sleeved in a lead gauntlet. Body turned away from
  > its own smoke.

- **`enemy_choir_reliquary.webp` — Reliquary** *(heals the whole Choir by dying)*
  > A heavy cultist bent under a lead-shielded reliquary case strapped to the back, its seams
  > leaking green light, chest and shoulders wrapped in layered scavenged shielding. Slow and
  > overburdened, carrying something that wants out.

- **`enemy_choir_hierophant.webp` — Hierophant** *(raises a fallen cultist)*
  > The tallest of them: a cultist in a long mantle of stitched hazmat panels, a crown of
  > fuel-rod stubs, one hand outstretched palm-down as if calling something up from the ground.
  > Face lost behind a green-glass respirator plate.

### The Carrion
A swarm drawn to something large that died. Shared look: wet chitin and matted fur, too many
limbs, a colour palette of bile and dried blood. Accent colour: sallow yellow-green.

- **`enemy_carrion_rat.webp` — Carrion Rat** *(trivial alone, a problem in numbers)*
  > A dog-sized scavenger rat, hairless in patches, ribs showing, jaw hanging open too wide,
  > tail like bare wire. Low to the ground, mid-scurry. Small in frame — knee-high.

- **`enemy_carrion_moth.webp` — Blight Moth** *(fast, airborne)*
  > A hand-span-wide moth blown up to dog size, dust-shedding wings marked like a skull,
  > feathered antennae, spindly legs tucked, caught mid-hover. Backlit so the wings read as
  > translucent.

- **`enemy_carrion_worm.webp` — Gorge Worm** *(burrows, then comes up under the front rank)*
  > A thick segmented worm heaving up out of broken ground, front third raised, mouth a ring of
  > inward-facing hooks, body slick and banded. Show the hole it came out of as part of the
  > silhouette, not as scenery.

- **`enemy_carrion_brood.webp` — Brood Mother** *(keeps laying more Carrion until killed)*
  > A bloated, half-immobile mass of a creature, swollen abdomen dragging, small vestigial legs,
  > a cluster of glistening egg sacs along one flank, head far too small for the body. Grotesque
  > rather than fearsome — the thing you kill first.

### The grounds — also drawn
Both factions used to borrow another faction's backdrop (the Choir the refinery, the Carrion
the canyon). Each owns its ground now. Backdrops are opaque WebP, portrait orientation around
768×1344, hard silhouette skyline in the upper two thirds and the lower third left as open
ground for the line to stand on.

- **`bg_congregation.webp`** — the Choir's ground.
  > The flooded interior of a ruined reactor hall: a vast cracked containment dome open to a
  > burnt-orange sky, broken gantries and bent rebar in hard silhouette, standing water across
  > the floor throwing green light up the walls, hand-daubed cult symbols on the concrete,
  > drifting motes of luminous vapour. Accent colour: sickly radium green.

Anything painted with a dark foreground band along the bottom must also be listed in
`GROUND_LIFT` in `game.js`, or the squad stands inside that band on visible nothing. The lift
is measured, not guessed: the fraction of the image height that is essentially black from the
bottom up, times 0.9, in vh. Suite 49 recomputes the band for every backdrop and fails if one
grows a foreground without an entry.

- **`bg_carrionfield.webp`** — the Carrion's ground.
  > An enormous animal ribcage half-buried in a dust plain, ribs arching overhead like rafters
  > in hard silhouette against a jaundiced sky, scraps of hide still stretched between them,
  > smaller bones and burrow mouths scattered across the ground, a haze of flies. Accent
  > colour: sallow yellow-green.

---

## Adding a new portrait

1. Trim to the alpha bounding box, scale the long side to 640, save as WebP (quality ~88).
2. Add the filename to `ASSET_LIST` in `game.js`, and to `PENDING_ART` as well if the file
   is not in the repo yet.
3. Point the unit's `img` at it and check the `scale` on the field - a wide silhouette at
   the same scale reads much larger than a tall one. A commander that arrives with a
   retinue shares its row, and `fitEnemyRow` narrows the pair to fit, so check both units
   are legible together rather than only the commander alone.

### `hero_fiend.webp` — Trench Fiend
*The front-rank grinder. Spends his own blood to swing harder.*

> A wasteland trench soldier: a battered steel helmet over a riveted gas mask with a corrugated
> hose, a spiked pauldron lashed to one shoulder, a long patched greatcoat over layered rag
> armour, a serrated bayonet in one hand and a hand-cranked circular saw in the other, boots
> wrapped in filthy bandages. Hunched forward, mid-advance. Accent colour: dried blood brown.

### `hero_hazmat.webp` — Hazmat
*The mid-rank decontaminator. Corrodes what it hits and scrubs the squad clean.*

> A sealed chemical-warfare suit in faded olive, a twin-filter respirator with round glass
> lenses, a pair of pressurised tanks on the back with one glowing luminous green through a
> viewport, thick ribbed hoses running from the tanks to a drum-fed spray gun held across the
> body, gauges at the belt. Heavy, deliberate stance. Accent colour: toxic bioluminescent green.

### `hero_harpooner.webp` — Harpooner
*The back-rank line. Hauls whatever is hiding at the back of the enemy out to the front.*

> A wasteland marksman kneeling to fire: a burlap-and-netting ghillie hood strewn with frayed
> scrim, a scarf over the lower face, one glowing red optical implant where an eye should be,
> a long scoped rifle with a barbed harpoon head and a coiled cable running back to a spool, a
> pressurised cylinder strapped across the chest. Accent colour: signal red.
