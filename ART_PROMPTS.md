# Art briefs

The portrait style the roster is drawn in, and the briefs each existing piece was drawn
from. Kept so the next portrait matches the ones already on the field rather than drifting.

Save every portrait as **WebP**, trimmed tight to its alpha with the long side at 640, in
the repo root. Anything listed in `PENDING_ART` at the top of `game.js` is commissioned but
not yet drawn: the preloader and the service worker skip it, and something already drawn
stands in for it - the Warlord portrait for a portrait, the faction's home picture for a
place - so the game stays playable while art is outstanding.

**Outstanding now: the Frost - six portraits and three pictures - and five places, one per
faction.** Their briefs are the next two sections.

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

## Commissioned - the Frost

The sixth faction, and the first thing in the game that is cold. Up north the winter never
ended: the bombs put enough into the sky to shut the sun out, and up there it never came all
the way back. What comes down out of it is not a gang and not a cult. It is a garrison that was
put into cold storage to wait out the war and has been waking up a few at a time ever since -
still in uniform, still under orders, and in no hurry at all, because the cold has always been
on its side. The roads turn north from sector 3.

Every one of them asks the same question: **can you end it before the cold does?** Rime sets on
them every turn they are left standing, they freeze your people solid, they bleed the whole line
while they stand, and one of them is counting down to a barrage. Heat is the answer to all of it.

Nine pieces: six portraits and three pictures. Until each one lands, something already drawn
stands in for it - listed below - so the faction is playable from the first commit.

The Commandant is the one exception. A commander only holds the road once its own portrait and
its own arena are both drawn - every commander on the road wears its own face - so until
`enemy_boss_commandant.webp` and `bg_blastdoor.webp` have both landed, the road deals the seven
commanders it already has and the Commandant waits. Land the second of the two and it joins the
rotation with nothing else to change. Every seeded commander order changes on that commit too,
because the rotation is one longer. And the game gets easier on it: measured before it landed,
the Commandant on the road took the share of expeditions won from about 18% to about 22%. It is
not soft itself - an eighth commander means the hardest two are dealt less often - so the commit
that lands its second file is the one to re-read the wall on.

| File | What it is | Stands in until drawn |
|---|---|---|
| `enemy_frost_trooper.webp` | Frost Trooper - the line | `enemy_raider.webp` |
| `enemy_frost_gunner.webp` | Cryo Gunner - freezes an operator solid | `enemy_choir_censer.webp` |
| `enemy_frost_hauler.webp` | Coldhauler - its cold bleeds the line | `enemy_juggernaut.webp` |
| `enemy_frost_signaller.webp` | Signaller - calls the guns every third turn | `enemy_sniper.webp` |
| `enemy_boss_commandant.webp` | The Commandant - the commander | nothing: off the road until this and its arena land |
| `enemy_frost_pod.webp` | Cryo Pod - the Commandant's garrison, on ice | `enemy_turret.webp` |
| `bg_icefield.webp` | The Frost's home - THE ICE | `bg_combat.webp` |
| `bg_cryovault.webp` | The Frost in the TUNNELS | `bg_icefield.webp` (or `bg_combat.webp`) |
| `bg_blastdoor.webp` | The Commandant's arena | nothing: off the road until this and its portrait land |

**Palette.** Use the shared style brief above for the portraits and the background style brief
in the next section for the pictures, but swap the palette for this faction: *muted palette of
dirty snow-white, gunmetal grey and frostbitten blue, with one saturated accent colour*. The
accent throughout is **glacier cyan** - the coolant their equipment runs on and the colour the
ice glows where it cracks. Keep it to the coolant, the lights and the ice; the rest stays grey.

**Shared look.** Pre-war cold-weather military kit that has been on ice for a very long time:
stained white winter-camouflage smocks over dented grey plate, fur-lined hoods, frost-rimed gas
masks and goggles, coolant tanks and armoured hoses with cyan fluid showing through viewports,
a stencilled unit number and a snowflake insignia on the plate, ice crusted along every edge
and seam, breath fog. Frostbitten skin where any shows. Soldiers, not savages: upright,
drilled, deliberate - and slow, because everything about them is cold.

**The portraits.** Ordinary hostiles match the weight of `enemy_raider.webp`; the Coldhauler is
a heavy, drawn at the bulk of `enemy_juggernaut.webp`; the Commandant is a commander, twice a
trooper's bulk.

### `enemy_frost_trooper.webp` - Frost Trooper
*Rime sets on it every turn it takes; a heavy hit or any fire shatters it.*

> A pre-war infantry soldier thawed out of cold storage: a stained white winter-camouflage
> smock over dented grey body armour, a fur-lined hood drawn tight over a frost-rimed gas
> mask with round goggles, a sharpened entrenching spade held low in one hand, a rifle slung
> across the back, and ice growing thick along the shoulders and forearms like a second
> shell. Hunched against the cold, advancing at a slow trudge. Accent colour: glacier cyan
> glinting in the ice.

### `enemy_frost_gunner.webp` - Cryo Gunner
*Freezes an operator solid: they lose a turn.*

> A soldier in a quilted grey cold-weather suit with a heavy coolant tank on the back and a
> glowing cyan viewport in the tank, a stubby wide-mouthed cryo-projector held at the hip
> fed by an armoured hose, white freezing vapour pouring from the muzzle, a sealed hood with
> a single cracked visor slit, frost spreading up both gauntlets. Braced, spraying across
> the body. Accent colour: glacier cyan coolant.

### `enemy_frost_hauler.webp` - Coldhauler
*While it stands, the cold takes a bite out of every operator every turn.*

> A huge soldier bent under a refrigeration plant strapped to its back - a boxy rusted
> cooling unit with fins, a fan cage and a dripping condenser coil - venting a heavy fog of
> white cold that pours down around its legs, layered riveted armour furred with hoarfrost,
> thick arms ending in a frost-caked pry bar, face hidden behind an iced-over respirator.
> Slow and heavy, with cold coming off it like smoke. Accent colour: glacier cyan warning
> lights on the plant.

### `enemy_frost_signaller.webp` - Signaller
*Calls in the guns: every third turn a shell lands on the whole squad until it dies.*

> A lean officer in a long white greatcoat with a fur collar and a fur-trimmed peaked cap, a
> field radio set with a tall whip aerial strapped to the back, a telephone handset pressed
> to one ear, heavy binoculars at the chest, the free arm raised and pointing hard out of
> frame as if calling a target. Frost in the eyebrows, lips blue with cold. Accent colour:
> glacier cyan on the radio's tuning dial.

### `enemy_boss_commandant.webp` - The Commandant
*The commander: arrives with two of its garrison frozen in pods, and every third turn one opens.*

> A towering garrison commander in pre-war powered cold-weather armour under a long
> ice-stiffened officer's greatcoat and a high fur mantle, a peaked officer's cap over a
> sealed frost-crusted faceplate with a cracked visor, a spine of cyan-lit cryo tubes
> running down its back into the armour, rows of frozen medals across the chest, a heavy
> cryo-cannon carried in one hand like a walking stick, the other gloved hand raised to give
> an order. Frost billowing off it. Completely unhurried. Accent colour: glacier cyan
> coolant light.

### `enemy_frost_pod.webp` - Cryo Pod
*A sealed pod on the field: break it before it opens and what is inside never wakes.*

> A pre-war cryogenic storage pod stood upright and dragged onto the ice: a scratched steel
> capsule with a frosted glass window in the front, the dim silhouette of a frozen soldier
> just visible through the rime inside, heavy locking clamps, torn coolant pipes venting
> white vapour, a stencilled number and snowflake insignia on the casing, cyan status lights.
> Nothing outside the pod.

**The pictures.** Same frame as the places in the next section: opaque WebP, portrait, about
768x1344, subject centred, lower third left as open, lit ground for the line to stand on.

**What the game draws over them.** The Frost's own sky is new, and so is its ground:

- **BLIZZARD**, the Frost's weather - snow driven sideways across the whole frame, white banks
  of it rolling through, and a cold blue-white cast over everything. Paint the sky overcast
  and dim, not already mid-blizzard, or the two stack into a white-out.
- **THE ICE**, the Frost's ground - a pale sheen across the floor, cracks in the ice, snow
  lifting at the squad's feet and glints on the surface.
- **TUNNELS** - as in the next section: a roof strip, three lamps, dark walls and the frame
  dimmed by about half. Paint the vault lit, with an opening to the sky for the snow.

### `bg_icefield.webp` - the Frost's home, THE ICE
*"A frozen lake under a foot of snow." Where the garrison comes down off the glacier.*

> A frozen lake at the foot of a glacier under a nuclear-winter sky: a wide flat sheet of
> snow-dusted ice running back to a far shore of dead black pines and a collapsed radio mast,
> a pre-war icebreaker ship frozen in at an angle in the middle distance with its hull split
> open, pressure ridges and long cracks across the ice, wind-scoured drifts, a dim white disc
> of sun behind heavy grey cloud. Accent colour: glacier cyan in the cracks of the ice.

### `bg_cryovault.webp` - the Frost in the TUNNELS
*The vault the garrison sleeps in, two ranks wide.*

> The garrison's cryo-vault: a concrete bore two ranks wide lined down both sides with upright
> cryo pods, most still sealed with frost over the glass, a few burst open and empty, conduit
> and coolant pipes along the ceiling furred with ice, caged work lamps, a frozen floor with
> drag marks, and at the far end a breach in the vault roof where snow falls through a shaft
> of grey daylight. Accent colour: glacier cyan pod lights.

### `bg_blastdoor.webp` - the Commandant's arena
*Where the vault opens onto the ice.*

> A vast pre-war blast door set into the face of a glacier, standing half open with cold cyan
> light and vapour spilling out of it, a frozen parade ground in front ringed by snow-buried
> vehicles, bare flagpoles and dead searchlight towers, the garrison's stencilled insignia
> across the door. Wide, empty and waiting.

### Delivering the Frost

1. Save each piece as WebP in the repo root under exactly the filename above - portraits
   trimmed to their alpha with the long side at 640, pictures at quality ~88.
2. Take it off `PENDING_ART` at the top of `game.js` and leave it in `ASSET_LIST`. That is the
   whole switch: the stand-in above stops being used the moment it comes off. The Commandant
   takes two: it goes on the road the moment the second of its portrait and arena comes off.
3. Run the suites. Suite 49 measures a picture's foreground and fails if it needs a
   `GROUND_LIFT` entry; the Frost's own suite fails if a piece is still pending with its file
   already in the repo, or is off the list with no file.
4. Look at it on the phone in a real fight, and check the `scale` - the Commandant stands next
   to its pods, and a wide silhouette at the same scale reads much larger than a tall one.

---

## Commissioned - a place for every ground

Each faction fights on two grounds and used to be drawn on one picture, whichever ground the
fight was on. For two of them that picture is of the wrong ground for most of their fights: the
Raiders' highway is broken concrete (RUINS) and three in four of their fights with ground are on
the OPEN FLATS; the Beasts' canyon is a salt flat (OPEN FLATS) and three in four of theirs are in
TUNNELS. Five new places, one per faction, each for the ground its home picture does not show:

| Faction | Home picture shows | New place | Ground |
|---|---|---|---|
| Raiders | `bg_highway` - RUINS | `bg_saltflats.webp` | OPEN FLATS (their signature) |
| Beasts | `bg_canyon` - OPEN FLATS | `bg_den.webp` | TUNNELS (their signature) |
| Mech | `bg_refinery` - RUINS | `bg_pipeworks.webp` | TUNNELS |
| Choir | `bg_congregation` - FLOODED WORKS | `bg_exclusion.webp` | RUINS |
| Carrion | `bg_carrionfield` - THE NEST | `bg_burrows.webp` | TUNNELS |

Nothing about the fight changes when a place arrives: which ground a fight is on is rolled
exactly as before, and the picture only follows it. Until a file is delivered, a fight on that
ground shows the home picture, as it always has.

**Style.** Put this in front of every prompt below:

> Grimy post-apocalyptic wasteland background plate, hand-painted comic-book illustration,
> heavy black inking and cel shading, muted palette with one saturated accent colour, no
> characters or figures, no text, no logo, no border.

**Frame.** Opaque WebP, portrait, about 768x1344, like `bg_congregation` and
`bg_carrionfield`. The game pins the picture to the bottom of the screen and crops the top and
sides to fit a phone, so keep the subject centred and leave the lower third as open, lit ground
for the line to stand on. If the plate comes back with a dark foreground band anyway, it needs
a `GROUND_LIFT` entry (see *The grounds*, below).

**What the game draws over it.** Each ground already has layers of its own drawn on top of
whatever picture is behind the fight, and the weather is drawn over the whole frame. Paint to
sit under them rather than against them:

- **OPEN FLATS** - a heat haze across the middle of the frame, a pale-blue mirage low down, and
  cracked hardpan with a lift of dust at the squad's feet.
- **RUINS** - a rubble floor at the feet, a broken wall beside the squad's front rank, and loose
  rubble in front of them.
- **TUNNELS** - a roof strip across the top quarter with three hanging lamps, dark walls
  closing in from both sides, and the whole frame dimmed by about half. A tunnel painted dark
  goes black under that: paint it lit, with the depth in the middle of the frame. And because
  the weather falls over everything, each tunnel below has an opening to the sky somewhere -
  a collapse, a vent shaft, burrow mouths - for the rain or the dust to be coming through.

### `bg_saltflats.webp` - the Raiders on the OPEN FLATS
*"A hundred metres of hardpan. Rifles own it." Where the highway runs out.*

> A dry salt lakebed where the highway runs out: cracked white hardpan flat to the horizon, the
> snapped end of an elevated road stopping in mid-air at one edge of the frame, burnt-out cars
> dragged into a ragged ring, long looping tyre tracks cut across the salt, oil drums burning
> with black smoke, a scrap-built lookout tower flying a torn skull flag. Hard light under a
> bruised purple storm sky - the highway's sky. Accent colour: pale mirage blue where the heat
> lifts off the salt.

### `bg_den.webp` - the Beasts in the TUNNELS
*"A service tunnel two ranks wide." Dug into the canyon's rock, and nobody's but the pack's now.*

> A service tunnel bored into red canyon rock and taken over as a den: a round concrete bore two
> ranks wide running straight back to a collapse at the far end where daylight falls through in
> a shaft, the walls gouged with claw marks over half-scraped hazard stencils, gnawed bones and
> torn hide heaped along the sides, old cable hanging from rusted brackets, bedding scraped into
> hollows, red dust hanging in the light. Accent colour: the warm amber of the daylight through
> the collapse.

### `bg_pipeworks.webp` - the Mech in the TUNNELS
*The service tunnels under the refinery, which is what a service tunnel was built for.*

> The service tunnels under the refinery: a concrete bore two ranks wide lined with pipe runs as
> thick as a body, valve wheels and pressure gauges, a grated catwalk along one wall, caged
> sodium lamps, steam leaking from the joints, a drone charging cradle bolted into an alcove,
> and at the far end a ventilation shaft dropping a column of smog-light from the surface.
> Accent colour: toxic green, the refinery's smoke finding its way down.

### `bg_exclusion.webp` - the Choir in the RUINS
*"Broken concrete in every direction." The town around the reactor the Choir worship in.*

> The dead town inside the reactor's fence: gutted concrete apartment blocks with every window
> black, a stopped fairground wheel rusting against a burnt-orange sky, the cracked containment
> dome of the congregation on the horizon, cult symbols daubed across the walls in luminous
> paint, rows of candles in green glass along a broken wall, fallen street signs and car shells
> half-buried in concrete rubble. Accent colour: sickly radium green.

### `bg_burrows.webp` - the Carrion in the TUNNELS
*Under the dust plain, where the swarm has broken through into something people built.*

> A service tunnel under the dust plain that the swarm has broken into: a concrete bore two ranks
> wide split open along the roof where burrows have come through from above, roots and small
> bones hanging through the cracks, the walls slick and scored where something large has
> squeezed past, drifts of shed fur and chitin along the edges of the floor, gnawed cable,
> jaundiced light falling through the burrow mouths in shafts, a haze of flies. Accent colour:
> sallow yellow-green.

### Delivering a place

1. Save it as WebP (quality ~88) in the repo root, under exactly the filename above.
2. Take it off `PENDING_ART` at the top of `game.js`, and leave it in `ASSET_LIST`. That is the
   whole switch: the next fight on that ground is drawn on it, and it keeps the sound of its
   faction's home picture.
3. Run the suites. Suite 49 measures its foreground and fails if it needs a `GROUND_LIFT`
   entry; suite 196 fails if a place is still on `PENDING_ART` with its file already in the
   repo, or is off it with no file.
4. Look at a fight on it on the phone, on its own ground. The layers listed above were drawn to
   make a picture of somewhere else read as that ground. Over a picture of the ground itself,
   some may be doing the same job twice - the tunnel's roof strip and the dimming most of all.

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

### `enemy_boss_ossuary.webp` — The Ossuary
*The last warlord. Sector 7 is the end of the road and this is what is standing on it.*

It is not one of the seven that hold the road - it is what they answer to, and it has been
collecting them for far longer than the player has. The design note that matters: it is doing
the same thing you are. You take a skull off every commander you fell and build the Citadel out
of them; this one built itself. Read it as a throne that stands up, not as a bigger raider.
Scale 2.5, the largest thing in the game.

> A colossal warlord throned in bone: a towering armoured figure whose pauldrons, breastplate
> and crown are lashed together from the skulls and plate of other warlords, trophy helms wired
> along a rack at its back like a bone standard, a huge chained cleaver held point-down in the
> earth with both hands resting on the pommel, tattered banners of flayed hide hanging from its
> arms, a blank iron death-mask with no eyeholes. Standing utterly still, chin lifted, as though
> it has been waiting a very long time. Accent colour: cold bone-white against dead black iron.

---

### `bg_ossuary.webp` — the last arena
*Drawn at 768x1346 and trimmed to 768x1000 before it went in.*

The plate came back with a shadowed lip across the bottom 38% of its height. Left whole it
measured a 38vh ground line, which stood the squad a third of the way up the screen with the
foreground empty under them - correct footing, wasted frame. Cropping the bottom 346px brings
the band to 22%, the same depth `bg_carrionfield` carries, and the lit arena floor reaches the
edge of the frame. Ground line: 20vh.

> A vast open bowl of cracked earth ringed by a wall built entirely of stacked skulls and
> scavenged armour plate, iron standards driven into the ground at intervals, a low bone-white
> haze on the horizon, no structures and no figures. Wide, empty, and quiet.

---

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
