// Every balance claim in this repo's history came from arithmetic models, never from play.
// This drives real expeditions headlessly through the real engine - the same functions a player
// touches - and reports where runs actually end, what gets used, and what never fires.
//
//   node tests/simulate.js [runs] [--difficulty 1.0] [--contracts GLASS,NO_REGROUPS]
//
// It asserts nothing. It is a measuring instrument, and it prints what it measured.
//
// ── On sample size ──────────────────────────────────────────────────────────────────────
// Median score is heavy-tailed: a run ends anywhere between sector 1 and sector 10, and the
// deep runs carry most of the score. Thirty expeditions does not resolve it. On identical
// code this printed 10,025, 10,600, 10,545 and 10,560 at thirty, then 16,210 at sixty, then
// 11,455 at a hundred and fifty. Four samples agreeing inside 6% looked like a tight
// instrument and was luck - a phase measured against those baselines came out at +76%, then
// +11%, then -33%, with the sign unstable.
//
// So: 150+ expeditions before believing anything about score, nodes or depth, and a paired
// baseline run in the same session. Wipes per run is the stable figure and sits near 4.5
// across every sample ever taken here; if lethality is the question, thirty will do.
//
// ── And since D12, the file says how sure it is ─────────────────────────────────────────
// "150+ before believing anything" is a rule of thumb standing in for an error bar, and a rule
// of thumb cannot tell you whether the two arms in front of you differ. Every median this file
// prints now carries a bootstrap 90% interval: resample the runs with replacement, take the
// median of each resample, keep the middle 90% of those.
//
// Checked against distributions whose median is known, 300 trials each, including a lognormal
// one shaped like an expedition score:
//
//                          n=30    n=40    n=60   n=150
//   covers the true median   85%     88%     90%     91%     (nominal 90%)
//   interval width           81%     70%     58%     35%     (as a share of the median)
//
// So the old rule was about right - roughly 150 runs buys a score median worth +-17% - and it
// was never the useful statement. Two arms whose intervals overlap have not been shown to
// differ, and that can be said at forty runs. Slightly under-covering at thirty on a
// heavy tail is the honest cost of a small sample, and is itself worth knowing.
//
// This is written down because a claim was published off a thirty-run pair and was wrong:
// N11 was reported as +49% median score. Re-measured at 150 against its own predecessor it
// is 14,460 -> 11,455, which is not an increase at all.
//
// ── And RUNS WON is not the safe alternative ────────────────────────────────────────────
// A median is heavy-tailed, so the temptation is to reach for a proportion instead - runs won
// out of runs, which feels like it ought to behave. It does not, at the sample sizes anyone
// actually runs. Seven 14-expedition samples taken during D09, three of them on IDENTICAL
// code:
//
//   identical build, three samples    runs won  2, 3, 6      deepest sector  5, 6, 7
//
// Two wins and six wins out of the same fourteen, from the same build. A Fisher exact test on
// the pooled arms of that phase read p = 0.005 for a difference that a bisect then showed was
// not there, because six correlated small samples had been treated as independent evidence.
// Runs won is a proportion of a number that is itself tiny: fourteen runs at a ~20% win rate
// is three wins, and three is inside its own noise.
//
// So: the win count is for describing a sample, never for comparing two. What DID separate in
// that phase was the depth median, and only once seven samples were grouped by a single
// bisected variable and read as a perfect separation - which is a permutation test on four
// numbers against three, p = 0.03, and about as much as this instrument can honestly deliver
// without going to the hundreds.
//
// A rule of thumb for the next phase that wants to move a difficulty dial: a change worth
// shipping should show up in the same direction in three separate samples, and if it only
// shows up in one statistic, bisect it before believing it.
//
// ── And that rule does not survive being pointed at a whole report ──────────────────────
// Three samples an arm separating completely is strong evidence about ONE row. It is weak
// evidence about a row picked out of hundreds, and this file prints 251 numbers. Under the null
// - two arms drawn from the same distribution - three against three separate one way or the
// other with probability 2·(3!·3!)/6! = 10%, so a whole-report diff at n=3 hands back about 25
// spurious movers before it has found a single real one.
//
// I07 ran exactly that diff and got 76. The 51-row excess is the finding; which 76 they are is
// not. What sorts them is the SIZE of the gap, and there the answer was unambiguous: the rows
// it concluded from run ×0.57 to ×7.3, while the seventeen that landed inside ±10% sit squarely
// in the noise band and were recorded as unresolved rather than moved.
//
// So when the question is a whole report rather than a dial: read the ratio, not the verdict,
// and give a row near 1.0 no weight at all unless a companion row moves hard in the same
// direction. When the question is one dial, the rule above still holds as written.
//
// ── On the depth figures printed before C02 ─────────────────────────────────────────────
// Every one of them is void, and by a wide margin. This file never called recoverDowned on a
// won or a lost fight - only withdraw() reached it, because withdraw() does it for itself - so
// an operator who went down and was not healed mid-fight lay at zero health with a live
// bleed-out clock, walked into the NEXT initiateCombat still down, and was ticked to death by
// the turn queue. The engine drags those operators clear at the end of every fight however it
// ended. This file was killing them.
//
// Fixing it moved the game this file reports by more than any phase ever has:
//
//                              before   after
//   deepest sector, median        2       5
//   nodes cleared, median        ~25     120
//   operators on the floor/run   14.2    21.8   (they get up, so they can fall again)
//   lost for good, per run       2.33    1.92
//
// So: the wall this file has been measuring against was an artefact of the instrument, and no
// difficulty conclusion drawn from a pre-C02 run of it should be carried forward. Re-measure.

// ── What E01b's extraction moved ────────────────────────────────────────────────────────
// This file kept private copies of two engine rules, both because the real one was welded to a
// screen: the won-fight payout (computed inline in checkWinState on the way to a LOOT button)
// and the sector crossing (advanceSector ends in resolveConsequence, which paints). E01b split
// the state change out of each - fightPayout, bankNode, crossSector - and pointed this file at
// them. Measured 3 x 150 expeditions an arm, difficulty 1, the standing policies:
//
//                              before                    after
//   score, median         42,118 / 43,040 / 42,574   40,757 / 40,940 / 46,209
//   nodes cleared, median      99 / 99 / 97               99 / 99 / 99
//   deepest sector, median      5 / 5 / 5                  5 / 5 / 5
//   relics held, mean        12.4 / 12.9 / 12.6         12.6 / 12.7 / 12.8
//   median purse              292 / 300 / 286            295 / 296 / 330
//   wipes per run, mean      7.16 / 6.92 / 6.81         7.29 / 7.23 / 7.15
//   line deployments/150     1055 / 1006 / 1017         1060 / 1091 / 1056
//
// One thing separates cleanly and one thing explains it. Wipes per run are up in all three
// after-samples against all three before-samples, 6.96 to 7.22, and so are line deployments,
// 1,026 to 1,069 - and the second is the mechanism for the first. Routing the payout through
// bankNode means closeRanks runs on a won fight, which it had never once done here: an operator
// lost in simulation used to leave a permanently empty rank while the bench stood behind it
// doing nothing. Ranks close now, more operators reach the line over a run, and more of them
// are there to be lost. The reported game is slightly harsher, and it is the game that exists.
//
// Everything else moved inside its own before-arm spread and is NOT established. Score
// especially: the before arm sits in a 922-point band and the after arm in a 5,452-point one,
// two samples below all three of the before and one above all three. That is the heavy tail
// this file warns about at the top, not a result. RATIONING's cut, which the payout also
// restores, cannot show here at all - the standing policy runs at rung 0, where no protocol is
// active, so it needs an --ascension arm of its own before anything is claimed for it.

// ── What E08b's capstones moved, and it is a lot ────────────────────────────────────────
// E08b put one capstone per class above the two signature forks, gated at level 8 with both
// forks shut. The item was filed with a warning attached - a straight power addition on a slate
// that had already moved the wall - and the warning was right. 3 x 60 expeditions an arm, the
// before arm run from a frozen copy of the pre-change tree:
//
//                              before                    after
//   runs that ended the road  13 / 11 / 12 of 60       18 / 16 / 17 of 60
//   wipes per run, mean       6.82 / 6.82 / 6.95       6.32 / 6.28 / 6.38
//   nodes cleared, median      100 / 99 / 99            90 / 90 / 90
//   promotions per run         9.8 / 10.1 / 9.7        16.1 / 16.0 / 16.3
//   capstones taken               -                    6.33 / 6.37 / 6.32
//   score, median            43,585 / 42,153 / 43,928  44,944 / 36,671 / 43,335
//   deepest sector, median      5 / 5 / 5                5 / 5 / 5
//   lost for good, per run    3.70 / 3.88 / 4.05       3.92 / 3.95 / 3.55
//
// Three rows separate completely, all three in the same direction, and they are the same story
// told three ways. The win rate goes 18.3% to 28.3% - ten points, against the roughly eight E06
// deliberately took off. Wipes fall 6.86 to 6.33. And nodes cleared falls 99 to 90, which is not
// a squad doing less: it is a squad reaching the end of a finite road instead of grinding along
// it, which is also why score does not move - fewer nodes paid for, cancelling the extra wins.
//
// Score is NOT established either way: the after arm spans 36.7k to 44.9k against a before arm
// inside 1.8k, which is the heavy tail this file warns about at the top and not a result.
//
// The other thing worth recording: 6.33 capstones are taken a run and 0.13 are bought at the
// Outpost. The purchase door E08 opened is real and almost never the one used, because the
// promotion screen is free and reaches the player first. Promotions per run rise 9.9 to 16.1,
// which is exactly the 6.3 capstones - so the re-offer-until-taken rule costs no extra screens
// against a policy that takes it the first time it is shown. A player who banks it would see it
// again each level, and that is untested here because no policy in this file banks.

// ── E08c: the tuning lever that fixed the wrong dial ────────────────────────────────────
// E08b's measurement said the capstones overshot, and the lever proposed there was the gate:
// raise CAPSTONE_LEVEL from 8 to 10, land fewer of them, get the wall back. Measured 3 x 60 an
// arm against both earlier arms:
//
//                          no capstone            gate 8                 gate 10
//   capstones taken             -             6.33 / 6.37 / 6.32    4.70 / 4.35 / 4.05
//   wipes per run       6.82 / 6.82 / 6.95    6.32 / 6.28 / 6.38    6.55 / 6.95 / 6.72
//   ended the road /60     13 / 11 / 12          18 / 16 / 17          20 / 15 / 17
//   nodes cleared, med     100 / 99 / 99          90 / 90 / 90          90 / 99 / 94
//   score, median       43,585/42,153/43,928  44,944/36,671/43,335  49,138/45,106/46,154
//
// The lever works on what it was aimed at and not on what it was for. Uptake falls a third, and
// wipes come back inside the no-capstone range - 6.55-6.95 against 6.82-6.95, no separation, so
// on that dial gate 10 is indistinguishable from having no capstones at all. The win rate does
// not move: 17.3 of 60 against gate 8's 17.0, both still clear of the baseline's 12.0.
//
// Which says something worth keeping. The win-rate lift is not paid for by the NUMBER of
// capstones landed - cutting that by a third changed it not at all - so it is not a dosage
// problem. Every class having one real late-game power is the thing that converts runs into
// finished roads, and delaying it two levels leaves it present for exactly the late sectors
// where the road is won. Removing that lift means weakening the capstones themselves, which is
// a design decision about what the win rate should be rather than a number this file can find.
//
// Gate 10 is kept: neutral on wipes, which is the dial the wall is usually read on. Score is now
// separated upward (45.1k-49.1k against a no-capstone 42.2k-43.9k), which is the deeper runs
// finishing rather than a payout change - nodes cleared recovers from 90 to 94 at the same time.

// ── EVERY TABLE ABOVE THIS LINE PRE-DATES E12c ──────────────────────────────────────────
// Until E12c this file measured a squad fighting with its base three abilities, whatever its
// dossiers said - see below. Figures printed before it are not wrong, but they describe a rank
// III squad that never brought what rank III unlocked, and are not comparable with anything
// measured after it.

// ── The ten abilities this file had never fired ─────────────────────────────────────────
// Found while measuring E12b, and much larger than the item that found it. A class at dossier
// rank III brings four verbs minus whichever the muster benched, and buildNewRun benches the
// FOURTH by default - the muster screen is where a player un-benches it. This file calls
// musterDeploy and has never touched that control, so deckFor has always returned the base
// three. Measured over 60 expeditions with every class at rank 3 and 150,000 to 425,000 lifetime
// XP: 0.0 fourth-ability swings a run. SHIELD_SLAM, STIM_DART, SHIV, HEAT_WAVE, RIOT_BUTT,
// PIERCING_VOLLEY, HARRY, TRENCH_SWEEP, TANK_RUPTURE and WHALE_LINE have never been fired in any
// measurement this file has ever taken, and no figure here has ever described a rank III squad.
//
// The obvious fix is not obvious. A one-line policy - keep the free basic and the self-action,
// bench the first cooldown-bearing base verb for the mastered one - does bring them: SHIELD_SLAM
// alone becomes 13-15% of every move made. It also moves the reported game further than any
// phase ever has, 3 x 60 an arm against the same build without it:
//
//                            fourth benched         fourth brought
//   runs that ended the road  20 / 15 / 17            5 / 8 / 6
//   score, median         49,138/45,106/46,154   31,603/34,628/35,752
//   deepest sector, median      6 / 5 / 5              4 / 5 / 4
//   lost for good, per run  3.93 / 4.35 / 4.28    4.97 / 4.73 / 5.57
//
// A win rate of 28% falling to 11% is not a finding about the fourth abilities. It is a finding
// about that policy: it benches Heavy Wrench to bring Shield Slam, and the picker then fires the
// swap constantly.
//
// E12c settled it by measuring the other rule. Benching the FREE BASIC instead overlaps the
// base-three arm on every row, and that is the policy the muster block above now uses. The
// engine's own default was left alone: the basic is what guarantees an operator an action, a
// player sees the bench control every time they muster, and the difficulty measurement says the
// choice does not move the wall either way. The gap was the harness never making the choice, not
// the choice the game makes for you.
//
// J05 RE-READ. BOTH HOLD. E12b's ten never-fired moves all fire on the fixed harness - per
// career, STIM_DART 6,464, SHIELD_SLAM 6,107, HARRY 4,592, HEAT_WAVE 4,204, PIERCING_VOLLEY
// 2,966, SHIV 2,368, RIOT_BUTT 2,368, TRENCH_SWEEP 701, WHALE_LINE 566, TANK_RUPTURE 234. The
// 13-15% quoted above for SHIELD_SLAM belongs to the policy E12c REJECTED and was never the
// shipped number; under the rule that ships it sits at 3.4% of all moves. E12c's own conclusion
// is a comparison between two arms measured through the same lens, which is the one shape I07
// leaves standing, so the overlap it found is unaffected. Neither is retracted.

// ── F01: what the commander fight is worth once the screen stops lying ──────────────────
// The wall at tier ten, measured 3 x 60 an arm against the same build without it. F01 fixed
// three forecast defects (the Colossus's wind-up, invisible to the board and wearing an icon it
// could not perform; DRAG_DOWN priced at the rank the mark is leaving; CALL_IT_IN's clone
// arriving as a champion), gave every commander an opening turn it does not swing on, and put a
// camp within two nodes of every commander in the generator.
//
//                             before                    after
//   camps offered, per run    1.00 / 0.95 / 1.08        1.77 / 1.65 / 1.47
//   bosses felled, mean       3.93 / 3.95 / 3.75        4.20 / 4.35 / 4.87
//   withdrawals, per run      5.15 / 6.05 / 5.07        6.37 / 6.35 / 6.63
//   score, median            37.0k / 35.9k / 35.1k     38.4k / 43.3k / 50.2k
//   wipes per run             6.68 / 6.23 / 5.88        6.68 / 6.53 / 6.03
//   wipes at tier 10         343/401 / 310/374 / 288/353   335/401 / 340/392 / 312/362
//   runs that ended the road    14 / 17 / 17              19 / 17 / 23
//
// Four rows separate completely and all four say the same thing: the squad reaches the
// commander with a choice made, and gets through more of them. The two rows the wall is
// usually read on - wipes per run, and how many of them are at tier ten - do not separate at
// all, and neither does the win rate. So this is not a difficulty cut: squads wipe as often as
// they did and still wipe at the commander, they just get further per career before it happens.
// That matters for what comes next, because the capstone lift measured at E08b is still
// unresolved, and a phase that had moved the wall as well would have made both unreadable.
//
// The withdrawal row is the forecast fix showing up as behaviour: the harness's brace and
// withdraw policy reads threatBoard, and until F01 a whole-line salvo was not on it.

// ── The long career, re-measured after C04 ──────────────────────────────────────────────
// Four Citadel spots had no ceiling, and `--meta carry` at 40 runs used to stop terminating on
// them: unlimited fallback bunkers meant a squad that could not be made to stop. Capped, the
// same sample runs to the end. 40 expeditions, difficulty 1, line draft, warm faces:
//
//   deepest sector, median            6      (mean 5.3, p10 2, p90 7)
//   ended by                          won 8, wiped 32
//   reached sector 7                  15 of 40, and won it 8 of 15
//   Citadel at the end                every spot at its ceiling
//   skulls left unspent               635
//   deepest sector, mean, by third    5.77 / 5.38 / 4.64
//   grudge on commanders met, same    2.38 / 2.98 / 3.00
//
// The last two rows are the point of C04. The hillside saturates - 635 skulls with nowhere to
// go, where before they would have bought 635 more levels of something - and depth then drifts
// down rather than up, because the grudge ramp keeps climbing under a meta that has stopped.
// A career now buys a floor, not an escape. That is the shape the cap was for.

// ── The ladder, measured ────────────────────────────────────────────────────────────────
// `--rung N` deploys every expedition at ascension rung N. Three matched 24-run carried
// careers, difficulty 1, line draft, warm faces:
//
//                            rung 0    rung 4    rung 8
//   deepest sector, median      6         4         2
//   mean                       5.2       4.4       2.4
//   nodes cleared, median      115        93        40
//   ended the road           6 of 24   5 of 24   1 of 24
//   score, median            30,635    40,732    27,780
//   score on a won run      120,518   205,739   363,068
//
// Depth is the signal to trust here: three medians two sectors apart on 24 samples each. The
// win column is not - 6 against 5 is noise at this sample size, and only rung 8's single win
// is clearly different. Read that way, two things are true and one is worth an argument.
//
// True: every band of the ladder does something, and the reward tracks it - a won run pays
// roughly the multiplier it was run at, 1.00 / 1.70 / 3.00 against 121k / 206k / 363k.
//
// Worth an argument, AND SUPERSEDED - kept because the reasoning is still how to read this
// file, not because the conclusion holds. It said the cost was back-loaded: rungs 1-4 cut the
// median road from 6 sectors to 4 while the multiplier more than covered it, so the first half
// of the ladder paid a strong player to climb it.
//
// Re-measured on the C10 build, five commits later, 24 runs a rung on this same instrument:
//
//                          C05          C10
//   rung 0 raw           30,635       37,435     the base game got EASIER
//   rung 4 raw           23,960        9,880     median depth 4 -> 2
//   rung 8 raw            9,260        8,860     barely moved
//   shares          1.00/0.78/0.30   1.00/0.26/0.24
//
// So rungs 4 and 8 have collapsed onto each other - eleven percent apart where they were nearly
// threefold - and the ladder's whole cost now sits in its first four rungs. Break-even today
// would be x3.79 at rung 4 and x4.23 at rung 8; setting those fixes the arithmetic and leaves a
// ladder that costs nothing between 4 and 8. The multipliers are no longer the defect. That is
// D12, blocked on D07.
//
// The lesson for anyone reading a figure out of this header: a balance reading is about the
// build it was taken on. Five feature commits moved this one enough to invert its conclusion.
//
// ── D12: and then two more commits inverted it back ────────────────────────────────────
// Both paragraphs above are now history. Re-measured after D01 and D02, seven arms of 40
// carried expeditions each, this time with an interval on every median:
//
//   rung   raw median   90% interval      shipped   break-even
//     0        31,998   18,624 - 36,880      1.00        1.00
//     2        26,030   23,678 - 32,441      1.30        1.23
//     4        18,648   16,160 - 24,696      1.70        1.72
//     5        15,340   10,970 - 22,954      1.95        2.09
//     6        18,486   13,148 - 30,318      2.25        1.73
//     6        22,965   18,020 - 25,955      2.25        1.39   (second sample)
//     8        10,354    9,462 - 14,961      3.00        3.09
//
// Rungs 4 and 8 are separated again and break even at 1.72 and 3.09 - which is 1.70 and 3.00,
// the numbers that were already shipped. The reprice this file argued for would have been
// wrong by more than a factor of two. Nothing was changed.
//
// Rung 6's two samples disagree with each other by a quarter and overlap every other arm, so
// forty runs does not resolve it. The first sample invited a story - LONG SHADOW makes the run
// EASIER - and the interval refused it, after which the code settled it: the protocol floors
// every commander's grudge at one, which is more health, more damage, more armour, more speed
// and a grudge phase. It cannot make a run easier. That is the failure mode this whole file
// exists to catch, and it caught it on the same afternoon the intervals were added.
//
// The pairs actually separated at forty an arm: 0-8, 2-5, 2-8, 4-8, 6-8. No two ADJACENT rungs
// are. The ladder demonstrably costs something end to end; no single step of it has been
// individually measured, and pricing one rung against its neighbour needs far more than forty.

// ── What the learned moves cost, measured after C09 ─────────────────────────────────────
// From the second meeting a commander trades one of its intents for something it picked up
// losing to you. A trade should tighten the fight without running away with it, and the way to
// tell those apart is the commander win rate at the depths where the moves arm. Two matched
// 24-run carried careers, difficulty 1, line draft, warm faces - 269 commander fights each:
//
//                                 before      after
//   deepest sector, median           6          5
//   mean                            5.2        4.8
//   reached sector 7               29%        33%
//   commander fights, grudged      39% won    35% won
//     risen x3 (n~200)             40% won    37% won
//
// About three points off the commander win rate where the moves are armed, and the risen-x3
// row is the one to trust - it is the only band with a sample worth reading, and the x2 row's
// 30 -> 21 is thirty-odd fights of noise. Depth moved less than a sector and the share of runs
// reaching the gate went up rather than down, so this is a fight that got harder to open
// rather than a wall that moved. That is what a trade should look like: the commander is doing
// something else, not something strictly more.
// ── Four moves this file could not pick, repaired at D07 ─────────────────────────
// The "never used" line was read for a long time as a list of content nobody wants. Four of
// its entries were nothing of the kind - they were moves the policy below had no branch that
// could reach:
//
//   IRON_GUARD, OVER_THE_TOP, PURGE_VALVE   the game's only three self-actions. The fallback
//                                           ranking filters `act !== 'self'` and nothing else
//                                           ever set them, so they could not be chosen.
//   RAD_SHOT                                ranged, no cooldown - scored identically to the
//                                           Medic's PISTOL one line above it, and a stable
//                                           sort gives a tie to the earlier entry every time.
//
// So every reading this file has ever given about how long a line holds came from a player who
// could not brace, could not vent, and never fired one of the Medic's two triggers. That is the
// instrument D01's difficulty findings were taken from, which is why this was repaired first.
//
// Matched pair, 30 expeditions each, `--meta fresh` (the configuration this file's own notes
// say a question about the game a player meets has to be asked against - it also keeps runs
// independent, so a policy that plays better cannot buy itself a bigger Citadel and compound
// the difference):
//
//                                before      after
//   never used                   4 moves     none
//   deepest sector, median          4          5
//     mean                         3.8        4.5
//   reached sector 7             6 of 30    9 of 30
//   ended by                     won 4      won 6
//   nodes cleared, median          70         80
//   wipes per run, mean           4.00       4.60
//   actor turns per fight         18.9       20.1
//   wipes at tier 10             104/120    123/138
//   wipes on an elite node        0/120      3/138
//
// Read it in that order. The first row is the repair and the only one that needed no sample at
// all. The rows under it move together and all one way - a squad that braces lives longer, so
// it fights more, clears more and dies further along - but depth and score are exactly the
// figures the note at the top of this file says not to believe under 150 runs, and thirty is
// thirty. Treat them as consistent, not as measured.
//
// Two rows ARE settled, because both are shares over thousands of events rather than medians
// over thirty runs, and both matter to what is queued:
//
//   Tier 10 still takes 89% of every wipe (it was 87%). The nine tiers under the commander are
//   not the fight, and that now survives a player who braces - so it is the game's shape, not
//   an artefact of a passive simulator.
//
//   An elite node went from never fatal to fatal 2% of the time. Still not a threat; no longer
//   literally zero.
//
// The classes line changed meaning at the same time and is not comparable across the pair: it
// used to be the opening draft, read once at the muster, and is now everyone who actually stood
// in a line. Recruits appear in it for the first time (HARPOONER 9, HAZMAT 9, TRENCH_FIEND 4 of
// 30), and SCAVENGER goes 8 -> 17 - it was being fielded off the bench all along and the line
// could not see it. Any reading about classes that never leave the Outpost has to start again
// from the second number.
//
// J05 RE-READ, against three careers of 150 on the I05-fixed harness. THE REPAIR HOLDS: all
// four moves this phase made reachable do fire, and not marginally - per career, IRON_GUARD
// 12,140, RAD_SHOT 7,244, OVER_THE_TOP 457, PURGE_VALVE 240. The finding was that a branch
// could not be reached at all, and a count that large is not a lens artefact. What does not
// survive is any SHARE quoted here, for the reason I07 gives; and the thirty-run table above
// already says to treat it as consistent rather than measured, which was the right call twice
// over.

// ══ EVERY TABLE ABOVE THIS LINE WAS TAKEN THROUGH A BROKEN INSTRUMENT ══════════════════
// F03. Nine defects were found in this file by an audit of the whole repository, and together
// they meant it had never once measured the game the engine plays. They are listed and fixed
// below. The largest of them - the Outpost stat upgrade - was worth more than every balance
// phase in this repository put together, and it had been in here since the file was written.
//
// Nothing above this line is wrong about the CHANGE it measured: those readings are paired
// arms taken in the same session on the same instrument, and a difference measured that way
// survives a broken instrument as long as the break is on both sides of it. What does not
// survive is any absolute figure - a win rate, a median score, a depth, a "how hard is this
// game" of any kind. Every one of those above is a figure about a squad the game does not
// sell, playing a board it does not show, keeping fallbacks it has not earned.
//
// ── The nine ────────────────────────────────────────────────────────────────────────────
//   the upgrade      A hand copy at the sector-1 price granting BOTH +10 HP and +3 DMG per
//                    purchase. The Outpost sells one or the other, at upgradeCost, which has
//                    ridden sectorRewardMult since E09. Through buyUpgrade now.
//   the forecast     Every enemy's intent was re-rolled immediately before it acted, so the
//                    board this file's player spent its whole turn reading was thrown away
//                    before the blow. The engine rolls the NEXT intent at the END of
//                    executeEnemyAi; this file now lets it.
//   the bar          OVERDRIVE fired at foes[0] while every other move went through pickFoe -
//                    and FIELD_REVIVE aims at an ALLY, so every Medic overdrive this file has
//                    ever fired healed an enemy to half health.
//   the camp         Triage was a hand copy of 0.35 on the deployed line. The engine's own
//                    triage is 0.55 and reaches the bench when a MEDIC keeps the camp, so
//                    `--bench medic` had nowhere it could show up and measured nothing.
//   the fuse         Consequences were settled only at the sector crossing. consequencesDue
//                    counts NODES, and the engine settles after every one of them - so a debt
//                    that came due mid-sector waited for a boundary most careers never reach.
//   the top-up       The path that banks a commander kill the engine missed (about one in
//                    eight, the ones that end on a bleed tick) paid less than checkWinState:
//                    no grudge skulls, no fallback refund, no gear roll, no BOSS bounty tick,
//                    no Scavenger's Debt. The missing fallback is the one that moves depth.
//   the count        The "counts agree" self-check wrote this file's number into the engine
//                    before comparing, so it could fire on a double count and on nothing else.
//                    It reports both halves now: what the engine banked, and what was topped
//                    up here.
//   the order        THE LONG ROAD is kept by clearing the last sector, which sets
//                    runStats.won - so the recall branch, the only place this file set its own
//                    flag, is a branch LONG can never reach. It reads the engine's flag now.
//   the recruit      The E12c bench policy ran once at the muster, and a recruit signed three
//                    sectors later never got it, so TRENCH SWEEP, TANK RUPTURE and WHALE LINE
//                    were structurally unreachable. E12c called those three rare; they were
//                    blocked. The "never used" line could not say so either - it was built
//                    from ABILITIES, which does not contain the fourths.
//
// ── What the correction was worth, 3 x 60 an arm, same engine on every side ────────────
// The game did not change: game.js is untouched by this phase. Only the instrument changed.
//
//                            as reported before   without the upgrade fix   fully corrected
//   runs that ended the road   22 / 26 / 21 of 60      16 / 8 / 12            0 / 2 / 1
//   score, median             54.1k / 60.7k / 47.8k  44.5k / 32.1k / 41.8k  17.9k / 20.2k / 18.2k
//   nodes cleared, median         95 / 99 / 90          90 / 84 / 99          80 / 76 / 68
//   commanders felled            276 / 291 / 254            -                119 / 130 / 117
//   relics held, mean          12.4 / 13.3 / 12.0           -                 7.6 / 7.9 / 8.1
//   upgrades bought per run           -              87.7 / 74.5 / 80.5    44.5 / 43.0 / 40.4
//
// All three arms separate completely on the win rate. The middle column is the point of the
// middle column: the eight other corrections together take it from ~38% to ~20%, and the
// upgrade alone takes it from ~20% to ~2%. Two things were wrong with that one line and both
// mattered - the squad was getting two stats for one purchase, and paying a sector-1 price for
// them at any depth, which is why it bought twice as many.
//
// ── The baseline, 3 x 150 on the corrected instrument ──────────────────────────────────
// Default policy: difficulty 1.0, line draft, stim tactics, rare relics, meta carried, warm
// faces, withdraws from fights it is losing, THE LONG ROAD. 0 page errors on all three, and
// the reconciliation passes both ways on all three.
//
//   runs that ended the road      0 / 2 / 1 of 150        (0-1%)
//   wipes per run, mean        7.16 / 7.14 / 7.14
//   wipes at tier ten           909/1074 / 866/1071 / 872/1071   (81%)
//   score, median             20,567 / 20,605 / 19,906  [90% intervals within +-11%]
//   nodes cleared, median         87 / 76 / 80
//   deepest sector, by third    3.08/3.08/3.10  3.10/3.30/2.94  2.92/3.38/2.90
//   commanders felled, mean    2.09 / 2.13 / 2.07
//   relics held, mean           8.1 / 9.2 / 9.0
//   lost for good, per run     3.58 / 3.82 / 3.89
//   withdrawals, per run       7.99 / 7.68 / 7.69
//   regroups spent, mean       6.16 / 6.15 / 6.15
//   consequences resolved      0.85 / 0.74 / 0.91
//   upgrades bought, per run   45.4 / 44.7 / 44.1
//   abilities never fired      none / SNAP / none
//
// Two of those rows are worth saying in words, because they are not what this file has ever
// reported and they are not small.
//
// The road is not cleared. Three of 450 careers finished it. Every earlier figure for this -
// 23%, 28%, 38% - was the over-upgraded squad.
//
// And a career does not get deeper. Depth by thirds is flat at about 3.1, where this file used
// to print 4.00 / 5.00 / 7.13 and the note under it said the curve "is doing what it was built
// to do". On a corrected instrument the Citadel's compounding does not out-run the sector
// curve at all: the hundred-and-fiftieth career ends about where the first one did.
//
// Neither of those is a defect this phase can fix. They are what the game currently is, and
// what it should be is a design decision - the same one the capstone lift at E08b has been
// waiting on, now with a real number under it rather than a number off a broken instrument.
// Nothing balance-shaped should be read against anything above the marker line again.
//
// ── F06: the promotion policy changed, and the road did not ─────────────────────────────
// This file used to drain pendingPerkOffers straight into takePerkOffer without ever drawing
// the screen. That mattered once F06 moved the roll to the draw: the sim was deciding from a
// hand no player is ever dealt, and would have started throwing promotions away on cards a
// real screen never shows. It calls renderPerkOffer first now - the E03 lesson, applied to
// the last surface in this file that reached past a render into the thing behind it.
//
// A policy change needs a number under it, so: 3 x 150 an arm, matched pair, the two arms
// differing ONLY in game.js - this file was identical on both sides, so the pre arm draws a
// screen that (on that engine) does not re-roll, which is exactly the old behaviour.
//
//                              pre-F06                        post-F06
//   runs that ended the road   3 / 1 / 1 of 150               2 / 4 / 1 of 150
//   wipes per run           7.27 / 7.15 / 7.13             7.11 / 7.27 / 7.11
//   wipes at tier ten         81% / 80% / 80%                85% / 80% / 84%
//   score, median         20,636 / 19,769 / 20,293       19,930 / 22,423 / 18,880
//   nodes cleared, median      81 / 78 / 76                   83 / 81 / 81
//   deepest sector, by third  3.54/3.18/3.06 ...            3.00/3.30/3.12 ...
//   lost for good, per run  3.67 / 3.84 / 3.76             3.73 / 4.11 / 3.67
//   withdrawals, per run    7.99 / 8.06 / 8.07             7.99 / 8.47 / 8.49
//   promotions per run      10.9 / 10.7 / 10.7             11.2 / 11.5 / 10.9
//   signatures per run       9.1 / 9.3 / 9.1                 9.4 / 9.3 / 9.4
//   capstones taken         1.81 / 1.43 / 1.57             1.78 / 2.12 / 1.48
//   promotions that bought nothing   0.00 / 0.00 / 0.00    0.00 / 0.00 / 0.00
//
// NOTHING SEPARATES. Not one row clears the D17 bar - same direction across all three AND no
// overlap of ranges. Three rows come closest and none of them get there: nodes cleared (76-81
// against 81-83), promotions (10.7-10.9 against 10.9-11.5) and signatures (9.1-9.3 against
// 9.3-9.4) all nudge up with their ranges TOUCHING at a single value rather than separating,
// which is the shape of careers running a little longer and is not a result. Read it as: F06
// costs nothing and buys nothing on the dials this file measures, and tables from before this
// commit stay comparable to tables after it.
//
// The one row that had to come back zero did: with the screen re-rolled at the draw, the
// takePerkOffer belt never fires in play. It is a belt, and it is reported so that it stays
// one - a non-zero here means the screen and the decision have come apart again.
//
// The kill reconciliation is unchanged, still 1-2 bodies per arm against 22-26k (the F05
// floor), and 0 page errors on all six.
// ── F07: what a clock that belongs to its fall is worth ─────────────────────────────────
// The only row the audit named for this phase was "lost for good", and it is the only row that
// moved. Matched pair, 3 x 150 an arm, this file byte-identical on both sides.
//
//                              pre-F07                        post-F07
//   lost for good, per run  3.89 / 3.75 / 3.80             2.85 / 3.11 / 2.96
//   runs that ended the road   4 / 5 / 4 of 150               2 / 2 / 4 of 150
//   wipes per run           7.29 / 7.15 / 6.95             7.01 / 7.17 / 7.08
//   wipes at tier ten         83% / 84% / 80%                85% / 83% / 84%
//   score, median         20,329 / 21,496 / 18,754       20,698 / 19,740 / 21,295
//   nodes cleared, median      77 / 78 / 72                   81 / 78 / 80
//   withdrawals, per run    8.23 / 7.61 / 6.99             8.23 / 8.07 / 7.81
//   regroups spent          6.31 / 6.19 / 5.98             6.03 / 6.18 / 6.11
//
// Lost for good clears the D17 bar outright: same direction in all three samples and complete
// separation, 3.75-3.89 against 2.85-3.11. About 0.79 fewer operators buried a run, a fifth of
// them. That is the size of the population that was dying on a stale clock - anybody picked up
// once and knocked down again, which at tier ten is most of a squad - and it is the number the
// phase existed to move.
//
// NOTHING ELSE SEPARATES. Wipes, the tier-ten share, score, withdrawals and regroups all
// overlap; nodes cleared touches at 78 without separating. Which is the right shape for this
// phase: fewer operators are lost for good, and the road is no easier to walk. Read the
// "ended the road" row as noise rather than as a cost - it is 2-5 careers out of 150 either
// way, it overlaps, and it points the wrong way for a fix that only ever saves lives.
// ── F08: what a recruit node costs now that it costs something ──────────────────────────
// Matched pair, 3 x 150 an arm, this file byte-identical on both sides.
//
//                              pre-F08                        post-F08
//   promotions per run     11.3 / 11.5 / 11.0             18.7 / 19.5 / 18.6
//   signatures per run       9.5 / 9.7 / 9.6               11.3 / 11.6 / 11.3
//   nodes cleared, median      78 / 86 / 79                   71 / 80 / 73
//   deepest sector, by third  3.20/3.36/2.94 ...            3.22/3.26/3.56 ...
//   runs that ended the road   5 / 2 / 3 of 150               4 / 1 / 1 of 150
//   wipes per run           7.04 / 7.17 / 7.19             7.01 / 7.22 / 6.99
//   score, median         20,767 / 20,751 / 19,518       20,281 / 20,472 / 19,501
//   lost for good, per run  3.27 / 2.95 / 3.41             3.05 / 3.11 / 3.04
//   recruit offers seen       528 / 509 / 536                554 / 517 / 462
//   signed on the spot        232 / 214 / 211                211 / 220 / 199
//
// TWO ROWS CLEAR THE D17 BAR, and they are the same row twice. Promotions go 11.0-11.5 to
// 18.6-19.5 and signatures 9.5-9.7 to 11.3-11.6, both with complete separation. The arithmetic
// says what it is rather than leaving it to be guessed: a recruit signed at par 9 gains eight
// levels, and this file signs about one a run, so +7.6 screens is the eight points that used
// to bank themselves in silence now being offered. The signature row is the half that matters:
// those points are not new, they were always on the operator - what changed is that they are
// now spent on the class the recruit was signed FOR, rather than sitting behind an Outpost
// menu that threw from E08b until F06 opened it.
//
// NODES CLEARED FALLS AND DOES NOT SEPARATE. The medians drop 81.0 to 74.7 as a mean, which is
// the right direction and about the right size - a run walks two or three recruit camps and
// each now costs the tier it always should have - but 71/80/73 against 78/86/79 overlaps, so
// by this file's own rule it is a direction and not a result. Said plainly rather than rounded
// into one.
//
// NO DIFFICULTY DIAL MOVES. Wipes, runs that ended the road, score, lost for good and depth by
// thirds all overlap. Two effects point opposite ways and roughly cancel: the squad is stronger
// by two signatures a run, and the road is about six nodes shorter.
//
// One second-order row worth naming so nobody reads it as a defect: offers seen goes UP while
// signings go DOWN. Advancing the tier at a recruit node means a run reaches the sector
// boundary in fewer NODES, so it crosses more sectors and is dealt more maps - each with its
// 0.55 roll for a camp - while banking fewer fight payouts per sector. More camps, thinner
// purse: the median purse on hand falls 240 to 207 and affordable offers 333/528 to 306/554.
// ── F09: seven banners made honest, and what that moved ─────────────────────────────────
// Matched pair, 3 x 150 an arm, this file byte-identical on both sides.
//
//                              pre-F09                        post-F09
//   runs that ended the road   0 / 3 / 1 of 150               3 / 2 / 1 of 150
//   wipes per run           7.29 / 7.19 / 7.18             6.90 / 6.97 / 7.27
//   wipes at tier ten         84% / 81% / 81%                82% / 82% / 79%
//   score, median         21,219 / 19,822 / 19,654       16,506 / 19,978 / 21,947
//   nodes cleared, median      83 / 78 / 79                   71 / 76 / 78
//   lost for good, per run  3.04 / 3.44 / 3.15             3.27 / 3.26 / 3.19
//   deepest sector, by third  3.38/3.06/3.32 ...            2.94/3.04/3.22 ...
//   turns per fight, median  29.1 / 30.7 / 30.2             31.7 / 30.9 / 29.4
//
// NOTHING SEPARATES, which is what the phase predicted. Wipes, the tier-ten share, the win
// rate, lost for good, depth and turns per fight all overlap. Nodes cleared is the only row
// with a consistent direction and it only touches - 71-78 against 78-83 - so it is a direction
// and not a result; it also points the OPPOSITE way to three of the seven fixes, which are
// player buffs and would lengthen a run rather than shorten it. Read it as spread: post-1 is
// the low sample on every row at once (71 nodes, 16.5k score, 2.94 depth), which is one career
// set being unlucky rather than seven fixes agreeing.
//
// ONE LIMIT ON THIS MEASUREMENT, STATED PLAINLY. The audit's named risk was HEADSHOT becoming
// a real execute, and this pair has weak power over exactly that. Overdrives are 285 firings
// in 150 careers - 0.2% of all moves - and HEADSHOT is one class's share of that, so perhaps
// thirty to sixty firings an arm. A buff that rare cannot separate a wipes mean, and "no dial
// moved" here is not the same claim as "HEADSHOT is balanced". What pins HEADSHOT is suite
// 117, which drives the resolver directly: an armoured, resistant non-commander dies outright,
// a commander does not, and the kill lands on the ledger rather than around it.
// ── F10: three arms, and a pass that pays nothing ───────────────────────────────────────
// The phase asked for a HOLD action buying "a small, honest return, a guard tick or five
// momentum". Both returns were tried, both were rejected, and the second took three arms to
// settle - so the investigation is written down here rather than the conclusion alone.
//
// Five momentum went on inspection. A plain swing that does not kill grants NO momentum in
// this game - the bar fills off kills, combos and blows taken - so a pass paying five would be
// the cheapest overdrive charge available and worth pressing on purpose, which is the risk the
// phase names against itself.
//
// The guard tick went on measurement. Runs that ended the road, 150 an expedition set:
//
//   HOLD absent, turn consumed        4,4,4,3,2,6   23/900   2.56%
//   HOLD present, grants nothing          3,2,3      8/450   1.78%
//   HOLD present, grants the guard    1,1,2,1,1,1    7/900   0.78%
//
// Read the first two together: they are the SAME behaviour. The pre arm has no HOLD branch at
// all, so its pass already grants nothing, and the isolation arm is HEAD with those two lines
// removed. Identical code, and they differ by 0.78 points - which is this row's noise floor at
// 150 and the most useful number in the table. Pooled as one arm they are 31/1350, 2.30%,
// against 0.78% with the guard. The guard is the only thing that separates and removing it
// puts the row back on the baseline.
//
// THE MECHANISM IS NOT UNDERSTOOD, and no story is offered for it here. Free armour on a squad
// lowering its own win rate has none, and every other dial moved the player's way at the same
// time - score 20.1-22.0k against 19.3-21.4k, nodes cleared 74-81 against 71-78, operators
// lost 2.90-3.17 against 2.79-3.25. What is established is narrow: those two lines cost runs,
// they are not needed for the thing the phase is for, and a pass that quietly costs the run is
// worse than a pass that pays nothing. Filed as a finding. A fix would need the mechanism.
//
// TWO METHOD NOTES, because both cost time here and both generalise.
//
// This row cannot be read at three samples. It is a tail count with a mean near three, and the
// pre and isolation arms above are identical code reading 3.83 and 2.67. Every phase this
// session has quoted "runs that ended the road" at 3 x 150; nothing has been claimed on it
// alone, and nothing should be. Six an arm resolved this one, and only because the effect was
// large.
//
// And the order of operations was wrong. Two mechanisms were proposed and both were wrong - a
// flat armour set stripping a bigger guard (a real defect, fixed, but not the cause) and the
// armour expiry zeroing permanent armour (players have no permanent armour, so nothing to
// zero). Isolating the variable settled in one arm what two rounds of reasoning did not. Build
// the third arm first.
//
// The other half of F10 is not measured here and does not need to be: which three of four a
// rank III operator brings is a control that did not exist on two of the three screens that
// edit a roster. Suite 118 drives all three.
//
// G01: A PAIRED MEASUREMENT WITH NO POWER, AND WHY THAT IS THE FINDING.
//
// G01 fixes the Ossuary's COUNT YOURS, which re-counted the squad's dead on every firing. That
// is a balance change on a commander, so a paired 3 x 150 was started against a frozen pre-G01
// tree. The first arm settled it before the second began:
//
//   runs that ended the road   0 of 150 (0%)
//
// The Ossuary is the final boss, COUNT YOURS is its learned move and nothing else in the game
// carries that signature, and LEARNED_AT means it only brings it from the third meeting. Zero
// runs reach it, so the branch never executes here and no number this file prints can move.
// The remaining five arms were stopped rather than run: an hour of machine time cannot buy
// power over a code path the sample never enters.
//
// The same 150 runs reached 1102 commander fights, 1031 of them carrying a grudge, at 26% won.
// So the harness reads the road's seven warlords in enormous depth and has never once seen the
// eighth. That is why an eight-reader audit and fifteen phases went past a defect that let a
// single casualty cap the last boss's tally, and it is a gap in the instrument rather than a
// footnote about this phase: the fight the whole game is pointed at is the one fight nothing
// measures. Filed separately.
//
// What replaces the sim here is arithmetic, which is exact and needs no sample. Suite 124 pins
// the new arm and the mutants pin the old one, both at the resolver:
//
//                                  before          after
//   one loss, one firing           2 marks         1 mark      (body AND ledger were added)
//   two losses, four firings       2, 4, 6, 8      2, 2, 2, 2
//   armour at that tally           +32 (20 -> 52)  +8 (20 -> 28)
//   damage at that tally           x1.59           x1.12
//   what LAST TALLY spends         0.96 of a swing 0.24
//
// G03: A PAIRED MEASUREMENT THAT NEEDED THE RIGHT ARM, NOT A BIGGER ONE.
//
// G03 stops a walked-out relic arming every run for the rest of a Vault-less career. The
// default arm is blind to it for a plain reason: `--extract off` is the default, nothing ever
// walks out, and the flag the defect lives on is only ever written by an extraction.
//
// `--extract 3` puts the path under the sample - 40 to 55 of every 100 runs walk out - and the
// same arm never buys THE VAULT. That was checked rather than assumed, over a 60-run career
// with an instrumented copy: skull income with runs ending around sector 3 does not reach the
// Vault's price often enough to matter, so the sample is a Vault-less extracting career, which
// is precisely the state the leak lived in. Both readings mattered - the first guess was that
// the sim would buy the Vault immediately and mask the whole thing.
//
// Paired 3 x 100, --extract 3, frozen pre-G03 tree against the fix. One row separates:
//
//                                pre-G03              G03
//   operators lost for good      2.51 / 2.27 / 2.62   2.93 / 2.84 / 2.92   per run
//
// Complete separation, same direction three times: 2.27-2.62 against 2.84-2.93. That is the
// free relic's whole worth - about four tenths of an operator a run - and it prices the leak
// rather than reporting a regression, because the pre arm IS the leak.
//
// Touched and not separated, recorded so nobody re-reads them as findings: walked out
// (48/40/46 against 55/44/55), nodes cleared median (67/63/65 against 67/64/73), median score
// of a walk-out (26.2k/24.5k/25.5k against 28.2k/24.7k/24.3k), deepest sector by third. Runs
// that ended the road sat at 1-3 per 100 in both arms and cannot be read here at all, for the
// reason the F10 note above gives.
//
// G04: A ROW THAT SEPARATED, AND WAS THE INSTRUMENT ALL ALONG.
//
// G04 sends finishQuietNode out through afterNode, so an event, a camp, a shop or a recruit
// door settles what has come due instead of leaving it for the next fight. A paired 3 x 150
// separated on one row, in the direction that would mean the fix had broken something:
//
//   consequences resolved, mean   0.75 / 0.77 / 0.79   ->   0.70 / 0.67 / 0.59
//
// Nothing had broken. settleDue() counted its own loop iterations, and the engine was now
// settling those consequences before settleDue ever ran - the resolutions did not stop, they
// moved to the other side of the fence. This file calls bankNode rather than collectLoot at a
// fight's exit precisely so it can drive resolveConsequence itself, which is why the counter
// was honest before and stopped being honest the moment a second call site appeared.
//
// Counted off pendingConsequences now, so a resolution lands in the number whoever drove it.
// Re-run with the repaired counter in BOTH arms, paired 3 x 150:
//
//   consequences resolved, mean   0.87 / 0.75 / 0.85   ->   0.68 / 0.79 / 0.89
//   of what was booked            96% / 93% / 96%      ->   94% / 94% / 93%
//
// Overlapping, direction inconsistent, no separation - and the second row says plainly that
// nothing is being lost on either side. Nothing else moved either: score, nodes, operators lost
// and runs that ended the road were all flat across the first pass.
//
// The general shape, because it will happen again: a readout that counts a policy's own actions
// measures the policy, not the game. When a phase moves work from the harness into the engine,
// every counter that lives in the harness has to be checked before its output is read as a
// finding. This one would have read as "the fix loses a fifth of all consequences".
//
// G05: WHAT "COMPLETE SEPARATION AT THREE" IS ACTUALLY WORTH ON THIS ROW.
//
// G05 sizes RIOT PLATE after the elite affixes instead of before, so an ARMORED unit's plate is
// half the bar it fights on rather than a third. Plated units are about 2% of the hostiles on
// an elite node and none at all in sector 1, so the change touches a thin slice and makes it
// harder. A paired 3 x 150 came back with one row separating - by this file's own D17 rule,
// same direction three times and no overlap:
//
//   nodes cleared, median   75 / 73 / 70   ->   77 / 77 / 80
//
// In the wrong direction, and far too large: ten more nodes cleared from a 2% subset of one
// node type being given a bigger damage-halving budget is not a mechanism, it is a coincidence.
// Three more pairs, same arms, same configuration:
//
//   pre    75  73  70  83  75  74
//   post   77  77  80  77  74  71
//
// Overlapping, and the direction reverses in the second three. Means 75.0 against 76.0. The
// separation at three was noise.
//
// This is worth keeping as a calibration rather than a footnote. D17's rule - same direction
// AND complete separation - is necessary, not sufficient, and "nodes cleared, median" is heavy
// enough in the tail to clear that bar by chance at three samples of 150. When a row separates
// on a change whose mechanism cannot plausibly produce it, the mechanism is the better witness:
// double the samples before writing it down. F10 recorded the same lesson from the other side,
// where "noise" was argued for six samples before the effect turned out to be real. Both
// mistakes have now been made here; the rule that survives them is that the size of the
// mechanism and the size of the effect have to agree before either is believed.
//
// H02: A FEATURE REFUTED BY ITS OWN FEASIBILITY MEASUREMENT, TWICE.
//
// The Reckoning was to be a commander at capped grudge fought with its late-fight behaviour from
// the bell - harder without being a stat wall, because GRUDGE.cap says in as many words that "a
// wall you cannot pass is not a nemesis". `--reckoning` exists to price that before building it.
//
// FIRST ARM, AND IT MEASURED THE OPPOSITE OF WHAT IT LOOKED LIKE. It called openGrudgePhase at
// the bell. The phase ladder is 1 -> 2 (the ordinary enrage, half health) -> 3 (the grudge phase,
// a quarter), each rung gated on the one below - so setting phase 3 made `phase === 1` false and
// the ordinary enrage never fired at all. The commander lost its damage scale and speed bonus and
// gained a gear with nothing to spend:
//
//   wipes per run   normal 4.22 / 4.25 / 4.28   reckoning 4.08 / 4.16 / 4.04
//
// Complete separation, the wrong way round. The win rate was a null and would have been easy to
// explain away; what caught it was a row separating in a direction the mechanism could not
// produce, which is the rule G05 was written to leave behind.
//
// SECOND ARM, CORRECTED, AND THE ANSWER DID NOT CHANGE. openEnragePhase was lifted out of the
// turn loop so the enrage could be opened at the bell without touching the ladder, leaving the
// grudge phase to fire at a quarter health exactly as before. One rung up rather than past it:
//
//                        normal              reckoning
//   commander win rate   16% / 16% / 16%     17% / 21% / 20%     (~330 fights an arm)
//   bosses felled, mean  0.62 / 0.61 / 0.59  0.66 / 0.79 / 0.72
//
// Same direction three times and complete separation on both rows. A commander that opens
// enraged is EASIER, and the mechanism now agrees with the number rather than contradicting it.
//
// WHY, AND IT IS THE USEFUL PART. Both of a commander's late gears are CASH-OUTS OF ACCUMULATED
// FIGHT STATE rather than gears. spendTally converts a tally the fight built - at the bell it is
// zero, so it sheds nothing and multiplies nothing. raiseFelled has nothing to raise before
// anybody has fallen. reEscort only fires if the column is down, and at the bell it is up.
// backbreaker picks the most broken operator, so at full health it lands on a healthy one instead
// of a dying one. The persistent buffs do apply, so the commander is a little stronger on paper
// and has spent its whole situational payload on an empty board.
//
// SO THE PREMISE IS WRONG, not the tuning. A commander's escalation is not a set of gears that
// could be pre-engaged; it is a set of responses to damage already done, and it cannot be
// front-loaded by construction. Filed as refuted rather than deferred - a third design on the
// same premise would measure the same thing a third time.
//
// What survives is worth keeping. openEnragePhase is now a function the caller guards, the same
// shape openGrudgePhase already had, where before there was one of each - and `--reckoning`
// stays as the arm that priced it, because the next person to have this idea should be able to
// re-run it in one command rather than rediscover it in two days.
//
// AND IT BEARS ON THE NEXT ITEM. H04 wants to move danger down the sector away from tier ten.
// This says commander difficulty cannot simply be relocated: most of what makes a commander
// dangerous is built during its own fight and does not travel.

// H03: THE SHELF IS FULLY SPENT, AND WHAT IT SELLS CANNOT MOVE DEPTH.
//
// F04 built the requisition shelf on the reading that skulls piled up unspent - 1,136 / 1,160 /
// 1,117 left over across three samples of 150 with every Citadel spot bought. The feature brief
// then proposed a shelf for the surplus. BOTH READINGS WERE WRONG, and correcting them is most
// of this entry.
//
// THE LEDGER, CORRECTED. Skulls are spent BEFORE a run (the shelf) and DURING it (the Citadel),
// so the net rise across an expedition understates income by exactly what was spent. Sampling
// the rise reported 366% of income spent, which is what prompted deriving it instead:
// earned = (end - start) + spent. Over 150 carried runs:
//
//   earned 1,220   Citadel 95 (8%)   shelf 1,086 (89%)   left on hand 39 (3%)
//
// The Citadel is not a sink at all past the early career: every building reads at cap by the end
// of a 150-run sample. The shelf takes essentially the whole income, and depth reads
// 3.24 / 3.22 / 3.28 across the thirds. A SHELF AT 89% UTILISATION THAT DOES NOT MOVE DEPTH IS
// NOT UNDERUSED - IT IS SELLING THE WRONG THING. That is a different problem from the one F04
// solved, and the surplus the brief proposed to absorb does not exist.
//
// WHAT IT WAS SELLING. FRESH FACES is variance, A GRUDGE CALLED IN is difficulty asked for, A
// RUNG ON CREDIT is harder content on tick. Three items, none of which makes the squad stronger.
// So: add one that plainly is capability and price the question properly. ONE MORE FALLBACK, 6
// skulls, +1 regroup for one expedition.
//
// THE ARM IS `--reqpolicy`, AND IT HOLDS THE SHELF CONSTANT. Comparing builds would confound the
// item with everything else in the diff. Both arms run one build and differ only in the order the
// purse is spent: `rerolls` (the default, and what every prior sample ran) buys fresh faces to the
// cap; `fallback` buys the fallback first and takes what rerolls the remainder affords. At 8.1
// skulls a run that is a real substitution - roughly two rerolls traded for one fallback - which
// is the actual design question rather than "does more stuff help".
//
//                          rerolls                      fallback
//   depth, 1st third   3.24 / 3.40 / 3.56           3.84 / 2.78 / 3.54      overlap
//   depth, 2nd third   3.22 / 2.98 / 3.02           3.32 / 3.44 / 3.28      separated
//   depth, 3rd third   3.28 / 3.02 / 3.06           3.40 / 3.44 / 3.18      overlap
//   reached sector 7      3% / 5% / 3%                 9% / 3% / 4%         overlap
//   runs won              1 / 2 / 2                    3 / 3 / 2            overlap
//   wipes per run      7.25 / 7.07 / 7.07           8.07 / 7.62 / 7.84      separated
//   fallbacks carried  4.83 / 4.85 / 4.81           5.57 / 5.35 / 5.54      separated
//   bought the item          -                     110 / 95 / 105 of 150
//
// DEPTH IS A NULL. One third of three separates; D17 asks for complete separation and one row in
// three is not it. What does separate is the pair that proves the INSTRUMENT rather than the
// claim - the item is reachable, it arrives, and runs absorb ~8% more wipes before ending. The
// squad spends the extra fallback and dies in the same place.
//
// WHY, FROM THE ROW THAT WAS ALREADY THERE. Wipes by tier, control arm:
//
//   t2:2  t3:13  t4:14  t5:12  t6:22  t7:44  t8:54  t9:60  t10:866
//
// 80% of every wipe is the tier-ten commander. A fallback buys another attempt at that wall with
// the same squad at the same strength, so it converts into another wipe rather than another
// sector - which is exactly what the wipes row shows.
//
// AND THE ONE THAT NEARLY GOT AWAY. The first fallback sample read sector 7 at 9% against 3%, and
// that single separated row was nearly enough to call the feature a win before the other arms
// landed. It did not survive: 9% / 3% / 4% against 3% / 5% / 3%. A doubling of the win-through
// rate was never something one extra retry out of five could produce, and G05's rule - the size
// of the mechanism and the size of the effect have to agree before either is believed - was the
// better witness than the row. Third time that rule has fired in this batch.
//
// SO THE ITEM SHIPS AND THE PREMISE DOES NOT. ONE MORE FALLBACK is a correct, reachable, refundable
// choice and it is the shelf's first capability item, but it is neutral on depth and it should not
// be described as a balance change. THE FINDING IS ABOUT WHAT TO SELL NEXT: capability that buys
// ATTEMPTS cannot move depth, because an attempt does not change the fight. Capability that buys
// STRENGTH is the untested half, and it is the one the next item on this shelf should be.
//
// A NOTE ON WHAT THIS SAMPLE CANNOT READ. Reaching sector 7 happens 5 to 13 times in 150 runs and
// wins happen 1 to 3 times. Neither resolves at 3x150 - the same limit F10 recorded for runs that
// ended the road. Any future claim about either needs more arms, not a closer reading of these.

// G02: THE LAST FIGHT, MEASURED FOR THE FIRST TIME - AND THE CHECK THAT EARNED IT.
//
// `--stage N` is above. The thing to be careful about with a staged arm is that the person
// building it chooses what the squad carries, so a generous profile makes the fight look
// winnable and the number means nothing. The profile here was measured rather than chosen, and
// then the staging was made to predict something it had not been fitted to.
//
// THE CHECK. The organic run says that of the 26 runs in 150 that reached sector 5, six went on
// to reach sector 7 - 23%. That figure was not used to build anything. A staged-at-5 arm, 150
// runs, has to reproduce it:
//
//   reached sector 7, organic, conditional on reaching 5     6 of 26    23%
//   reached sector 7, staged at 5                           39 of 150   26%
//
// Close enough to stand on, and the sample that failed to separate is the one being trusted, so
// the risk runs the safe way: a staging that flattered the squad would have overshot here.
//
// One row does NOT match and is recorded rather than smoothed. Staged-at-5 has a median deepest
// sector of 6, so more than half reach sector 6, against 10 of 26 organic - 38%. The likely
// reason is the divergence already known: staging does not simulate the attrition of getting to
// sector 5, so a staged squad arrives with a roster of 7 where a real one has 6. A deeper bench
// helps early in a sector and stops helping at the wall, which is the shape of a discrepancy
// that shows at sector 6 and closes by sector 7. Not chased further, because the row the phase
// rests on is the one that matched.
//
// THE MEASUREMENT, 100 runs staged at sector 7. Every figure below is CONDITIONAL ON ARRIVING
// and none of it is a win rate. How often a career reaches sector 7 at all is what an unstaged
// run measures, and that is about 4% - the two must never be quoted as one number.
//
//   runs that reached the last warlord    90 of 100
//   meetings with it                     170, 24 won (14%)
//   runs that felled it                   24 of 90 (27%)
//   runs that ended the road              24 of 100
//   grudge on it when met                 0 to 3
//   wipes per run                         2.28   (one sector, not seven)
//   score, median                        31,174
//
// So the last fight is winnable by a squad that arrives in the shape the road leaves one in:
// about one arrival in four walks out of it. Read the 27% as an upper bound - the staged bench
// is a body deeper than a real one - but not as an artefact, because the arm that produced it
// predicted the sector-5 handoff it was not built from.
//
// AND THE MOVE NOTHING HAD EVER SEEN. COUNT YOURS was faced 165 times across the sample. G01
// fixed it from source, having established that 0 of 150 runs reach the commander that carries
// it; this is the first time anything in this repo has watched it fire. It is gated on grudge
// rather than depth - learnedMove wants LEARNED_AT stacks and a stack is earned by FELLING the
// commander - so a ten-run pilot saw it 14 times and only after two wins had banked the grudge.
// The readout prints the grudge range beside the count for that reason: "not yet, the grudge
// never reached the gate" and "absent with the grudge high enough" are different facts, and the
// second one would be a finding.

// G13: WHETHER THE 0-1% WIN RATE IS THE GAME OR THIS FILE'S OWN PLAY.
//
// Three levers were built here and documented and never once run against the win rate:
// `--tactics smart` reads threatBoard and forecastFor instead of buying STIM every time,
// `--draft doctrine` fields a line that keeps a free multiplier, `--bench scout` takes the job
// the muster hands out for nothing. Each is a thing a player does without thinking about it.
// Relics were deliberately LEFT at `rare`: `avoid` refuses every curse, and the curses are
// meant to be worth taking, so putting it in the arm would have smuggled a balance opinion
// into a policy meant to hold only obvious play.
//
// The first attempt measured nothing, because `--draft doctrine` was fielding nobody on a fifth
// of its runs - see the commit for G13 and suite 134. What follows is the paired 3 x 150 after
// that was fixed, interleaved A/E/A/E/A/E so machine drift falls on both arms, and every one of
// the six arms confirmed clean of the empty-line failure before it was read.
//
//                            default              smart + doctrine + scout
//   runs that ended the road   3 / 1 / 3            7 / 2 / 5      of 150
//   reached sector 7           6 / 10 / 5          19 / 7 / 14
//   deepest sector, median     3 / 3 / 3            3 / 3 / 4
//   nodes cleared, median     80 / 76 / 72         80 / 71 / 77
//   score, median           22.1k / 20.2k / 20.0k  24.5k / 20.8k / 25.2k
//   wipes per run           7.17 / 7.18 / 6.90     7.23 / 7.18 / 7.51
//
// NOTHING SEPARATES UNDER D17. Not one row manages same-direction-three-times AND no overlap.
// Score comes closest and still overlaps by 1.3k. `reached sector 7` reverses direction in the
// second pair, which is the more sensitive form of the same signal as the win rate and is the
// reason the win rate's own three-for-three is not worth anything here - F10 already recorded
// that this row cannot be read at three samples of 150, having watched two identical arms read
// 3.83 and 2.67.
//
// BUT THE BOUND IS THE ANSWER, and it does not need the row to separate. Pooled over 450 runs
// an arm: the road is finished 7 times against 14, and sector 7 is reached 21 times against 40.
// About a doubling on both, with Poisson intervals that overlap and a per-pair direction that
// does not hold - so a doubling is the shape of it, not a result. What IS established is the
// ORDER: three levers a player pulls without thinking move this from roughly 1.5% to roughly
// 3%. They do not move it to 15%. A win rate that would make the end of the road something a
// player meets is not sitting in this policy's unpressed buttons.
//
// So the answer to the question the phase asked is: mostly the game. The road runs seven
// sectors, the median run abandons it at three, 81% of wipes are at tier ten, and playing it
// better in every way this file knows how still finishes it about three times in a hundred.
// Whether that is wrong is a design decision - it is the item this file has been calling "what
// the capstone win rate should be" - but it is no longer a question about the instrument. Two
// further things a real player does are still unmeasured and worth naming rather than
// forgetting: no policy here banks a capstone to take later, and none re-drafts its line
// between expeditions as the roster changes.

// G06: A NULL, MEASURED ON THE ARM WHERE THE THING ACTUALLY HAPPENS.
//
// G06 stops Scavenger's Debt being dodged by arriving at a warlord broke. Under the default
// policy the relic is held in 3% of runs at 1.88 warlords each - about nine collections across
// 150 runs, which no aggregate row can resolve. `--relics curse` takes every cursed card
// offered and puts it in 38% of runs at 2.10 warlords: roughly 120 collections, which can.
// Both figures were measured before the arm was chosen rather than after.
//
// Paired 3 x 150, --relics curse, frozen pre-G06 tree. Nothing separates under D17:
//
//   score, median            20.4k / 20.2k / 20.9k   ->   20.5k / 21.4k / 19.5k
//   nodes cleared, median    75 / 73 / 77            ->   81 / 75 / 75
//   operators lost for good  3.34 / 2.99 / 3.42      ->   3.05 / 3.66 / 3.00
//
// The exposure control says the arms are comparable: the relic was held in 35/37/41% of runs
// against 40/39/41%, so both sides met the collector about as often.
//
// Two rows lean the way the mechanism does, and neither is claimable. `bosses felled, mean`
// runs 2.15 / 2.17 / 2.26 against 2.09 / 2.15 / 2.05 - same direction three times, but the
// ranges touch at 2.15, so it misses complete separation by nothing at all. `runs that ended
// the road` is 4/3/3 against 1/2/2, which does separate, and is exactly the row the F10 note
// above says cannot be read at three samples of 150. They are recorded because they point the
// expected way - a curse that can no longer be sidestepped costs a little depth - and not
// because either is established.
//
// Not chased further, and the asymmetry is the reason: in G05 a row separated that would have
// been written down as a finding, so the extra samples bought a correction. Here nothing
// separates, so more samples would only sharpen a number the phase does not rest on - G06 is a
// correctness fix to a curse that was 98% avoidable, not a difficulty tuning.
const path = require('path');
const { serve } = require('./server');

let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { ({ chromium } = require('playwright-core')); }

const ROOT = path.join(__dirname, '..');

// ── H04: WHAT THE WALK IS WORTH ───────────────────────────────────────────────────
// The brief read "80% of wipes at tier ten" and concluded the nine tiers below were attrition
// without jeopardy - a long walk to one dice roll - and proposed putting danger down there.
// Measured against the fight rather than against where the loss is recorded, that is backwards.
// The walk is what decides the dice roll.
//
// Three samples of 60 carried runs, arrival state paired with the outcome:
//
//   arrived under 40%      22-42 fights      0% felled
//   arrived 40-60%         11-14 fights      0% felled
//   arrived 60-80%         11-12 fights    0-8% felled
//   arrived over 80%     392-455 fights   32-34% felled
//
// SECTOR IS THE OBVIOUS CONFOUND and it does not explain it. A deeper sector means a longer
// road, a harder commander, more levels and more relics at once, so depth could produce this
// table with the road doing nothing. Split inside each sector separately, the gap held in every
// one: s1 0% vs 64%, s2 0% vs 21%, s3 0% vs 19%, s4 0% vs 38%, s5 0% vs 27%, s7 0% vs 38%.
// In the first sample the losing squads were also HIGHER level (7.8 vs 7.2) and carrying MORE
// relics (6.2 vs 5.5), which is depth's signature rather than weakness - and both gaps closed to
// nothing at the larger sample (7.7/7.9, 7.4/7.3) while the health gap stayed. Health is the
// discriminator; the level and relic readings were noise that happened to point somewhere.
//
// NOR IS IT THE ROBOT DECLINING THE FIGHT, which is the reading the buckets would otherwise be
// making: `won` folds a fight that was fought and lost together with one this policy walked away
// from. Recorded by kind, no commander fight in any sample ended in a retreat - hurt arrivals
// went lost 54 of 54 in one and lost 44 / won 1 in another.
//
// THE CAUSE IS THE PURSE, NOT THE FIGHT. This file's own policy heals every operator to full
// after every node it can pay for, so a squad that walks in hurt is one that could not pay:
//
//   scrap in hand on arrival          24 hurt, 450 fresh
//   what topping up would have cost  127 hurt,   3 fresh
//   hurt arrivals that could not pay   51 of 54
//
// So the run is decided on the road, by whether the squad can afford to arrive whole, and the
// game reported it at the top of the sector as though the commander had done it. Adding danger
// to tiers 6-9 would make an already-decisive stretch more decisive - the opposite of the fix.
// What shipped instead is the read the map never offered (marchRead): the weather was forecast
// and the ground was named, both facts about the enemy, and the one number that predicts the
// ending was the one nobody was shown. It changes no number in any fight, which is the point,
// and it is why no paired arm accompanies it - there is nothing here for an arm to separate.
//
// WHAT THIS SAMPLE STILL CANNOT READ: the 60-80% band is 11-12 fights an arm and swings 0-8%,
// so where exactly the cliff sits inside it is not settled here. MARCH_FRESH is set at 0.8
// because that is where the samples separate cleanly, not because 0.79 was measured and rejected.

// ── H05: THE ONE BUTTON IS THE RIGHT BUTTON ───────────────────────────────
// The brief reads "going down happens 23.7 times a run and is answered by one button - STIM is
// 72% of every rescue the game has" and proposes more ways to pick somebody up. Two measurements
// say no, and the first is about this file rather than about the game.
//
// THE SPLIT WAS THE ORDERING. This file spends the momentum bar in the tactic block and only
// consults the bag and the medic's hands afterwards, so the STIM tactic has always had first
// refusal on every rescue here - the same shape as D05 and D06, both re-scoped when a finding
// turned out to be this policy reporting itself. `--rescue hands` gives the bag and the deck
// first refusal and changes nothing else. Three samples of 100 each way:
//
//                        bar (default)          hands
//   by the STIM tactic   87% / 86% / 87%    65% / 65% / 61%
//   by the bag            7% /  8% /  7%    16% / 16% / 18%
//   by the medic's hands  6% /  6% /  6%    20% / 19% / 21%
//
// Complete separation on all three rows. So 87% is not what the game offers, it is what this
// policy reaches for first. What the game offers is unchanged between the arms, because it is
// sampled at the top of the turn before the bar is spent: the bar reaches 71-75% of down-turns,
// a deck move 16-20%, the bag 13-21%.
//
// AND REACHING FOR THE ALTERNATIVES FIRST IS WORSE PLAY. Depth by third:
//
//   first third    3.21 / 3.24 / 3.42      2.85 / 2.70 / 2.67
//   second third   3.52 / 3.55 / 3.58      2.88 / 3.24 / 3.18
//   third third    3.35 / 3.21 / 3.06      3.38 / 3.24 / 3.21
//
// Complete separation in the first two thirds, half a sector, bar-first deeper. The mechanism
// agrees with the size: the bar is the RENEWABLE tool. Spending it first keeps the bag full and
// the medic shooting; reaching for the bag first burns ~3 extra MED_STIM a run - the same item
// H04 showed is what lets a squad arrive at a commander able to fight it - and spends the
// medic's turns healing instead of firing.
//
// The `hands` arm also shows FEWER downs (21.3-22.4 against 22.9-24.4), which reads like better
// rescuing and is not: shallower runs are fewer fights are fewer downs. That difference is
// downstream of the depth gap, not upstream of it.
//
// So the one button is the correct answer to a resource question, and the other routes are
// correctly held in reserve rather than neglected. A fourth route would be ignored if it were
// worse and would have to beat the bar if it were not, which is a difficulty cut wearing a
// feature's clothes. Nothing shipped to the game.
//
// WHAT REMAINS TRUE AND IS WORTH KNOWING: of the four things that reach a downed operator, two
// are items and two - CAUTERIZE and STIM_DART - both belong to the MEDIC, and STIM_DART needs a
// rank-III medic who also had it picked among the three deployed. One class of ten can reach the
// floor from the deck at all, and if the medic is the one lying on it, that half is gone. The
// depth arms say this is not currently costing anything, so it is recorded rather than fixed.
//
// AND THE STAKES ARE SMALLER THAN THE BRIEF IMPLIES: of 23.1 downs a run, 21.5 are dragged clear
// at the fight's end and 3.13 are lost for good. A rescue mostly buys tempo, not a life, so any
// future change here should be judged on whether it moves the 3.13.
//
// I07 SPLIT THAT PAIR. `dragged clear at a fight's end` is a bug figure - it moved ×1.26 when
// the harness stopped benching the best body, because a worse line goes down more. `lost for
// good` HELD across both arms. So the 21.5 wants re-reading and the 3.13 - the number this note
// asks future work to move - stands as written.

// ── H06: THE ROAD IS A CORRIDOR, AND ONE NODE DOES NOT WIDEN IT ───────────────────
// The one premise in this batch that survived measurement intact. Three samples of 100:
//
//   routing decisions faced                       7728 / 7664 / 7893
//     where every option was a fight               62% / 64% / 62%
//     with something other than a fight on offer   38% / 36% / 38%
//     and a non-fight actually taken               25% / 24% / 25%
//
// Nearly two thirds of the time the player has no choice but a fight, and this file is not
// routing past the alternatives - it takes ~65% of the non-fight chances it gets. Node kinds on
// offer: CAMP 10%, EVENT 9-10%, RECRUIT 3%, SHOP 2-3%, everything else somebody to kill.
//
// THE CACHE is one node against that, and the one the brief listed that is solved with the
// roster rather than the action bar. Balance-checked before shipping, because ~2.2 caches a run
// at ~157 scrap is new income and H04 established scrap is what decides whether a squad arrives
// at a commander able to fight it:
//
//                     no cache                 6 locks                 10 locks
//   depth 1st    3.24 / 3.06 / 3.15     3.30 / 2.88 / 3.06     2.97 / 3.27 / 2.85
//   depth 2nd    3.15 / 3.21 / 3.73     3.55 / 3.12 / 2.91     3.00 / 2.94 / 3.42
//   depth 3rd    3.29 / 2.85 / 3.32     3.00 / 3.29 / 3.12     3.53 / 3.26 / 2.88
//   sector 7        4% / 5% / 5%           3% / 4% / 1%           3% / 4% / 3%
//   wipes        6.85 / 6.74 / 7.02     6.85 / 6.83 / 6.77     6.86 / 6.84 / 6.75
//
// Overlapping everywhere; sector-7 arrivals if anything slightly down. The node pays without
// paying for depth, which is what a piece of content rather than a difficulty lever looks like.
//
// AND THE HONEST LIMIT: it does NOT widen the road. "Where every option was a fight" reads
// 63/59/58% against a 62/64/62% baseline - overlapping. 2.2 caches a run is 2.2 more non-fight
// nodes, and the FRACTION of forks with a choice in them does not move, because a run is far
// more nodes than that. The brief listed four node types; this is one, and one is not enough to
// change the shape of the road. That is a measured argument for the other three rather than a
// reason to call the corridor fixed.
//
// TWO THINGS THIS PHASE GOT WRONG FIRST. A 15-run smoke read the clean rate at 9% and nearly
// bought a design change on 22 observations; at 100 runs it is 21-32%. And the first six locks
// covered three starting classes plus the three recruit-only ones, leaving MEDIC and SHOTGUNNER
// - deployed in 93% and 91% of runs - as keys to nothing. Ten locks, one per class, fixed the
// coverage; it did NOT raise the clean rate, because more locks is also more locks to miss.

// ── H08: THE ROAD BOOKS ITS OWN ───────────────────────────────────────────────────
// Filed as "one booked consequence per run, five kinds, and almost all of it comes from choosing
// an option on an event card". Half of that was the harness and half was true.
//
// THE RATE WAS --faces warm. The policy takes the standing-raising option and the choices that
// book a fuse are mostly the greedy ones, so the ceiling and the take came apart:
//
//   event choices offered, total                    1785 / 1672 / 1811
//     of them, ones that book a consequence          17% / 18% / 17%
//     events where a consequence was on the table  42% / 45% / 41%
//     bookings declined by this policy               188 / 163 / 173 per 100 runs
//
// ~2.7 a run available against ~0.9 taken. The rate was never evidence about the game.
//
// THE SOURCE CLAIM WAS TRUE, and needed no sample: every bookConsequence call site sat inside an
// event card - 15 of them, 10 in EVENT_POOL and 5 in FOLLOWUPS. The system resolves correctly at
// every node type (F08, G04) and had exactly one thing feeding it.
//
// SHIPPED: a forced cache books an AMBUSH at 35%. The text was written for it long before H06
// made a cache to write it for - "Whoever left that cache was waiting for whoever took it."
//
//                     before (H06)            with the fuse
//   depth 1st    2.97 / 3.27 / 2.85     3.27 / 3.48 / 3.61
//   depth 2nd    3.00 / 2.94 / 3.42     3.00 / 3.58 / 3.45
//   depth 3rd    3.53 / 3.26 / 2.88     3.32 / 3.09 / 3.53
//   wipes        6.86 / 6.84 / 6.75     6.91 / 7.14 / 7.06     <- separated, +0.2
//   booked/run             ~0.9         1.32 / 1.57 / 1.42
//   by source        EVENT 100%         EVENT 59-70%, CACHE 30-41%
//
// Depth unmoved, wipes up and separated. That is NOT a regression to tune away, and the
// difference from H06 is the point: H06 added INCOME, so neutrality was the test. This adds a
// COST, and a consequence that costs nothing does nothing. The test that matters is whether runs
// end sooner, and they do not - the extra wipes are absorbed by fallbacks.
//
// BUILT, MEASURED AND CUT: signing a recruit booking a SURVIVOR. Three reasons in the order that
// decided it. SURVIVOR carries cast: 'KESS' and calls noteCast('KESS', 1), so booking it from a
// generic signing has Kess repay the squad for something she had nothing to do with - a content
// bug no balance reading excuses. It fired on every signing, ~1.5 a run, which would have made
// one new source half of every booking in the game. And its measured value was inflated by this
// file's own policy: the harness heals to full at every node it can pay for, so a full-squad
// heal mostly refunded what the squad had already bought - which is why three SURVIVORs a run
// could not outweigh one AMBUSH. A human player heals worse than that, so the same source would
// be worth more to them than it measured here.
//
// DROPPED ON INSPECTION, BEFORE BUILDING: withdrawing booking a PURSUIT (already implemented, and
// better - withdraw() sets pursuit and the chasers arrive in the next fight), and emptying a shop
// booking a DEBT (DEBT is Vela collecting on money you did not earn; clearing a shop means you
// paid). The brief proposed four sources; one survived contact with what the consequences do.

// ── H09: AN ORDER YOU CAN CHANGE YOUR MIND ABOUT ──────────────────────────────────
// Filed on "kept 3 of 150, 2%". That measured THE LONG ROAD alone, under a policy that always
// signs it. Measured across all three at 100 runs each, the keep rate is a ladder:
//
//   SORTIE  3 sectors  +20%   kept 34-35%
//   PATROL  5 sectors  +35%   kept 12%
//   LONG    7 sectors  +50%   kept 0-2%
//
// A CLAIM MADE AND WITHDRAWN, recorded because the withdrawal is the useful part. On one sample
// per order the medians read 21,265 / 19,648 / 17,666, and this phase was begun on the reading
// that every step up the ladder LOWERS the expected score - that the menu was a trap and a player
// who worked it out would sign SORTIE forever. At three samples THE LONG ROAD reads
// 19,845 / 20,929 / 20,558 against SORTIE's 19,829 / 21,265: completely overlapping, and the
// 17,666 that anchored the claim was the low of four. The inversion is NOT established. This
// file's own header says 150+ expeditions before believing a score figure; one of a hundred was
// believed instead, in the same phase that spent its opening paragraphs correcting the brief for
// exactly that. The keep-rate ladder replicates and is enough on its own.
//
// SHIPPED: the order can be re-signed at any camp. Trading DOWN forfeits RESIGN_CUT of the
// shorter order's bonus, because otherwise cutting at the last camp before a wipe is free value
// and the trap simply inverts. Trading UP is free - the risk of not getting there is the price.
// An order is only signable while its recall is still ahead: the recall fires on an exact sector
// match, so signing a three-sector order at sector four is signing for a recall that never comes.
//
//                   --resign off            --resign on
//   kept          0% / 2% / 1%           8% / 12% / 13%     separated
//   wipes    6.78 / 6.97 / 6.89     6.26 / 6.44 / 6.65      separated, DOWN
//   score  19,845 / 20,929 / 20,558  17,312 / 20,414 / 21,435   overlapping
//   depth        overlapping             overlapping
//   re-signed         0%              71-76% of runs, 53-63 of them to SORTIE
//
// The longest order produced an outcome about once in fifty runs and now does so about once in
// nine, without paying more for it - score and depth are unmoved and wipes FALL, because a run
// that would have been pushed into a wipe is recalled instead. Most re-signings still lapse
// (7-11 kept of 71-76), so it is not free value either.
//
// The control held by construction: SORTIE with --resign on re-signed 0 of 100, because nothing
// is shorter than three sectors and the policy only cuts down.

// ── H11: FORMATIONS THAT BELONG TO SOMEBODY — ALREADY DO ──────────────────────────
// Filed as "Thirteen shapes, and 56% of fights are an unshaped draw... Tie the shape to who is
// fighting." Both halves are answered by the code as it stands.
//
// SHAPES ARE ALREADY FACTION-TIED. FORMATIONS is keyed by faction - five tables, seventeen
// shapes - and rollFormation(faction, tier) only draws from that faction's own. There is no
// shared pool to split and no signature to add.
//
// AND THE 56% IS A DIAL. Driven through the engine over 300,000 modelled fights: a shape was
// open on 87% of them, and FORMATION_CHANCE (0.55) declines the rest by design. So the unshaped
// share is ~45 points of deliberate coin and ~13 of nothing-open-yet. Measured in play at 60
// runs: 1,227 of 2,764 named, 44% - exactly what the item was filed on and what the dial says.
//
// WHAT IS REAL, AND NARROWER THAN THE MODEL SUGGESTED. As a share of their own faction's PLAYED
// fights, two shapes sit near 3% - ROADBLOCK (RAIDERS) 3.5% and CONVOY (MECH) 3.1% - against
// 17-32% for the openers. A first model with uniform faction weights called five shapes starved;
// play says two. The model was worth running and not worth shipping.
//
// AND THEY CANNOT BE RETIMED. Twelve of the seventeen sit at exactly the tier their heaviest
// unit unlocks at, ROADBLOCK and CONVOY among them, so dropping a gate one tier is refused by
// validateFormations - suite 144 proves that by doing it. This is not D14's defect: RISING_FLIGHT
// sat at gate 9 against a unit floor of 5 and had four tiers to give back. These have none. They
// are rare because they field deep units and runs end at sector 3, which is the tier-ten wall
// again rather than anything about formations.
//
// TWO LENSES, AND THEY DISAGREE BY 2-3x. Suite 86 (D14) walks sectors 1-7 UNIFORMLY, which is
// right for "is this faction's table internally crowded" and wrong for "does a player meet this
// shape": a uniform walk visits sectors 4-7 about thirty times more often than play does.
// Measured side by side, uniform overstates every deep shape - ROADBLOCK 2.1x, PRESS_GANG 2.1x,
// BLOOM 1.9x, CONVOY 3.3x, THE_RITE 3.2x, THE_NEST 2.2x. That reconciles D14's note that THE_NEST
// "measured fine on its own (13.3%)" with the ~5% a player meets: both are true of different
// questions. Suite 86 now says which lens it is using, suite 144 holds the distinction, and the
// readout below prints the played share so the question needs no re-deriving.
//
// A BUG THIS PHASE INTRODUCED AND CAUGHT. The faction-fight counter was first inserted BETWEEN
// `if (currentFormation)` and its `else stat.loose++`, capturing the else: loose fights stopped
// being counted and the named rate read 79% against a true 44%. Invisible to node --check, and
// caught only because the new per-faction shares summed to ~50% while the old readout said 79%
// and two counters in one file disagreeing was worth chasing rather than explaining away.

// ── H10: THE RECRUIT WALKED PAST — THE PRICE IS THE WHOLE BARRIER ─────────────────
// Filed as "offers seen 473, affordable at the time 277, signed on the spot 192, reached and
// walked past 281 (59%)" and concluded: "a player walks past nearly six offers in ten WHILE
// CARRYING ENOUGH TO SIGN. The price is not the barrier - the offer is not compelling."
//
// The item's own numbers say otherwise. 473 offers against 277 affordable means 196 could not be
// paid for at all, and 192 of the 277 affordable ones were signed - 69%. The 59% is a sum of
// three different things and the sentence attributes all of it to the third.
//
// Split properly, at 100 runs:
//
//   offers seen in total                        337
//     could not pay at all                      147 (44%)
//     could pay but not keep the reserve         67 (20%)   <- this file's own +80 rule
//     could pay and keep it                     123 (36%)
//     signed as a share of what was affordable  123 of 190 (65%)
//     and as a share of what the reserve allowed 123 of 123 (100%)
//
// THE POLICY SIGNS EVERY OFFER IT CAN AFFORD. 123 of 123. It has never once walked past a
// recruit on merit, because the rule is `scrap >= cost + 80` and nothing else - there is no
// judgement about the card in this file to measure. So "the offer is not compelling" is not a
// finding this instrument is capable of producing, in either direction.
//
// Median price 180 against a median purse of 198: recruits are priced right at the margin, and
// H04 established that scrap is what decides whether a squad reaches a commander able to fight.
// Signing is a direct trade against arriving healthy, which is a real tension and arguably the
// point.
//
// WHAT WOULD BE NEEDED TO ASK THE ITEM'S QUESTION. A policy that VALUES a recruit - weighs the
// class, the rank, what the line is missing - and therefore sometimes declines one it can afford.
// Until that exists, every walk-past this file reports is an empty purse or an accounting rule,
// and no card rewritten in the game would move the number by a single offer. Building that
// policy is the prerequisite for the feature, not a refinement of it.
//
// Nothing shipped to the game. The split above is the deliverable, so the next attempt starts
// from the decomposition rather than the sum.

// ── H13: THE WALL, MOVED TO WHERE THE ROAD ACTUALLY ENDS ──────────────────────────
// ── EVERY WIN-RATE, DEPTH AND SCORE FIGURE ABOVE THIS LINE PRE-DATES H13 ──────────
// The owner asked for a difficult game that is winnable, "maybe like a 25% win rate", against
// the 1-3% of careers this file had been reporting. SECTOR_HP_SCALE and SECTOR_DMG_SCALE moved
// from 1.25/1.28 to 1.06/1.08 and the Ossuary from 1.5/0.95 to 2.2/1.15. Figures printed before
// this are not wrong, but they describe a road nobody could walk to the end of, and none of them
// are comparable with anything measured after it.
//
// WHAT THE SEARCH FOUND. Damage alone cannot reach a quarter. At 100 runs a point with health
// held at 1.25: dmg 1.28 -> 1% of careers won, 1.22 -> 1%, 1.16 -> 4%, 1.10 -> 7%, 1.05 -> 10%.
// Even at 1.05 the bottleneck is REACHING the last sector (17% of runs) rather than winning once
// there (59% of arrivals). Health was the lever - dmg 1.10 against health 1.25 -> 11%, 1.16 ->
// 15%, 1.08 -> 23% - which is also the reading the game's own comment predicts: enemy health is
// supposed to track player damage growth so a fight stays ~10 rounds, and at 1.25 it compounded
// to ~10.6x against roughly 4x.
//
// AND EVERY PAIR THAT REACHED A QUARTER BY FLATTENING ALONE MADE THE ENDING A FORMALITY: 86% of
// the squads that arrived walked through the Ossuary. That is the brief's complaint about tiers
// 6-9 moved to the last fight. So the two were split - flatten the road until the ending is
// reachable, raise the ending until it is the wall - and measured as a pair thereafter.
//
// 150-expedition careers, Ossuary at 2.2/1.15 throughout:
//
//                        careers won                mean    reach   of arrivals
//   dmg 1.10 / hp 1.08   18%                         18%     29%       61%
//   dmg 1.09 / hp 1.07   17 / 27 / 21%               22%     28%       76%
//   dmg 1.08 / hp 1.06   30 / 29 / 25 / 19%          26%     34%       78%   <- shipped
//   dmg 1.06 / hp 1.04   33%                         33%     39%       85%
//
// A SAMPLE IS ONE CARRIED CAREER, NOT 150 INDEPENDENT TRIALS. metaPolicy defaults to carried, so
// the 150 expeditions in a sample share a Citadel, a skull purse and an escalating set of
// grudges: a career that opens well buys more and wins more, and the samples above are drawn
// from the career distribution rather than a binomial one. 1.08/1.06 read 30/29/25/19 on four
// samples of the same build. Three samples is the floor for a win-rate claim here and the mean
// is the only figure worth quoting - a single 150 resolves it to about plus or minus five points,
// which is wide enough to swallow the whole gap between two adjacent rows above.
//
// TWO CONSTRAINTS FIXED THE PAIR, and both came from suites rather than from this file.
// 10-progression-depth asserts lethality outpaces bulk - a run should end because the squad died,
// not because the fight became an unwinnable slog - so any pair with hp above dmg was out, which
// ruled out the 1.05/1.10 that first hit 26%. The same suite asserts enemy health stays within
// reach of a squad growing 1.21x a sector; at hp 1.04 it reads 3.91 against a 3.5 ceiling, so
// 1.06 is the flattest health the design allows. The shipped pair sits on that floor.
//
// WHAT THIS DID NOT DO. The wipe rate barely moved (6.4 -> 5.8-6.2 a career): runs still end in
// a wipe, they just end later. Income was left at 1.4 a sector.
//
// AND ONE CLAIM HERE WAS WRONG, corrected by H14 below rather than quietly edited out: this
// paragraph said the purse now outgrows the fight by ~32% a sector "and player power compounds
// much harder than it did", and called that the source of the reachability. It is not. Income
// and every Outpost price ride the same curve and cancel; upgrades bought per run does not move
// with the constant. The reachability came from the enemy curves this phase actually changed.

// ── H14: WHAT THE INCOME CONSTANT IS FOR ──────────────────────────────────────────
// sectorRewardMult() returns 1.4^(sector-1) and had never been swept. Two notes in game.js and
// the H13 record above all said the same thing about it - the purse outgrows the fight, which is
// what lets player power compound - and all three were wrong in the same way. The constant is on
// BOTH sides of the ledger: four income sources ride it, and so does every price the Outpost and
// the Armory quote. An upgrade costs the same in cleared nodes at sector 7 as at sector 1.
//
// Careers won, three careers of 150 an arm, everything else at the H13 build:
//
//   income          1.0              1.4              1.7
//   careers won     19 / 17 / 22%    29 / 25 / 29%    33 / 39 / 23%
//   mean            19.3%            27.7%            31.7%
//   reached s7      27 / 25 / 31%    33 / 32 / 35%    37 / 41 / 28%
//   upgrades/run    51.4/55.0/55.9   49.1/52.6/52.3   51.4/51.3/47.0
//
// Dropping below 1.4 separates completely - 17-22% against 25-29% - and costs about eight
// points. Raising above it does not separate at all: 1.7 spans 23-39% and swallows 1.4's whole
// range. The purse meanwhile grows 5.7x in nominal terms across that sweep and buys the same
// fifty upgrades. So 1.4 sits at saturation and stays there; the game is already at the quarter
// the owner asked for, and there is nothing to buy by moving it.
//
// WHICH MEANS IT LANDS SOMEWHERE ELSE, and finding out where took two instruments and refuted
// the first guess. Three price curves live in this economy - the multiplicative one above, a
// linear one, and a flat set that never moves - and only the two that are NOT sectorRewardMult
// can feel it. 145-three-prices pins them apart and this file now measures both.
//
//   the flat set     the scar clinic at 120, the collector at 500, and ten choices in the events
//                    and the faces totalling 1,690. A sector-one price costs 2.3 cleared nodes
//                    at the door and 0.3 at the end of the road, which is E09's own complaint in
//                    a subsystem E09 never reached - and it is NOT the lever. Measured with the
//                    new counter above: 69-78% affordable at every income level tested, no
//                    separation anywhere, and only ~7% of the choices a card offers.
//
//   the recruit      recruitCost() is 90 + 6 a tier, linear in depth, reaching 504 by sector 7
//                    against income that compounds past it. Two careers of 100 an arm:
//
//                      income         1.0        1.4        1.7
//                      affordable     43 / 43%   71 / 70%   79 / 69%
//                      signed         19 / 21%   53 / 51%   63 / 54%
//
//                    Complete separation from 1.0 to 1.4 on both rows, and saturation above it -
//                    the same shape the win rate has. H10 had already found recruits priced
//                    right at the margin, median 180 against a median purse of 198. A squad that
//                    cannot replace its dead cannot finish a road, and this constant is what
//                    decides whether it can.
//
// A NOTE ON THE FIRST GUESS, kept because it is the useful part. The flat set was the obvious
// mechanism - it is visibly E09's defect, it is easy to enumerate, and the counter for it was
// written first. It moved 69 -> 79% while the win rate moved 19 -> 32%, on 7% of the choices,
// which is far too small a lever for the swing. Attributing the number to it would have been
// H10's mistake exactly: a mechanism that sounded right, measured on the wrong arm. The recruit
// counter is what settled it, and both counters stay - the flat one earned its place by ruling
// its own hypothesis out.
//
// WHAT IS LEFT. Putting the flat set on outpostPrice is still a legible-design item - a choice
// that costs a third of a node is not a decision - but it is not a balance one, and this file
// now says so with numbers rather than by inference.

// ── I01: THE SECOND CHANCE NOBODY COULD BUY ───────────────────────────────────────
// Retreating is the other way out of a losing fight: withdrawing pays in blood and leaves the
// node behind, retreating pays in scrap, keeps the node, and can fail. H14 had just established
// that a price on a curve OTHER than sectorRewardMult is the only kind that can change what a
// player is able to do, and there are exactly two of those. One had been measured and retuned.
// This was the other.
//
// Measured on the shipped build - three careers of 150, counting every moment a squad was losing
// and the engine would have let it break away but for the money:
//
//   affordable when it was on the table   167/591   145/534   156/621   = 28 / 27 / 25%
//   median price asked                    300       300       300
//   median purse at that moment           150       159       158
//   worst at                              sectors 2 and 3, 18-23%, which is most of the sample
//
// The price was twice the money, three times in four. RECRUIT_COST records the same failure and
// its own retune out of it - 110 + 22 a tier gave a median ask of 506 against a purse of 324,
// five of sixty-nine offers affordable, nobody ever signed - and retreat had never had that
// treatment. Swept the same way and shipped at perDepth 6, the recruit's own slope: 56 / 60 /
// 62% affordable, median ask 183 against a purse of 176 / 194 / 201.
//
// I07 CHECKED THIS ROW AGAINST THE I05 FIX AND IT SURVIVES. Both of its terms moved - the
// door was offered ×1.42 more often under the bug and was affordable ×1.32 more often - so the
// SHARE they make barely moves: 62% on the fixed harness against 58% on the buggy one, inside
// the 56-62% quoted above. The counts here are the bug's; the finding is not.
//
// THE COUNTER IS THE POINT, and it is easy to get wrong. canRetreat() ends in
// `scrap >= retreatCost()`, so asking it directly counts only the moments the money was already
// there and reports 100% affordable every time - which is H10's sum-of-three-things exactly. It
// lifts the purse, asks the engine, and puts the purse back, so every OTHER clause is read from
// the engine rather than copied here: the commander gate, a live squad, no pending action. F03
// found nine hand copies in this file at once and this is deliberately not the tenth.
//
// NOTHING HERE TAKES THE RETREAT, and that is why the price could be changed on a measurement
// this file could still make. No figure it reports can respond to retreatCost, because the
// button has never been pressed - the `open` counts across the arms (591/534/621 before,
// 611/566/562 after) are the same band, which is the check on that claim rather than a hope.
//
// WHY THERE IS NO TAKING POLICY YET, recorded so the next attempt does not rediscover it.
// retreat() can fail, and its failure path calls nextTurn(), which calls processTurn(), which
// runs applyTurnStartEffects on the next actor and schedules an executeEnemyAi through
// setTimeout. This file's fight loop is a deliberate re-implementation of that walk - see F03 -
// so a failed break would tick one actor's cooldowns and statuses twice and hand the engine a
// deferred turn the loop never drove. processTurn cannot be stubbed around it either: retreat()
// reaches the module-local binding, not the one the harness mirrors onto window. A taking arm
// therefore needs this loop to hand the turn walk back to the engine, which is a much larger
// change than a policy flag and is its own item. Until then the shipped question - "is the door
// open?" - is answered, and "does walking through it change anything?" is not.

// ── I02: THE TURN EVERY FIGHT WAS OPENING TWICE ───────────────────────────────────
// ── BOUNTY FIGURES ABOVE THIS LINE ARE UNDERSTATED BY ABOUT A TENTH ───────────────
// Filed after I01 as "hand the fight loop's turn walk back to the engine", on the assumption
// that the loop's re-implementation was broadly unsafe. The audit says otherwise and the item
// shrank to one line. processTurn() has exactly three callers - nextTurn(), resumeCombat() and
// the last statement of initiateCombat() - and nextTurn() has exactly two: processTurn's own
// skip past a downed actor, and retreat()'s failure path. This loop touches neither, so nothing
// here was ever at risk from the walk in general.
//
// What it WAS at risk from is the third one. initiateCombat ends in processTurn(), so a fight
// does not open with nobody's turn - it opens with the first actor's turn already open: their
// turn-start effects applied, and the turn counted in fightLog if they are a player. This loop
// then did both again on its first pass.
//
// Measured over 210 fights across seven depths and three factions: 49 of them (23%) open on a
// player - the Scavenger 46 times, the Medic 3, the two fastest operators - and in every one of
// those 49 the lead's cooldown had already stepped 3 -> 2 and fightLog.turns already read 1
// before this loop ran a single pass. One fight in four handed the fastest operator a free
// cooldown step and read a turn longer than it was.
//
// PAIRED, three careers of 150 an arm, the same build either side:
//
//                      doubled                fixed
//   bounties a run     7.37 / 8.07 / 8.07     8.20 / 9.06 / 8.56     separated, +10%
//   careers won        46 / 47 / 37           46 / 41 / 34           overlapping
//   wipes a run        5.76 / 5.71 / 5.77     5.61 / 6.23 / 6.16     overlapping
//   score, median      29.6k / 32.8k / 27.0k  28.0k / 38.1k / 32.2k  overlapping
//
// Bounties is the row the mechanism predicts and the only row that separates - completely, max
// 8.07 against min 8.20. fightLog.turns feeds exactly one consumer, `f.turns < BLITZ_TURNS`,
// and BLITZ wants a fight finished quickly, so an inflated count was refusing it. Every other
// row moves in the direction the free cooldown step would predict and none of them separate, so
// there is no claim there: win rate, depth and score figures printed before this remain
// comparable, and bounty figures do not.
//
// THE SETTIMEOUT IS INERT, checked rather than assumed. processTurn hands an opening hostile to
// setTimeout, and this file has been leaving one of those behind at every fight. EXPEDITION is a
// non-async arrow and every await in this file is in the Node-side driver outside it, so an
// expedition runs to completion inside one synchronous page.evaluate and no timer can fire while
// a fight is live. They fire after it returns, when combatActive is false, and executeEnemyAi
// returns on its first line. Nothing was changed for it; 147 asserts the opening hostile has not
// swung, which is the assertion that would catch it if that ever stopped being true.
//
// AND THE RETREAT PATH STANDS AS I01 LEFT IT. retreat()'s failure calls nextTurn(), so a taking
// policy would still double-tick - that one really does need the loop to give the walk back, and
// it is still the reason there is no --retreat arm. What this item found is that the general
// refactor is not needed for anything else.

// ── I03 AND I04 ARE RETRACTED BY I05 BELOW. READ THAT FIRST. ─────────────────────
// Both were measured through a fielding bug in this file that made signing a recruit cost the
// squad its best body. Their measurements are real and their reasoning holds for the harness
// they ran on; their CONCLUSIONS about the game do not.
//
// ── I03: THE RECRUIT YOU WALK PAST, ASKED PROPERLY ────────────────────────────────
// H10 filed it and could not answer it: this file signed 123 of 123 offers it could afford,
// because the rule was `scrap >= cost + 80` and nothing else, so "the offer is not compelling"
// was not a finding the instrument could produce in either direction. It said what was needed -
// a policy that weighs the card and therefore sometimes declines one it can pay for - and called
// that the prerequisite for the feature rather than a refinement of it. This is that policy.
//
// FIRST, WHETHER TASTE WOULD HAVE ANYWHERE TO GO. If a squad nearly always has a hole, taste
// signs everything anyway and the arm is a null by construction, which is how H05, H07 and H10
// each dissolved. Measured before the policy was written: 96% of offers arrive at a line that is
// already full, and the card out-hits the worst hand on the field 14% of the time. There was
// room.
//
// --recruit value rates a card as dmgBase + maxHp/4 and signs on one of two grounds: a hole in
// the line, or beating the worst hand already on it. Otherwise it declines, affordable or not.
// The rating is a stated policy and not a truth - the point is that a policy with ANY taste can
// say no. It also UNDERSTATES a recruit, because a signature banks a perk point for every level
// to squad par and no stat comparison sees those. `price` is still the default, so every figure
// this file has printed stays comparable.
//
// PAIRED, three careers of 150 an arm:
//
//                        price                  value
//   careers won          34 / 42 / 39           49 / 39 / 56        overlapping
//   squad wipes a run    6.13 / 5.73 / 6.02     5.04 / 5.39 / 4.69  SEPARATED
//   score, median        26.9k / 29.6k / 29.6k  30.7k / 27.8k / 35.0k  overlapping
//   reached sector 7     26 / 37 / 29%          37 / 29 / 39%       overlapping
//   signed of affordable 269/380, 278/375, 263/351   29/399, 35/352, 36/353
//                        71%                    9%
//
// WIPES SEPARATE COMPLETELY - 5.73-6.13 against 4.69-5.39, about 15% fewer - and they are the
// only row that does. I03 called these "wiped careers" and I04 corrects it: stat.wipes counts
// SQUAD WIPES PER EXPEDITION, and a run continues past one while a regroup is left, so this is
// how often the squad goes down in a fight rather than how often a career ends. The measurement,
// the direction and the separation are untouched; only the label was wrong. The win rate moves hard the same way, 25.6% to 32% on the
// mean, and does NOT separate: value's 39 sits inside price's 34-42. So the claim is the wipe
// rate, and the win rate is a direction, not a result.
//
// WHICH ANSWERS H10 AND CORRECTS THE READING OF H14. H14 found recruit signings co-moving with
// the win rate across the income sweep and named recruits the lever the income constant lands
// on. The co-movement is real; the causation is not this way round. Decoupled here - same money,
// different taste - signing MORE is worse. Money was moving both, and buying fewer recruits with
// it is better than buying more.
//
// WHY, NOT MEASURED, so it is named as candidates rather than a conclusion: a recruit arrives at
// 60% of their bar carrying none of the stat upgrades the squad has bought (148 asserts exactly
// that), and the ~200 scrap not spent goes to an Outpost H14 showed is where power actually
// compounds. Which of those two does the work is a separate item; this file cannot tell them
// apart as it stands.
//
// ONE THING THE BATTERY CAUGHT, kept because it is the same mistake in miniature. 148 first
// asserted a recruit arrives without the squad's upgrades by checking their damage still equalled
// the card's. Signing rolls a random quirk that moves dmgBase, so that assertion was true only
// when the quirk happened to be damage-neutral: it passed two batteries and failed the third. It
// counts upgradeCount now, which is what buyUpgrade actually increments and what the claim was
// always about. A stat read through a random modifier is not the stat.
//
// WHAT THIS DOES NOT SETTLE. One taste is not all tastes: a rating that valued the banked perk
// points, or the reach a line is missing, might sign more and do better still. And the default
// is deliberately left at `price` rather than switched to the better player - the value rating is
// this item's invention, only one row separated, and moving the default would re-baseline every
// figure in this file on one item's evidence. Sharpening the rating and then deciding the default
// is the follow-up, and it should be decided on the wipe rate, which is the row that answered.

// ── I04: WHICH HALF OF DECLINING IS DOING THE WORK ────────────────────────────────
// I03 found a policy with taste beats a greedy one and could not say why. Two channels were
// confounded in it: a recruit arrives at 60% of their bar carrying none of the squad's bought
// upgrades, AND the ~200 scrap not spent stays in a purse H14 showed the Outpost is the best use
// of. `--recruit burn` separates them - it declines exactly what `value` declines and then takes
// the money anyway, only where `price` would have signed, so the counterfactual is exact.
//
// Squad wipes a run, three careers of 150 an arm (price has a fourth from this item):
//
//   price   5.73 / 6.02 / 6.13 / 6.53
//   burn    5.14 / 5.25 / 5.29          separated from price, overlaps value
//   value   4.69 / 5.04 / 5.39
//
// BURN SEPARATES COMPLETELY FROM PRICE and sits inside value. Taking the money away does not
// give the wipe rate back, so the body is the drag and the price is not. That the subtraction
// actually bites is checked rather than assumed: removing it lifts upgrades bought a run from
// 39.8 to 43.1 on a matched pair, which is the purse the arm is supposed to be emptying.
//
// SO THE OBVIOUS FIX WAS TRIED AND DOES NOT HOLD UP. A recruit is levelled to squad par by
// design - "a fresh recruit six sectors deep would be a body, not a hand" - but the upgrades
// bought on top of those levels are not matched. Granting the roster's mean upgradeCount at
// signing, measured at three careers of 150 on the price arm:
//
//                  careers won            squad wipes a run
//   price          32 / 34 / 39 / 42      5.73 / 6.02 / 6.13 / 6.53
//   with parity    47 / 49 / 39           5.99 / 5.81 / 5.92
//
// Wins run 30% against 24.5% on the means and DO NOT SEPARATE - parity's 39 sits inside price's
// 32-42 - and the wipe rate does not move at all. Two samples looked like a clear win and the
// third took it away, which is the whole reason three is the floor here. Nothing shipped to the
// game: a directional read on one arm is not a licence to buff a class, and it would push the
// win rate past the quarter the owner asked H13 to hit.
//
// AND THE SAME MISTAKE AGAIN, in the same suite, caught by the same batteries. I03 recorded that
// 148 had asserted a recruit's damage still equalled the card's, which a random quirk breaks. It
// was fixed there - and the health assertion one line above it had exactly the same exposure and
// was left alone. signOnRecruit takes RECRUIT_HEALTH off maxHp and only THEN rolls the quirk that
// moves maxHp, so "hp is the share of maxHp" is false whenever the quirk is not health-neutral;
// it failed a battery on 43/62. It reads the share off the CARD's bar now, with the clamp the
// engine applies. Fixing one instance of a class of bug is not fixing the class, and the note in
// I03 should have sent me looking for the others.
//
// WHAT IS STILL UNEXPLAINED. Parity fixes the stats and changes neither row, so the drag is not
// the recruit being weak on paper. The next candidate is the one thing parity does not touch:
// RECRUIT_HEALTH puts them on the field at 60% of a bar, and this file fields them immediately.
// A body at 60% in a four-slot line may simply be a wipe waiting to happen whatever its numbers.
// That is one arm away - sign, but bench until healed - and it is the next thing to try.

// ── I05: THE SLOT THAT WAS A LABEL, AND WHAT IT COST TWO ITEMS ────────────────────
// ── EVERY WIN-RATE AND WIPE FIGURE ABOVE THIS LINE IS MEASURED THROUGH THE BUG ────
// I04 ended pointing at RECRUIT_HEALTH: a recruit walks in at 60% of their bar and this file
// fielded them at once, so perhaps a hurt body in a three-slot line is a wipe waiting to happen.
// The first thing to check was whether the GAME fields them, and it does not. All three recruit
// templates carry gridPos 0 and signOnRecruit never sets it: the engine puts a signature on the
// bench for the player to place. The immediate fielding was this file's, and so was the rest.
//
//   const sitting = playerRoster.find(c => c.gridPos === tpl.rank && c.id !== tpl.id);
//   if (me) { if (sitting) sitting.gridPos = 0; me.gridPos = tpl.rank; }
//
// tpl.rank IS THE LABEL PRINTED ON THE CARD. I04 established the engine deletes it on signing -
// it is "VETERAN RANK" on a shelf, not a position - and the pool happens to run rank 1, 2, 3 over
// three faces, so it landed on a real slot every time and never once looked wrong. The line is
// DEPLOYED = 3 and the roster opens with all three held, so there was never a free slot: EVERY
// signature threw a healthy, fully-levelled, fully-upgraded operator onto the bench to field a
// recruit at 60% of their bar carrying no upgrades at all. It also went round assignSlot, which
// is the engine's own door, so SHORT_HANDED's ban on slot 3 and checkDoctrine were both skipped -
// the tenth hand copy of the kind F03 catalogued nine of.
//
// THROUGH assignSlot NOW, and placed on merit: a free slot if the line has lost somebody,
// otherwise over the weakest hand if the recruit rates above it, otherwise the bench. Three
// careers of 150 an arm, everything else identical:
//
//                      careers won              squad wipes a run
//   price, as it was   32 / 34 / 39 / 42        5.73 / 6.02 / 6.13 / 6.53
//   price, fixed       51 / 52 / 55             4.99 / 5.14 / 5.21
//   value, fixed       41 / 58                  4.93 / 5.32
//
// BOTH ROWS SEPARATE COMPLETELY from the arm they replace. And price and value now OVERLAP on
// both, where I03 had them cleanly apart - so taste does not matter once a recruit is placed
// sensibly, and I03's finding was the bug the whole way down.
//
// WHAT THAT DOES TO I03 AND I04. I03 concluded "declining beats signing" and called H10's
// question answered. RETRACTED: declining beat signing because signing meant losing the best
// body on the line, and with that fixed the greedy policy is as good as the choosy one. I04
// concluded "the body is the drag, not the price", which is right about the mechanism and wrong
// about whose body - the drag was the operator being DISPLACED, not the recruit arriving. Its
// burn arm result stands and now explains itself: burn declined, so it never made the swap.
// I04's upgrade-parity null also stands, and for the same reason - parity made the arriving body
// better while the swap was still throwing a better one away.
//
// AND IT REACHES FURTHER THAN THIS FILE. H13 tuned SECTOR_HP_SCALE and SECTOR_DMG_SCALE to put
// the win rate near the quarter the owner asked for, and read ~26% off this harness. The same
// build reads 34-37% now. The wall was set through a lens that was quietly costing the squad its
// strongest operator at every recruit node, so the game is easier than what was asked for.
// Nothing has been re-tuned here: the target is the owner's to set, and re-cutting H13 on one
// item's evidence without being asked would be the same mistake in the other direction.
//
// The offer instrument's own "hole" reading was wrong too, in a way that had not bitten yet: it
// measured the line against boardSlots(), which is BOARD_SLOTS - the number of CONTRACTS on the
// bounty board. Both are 3, so every figure it printed was right by coincidence and would have
// drifted the first time a career bought the War Room, which adds one to the board and nothing to
// the line. It reads DEPLOYED now.

// ── I06: THE WALL, RE-CUT AGAINST A HARNESS THAT WORKS ────────────────────────────
// ── EVERY WIN-RATE FIGURE ABOVE THIS LINE PRE-DATES BOTH I05 AND THIS RE-CUT ──────
// H13 tuned SECTOR_HP_SCALE and SECTOR_DMG_SCALE to the ~25% the owner asked for and read 26%
// off a harness that was benching the squad's best operator at every recruit node. I05 fixed
// that; the same build then read 37% (51 / 52 / 55 / 62 of 150). The owner reset the target to
// 30% rather than inherit a number chosen against a bad reading, and this is the re-cut.
//
// Four careers of 150 an arm, fixed harness:
//   dmg 1.08 / hp 1.06   34 / 35 / 37 / 41%   mean 37%   (what H13 left)
//   dmg 1.10 / hp 1.08   29 / 32 / 32 / 35%   mean 32%   <- shipped
//
// THE RANGES OVERLAP BY ONE SAMPLE, so this does not meet the separation rule the rest of this
// file holds effects to, and that rule is the wrong tool here. D17 exists to establish that an
// effect is REAL. A steeper curve being harder is not in question; only where it lands is, and
// for a target the mean of four careers is the estimator. 32% against 30%, plus or minus about
// a point.
//
// THE OSSUARY IS NOT THE KNOB, which is worth recording because H13 assumed it was half the
// answer. Swept with the road held: 2.8/1.25 read 29 / 36 / 40% against 2.2/1.15's 34 / 35 / 37
// / 41 - no separation, no direction - and the share of arrivals that fell it moved only from
// 87-91% to 80-87%. Reach runs 33-47% while ofArr runs 80-96%, so a run is lost on the road and
// not at the door. Left at 2.2/1.15.
//
// AND A METHOD NOTE PAID FOR IN WASTED SAMPLES. The first pass at both sweeps ran ONE career a
// point and produced a table that ranked 3.4/1.35 as EASIER than 2.8/1.25 - a harder boss with a
// higher win rate, which cannot happen. Career spread at 150 is five to seven points, so a single
// sample cannot rank two points that differ by less than that, and every ordering in that first
// table was noise. Three careers minimum for a direction, four before quoting a mean; anything
// that wants to separate two nearby points needs more runs, not more points.

// ── I07: WHAT THE BENCHED-BEST BUG DID TO EVERY TABLE IN THIS FILE ────────────────
// ── EVERY ABILITY-USAGE FIGURE ABOVE THIS LINE IS MEASURED THROUGH THE BUG ────────
// I05 fixed one line of this harness and re-measured four rows. It invalidated far more than
// four: every number above it was read through a lens that threw the squad's best operator onto
// the bench at every recruit node, and no phase since has known which of its inherited figures
// still stand. This is that audit. The harness was varied ALONE - game.js untouched, I05's
// fielding block swapped back to `me.gridPos = tpl.rank` and then restored - three careers of
// 150 expeditions an arm, and every row this file prints diffed between the two.
//
// A row counts as MOVED only when the three fixed careers and the three buggy careers do not
// overlap at all, which is D17's rule applied per row. Of the rows carrying a number:
//
//     MOVED  76        HELD  175        no number to compare  8
//
// WHAT THAT DID AND DID NOT COVER, because a coverage claim is worth as much as its holes.
// The report prints 282 labelled rows; 274 are printed once and so mean one thing; 259 of those
// carry the same label in all six careers; 251 of THOSE carry a number. The 23 that fall out:
// eight print no number at all (`never used`, `never met`, `never dropped` and the like), and
// fifteen bury a varying count inside the label itself, so the label differs between careers
// and no pair can be formed - among them four low-count moves (FLARE_GUN, SNAP, SPRAY_GUN,
// QUICK_SHOT) and three follow-up threads. THE ABILITY TABLE BELOW IS THEREFORE 34 MOVES OF 38.
//
// Two more limits on the 251, and the second one is the sharp one. First: 16 of the 175 held
// rows are the SAME value in all six careers - `camp caches taken 0`, `thread: WHAT ORRIN
// WELDED 0`, `promotions that bought nothing 0` and a dozen like them - which held because they
// cannot move, not because the bug spared them.
//
// SECOND, AND IT COSTS A HEADLINE: the comparison reads the FIRST number a row prints, and 46
// of the 175 held rows are DISTRIBUTIONS. For many that is harmless - `score, median 28,611
// [90% ...]` and `orders re-signed mid-run 77 of 150` lead with the number that matters. For a
// row that leads with the largest of a dozen terms it is not, and `classes deployed` is the
// proof: its leading term is MEDIC, 138 against 142, which held - while its TAIL, the three
// classes this whole audit is about, moved as hard as anything in the file.
//
//   runs of 150 that fielded    fixed                  buggy
//     HARPOONER                 24 / 23 / 18           70 / 76 / 76
//     HAZMAT                    21 / 27 / 19           63 / 85 / 77
//     TRENCH_FIEND              21 / 20 / 27           56 / 82 / 74
//
// A recruit stood in the line in about 14% of careers with the fix and about 45% without it, and
// in two of the three buggy careers the recruits outranked SNIPER and HOUND. That is the whole
// mechanism in one table, and the row it lives in is filed under HELD. So: A HELD VERDICT ON A
// DISTRIBUTION ROW MEANS ITS LEADING TERM HELD, nothing more. 116 of the 175 held as plain
// scalars and are not constants - those are the 116 that held on real evidence. 43 more held
// only at the head, 13 are constants that could not have moved, and 3 are both.
//
// READ THAT SEPARATION HONESTLY BEFORE LEANING ON IT. Three against three separate by chance
// with probability 2·(3!·3!)/6! = 10%, so about 25 of 251 rows are expected to "move" with
// nothing behind them. What decides a row is therefore the SIZE of the gap, not the fact of one.
// The seventeen moved rows sitting inside ±10% - score on a won run ×1.04, risen ×3 ×1.03, relic
// offers seen ×0.91, gear equipped ×1.08 and the rest - are exactly where that noise lives and
// should be read as UNRESOLVED, not as moved. Everything quoted below is outside that band or is
// corroborated by a companion row that is: depth's own ×0.93 would be nothing on its own and is
// carried by sector 7 at ×0.81 and careers won at ×0.60 beside it; CAUTERIZE ×0.94 and
// SHIELD_SLAM ×0.90 likewise, by the nine starting-seven moves that fell harder than they did.
//
// SIGNATURES PER RUN HELD AT 4.5 IN BOTH ARMS. Nothing below is about signing more often. It is
// all about what a signature did once it landed.
//
// 1. THE ABILITY TABLES ARE THE WORST-HIT PART OF THIS FILE, and they split perfectly on the
// recruit line. Every one of the nine special moves belonging to TRENCH_FIEND, HAZMAT and
// HARPOONER fired MORE under the bug; every starting-seven move that moved at all fired LESS.
// Not one row crossed.
//
//   the three off the road   TANK_RUPTURE ×7.3   DRAG_LINE ×5.7   RIPSAW ×5.4  PURGE_VALVE ×5.4
//                            WHALE_LINE  ×5.1  OVER_THE_TOP ×4.9  TRENCH_SWEEP ×4.4
//                            CAUSTIC_BURST ×4.4  BARBED_SHOT ×3.8
//   the starting seven       FLASHBANG ×0.70  MOLOTOV ×0.70  DEADEYE ×0.75  PIERCING_VOLLEY ×0.75
//                            SHIV ×0.76  HEAT_WAVE ×0.79  ACID_FLASK ×0.80  IRON_GUARD ×0.82
//                            HEAVY_WRENCH ×0.86  SHIELD_SLAM ×0.90  CAUTERIZE ×0.94
//
// The asymmetry is arithmetic, not a second effect: the line is DEPLOYED = 3, so putting a
// recruit on it multiplies that recruit's share several times over while diluting each of the
// seven by a fraction. Fourteen further ability rows held, and every one of them is a
// starting-seven move. ANY PHASE THAT READ AN ABILITY RATE OFF THIS FILE READ IT THROUGH THAT -
// D06, D07, E12b and E12c all did. Their qualitative findings survive (a move that never fired
// at all still never fired); their shares and counts do not, and want re-measuring before they
// are quoted again.
//
// J05 CORRECTION: this list named E05 as well, and E05 does not belong on it. E05 is about
// ENEMY intent tables - it rolled rollIntent 40,000 times per type to show eighteen units
// shared four behaviours - and rollIntent does not care who is standing on the player's line.
// Nothing in it was ever read through this lens. Four phases, not five.
//
// 2. THE SQUAD SURVIVED WORSE, which is the same fact seen from the other side.
//   wipes per run 5.4 → 6.3      withdrawals per run 3.3 → 4.6      regroups 4.9 → 5.7
//   scars dealt ×1.26   shell shock ×1.50   dragged clear at a fight's end ×1.26
//   turns taken with somebody down ×1.18   turns spent saving them ×1.17
//   arrivals at 60-80% ×2.42, at 40-60% ×2.00, under 40% ×1.52
//   `hurt arrivals that could not pay` ×1.78 - a line arriving hurt AND unable to buy its way up
//
// 3. AND GOT LESS FAR. Careers won 49.7 → 30.0 of 150 - 33% against 20%, the gap I06 re-cut the
// wall inside. Sector 7 reached 55 → 44, deepest sector mean 4.6 → 4.3, bosses felled 3.8 → 3.4,
// deepest bond 36.2 → 32.2. Score on a won run went UP (×1.04) while wins fell by a third, which
// is survivorship rather than a reward change: fewer careers finished, and only the strong ones.
//
// 4. THE PURSE. Skulls earned ×0.82 and skulls left unspent ×0.57 - a smaller purse spent harder,
// which fits a line under more pressure. I01's retreat rows moved with it: retreat was on the
// table ×1.42, affordable when it was ×1.32.
//
// 5. THE RECRUIT-OFFER INSTRUMENT ITSELF (offers seen ×1.20, offered to a full line ×1.22,
// affordable ×1.14, could afford ×1.36, which card ×1.19, out-hit the worst ×1.18, HARPOONER
// appearances ×1.18). These are circular - they instrument the very arm that changed - and are
// recorded for completeness, not as findings.
//
// WHAT HELD AS A WHOLE ROW, and can be taken at face value: all sixteen named formations and
// NO_HANDS; every relic offer and take row, common, rare and cursed alike, plus relics held and
// offers holding a curse; every warlord standing mean; every follow-up thread that fires at all
// (three of the ten are flat zero in both arms and prove nothing either way); sealed caches met,
// forced, opened clean and the scrap out of them; consequences booked and resolved; event
// choices offered, priced at a sector-one constant and affordable when offered; bounties
// completed; promotions, crafting, requisitions and stat upgrades per run; kills both ways;
// actor turns per fight and fights per run; elites broken; mean arrival level and mean relics
// carried; lost for good; runs that lost nobody; the share of recoveries scarred and every scar
// type; and risen ×1 and ×2.
//
// HELD ONLY AT THE HEAD, so do not quote the tail: classes deployed (see above), ground fought
// on, sky fought under, confluences, faces met, hostile signatures met, fronts weathered,
// affixes worn, contracts settled by kind, node kinds offered and taken, which lock a cache
// was, who opened them, consequences by source, items used per run, wipes by sector and by tier,
// and the Citadel at the end.
//
// The shape of the first list is the finding behind the finding: the bug moved WHO STOOD ON THE
// LINE and everything downstream of a weaker line, and it did not move what the road put in
// front of them. Anything this file measures about the world survived; most of what it measures
// about the squad did not.

// ── I08: THE RECRUIT IS NOT BENCHED BY THIS FILE. THE BODY IS BEHIND. ─────────────
// I07 left the recruit rows reading like content nobody reaches: 242 of 456 offers signed and
// 19 put on the line, N08's three classes standing in 18-27 careers of 150 against the Medic's
// 138. This item went looking for the instrument defect behind that, on the reasonable prior
// that I05 had just found one in the same block. It did not find one. Two premises died on the
// way and both are recorded, because the negative results are the item.
//
// WHAT IS TRUE ABOUT THE INSTRUMENT. Every way a body improves here is gated on gridPos > 0 -
// stat upgrades, gear out of the stash, and augments, all three. The game gates NONE of them:
// canUpg is `scrap >= cost`, canAugment asks slots and materials, equipGear asks fit, and
// renderOutpost walks playerRoster unfiltered. Perk points were already roster-wide in both,
// which is what made the other three easy to miss. Suite 149 pins all of it.
//
// That is a real divergence, and next to this file's own fielding rule it looks like a deadlock:
// benched for want of accumulation, unable to accumulate for want of a slot. So it was opened.
// `--invest roster` spends on any living operator and re-reads the line at each Outpost, since
// paying to improve a benched body without a way for it to earn the slot is incoherent. Three
// careers of 150 an arm, everything else identical:
//
//                        line (default)          roster
//   wipes per run        5.23 / 5.51 / 5.57      5.77 / 5.87 / 5.89     SEPARATES, roster worse
//   regroups spent       4.72 / 5.00 / 5.01      5.21 / 5.33 / 5.36     SEPARATES, roster worse
//   upgrades bought/run  45.8 / 48.7 / 49.2      60.9 / 60.9 / 61.5     SEPARATES, roster higher
//   gear equipped/run     5.2 /  5.4 /  5.6       6.4 /  6.5 /  6.7     SEPARATES, roster higher
//   careers won of 150     34 /   49 /   53        33 /   35 /   38     overlaps
//   score, median       28.1k / 31.9k / 35.1k   29.5k / 29.5k / 31.5k   overlaps
//   lost for good         484 /  513 /  554       552 /  599 /  600     overlaps (by two)
//   bosses felled, mean  3.51 / 3.68 / 3.90      3.43 / 3.43 / 3.51     overlaps (touching)
//
// SO THE GATE IS A DIVERGENCE AND LINE-ONLY IS STILL THE BETTER POLICY. Opening it buys MORE
// upgrades for the same purse - upgradeCost rides each operator's OWN count, so ten shallow
// bodies are cheaper per purchase than three deep ones - and more gear, and then wipes more and
// regroups more for it. Nothing it bought reached a win rate or a depth. `line` therefore stays
// the default: it is not a fidelity bug being preserved, it is a policy this file can now show
// is the better one. `roster` stays as the arm that showed it.
//
// ONE CAVEAT ON THAT ARM, STATED BECAUSE IT BOUNDS THE CONCLUSION. Its re-slot rule maximises
// rate(), which knows nothing about role, so the obvious worry is that it benched the healer.
// It did not: MEDIC stood in 144-146 careers of 150 under `roster` against 131-142 under `line`.
// Every class rose, which is rotation rather than a better squad - re-slotting means more faces
// touch the line during a run, so "classes deployed" counts more of them.
//
// AND THE RECRUIT STAYS ON THE BENCH IN BOTH ARMS, which is the actual answer:
//
//                        line                    roster
//   contested placements  210 / 230 / 239         167 / 183 / 195
//   mean rate gap        31.3 / 31.3 / 33.3      36.8 / 38.6 / 38.6
//   incumbent upgrades    7.0 / 7.3 / 7.3         6.6 / 6.8 / 6.9
//   recruit upgrades      0.0 in every career, in BOTH arms
//   would win at parity  15% / 15% / 17%          7% /  9% /  9%
//
// The recruit's upgradeCount is zero under `roster` too, and that is not a bug in the arm: the
// placement is decided the instant the signature lands, on the road, before any Outpost exists
// to spend at. So opening the gates cannot reach this decision at all, whatever it does for the
// rest of the squad. THE OPENING PREMISE OF THIS ITEM - that a harness gate is what benches the
// recruit - IS REFUTED. The body is behind, and it is behind at the one moment anybody asks.
//
// HOW A RECRUIT ACTUALLY REACHES THE LINE, decomposed, because "19 of 242" hides two different
// stories and an earlier draft of this note got it wrong by calling them all deaths:
//
//                        line                    roster
//   signed                247 / 236 / 227         170 / 211 / 203
//   a slot was free         8 /   6 /  17           3 /  16 /  20    somebody had died
//   won a full line        12 /   9 /   7           8 /  10 /   6    out-rated the worst hand
//   fielded                20 /  15 /  24          11 /  26 /  26
//
// So it is about half and half, not all deaths. And the counterfactual is the sharpest number
// this item produced: at upgrade parity the merit wins would be 40 / 34 / 32 rather than
// 12 / 9 / 7 - THREE TO FOUR TIMES AS MANY. Purchased upgrades are 19-20 points of a 31-33 point
// gap, so closing them is far and away the largest single lever on whether a recruit ever
// stands. It is still not enough to make fielding usual: 32-40 of 210-239 contested placements
// is 15%, so five in six would stay on the bench. Both halves of that are the finding.
//
// WHAT RESHAPES THE QUESTION FOR WHOEVER TAKES IT NEXT. confirmNewGame does
// `playerRoster = ROSTER_TEMPLATE`, so A SIGNATURE LASTS EXACTLY ONE EXPEDITION. The 456 offers
// splitting evenly three ways across 150 runs is the same fact read off the data - the shelf
// refills every run. At ~186 scrap a recruit is not a roster addition, it is a within-run
// replacement for somebody already lost, and the 19 of 242 that reached the line got there
// through a free slot, which is to say through a death. That is a coherent design. It is not
// what the price curve, the pitch or "SIGN THEM ON" imply, and it is why N08's three classes
// read as unreachable content on a healthy run.
//
// Nothing was tuned here. Whether a recruit should arrive at purchased-stat parity, or carry
// between expeditions, or cost less because it is a consumable, is a design question with a
// balance target behind it, and the target is the owner's to set - the same reason I05 left
// H13's wall alone until it was asked for.

// ── J01: WHAT THE SKY TAKES — THE SAWTOOTH IS REAL AND IT IS SYMMETRIC ────────────
// E06 pulled `1 + (currentTier - 1) * 0.4` out of five spawn sites and left it at two: the
// SMOG chip and the SHRAPNEL roll. Suite 97 pins that both still use it and calls it a phase of
// its own. Nobody had costed it, and the reason is that THE SKY WAS THE ONE DAMAGE SOURCE IN
// THE GAME WITH NO LEDGER - this file could say which sky a fight was fought under and nothing
// at all about what it did there, so the only way to ask was to re-derive the formula somewhere
// else, which is exactly the hand-copy defect F03 catalogued nine of.
//
// So the engine books it now, on the same lazy runStats idiom bondSaves uses: what LANDED
// rather than what was rolled, per side, per sector, per cause, with exposure alongside so the
// by-sector totals can be read per turn. Raw totals by sector describe where runs end, not what
// the sky does once you are there.
//
// THE SAWTOOTH IS REAL. currentTier resets to openingTier() at every sector boundary and the
// expression has no sector term, so weather ramps 1.0x to 4.6x across a sector and starts over,
// while the fight beside it rides SECTOR_HP_SCALE and never restarts. Three careers of 150:
//
//   damage per weather turn   s1    s2    s3    s4    s5    s6    s7
//     career 1               6.4   6.8   7.1   7.2   7.4   7.1   7.1
//     career 2               6.3   7.3   7.2   6.3   7.0   6.6   6.6
//     career 3               6.3   6.9   7.2   7.3   6.7   7.0   6.9
//
// Flat at every depth, to within a point, exactly as the shape predicts.
//
// BUT THE EFFECT IS MILD AND IT IS SYMMETRIC, which is the finding and was not the prediction.
// Read as the share of the bar each tick actually took:
//
//   share of the squad bar    8.3  7.3  6.2  6.0  4.9  4.1  4.5
//                             8.3  7.0  6.1  5.3  5.7  4.3  4.3
//                             8.3  6.4  6.7  5.5  5.0  4.5  4.3
//   share of the hostile bar  9.2  8.3  6.6  5.5  3.8  3.8  4.6
//                             9.6  7.8  6.1  5.3  5.1  4.6  4.1
//                             9.2  7.4  6.7  5.7  5.5  4.1  4.0
//
// The squad decays 8.3% to about 4.4%, the hostiles 9.3% to about 4.2% - a factor of 1.9 and
// 2.2, tracking each other within a point at every sector. The sky does not become one-sided at
// depth, and 4% of a bar a tick in sector seven is not nothing. The premise this item opened
// with - that a resetting curve makes the weather stop mattering the way E04's armour did - IS
// NOT SUPPORTED. THE CURVE IS LEFT ALONE: changing it would be an unforced balance move against
// no measured problem, and it would shift the wall I06 has just cut to a 30% target.
//
// WHY THE SQUAD STILL EATS MORE OF IT IN TOTAL - 222k / 205k / 198k against 134k / 126k / 124k,
// a ratio near 1.6 in all three careers - is exposure and not rate. The per-tick shares above
// are within a point of each other, so it is not that the sky hits the squad harder; it is that
// three bodies stand there continuously while hostile groups are killed and replaced.
//
// AND THE LEDGER FOUND SOMETHING ELSE ON ITS WAY, which is the argument for building an
// instrument even when the premise it was built for fails. Its totals came back FRACTIONAL -
// 133851.4 hostile, SMOG 296919.8 - although both weather sites floor their own damage. A scan
// of every hp and maxHp write in the engine turned up nothing unfloored, because the arithmetic
// was in an ARGUMENT rather than an assignment: seventeen overdrive variants hand
// applyDamageHit `actEnt.dmgBase * 1.2` and the like, mitigate's body is integer operations on
// whatever figure it is given, and the fraction rode all the way to the bar. Worse, netDmg is
// interpolated into the floating combat text and the log, so a Scrap Storm off a 58-damage
// operator showed the player `-69.60000000000001`. J02 floors it once at applyDamageHit's own
// door and suite 151 pins it. The damage change is under a point on seventeen abilities and is
// far below what a career can resolve, so nothing here was re-baselined for it.
//
// TWO THINGS CHECKED AND DELIBERATELY NOT CLAIMED. difficultyMult does not reach the weather.
// E06 found the same omission at the spawn sites and repaired it there, but a spawn is an enemy
// and the sky is not: it damages whoever is standing, so scaling it by the enemy knob would be
// wrong in a way the spawn sites were not. And SMOG carries the load five to one over SHRAPNEL
// (297k / 269k / 267k against 59k / 62k / 55k), which is chance-versus-certainty rather than a
// balance gap - SMOG chips every turn and SHRAPNEL rolls.

// ── J04: THE PLATE E04 LEFT FLAT — IT DECAYS, BY HALF AS MUCH AS I FIRST READ ─────
// E04 scaled defensive GRANTS by armourScale() and left BASE armour alone on purpose. Its
// reasoning is in 95-armour-scales and it is sound: base armour subtracts from PLAYER damage,
// which grows through perks and upgrades rather than along the enemy curve, so scaling it by
// that curve would turn the Bastion's 30 into 250 at sector seven against player hits in the
// low hundreds. It said so, left it flat, and filed the question of whether flat keeps pace.
//
// It had no instrument to answer with. hitLog holds the last 24 hits for the explain panel and
// nothing has ever aggregated them, so the question sat open from E04 to here. The engine books
// it now, per sector, on the runStats idiom the weather ledger uses: what the hit was worth
// before the plate, and what the plate took off it.
//
// Three careers of 150:
//
//   mean player hit          s1    s2    s3    s4    s5    s6    s7
//     career 1               29    46    58    63    72    82    92
//     career 2               30    47    57    65    72    81    87
//     career 3               30    45    55    62    72    83    96
//   what the plate took     9.8  14.9  16.9  23.4  18.2  18.3  13.2
//                          10.1  15.3  20.2  24.3  16.5  22.4  11.4
//                          10.7  12.4  17.6  17.5  18.8  16.2  15.0
//   the plate's share      34.2% 32.7% 29.1% 37.1% 25.4% 22.2% 14.2%
//                          33.3% 32.8% 35.6% 37.6% 22.8% 27.5% 13.1%
//                          35.6% 27.6% 32.1% 28.3% 26.0% 19.5% 15.6%
//
// CONFIRMED, AND SMALLER THAN IT LOOKED. A player hit grows about threefold across the road
// while the plate's share of it falls from ~34% to ~14% - a factor of 2.4. That is the shape
// E04 named, on the half it deferred, and it is nowhere near the twelvefold collapse E04
// measured for grants. 14% of a hit at sector seven is not nothing.
//
// AND THE PLATE IS NOT ACTUALLY FLAT IN AGGREGATE, which is the part I had wrong going in.
// Each unit's plate is a fixed number, but what a hit meets is not: the figure taken rises from
// ~10 to ~13 across the road, because the road fields more armoured units the deeper it goes
// and an escort adds 20 of its own. Composition absorbs roughly a third of the decay that
// per-unit flatness would otherwise produce. "Base armour is flat" is true of a line in a table
// and false of the fight the player is in.
//
// A METHOD NOTE, PAID FOR THE SAME WAY THE FILE'S OWN HEADER SAYS IT WILL BE. A 25-expedition
// smoke read this as 35% falling to 5.3%, a sixfold collapse, and three careers put it at 34%
// to 14%. The small sample did not just add noise, it exaggerated the effect by more than
// double - deep sectors are thinly sampled at 25 runs and the few fights that reach them are
// not a fair draw. The rule at the top of this file says 150+ before believing anything about
// depth; this is what ignoring it looks like when the number still points the right way.
//
// NOTHING WAS RETUNED. Making the plate matter again at depth makes the game harder exactly
// where I06 cut the wall to a 30% target, so it is a tuning decision with a target behind it
// and the target is the owner's. Recorded, pinned by suite 152, left alone.
//
// ONE THING SHIPPED ON THE WAY, INDEPENDENT OF ANY OF THAT. mitigate computes the armour it
// subtracts - the unit's plate, plus ASHFALL's 2, plus 20 for a standing escort - and threw the
// figure away; the explain panel printed `target.armor` in its place. The soaked TOTAL was
// always right, so the arithmetic reconciled, but the breakdown under it credited the escort's
// plate to nobody. mitigate hands the figure back now and the panel names what came off.

// ── K01: PARITY ON SIGNING — FIELDING TREBLED AND THE WALL DID NOT MOVE ───────────
// I08 left the recruit as a body nobody could use: signed on 53% of offers, fielded on 8% of
// those, and behind at the one moment anybody asks. It also measured the cause precisely -
// purchased upgrades were 19-20 points of a 31-33 point rating gap - and the counterfactual:
// at parity the merit fieldings would treble. signOnRecruit grants that parity now, at the
// LINE'S MEDIAN, alongside the level par the engine has always given.
//
// I expected this to make the game easier and need re-tuning against I06's 30% target. It did
// not, and that is the finding.
//
//                        before (I08 line)        after (K01)
//   fielded of signed     20/247  15/236  24/227   55/236  54/237  57/242
//                            8%      6%     11%      23%     23%     24%
//   mean rate gap        31.3    31.3    33.3      10.5    10.9    10.7
//   upgrades, them/us     7.0/0   7.3/0   7.3/0     7.5/8.1 7.5/8.1 7.6/8.1
//   careers won of 150     53      49      34        49      53      47
//   wipes per run        5.51    5.23    5.57      5.61    5.55    5.51
//   score, median        35.1k   31.9k   28.1k     36.7k   37.8k   32.6k
//   lost for good         513     484     554       487     478     504
//   bosses felled        3.90    3.68    3.51      3.93    3.99    3.61
//
// THE FIELDING RATE TREBLED, 8% TO 23%, WHICH IS EXACTLY WHAT I08 PREDICTED. And every other
// row OVERLAPS - not one of them separates under the rule the rest of this file holds effects
// to. Wins read 33% against 30% on the means, and the before-arm carries a 34 that the after-arm
// has no answer to; three separate samples of near-identical builds have now read 32% (I06),
// 30% (I08) and 33% (K01), which is the career band and not a movement. THE WALL IS WHERE I06
// LEFT IT. Nothing was re-tuned and nothing needs to be.
//
// WHY IT DOES NOT MOVE THE WALL, which is worth understanding rather than just recording. The
// placement rule only fields the hire when it beats the worst hand standing, so a better hire
// does not put a WORSE line on the field - it replaces the weakest member slightly more often.
// And the gap does not close to zero: 10.5 points remain after parity, because augments, gear
// and spent perk points are still the squad's and not theirs. The hire became usable without
// becoming a shortcut.
//
// THE ROW THAT INVERTED. `upgrades bought, incumbent / recruit` now reads 7.5 / 8.1 - the hire
// carries slightly MORE than the mean incumbent, so the line "what those upgrades are worth in
// rate" prints a NEGATIVE contribution. That is not a defect in either the grant or the
// instrument: parity is taken from the line's MEDIAN and the instrument reports against the
// incumbent it is actually being compared to, which is the worst hand standing and therefore
// usually below the median. Two different comparators, both correct, and the sign is the proof
// they are different.

// ── K02: SIX OF THE RANK AND FILE NAME WHAT THEY THROW — 3% OF BLOWS BECAME 38% ───
// Two of the player's three resistance fields answered almost nothing. enemyStrike and every
// other enemy damage site read `enemy.dmgType || 'phys'`, and exactly three templates in the
// game set that field: the Carrion Matriarch, the Vatborn and the Stormcaller, all commanders.
// Every one of the rank and file swung physical. Measured with a per-type ledger over three
// 150-expedition careers, the squad met bio on 1.3-1.5% of the blows aimed at it and energy on
// 1.1-1.4%. Four pieces of shipped content answered that: the Gas Mask (+10 bio), the Insulated
// Coat (+10 energy), the HAZMAT perk Closed Circuit (+40 bio) and the bio 25 baked into the
// Hazmat's own line.
//
// The fix is DATA, not engine - the damage sites already read the field. Three units the
// bestiary already calls chemical throw bio (Chem Fiend, Censer Bearer, Blight Moth) and the
// three powered machines throw energy (Drone, Turret, War Rig), which makes MECH an energy
// faction end to end.
//
//                          before (K01 line)        after (K02)
//   blows at the squad
//     phys                 97.1%  97.4%  97.6%     61.6%  61.3%  62.6%
//     bio                   1.5%   1.3%   1.4%     13.8%  12.4%  12.9%
//     energy                1.4%   1.3%   1.1%     24.5%  26.3%  24.5%
//   careers won of 150       57     51     63        48     51     52
//   wipes per run          5.31   5.34   5.43      5.55   5.33   5.51
//   reached sector 7        45%    39%    47%       35%    37%    38%
//   lost for good          3.03   3.37   3.47      3.23   3.36   2.95
//   score, median         52.0k  40.2k  54.0k     31.3k  30.5k  32.6k
//   bosses felled          4.07   3.97   4.09      3.73   3.75   3.86
//   resistance's share of
//     all incoming damage  10.9%  12.7%  11.5%      8.7%   9.3%   9.6%
//
// THE CLAIM SEPARATES BY A MILE: 2.8% of incoming blows were bio or energy, and 38% of them
// are now. That row is definition-independent and needs no argument.
//
// IT IS A MODEST HARDENING, WHICH IS NOT WHAT I PREDICTED. I expected the switch to be neutral
// or slightly kind, because most operators carry 0 in bio and energy and would simply take the
// blow unresisted. That reasoning was backwards. What matters is the resistance that STOPS
// applying: everybody carries a little physical (5 on the Bruiser and the Breacher, -2 on the
// Hound), and 38% of blows no longer meet it. The composite share of incoming damage that any
// resistance soaks fell from 10.9-12.7% to 8.7-9.6% - about two and a half points more damage
// taken. That row is a share of every blow in a career rather than a per-career outcome, which
// is why it separates cleanly where the run rows below it turn out not to. It says the squad
// takes more damage. It does not say by itself how much that costs a run.
//
// WHICH ROWS ACTUALLY MOVED, under the separation rule the rest of this file holds effects to.
// SEPARATED: score median (40.2k floor before against a 32.6k ceiling after - a wide gap),
// reached sector 7 (39% against 38% - by one point), bosses felled (3.97 against 3.86).
// OVERLAPPED: careers won, wipes per run, lost for good.
//
// K06 CORRECTS THE READING OF THOSE ROWS, though not the ledger row above them. Two things were
// wrong with it. The first: "seven rows at three-against-three is about 0.7 spurious separations
// on I07's own arithmetic, so three separations all pointing the same way is more than chance."
// That arithmetic assumes the rows are independent. Measured across nine careers on identical
// code, reached sector 7 correlates with the win count at +0.94 and score at +0.54 - they are
// not seven readings, they are two or three wearing seven labels, and separations that agree are
// one fact counted several times rather than three confirmations of it.
//
// The second, and worse: none of the three gaps clears the noise. On that same nine-career
// control, score median spans 28.3k to 40.2k on identical code - so a 40.2k floor against a
// 32.6k ceiling is the whole band, not a wide gap. Reached sector 7 spans 42 to 62 of 150; a
// one-point difference is nothing. Bosses felled spans 5.6 to 5.8 against a claimed 3.97 to 3.86
// - the same order as the noise. All three ROWS separated and NONE of the effects did.
//
// SO THE HONEST READING IS NARROWER THAN WHAT STOOD HERE, which was "runs end shallower and
// score lower; the win rate does not move out of the career band". The second half stands. The
// first half is withdrawn: at three careers an arm this file could not have seen it either way.
// What is left is the census - 2.8% of incoming blows were bio or energy and 38% are now - and
// the resistance-share row under it, both of which count rather than sample.
//
// NOTHING WAS RE-TUNED FOR IT. The win rate is what I06 tuned against, and the after-arm sits
// at 32/34/35 (mean 34%) against a 30% target, where the before-arm sat at 38/34/42 (mean 38%).
// The change moves the wall TOWARD where I06 aimed, not away from it, and it does so without
// separating. A compensating buff would be re-tuning against a row that did not move.
//
// WHAT THE ANSWER IS WORTH is measured directly in suite 154, off the engine's own curve: the
// Gas Mask takes a flat 10 off every bio blow, which is 48% of a Censer Bearer's ordinary swing
// where the Choir first stands and 21% of it at the end of the road; with Closed Circuit on top,
// that ordinary swing is shut out entirely at every depth, and its heavy turn drops 70 to 20.
// Those are arithmetic on the engine and they stand.
//
// TWO SENTENCES THAT STOOD HERE WERE WRONG. K06 CORRECTED THEM. They said the careers above
// "measure a player who never adapts", and that having no answer to energy is "what makes the
// trinket slot a decision rather than a strictly better hat". Both assume a player who wants a
// Gas Mask can go and get one. NO PATH IN THE GAME LETS A PLAYER CHOOSE A PIECE OF GEAR. Every
// source is rollGear() - a uniform draw over whatever the run does not already hold - and there
// are four: the elite drop, the commander drop, the event that sets a piece aside, and the
// Armory's single GEAR row, which is one rolled piece at a fixed price rather than a shelf. The
// Footlocker carries one piece between runs and keeps THE FIRST the squad picked up, not a
// chosen one. What a player does decide is whether to pay for the row that was rolled, and which
// operator wears what is already in the bag. Neither of those is choosing the piece.
//
// SO THE "NEVER ADAPTS" FRAMING WAS BACKWARDS. This file's shop policy buys the GEAR row FIRST
// of five, ahead of stims, insurance and the relic, and its Outpost policy puts every piece it
// holds on the first deployed body it fits. In the one dimension the sentence claimed was
// missing - going and getting the answer - it is not behind a human, because a human cannot do
// it either. The real gap is narrower: who wears what. K05 measured that dimension on the bench,
// where the choice does exist, and found choosing by need neutral at best.
//
// AND THE RATE IS A CENSUS, not an argument, so K06's noise finding below does not touch it.
// Over three 150-expedition careers the Gas Mask is put on somebody in 0.33 / 0.33 / 0.27 of
// runs and is still worn at the end in 0.25 / 0.16 / 0.19; the Insulated Coat reads 0.37 / 0.37
// / 0.36 and 0.22 / 0.19 / 0.21. All eight trinkets sit inside that same band, and that flatness
// IS the uniform draw - nothing in the game bends it toward what the squad is being hit with. A
// squad meets bio on 13% of the blows aimed at it and energy on 25%, which is to say every run;
// it ends about one run in five holding the answer to either. THAT is what makes the mitigation
// content thin, and it is a reachability problem rather than a strength problem. Filed as K07.
//
// ONE ROW IN THIS FILE IS NOT COMPARABLE ACROSS THIS COMMIT. The first draft of the damage-type
// ledger booked a resistance at its FACE VALUE, so a bio-immune machine booked 100 against a
// 30-point blow and `of the blow, resistance took` read 78-91% on the hostile side - a number
// most of which was a wall stopping everything rather than a subtraction taking 88 of every 100.
// It is booked as the blow it actually stopped now, and counted separately on its own line. The
// hostile-side row is quoted AFTER only. The squad side is near-comparable (no player carries an
// immunity - `stopped dead` reads 0.0% in every career) but the cap can still bite where a chip
// blow is smaller than the resistance meeting it, so read the composite row as indicative.
//
// WHAT THE NEW LINES SAY THAT THE OLD ONE COULD NOT. At the hostiles: bio blows are stopped
// dead 22.4% of the time and energy blows land on a weakness 60.6% of the time - the bestiary
// was already written as "bring energy, do not bring bio", and now the incoming direction says
// something too. At the squad: nothing is ever stopped dead, and only physical lands on a
// weakness at all (2.3%, which is the Hound).

// ── K05: THE BENCH GETS A SECOND ROW PER MATERIAL — AND A RIGHT AMOUNT OF IT ──────
// Filed as "three augments is the thinnest axis in the game, and materials are the currency with
// almost nowhere to go". A materials ledger went into the engine before anything was designed,
// and the premise came apart three times over three 150-expedition careers:
//
//   MATERIALS ARE NOT DEAD.  33 into the bench, 105 into schematics, 10 left standing. 94% spent.
//   THE BENCH IS NOT IDLE.   15 installs a run; 45% of bodies end at the slot cap.
//   IT IS NOT A CHECKLIST.   installAugment caps SLOTS, not repeats. Of filled bodies only 20%
//                            carried one of each; 21% carried three of the same, and eight
//                            distinct sets turned up in twenty-five runs.
//
// What survived is narrower: all three rows were flat stat bumps, so nothing about the RUN ever
// bore on which to buy. That eight-way spread is a fact about which materials were in the bag,
// not about a decision. So each material bought a second thing - parts a thicker hide, chems a
// sealed suit, tech an earth strap - sized off K02's incidence figures so each is worth about
// five points off an average blow.
//
//                      wins /150      wipes             reached sector 7
//   greedy/3 baseline  50 50 53       5.48 5.38 5.31    41% 37% 39%
//   road/3 policy only 54 52 50       5.72 5.77 5.51    39% 45% 37%
//   road/6 both        40 39 43       5.49 5.29 5.53    29% 30% 31%
//   road/6 + augmax 1  56 53 52       4.97 5.40 5.65    40% 39% 41%
//
// THE POLICY ALONE IS A NULL. road/3 overlaps the baseline on every row, which is what the
// --augcat arm was built to establish: the harness change is attributable and harmless.
//
// WITHDRAWN BY K06. What this said was: "the catalogue is neutral at one answer a body and
// expensive at two", off max1 (53.7 wins) against road6 (40.7). K06 re-ran that same max1
// configuration twice more and got 41.3 and 48.3 - so the gap this conclusion rested on is
// inside the instrument's own noise, which nobody had measured. The honest state of the question
// is UNMEASURED. What still stands from the arms is the shape rather than the size: the road
// policy takes answers into 35% of installs unrestricted and 18% capped, and the sets it
// produces are Optics+Optics+Rod and Optics+Pump+Weave rather than three of the same. Whether
// that costs anything needs six careers an arm; see the K06 record above the argument list.
//
// WHY, AND IT IS THE GENERAL POINT: output compounds and mitigation does not. +4 DMG shortens
// the fight, which cuts incoming damage on every turn after it. +20 energy resist saves a fixed
// amount per blow and changes nothing about how long the fight runs. I sized the answers to
// equal points-per-blow, and equal points are not equal value in a game where killing faster is
// itself a defence. The first answer on a body displaces the third-best flat option and costs
// nothing; the second displaces the second-best and costs real ground.
//
// WHAT I GOT WRONG, in order: the premise (three times), the sizing principle (points-per-blow
// rather than value-per-slot), and then very nearly the verdict - the first three arms said
// "revert this" and the only reason they did not get their way is that the policy was measured
// separately from the content. An arm that separates a trap from an over-eager harness was worth
// more than the thirty-five minutes it cost.
//
// TWO DEFAULTS CHANGED, both measured neutral against the greedy baseline before being changed:
// --augments defaults to `road` because the greedy scan provably cannot reach half the bench,
// and --augmax defaults to 1 because that is the number the careers support.

// ── K07: THE ARMORY IS A DECISION NOW — AND IT ONLY PAYS IF YOU MAKE IT ───────────
// K06 censused where gear comes from and found nothing a player could aim at: four sources, all
// rollGear(), a uniform draw over the unheld pool. The Gas Mask reached a run about one time in
// three and was still worn at the end about one in five, and those rates were set by the size of
// the pool rather than by anything the squad was being hit with. The content was not mistuned,
// it was unreachable - and K06 filed the fix rather than shipping it, because the same phase had
// just shown the career instrument cannot price a change like this at three careers an arm.
//
// WHAT SHIPPED. The Armory - the one door a player routes to on purpose and pays at - lays out
// SHELF_GEAR pieces and sells exactly one of them. The same piece per Armory the economy was
// tuned around, chosen instead of dealt. The elite drop, the commander drop and Orrin's Workshop
// stay blind, because an elite's pockets are not a shop.
//
// AND THE SHELF LEANS TO WHAT THE LINE CAN WEAR, which was not in the plan and came out of the
// first measurement of it. Twenty of the twenty-eight pieces are class-locked mods, so a blind
// shelf of three came up 48% wearable and offered NOTHING the squad could equip one shelf in
// eight. A choice between three things nobody can use is a longer way of saying no. What fits
// goes on first and the rest only top up what a thin roster cannot fill: 100% wearable over
// 1,871 shelves, one dud in all of them.
//
// MEASURED AT THE SAMPLE SIZE K06 ASKED FOR: eighteen 150-expedition careers, six an arm.
//   before   the pre-K07 tree at 3f54663, run from a worktree
//   default  this tree, shipped behaviour, buying the leftmost row - a player who does not look
//   reads    this tree with --shoppick answer, which takes whatever answers what has been
//            landing. A BENCH CEILING, not a model of play: it spends the slot on mitigation
//            every time it can, so `default` and `reads` bracket a person rather than predict one
//
// THE WALL DID NOT MOVE, and this time that is a measurement rather than a hope. Every row
// overlaps in both arms, largest 2.0 sd, on a design that could have settled a gap of 8.6 wins:
//
//                          before        default              reads
//   careers won of 150      51.2      47.3  (1.3 sd)      50.0  (0.5 sd)     all overlap
//   wipes per run            5.29      5.45 (1.8)          5.46 (2.0)        all overlap
//   reached sector 7        57.3      53.5  (1.2)         59.0  (0.6)        all overlap
//   score, median          35.2k     34.3k  (0.2)        36.9k  (0.5)        all overlap
//   gear equipped per run    5.57      5.68 (0.9)          5.77 (1.5)        all overlap
//
// AND WHAT A RUN ENDS UP HOLDING SPLITS THE TWO ARMS APART, which is the whole finding. `worn at
// the end` is a per-run rate averaged over 150 runs, so its career-to-career noise is small -
// these are the rows a six-a-side design can actually resolve, and K06's floor does not apply to
// them the way it applies to a win count:
//
//                            before      default            reads
//   an answer (mask + coat)    0.44    0.46 (0.8 sd)    0.59 (10.5 sd, RANGES SEPARATE)
//   any resistance trinket     0.65    0.72 (2.8)       0.90 ( 9.4 sd, RANGES SEPARATE)
//   GAS_MASK                   0.20    0.24 (2.8)       0.29 ( 7.4 sd, RANGES SEPARATE)
//   INSULATED_COAT             0.24    0.22 (0.7)       0.30 ( 4.4 sd, overlapping)
//   RIOT_SHIELD                0.21    0.26 (3.0)       0.31 ( 4.2 sd, RANGES SEPARATE)
//
// THE SHELF CHANGES NOTHING FOR SOMEBODY WHO TAKES THE FIRST THING ON IT, and lifts how often a
// run ends holding an answer by a third for somebody who reads it. That is what a decision is
// supposed to look like: it pays out to the decision rather than to everybody. The `default`
// column is not a disappointment, it is the control working.
//
// AT THE COUNTER, over 1,273 and 1,383 purchases - counts rather than career averages, so they
// read at any sample size. Of the pieces bought at an Armory, how many moved a resistance at
// all, and how many answered bio or energy: 20% / 14% indifferent, and 47% / 30% reading. A
// blind draw over the whole pool would be 3 of 28 and 2 of 28, which is 11% and 7%; the
// indifferent buyer beats that only because the wearable lean raises the trinkets' share of the
// shelf - every trinket fits anybody, and only about half the mods do.
//
// AND THE PHYS PIECE WINS THE POLICY'S OWN ARITHMETIC, which is why the two columns come apart.
// A flat resistance is worth its size times how often the type it answers lands, and after K02
// the squad meets phys on 61% of incoming blows against bio's 13%: a Riot Shield's flat 6 is
// worth 3.7 off an average blow where a Gas Mask's flat 10 is worth 1.3. A player reading the
// shelf for mitigation should usually take the Riot Shield. That is not a fault in K07 - it is
// the first thing K07 made it possible to be right about - but it does suggest the two answer
// trinkets are undersized against the phys one. Filed rather than tuned here, because
// average-blow value undersells concentrated protection: suite 154 measures the Gas Mask at 48%
// of a Censer Bearer's ordinary swing where the Choir first stands, and that is the fight it is
// for.

// ── K06: THE MITIGATION CONTENT IS NOT WEAK. IT IS UNREACHABLE ─────────────────────
// Filed as "K02 gave the rank and file bio and energy to throw; is the rest of the mitigation
// content a trap too?" - meaning the Gas Mask, the Insulated Coat, Closed Circuit, the Hazmat
// Specialist's baked bio 25 and K05's three answer augments. The expected shape of the answer
// was a win-rate arm: fit the line with a resist and see whether it buys anything. It does not
// need one, and at three careers it could not have one (see the noise record below).
//
// THE ANSWER IS A CENSUS. Every piece of gear that enters a run does so through rollGear(), a
// uniform draw over whatever the run does not already hold. There are exactly four callers -
// the elite drop, the commander drop, the event that sets a piece aside, and rollShopStock,
// which puts ONE rolled piece on the Armory's shelf at a fixed price. The Footlocker carries
// one piece between runs and lockerFrom() keeps THE FIRST the squad picked up. Nothing filters,
// weights or offers a choice of piece anywhere in that path. A player being gassed by the Choir
// has no action available that raises their odds of holding a Gas Mask.
//
// AND THE ODDS ARE FLAT, which is the same fact seen from the other end. Three 150-expedition
// careers, `pieces put on, per run` and `trinkets still worn at the end`:
//
//                        put on              worn at the end
//   GAS_MASK        0.33  0.33  0.27        0.25  0.16  0.19
//   INSULATED_COAT  0.37  0.37  0.36        0.22  0.19  0.21
//   RIOT_SHIELD     0.33  0.41  0.27        0.23  0.22  0.19
//   PLATED_VEST     0.34  0.49  0.36        0.21  0.27  0.23
//   TOURNIQUET      0.34  0.42  0.37        0.20  0.23  0.20
//   REFLEX_WRAP     0.33  0.33  0.33        0.20  0.20  0.22
//   IRON_KNUCKLES   0.33  0.37  0.31        0.18  0.20  0.20
//   WAR_TROPHY      0.30  0.34  0.31        0.19  0.24  0.23
//
// EIGHT TRINKETS, ONE BAND. That flatness is the uniform draw printing itself. The two pieces
// that answer a damage type are not rarer than the six that do not - and they are not commoner
// when the squad needs them, because nothing in the game knows the squad needs them.
//
// SET THAT AGAINST WHAT THE SQUAD MEETS: after K02, 13% of the blows aimed at it are bio and
// 25% are energy, which at 150 expeditions means every single run meets both. It ends about one
// run in five holding an answer to either. THE CONTENT IS NOT MISTUNED. The Gas Mask's flat 10
// is worth 48% of a Censer Bearer's swing where the Choir first stands (suite 154 measures that
// off the engine); the trouble is that wanting it does nothing.
//
// WHY NO BALANCE CHANGE SHIPS HERE. The fix is small and obvious - let the Armory's GEAR row be
// picked from two or three, or weight the roll by what the run has actually been taking - and it
// is a design change to the one economy this phase has just proved it cannot measure. K06 found
// its answer and the limits of the instrument that would price the fix in the same phase, and
// that instrument says three careers cannot see ten wins. So the change is filed as K07 with the
// sample size it needs written on it, and what ships instead costs nothing to be wrong about:
// this record, the census, the correction to K02, suite 157, and the manual page - which listed
// all twenty-eight pieces under one sentence naming two of the four ways to get one, and now
// names all four and says the piece is rolled rather than chosen.
//
// WHAT WAS ADDED TO MEASURE IT, and stays: a gear ledger in equipGear (which pieces, which
// slots, per run), the `worn at the end` roster read, and a `--trinket <ID>` bench arm that
// fits the whole line with one piece at the muster. The ledger is a census and is trustworthy.
// The bench arm is a career sample and, at three careers, is not.

// ── K06: THE CAREER INSTRUMENT'S OWN NOISE, WHICH NOBODY EVER MEASURED ────────────
// STOP AND READ THIS BEFORE QUOTING A WIN RATE. Every balance phase in this file has judged an
// effect by the D17 rule - same direction across three careers AND complete separation of the
// ranges. That rule was never checked against the spread of the measurement it judges.
//
// THE SHORTEST FORM OF THE ANSWER is three careers run back to back on one tree, one invocation,
// one sitting, with nothing whatsoever between them:
//
//   55  42  48        wins of 150.  Thirteen wins of spread, from a machine told to do the
//                     same thing three times.
//
// Three careers cannot resolve thirteen wins, because three careers PRODUCE thirteen wins out of
// nothing. Every arm this file has ever compared was three careers.
//
// THE FULL SET, nine careers on one configuration. The middle arm is the trinket-bench control,
// the last is the arm above; both ran on this tree. The first is K05's max1 arm on the tree one
// commit back, whose diff carries no behavioural change - and the arm above, which shares K05's
// invocation and this tree, lands between the two, which is what a tree difference would not do.
//
//   K05 "max1" arm      56 53 52     mean 53.7
//   K06 "none" arm      39 43 42     mean 41.3
//   K06 verify arm      55 42 48     mean 48.3
//
// TWO OF THOSE ARMS SEPARATE COMPLETELY - 39-43 against 52-56, no overlap. That is the exact
// pattern this file has been reading as proof of an effect.
//
// AND IT IS NOT ONLY THE WIN COUNT. Every headline row, measured across those same nine careers,
// with the gap two arms of three can actually settle (three sd of the difference of their means):
//
//   row                   mean       sd of one   sd of an     settles a gap        observed
//                                      career    arm of 3       wider than          range
//   careers won of 150      47.8         6.4        3.7            16            39 to 56
//   reached sector 7        54.1         6.6        3.8            16            42 to 62
//   score, median         31,959       3,375      1,948          8,266      28.3k to 40.2k
//   lost for good          514.2        19.5       11.2             48          483 to 552
//   wipes per run           5.37        0.25       0.15            0.6        4.97 to 5.65
//   warlords felled         5.73        0.09       0.05           0.21         5.6 to 5.8
//
// The noise is not a defect to fix - 6.4 wins against a theoretical binomial sd of 5.7 at p=0.32
// says these careers behave like independent draws, and the only cure is more of them. To resolve
// a ten-win difference takes about SIX careers an arm, not three.
//
// AND THE ROWS ARE NOT INDEPENDENT, WHICH I07's ARITHMETIC ASSUMED THEY WERE. Correlation with
// the win count, across the same nine identical careers: reached sector 7 +0.94, score +0.54,
// wipes per run -0.51, lost for good -0.35, warlords felled +0.19. `reached sector 7` at +0.94 is
// not a second row, it is the win count wearing another label. So a run of separations all
// pointing one way is NOT the independent confirmation it reads as - it is one fact counted
// several times, and the multiple-comparisons correction I07 applied (seven rows, about 0.7
// spurious separations) is too generous rather than too strict. The control arm here demonstrates
// it: "none" sits lowest of the three on wins, on sector 7, on score AND on bosses felled - four
// rows moving together, on identical code.
//
// WHAT THIS COSTS, honestly:
//
//   TRUE NULLS ARE SAFE. A phase that claimed "the wall did not move" and showed overlapping
//   ranges was right for the right reason - K01 and K02's win rate among them.
//
//   K05'S CENTRAL CLAIM IS WITHDRAWN. "The widened bench costs ten wins uncapped and is neutral
//   capped at one" rested on max1 (53.7) against road6 (40.7). max1 has since re-measured at
//   41.3 and 48.3. The difference between those two arms is inside the noise, and the honest
//   state of that question is UNMEASURED rather than neutral. The catalogue is left in place -
//   pulling shipped content on evidence that has itself been shown unreliable is the same
//   mistake facing the other way - but its record no longer claims a wall reading.
//
//   I08 IS NOT A NULL AND IS NOT CLEAN. It read "wipes per run SEPARATES, roster worse" off
//   5.23/5.51/5.57 against 5.77/5.87/5.89. The ranges do separate, but against the floor
//   measured above that gap of 0.41 is 2.0 sd of an arm-mean difference - suggestive, under the
//   bar. Its win rate overlapped and was reported as overlapping. What survives untouched is the
//   pair of rows that are DIRECT consequences of the policy rather than downstream of it:
//   upgrades bought (47.9 against 61.1) and gear equipped (5.4 against 6.5, about 5 sd). So the
//   true reading of I08 is that opening the gate demonstrably buys more, and that it plays worse
//   for it is suggested rather than shown. `line` stays the default on the safe half of that.
//
//   K06'S OWN TRINKET ARMS ARE UNDER-POWERED and are not quoted as a finding. none 41.3 against
//   knuckles 55.7 and shield 56.7 looks large, and the no-effect arms above already spanned
//   12.4, so it is not safe at three careers. Filed, with the sample size it needs.
//
// AND THE FLOOR IS PRINTED NOW, on every career, under `runs that ended the road`. The row is
// the count every balance phase in this file quotes, and `what that count can resolve` sits
// directly beneath it with the sd of one career, the sd of a three-career arm mean, and the gap
// two such arms can actually settle. The lesson only holds if it is read at the same moment as
// the number. A note two thousand lines up would have been skipped by exactly the phases that
// needed it - which is how a rule from D17 survived every balance phase after it unexamined.
//
//   ANY SEPARATION THIS FILE CLAIMS AT THREE CAREERS should be checked against the table above
//   before it is quoted, and read as suggestive if it does not clear the `settles a gap wider
//   than` column. The rows that are NOT affected are the ones that count something directly
//   rather than averaging a career - blows by damage type, materials in and out, which augment
//   went in, how full a body ended up, which piece of gear was worn. Censuses, not samples.

const args = process.argv.slice(2);
const RUNS = Number(args.find(a => /^\d+$/.test(a))) || 60;
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const DIFFICULTY = Number(flag('difficulty', '1.0'));
const CONTRACTS = flag('contracts', '').split(',').filter(Boolean);
// The sim used to fight every node to a conclusion, which is one particular player and not the
// only one. With this on it also runs from fights it is losing, so the cost of leaving can be
// measured against the cost of staying. `--withdraw off` is the old behaviour, for comparison.
const WITHDRAW_POLICY = flag('withdraw', 'on') !== 'off';
// The draft policy was hardcoded to a front-liner, usually a medic, and one other - which meant
// "which classes get deployed" reported that policy back rather than anything about the game.
// `--draft random` fields three drawn flat from the roster; `--draft only:PYROMANIAC` forces one
// class into the line and rolls the rest. The cost of an unusual squad is the number doctrines
// have to be priced against, and it cannot be read off a policy that never fields one.
// `--draft doctrine` takes one of the three offered and builds a line that keeps it, which is
// what a player with a free multiplier on the table actually does. It is not the default: the
// default is left alone so runs measured before doctrines existed stay comparable.
const DRAFT = flag('draft', 'line');
// The bench holds a job for the expedition and this file never gave one out, so a lever a real
// player can take for free at the muster - QUARTERMASTER for one more material a salvage, FIELD
// MEDIC for a camp that heals for more, SCOUT so the route does not close behind you - has
// never been measured. `off` is the old behaviour, for comparison; SCOUT is the one D10 cares
// about, since availableNodeIds() already special-cases it and needs nothing else wired in.
const BENCH = flag('bench', 'off');
// Momentum has three tactics and this simulator only ever bought one of them: spendTactic was
// called exactly once in the whole file, always with STIM, and the strings FOCUS and PRESS did
// not appear at all. So "a third of every action was STIM" was this policy reporting itself
// back. `--tactics focus|press|none|smart` buys something else, so the shelf can be compared
// rather than assumed. `stim` is the old behaviour and stays the default.
const TACTICS = flag('tactics', 'stim');
// `--augments off` measures the materials economy the way this file used to see it: consumables
// only, with the permanent upgrades it never installed left on the shelf.
// K05: `on` is the greedy scan this file has always used - first affordable row in table order,
// which means every augment figure in this repo has described the TABLE'S ORDER and the material
// prices rather than any preference. That was invisible while all three rows were flat stat
// bumps; it stops being invisible the moment some of them are situational. `road` is a policy
// that actually chooses: the front rank buys hide, the back rank buys output, and the third slot
// answers whatever the run has been walking into. `off` installs nothing, as before.
// K05: `road` is the DEFAULT now and `on` is the old greedy scan, kept for comparison. The
// greedy scan takes the first affordable row in table order, which cannot reach the second half
// of the bench at all - verified, not assumed: --augcat 3 and --augcat 6 install identical sets
// under it. A default that cannot see half the content it is measuring is not a default. Both
// halves of the swap were measured against the greedy baseline over three 150-expedition careers
// and both came back neutral; the record above the argument list has the rows.
const AUGMENT_POLICY = flag('augments', 'road');
const AUGMENTS_ON = AUGMENT_POLICY !== 'off';
// K05: how many rows of the bench the simulated player is allowed to consider, counted from the
// top of AUGMENTS. The game's table is untouched - this exists so the CATALOGUE and the POLICY
// can be separated in a measurement, because changing both at once and reading one number is
// how a harness change gets attributed to the game. `--augcat 3` is the bench as it stood
// before this phase, driven by whichever policy is asked for.
const AUGMENT_CAT = Math.max(1, Number(flag('augcat', '99')) || 99);
// K05: how many SITUATIONAL rows one body is allowed. The `road` policy puts the answers second
// in the front rank's order, so a front-liner fills two of its three slots with them - and the
// first measurement of the widened bench cannot tell "the content is a trap" from "this policy
// buys too much of it". This is the arm that separates them: `--augmax 1` is a player who takes
// at most one answer and spends the rest on stats.
// It defaults to one situational row a body. K05 set that default off a career arm reading "at
// one the widened bench is neutral on every row; at two or more it costs ten wins and eight
// points of depth", and K06 withdrew that arm as inside the instrument's own noise - so the
// default now rests on the mechanism rather than the number. The mechanism is a census: a flat
// resistance pays only on the blows of its own type, 13% of incoming for bio and 25% for energy,
// while a bar or a swing pays on all of them, so each further answer displaces a better flat
// option than the last did. One is the cautious default in the direction the mechanism points.
// Whether it is the right one is UNMEASURED; see the K06 record and the arm it asks for.
const AUGMENT_MAX = Math.max(0, Number(flag('augmax', '1')));
// K07: how many of the Armory's gear rows this file lets itself look at. The engine lays out
// SHELF_GEAR of them and sells one; `--shelf 1` looks at the leftmost only, which is
// distributionally the pre-K07 shelf - one piece drawn uniformly from what the run does not
// already hold. Same trick as --augcat: the game's table is untouched, so the CATALOGUE change
// and the POLICY change below can be read apart instead of landing in one number together.
const SHELF_SEE = Math.max(1, Number(flag('shelf', '99')) || 99);
// And WHICH of the rows it looks at gets bought. `first` is the leftmost - no preference, which
// is what this file has always had and what the pre-K07 shelf could only give. `answer` takes
// whichever piece answers what has actually been landing on the squad. That is a BENCH POLICY
// rather than a model of play: it spends the slot on mitigation every time it can, so the pair
// reads as a floor and a ceiling on what K07 made reachable rather than as a person's judgement.
const SHOP_PICK = flag('shoppick', 'first');
// K06: `--trinket RIOT_SHIELD` fits the whole line with that piece at every muster, so what the
// trinket slot is worth can be asked without the drop rate answering first. Off by default; this
// is a bench test for a measurement, not a player anybody has.
const TRINKET_ARM = flag('trinket', '');
// A sim that never walks out measures a game with one ending. `--extract N` gives it the
// player who leaves once the run is worth banking: from sector N on, it takes the camp's door
// when the squad is worn down. `off` (the default) is the old behaviour, for comparison.
const EXTRACT_RAW = flag('extract', 'off');
const EXTRACT_AT = EXTRACT_RAW === 'off' ? 99 : Number(EXTRACT_RAW);
// What a run does when it reaches the end of the road. 'walk' takes the ending and stops,
// which is what the feature is for; 'press' declines it and carries on into the post-game, so
// the endless half of the game can still be measured.
const ENDING = flag('ending', 'walk');
// Which order the expedition signs for. 'long' is the whole road, which is what every run did
// before orders existed, so it stays the default and the older figures stay comparable.
const ORDER = flag('order', 'long').toUpperCase();
// `--rung N` deploys every expedition at ascension rung N. The ladder is meant to be climbed
// by clearing it, so the sim skips the climb and sets the rung directly - the question it can
// answer is "what does rung N do to the win rate", not "can this policy climb".
const RUNG = Math.max(0, Number(flag('rung', '0')) || 0);
// G02: the last fight nothing measures. The Ossuary sits at the top of sector 7, is not in the
// rotation that holds the road, and is never dealt at any other depth. G01 measured 0 of 150
// runs reaching it while the same 150 saw 1102 fights against the seven warlords below it, and
// G13 then established that the gap is not this file's play: every obvious lever together moves
// the win rate from about 1.5% to about 3%, not to 15%. So the road will not be walked to the
// end often enough to measure what is standing there, and a longer sample buys nothing.
//
// `--stage N` starts an expedition at the TOP OF THE ROAD INTO sector N, carrying what a squad
// that got there was measured to carry. It does not stage the boss fight - it stages the
// ARRIVAL, and the sector is then played the ordinary way, so whatever state the squad is in
// when it reaches the commander is a state the game produced rather than one this file invented.
//
// The profile is measured, not chosen. 150 expeditions on the default policy, snapshotting every
// deployed line at the moment it crossed into a sector:
//
//   sector   reached   line  lvl  maxHp  dmg  hp%   roster  relics  gear  scrap  regroups
//     2      144/150     3    6    110    33  100      7       4      1     181      5
//     3       91/150     3    7    130    41  100      7       7      2     348      4
//     4       50/150     3    9    147    46  100      7       9      2     662      4
//     5       26/150     3   10    165    47  100      6      13      3     897      3
//     6       10/150     3   11    173    50  100      6      15      3    1515      5
//     7        6/150     3   13    201    54  100      5      15      3    2228      2
//
// Read the caveats with it. Sector 7's row rests on six runs, which is why staging is validated
// at sector 5 (n=26) rather than trusted at 7 - see the check in the header below. The hp% column
// is 100 at every depth and every sample size, so a staged squad arrives whole; that is taken as
// measured rather than explained, because crossSector itself does not heal and the mechanism was
// not chased. `perks 0` is not a gap: this policy spends a perk point the moment it is awarded.
const STAGE = Math.max(0, Number(flag('stage', '0')) || 0);
// H02 feasibility, MEASUREMENT ONLY - nothing in the game offers this yet. The Reckoning is a
// commander fought with its late-fight behaviour from turn one rather than with bigger numbers:
// GRUDGE.cap carries the comment "a wall you cannot pass is not a nemesis", so raising the stat
// bands is out by the codebase's own stated principle. What is not capped is TIMING - the grudge
// phase only opens under a quarter health. `--reckoning` opens it at the bell so the fight can be
// priced before anything is built. A reckoning nobody survives is a trap; one nobody loses is a
// button; the number worth knowing is where between those it lands.
const RECKONING = flag('reckoning', 'off') !== 'off';
// What a squad had on arrival, by sector, from the table above. Levels and relic counts are
// applied through the engine's own doors - awardXp and the relic pool - rather than written onto
// the operators, because every hand copy this file has ever kept has drifted from the engine it
// copied (E01b, F02, G04, G06 all began that way).
const STAGE_PROFILE = {
  2: { lvl: 6,  maxHp: 110, dmg: 33, relics: 4,  gear: 1, scrap: 181,  regroups: 5, roster: 7 },
  3: { lvl: 7,  maxHp: 130, dmg: 41, relics: 7,  gear: 2, scrap: 348,  regroups: 4, roster: 7 },
  4: { lvl: 9,  maxHp: 147, dmg: 46, relics: 9,  gear: 2, scrap: 662,  regroups: 4, roster: 7 },
  5: { lvl: 10, maxHp: 165, dmg: 47, relics: 13, gear: 3, scrap: 897,  regroups: 3, roster: 6 },
  6: { lvl: 11, maxHp: 173, dmg: 50, relics: 15, gear: 3, scrap: 1515, regroups: 5, roster: 6 },
  7: { lvl: 13, maxHp: 201, dmg: 54, relics: 15, gear: 3, scrap: 2228, regroups: 2, roster: 5 }
};
// A commander's offer deals three cards and sometimes one of them is cursed. This file took
// `offer.find(RARE) || offer[0]`, which is two opinions dressed as one: prefer a rare, and
// otherwise take whatever happens to sit first. "Cursed relics are refused" was that policy
// reporting itself back, not a player declining anything - and once the curse moved into the
// first slot the same policy started taking nearly all of them, which is no more a measurement
// than the zero was. So the fallback picks at random now: no opinion between a common and a
// curse, which is the only honest default.
//
// The range is what carries meaning, so both ends are nameable:
//   --relics avoid   never takes a curse while any other card is on the table  (the floor)
//   --relics rare    prefers a rare, otherwise picks blind                     (neutral)
//   --relics random  picks blind always
//   --relics curse   takes the curse every time one is offered                 (the ceiling)
const RELICS = flag('relics', 'rare');
// Meta is never reset between expeditions here, and grudges are meta. So a sixty-run sample is
// one continuous career: the sim fells the sector-1 commander in run 1 and meets it Risen in
// run 2, capped Thrice-Risen soon after - +60% health, +36% damage, +12 armour. Measured, mean
// depth falls 3.45 -> 2.90 -> 2.30 across the thirds while grudge sits pinned at the cap, so a
// single averaged figure blends a first encounter with a nemesis and reports neither.
//
// Both games are real and they are different games. `--meta carry` (the default) is a returning
// player's arc, skulls and Citadel upgrades accumulating against grudges that accumulate back.
// `--meta fresh` wipes the ledger between runs: sixty independent first careers, which is what
// a question about the game a player actually meets has to be asked against.
const META = flag('meta', 'carry');
// Event choices were picked uniformly at random, and standing with the four faces moves only
// through those choices - so "standing barely moves across a run (-1.0 to +0.6)" was a random
// walk by construction, not a reading about the game. It cascades: five of the six follow-up
// threads gate on |standing| >= 2 with one face, so a walk that averages to zero never opens
// them, and "two of six never appeared in sixty runs" follows from the same coin.
//
// A player is not a coin. They help the tinker because they want the tinker to like them, or
// they rob the scavenger because they want the scrap. `--faces warm` takes the choice that
// raises standing with whoever is across the table, `cold` takes the one that lowers it, and
// `random` is the old behaviour. Warm and cold bracket a real player between them.
//
// Which choice is which is read off the game's own source - the noteCast call inside each
// choice's execute - rather than encoded here, so a reworded event cannot leave this file
// preferring a choice that no longer does what it used to.
const FACES = flag('faces', 'warm');

// H03. What the shelf is spent on, with the shelf itself held constant. The corrected ledger
// says a career spends 90% of its skulls (263 earned over forty carried runs: 74 to the Citadel,
// 162 to the shelf, 27 left on hand) and that depth does not move with them - 3.46 / 3.38 / 3.44
// across the thirds. Every item on the shelf was variance (a reroll), difficulty asked for (a
// grudge), or harder content on credit (a rung); none of them made the squad stronger. So the
// question is not "would a bigger shelf help" but "does a capability item beat what the same
// skulls buy today", and the only honest way to ask it is two arms against one build, differing
// in nothing but the order the purse is spent in.
//
// `--reqpolicy rerolls` (the default, and what every prior sample ran) buys fresh faces up to the
// cap, then a grudge with skulls to burn. `--reqpolicy fallback` buys ONE MORE FALLBACK first and
// takes whatever rerolls the remainder still affords. The purse is the same purse either way,
// which is the point: at ~6.6 skulls a run the capability is bought instead of the variance, not
// on top of it.
const REQPOLICY = flag('reqpolicy', 'rerolls');
// H05. Going down happens ~23 times a run and the brief reads 87% of every rescue as one button.
// Before believing that about the game, it has to be ruled out about the robot: this file spends
// the momentum bar in the tactic block and only consults the bag and the medic's hands
// afterwards, so the STIM tactic has always had first refusal. `--rescue hands` reverses that
// order and changes nothing else.
const RESCUE = flag('rescue', 'bar');
// H09. The order is signed at the muster and, measured across all three at 100 runs each, every
// step up the ladder lowers the expected score - SORTIE 35% kept / 21,265, PATROL 12% / 19,648,
// THE LONG ROAD 0% / 17,666. Signing long is strictly worse, so the menu is a trap rather than a
// choice. `--resign on` (the default now) lets a worn squad cut the order down at a camp;
// `--resign off` is the behaviour every prior sample ran under.
const RESIGN = flag('resign', 'on');
// I03: whether the recruit policy has any taste. `price` is the rule this file has always used -
// sign anything the purse can reach and keep the reserve - and is the default, so every figure
// printed before this stays comparable. `value` weighs the card against the line and can
// therefore decline one it could afford, which is the thing H10 said had to exist before "the
// offer is not compelling" could be asked in either direction.
// `burn` is a diagnostic arm rather than a player: it declines exactly what `value` declines and
// then takes the money anyway. I03 found declining wipes less and could not say why - a recruit
// arrives at 60% of their bar carrying none of the squad's bought upgrades, AND the ~200 scrap
// stays in a purse H14 showed the Outpost is the best use of. Those two channels are confounded
// in `value`; this separates them. If burn keeps value's wipe rate, the body was the drag. If it
// falls back to price's, the money was the gain.
const RECRUIT = flag('recruit', 'price');
// I08: EVERY WAY A BODY IMPROVES IN THIS FILE IS GATED ON gridPos > 0 - stat upgrades, gear
// out of the stash, and augments, all three. The game gates none of them: renderOutpost walks
// playerRoster unfiltered and canUpg is `scrap >= cost`, nothing more. Perk points are the one
// channel this file already spends roster-wide, which is also what the engine does.
//
// Line-only investment is a defensible player policy by itself. Held next to this file's OWN
// fielding rule - field the recruit if it out-rates the worst hand on the line - it is not a
// policy but a deadlock: a recruit is benched because it has not accumulated, and can never
// accumulate because it is benched. `--invest roster` opens all three gates to every living
// operator, which is the affordance the game actually offers. It is not a free win: the purse
// and the materials are the same and now spread over ten bodies instead of three, so the line
// itself is thinner. `line` is the old behaviour and stays the default so the tables above
// remain comparable.
const INVEST = flag('invest', 'line');

// The three games this file can measure, and why the difference is the whole story:
//
//                              median sector   mean / p90   commanders felled
//   --meta carry, skulls unspent      2          2.9 / 6           1.88
//   --meta fresh                      4          4.1 / 7           3.08
//   --meta carry, skulls spent        6          5.5 / 9           4.55
//
// The first row is what this file reported for its whole life, and it is not a game anybody
// plays. Grudges are meta and were carried, so the commanders escalated permanently to capped
// Thrice-Risen (+60% health, +36% damage, +12 armour) - while buyMetaUpgrade was called nowhere
// at all, so the player's half of that exchange never happened. Skulls piled up unspent: no
// barracks, no bigger bag, no extra fallback. A handicap match, and every "the wall is too
// close" reading came off it.
//
// Played properly, depth climbs across a career - 4.00 / 5.00 / 7.13 by thirds, with grudge
// climbing 1.35 / 2.67 / 3.00 underneath it - and the last third lands at mean sector 7.1,
// p90 9. The engine's stated target is "a run reliably ends somewhere around sector 10", so
// the curve is doing what it was built to do, and the grudge ramp is a counterweight the
// player out-paces rather than a wall.
//
// What this file measured about depth, before the player below could read a board:
//
//   player                                 median sector   nodes   ended
//   random ability, always at foes[0]            2           49    wiped 60/60
//   reads the board (below)                      2           50    wiped 60/60
//   reads the board, and the tactic shelf too    2           50    wiped 60/60
//
// Three materially different players, one wall. Move selection reshaped hard - HEAVY_WRENCH
// 3.9% to 7.0% of all actions, CAUTERIZE 3.3 to 6.5, FLASHBANG 2.0 to 4.5, DEADEYE 1.1 to 2.5
// as specials stopped losing coin flips to basic attacks - and depth did not move at all. So
// the wall is not a readout of this file's play, which is the one thing that had to be ruled
// out before anything was concluded from it.
//
// I07: those four shares are all starting-seven moves, and the bug it audits suppressed every
// one of them by 6-30% in absolute terms. THE COMPARISON HERE IS UNHARMED - both arms were read
// through the same lens, and the conclusion is that the gap between them does not reach depth -
// but do not carry 7.0% or 6.5% forward as what the move is worth. Re-measure if you need the level.
//
// Where it actually sits: wipes by tier read t8:7 t9:7 t10:238. The commander at tier 10 takes
// 92% of every wipe in the run, and the nine tiers under it produced 20 across sixty runs.
//
// Runs one expedition inside the page. Plays to a real conclusion: the squad wipes out of
// regroups, or the safety cap is hit.
const EXPEDITION = ({ difficulty, contracts, capNodes, withdrawPolicy, EXTRACT_AT, draftPolicy, benchPolicy, tacticPolicy, AUGMENTS_ON, augPolicy, augCat, augMax, shelfSee, shopPick, trinketArm, relicPolicy, metaPolicy, facePolicy, endingPolicy, orderPolicy, rungPolicy, stagePolicy, stageProfile, reckoning, reqPolicy, rescuePolicy, resignPolicy, recruitPolicy, investPolicy }) => {
  // I08: who this file is willing to spend on. `line` is what it has always done - upgrades,
  // gear and augments all gated on gridPos > 0. `roster` is the gate the game has, which is
  // only that the body is alive. Named once so all three sites read the same rule.
  const invests = c => (investPolicy === 'roster' ? c.hp > 0 : c.gridPos > 0);
  // The same rating the recruit decision uses, named once so the Outpost and the road cannot
  // drift apart. Damage is what an operator does every turn, health is how many turns they get,
  // and at these magnitudes a point of damage is worth roughly four of health. A stated policy,
  // not a truth - and it sees no perk, augment or trinket that does not land on these two.
  const rateOf = c => c.dmgBase + c.maxHp / 4;
  const stat = { order: null, fulfilled: false, won: false, wonAt: 0, roadWarlords: 0, raised: 0, stillUp: 0, tallyAtEnd: 0,
                 upgrades: 0, odAimed: 0, bossTopUps: 0, eliteTopUps: 0, reqBought: 0, reqGrudge: null, reqFallback: 0, regroupsHad: 0,
                 engineKills: 0, killGap: 0,
                 sector: 1, tier: 1, nodes: 0, fights: 0, rounds: 0, kills: 0, deployed: [],
                 wipedInSector: [], wipedAtTier: [], wipedOnElite: [],
                 wipes: 0, withdrawals: 0, facesMet: {}, threads: [], standings: {}, field: {}, settled: {}, posted: null, regroupsSpent: 0, bosses: 0, elites: 0, events: 0, camps: 0,
                 moves: {}, items: {}, relics: [], bountiesDone: 0, consequences: 0, crafted: 0,
                 affixes: {}, champions: 0, eliteUnits: 0, affixedUnits: 0,
                 promotions: 0, promoEmpty: 0, held: 0, turnsPlayer: 0, sigsTaken: 0, sigsBought: 0, capsTaken: 0, capsBought: 0, gearEquipped: 0, shops: 0, shopScrap: 0, sigsFaced: {},
                 maxBond: 0, bondSaves: 0, frontsSeen: [],
                 endedBy: 'cap', score: 0, contractMult: 1, recruited: [], recruitOffers: [], saves: 0, downs: 0, lost: [], bossMet: [],
                 extracted: false, walkedAt: 0, formations: {}, factionFights: {}, loose: 0, doctrine: null, doctrineKept: false,
                 benchHeld: null,
                 booked: 0, bookedKinds: {}, augments: 0,
                 offeredNodes: {}, takenNodes: {}, forks: 0, forksWithChoice: 0, forksAllFights: 0,
                 cachesMet: 0, cachesClean: 0, cachesForced: 0, cacheScrap: 0, cacheLocks: {}, cacheOpener: {},
                 bookedFrom: {},
                 tookNonFight: 0, evOptions: 0, evBookable: 0, evCouldBook: 0,
                 evShown: 0, evPriced: 0, evPricedTook: 0, pricedBySector: {},
                 retreatOpen: 0, retreatAfford: 0, retreatAsked: [], retreatPurse: [], retreatBySector: {},
                 recruitWhy: {}, recruitBurned: 0, recruitFielded: 0, recruitBenched: 0, reslotted: 0, reslottedRecruit: 0,
                 fieldGap: [], fieldUps: [], fieldMine: [],
                 relicOffers: 0, cursedOffered: 0, cursedTaken: 0, cacheOffered: 0, cacheTaken: 0,
                 bossGrudge: [], metGrudge: [], scars: [], recovered: 0, clockLeft: [], downFaced: 0, downReach: 0, downByMove: 0, downByItem: 0, downByBar: 0, barSaves: 0, bagSaves: 0, handSaves: 0 };

  // Skulls were banked and never spent: buyMetaUpgrade was called nowhere in this file. So the
  // carried sample escalated the commanders permanently - grudges are meta - while switching
  // the player's half of that exchange off entirely. No Citadel upgrades, no extra fallback, no
  // bigger bag, no start scrap; skulls just piled up. That is not a career, it is a handicap
  // match, and every depth figure taken from a carried run sat on it.
  //
  // Three of the Citadel's buildings carry no max - SCRAP CRANE, BARRACKS, FALLBACK BUNKER -
  // so any greedy ordering degenerates into one building, and each attempt proved it. Preferring
  // the FALLBACK BUNKER stacked unlimited retries and runs stopped ending: the sample was still
  // on expedition 20 after twenty minutes. Cheapest-first then bought SCRAP CRANE to level 327
  // and nothing else at all, which is +16,350 starting scrap and no barracks, no bag, no
  // fallback.
  //
  // So: breadth-first. Lowest level anywhere on the hillside, ties to the cheaper. That fills
  // the Citadel out the way a player does - a bit of everything, unlocking what is gated -
  // instead of pouring a career into one wall.
  const spendSkulls = () => {
    let guard = 0;
    while (guard++ < 60) {
      const sp = CITADEL_SPOTS.filter(o => !spotMaxed(o) && spotUnlocked(o) && bossSkulls >= o.cost)
                              .sort((a, b) => (a.level() - b.level()) || (a.cost - b.cost))[0];
      if (!sp) break;
      const before = bossSkulls;
      { const b4 = bossSkulls; buyMetaUpgrade(sp.kind);
        const d = Math.max(0, b4 - bossSkulls);
        if (window.__sk) { window.__sk.meta += d; window.__sk.runSpent += d; } }
      if (bossSkulls === before) break;
    }
    // F04: and the shelf above the cap, which is where a career's skulls go once the hillside
    // is full. Measured before it existed: 1,136 / 1,160 / 1,117 left unspent at the end of
    // three samples of 150, with every buyable spot bought.
    //
    // FRESH FACES first: cheap, strictly an improvement, and the thing a player buys without
    // thinking. A GRUDGE CALLED IN only with skulls to burn, because it makes the first
    // commander harder in exchange for what it pays - a purse that is not deep has better uses.
    //
    // A RUNG ON CREDIT is deliberately NOT bought here. The --rung flag opens the ladder
    // directly, so buying the rung would be paying for something the flag already grants; and
    // under the default --rung 0 it would be skulls thrown at a ladder this policy will not
    // climb. Suite 112 drives that purchase instead.
    if (typeof buyRequisition === 'function') {
      const reqBefore = bossSkulls;
      // H03: ONE MORE FALLBACK goes first when this arm is buying it, because a purse that has
      // already gone on rerolls cannot reach it - three rerolls is six skulls and so is the
      // fallback. Buying it last would be a policy that never buys it, and would read as a null
      // about the item rather than about the ordering.
      if (reqPolicy === 'fallback' && typeof REQ_FALLBACK_COST === 'number'
          && reqOpen('FALLBACK') && bossSkulls >= reqCost('FALLBACK')) {
        if (buyRequisition('FALLBACK')) { stat.reqBought++; stat.reqFallback++; }
      }
      let g = 0;
      while (g++ < 6 && reqOpen('REROLL') && bossSkulls >= reqCost('REROLL')) {
        if (!buyRequisition('REROLL')) break;
        stat.reqBought++;
      }
      const owed = BOSS_ROTATION.filter(b => grudgeOn(b.id) > 0)
                                .sort((a, b) => grudgeOn(b.id) - grudgeOn(a.id))[0];
      if (owed && reqOpen('GRUDGE', owed.id) && bossSkulls >= reqCost('GRUDGE', owed.id) * 4) {
        if (buyRequisition('GRUDGE', owed.id)) { stat.reqBought++; stat.reqGrudge = owed.id; }
      }
      const d = Math.max(0, reqBefore - bossSkulls);
      if (window.__sk) { window.__sk.req += d; window.__sk.runSpent += d; }
    }
  };

  activeContracts = [...contracts];
  currentSlot = 1;
  // Set before confirmNewGame, which is where newRunStats reads it onto the run.
  if (orderById(orderPolicy)) activeOrder = orderPolicy;
  if (metaPolicy !== 'fresh') spendSkulls();
  if (metaPolicy === 'fresh') {
    // Written out against the real shape rather than mapped over the keys: startLevel is 1 and
    // invMax is 4 at a fresh install, and zeroing every number would quietly deploy level-zero
    // operators with no bag and report that as difficulty.
    grudges = {}; bossSkulls = 0; mastery = {}; bestiary = {};
    metaUpgrades = { startScrap: 0, startLevel: 1, invMax: 4, extraRegroups: 0, vault: 0,
                     heirloom: null, heirloomWalked: false,
                     rerolls: 0, discount: 0, archive: 0, warRoom: 0, cache: 0,
                     // The upstairs, which a fresh career has not earned either.
                     chapel: 0, footlocker: 0, locker: null, roadCrew: 0 };
    careerWins = 0; bestRung = 0;
    saveMeta();
  }
  // After the wipe, not before: the fresh path zeroes careerWins, and a rung set ahead of it
  // would deploy against a ladder the same block had just torn down. Before confirmNewGame,
  // which is where newRunStats reads the rung onto the run.
  if (rungPolicy > 0) {
    careerWins = Math.max(careerWins, 1);
    bestRung = Math.max(bestRung, rungPolicy);
  }
  ascension = Math.min(rungPolicy, PROTOCOLS.length);
  confirmNewGame(difficulty);
  stat.contractMult = runStats.contractMult;
  stat.frontsSeen.push(sectorFront);

  // The template deploys the same three operators every time, so a sim that leaves the formation
  // alone measures three classes and reports the other four as dead content. A player rotates the
  // roster; so does this.
  // A player fields a line, not a lottery: someone to hold the front, usually a medic, and
  // whoever else. The old shuffle regularly deployed three glass cannons and measured the
  // resulting deaths as difficulty.
  const slots = hasContract('SHORT_HANDED') ? [1, 2] : [1, 2, 3];
  playerRoster.forEach(p => { p.gridPos = 0; });
  const byClass = c => playerRoster.filter(p => c.includes(p.classType));
  const pickFrom = list => list[Math.floor(Math.random() * list.length)];
  const draft = [];
  let wantDoctrine = null;   // aimed at while drafting; banked below, once ranks are real
  if (draftPolicy === 'random') {
    // No shape at all: whatever the roster hands you. This is the floor.
  } else if (draftPolicy.startsWith('doctrine:')) {
    // One named doctrine, every run, so a pool average cannot hide a single expensive one.
    const want = draftPolicy.slice(9);
    const d = doctrineById(want);
    if (d) {
      doctrineOffer = [want];
      const shuffled = [...playerRoster].sort(() => Math.random() - 0.5);
      shuffled.forEach(c => { if (draft.length < slots.length && d.holds([...draft, c])) draft.push(c); });
      wantDoctrine = want;
    }
  } else if (draftPolicy === 'doctrine' && doctrineOffer.length) {
    // G13: a doctrine is a predicate on the WHOLE line, and this used to build the line one
    // legal member at a time - asking holds() of every prefix. Two of the seven cannot be true
    // of a prefix at all. BROAD SPECTRUM wants all three damage types across the line, which no
    // single operator covers. THE WALL is worse: it asks who is holding rank 1, and the ranks
    // are not handed out until after the draft, so during the build every candidate reads
    // gridPos 0 and the answer is always no. The comment forty lines down already knew this -
    // the doctrine BANKING step was moved below the draft for exactly that reason - and the
    // draft policy kept doing it anyway.
    //
    // The failure was silent and total. `legal` came back empty on the first pass, the loop
    // broke with `draft` still empty, `draft.forEach(...gridPos...)` was a no-op, and the run
    // played out with NOBODY STANDING. Measured before the fix: 3 of 7 doctrines rejected every
    // single-member line, and 19 of 50 runs on this policy hit a node with an empty line.
    //
    // So: build the whole line first, place it, then ask. Ordering matters because THE WALL
    // reads rank 1, so this walks ordered selections rather than combinations - 7 take 3 is 210
    // of them, once per run.
    const want = doctrineOffer[Math.floor(Math.random() * doctrineOffer.length)];
    const d = doctrineById(want);
    const place = line => { playerRoster.forEach(p => { p.gridPos = 0; });
                            line.forEach((p, i) => { p.gridPos = slots[i]; }); };
    const ordered = (pool, k) => k === 0 ? [[]]
      : pool.flatMap((c, i) => ordered(pool.filter((_, j) => j !== i), k - 1).map(rest => [c, ...rest]));
    const cands = ordered(playerRoster, Math.min(slots.length, playerRoster.length))
      .sort(() => Math.random() - 0.5);
    let held = null;
    for (const cand of cands) { place(cand); if (d.holds(cand)) { held = cand; break; } }
    playerRoster.forEach(p => { p.gridPos = 0; });   // the tail below does the real placing
    if (held) { draft.push(...held); wantDoctrine = want; }
    // Nothing this roster can field keeps it. Recorded rather than swallowed, and the line is
    // drafted the ordinary way so the run is still a run.
    else { stat.doctrineUnfieldable = want; }
  } else if (draftPolicy.startsWith('only:')) {
    const want = draftPolicy.slice(5);
    const one = byClass([want])[0];
    if (one) draft.push(one);
  } else {
    draft.push(pickFrom(byClass(['BRUISER', 'SHOTGUNNER'])));
    if (slots.length > 2 && Math.random() < 0.7) draft.push(pickFrom(byClass(['MEDIC'])));
  }
  while (draft.length < slots.length) {
    const rest = playerRoster.filter(p => !draft.includes(p));
    const d = doctrineById(wantDoctrine);
    const legal = d ? rest.filter(c => d.holds([...draft, c])) : rest;
    if (!legal.length) break;
    draft.push(pickFrom(legal));
  }
  draft.forEach((p, i) => { p.gridPos = slots[i]; });
  // G13: what the draft actually fielded, read back off the roster rather than off the policy's
  // own intentions. A policy that silently fields nobody is what this phase went looking for a
  // balance answer and found instead - the run still ran, still reported depth and score and a
  // win rate, and every one of those numbers described a squad that was not there.
  stat.lineSize = deployedLine().length;
  // Whoever is left is on the bench and eligible for the job the flag asks for. Any of the
  // roster still at gridPos 0 will do - the job holds only while its holder stays benched,
  // which this policy never deploys them out of on purpose.
  if (benchPolicy !== 'off') {
    const jobId = { scout: 'SCOUT', quartermaster: 'QUARTERMASTER', medic: 'MEDIC' }[benchPolicy];
    const holder = playerRoster.find(p => p.gridPos === 0);
    if (jobId && holder) takeBenchJob(holder.id, jobId);
    // G13: read back what the ENGINE holds rather than what the flag asked for. The job is the
    // one policy lever this file could not see in its own output, so `--bench scout` silently
    // doing nothing - no benched roster member, a renamed job id, a refused call - would have
    // reported itself as taken for as long as anybody cared to look.
    stat.benchHeld = benchJob ? benchJob.job : null;
  }
  // Banked here rather than during the draft, because a doctrine can ask about the SHAPE of the
  // line and not only its membership - THE WALL wants to know who is holding rank 1, and nobody
  // is standing anywhere until the line above. Asking earlier answered no for every such rule.
  {
    const standing = playerRoster.filter(p => p.gridPos > 0);
    let take = null;
    if (wantDoctrine) { const d = doctrineById(wantDoctrine); if (d && d.holds(standing)) take = wantDoctrine; }
    // And a player who is not building AROUND a doctrine still reads the three offers and takes
    // one their line already keeps. Without this the default policy had no branch that could
    // take a doctrine at all, so "zero taken across 24 expeditions" was guaranteed by this file
    // rather than measured from the game - the same shape of hole D07 found four moves in.
    if (!take && draftPolicy !== 'random') {
      take = doctrineOffer.find(id => { const d = doctrineById(id); return d && d.holds(standing); }) || null;
    }
    if (take) { activeDoctrine = take; stat.doctrine = take; }
    stat.doctrineOffered = doctrineOffer.slice();
    stat.doctrineLive = doctrineOffer.filter(id => { const d = doctrineById(id); return d && d.holds(standing); });
  }
  // The real deploy button is what applies a doctrine's edge and banks its multiplier, so the
  // sim goes through it rather than around it.
  musterDeploy();
  // K06: a BENCH TEST, not a policy. Every source of gear in the game is rollGear(), a uniform
  // draw over the unowned pool - the elite drop, the commander drop, an event, and the Armory's
  // single gear slot - so a player cannot seek a particular piece and the drop rate swamps any
  // question about what a piece is WORTH. This puts the named trinket on every deployed operator
  // at the muster, through the game's own equipGear so apply() runs and the ledger books it, and
  // that takes the rarity out of the measurement: what is left is the slot.
  if (trinketArm && gearById(trinketArm)) {
    playerRoster.filter(c => c.gridPos > 0).forEach(c => {
      if (c.trinket) return;
      gearStash.push(trinketArm);
      equipGear(c.id, trinketArm);
    });
  }
  // H03: the file reported skulls LEFT and never skulls EARNED, so "42 unspent" had no
  // denominator and could be read as a surplus or as a rounding error. Counting it needs care:
  // skulls are spent BEFORE a run (requisitions) and DURING it (the Citadel), so the net rise
  // across an expedition understates income by exactly what was spent. Income is therefore
  // derived - (end - start) + spent - rather than sampled, which is what made the first attempt
  // report 366% of income spent.
  // K05: which augment this operator wants, in order. Read off two things the run already
  // knows: where they stand, and what has actually been landing on the squad - K02's damage-type
  // ledger, rather than a guess about the road. A situational augment is worth its size times how
  // often the thing it answers turns up, so that product is what orders them; the flat rows sit
  // where the rank puts them. This is a POLICY, not a rule of the game: it exists so the
  // instrument can express a preference at all, because the greedy scan never could.
  window.__augWants = c => {
    const bag = (runStats && runStats.dt && runStats.dt.atSquad) || {};
    const hits = t => (bag[t] || {}).hits || 0;
    const seen = ['phys', 'bio', 'energy'].reduce((a, t) => a + hits(t), 0) || 1;
    const answers = AUGMENTS.slice(0, augCat).filter(a => a.answers)
      .map(a => ({ id: a.id, worth: (hits(a.answers.type) / seen) * a.answers.by }))
      .sort((x, y) => y.worth - x.worth).map(x => x.id);
    // The front rank is where the blows are taken; everyone behind it is there to end the fight.
    return c.gridPos === 1
      ? ['PLATING', ...answers, 'OPTICS', 'PUMP']
      : ['OPTICS', 'PUMP', ...answers, 'PLATING'];
  };
  // K07: which of the Armory's shelf to buy. The worth of a piece is read OFF THE ENGINE - it is
  // applied to a probe body and the resistances are read afterwards - so a piece added later is
  // priced here without anybody remembering to update a table, and a piece whose apply() changes
  // prices itself. The product is the one __augWants uses: how big the resistance is times how
  // often the thing it answers has actually been landing. A piece that moves no resistance is
  // worth nothing ON THIS MEASURE, which is the point - `answer` is the mitigation ceiling, not
  // a claim that a Gas Mask beats +3 DMG.
  // PHYSICAL COUNTS, and it usually wins. 61% of the blows aimed at the squad are physical, so a
  // Riot Shield's flat 6 is worth 3.7 off an average blow where a Gas Mask's flat 10 is worth
  // 1.3. Excluding phys would make this policy chase the piece its own arithmetic says is worse,
  // which would be a strawman rather than a ceiling. The report splits the two so the reader can
  // see which kind of mitigation the shelf actually sold.
  window.__gearPick = rows => {
    if (shopPick !== 'answer' || rows.length < 2) return rows[0];
    const bag = (runStats && runStats.dt && runStats.dt.atSquad) || {};
    const hits = t => (bag[t] || {}).hits || 0;
    const seen = ['phys', 'bio', 'energy'].reduce((a, t) => a + hits(t), 0) || 1;
    const worth = row => {
      const g = gearById(row.id);
      if (!g || !g.apply) return 0;
      const probe = { maxHp: 100, hp: 100, speed: 10, dmgBase: 10,
                      resistances: { phys: 0, bio: 0, energy: 0 } };
      g.apply(probe);
      return Object.entries(probe.resistances)
        .reduce((a, [t, v]) => a + (v > 0 ? (hits(t) / seen) * v : 0), 0);
    };
    let best = rows[0], bestWorth = worth(rows[0]);
    rows.slice(1).forEach(r => { const w = worth(r); if (w > bestWorth) { best = r; bestWorth = w; } });
    return best;
  };
  // Which pieces count as mitigation in the report below, read off apply() rather than listed,
  // and split two ways. `gearMit` is anything that moves a resistance at all - what the policy
  // above is actually shopping for. `gearAnswers` is the bio/energy subset, which is the content
  // K06 found unreachable. They are separate rows because they answer different questions, and
  // because the phys piece wins the policy's own arithmetic: a Riot Shield's 6 against 61% of
  // blows is worth more per blow than a Gas Mask's 10 against 13%.
  const probeGear = g => {
    const probe = { maxHp: 100, hp: 100, speed: 10, dmgBase: 10,
                    resistances: { phys: 0, bio: 0, energy: 0 } };
    if (g.apply) g.apply(probe);
    return probe.resistances;
  };
  stat.gearMit = GEAR_POOL.filter(g => g.apply && Object.values(probeGear(g)).some(v => v > 0)).map(g => g.id);
  stat.gearAnswers = GEAR_POOL.filter(g => { const r = probeGear(g); return r.bio > 0 || r.energy > 0; }).map(g => g.id);
  if (!window.__sk) window.__sk = { earned: 0, meta: 0, req: 0 };
  window.__sk.runStart = bossSkulls;
  window.__sk.runSpent = 0;
  // Read off the engine after the deploy has consumed the shelf, so a fallback that was bought
  // but did not arrive on the expedition shows up as a flat line here rather than as a null.
  stat.regroupsHad = typeof totalRegroups === 'function' ? totalRegroups() : 0;


  // G02: put the squad at the mouth of a deeper sector, carrying what a squad that walked there
  // was measured to carry. Everything here goes through a door the game already has - awardXp
  // levels an operator through the engine's own curve, the relic pool hands out the relics it
  // would hand out, equipGear is the control the Armory drives - so nothing below is a copy of
  // an engine rule that can drift away from it.
  if (stagePolicy > 1 && stageProfile[stagePolicy]) {
    const prof = stageProfile[stagePolicy];
    stat.staged = stagePolicy;
    // 1. levels, through the XP curve rather than onto the stat block
    deployedLine().forEach(c => {
      let guard = 0;
      while ((c.level || 1) < prof.lvl && guard++ < 60) awardXp(c, Math.max(1, c.xpToNext - c.xp));
    });
    // 1b. and the Outpost counter, which is where most of a deep squad's bar actually comes
    //     from - levelling alone left a staged line at 80hp against the 201 the profile
    //     measured, and the readout below is what caught it. Bought at zero cost, because the
    //     purse is set to the profile afterwards and a staged squad should not arrive having
    //     just spent it.
    deployedLine().forEach(c => {
      let g2 = 0;
      while (c.maxHp < prof.maxHp && g2++ < 60) buyUpgrade(c.id, 'HP', 0);
      g2 = 0;
      while (c.dmgBase < prof.dmg && g2++ < 60) buyUpgrade(c.id, 'DMG', 0);
    });
    // 2. relics, from the pool the game would have offered, cursed ones excluded - a staged
    //    squad is standing in for one that got there, and one that got there was not obliged to
    //    take curses on the way.
    let guard = 0;
    while (activeRelics.length < prof.relics && guard++ < 40) {
      const left = unownedRelics().filter(r => r.tier !== 'CURSED');
      if (!left.length) break;
      activeRelics.push(left[Math.floor(Math.random() * left.length)]);
    }
    // 3. gear, on the line, through the Armory's own control
    // equipGear fits from the stash and returns nothing, so the piece goes in the stash first
    // and the fit is confirmed off the operator rather than off a return value.
    let want = prof.gear;
    deployedLine().forEach(c => {
      if (want <= 0) return;
      const fits = GEAR_POOL.filter(g => g.slot !== 'mod' || g.cls === c.classType);
      const g = fits[Math.floor(Math.random() * fits.length)];
      if (!g) return;
      gearStash.push(g.id);
      equipGear(c.id, g.id);
      if (c.trinket === g.id || c.weaponMod === g.id) want--;
      else { const i = gearStash.indexOf(g.id); if (i !== -1) gearStash.splice(i, 1); }
    });
    // 4. the purse and the fallbacks
    scrap = prof.scrap;
    if (runStats) runStats.regroups = Math.min(prof.regroups, totalRegroups());
    // 5. and the road itself. crossSector is the only door into a new sector - it rolls the
    //    front, generates the map, resets the tier and writes the save, and every one of those
    //    was a thing this file used to do by hand until E01b took the copy out.
    while (currentSector < stagePolicy) crossSector();
    stat.stagedAt = { sector: currentSector, tier: currentTier,
                      lvl: deployedLine().map(c => c.level || 1),
                      maxHp: deployedLine().map(c => c.maxHp),
                      relics: activeRelics.length,
                      gear: deployedLine().filter(c => c.trinket || c.weaponMod).length,
                      scrap, regroups: regroupsLeft(), roster: playerRoster.length };
  }
  // And the muster's other control, which this file did not touch until E12c: which three of the
  // four a rank III operator brings. buildNewRun benches the FOURTH by default, so every figure
  // this file printed before E12c was taken from a squad fighting with its base three, and the
  // ten mastered abilities had never been fired here at all - 0.0 swings a run across 60
  // expeditions with every class at rank 3 and 150,000 to 425,000 lifetime XP.
  //
  // The policy benches the FREE BASIC, which is measured rather than assumed. Two rules were run
  // 3 x 60 against the same build fighting its base three:
  //
  //                            base three      bench the basic   bench the cd attack
  //   runs that ended the road  12 / 20 / 18     14 / 20 / 20        5 / 10 / 9
  //   wipes per run           6.80/6.55/6.55   6.38/6.63/6.35    7.05/6.73/7.05
  //   score, median          38.1k/52.5k/40.6k 29.4k/53.3k/52.4k 35.8k/32.5k/36.4k
  //
  // Benching the cooldown attack separates downward on wins and is simply a bad rule: it takes
  // Heavy Wrench off the Bruiser and leaves Shield Slam as the only cooldown move in the deck,
  // which the ranking below then picks every turn - the swap fired at 13-15% of every move made.
  // Benching the free basic overlaps the base-three arm on every row, so the fourth abilities
  // come into play without moving what this file reports. Seven of the ten now fire, 1.1-3.2%
  // each; the three that do not belong to the three least-deployed classes.
  //
  // It is not free: the basic is what guarantees an action, and without it 0.63% of player turns
  // have no move at all and 1.83% have only a self-action. Measured, small, and stated here
  // because it is the cost of the policy rather than a property of the game.
  // F03: one policy, applied wherever an operator joins. It ran once, over the roster as it
  // stood at the muster, and a recruit signed at a node three sectors later never got it - so
  // deckFor fell back to the engine's default of benching the FOURTH for them, and TRENCH
  // SWEEP, TANK RUPTURE and WHALE LINE were structurally unreachable in every measurement this
  // file has taken. E12c called those three rare; they were blocked.
  const applyBench = c => {
    if (!c || masteryRank(c.classType) < 3) return;
    const basic = (ABILITIES[c.classType] || []).find(a => !a.cd && a.reach !== 'self');
    if (basic) c.benchedMove = basic.move;
  };
  playerRoster.forEach(applyBench);
  // The opening draft, so a run that never reaches a fight still reports who it picked.
  // Everyone who actually stands in a line is added at the door of each fight below.
  stat.deployed = playerRoster.filter(p => p.gridPos > 0).map(p => p.classType);
  stat.doctrineKept = !!activeDoctrine && !doctrineBroken;
  const bountiesAtStart = () => activeBounties.map(b => b.desc).join('|');
  // Which contracts a run actually settles, so one nobody can finish shows as a zero.
  let lastBoard = null;
  const noteBoard = () => {
    const now = activeBounties.map(b => b.type);
    if (lastBoard) lastBoard.forEach((t, i) => { if (now[i] !== t) stat.settled[t] = (stat.settled[t] || 0) + 1; });
    lastBoard = now;
    stat.posted = standingBounty ? standingBounty.type : null;
  };
  let boardBefore = bountiesAtStart();

  // A squad that never spends scrap dies to arithmetic rather than to play, so the sim shops
  // the way a player would: heal the hurt, upgrade when it can afford to.
  const spend = () => {
    // Promotions resolve the way a player would: take a signature when one is on the table,
    // otherwise the first card. Leaving them queued would sim a squad weaker than any real one.
    while (pendingPerkOffers.length) {
      const offer = pendingPerkOffers[0];
      const who = playerRoster.find(c => c.id === offer.charId);
      // F06, and the E03 lesson again: the cards are rolled when the screen is DRAWN, because
      // two promotions from one fight are both pre-rolled against the same open fork and the
      // second would otherwise still be offering the half the first just closed. The sim used
      // to reach past the screen straight into takePerkOffer, so it decided from a hand no
      // player is ever dealt - and, now that takePerkOffer refuses a shut half, would have
      // thrown promotions away on cards a real screen would never have shown.
      renderPerkOffer();
      // E08b: a capstone is the card a player came to this screen for, so it is taken first.
      // Named explicitly rather than left to fall through to index 0 - it happens to be dealt
      // first, and a policy that relies on that measures the deal rather than the decision.
      const capId = (typeof capstoneFor === 'function' && who && capstoneFor(who)) ? capstoneFor(who).id : null;
      const capIdx = capId ? offer.options.indexOf(capId) : -1;
      const sigIdx = offer.options.findIndex(id => SIG_PERKS.some(p => p.id === id));
      if (capIdx >= 0) stat.capsTaken = (stat.capsTaken || 0) + 1;
      else if (sigIdx >= 0) stat.sigsTaken++;
      const had = (who && who.traits ? who.traits.length : 0);
      takePerkOffer(capIdx >= 0 ? capIdx : sigIdx >= 0 ? sigIdx : 0);
      // A promotion that bought nothing is the shape the F06 belt would make if the screen and
      // the decision ever came apart again. Counted rather than assumed, and reported.
      if (who && (who.traits ? who.traits.length : 0) === had) stat.promoEmpty++;
      stat.promotions++;
    }
    // E01: this used to heal a flat +30 once per operator per node. The Outpost's own button is
    // medBay, which charges 10 for floor(maxHp*0.4) and is repeatable while the scrap lasts -
    // they cross over at maxHp 75, so the copy was under-healing every operator above that and
    // over-charging every one below, and the once-per-node cap was a limit the game does not
    // have. The copy existed because medBay was not on the export surface; it is now.
    // The revive branch that stood here is gone: recoverDowned fires at every fight exit, so no
    // roster member is ever at hp <= 0 by the time this runs.
    playerRoster.forEach(c => {
      let guard = 0;
      // E09: the 10 that stood here was the Outpost's old flat price, copied. It is on the
      // income curve now, so the harness asks the engine what a click costs - and takes the
      // one-click PATCH UP when it can, which charges exactly the same as the clicks it saves.
      const step = typeof medBayCost === 'function' ? medBayCost() : 10;
      if (typeof patchUpCost === 'function' && c.hp > 0 && c.hp < c.maxHp && scrap >= patchUpCost(c)) {
        medBay(c.id, 'PATCH');
      } else {
        while (c.hp > 0 && c.hp < c.maxHp && scrap >= step && guard++ < 40) medBay(c.id, 'HEAL');
      }
    });
    // Gear helps nobody in the stash: each piece goes to the first deployed operator it fits.
    gearStash.slice().forEach(id => {
      const g = gearById(id); if (!g) return;
      const fit = playerRoster.find(c => invests(c) && (g.slot === 'mod'
        ? (c.classType === g.cls && !c.weaponMod) : !c.trinket));
      if (fit) { equipGear(fit.id, id); stat.gearEquipped++; }
    });
    // Augments are the other half of the materials economy and this file never touched them:
    // installAugment was called zero times, which is most of why "the whole economy resolves to
    // make more stims" looked true. They are permanent and per-operator, so they get first call
    // on materials; consumables are what the leftovers buy.
    if (AUGMENTS_ON) {
      let aGuard = 0;
      while (aGuard++ < 8) {
        const who = playerRoster.filter(invests);
        // Read off the game. This file capped itself at three a head for as long as it has
        // simulated augments, while the game had no cap at all - so every balance figure in
        // this repo was taken against a ceiling that did not exist. D03 gave the game the
        // ceiling; this asks for it rather than keeping a second copy of the number.
        const target = who.find(c => augmentSlotsLeft(c) > 0);
        if (!target) break;
        const had = (target.augments || []).length;
        // Affordability is asked of the game, the same way crafting does it, so repricing an
        // augment cannot leave this file buying at yesterday's price.
        const shelf = AUGMENTS.slice(0, augCat).map(a => a.id);
        // How many answers this body is already carrying, by tag, so the cap is read off what is
        // actually installed rather than counted here.
        const answerTags = AUGMENTS.filter(a => a.answers).map(a => a.tag);
        const carried = (target.augments || []).filter(t => answerTags.includes(t)).length;
        const order = (augPolicy === 'road' ? window.__augWants(target) : AUGMENTS.map(a => a.id))
          .filter(id => shelf.includes(id))
          .filter(id => { const a = augmentById(id);
            return !a || !a.answers || carried < augMax; });
        const afford = order.map(augmentById).filter(Boolean).find(a => canAugment(target, a.id));
        if (!afford) break;
        installAugment(target.id, afford.id);
        if ((target.augments || []).length === had) break;
        stat.augments++;
      }
    }
    // This used to craft Med-Stims and nothing else, which is most of why the audit read the
    // other three as dead content: they were never in the bag to be used. It keeps a Med-Stim
    // or two for the floor and then spends what is left on whatever the materials allow.
    // Affordability is asked of the game (canAfford reads the same recipe craftItem spends), so
    // repricing a schematic cannot leave the simulator buying at yesterday's price.
    const before = () => inventory.length;
    while (canCarry() && canAfford('MED_STIM') && inventory.filter(i => i === 'MED_STIM').length < 2) {
      const n = before(); craftItem('MED_STIM'); if (inventory.length === n) break; stat.crafted++;
    }
    let guard = 0;
    while (canCarry() && guard++ < 12) {
      const n = before();
      const pick = ['EMP_CHARGE', 'ADRENALINE', 'SCRAP_BOMB', 'MED_STIM'].find(canAfford);
      if (!pick) break;
      craftItem(pick);
      if (inventory.length === n) break;
      stat.crafted++;
    }
    playerRoster.forEach(c => {
      // F03: this was a hand copy at the sector-1 price that granted BOTH stats per purchase.
      // The Outpost sells one or the other - buyUpgrade(id, 'HP'|'DMG') - at upgradeCost, which
      // has ridden sectorRewardMult since E09. So from sector 2 on every simulated operator was
      // over-upgraded and under-charged, and every economy table this file printed described a
      // squad the game does not sell. Through the button now, alternating the two so a career
      // buys the same mix a player buying "a bit of both" would.
      const cost = typeof upgradeCost === 'function' ? upgradeCost(c) : 30 + (c.upgradeCount * 25);
      // I08: `line` is the gate this file has always had; `roster` is the one the game has.
      if (invests(c) && scrap >= cost * 2) {
        const kind = (c.upgradeCount % 2 === 0) ? 'HP' : 'DMG';
        buyUpgrade(c.id, kind, cost);
        stat.upgrades = (stat.upgrades || 0) + 1;
      }
      // E08: a banked point can buy a signature at the Outpost now, for scrap on top of the
      // point. This loop spent every point on a random stat card, which is not what a player
      // does when the class verb is on the same menu - and left the harness unable to measure
      // the change at all. Identity first while the purse covers it, stats with the rest.
      let guard = 0;
      while (c.perkPoints > 0 && guard++ < 40) {
        const had = c.perkPoints;
        const canBuy = typeof unheldSigsFor === 'function' && typeof sigBuyCost === 'function';
        const open = canBuy ? unheldSigsFor(c) : [];
        if (open.length && scrap >= sigBuyCost()) {
          assignPerk(c.id, open[Math.floor(Math.random() * open.length)].id);
          if (c.perkPoints < had) { stat.sigsBought = (stat.sigsBought || 0) + 1; continue; }
        }
        // E08b: and the capstone above them, which is the other thing a banked point can now
        // become. Without this the Outpost arm of the change is never exercised and the
        // measurement reads a feature nobody bought.
        if (typeof capstoneOpen === 'function' && capstoneOpen(c) && scrap >= capstoneCost()) {
          assignPerk(c.id, capstoneFor(c).id);
          if (c.perkPoints < had) { stat.capsBought = (stat.capsBought || 0) + 1; continue; }
        }
        assignPerk(c.id, PERK_POOL[Math.floor(Math.random() * PERK_POOL.length)].id);
        if (c.perkPoints === had) break;
      }
    });
    // I08: and then field the best three. This file placed an operator exactly twice in a run -
    // at the muster, and once more the instant a recruit was signed - and never looked again.
    // The game's position control is on the Outpost screen every visit, so a player re-reads
    // the line whenever the roster changes. Without this the `roster` arm is incoherent: it
    // pays to improve a benched body and then never gives that body a way onto the field, so
    // the money is spent and the decision it was meant to change has already been made.
    //
    // Same rate() rule the signing decision uses, through assignSlot, which is the engine's own
    // door - it keeps SHORT_HANDED's ban on slot 3 and calls checkDoctrine. Only swaps a strict
    // improvement, so a tie leaves the incumbent standing.
    if (investPolicy === 'roster') {
      let sGuard = 0;
      while (sGuard++ < DEPLOYED) {
        const onLine = playerRoster.filter(c => c.gridPos > 0 && c.hp > 0);
        const benched = playerRoster.filter(c => c.gridPos === 0 && c.hp > 0);
        if (!onLine.length || !benched.length) break;
        const worst = onLine.reduce((a, c) => (rateOf(c) < rateOf(a) ? c : a));
        const best = benched.reduce((a, c) => (rateOf(c) > rateOf(a) ? c : a));
        if (rateOf(best) <= rateOf(worst)) break;
        const slot = worst.gridPos;
        assignSlot(best.id, slot);
        if (best.gridPos !== slot) break;      // the engine refused it; do not spin
        stat.reslotted = (stat.reslotted || 0) + 1;
        if (best.classType === 'TRENCH_FIEND' || best.classType === 'HAZMAT' || best.classType === 'HARPOONER') {
          stat.reslottedRecruit = (stat.reslottedRecruit || 0) + 1;
        }
      }
    }
  };

  // Picks the ability with a live combo if there is one, otherwise the first available. This is
  // a competent player, not an optimal one.
  const takeTurn = () => {
    const actor = turnQueue[activeIndex];
    const foes = activeEntities.filter(e => !e.isPlayer && e.hp > 0);
    if (!foes.length) return false;
    // deckFor, not ABILITIES: a class at mastery rank 3 fights with a fourth ability, and
    // reading the raw table meant every one of those was measured as never used.
    const deck = deckFor(actor).filter(a => !a.cd || (actor.cooldowns[a.cd] || 0) === 0);
    // F10: this used to return false and the caller silently skipped the turn - the same hole
    // the deck had on screen, where an operator with everything cooling was offered nothing
    // that resolved the turn. The engine has HOLD now, so this presses it, and counts it: the
    // "nothing to press" line below is what the hole used to be and has to read zero.
    if (!deck.length) {
        stat.held = (stat.held || 0) + 1;
        stat.turnsPlayer = (stat.turnsPlayer || 0) + 1;
        executeSelfAction('HOLD');
        return true;
    }
    stat.turnsPlayer = (stat.turnsPlayer || 0) + 1;
    // Was there a decision to make at all? Taken here, at the top of the turn, because the
    // tactic block below spends the bar and would leave every measurement of it reading zero.
    // "The squad left them there" and "the squad had nothing that reached them" are different
    // findings and every figure published on this has added them together.
    if (bleedingOut().length && actor.isPlayer) {
      stat.downFaced++;
      const byMove = deck.some(a => REACHES_THE_DOWN.includes(a.move));
      const byItem = inventory.includes('MED_STIM') || inventory.includes('ADRENALINE');
      const byBar = momentum >= 30;      // the STIM tactic, which takes the floor first
      if (byMove) stat.downByMove++;
      if (byItem) stat.downByItem++;
      if (byBar) stat.downByBar++;
      if (byMove || byItem || byBar) stat.downReach++;
    }
    // Extracted so the same rescue can be attempted from either side of the tactic block. The
    // counters inside it are unchanged, so a save is a save wherever it is reached from.
    const tryRescue = () => {
      const down = bleedingOut();
      if (!down.length) return false;
      const worst = down.sort((a, b) => (a.downTurns || 0) - (b.downTurns || 0))[0];
      if (inventory.includes('MED_STIM')) {
        stat.items.MED_STIM = (stat.items.MED_STIM || 0) + 1;
        stat.saves++; stat.bagSaves = (stat.bagSaves || 0) + 1;
        pendingAction = 'ITEM_MED'; resolveConsumableItem(worst.id); return true;
      }
      // Adrenaline is on the REACHES_THE_DOWN list too, and getting them up at all beats
      // getting them up well.
      if (inventory.includes('ADRENALINE')) {
        stat.items.ADRENALINE = (stat.items.ADRENALINE || 0) + 1;
        stat.saves++; stat.bagSaves = (stat.bagSaves || 0) + 1;
        pendingAction = 'ITEM_ADRENALINE'; resolveConsumableItem(worst.id); return true;
      }
      const patch = deck.find(a => a.move === 'CAUTERIZE' || a.move === 'STIM_DART');
      if (patch) {
        stat.moves[patch.move] = (stat.moves[patch.move] || 0) + 1;
        stat.saves++; stat.handSaves = (stat.handSaves || 0) + 1;
        pendingAction = patch.move; resolveAction(worst.id); return true;
      }
      return false;
    };
    // What follows is a competent player, not an optimal one, and deliberately reads only what
    // the game already puts on screen: the health bars, the intent icons, the reach penalty
    // printed on the deck button, and the combo tag. No damage formula is duplicated here - a
    // second copy of the arithmetic would drift from the engine and become the next bad
    // instrument.
    const dist = f => foes.indexOf(f);
    // What the button says. A move of null - the overdrive - carries no printed reach penalty,
    // so nothing is soft for it.
    const soft = (mv, f) => !!mv && reachMult(mv, actor, dist(f)) < 1;
    // What a foe is about to do to you, which is what the intent icon shows.
    const threat = f => {
      const fc = forecastFor(f);
      return fc && fc.hits ? fc.hits.reduce((a, h) => a + h.dmg, 0) : (f.dmgBase || 0);
    };
    // A health bar in the red is the whole reason focus fire exists: a foe removed stops acting,
    // a foe half-removed does not.
    const finishable = f => f.hp <= f.maxHp * 0.25;
    const pickFoe = mv => {
      const reachable = foes.filter(f => !soft(mv, f));
      const pool = reachable.length ? reachable : foes;
      const kill = pool.filter(finishable).sort((a, b) => a.hp - b.hp)[0];
      if (kill) return kill;
      return pool.slice().sort((a, b) => threat(b) - threat(a))[0] || foes[0];
    };

    if (momentum >= overdriveAt()) {
      stat.moves.OVERDRIVE = (stat.moves.OVERDRIVE || 0) + 1;
      // F03: this fired at foes[0] - whatever stood first in activeEntities - while every other
      // move in the file goes through pickFoe, so the readout under-read what a full bar is
      // worth. Worse, and found while fixing it: one overdrive in the table aims at an ALLY.
      // FIELD_REVIVE does `target.hp = max(target.hp, floor(target.maxHp * 0.5))`, so every
      // Medic overdrive this file has ever fired healed an enemy to half health. The engine
      // makes operators the targetable row when a Medic's bar goes off; here the target is
      // chosen the same way, worst off first.
      const od = typeof overdriveFor === 'function' ? overdriveFor(actor.classType) : null;
      const line = activeEntities.filter(e => e.isPlayer && e.hp > 0);
      const mark = (od && od.id === 'FIELD_REVIVE')
        ? (bleedingOut()[0] || line.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0] || actor)
        : (pickFoe(null) || foes[0]);
      stat.odAimed = (stat.odAimed || 0) + (mark === foes[0] ? 0 : 1);
      pendingAction = 'OVERDRIVE'; resolveAction(mark.id); return true;
    }
    // Tactics. None of the three costs an action, so the only question is what the bar buys.
    const buy = id => {
      const before = momentum;
      // A STIM bought while somebody is on the floor IS a rescue - stimTarget takes the worst
      // off first and the worst off is always the body. It was counted only as a tactic, so
      // "turns spent saving them" has always been the item-and-move rescues alone, missing the
      // one answer a squad with no medic in the line actually has.
      const onFloor = id === 'STIM' && bleedingOut().length > 0;
      spendTactic(id);
      if (momentum === before) return false;
      stat.moves[id] = (stat.moves[id] || 0) + 1;
      if (onFloor) { stat.saves++; stat.barSaves++; }
      return true;
    };
    // H05: WHICH HAND REACHES FIRST. The bar is spent in the block below, and the bag and the
    // medic's hands are only consulted after it - so the STIM tactic has always had first
    // refusal on every rescue in this file. That ordering, not the game, is most of what "87% of
    // rescues are one button" was measuring: D05 and D06 were both re-scoped when a finding
    // turned out to be this policy reporting itself, and this has the same shape.
    //
    // `--rescue bar` (the default, and what every prior sample ran) keeps that order.
    // `--rescue hands` gives the bag and the deck first refusal and leaves the bar as the
    // fallback it is for a squad with neither. Nothing else differs, so what separates between
    // the arms is the ordering and only the ordering.
    if (rescuePolicy === 'hands' && tryRescue()) return true;
    if (tacticPolicy === 'stim') {
      if (momentum >= 30 && stimTarget()) buy('STIM');
    } else if (tacticPolicy === 'focus') {
      if (momentum >= 25) buy('FOCUS');
    } else if (tacticPolicy === 'press') {
      if (momentum >= 40) buy('PRESS');
    } else if (tacticPolicy === 'hold') {
      if (momentum >= 25) buy('HOLD');
    } else if (tacticPolicy === 'break') {
      if (momentum >= 35 && breakTarget()) buy('BREAK');
    } else if (tacticPolicy === 'smart') {
      // Survival first, in the order a player would read the board: somebody on the floor, then
      // the blow that is about to land, then the line being ground down, then damage.
      const hurt = stimTarget();
      const incoming = Object.values(threatBoard()).reduce((a, t) => a + t.dmg, 0);
      const linePool = activeEntities.filter(e => e.isPlayer && e.hp > 0).reduce((a, e) => a + e.hp, 0);
      const worst = breakTarget();
      const worstHit = worst ? (forecastFor(worst)?.hits || []).reduce((a, h) => a + h.dmg, 0) : 0;
      if (bleedingOut().length && momentum >= 30 && hurt) buy('STIM');
      else if (momentum >= 35 && worst && worstHit > linePool * 0.22) buy('BREAK');
      else if (momentum >= 30 && hurt && hurt.hp < hurt.maxHp * 0.5) buy('STIM');
      else if (momentum >= 25 && incoming > linePool * 0.25) buy('HOLD');
      else if (momentum >= 40) buy('PRESS');
      else if (momentum >= 25) buy('FOCUS');
    }

    // Somebody on the floor is the turn. A Med-Stim, then the medic's hands - anything else
    // is measuring a squad that watches its own people bleed out, which is not a squad.
    if (tryRescue()) return true;

    // A ranged operator caught holding the front rank swaps out - the one formation fix
    // that actually changes what enemy melee reaches.
    if (actor.gridPos === 1 && isRanged((ABILITIES[actor.classType] || [{}])[0].move)) {
      const meleeAlly = activeEntities.find(e => e.isPlayer && e.hp > 0 && e.gridPos > 1 &&
        isMelee((ABILITIES[e.classType] || [{}])[0].move));
      if (meleeAlly) {
        stat.moves.REPOSITION = (stat.moves.REPOSITION || 0) + 1;
        pendingAction = 'REPOSITION'; resolveAction(meleeAlly.id); return true;
      }
    }

    // A player in trouble reaches for the bag before they reach for another attack.
    const badlyHurt = activeEntities.filter(e => e.isPlayer && e.hp > 0 && e.hp < e.maxHp * 0.35)
                                    .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (badlyHurt && inventory.includes('MED_STIM')) {
        stat.items.MED_STIM = (stat.items.MED_STIM || 0) + 1;
        pendingAction = 'ITEM_MED'; resolveConsumableItem(badlyHurt.id); return true;
    }
    const stuck = activeEntities.find(e => e.isPlayer && e.hp > 0 && (e.stunnedTurns > 0 || e.bleedingTurns > 0));
    if (stuck && inventory.includes('ADRENALINE')) {
        stat.items.ADRENALINE = (stat.items.ADRENALINE || 0) + 1;
        pendingAction = 'ITEM_ADRENALINE'; resolveConsumableItem(stuck.id); return true;
    }
    const nearlyDead = foes.find(f => f.hp <= 35);
    if (nearlyDead && inventory.includes('SCRAP_BOMB')) {
        stat.items.SCRAP_BOMB = (stat.items.SCRAP_BOMB || 0) + 1;
        pendingAction = 'ITEM_BOMB'; resolveConsumableItem(nearlyDead.id); return true;
    }
    // An operator who is stunned or bleeding has already lost the turn; Adrenaline buys it back.
    const fouled = activeEntities.find(e => e.isPlayer && e.hp > 0 && ((e.stunnedTurns || 0) > 0 || (e.bleedingTurns || 0) > 0));
    if (fouled && inventory.includes('ADRENALINE')) {
        stat.items.ADRENALINE = (stat.items.ADRENALINE || 0) + 1;
        pendingAction = 'ITEM_ADRENALINE'; resolveConsumableItem(fouled.id); return true;
    }
    // An EMP denies a turn, which is what BREAK costs 35 momentum to do. Spent on whoever is
    // about to do the most, the same read BREAK uses.
    if (inventory.includes('EMP_CHARGE')) {
        const worstFoe = (typeof breakTarget === 'function' ? breakTarget() : null)
          || foes.slice().sort((a, b) => b.dmgBase - a.dmgBase)[0];
        if (worstFoe && (worstFoe.stunnedTurns || 0) <= 0) {
            const f = forecastFor(worstFoe);
            const hurts = f && f.hits ? f.hits.reduce((a, h) => a + h.dmg, 0) : worstFoe.dmgBase;
            const pool = activeEntities.filter(e => e.isPlayer && e.hp > 0).reduce((a, e) => a + e.hp, 0);
            if (hurts > pool * 0.15) {
                stat.items.EMP_CHARGE = (stat.items.EMP_CHARGE || 0) + 1;
                pendingAction = 'ITEM_EMP'; resolveConsumableItem(worstFoe.id); return true;
            }
        }
    }

    // Attack selection used to be `deck[random]` swung at `foes[0]`, which is not a player, it
    // is a coin. It ignored cooldowns, reach, crowds and health bars, and every depth figure
    // this file has ever reported was a readout of that coin - the same defect that once had a
    // throwaway probe reporting every formation hitting the turn cap.
    //
    // What follows is a competent player, not an optimal one, and deliberately reads only what
    // the game already puts on screen: the health bars, the intent icons, the reach penalty
    // printed on the deck button, and the combo tag. No damage formula is duplicated here - a
    // second copy of the arithmetic would drift from the engine and become the next bad
    // instrument.
    // The picker is declared at the top of the turn (F03) because the overdrive above aims
    // through it too. It was declared here, below the bar, which is why the bar was the one
    // move in the file fired at whoever happened to stand first.
    let chosen = null, target = null;
    // 1. A combo is the game's own signposted best move, and it is signposted on the button.
    for (const a of deck) {
      const hit = foes.find(f => comboFor(a.move, f) && !soft(a.move, f))
               || foes.find(f => comboFor(a.move, f));
      if (hit) { chosen = a; target = hit; break; }
    }
    // 2. Three or more of them standing is what an AoE is for.
    if (!chosen && foes.length >= 3) {
      const blast = deck.find(a => isAoe(a.move));
      if (blast) chosen = blast;
    }
    // 3. The three moves that are not aimed at anybody. This file could not pick one until D07:
    //    the fallback below filters `act !== 'self'`, nothing else ever set them, and so Iron
    //    Guard, Over The Top and Purge Valve - the only three self-actions in the game - sat in
    //    the "never used" line of every report it has ever printed. They were not dead content;
    //    they had never been measurable, and every reading this file has given about how long a
    //    line holds was taken from a player who could not brace.
    //
    //    Each is written as the case where a player would obviously take it, off what the screen
    //    already shows - health bars, status chips, and the intent forecast - rather than off any
    //    arithmetic copied out of the engine.
    const has = mv => deck.find(a => a.move === mv);
    // The forecast is the expensive read on this file's hot path - it prices every intent on
    // the board - so the round is only totalled if a move that cares about it is actually in
    // hand, and then only once.
    let incomingMemo = null;
    const incoming = () => (incomingMemo === null
      ? (incomingMemo = foes.reduce((a, f) => a + threat(f), 0)) : incomingMemo);
    const line = () => activeEntities.filter(e => e.isPlayer && e.hp > 0);

    if (!chosen && has('PURGE_VALVE')) {
      // PURGE VALVE clears bleed, oil and corrosion off the whole squad and patches everyone.
      // Two people carrying something is the moment; one is not worth a turn.
      const up = line();
      const fouled = up.filter(e => (e.bleedingTurns || 0) > 0 || (e.oiledTurns || 0) > 0
                                 || (e.corrodedTurns || 0) > 0).length;
      const pool = up.reduce((a, e) => a + e.hp, 0);
      if (fouled >= 2 || (fouled >= 1 && pool < up.length * 40)) chosen = has('PURGE_VALVE');
    }
    if (!chosen && has('IRON_GUARD')) {
      // IRON GUARD braces and covers the ranks BEHIND the guard - the engine redirects a hit
      // onto whoever is braced in FRONT of the mark - so it is worth a turn only when somebody
      // is actually behind this operator and the round coming in is a real one.
      const up = line();
      const covering = up.some(e => e.id !== actor.id && e.gridPos > actor.gridPos);
      const pool = up.reduce((a, e) => a + e.hp, 0);
      if (covering && incoming() > pool * 0.18) chosen = has('IRON_GUARD');
    }
    if (!chosen && has('OVER_THE_TOP')) {
      // OVER THE TOP is paid for in blood and spent over the turns after it, so it wants a
      // healthy operator and a fight with enough left in it to spend the charge on.
      const fight = foes.reduce((a, f) => a + f.hp, 0);
      if (actor.hp > actor.maxHp * 0.6 && fight > incoming() * 2) chosen = has('OVER_THE_TOP');
    }

    // 4. Otherwise the best thing available: a special off cooldown beats the basic attack (it
    //    has a cooldown because it is worth more), and a swing that lands soft loses to one
    //    that does not. Self-actions are out of THIS ranking on purpose - they are not swings,
    //    and they get their own cases above rather than being sorted against damage.
    //
    //    The third term is the enemy card. Without it this ranking read reach and cooldown and
    //    nothing else, so ANY two moves alike in both scored identically - and a stable sort
    //    hands a tie to whichever sits earlier in the deck, the same one, every turn, in every
    //    sample this file has ever printed. That is the whole story of RAD_SHOT: ranged, no
    //    cooldown, sitting one line below the Medic's PISTOL, which is also ranged with no
    //    cooldown. It lost that tie 803 times in twelve runs and was written up as a move
    //    nobody uses. It was a move this file could not pick. Reading the resistances - which
    //    the dossier prints as RESISTS / WEAK / IMMUNE, so the player has them too - separates
    //    a bio trigger from a physical one and lets the tie be decided by the target.
    if (!chosen) {
      const usable = deck.filter(a => a.act !== 'self');
      const bites = a => {
        const f = pickFoe(a.move);
        if (!f) return 0;
        const r = (f.resistances || {})[damageTypeOf(a.move)] || 0;
        return r >= 100 ? -4 : r < 0 ? 1 : r > 5 ? -1 : 0;
      };
      const rank = a => (a.cd ? 2 : 1) + (foes.some(f => !soft(a.move, f)) ? 2 : 0) + bites(a);
      // Scored once per move and then sorted on the scores. Ranking inside the comparator
      // would re-run pickFoe - which forecasts every foe on the field - O(n log n) times a
      // turn instead of once a move, and this file is slow enough already.
      chosen = usable.map(a => [rank(a), a]).sort((x, y) => y[0] - x[0]).map(x => x[1])[0] || deck[0];
    }
    if (!target) target = pickFoe(chosen.move);
    if (chosen.act === 'self') { stat.moves[chosen.move] = (stat.moves[chosen.move] || 0) + 1; executeSelfAction(chosen.move); return true; }
    if (chosen.move === 'CAUTERIZE') {
      const hurt = activeEntities.filter(e => e.isPlayer && e.hp > 0 && e.hp < e.maxHp)[0];
      if (!hurt) { chosen = deck.find(a => a.move !== 'CAUTERIZE') || deck[0]; }
      else { stat.moves.CAUTERIZE = (stat.moves.CAUTERIZE || 0) + 1; pendingAction = 'CAUTERIZE'; resolveAction(hurt.id); return true; }
    }
    stat.moves[chosen.move] = (stat.moves[chosen.move] || 0) + 1;
    pendingAction = chosen.move; resolveAction((target || foes[0]).id);
    return true;
  };

  // Drives one fight to its end without any timers - every turn resolved synchronously.
  // Losing badly: half the line is nearly out and the other side has barely been dented. A
  // player reads that off the board in a glance; this is the same read in arithmetic.
  const losing = (enemyStartHp) => {
    const squad = activeEntities.filter(e => e.isPlayer);
    const spent = squad.filter(e => e.hp <= e.maxHp * 0.3).length;
    const foeHp = activeEntities.filter(e => !e.isPlayer).reduce((a, e) => a + Math.max(0, e.hp), 0);
    return spent >= Math.ceil(squad.length / 2) && foeHp > enemyStartHp * 0.5;
  };

  const fight = (nodeType, elite) => {
    initiateCombat(nodeType, elite);
    // I02: initiateCombat ends in processTurn(), so the engine has ALREADY opened the first
    // actor's turn before this loop sees the field - applied its turn-start effects, and counted
    // it in fightLog if it is a player. The loop below does both of those itself, for every
    // actor, so the opening one was getting them twice.
    //
    // Measured over 210 fights across seven depths and three factions: 49 of them (23%) open on
    // a player - the Scavenger 46 times, the Medic 3 - and in every one of those 49 the lead's
    // cooldown had already stepped 3 -> 2 and fightLog.turns already read 1 before this loop ran
    // a single pass. So in one fight in four the fastest operator was getting a free cooldown
    // step, and the fight read one turn longer than it was. turns feeds exactly one thing, the
    // BLITZ bounty, which wants a fight finished quickly - so it was under-credited on those
    // fights for as long as this file has existed.
    //
    // Held as the ENTITY rather than as an index or a first-pass flag: the loop has three
    // `continue` paths above the effects, so "skip the first pass" would drop the guard onto
    // whichever actor happened to survive them. Read after initiateCombat returns, which is
    // after processTurn's own bounce past a downed opener, so it names whoever actually got the
    // opening turn.
    let engineOpened = combatActive ? turnQueue[activeIndex] : null;
    // H02: the reckoning arm, opened at the bell rather than at a quarter health.
    if (reckoning && nodeType === 'BOSS') {
      const boss = activeEntities.find(e => !e.isPlayer && e.bossId);
      // One rung up the ladder it already has, NOT past it. The first version called
      // openGrudgePhase here, which set phase 3 and so skipped phase 2 - the commander lost its
      // ordinary enrage and got a third gear with nothing to spend, and wiped fewer squads than
      // a normal one. A reckoning opens the enrage at the bell and leaves the grudge phase to
      // fire at a quarter health exactly as it always did.
      if (boss && boss.phase === 1) {
        openEnragePhase(boss);
        stat.reckonings = (stat.reckonings || 0) + 1;
      }
    }
    stat.fights++;
    // Who is on the field, not who was picked. This was read once at the muster, so a recruit
    // signed in sector 3 and fielded for the rest of the run never appeared in the classes line,
    // and neither did anyone brought in off the bench. The line said who was drafted while
    // reading as who fought - and it is the line the "classes that never leave the Outpost"
    // reading was taken from. Counted once per run per class, as before.
    playerRoster.filter(p => p.gridPos > 0)
      .forEach(p => { if (!stat.deployed.includes(p.classType)) stat.deployed.push(p.classType); });
    // What an elite node actually fielded. Counted off the units rather than off the roll, so
    // an affix that stops being handed out shows up here as a zero instead of going unnoticed -
    // which is exactly how ARMORED spent its whole life decaying.
    if (elite) {
      activeEntities.filter(e => !e.isPlayer).forEach(e => {
        stat.eliteUnits++;
        const worn = affixesOn(e);
        if (worn.length) stat.affixedUnits++;
        if (worn.length > 1) stat.champions++;
        worn.forEach(a => { stat.affixes[a] = (stat.affixes[a] || 0) + 1; });
      });
    }
    // Scars are dealt inside recoverDowned, and every ending reaches it - including withdraw(),
    // which does it for itself. So the snapshot is taken at the door and the diff read at each
    // exit rather than at any one of them.
    const marks = () => playerRoster.flatMap(c => (c.scars || []).map(id => c.id + ':' + id));
    const scarsAtStart = marks();
    const tallyScars = () => marks().filter(m => !scarsAtStart.includes(m))
        .forEach(m => { if (!stat.__seen) stat.__seen = []; if (!stat.__seen.includes(m)) { stat.__seen.push(m); stat.scars.push(m.split(':')[1]); } });
    // A sim that never met a formation would report a game without them and read identically
    // to one that did, so what walked on is counted rather than assumed.
    if (currentFormation) stat.formations[currentFormation] = (stat.formations[currentFormation] || 0) + 1;
    else stat.loose++;
    // H11: which faction the fight was, so a shape can be reported as a share of the fights it
    // could possibly have turned up in. A raw count says a shape is rare; a share says whether
    // the player who meets that faction ever learns it.
    //
    // Placed AFTER the else above, not between it and its if. Inserted between them, this block
    // captured the `else` - loose fights stopped being counted and the named-shape rate read 79%
    // against a true ~48%. A dangling else is invisible to `node --check` and to every assertion
    // that does not compare the two counters, which is why the disagreement between this readout
    // and the per-faction shares below was worth chasing rather than explaining away.
    //
    // currentNodeType, not the loop's `node`: this is inside fight(), where that is not in
    // scope, and the engine's own global is what the formation was rolled against anyway.
    if (currentNodeType && FIGHT_NODES.includes(currentNodeType)) {
      stat.factionFights[currentNodeType] = (stat.factionFights[currentNodeType] || 0) + 1;
    }
    // Counted at the door rather than at the end: a fight that is run from still happened, and
    // the squad still had to look at whatever was in it.
    activeEntities.filter(e => !e.isPlayer && e.sig).forEach(e => {
      stat.sigsFaced[e.sig] = (stat.sigsFaced[e.sig] || 0) + 1;
    });
    const enemyStartHp = activeEntities.filter(e => !e.isPlayer).reduce((a, e) => a + e.hp, 0);
    let rounds = 0, fled = false;
    const wonBefore = runStats.fightsWon || 0;   // E01: what the engine had banked before this fight
    while (combatActive && rounds < 400) {
      rounds++;
      const actor = turnQueue[activeIndex];
      // Cleared here rather than at the effects line below, because this actor's turn is spent
      // whichever of the paths above it leaves by - and because the fightLog count further down
      // needs to know too, long after the flag itself would have been stood down.
      const engineDidOpen = actor === engineOpened;
      if (engineDidOpen) engineOpened = null;
      // The real loop ticks the bleed-out clock as the queue passes a downed operator; this
      // loop walks the queue itself, so it has to do the same. It has to come before the hp
      // check below, which is where the first version of this sat - and measured zero deaths
      // across sixty runs because it was never reached.
      if (isDown(actor)) { tickBleedOut(actor); activeIndex = (activeIndex + 1) % turnQueue.length; continue; }
      if (!actor || actor.hp <= 0) { activeIndex = (activeIndex + 1) % turnQueue.length; continue; }
      if (actor.stunnedTurns > 0) { actor.stunnedTurns--; activeIndex = (activeIndex + 1) % turnQueue.length; continue; }
      // I02: everyone gets exactly one turn-start, the way the engine's own walk gives it.
      if (!engineDidOpen) applyTurnStartEffects(actor);
      if (!activeEntities.some(e => e.isPlayer && e.hp > 0)) break;
      if (!activeEntities.some(e => !e.isPlayer && e.hp > 0)) break;
      // I01: the price of a second chance, counted at the moment it would be taken. retreatCost
      // is 45 + 15 a NODE - 1,080 by sector 7 tier 10 - against a purse H14 measured at a median
      // of 287 at a recruit node. RECRUIT_COST records exactly this failure and its own retune out
      // of it: at 110 + 22 a tier "five of sixty-nine offers were affordable at all and nobody was
      // ever signed on". Retreat has never had that treatment, and this file has never pressed the
      // button, so nothing has ever checked.
      //
      // Nothing here takes the retreat - this is the shipped baseline, measured without a policy
      // on it, so the split below describes the game rather than a robot's taste. Splitting
      // "the door was relevant" from "the door was affordable" is H10's lesson: a door nobody
      // walks through is an empty purse or a closed gate before it is ever a dull offer.
      //
      // The gate is asked of the engine rather than rebuilt here. canRetreat() ends in
      // `scrap >= retreatCost()`, so lifting the purse and asking it again reads every OTHER
      // clause exactly - the boss gate, a live squad, no pending action - with no hand copy to
      // drift out of step. F03 found nine of those in this file at once; this is not the tenth.
      if (actor.isPlayer && combatActive && losing(enemyStartHp)) {
        const held = scrap;
        scrap = Number.MAX_SAFE_INTEGER;
        const openBarMoney = canRetreat();
        scrap = held;
        if (openBarMoney) {
          const price = retreatCost();
          stat.retreatOpen++;
          stat.retreatAsked.push(price);
          stat.retreatPurse.push(held);
          const key = 's' + currentSector;
          const row = stat.retreatBySector[key] || (stat.retreatBySector[key] = { open: 0, afford: 0 });
          row.open++;
          if (held >= price) { stat.retreatAfford++; row.afford++; }
        }
      }
      if (actor.isPlayer && withdrawPolicy && canWithdraw() && losing(enemyStartHp)) {
        countBodies();
        // withdraw() reaches recoverDowned on its own, so the operators it picks up have to be
        // counted here or the scar rate is measured against a denominator missing every one of
        // the five withdrawals a run. That read 12% against a 0.08 chance and looked like a bug
        // in the game rather than a bug in the tally.
        stat.recovered += bleedingOut().length;
        bleedingOut().forEach(e => stat.clockLeft.push(e.downTurns || 0));
        withdraw(); withdraw();          // the real thing: arms, then commits
        fled = true;
        break;
      }
      // Count a fall the first time it happens to each operator in this fight.
      activeEntities.forEach(e => { if (isDown(e) && !e.__counted) { e.__counted = true; stat.downs++; } });
      // processTurn does this in the real loop - including for the actor initiateCombat opened,
      // which is why that one is not counted twice. See the note at the top of fight().
      if (actor.isPlayer && fightLog && !engineDidOpen) fightLog.turns++;
      if (actor.isPlayer) { if (!takeTurn()) { activeIndex = (activeIndex + 1) % turnQueue.length; continue; } }
      // F03: this used to be `actor.intent = rollIntent(actor); executeEnemyAi(actor)`, which
      // threw away the intent the player's whole turn had just been spent reading. The engine
      // rolls the NEXT intent at the END of executeEnemyAi (and at spawn, in initiateCombat),
      // and executes the one already on the entity - that is the icon on screen during the
      // player's turn. Re-rolling here meant threat(), breakTarget(), the EMP decision and
      // IRON_GUARD were all aimed at a board that was replaced before the blow, and gateIntent
      // was re-run at a different health state as well. The forecast is the contract; this file
      // was reading a different one.
      else executeEnemyAi(actor);
      // A pressed operator holds the floor - nextTurn does this in the real loop, and without
      // it PRESS is momentum spent on nothing and would measure as worthless.
      if (pressExtra && actor.isPlayer && actor.hp > 0) { pressExtra = false; continue; }
      activeIndex = (activeIndex + 1) % turnQueue.length;
    }
    // Whoever the fight ended without is on the record.
    (runStats.fallen || []).slice(stat.lost.length).forEach(f => stat.lost.push(f.name));
    activeEntities.forEach(e => { delete e.__counted; });
    stat.rounds += rounds;
    if (fled) { tallyScars(); stat.withdrawals++; return 'fled'; }
    const survived = activeEntities.some(e => e.isPlayer && e.hp > 0);
    const foesLeft = activeEntities.filter(e => !e.isPlayer && e.hp > 0).length;
    countBodies();
    const won = survived && foesLeft === 0;
    // checkWinState does this in the real loop, and without it the board's fight-end contracts
    // would read as content nobody ever settles. E01: counted, the engine reaches it for 354 of
    // 396 fight ends - so calling it unconditionally banked FLAWLESS, BLITZ, FRUGAL, CHASED and
    // GROUND twice on seven fights in eight. Reconciled, exactly as the skull and the elite
    // above are: top up only what the engine missed.
    if (won && (runStats.fightsWon || 0) === wonBefore) noteFightWon();
    // Nothing here called recoverDowned. The engine calls it on every ending - the victory
    // block, handleSquadWipe, withdraw, fallBackToNode - and this loop reached it only through
    // withdraw(), so a won fight left its casualties lying at zero health with a live bleed-out
    // clock. They walked into the NEXT initiateCombat still down, the queue ticked them, and the
    // sim killed operators the real game had already dragged clear. Every "lost for good" figure
    // this file has printed sat on that. It also meant scars, which are dealt inside
    // recoverDowned, could not be measured at all: the rate would have read zero whatever the
    // chance was set to.
    // How much clock was left on everyone the fight ended without picking up. This is the
    // measurement D09 turns on: a body dragged clear on 3 of 3 fell into a fight that was
    // already over, and the clock it started never began to bite.
    bleedingOut().forEach(e => stat.clockLeft.push(e.downTurns || 0));
    const up = recoverDowned(won ? 'once the field is held' : 'as the squad is dragged off');
    stat.recovered += up.length;
    tallyScars();
    combatActive = false;
    return won ? 'won' : 'lost';
  };

  // F05: bodies, counted once each. This was a re-scan of the field, once at a withdrawal and
  // once at the end of a fight, and a scan that can run twice over the same corpses is not a
  // cross-check on anything. Keyed by id - initiateCombat mints fresh ones per fight - so each
  // body is counted exactly once however many times it is looked at.
  const countedBodies = new Set();
  const countBodies = () => {
    activeEntities.filter(e => !e.isPlayer && e.hp <= 0).forEach(e => {
      if (countedBodies.has(e.id)) return;
      countedBodies.add(e.id); stat.kills++;
    });
  };

  // F03: a fuse is counted in NODES - consequencesDue reads nodesCleared - and the engine
  // resolves whatever is due after every one of them, because collectLoot ends in afterNode and
  // afterNode resolves first. This file only looked at the sector crossing, so a debt that came
  // due mid-sector waited for the boundary and was lost outright on every career that wiped
  // before reaching one - which was most of them. Through the engine's own resolver now, which
  // also means the cast meeting a consequence carries (meetCast) lands, where the hand copy
  // called the pool's resolve() and nothing else. Guarded on the due list so it never falls
  // into resolveConsequence's empty branch, which is a call to afterNode.
  //
  // G04: and the counter moved off this loop. finishQuietNode ends in afterNode now - the same
  // chain a fight's exit takes - so the engine settles what is due at an event, a camp, a shop
  // or a recruit door before this ever runs, and a counter that only counted its own iterations
  // reported those as never having happened. Measured 0.75/0.77/0.79 against 0.70/0.67/0.59 on
  // a paired 3 x 150: complete separation, and entirely an artefact of where the resolving was
  // being driven from. Counted off the pending list instead, so a resolution lands in the
  // number whichever side of the fence drove it.
  let lastPending = 0;
  const settleDue = () => {
    let guard = 0;
    while (consequencesDue().length && guard++ < 20) resolveConsequence();
    const now = pendingConsequences.length;
    if (now < lastPending) stat.consequences += lastPending - now;
    lastPending = now;
  };

  while (stat.nodes < capNodes) {
    if (currentTier > TOTAL_TIERS) {
      // The order runs out. The engine puts this on the map as two buttons; here it is taken,
      // because taking it is what the order is for - a run that signs for three sectors and
      // then walks past the transport has not measured a Sortie, it has measured a long road
      // with extra steps.
      if (isLastOrdered() && !runStats.won) {
        stat.fulfilled = true; stat.endedBy = 'recalled';
        orderHome();
        break;
      }
      // E01b: the engine's own crossing, no longer a hand copy of one. E01 had already found two
      // things the copy dropped - checkBountyProgress('SECTOR'), which made the S_SECTOR contract
      // unsettleable in every simulated career, and openingTier(), so a career that had paid for
      // Road Crew never got its head start - and patched those two by hand while noting that a
      // hand copy of a crossing is a list of whatever somebody remembered. crossSector is
      // advanceSector with the consequence chain lifted off it, so this can take the crossing
      // without also taking resolveConsequence's switchScreen and its fall-through to afterNode.
      // What the copy was still dropping on top of E01's two: the front rolled unseeded, so a
      // daily protocol did not fix the fronts it fixes for a player; the sector map likewise; the
      // forecast carried across a sector boundary; and no save was written at the crossing.
      crossSector();
      stat.frontsSeen.push(sectorFront);
      settleDue();
      spend();
      continue;
    }
    // Walk the generated route graph the way a player does: only what the last node connects
    // to is on offer, camps preferred when it hurts, then a recruit if one is still out there -
    // D10: this used to fall through to the same random pick as any plain fight, so "how often
    // does a run walk past a survivor" measured a policy that never looked for one rather than
    // the game. Three exist in a whole run against a dozen-odd elites, so it is weighed above
    // the elite pick and below urgent triage, not above it.
    const availIds = availableNodeIds();
    if (!availIds.length) { stat.endedBy = 'stranded'; break; }
    const avail = availIds.map(id => sectorMap.nodes.find(n => n.id === id)).filter(Boolean);
    const healthy = playerRoster.filter(p => p.gridPos > 0 && p.hp > p.maxHp * 0.6).length >= 2;
    const hurting = playerRoster.filter(p => p.gridPos > 0 && p.hp < p.maxHp * 0.5).length >= 2;
    const node = (hurting && avail.find(n => n.type === 'CAMP'))
              || (recruitables().length && avail.find(n => n.type === 'RECRUIT'))
              || (healthy && avail.find(n => n.elite))
              || avail[Math.floor(Math.random() * avail.length)];
    // H06: what the road OFFERED against what this policy took. "61 fights a run" is a fact
    // about the walk only if the walk had somewhere else to go - a map dense with camps that
    // this file routes past would make the same number and mean the opposite thing.
    const kindOf = n => n.elite ? 'ELITE' : n.type;
    const isFight = n => n.type === 'BOSS' || FIGHT_NODES.includes(n.type);
    avail.forEach(n => { stat.offeredNodes[kindOf(n)] = (stat.offeredNodes[kindOf(n)] || 0) + 1; });
    stat.forks++;
    if (avail.some(n => !isFight(n))) stat.forksWithChoice++;
    if (avail.every(n => isFight(n))) stat.forksAllFights++;
    stat.takenNodes[kindOf(node)] = (stat.takenNodes[kindOf(node)] || 0) + 1;
    if (!isFight(node)) stat.tookNonFight++;
    enterNode(node.id);

    if (node.type === 'EVENT') {
      stat.events++;
      const ev = pickEvent();
      // An event's choice list can depend on standing now, so it is asked for rather than read.
      if (ev.cast) meetCast(ev.cast);
      // H14: this line is the whole instrument for the flat-price question, and until now it
      // threw the answer away. choicesFor(ev) is what the card OFFERS; filtering by canAfford
      // leaves what this purse could pay for, and the ones dropped in between are exactly the
      // choices priced out - which is the thing the income constant moves. Ten choices in the
      // events and the faces charge sector-one constants that never move while income compounds
      // 1.4 a sector, so what they cost in real terms falls away as the road goes on.
      //
      // `priced` reads the choice's own gate rather than a list kept here, so a card added later
      // joins the count by existing rather than by somebody remembering to add it. It matches
      // the literal form only - a gate written against a variable is one that rides a curve,
      // which is the shape this is measuring the absence of.
      const shown = choicesFor(ev);
      const options = shown.filter(c => c.canAfford());
      const priced = c => /scrap\s*>=\s*\d+/.test(String(c.canAfford));
      const pricedShown = shown.filter(priced);
      stat.evShown += shown.length;
      stat.evPriced += pricedShown.length;
      stat.evPricedTook += pricedShown.filter(c => c.canAfford()).length;
      if (pricedShown.length) {
        const key = 's' + currentSector;
        const row = stat.pricedBySector[key] || (stat.pricedBySector[key] = { offered: 0, afford: 0 });
        row.offered += pricedShown.length;
        row.afford += pricedShown.filter(c => c.canAfford()).length;
      }
      if (ev.cast) stat.facesMet[ev.cast] = (stat.facesMet[ev.cast] || 0) + 1;
      if (FOLLOWUPS.some(f => f.title === ev.title)) stat.threads.push(ev.title);
      const owedBefore = pendingConsequences.length;
      // H08: the CEILING, not just the rate. 1.09 consequences a run is a fact about the game
      // only if the cards were offering more and this policy declined them - `--faces warm`
      // takes the standing-raising choice, and the choices that book a fuse are mostly the
      // greedy ones. Read off each option's own source, the same way the standing swing is.
      const booksOne = c => /bookConsequence\(/.test(String(c.execute));
      if (options.length) {
        stat.evOptions += options.length;
        stat.evBookable += options.filter(booksOne).length;
        if (options.some(booksOne)) stat.evCouldBook++;
      }
      if (options.length) {
        const swing = c => { const m = String(c.execute).match(/noteCast\(\s*'(\w+)'\s*,\s*(-?\d+)/);
                             return m ? Number(m[2]) : 0; };
        const best = facePolicy === 'warm' ? Math.max(...options.map(swing))
                   : facePolicy === 'cold' ? Math.min(...options.map(swing)) : null;
        const pool = best === null ? options : options.filter(c => swing(c) === best);
        pool[Math.floor(Math.random() * pool.length)].execute();
      }
      // A resolve rate is meaningless without the booking rate underneath it: six in seven
      // uncollected could be a fuse that never lands, or a debt that was never taken on.
      if (pendingConsequences.length > owedBefore) {
        stat.booked += pendingConsequences.length - owedBefore;
        stat.bookedFrom.EVENT = (stat.bookedFrom.EVENT || 0) + (pendingConsequences.length - owedBefore);
        lastPending = pendingConsequences.length;   // the baseline moves with a booking
        pendingConsequences.slice(owedBefore).forEach(c => { stat.bookedKinds[c.kind] = (stat.bookedKinds[c.kind] || 0) + 1; });
      }
      currentTier++; stat.nodes++; noteDepth(); runStats.nodes++;
      settleDue();
      continue;
    }
    if (node.type === 'CAMP') {
      stat.camps++;
      // F02: through the real door. A camp is now a screen the save can restore to, which means
      // resolveCamp will not spend a camp twice and finishCamp is what closes one - so a loop
      // that called resolveCamp with neither bracket around it took one cache per career and
      // silently no-opped every later one. The same hand-copy class E01b removed for the payout
      // and the crossing: the tier bump below used to be this file's own copy of finishCamp.
      initiateCamp();
      // The camp is where the door is, so it is where the decision gets made. This player walks
      // once the run is deep enough to be worth banking AND the squad is in no shape to keep
      // going: two of the line badly hurt, the bench gone, or nothing left to regroup with.
      const worn = playerRoster.filter(p => p.gridPos > 0 && p.hp < p.maxHp * 0.5).length >= 2
                || playerRoster.length <= 4
                || regroupsLeft() === 0;
      // H09: the same read, spent on the order rather than on the door. A squad in no shape to
      // keep going cuts the order down to the shortest road it can still be recalled from, which
      // is the decision re-signing exists for - and it is the one the walk-out cannot make,
      // because walking out ends the run and this does not. `--resign off` holds the old
      // behaviour so the two can be measured against each other with nothing else moved.
      if (resignPolicy !== 'off' && worn && typeof canResign === 'function' && canResign()) {
        const shortest = resignable().sort((a, b) => a.sectors - b.sectors)[0];
        const cur = orderById(runStats.order);
        if (shortest && cur && shortest.sectors < cur.sectors && resignOrder(shortest.id)) {
          stat.resigned = (stat.resigned || 0) + 1;
          stat.resignedTo = shortest.id;
          stat.resignedAt = currentSector;
        }
      }
      if (currentSector >= EXTRACT_AT && worn && canExtract()) {
        stat.extracted = true; stat.walkedAt = currentSector;
        stat.endedBy = 'extracted';
        extractRun();
        break;
      }
      // The camp is the second door a curse can come through, and it only opens when the squad
      // is in trouble. Counted whether or not this policy walks through it, so "how often was
      // the bargain even on the table" has a denominator that does not depend on the taker.
      const cache = cacheOffer();
      if (cache) stat.cacheOffered++;
      if (cache && (relicPolicy === 'curse' || (relicPolicy === 'random' && Math.random() < 0.5))) {
        stat.cacheTaken++; stat.cursedTaken++;
        resolveCamp('CACHE');           // takes the camp: no triage this stop
      } else {
        // F03: the engine's own triage, not a copy of it. The copy healed the deployed line by
        // a flat 0.35 and knew nothing about the bench MEDIC job, which is worth CAMP_TRIAGE_JOB
        // (0.55) and reaches the bench as well - so `--bench medic`, which this file offers as a
        // measurable lever, had exactly one place it could show up and the loop never went
        // there. It measured nothing at all.
        resolveCamp('TRIAGE');
      }
      stat.nodes++;
      finishCamp();
      settleDue();
      continue;
    }
    // H06: a sealed cache. Driven through the engine's own doors - initiateCache stages the
    // lock, openCache pays and finishes the node - so what this measures is the game's payout
    // and the game's bite rather than a copy of either. The policy is the obvious one: open it
    // clean when somebody on the line knows the trade, force it otherwise, because a cache the
    // squad walks away from is a node this file never took.
    if (node.type === 'CACHE') {
      initiateCache();
      const lock = cacheLockById(pendingCache && pendingCache.lock);
      const who = lock ? cacheOpener(lock) : null;
      stat.cachesMet++;
      if (lock) stat.cacheLocks[lock.id] = (stat.cacheLocks[lock.id] || 0) + 1;
      if (who) { stat.cachesClean++; stat.cacheOpener[who.classType] = (stat.cacheOpener[who.classType] || 0) + 1; }
      else stat.cachesForced++;
      const before = scrap;
      const owedBefore = pendingConsequences.length;
      openCache(!!who);
      stat.cacheScrap += Math.max(0, scrap - before);
      // H08: bookings from the road rather than from a card. Counted the same way the event
      // branch counts its own, and attributed, because "one a run from one source" and "two a
      // run from three" are the two readings this phase exists to tell apart.
      if (pendingConsequences.length > owedBefore) {
        const d = pendingConsequences.length - owedBefore;
        stat.booked += d; lastPending = pendingConsequences.length;
        pendingConsequences.slice(owedBefore).forEach(c => {
          stat.bookedKinds[c.kind] = (stat.bookedKinds[c.kind] || 0) + 1;
          stat.bookedFrom.CACHE = (stat.bookedFrom.CACHE || 0) + 1;
        });
      }
      stat.nodes++; noteDepth();
      settleDue();
      spend();
      continue;
    }
    if (node.type === 'RECRUIT') {
      // Signs anyone it can afford while keeping enough back for triage, and then actually
      // fields them - a recruit measured only as a purchase is a recruit nobody ever swung.
      initiateRecruit();
      const tpl = recruitById(pendingRecruit && pendingRecruit.id);
      // I03: what the LINE looked like at the moment of the offer, not just what the purse did.
      // H10 established this policy signs everything it can afford and therefore cannot produce a
      // finding about the card. Before writing one that can decline, the question is whether a
      // policy with taste would ever get to USE it: if the squad nearly always has a hole, taste
      // signs everything anyway and the arm is a null by construction. That is how H05, H07 and
      // H10 each dissolved, so it is measured first and the policy is written after.
      if (tpl) {
        const line = deployed();
        const bench = playerRoster.filter(c => c.gridPos === 0 && c.hp > 0);
        const weakest = line.length
          ? line.reduce((a, c) => (c.dmgBase < a.dmgBase ? c : a))
          : null;
        stat.recruitOffers.push({ cost: pendingRecruit.cost, purse: scrap,
          who: tpl.classType, rank: tpl.rank,
          // A hole is a slot the squad cannot fill: fewer bodies on the field than the line
          // seats, with nobody on the bench to bring up.
          //
          // I05: this read boardSlots(), which is BOARD_SLOTS - the number of CONTRACTS on the
          // bounty board - and not the squad line, which is DEPLOYED. Both are 3, so what it
          // printed was right by coincidence, and would have drifted the moment a career bought
          // the War Room, which adds one to the board and nothing to the line.
          seats: DEPLOYED, fielded: line.length, benched: bench.length,
          hole: Math.max(0, DEPLOYED - line.length - bench.length),
          lost: (runStats.fallen || []).length,
          // What it would be replacing, so "better than the worst hand I have" can be asked.
          weakDmg: weakest ? weakest.dmgBase : null,
          weakHp: weakest ? weakest.maxHp : null,
          cardDmg: tpl.dmgBase, cardHp: tpl.maxHp, cardSpd: tpl.speed });
      }
      // I03: the taste, kept strictly separate from the money. Both arms use the same
      // affordability gate below, so the ONLY difference between them is whether a full line
      // with nothing to gain is allowed to say no.
      //
      // The rating is dmgBase + maxHp / 4: damage is what an operator does every turn, health is
      // how many turns they get, and at these magnitudes a point of damage is worth roughly four
      // of health. It is a stated policy, not a truth - the point of the arm is that a policy
      // with ANY taste can decline, not that this is the best taste available. A recruit also
      // arrives with perk points banked to squad par, which no stat comparison sees, so this
      // rating understates them; that is named here rather than buried, because it bounds what
      // the arm can conclude.
      const rate = rateOf;
      let wants = true, why = 'price';
      if ((recruitPolicy === 'value' || recruitPolicy === 'burn') && tpl) {
        const line = deployed();
        const bench = playerRoster.filter(c => c.gridPos === 0 && c.hp > 0);
        const hole = Math.max(0, DEPLOYED - line.length - bench.length);
        const worst = line.length ? line.reduce((a, c) => (rate(c) < rate(a) ? c : a)) : null;
        if (hole > 0) { wants = true; why = 'hole'; }
        else if (!worst || rate(tpl) > rate(worst)) { wants = true; why = 'better'; }
        else { wants = false; why = 'declined'; }
        stat.recruitWhy[why] = (stat.recruitWhy[why] || 0) + 1;
        // The counterfactual has to be exact: burn takes the money only where PRICE would have
        // signed - a declined offer this purse could have paid for while keeping the reserve.
        // Burning on one price could not have afforded either would invent a cost the arm it is
        // compared against never bore.
        if (recruitPolicy === 'burn' && !wants && scrap >= pendingRecruit.cost + 80) {
          scrap = Math.max(0, scrap - pendingRecruit.cost);
          stat.recruitBurned = (stat.recruitBurned || 0) + 1;
        }
      }
      if (tpl && wants && scrap >= pendingRecruit.cost + 80) {
        const owedBefore = pendingConsequences.length;
        signOnRecruit();
        if (pendingConsequences.length > owedBefore) {
          const d = pendingConsequences.length - owedBefore;
          stat.booked += d; lastPending = pendingConsequences.length;
          pendingConsequences.slice(owedBefore).forEach(c => {
            stat.bookedKinds[c.kind] = (stat.bookedKinds[c.kind] || 0) + 1;
            stat.bookedFrom.RECRUIT = (stat.bookedFrom.RECRUIT || 0) + 1;
          });
        }
        applyBench(playerRoster.find(c => c.id === tpl.id));   // F03: same deck rule as the muster
        stat.recruited.push(tpl.classType);
        // I05: this used tpl.rank as a BOARD SLOT. rank is the label printed on the card -
        // I04 established the engine deletes it on signing - and it happens to run 1, 2, 3 over
        // a pool of three, so it landed on a real slot every time and never looked wrong. The
        // line is DEPLOYED = 3 and the roster opens with all three held, so there was never a
        // free slot: every signature threw a healthy, fully-upgraded, fully-levelled operator
        // onto the bench to field a recruit at 60% of their bar carrying no upgrades at all. The
        // game does not do this - signOnRecruit leaves them at gridPos 0 for the player to place.
        //
        // Through assignSlot now, which is the engine's own door: it keeps SHORT_HANDED's ban on
        // slot 3 and calls checkDoctrine, neither of which the hand copy did. And placed on
        // merit rather than on a label - a free slot if the line has lost somebody, otherwise
        // over the weakest hand on it, otherwise not at all.
        const me = playerRoster.find(c => c.id === tpl.id);
        if (me) {
          const line = playerRoster.filter(c => c.gridPos > 0);
          const held = new Set(line.map(c => c.gridPos));
          let free = 0;
          for (let sl = 1; sl <= DEPLOYED; sl++) if (!held.has(sl)) { free = sl; break; }
          if (free) { assignSlot(me.id, free); stat.recruitFielded = (stat.recruitFielded || 0) + 1; }
          else {
            const worst = line.length ? line.reduce((a, c) => (rate(c) < rate(a) ? c : a)) : null;
            // I08: the decision, decomposed, so the gap can be read against what bought it.
            // After the muster the only thing that moves either term of rate() is buyUpgrade -
            // +10 maxHp or +3 dmgBase a purchase, so 2.5 or 3 points of rate each. signOnRecruit
            // levels a recruit to squad par and banks a point a level, so the LEVEL gap is
            // closed by the engine; upgradeCount is not, and arrives at 0.
            if (worst) {
              stat.fieldGap.push(Math.round((rate(worst) - rate(me)) * 10) / 10);
              stat.fieldUps.push(worst.upgradeCount);
              stat.fieldMine.push(me.upgradeCount);
            }
            if (worst && rate(me) > rate(worst)) {
              assignSlot(me.id, worst.gridPos);
              stat.recruitFielded = (stat.recruitFielded || 0) + 1;
            } else stat.recruitBenched = (stat.recruitBenched || 0) + 1;
          }
        }
      } else {
        leaveRecruit();
      }
      pendingRecruit = null;
      currentTier++; stat.nodes++; noteDepth(); runStats.nodes++;
      settleDue();
      continue;
    }
    if (node.type === 'SHOP') {
      stat.shops++;
      initiateShop();
      // Buys the way a player would: gear first, tempo second, the bond and the marked-up
      // relic only when flush. The keep argument is scrap held back for triage.
      const buy = (kind, keep) => {
        const i = activeShop.stock.findIndex(s => s.kind === kind && !s.sold && !s.withdrawn);
        if (i >= 0 && scrap >= activeShop.stock[i].price + keep) {
          const before = scrap; buyShopItem(i); stat.shopScrap += before - scrap;
        }
      };
      // K07: the shelf sells ONE of several now, so which one is a decision this file has to
      // make rather than fall into. `shelfSee` trims what it is allowed to look at and
      // __gearPick chooses among those; buyShopItem does the withdrawing, so nothing here
      // reimplements the rule. Booked so the arms can be told apart afterwards.
      const shelf = activeShop.stock.map((s, i) => ({ ...s, i }))
        .filter(s => s.kind === 'GEAR' && !s.sold && !s.withdrawn).slice(0, shelfSee);
      if (shelf.length) {
        stat.shelfSeen = (stat.shelfSeen || 0) + shelf.length;
        stat.shelfShown = (stat.shelfShown || 0) + activeShop.stock.filter(s => s.kind === 'GEAR').length;
        // K07: a shelf is only a choice if the line can wear what is on it. Mods are class-locked
        // and twenty of the twenty-eight pieces are mods, so a shelf can come up entirely made of
        // gear for classes nobody is fielding. Counted rather than assumed: `usable` asks the
        // engine's own fit rule, and `shelfDud` is how often the answer was none of them.
        const fits = row => { const g = gearById(row.id);
          return !!g && (g.slot !== 'mod' || playerRoster.some(c => c.gridPos > 0 && c.classType === g.cls)); };
        const wearable = shelf.filter(fits);
        stat.shelfUsable = (stat.shelfUsable || 0) + wearable.length;
        if (!wearable.length) stat.shelfDud = (stat.shelfDud || 0) + 1;
        // 140 scrap for a mod nobody on the line can equip is not a purchase a player makes, and
        // this file was making it: equipGear refuses the fit and the piece sits in the stash for
        // the rest of the run. It buys off the wearable rows or it buys nothing.
        const want = wearable.length ? window.__gearPick(wearable) : null;
        if (want && scrap >= want.price + 60) {
          const before = scrap; buyShopItem(want.i); stat.shopScrap += before - scrap;
          stat.shelfTook = stat.shelfTook || {};
          stat.shelfTook[want.id] = (stat.shelfTook[want.id] || 0) + 1;
        }
      }
      buy('STIM', 40); buy('STIM', 40); buy('INSURANCE', 150); buy('RELIC', 400);
      finishShop();
      stat.nodes++;
      settleDue();
      continue;
    }

    if (node.type === 'BOSS') {
      const b = bossForSector();
      // H04. The brief calls tiers 6-9 "attrition without jeopardy" on the strength of where
      // wipes are RECORDED - 80% at tier ten. That reading is only sound if what the road takes
      // out of a squad does not decide the fight at the top of it. So the arrival is recorded
      // with the outcome: a squad that walks in at half strength and one that walks in fresh are
      // the two halves of the question, and the engine's own line is what is read.
      const line = deployed();
      const hp = line.reduce((a, u) => a + Math.max(0, u.hp), 0);
      const max = line.reduce((a, u) => a + u.maxHp, 0);
      stat.bossMet.push({ id: b.id, grudge: grudgeOn(b.id), sector: currentSector,
                          share: max ? +(hp / max).toFixed(3) : 0,
                          line: line.length, standing: line.filter(u => u.hp > 0).length,
                          lvl: line.length ? +(line.reduce((a, u) => a + (u.level || 1), 0) / line.length).toFixed(2) : 0,
                          relics: activeRelics.length, regroups: regroupsLeft(),
                          bag: inventory.length, roster: playerRoster.length,
                          // The policy above heals every operator to full after EVERY node while
                          // the scrap lasts, so a squad that walks in hurt is one that could not
                          // pay - not one that chose not to. Recorded with the purse and with
                          // what the engine would have charged to finish the job, so "could not
                          // afford it" is read off the game's own price rather than asserted.
                          scrap, toHeal: deployed().reduce((a, u) => a + (u.hp > 0 && u.hp < u.maxHp
                            && typeof patchUpCost === 'function' ? patchUpCost(u) : 0), 0) });
    }
    currentNodeType = node.type; isCurrentNodeElite = !!node.elite;
    // What the fight is standing under and on, recorded as the pair rather than two tallies:
    // the marginals fall out of it, and so does the confluence, which only exists as a pair.
    const cell = `${node.weather || 'CLEAR'}|${node.terrain || 'OPEN_ROAD'}`;
    stat.field[cell] = (stat.field[cell] || 0) + 1;
    noteBoard();
    const outcome = fight(node.type, !!node.elite);
    if (node.type === 'BOSS') {
      const met = stat.bossMet[stat.bossMet.length - 1];
      // H04: the KIND of ending, not just whether it was a kill. `won` folds a fight that was
      // fought and lost together with one this policy declined, and a hurt squad declining is a
      // fact about the robot rather than about the road - which is exactly the reading the
      // arrival buckets would otherwise be making.
      if (met) { met.won = outcome === 'won'; met.outcome = outcome; }
    }
    stat.nodes++;

    // Leaving already advanced the tier and left the node behind - and the engine deliberately
    // does not count it as one cleared, so neither does this. A node lost and then regrouped
    // through is not one cleared either: the engine never reaches collectLoot on a wipe, so
    // runStats.nodes is counted by bankNode below rather than here, where it used to fire for
    // won and lost alike.
    if (outcome === 'fled') { spend(); continue; }

    if (outcome === 'lost') {
      stat.wipes++;
      stat.wipedInSector.push(currentSector); stat.wipedAtTier.push(currentTier); stat.wipedOnElite.push(!!node.elite);
      if (node.type === 'BOSS') stat.metGrudge.push(grudgeOn(bossForSector().id));
      if (regroupsLeft() > 0) { stat.regroupsSpent++; regroupSquad(); spend(); continue; }
      stat.endedBy = 'wiped'; break;
    }

    // The killing blow goes through resolveAction, which calls checkWinState, which is where the
    // engine banks a skull, counts the boss or elite, notes the grudge and rolls the drop. This
    // block used to do all of it AGAIN: bosses, elites, skulls and grudges were counted twice
    // and every run held about double the relics it should. Measured on a staged kill, skulls
    // went 0 -> 1 in the engine and then 1 -> 2 here. Score reads bosses x900 + elites x250, so
    // every figure this file has ever printed was high by roughly a fifth.
    //
    // What stays is only what the engine does NOT do at this point: its scrap is handed out by
    // collectLoot, behind a LOOT button no simulator presses, and stat.* are this file's own
    // counters. Those own counters are checked against the engine's below - if the two ever
    // disagree again the report says so instead of quietly printing a doubled number.
    // Reconcile rather than add. The engine counts the kill inside checkWinState, which
    // resolveAction reaches - but this loop walks the turn queue itself and calls
    // applyTurnStartEffects directly, so a fight ended by a bleed tick or a death effect never
    // gets there. Measured: 55 of 63 bosses and 224 of 233 elites reached it. Adding
    // unconditionally double-counted the 55; skipping entirely lost the 8. So top up only what
    // the engine missed - the check at the end confirmed the two routes then agreed exactly.
    //
    // What the whole correction was worth, over sixty expeditions each:
    //
    //                     doubled   skipped   reconciled
    //   median score       10,650     8,670        8,355
    //   relics held, mean      8.7       3.8          3.4
    //   bosses felled         1.38      1.05         1.02
    //   deepest sector, mean   2.4       2.0          2.0
    //
    // The depth row is the one that matters beyond the arithmetic. Relics are power, so a squad
    // carrying twice as many got deeper: this file was reporting an easier game than the one
    // that exists, and every difficulty figure taken from it before this sat on that baseline.
    if (node.type === 'BOSS') {
      stat.bosses++;
      if (runStats.bosses < stat.bosses) {
        stat.bossTopUps++;
        runStats.bosses = stat.bosses; bossSkulls++;
        const felled = activeEntities.find(e => e.classType === 'BOSS');
        if (felled && felled.bossId) {
          stat.bossGrudge.push(felled.grudge || 0); noteGrudge(felled.bossId);
          runStats.warlords = runStats.warlords || []; runStats.warlords.push(felled.bossId);
          // The win banks inside checkWinState, and this loop reaches checkWinState for about
          // seven kills in eight - a fight ended by a bleed tick or a death effect never gets
          // there. Reconciled rather than added, exactly as the skull above is: without this,
          // one win in eight would have gone unrecorded and the rate read low.
          if (felled.isFinal) noteVictory();
          // F03: and the rest of what checkWinState pays for a commander, which this top-up
          // did not. The fallback refund is the one that moves depth - a kill that lands on a
          // bleed tick left the harness entering the next sector one fallback short of what a
          // player has - and the grudge skulls are the one that moves the Citadel.
          const owed = felled.grudge || 0;
          if (owed > 0) bossSkulls += owed;
        }
        if (runStats.regroups < totalRegroups()) runStats.regroups++;
        checkBountyProgress('BOSS');
        // G06: the flag, not a hand copy of the price. The collector is settled inside bankNode
        // now - the one choke point this file and the engine both bank through - so the top-up
        // only has to say that a warlord fell, the same as the engine's own branch does.
        if (hasRelic('SCAVENGERS_DEBT')) collectorDue = true;
        const gDrop = rollGear(); if (gDrop) gearStash.push(gDrop);
        // The engine did not count this kill, so it did not stage the offer either. Stage it.
        if (!pendingRelicOffer) { const o = rollRelicOffer(); if (o.length) pendingRelicOffer = o; }
      }
      // What the ossuary raised, and what it was holding when it died - the two numbers that
      // say whether the last fight is doing what it was built to do.
      const last = activeEntities.find(e => e.isFinal);
      if (last) { stat.raised = activeEntities.filter(e => e.classType === 'REVENANT').length;
                  stat.stillUp = activeEntities.filter(e => e.classType === 'REVENANT' && e.hp > 0).length;
                  stat.tallyAtEnd = last.tallyStacks || 0; }
      // The engine stages a commander's relic as pendingRelicOffer and waits for a player to
      // pick a card. This file never touched pendingRelicOffer, so once the double-count fix
      // made it defer to the engine's own count, every commander relic was staged and then
      // dropped on the floor: 108 boss kills across sixty runs produced 11 relics. Everything
      // read off "relics held" since then, the cursed tier included, was measuring that leak.
      if (pendingRelicOffer && pendingRelicOffer.length) {
        const offer = pendingRelicOffer;
        stat.relicOffers++;
        const curse = offer.find(r => r.tier === 'CURSED');
        if (curse) stat.cursedOffered++;
        const any = a => a[Math.floor(Math.random() * a.length)];
        const clean = offer.filter(r => r.tier !== 'CURSED');
        const pick = relicPolicy === 'curse'  ? (curse || offer.find(r => r.tier === 'RARE') || any(offer))
                   : relicPolicy === 'avoid'  ? (offer.find(r => r.tier === 'RARE') || any(clean.length ? clean : offer))
                   : relicPolicy === 'random' ? any(offer)
                   : (offer.find(r => r.tier === 'RARE') || any(offer));
        if (pick.tier === 'CURSED') stat.cursedTaken++;
        takeRelic(offer.indexOf(pick));
      }
    }
    if (node.elite) {
      stat.elites++;
      if (runStats.elites < stat.elites) {
        stat.eliteTopUps++;
        runStats.elites = stat.elites; checkBountyProgress('ELITE');
        // F03: the engine's elite block rolls gear on a Vulture or a 40% roll before it rolls
        // the relic; the top-up rolled only the relic.
        if (hasRelic('VULTURE_ROYALTY') || Math.random() < 0.4) {
          const gDrop = rollGear(); if (gDrop) gearStash.push(gDrop);
        }
        const drop = rollRelic();
        if (drop) activeRelics.push(drop);
      }
    }
    // E01: the engine ticks KILL inside applyDamageHit, once for every hostile that drops
    // (game.js:8907), and this loop reaches applyDamageHit through both resolveAction and
    // applyTurnStartEffects. A tick per cleared node on top of that was a second count of a
    // contract the engine had already settled.
    // F05: the engine's own count stands, and this file's is the cross-check rather than the
    // answer. It used to be the other way round - `runStats.kills = stat.kills` - because
    // before F05 the engine's ledger was short by every kill a status tick, a RECKONING or the
    // Hazmat's tanks landed, and overwriting it with a field scan was the cheapest repair.
    //
    // The scan is a LOWER bound and always was: it counts bodies left on the field at the end
    // of a fight, so a unit raised by RESURGENCE or WHISTLE and put down again is two kills and
    // one body. Measured over forty careers, the overwrite was losing four second deaths in
    // 6,799. So the direction that means something is the other one - MORE bodies than the
    // engine banked is a path reaching zero without the ledger, which is exactly what this
    // phase was filed on.
    stat.engineKills = runStats.kills || 0;
    // E01b: the engine's own payout and the engine's own banking of it. This used to pay a flat
    // 20 base where checkWinState rolls 0-29, and knew nothing about the front's ledger (a
    // warband's raiders and a quiet sector's boss both carry double), the Vulture's 25% cut, the
    // Scrap Magnet's stipend or the Collector's 40 - and then, because it never reached
    // collectLoot, RATIONING's cut and closeRanks had never once run on a won fight in
    // simulation. A career under RATIONING was measured being paid in full, and a squad that
    // lost somebody fought the rest of the sector short-handed with a bench standing behind it.
    // E01 had already found this recording a flat 40 whatever the node paid.
    bankNode(fightPayout());
    // The engine's own order: collectLoot is bankNode then afterNode, and afterNode settles
    // anything due before anything else. (F03)
    settleDue();

    // The end of the road. The engine puts this question on a screen with two buttons; here it
    // is a policy, so both answers can be measured. Either way the win is already banked - what
    // the policy decides is only whether the expedition stops on it.
    if (runStats.won && !runStats.winShown) {
      runStats.winShown = true;
      stat.won = true; stat.wonAt = runStats.wonAtSector || currentSector;
      stat.roadWarlords = roadWarlords(runStats).length;
      if (endingPolicy !== 'press') { stat.endedBy = 'won'; victoryWalk(); break; }
    }
    spend();

    noteBoard();
    const boardNow = bountiesAtStart();
    if (boardNow !== boardBefore) { stat.bountiesDone++; boardBefore = boardNow; }
  }

  // The instrument checks itself: these count the same events by different routes, and the
  // whole point of the block above is that they must not diverge.
  // F05: one number per career, not one per fight - both counters are cumulative, so adding
  // the difference after every fight re-counts a gap that opened once.
  stat.engineKills = runStats.kills || 0;
  stat.killGap = Math.max(0, stat.kills - stat.engineKills);
  stat.order = runStats.order;
  // F03: THE LONG ROAD can only be kept by clearing the last sector, and a run that clears it
  // has runStats.won set - so the recall branch above, the only place this file set the flag,
  // is a branch LONG can never reach. The engine sets runStats.fulfilled itself; read it. The
  // readout printed "kept 0 of 60" while the engine had marked every won run as keeping it.
  stat.fulfilled = stat.fulfilled || !!runStats.fulfilled;
  stat.engineBosses = runStats.bosses; stat.engineElites = runStats.elites;
  stat.standings = Object.fromEntries(facesMet().map(f => [f.id, f.standing]));
  stat.sector = runStats.deepestSector; stat.tier = runStats.deepestTier;
  stat.relics = activeRelics.map(r => r.id);
  stat.score = computeScore(runStats);
  stat.regroupsLeft = regroupsLeft();
  stat.maxBond = Object.values(bonds).length ? Math.max(...Object.values(bonds)) : 0;
  stat.bondSaves = runStats.bondSaves || 0;
  // J01: what the sky took, asked of the engine's own ledger rather than recomputed here. The
  // question is whether the weather curve fits the fight it happens in: the two sites scale on
  // `1 + (currentTier - 1) * 0.4`, which resets to 1.0 at every sector boundary, while the
  // enemies beside them ride SECTOR_HP_SCALE per sector and never reset.
  stat.wxTookPlayer = runStats.wxTookPlayer || 0;
  stat.wxTookFoe = runStats.wxTookFoe || 0;
  stat.wxTurns = runStats.wxTurns || 0;
  stat.wxBySector = runStats.wxBySector || {};
  stat.wxTurnsBySector = runStats.wxTurnsBySector || {};
  stat.wxShrPlayer = runStats.wxShrPlayer || {};
  stat.wxShrFoe = runStats.wxShrFoe || {};
  stat.plate = runStats.plate || {};
  stat.dt = runStats.dt || {};
  // K05: what came out of the materials bag and by which door, plus what was still sitting in
  // it when the run ended. The leftover is read off `materials` rather than derived, because
  // income arrives at twenty different sites and a second copy of that sum would be wrong the
  // first time one of them moved.
  stat.mat = runStats.mat || { craft: {}, aug: {}, crafted: {}, augged: {} };
  stat.gear = runStats.gear || { worn: {}, slot: {} };
  // K06: and what is standing on the line at the end of it - worn is a count of equippings and
  // a piece can be taken off again, so what an operator ACTUALLY finished the run wearing is
  // read off the roster rather than inferred from the ledger.
  stat.trinketsHeld = playerRoster.filter(c => c.trinket).map(c => c.trinket);
  stat.matLeft = { ...materials };
  // K05: and how full each body ended up. A catalogue the same size as the cap means a filled
  // operator carries the whole catalogue, so the shape of this histogram is the question - if
  // most augmented bodies sit at the cap, there was never a choice about WHICH, only about who.
  stat.augFill = playerRoster.map(c => (c.augments || []).length);
  // K05: and WHAT a filled body carries, as a multiset rather than a count. The manual promises
  // "three of one is a build; one of each is a checklist" and nothing has ever checked which of
  // those a run actually produces - installAugment caps slots, not repeats, so both are legal.
  stat.augSets = playerRoster.filter(c => (c.augments || []).length > 0)
    .map(c => [...c.augments].sort().join('+'));
  stat.wxByCause = runStats.wxByCause || {};
  if (window.__sk) {
    const k = window.__sk;
    k.earned += Math.max(0, (bossSkulls - k.runStart) + k.runSpent);
    stat.skullLedger = { earned: k.earned, meta: k.meta, req: k.req, onHand: bossSkulls };
  }
  return stat;
};

(async () => {
  const { server, port } = await serve(ROOT);
  const launch = {};
  if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
  const browser = await chromium.launch(launch);
  const context = await browser.newContext({ viewport: { width: 400, height: 800 } });
  await context.addInitScript(() => {
    let engine;
    Object.defineProperty(window, 'WP', {
      configurable: true,
      get: () => engine,
      set: value => {
        engine = value;
        for (const [key, desc] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
          if (key in window) continue;
          try { Object.defineProperty(window, key, { ...desc, configurable: true }); } catch (e) {}
        }
      }
    });
  });
  const page = await context.newPage();
  const errors = [];
  let ALL_FORMATION_IDS = [];
  let FORMATION_FACTION = {};
  let SCAR_IDS = [];
  let FINAL_SECTOR_N = 7;
  let ORDER_NAME = '', ORDER_SECTORS = 7;
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForTimeout(800);
  // E01: nobody is watching this one. Profiled through the CDP sampler, 73% of an expedition was
  // going into forced synchronous layout that no reported number reads - getBoundingClientRect
  // alone 45%, fitField 13.7%, log's scroll pin 13.4%, the hit flash's offsetWidth 5.5%. The
  // engine still runs every rule; it just stops measuring a screen no one is looking at.
  await page.evaluate(() => { globalSettings.sfx = false; paintOff = true; });
  ALL_FORMATION_IDS = await page.evaluate(() => ALL_FORMATIONS.map(f => f.id));
  // H11: which faction owns which shape, asked of the engine rather than listed here, so a new
  // formation or a retimed table needs no edit in this file to be reported.
  FORMATION_FACTION = await page.evaluate(() =>
    Object.fromEntries(Object.entries(FORMATIONS).map(([k, v]) => [k, v.map(f => f.id)])));
  SCAR_IDS = await page.evaluate(() => SCAR_POOL.map(sc => sc.id));
  FINAL_SECTOR_N = await page.evaluate(() => FINAL_SECTOR);
  const ordSpec = await page.evaluate(id => { const o = orderById(id); return o ? { name: o.name, sectors: o.sectors } : null; }, ORDER);
  ORDER_NAME = ordSpec ? ordSpec.name : ORDER;
  ORDER_SECTORS = ordSpec ? ordSpec.sectors : FINAL_SECTOR_N;

  console.log(`\nSimulating ${RUNS} expeditions at difficulty ${DIFFICULTY}, draft ${DRAFT}${BENCH !== 'off' ? `, bench ${BENCH}` : ''}, tactics ${TACTICS}, relics ${RELICS}, meta ${META}, faces ${FACES}${RUNG > 0 ? `, ascension \u25B2${RUNG}` : ''}` +
              (CONTRACTS.length ? ` under ${CONTRACTS.join(', ')}` : '') +
              (WITHDRAW_POLICY ? ', running from fights it is losing' : ', fighting every node to a finish') + '\n');

  const results = [];
  for (let i = 0; i < RUNS; i++) {
    const r = await page.evaluate(EXPEDITION, { difficulty: DIFFICULTY, contracts: CONTRACTS, capNodes: 400, withdrawPolicy: WITHDRAW_POLICY, EXTRACT_AT, draftPolicy: DRAFT, benchPolicy: BENCH, tacticPolicy: TACTICS, AUGMENTS_ON, augPolicy: AUGMENT_POLICY, augCat: AUGMENT_CAT, augMax: AUGMENT_MAX, shelfSee: SHELF_SEE, shopPick: SHOP_PICK, trinketArm: TRINKET_ARM, relicPolicy: RELICS, metaPolicy: META, facePolicy: FACES, endingPolicy: ENDING, orderPolicy: ORDER, rungPolicy: RUNG, stagePolicy: STAGE, stageProfile: STAGE_PROFILE, reckoning: RECKONING, reqPolicy: REQPOLICY, rescuePolicy: RESCUE, resignPolicy: RESIGN, recruitPolicy: RECRUIT, investPolicy: INVEST });
    results.push(r);
    if ((i + 1) % 10 === 0) process.stdout.write(`  ${i + 1}/${RUNS}\n`);
  }

  const n = results.length;
  const nums = key => results.map(r => r[key]).sort((a, b) => a - b);
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const pct = (a, p) => a[Math.min(a.length - 1, Math.floor(a.length * p))];
  // How wide that median actually is at the sample size taken. Every bad balance claim in this
  // file's history was a point estimate compared against another point estimate - N11 reported
  // +49% and re-measured to a DECREASE, and a ladder reprice was derived, applied and reverted
  // inside one session. The note at the top says "150+ before believing anything about score",
  // which is a rule of thumb standing in for the thing you actually want: an error bar.
  //
  // Resample the runs with replacement, take the median of each resample, and report the middle
  // 90% of those medians. Two arms whose intervals overlap have not been shown to differ, at
  // whatever N was affordable - which is a statement this file can make at 60 runs and could
  // never make at 150 without one.
  const bootCI = (a, p = 0.5, draws = 2000) => {
    if (!a.length) return [0, 0];
    const meds = [];
    for (let i = 0; i < draws; i++) {
      const s2 = new Array(a.length);
      for (let j = 0; j < a.length; j++) s2[j] = a[(Math.random() * a.length) | 0];
      s2.sort((x, y) => x - y);
      meds.push(pct(s2, p));
    }
    meds.sort((x, y) => x - y);
    return [meds[(draws * 0.05) | 0], meds[(draws * 0.95) | 0]];
  };
  const withCI = (a, fmt = (v => v)) => {
    const [lo, hi] = bootCI(a);
    return `${fmt(pct(a, 0.5))}   [90% ${fmt(lo)} to ${fmt(hi)}]`;
  };
  const line = (label, v) => console.log(`  ${String(label).padEnd(26)} ${v}`);

  const signed = {};
  let withRecruits = 0;
  results.forEach(r => { if (r.recruited.length) withRecruits++; r.recruited.forEach(c => { signed[c] = (signed[c] || 0) + 1; }); });
  const met = results.flatMap(r => r.bossMet).filter(m => m.won !== undefined);
  const cold = met.filter(m => !m.grudge), risen = met.filter(m => m.grudge > 0);
  const rate = a => a.length ? (a.filter(m => m.won).length / a.length * 100).toFixed(0) + '%' : '-';
  console.log('\n── COMMANDERS ' + '─'.repeat(46));
  line('fights reached, total', met.length);
  line('met for the first time', `${cold.length} fought, ${rate(cold)} won`);
  line('met again, carrying a grudge', `${risen.length} fought, ${rate(risen)} won`);
  [1, 2, 3].forEach(g => { const a = met.filter(m => m.grudge === g);
    if (a.length) line(`  risen ×${g}`, `${a.length} fought, ${rate(a)} won`); });

  // H04: WHAT THE WALK IS WORTH. The brief reads 80% of wipes at tier ten and concludes the
  // nine tiers below are attrition without jeopardy. That follows only if the attrition does
  // not decide the fight it delivers the squad into. Bucketed by the state the squad arrived
  // in, against whether the commander fell - so the road is judged on what it changes rather
  // than on where the loss happens to be recorded.
  const arrived = met.filter(m => typeof m.share === 'number');
  if (arrived.length) {
    const bucket = [[0, 0.4, 'under 40%'], [0.4, 0.6, '40-60%'], [0.6, 0.8, '60-80%'], [0.8, 1.01, 'over 80%']];
    bucket.forEach(([lo, hi, name]) => {
      const a = arrived.filter(m => m.share >= lo && m.share < hi);
      if (a.length) line(`  arrived ${name}`, `${a.length} fights, ${rate(a)} felled`);
    });
    const full = arrived.filter(m => m.standing === m.line);
    const down = arrived.filter(m => m.standing < m.line);
    line('  arrived with everyone up', `${full.length} fights, ${rate(full)} felled`);
    if (down.length) line('  arrived a body short', `${down.length} fights, ${rate(down)} felled`);
    const mean = a => a.length ? (a.reduce((x, m) => x + m.share, 0) / a.length) : 0;
    const wonA = arrived.filter(m => m.won), lostA = arrived.filter(m => !m.won);
    line('  mean arrival health', `${(mean(wonA) * 100).toFixed(0)}% when it fell, ${(mean(lostA) * 100).toFixed(0)}% when it did not`);
    const lvl = a => a.length ? (a.reduce((x, m) => x + m.lvl, 0) / a.length) : 0;
    line('  mean arrival level', `${lvl(wonA).toFixed(1)} when it fell, ${lvl(lostA).toFixed(1)} when it did not`);
    const rel = a => a.length ? (a.reduce((x, m) => x + m.relics, 0) / a.length) : 0;
    line('  mean relics carried', `${rel(wonA).toFixed(1)} when it fell, ${rel(lostA).toFixed(1)} when it did not`);
    // THE CONFOUND, CONTROLLED. Read flat, the buckets above say a hurt squad never fells a
    // commander - and the same table says the squads that LOST were higher level and carrying
    // MORE relics, which is the signature of sector depth rather than of weakness. A deeper
    // sector means a longer road, a harder commander, more levels and more relics all at once,
    // so sector is a common cause of arriving hurt and of losing, and the flat bucketing cannot
    // tell that apart from the road mattering. Split within sector: if the road is what decides
    // the fight, hurt still loses to healthy at the SAME depth against the SAME commander.
    const sectors = [...new Set(arrived.map(m => m.sector))].sort((a, b) => a - b);
    console.log('   within a sector, arriving hurt against arriving fresh');
    sectors.forEach(sec => {
      const a = arrived.filter(m => m.sector === sec);
      if (a.length < 8) return;
      const hurt = a.filter(m => m.share < 0.8), fresh = a.filter(m => m.share >= 0.8);
      if (!hurt.length || !fresh.length) {
        line(`    sector ${sec}`, `${a.length} fights, all arrived ${hurt.length ? 'hurt' : 'fresh'} - nothing to compare`);
        return;
      }
      line(`    sector ${sec}`, `hurt ${hurt.length} fights ${rate(hurt)} felled  |  fresh ${fresh.length} fights ${rate(fresh)} felled`);
    });
    // And how those fights ended, which is what says whether 0% is the road or the robot.
    const kinds = a => { const k = {}; a.forEach(m => { k[m.outcome || '?'] = (k[m.outcome || '?'] || 0) + 1; });
                         return Object.entries(k).sort((x, y) => y[1] - x[1]).map(([n, c]) => `${n} ${c}`).join(', '); };
    const hurtAll = arrived.filter(m => m.share < 0.8), freshAll = arrived.filter(m => m.share >= 0.8);
    line('  how the hurt arrivals ended', kinds(hurtAll) || 'none');
    line('  how the fresh arrivals ended', kinds(freshAll) || 'none');
    // WHY THEY WALKED IN HURT. The sim's own policy heals to full at every node it can pay for,
    // so this separates "did not heal" from "could not".
    const purse = a => a.length ? Math.round(a.reduce((x, m) => x + (m.scrap || 0), 0) / a.length) : 0;
    const owed = a => a.length ? Math.round(a.reduce((x, m) => x + (m.toHeal || 0), 0) / a.length) : 0;
    line('  scrap in hand on arrival', `${purse(hurtAll)} hurt, ${purse(freshAll)} fresh`);
    line('  what topping up would have cost', `${owed(hurtAll)} hurt, ${owed(freshAll)} fresh`);
    const broke = hurtAll.filter(m => (m.scrap || 0) < (m.toHeal || 0));
    line('  hurt arrivals that could not pay', `${broke.length} of ${hurtAll.length}`);
  }

  console.log('\n── THE DEAD ' + '─'.repeat(48));
  const downs = results.reduce((a, r) => a + r.downs, 0);
  const saves = results.reduce((a, r) => a + r.saves, 0);
  const lost = results.reduce((a, r) => a + r.lost.length, 0);
  const lostPer = results.map(r => r.lost.length).sort((a, b) => a - b);
  const recovered = results.reduce((a, r) => a + r.recovered, 0);
  line('operators put on the floor', `${downs} (${(downs / n).toFixed(1)} per run)`);
  const barSaves = results.reduce((a, r) => a + (r.barSaves || 0), 0);
  const bagSaves = results.reduce((a, r) => a + (r.bagSaves || 0), 0);
  const handSaves = results.reduce((a, r) => a + (r.handSaves || 0), 0);
  const sPc = v => saves ? `${(v / saves * 100).toFixed(0)}%` : '0%';
  line('turns spent saving them', `${saves}`);
  line('  by the STIM tactic', `${barSaves} (${sPc(barSaves)})`);
  line('  by something in the bag', `${bagSaves} (${sPc(bagSaves)})`);
  line('  by the medic\u2019s hands', `${handSaves} (${sPc(handSaves)})`);
  line('dragged clear at a fight\u2019s end', `${recovered} (${(recovered / n).toFixed(1)} per run)`);
  // The clock as it stood when the fight ended for them, out of BLEED_OUT. Everything at the
  // top of the range fell into a fight that was already finishing.
  const clocks = results.flatMap(r => r.clockLeft || []);
  const cTot = clocks.length || 1;
  const bleed = await page.evaluate(() => BLEED_OUT);
  const hist = {};
  clocks.forEach(c => { hist[c] = (hist[c] || 0) + 1; });
  line(`bleed-out clock left when picked up (of ${bleed})`,
    Object.keys(hist).sort((a, b) => b - a)
      .map(k => `${k} left ${(hist[k] / cTot * 100).toFixed(0)}%`).join(', ') || 'none');
  const faced = results.reduce((a, r) => a + (r.downFaced || 0), 0);
  const reach = results.reduce((a, r) => a + (r.downReach || 0), 0);
  const pc = v => faced ? `${(v / faced * 100).toFixed(0)}%` : '0%';
  const byMove = results.reduce((a, r) => a + (r.downByMove || 0), 0);
  const byItem = results.reduce((a, r) => a + (r.downByItem || 0), 0);
  const byBar = results.reduce((a, r) => a + (r.downByBar || 0), 0);
  line('squad turns taken with somebody on the floor', `${faced}`);
  line('  of those, turns with any way to reach them', `${reach} (${pc(reach)})`);
  line('    by a move on the deck', `${byMove} (${pc(byMove)})`);
  line('    by something in the bag', `${byItem} (${pc(byItem)})`);
  line('    by the STIM tactic (30 momentum)', `${byBar} (${pc(byBar)})`);
  line('  spent at least one of their own turns down',
    `${((clocks.filter(c => c < bleed).length / cTot) * 100).toFixed(0)}%`);
  line('lost for good', `${lost} (${(lost / n).toFixed(2)} per run)`);
  line('  median / worst run', `${lostPer[Math.floor(n / 2)]} / ${lostPer[n - 1]}`);
  line('runs that lost nobody', `${results.filter(r => !r.lost.length).length} of ${n}`);
  line('runs that ran out of squad', results.filter(r => r.endedBy === 'wiped-out').length);

  // What the floor costs the ones who get up. A rate near one a run is the target: often enough
  // that a career accumulates them, rare enough that a single bad node is not a sentence.
  const allScars = results.flatMap(r => r.scars);
  const perRun = results.map(r => r.scars.length).sort((a, b) => a - b);
  line('scars dealt', `${allScars.length} (${(allScars.length / n).toFixed(2)} per run)`);
  line('  median / worst run', `${perRun[Math.floor(n / 2)]} / ${perRun[n - 1]}`);
  line('runs that took none', `${results.filter(r => !r.scars.length).length} of ${n}`);
  line('share of recoveries scarred', recovered ? `${Math.round(allScars.length / recovered * 100)}%` : 'n/a');
  const byScar = {};
  allScars.forEach(id => { byScar[id] = (byScar[id] || 0) + 1; });
  SCAR_IDS.forEach(id => line(`  ${id.toLowerCase().replace(/_/g, ' ')}`, byScar[id] || 'never dealt'));

  console.log('\n── RECRUITS ' + '─'.repeat(48));
  // D10: this section's own headline used to read "runs that walked past one" over a count of
  // runs that REACHED a recruit node at all - recruitOffers is pushed whether or not the sign
  // goes through, so a run that signed on the spot was counted as having walked past it. The
  // label was wrong under the old policy too; it just went unnoticed because so few runs ever
  // reached one that the two numbers were close by coincidence.
  const offers = results.flatMap(r => r.recruitOffers);
  const reachedOne = results.filter(r => r.recruitOffers.length).length;
  const totalSigned = results.reduce((a, r) => a + r.recruited.length, 0);
  line('runs that never reached one', `${n - reachedOne} of ${n}`);
  line('runs that reached at least one', `${reachedOne} of ${n}`);
  line('offers seen in total', offers.length);
  if (offers.length) {
    const afford = offers.filter(o => o.purse >= o.cost).length;
    line('  affordable at the time', `${afford} of ${offers.length}`);
    const med = a => a.sort((x, y) => x - y)[Math.floor(a.length / 2)];
    line('  median price asked', med(offers.map(o => o.cost)));
    line('  median purse on hand', med(offers.map(o => o.purse)));
  }
  line('  signed on the spot', `${totalSigned} of ${offers.length}`);
  line('  reached and still walked past', `${offers.length - totalSigned} of ${offers.length}`);
  // H10: the walk-past rate is three different things added together, and the item was filed on
  // the sum. An offer the squad could not pay for is not an offer it declined; an offer inside
  // this file's own 80-scrap reserve is a fact about the reserve. Split, so "the price is not
  // the barrier" can be checked rather than asserted.
  if (offers.length) {
    const RESERVE = 80;
    const broke = offers.filter(o => o.purse < o.cost).length;
    const tight = offers.filter(o => o.purse >= o.cost && o.purse < o.cost + RESERVE).length;
    const rich = offers.filter(o => o.purse >= o.cost + RESERVE).length;
    const pc = v => `${(v / offers.length * 100).toFixed(0)}%`;
    line('  of the offers seen, could not pay at all', `${broke} (${pc(broke)})`);
    line('  could pay but not keep the reserve', `${tight} (${pc(tight)}) \u2014 this policy, not the game`);
    line('  could pay and keep it', `${rich} (${pc(rich)})`);
    const affordN = offers.filter(o => o.purse >= o.cost).length;
    // I03: whether a policy with taste would have room to use it. A hole is a seat with nobody to
  // put in it; an offer against a full line is one a player could genuinely decline.
  {
    const withLine = offers.filter(o => o.seats !== undefined);
    if (withLine.length) {
      const holes = withLine.filter(o => o.hole > 0).length;
      const full = withLine.filter(o => o.hole === 0).length;
      const pc = v => `${(v / withLine.length * 100).toFixed(0)}%`;
      line('  offered while the squad had a hole to fill', `${holes} (${pc(holes)})`);
      line('  offered to a line that was already full', `${full} (${pc(full)}) — where taste could decline`);
      const better = withLine.filter(o => o.weakDmg !== null && o.cardDmg > o.weakDmg).length;
      line('  and the card out-hit the worst hand on the field', `${better} of ${withLine.length} (${pc(better)})`);
      const seen = {};
      withLine.forEach(o => { seen[o.who] = (seen[o.who] || 0) + 1; });
      line('  which card was on the table', Object.entries(seen).map(([k, v]) => `${k} ${v}`).join(', '));
    }
  }
  // I03: what the taste did, when there was any. Only the value arm fills this.
  {
    const why = {};
    results.forEach(r => Object.entries(r.recruitWhy || {}).forEach(([k, v]) => { why[k] = (why[k] || 0) + v; }));
    const total = Object.values(why).reduce((a, c) => a + c, 0);
    if (total) {
      const pc = v => `${Math.round((v || 0) / total * 100)}%`;
      line('  the policy wanted it because there was a hole', `${why.hole || 0} (${pc(why.hole)})`);
      line('  or because it beat the worst hand on the field', `${why.better || 0} (${pc(why.better)})`);
      line('  and turned it down on merit', `${why.declined || 0} (${pc(why.declined)}) — affordable or not`);
      const burned = results.reduce((a, r) => a + (r.recruitBurned || 0), 0);
      if (burned) line('  of which the burn arm paid for and left standing', `${burned}`);
    }
  }
  {
    const f = results.reduce((a, r) => a + (r.recruitFielded || 0), 0);
    const b = results.reduce((a, r) => a + (r.recruitBenched || 0), 0);
    if (f + b) line('  of those signed, put on the line', `${f} fielded, ${b} left on the bench`);
    // I08: and WHY, in the only currency the decision is made in. The gap is
    // rate(incumbent) - rate(recruit), positive when the body already there is ahead. An
    // Outpost purchase is +10 maxHp or +3 dmgBase, so 2.5 or 3 points of rate; the mix this
    // file buys alternates, so the incumbent's purchases are worth about 2.75 each. If the gap
    // and 2.75 x upgrades agree, the purchased-stat difference IS the decision.
    const gaps = results.flatMap(r => r.fieldGap || []);
    const ups = results.flatMap(r => r.fieldUps || []);
    const mine = results.flatMap(r => r.fieldMine || []);
    if (gaps.length) {
      const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
      const g = mean(gaps), u = mean(ups), m = mean(mine);
      line('  contested placements (line full)', `${gaps.length}`);
      line('    mean rate gap, incumbent ahead by', `${g.toFixed(1)}`);
      line('    upgrades bought, incumbent / recruit', `${u.toFixed(1)} / ${m.toFixed(1)}`);
      line('    what those upgrades are worth in rate', `${(2.75 * (u - m)).toFixed(1)} of the ${g.toFixed(1)}`);
      line('    decisions the recruit would win at parity', `${gaps.filter((x, i) => x - 2.75 * (ups[i] - mine[i]) < 0).length} of ${gaps.length}`);
    }
    const rs = results.reduce((a, r) => a + (r.reslotted || 0), 0);
    const rr = results.reduce((a, r) => a + (r.reslottedRecruit || 0), 0);
    if (rs) line('  re-slotted at an Outpost afterwards', `${rs}, of which recruits ${rr}`);
  }
  line('  signed as a share of what was affordable',
      affordN ? `${totalSigned} of ${affordN} (${(totalSigned / affordN * 100).toFixed(0)}%)` : 'nothing affordable');
    line('  and as a share of what the reserve allowed',
      rich ? `${totalSigned} of ${rich} (${(totalSigned / rich * 100).toFixed(0)}%)` : 'none allowed');
  }
  line('runs that signed anyone', `${withRecruits} of ${n}`);
  Object.entries(signed).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => line('  ' + k, `${v} runs`));
  if (!Object.keys(signed).length) line('  none', 'nobody was ever signed on');

  // This file never resets meta between expeditions, so grudges accumulate: by the end of a
  // sixty-run sample the commanders are Risen and carrying +60% health. That is a real player's
  // arc, but it means a single averaged figure blends a first encounter with a thrice-risen
  // one - so the sample is split and shown drifting, or not, rather than assumed steady.
  const third = Math.max(1, Math.floor(n / 3));
  const band = (a, b) => results.slice(a, b);
  const depthOf = rs => (rs.reduce((x, r) => x + r.sector, 0) / rs.length).toFixed(2);
  const grudgeOf = rs => { const g = rs.flatMap(r => r.metGrudge.concat(r.bossGrudge));
                           return g.length ? (g.reduce((x, y) => x + y, 0) / g.length).toFixed(2) : '-'; };
  console.log('\n── META DRIFT ACROSS THE SAMPLE ' + '─'.repeat(26));
  // A leading "THE" is not a name: four of the spots are THE VAULT, THE CHAPEL, THE FOOTLOCKER
  // and THE ROAD CREW, and taking the first word printed all four as "THE 1". The ceiling goes
  // beside the level too - a career that saturated the hillside should read as saturated.
  line('Citadel at the end', await page.evaluate(() => CITADEL_SPOTS.map(sp =>
    `${sp.name.replace(/^THE /, '').split(' ')[0]} ${sp.level()}/${sp.max}`).join(', ')));
  line('skulls left unspent', await page.evaluate(() => bossSkulls));
  {
    const led = results.map(r => r.skullLedger).filter(Boolean).pop();
    if (led && led.earned) {
      const p = v => `${v} (${Math.round(100 * v / led.earned)}%)`;
      line('skulls earned across the sample', led.earned);
      line('  spent at the Citadel', p(led.meta));
      line('  spent on requisitions', p(led.req));
      line('  never spent', p(led.onHand));
    }
  }
  line('deepest sector, mean, by third', `${depthOf(band(0, third))} / ${depthOf(band(third, 2 * third))} / ${depthOf(band(2 * third, n))}`);
  line('grudge on commanders met, same', `${grudgeOf(band(0, third))} / ${grudgeOf(band(third, 2 * third))} / ${grudgeOf(band(2 * third, n))}`);

  // How long an order actually takes, which is the question orders exist to answer.
  console.log('\n── THE ORDER ' + '─'.repeat(45));
  line('signed for', `${ORDER_NAME || ORDER} \u00B7 ${ORDER_SECTORS} sectors`);
  const keptN = results.filter(r => r.fulfilled).length;
  line('kept', `${keptN} of ${n} (${Math.round(keptN / n * 100)}%)`);
  if (keptN) {
    const kn = results.filter(r => r.fulfilled).map(r => r.nodes).sort((a, b) => a - b);
    const kf = results.filter(r => r.fulfilled).map(r => r.fights).sort((a, b) => a - b);
    const ks = results.filter(r => r.fulfilled).map(r => r.score).sort((a, b) => a - b);
    line('  nodes to keep it, median', `${pct(kn, 0.5)} (p90 ${pct(kn, 0.9)})`);
    line('  fights to keep it, median', `${pct(kf, 0.5)} (p90 ${pct(kf, 0.9)})`);
    line('  score for keeping it, median', pct(ks, 0.5).toLocaleString());
  }
  const rs = results.filter(r => r.resigned);
  line('orders re-signed mid-run', `${rs.length} of ${n} (${(rs.length / n * 100).toFixed(0)}%)`);
  if (rs.length) {
    const to = {}; rs.forEach(r => { to[r.resignedTo] = (to[r.resignedTo] || 0) + 1; });
    line('  cut down to', Object.entries(to).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '));
    const at = rs.map(r => r.resignedAt).sort((a, b) => a - b);
    line('  at sector, median', at[Math.floor(at.length / 2)]);
    line('  and kept it', `${rs.filter(r => r.fulfilled).length} of ${rs.length}`);
  }
  line('lost before the recall', `${results.filter(r => !r.fulfilled).length} of ${n}`);

  console.log('\n── WHERE RUNS END ' + '─'.repeat(40));
  const sectors = nums('sector');
  line('deepest sector, median', withCI(sectors));
  line('  mean / p10 / p90', `${mean(sectors).toFixed(1)} / ${pct(sectors, 0.1)} / ${pct(sectors, 0.9)}`);
  line('range', `${sectors[0]} to ${sectors[sectors.length - 1]}`);
  const ends = {};
  results.forEach(r => { ends[r.endedBy] = (ends[r.endedBy] || 0) + 1; });
  line('ended by', Object.entries(ends).map(([k, v]) => `${k} ${v}`).join(', '));

  // The number the ending exists to be judged on. A win has to be a good run and not a typical
  // one - if every run wins the gate is too shallow, and if none does the content does not
  // exist. Every figure here is measured on a player that barely heals and never rethinks a
  // line, so it is the floor of what a person can do rather than the middle of it.
  const wins = results.filter(r => r.won);
  const reached = results.filter(r => r.sector >= FINAL_SECTOR_N);
  line(`reached sector ${FINAL_SECTOR_N}`, `${reached.length} of ${n} (${Math.round(reached.length / n * 100)}%)`);
  line('  and won it', reached.length ? `${wins.length} of ${reached.length} (${Math.round(wins.length / reached.length * 100)}%)`
                                      : 'no run got that far');
  line('runs that ended the road', `${wins.length} of ${n} (${Math.round(wins.length / n * 100)}%)`);
  // K06: THE NUMBER THAT WAS ALWAYS MISSING FROM THE ROW ABOVE. Every balance phase in this file
  // quotes that count and compares it across arms, and not one of them ever wrote down how far it
  // moves on its own. It is a tally of independent successes, so the standard deviation of the
  // count is sqrt(n·p·(1-p)) - about 5.7 wins at 150 expeditions and a 32% rate, which nine
  // careers run on one identical configuration then confirmed at 6.4 observed. Printed here so
  // the next phase meets the noise floor at the same moment it meets the number, instead of a
  // year later with a shipped conclusion resting on it.
  const winRate = wins.length / n, winSd = Math.sqrt(n * winRate * (1 - winRate));
  const armSd = winSd / Math.sqrt(3), settles = 3 * armSd * Math.SQRT2;
  line('  what that count can resolve',
    `±${winSd.toFixed(1)} wins on one career; an arm of three means ±${armSd.toFixed(1)}, `
    + `so two arms of three only settle a gap wider than about ${Math.round(settles)} wins`);
  if (wins.length) {
    line('  warlords felled on the way, mean', (wins.reduce((a, r) => a + r.roadWarlords, 0) / wins.length).toFixed(1));
    line('  raised by the ossuary, mean', (wins.reduce((a, r) => a + r.raised, 0) / wins.length).toFixed(1));
    // Two ways through the last phase and this says which one the squad took. Clearing the
    // raised lifts the ward and arms the finish; grinding the warlord at 30% leaves it with
    // nothing to spend. Both are real lines - what would be wrong is only one of them existing.
    const ground = wins.filter(r => r.stillUp > 0).length;
    line('  ground through the ward', `${ground} of ${wins.length}`);
    line('  cleared the raised first', `${wins.length - ground} of ${wins.length}`);
    line('  tally it died holding, mean', (wins.reduce((a, r) => a + r.tallyAtEnd, 0) / wins.length).toFixed(1));
    const ws = wins.map(r => r.score).sort((a, b) => a - b);
    line('  score on a won run, median', pct(ws, 0.5).toLocaleString());
  }
  const walked = results.filter(r => r.extracted);
  line('walked out', `${walked.length} of ${n}`);
  if (walked.length) {
    const at = walked.map(r => r.walkedAt).sort((a, b) => a - b);
    line('  sector walked at, median', pct(at, 0.5));
    // Comparing walkers against every other run would compare deep runs against shallow ones and
    // credit extraction for the depth. Only runs that got as far as the policy's door can answer
    // the question, so only those are in the comparison.
    const eligible = results.filter(r => r.sector >= EXTRACT_AT);
    const pushedOn = eligible.filter(r => !r.extracted);
    line(`  among runs that reached sector ${EXTRACT_AT}`, `${eligible.length} of ${n}, ${walked.length} walked`);
    line('    walked out, median score', pct(walked.map(r => r.score).sort((a, b) => a - b), 0.5).toLocaleString());
    if (pushedOn.length) line('    pushed on instead, median score',
      pct(pushedOn.map(r => r.score).sort((a, b) => a - b), 0.5).toLocaleString());
  }
  line('nodes cleared, median', withCI(nums('nodes')));
  line('score, median', withCI(nums('score'), v => v.toLocaleString()));
  // What the run scored BEFORE the ladder's multiplier, which is the only number that
  // says whether a rung's price is earned. protocolMult is a clean factor in computeScore,
  // so dividing it back out is exact rather than an approximation.
  if (RUNG > 0) {
    // Read straight off the table rather than by setting `ascension` and asking - a report
    // that mutates run state to measure it is one restart away from being the bug it found.
    const m = await page.evaluate(r => PROTOCOLS[Math.min(r, PROTOCOLS.length) - 1].mult, RUNG);
    line(`raw score, median (\u00F7${m.toFixed(2)})`, withCI(nums('score').map(v => Math.round(v / m)), v => v.toLocaleString()));
  }

  // G02: the last fight, and the only block in this file that is only ever printed on a staged
  // run. Everything here is conditional on ARRIVING - a staged sample says nothing about how
  // often a real career gets here, which is what `runs that ended the road` on an unstaged run
  // is for, and the two must never be quoted as one number.
  if (STAGE > 1) {
    // Read the gate off the engine rather than keeping a copy of the number here.
    const LEARNED_GATE = await page.evaluate(() => LEARNED_AT);
    console.log('\n\u2500\u2500 STAGED AT SECTOR ' + STAGE + ' ' + '\u2500'.repeat(36));
    const one = results.find(r => r.stagedAt);
    if (one) {
      const a = one.stagedAt;
      line('a staged squad arrives as', `sector ${a.sector} tier ${a.tier}, line ${a.lvl.join('/')} at ${a.maxHp.join('/')} hp`);
      line('  carrying', `${a.relics} relics, ${a.gear} pieces of gear, ${a.scrap} scrap, ${a.regroups} fallbacks, roster ${a.roster}`);
    }
    const staged = results.filter(r => r.staged).length;
    line('runs staged', `${staged} of ${n}`);
    // Every boss node in the last sector deals the same warlord, and a regrouped run fights it
    // again - so meetings outnumber runs and the two are reported apart.
    const metRuns = results.filter(r => r.bossMet.some(m => m.id === 'OSSUARY'));
    const meetings = results.flatMap(r => r.bossMet).filter(m => m.id === 'OSSUARY');
    line('runs that reached the last warlord', `${metRuns.length} of ${n}`);
    if (meetings.length) {
      const won = meetings.filter(m => m.won).length;
      line('  meetings with it', `${meetings.length}, ${won} won (${Math.round(100 * won / meetings.length)}%)`);
      const wonRuns = results.filter(r => r.bossMet.some(m => m.id === 'OSSUARY' && m.won)).length;
      line('  runs that felled it', `${wonRuns} of ${metRuns.length}`);
    }
    const ended = results.filter(r => r.endedBy === 'won').length;
    line('runs that ended the road', `${ended} of ${n}`);
    // The move nothing had ever seen fire. G01 fixed COUNT YOURS by reading the source, because
    // no measurement could reach it - this is the first thing in the repo that can watch it
    // work. It is gated on grudge, not on depth: learnedMove wants LEARNED_AT stacks, and a
    // grudge stack is earned by FELLING the commander. So a staged sample only sees it after it
    // has beaten the last warlord twice, which is why the grudge is printed beside it - a run
    // of "not yet" with a grudge below the gate is the sample being short, not the move being
    // absent, and the two must not read the same.
    const grudges = results.flatMap(r => r.bossMet).filter(m => m.id === 'OSSUARY').map(m => m.grudge || 0);
    line('grudge on it when met', grudges.length ? `${Math.min(...grudges)} to ${Math.max(...grudges)} (it brings its own move at ${'' + LEARNED_GATE})` : 'never met');
    const sigs = {};
    results.forEach(r => Object.entries(r.sigsFaced || {}).forEach(([k, v]) => { sigs[k] = (sigs[k] || 0) + v; }));
    const named = Object.entries(sigs).sort((a, b) => b[1] - a[1]);
    line('every signature faced in this sector', named.length ? named.map(([k, v]) => `${k} x${v}`).join(', ') : 'none');
    line('COUNT YOURS among them', sigs.COUNT_YOURS ? `yes, ${sigs.COUNT_YOURS} times` :
      (Math.max(0, ...grudges) >= LEARNED_GATE ? 'NO - and the grudge was high enough, so this is a finding' : 'not yet - the grudge never reached the gate in this sample'));
  }

  // G13: the draft is the one thing every other number rests on, so an empty line is not a row
  // in a table - it invalidates the run. Printed first, and printed whether or not it happened.
  {
    const empty = results.filter(r => r.lineSize === 0);
    const unfieldable = results.filter(r => r.doctrineUnfieldable);
    if (empty.length) {
      console.log(`\n!! ${empty.length} of ${n} RUNS FIELDED NOBODY - every figure below is from a squad that was not there`);
    }
    if (unfieldable.length) {
      const by = {};
      unfieldable.forEach(r => { by[r.doctrineUnfieldable] = (by[r.doctrineUnfieldable] || 0) + 1; });
      console.log(`\ndoctrine unfieldable by this roster on ${unfieldable.length} of ${n} runs: ` +
        Object.entries(by).map(([k, v]) => `${k} x${v}`).join(', ') + ' - drafted the ordinary way instead');
    }
  }

  // G13: the muster's other free lever, reported the same way the doctrine is. Printed only
  // when it was asked for, and printed as what was actually held - `asked for scout, held
  // nothing` is the line that would have caught a lever wired to nothing.
  if (BENCH !== 'off') {
    const held = results.filter(r => r.benchHeld);
    console.log('\n\u2500\u2500 THE BENCH ' + '\u2500'.repeat(45));
    line(`asked for ${BENCH}`, held.length === n ? `held on all ${n} runs`
      : held.length ? `held on ${held.length} of ${n}` : `HELD ON NONE - the lever did nothing`);
    const jobs = {};
    held.forEach(r => { jobs[r.benchHeld] = (jobs[r.benchHeld] || 0) + 1; });
    Object.entries(jobs).forEach(([k, v]) => line('  ' + k, v));
  }

  const withDoc = results.filter(r => r.doctrine);
  const offered = results.filter(r => (r.doctrineOffered || []).length);
  if (withDoc.length || offered.length) {
    console.log('\n── DOCTRINES ' + '─'.repeat(44));
    // Whether the muster put a real question is the thing to read first. Four prohibitions
    // greyed out is not a choice, and a block that only printed when somebody TOOK one could
    // not say so - it just did not print.
    if (offered.length) {
      const liveCounts = offered.map(r => (r.doctrineLive || []).length);
      const anyLive = liveCounts.filter(c => c > 0).length;
      line('musters with a live offer', `${anyLive} of ${offered.length}`);
      line('  offers live, mean of 3', (liveCounts.reduce((a, b) => a + b, 0) / offered.length).toFixed(2));
      const seen = {}, live = {};
      offered.forEach(r => {
        (r.doctrineOffered || []).forEach(id => { seen[id] = (seen[id] || 0) + 1; });
        (r.doctrineLive || []).forEach(id => { live[id] = (live[id] || 0) + 1; });
      });
      Object.keys(seen).sort((a, b) => (live[b] || 0) - (live[a] || 0)).forEach(id =>
        line(`  ${id}`, `offered ${seen[id]}, live ${live[id] || 0}`));
      const dead = Object.keys(seen).filter(id => !live[id]);
      line('  never live when offered', dead.length ? dead.join(', ') : 'none');
    }
    line('runs that took one', `${withDoc.length} of ${n}`);
    const kept = withDoc.filter(r => r.doctrineKept).length;
    line('  still keeping it at the end', `${kept} of ${withDoc.length}`);
    const byDoc = {};
    withDoc.forEach(r => { byDoc[r.doctrine] = (byDoc[r.doctrine] || 0) + 1; });
    Object.entries(byDoc).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => line('  ' + k, v));
  }

  console.log('\n── FORMATIONS ' + '─'.repeat(43));
  const forms = {};
  results.forEach(r => Object.entries(r.formations).forEach(([k, v]) => { forms[k] = (forms[k] || 0) + v; }));
  const namedN = Object.values(forms).reduce((a, v) => a + v, 0);
  const looseN = results.reduce((a, r) => a + r.loose, 0);
  line('fights that were a named shape', `${namedN} of ${namedN + looseN} (${(100 * namedN / Math.max(1, namedN + looseN)).toFixed(0)}%)`);
  Object.entries(forms).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => line('  ' + k, v));
  const unseen = ALL_FORMATION_IDS.filter(id => !forms[id]);
  line('never met', unseen.length ? unseen.join(', ') : 'none');

  // H11: AS A SHARE OF THE FACTION'S OWN FIGHTS, WEIGHTED BY WHERE RUNS ACTUALLY END.
  // Suite 86 answers the neighbouring question by walking sectors 1-7 uniformly, which is the
  // right lens for "is this faction's table internally crowded" and the wrong one for "does a
  // player ever meet this shape" - runs end at sector 3, so the deep end of every table is
  // roughly a third as common in play as a uniform walk makes it look. Both numbers are true of
  // different questions; this is the played one.
  const facFights = {};
  results.forEach(r => Object.entries(r.factionFights || {}).forEach(([k, v]) => { facFights[k] = (facFights[k] || 0) + v; }));
  if (Object.keys(facFights).length) {
    console.log('   share of its own faction\u2019s fights (played, not modelled)');
    Object.entries(FORMATION_FACTION).forEach(([fac, ids]) => {
      const tot = facFights[fac] || 0;
      if (!tot) return;
      ids.forEach(id => {
        const pc = (forms[id] || 0) / tot * 100;
        line(`    ${fac} ${id}`, `${pc.toFixed(1)}% of ${tot}` + (pc < 6 ? '   <- under a rate anyone learns from' : ''));
      });
    });
  }

  console.log('\n── FIGHTS ' + '─'.repeat(48));
  const roundsPerFight = results.map(r => r.fights ? r.rounds / r.fights : 0).sort((a, b) => a - b);
  line('actor turns per fight', pct(roundsPerFight, 0.5).toFixed(1) + ' (median)');
  line('fights per run, median', pct(nums('fights'), 0.5));
  line('bosses felled, mean', mean(nums('bosses')).toFixed(2));
  line('elites broken, mean', mean(nums('elites')).toFixed(2));
  const eliteUnits = results.reduce((a, r) => a + (r.eliteUnits || 0), 0);
  const affixed = results.reduce((a, r) => a + (r.affixedUnits || 0), 0);
  const champs = results.reduce((a, r) => a + (r.champions || 0), 0);
  if (eliteUnits) {
    line('hostiles on elite nodes', `${eliteUnits}, ${(affixed / eliteUnits * 100).toFixed(0)}% affixed, ${champs} champions`);
    const seen = {};
    results.forEach(r => Object.entries(r.affixes || {}).forEach(([k, v]) => { seen[k] = (seen[k] || 0) + v; }));
    const declared = await page.evaluate(() => ELITE_AFFIXES.map(a => a.id));
    line('  affixes worn', declared.map(a => `${a} ${seen[a] || 0}`).join(', '));
    const cold = declared.filter(a => !seen[a]);
    line('  never handed out', cold.length ? cold.join(', ') : 'none');
  }
  line('wipes per run, mean', mean(nums('wipes')).toFixed(2));
  line('withdrawals per run, mean', WITHDRAW_POLICY ? mean(nums('withdrawals')).toFixed(2) : 'policy off');
  line('regroups spent, mean', mean(nums('regroupsSpent')).toFixed(2));
  line('fallbacks deployed with, mean', mean(nums('regroupsHad')).toFixed(2));
  const wipeSectors = {};
  results.forEach(r => r.wipedInSector.forEach(sx => { wipeSectors[sx] = (wipeSectors[sx] || 0) + 1; }));
  line('wipes by sector', Object.entries(wipeSectors).sort((a, b) => a[0] - b[0]).map(([k, v]) => `s${k}:${v}`).join(' ') || 'none');
  const wipeTiers = {};
  results.forEach(r => r.wipedAtTier.forEach(t => { wipeTiers[t] = (wipeTiers[t] || 0) + 1; }));
  line('wipes by tier', Object.entries(wipeTiers).sort((a, b) => a[0] - b[0]).map(([k, v]) => `t${k}:${v}`).join(' ') || 'none');
  const onElite = results.reduce((n, r) => n + r.wipedOnElite.filter(Boolean).length, 0);
  const allWipes = results.reduce((n, r) => n + r.wipedOnElite.length, 0);
  line('wipes on an elite node', allWipes ? `${onElite}/${allWipes} (${(onElite / allWipes * 100).toFixed(0)}%)` : 'none');

  console.log('\n── WHAT GETS USED ' + '─'.repeat(40));
  const moves = {};
  results.forEach(r => Object.entries(r.moves).forEach(([m, c]) => { moves[m] = (moves[m] || 0) + c; }));
  const totalMoves = Object.values(moves).reduce((a, b) => a + b, 0);
  // F03: the fourth abilities are moves a rank III operator brings, so a line that claims to
  // list what is never used has to know about them. Reading only ABILITIES meant the three
  // recruit fourths could not appear here even while they were unreachable.
  const declared = await page.evaluate(() => [...new Set([
    ...Object.values(ABILITIES).flat().map(a => a.move),
    ...Object.values(FOURTH_ABILITIES).map(a => a.move)
  ])]);
  const ranked = Object.entries(moves).sort((a, b) => b[1] - a[1]);
  ranked.forEach(([m, c]) => line(m, `${String(c).padStart(6)}  ${(c / totalMoves * 100).toFixed(1)}%`));
  const never = declared.filter(m => !moves[m]);
  line('never used', never.length ? never.join(', ') : 'none');
  const classCounts = {};
  results.forEach(r => r.deployed.forEach(c => { classCounts[c] = (classCounts[c] || 0) + 1; }));
  line('classes deployed', Object.entries(classCounts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '));

  const items = {};
  results.forEach(r => Object.entries(r.items).forEach(([k, v]) => { items[k] = (items[k] || 0) + v; }));
  line('items used per run', Object.entries(items).map(([k, v]) => `${k} ${(v / n).toFixed(1)}`).join(', ') || 'none');
  line('promotions per run', `${mean(nums('promotions')).toFixed(1)} (${mean(nums('sigsTaken')).toFixed(1)} signatures)`);
  line('promotions that bought nothing', `${mean(nums('promoEmpty')).toFixed(2)} per run`);
  // F10: before HOLD existed a turn with every ability cooling was skipped outright - by this
  // file silently, and on screen by leaving the player nothing but the two ways out of the
  // fight. Both halves of this line have to be readable: how often it happens, and that it is
  // no longer a hole. The share is of PLAYER turns, which is the denominator that hole was in.
  {
    const tot = a => a.reduce((x, y) => x + y, 0);
    const h = tot(nums('held')), t = tot(nums('turnsPlayer'));
    line('turns held, nothing else to press', t
      ? `${h} of ${t} player turns (${(100 * h / t).toFixed(2)}%), skipped outright before F10`
      : 'no player turns recorded');
  }
  line('signatures bought at the Outpost', `${mean(nums('sigsBought')).toFixed(1)} per run`);
  line('capstones reached', `${mean(nums('capsTaken')).toFixed(2)} taken on promotion, ${mean(nums('capsBought')).toFixed(2)} bought at the Outpost, per run`);
  line('gear equipped per run', mean(nums('gearEquipped')).toFixed(1));
  // K06: which pieces, because a total with no names in it cannot say whether the slot is being
  // spent on output or on mitigation - and K05 measured that those are not worth the same.
  {
    const tally = pick => {
      const t = {};
      results.forEach(r => { const v = pick(r);
        if (Array.isArray(v)) v.forEach(k => { t[k] = (t[k] || 0) + 1; });
        else Object.entries(v || {}).forEach(([k, n]) => { t[k] = (t[k] || 0) + n; }); });
      return t;
    };
    const worn = tally(r => (r.gear || {}).worn);
    const held = tally(r => r.trinketsHeld);
    const say = t => Object.entries(t).sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} ${(v / n).toFixed(2)}`).join(', ') || 'none';
    line('  pieces put on, per run', say(worn));
    line('  trinkets still worn at the end', say(held));
  }
  line('armories visited per run', `${mean(nums('shops')).toFixed(1)} (${Math.round(mean(nums('shopScrap')))} scrap spent)`);
  // K07: the shelf, and what this file did with it. `shown` is what the Armory laid out and
  // `seen` is what the policy let itself look at, so an arm running --shelf 1 says so in the
  // output instead of being something a reader has to remember about the invocation. The pieces
  // taken are a census - a count of purchases, not a career average - so they are readable at
  // any sample size, which after K06 is the difference between a number worth quoting and one
  // that is not.
  const shelfShown = results.reduce((a, r) => a + (r.shelfShown || 0), 0);
  const shelfSeen = results.reduce((a, r) => a + (r.shelfSeen || 0), 0);
  if (shelfShown) {
    const shelfUsable = results.reduce((a, r) => a + (r.shelfUsable || 0), 0);
    const shelfDud = results.reduce((a, r) => a + (r.shelfDud || 0), 0);
    const shelves = results.reduce((a, r) => a + (r.shops || 0), 0);
    line('  shelf laid out / looked at', `${(shelfShown / n).toFixed(1)} / ${(shelfSeen / n).toFixed(1)} rows a run`);
    line('    rows the line could actually wear',
      shelfSeen ? `${Math.round(shelfUsable / shelfSeen * 100)}% of them, and ${shelfDud} of ${shelves} shelves offered none`
                : 'no shelf reached');
    const took = {};
    results.forEach(r => Object.entries(r.shelfTook || {}).forEach(([k, v]) => { took[k] = (took[k] || 0) + v; }));
    const bought = Object.values(took).reduce((a, v) => a + v, 0);
    line('  bought off the shelf, per run',
      Object.entries(took).sort((a, b) => b[1] - a[1]).slice(0, 8)
        .map(([k, v]) => `${k} ${(v / n).toFixed(2)}`).join(', ') || 'nothing');
    // The row K07 exists to move: of the pieces bought at an Armory, how many answered a damage
    // type at all. Read off the engine's own apply() rather than a list written here.
    const MIT = (results.find(r => r.gearMit) || {}).gearMit || [];
    const ANSWERS = (results.find(r => r.gearAnswers) || {}).gearAnswers || [];
    const share = ids => Math.round(ids.reduce((a, id) => a + (took[id] || 0), 0) / bought * 100);
    // The two rows K07 exists to move, and the reason they are counts rather than averages: a
    // purchase either happened or it did not, so these read at any sample size. After K06 that
    // is the difference between a number worth quoting and one that is not.
    line('  of those, pieces that move a resistance',
      bought ? `${share(MIT)}% of ${bought} (${MIT.join(', ')})` : 'none bought');
    line('    of which bio or energy',
      bought ? `${share(ANSWERS)}% of ${bought} (${ANSWERS.join(', ')})` : 'none bought');
  }
  const sigs = {};
  results.forEach(r => Object.entries(r.sigsFaced || {}).forEach(([k, v]) => { sigs[k] = (sigs[k] || 0) + v; }));
  line('hostile signatures met', Object.entries(sigs).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${v}`).join(', ') || 'none');
  line('deepest bond per run', `${mean(nums('maxBond')).toFixed(1)} fights (${mean(nums('bondSaves')).toFixed(1)} step-ins)`);
  const fronts = {};
  results.forEach(r => (r.frontsSeen || []).forEach(f => { if (f) fronts[f] = (fronts[f] || 0) + 1; }));
  line('fronts weathered', Object.entries(fronts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') || 'none');
  line('items crafted per run', (results.reduce((a, r) => a + r.crafted, 0) / n).toFixed(1));
  // F03: what the Outpost's stat counter actually sold, now that it is bought through the
  // button. One stat per purchase at upgradeCost, rather than a hand copy paying the sector-1
  // price for both.
  line('stat upgrades bought per run', (results.reduce((a, r) => a + (r.upgrades || 0), 0) / n).toFixed(1));
  // F04: what the shelf above the Citadel's cap absorbed.
  line('requisitions bought per run', (results.reduce((a, r) => a + (r.reqBought || 0), 0) / n).toFixed(1));
  line('  of them ONE MORE FALLBACK', `${results.reduce((a, r) => a + (r.reqFallback || 0), 0)} of ${n} runs`);
  const called = results.filter(r => r.reqGrudge).length;
  line('grudges called in', `${called} of ${n} expeditions`);
  // F05: bodies on the field against kills the engine banked itself. A positive number here
  // means something is reaching zero down a path the death ledger does not cover.
  const gap = results.reduce((a, r) => a + (r.killGap || 0), 0);
  const bodies = results.reduce((a, r) => a + (r.kills || 0), 0);
  const banked = results.reduce((a, r) => a + (r.engineKills || 0), 0);
  // The engine's number is expected to sit ABOVE this one: a body raised by RESURGENCE or
  // WHISTLE and put down again is two kills and one body. The direction that would mean
  // something is the other one - more bodies than kills is a path reaching zero without
  // noteKill, which is the whole of F05.
  //
  // Measured after the fix: 2 in 22,290 bodies over 150 careers, 0 in 9,255 over 60. What was
  // ruled out, fight by fight: every body left on the field has been through noteKill, and the
  // engine's tick count equals the number of times noteKill returned true. So the residual is
  // in this file's scan rather than in the ledger, and it has not been attributed further. A
  // figure in the tens rather than the ones is worth chasing.
  line('kills, both ways', `${banked} banked by the engine, ${bodies} bodies counted here`
    + (gap ? ` (${gap} more bodies than kills)` : ''));
  line('augments installed per run', (results.reduce((a, r) => a + (r.augments || 0), 0) / n).toFixed(1));
  // K05: the materials economy, end to end. Three kinds come in off salvage and there are two
  // doors out - the bench and the schematics - so what is left standing at the end of a run is
  // material the game gave the player and gave them nothing to do with.
  {
    const kinds = ['parts', 'chems', 'tech'];
    const sum = (pick, k) => results.reduce((a, r) => a + ((pick(r) || {})[k] || 0), 0) / n;
    const row = (label, pick) => line(label, kinds.map(k => `${k} ${sum(pick, k).toFixed(1)}`).join(', ')
      + `  (${kinds.reduce((a, k) => a + sum(pick, k), 0).toFixed(1)} total)`);
    row('  materials into the bench', r => (r.mat || {}).aug);
    row('  materials into schematics', r => (r.mat || {}).craft);
    row('  materials left standing', r => r.matLeft);
    const tally = pick => {
      const t = {};
      results.forEach(r => Object.entries(pick(r) || {}).forEach(([k, v]) => { t[k] = (t[k] || 0) + v; }));
      return Object.entries(t).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / n).toFixed(2)}`).join(', ');
    };
    // Which augments, in a catalogue of three against three slots per body: a run that fills a
    // slot has no decision to record, so an even spread here is the absence of one.
    const fill = {};
    results.forEach(r => (r.augFill || []).forEach(v => { fill[v] = (fill[v] || 0) + 1; }));
    const bodies = Object.values(fill).reduce((a, v) => a + v, 0) || 1;
    line('  slots filled per body', Object.keys(fill).sort()
      .map(k => `${k}: ${(fill[k] / bodies * 100).toFixed(0)}%`).join(', '));
    const sets = {};
    results.forEach(r => (r.augSets || []).forEach(k => { sets[k] = (sets[k] || 0) + 1; }));
    const setN = Object.values(sets).reduce((a, v) => a + v, 0) || 1;
    line('  what a filled body carries', Object.entries(sets).sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([k, v]) => `${k} ${(v / setN * 100).toFixed(0)}%`).join(', ') || 'none');
    line('  which augment, per run', tally(r => (r.mat || {}).augged) || 'none');
    line('  which schematic, per run', tally(r => (r.mat || {}).crafted) || 'none');
  }
  const faces = {};
  results.forEach(r => Object.entries(r.facesMet || {}).forEach(([k, v]) => { faces[k] = (faces[k] || 0) + v; }));
  line('faces met', Object.entries(faces).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') || 'none');
  // Every ground and every sky, including the ones that never came up, and in table order
  // rather than sorted. Same reason the thread list below prints its zeroes: a list of what
  // turned up cannot show you what never did, and "two of the six grounds are never fought on"
  // is exactly the finding a sorted top-N hides. D08 was filed off this line.
  const field = {};
  results.forEach(r => Object.entries(r.field || {}).forEach(([k, v]) => { field[k] = (field[k] || 0) + v; }));
  const fieldTotal = Object.values(field).reduce((a, b) => a + b, 0) || 1;
  const marginal = pick => { const t = {};
    Object.entries(field).forEach(([cell, v]) => { const k = pick(cell.split('|')); t[k] = (t[k] || 0) + v; });
    return t; };
  // The declared table first, in its own order, then anything observed that is not in it - a
  // commander's arena sky is real and is not in WEATHER_IDS, and dropping it would make the
  // line not add up without saying why. Both lines therefore sum to 100%.
  const spread = (ids, tally) => [...ids, ...Object.keys(tally).filter(k => !ids.includes(k))]
    .map(id => `${id} ${((tally[id] || 0) / fieldTotal * 100).toFixed(1)}%`).join(', ');
  const tables = await page.evaluate(() => ({ grounds: TERRAIN_IDS, skies: ['CLEAR', ...WEATHER_IDS],
    conf: CONFLUENCE.map(c => ({ faction: c.faction, cell: `${c.sky}|${c.ground}` })) }));
  line('ground fought on', spread(tables.grounds, marginal(p => p[1])));
  // J04: what the enemy's own plate takes off a player hit, by sector. E04 scaled defensive
  // GRANTS and left base armour flat, reasoning that it subtracts from player damage rather
  // than from the enemy curve, and filed whether flat keeps pace. This is that row: a plate is
  // flat, a player hit is not, so the share it eats is the whole question.
  {
    const acc = {};
    results.forEach(r => Object.entries(r.plate || {}).forEach(([k, v]) => {
      acc[k] = acc[k] || [0, 0, 0];
      acc[k][0] += v[0]; acc[k][1] += v[1]; acc[k][2] += v[2];
    }));
    const keys = Object.keys(acc).sort((a, b) => a - b);
    if (keys.length) {
      line('  mean player hit before the plate', keys.map(k => `s${k} ${(acc[k][0] / Math.max(1, acc[k][2])).toFixed(0)}`).join('  '));
      line('  and what the plate took off it', keys.map(k => `s${k} ${(acc[k][1] / Math.max(1, acc[k][2])).toFixed(1)}`).join('  '));
      line('  the plate as a share of the hit', keys.map(k => `s${k} ${(acc[k][1] / Math.max(1, acc[k][0]) * 100).toFixed(1)}%`).join('  '));
    }
  }
  // K02: which damage type a blow carried, both ways, and what resistance took off it. The
  // player's resistances have three fields and the question is whether two of them ever meet
  // anything: enemyStrike reads `enemy.dmgType || 'phys'` and three templates set it.
  {
    const acc = {};
    results.forEach(r => Object.entries(r.dt || {}).forEach(([side, bag]) => {
      const s2 = acc[side] = acc[side] || {};
      Object.entries(bag).forEach(([t, v]) => {
        const row = s2[t] = s2[t] || { hits: 0, raw: 0, resisted: 0, weak: 0, immune: 0 };
        row.hits += v.hits; row.raw += v.raw; row.resisted += v.resisted;
        row.weak += (v.weak || 0); row.immune += (v.immune || 0);
      });
    }));
    const show = (side, label) => {
      const b = acc[side]; if (!b) return;
      const tot = Object.values(b).reduce((a, v) => a + v.hits, 0) || 1;
      line(label, Object.entries(b).sort((x, y) => y[1].hits - x[1].hits)
        .map(([t, v]) => `${t} ${(v.hits / tot * 100).toFixed(1)}%`).join(', '));
      line('  of the blow, resistance took', Object.entries(b).sort((x, y) => y[1].hits - x[1].hits)
        .map(([t, v]) => `${t} ${(v.resisted / Math.max(1, v.raw) * 100).toFixed(1)}%`).join(', '));
      // The two ends of the same axis, which the share above folds together: a wall the blow
      // died against, and a seam it opened wider. Both are what a resistance IS, and a report
      // that only prints the middle cannot tell an immunity from a very good coat.
      line('  of those blows, stopped dead', Object.entries(b).sort((x, y) => y[1].hits - x[1].hits)
        .map(([t, v]) => `${t} ${(v.immune / Math.max(1, v.hits) * 100).toFixed(1)}%`).join(', '));
      line('  and landed on a weakness', Object.entries(b).sort((x, y) => y[1].hits - x[1].hits)
        .map(([t, v]) => `${t} ${(v.weak / Math.max(1, v.hits) * 100).toFixed(1)}%`).join(', '));
    };
    show('atSquad', 'blows at the squad, by type');
    show('atFoe', 'blows at the hostiles, by type');
  }
  line('sky fought under', spread(tables.skies, marginal(p => p[0])));
  // J01: and what it took while it was up. Both sides, because the two weather sites damage
  // whatever is standing, and by sector, because the curve they use resets at every sector
  // boundary while the bodies they land on do not.
  {
    const pl = results.reduce((a, r) => a + (r.wxTookPlayer || 0), 0);
    const fo = results.reduce((a, r) => a + (r.wxTookFoe || 0), 0);
    const tn = results.reduce((a, r) => a + (r.wxTurns || 0), 0);
    if (pl + fo > 0) {
      line('  the sky took, squad / hostile', `${pl} / ${fo}`);
      line('  turns with weather up', `${tn} (${((pl + fo) / Math.max(1, tn)).toFixed(2)} damage a turn, both sides)`);
      const cause = {};
      results.forEach(r => Object.entries(r.wxByCause || {}).forEach(([k, v]) => { cause[k] = (cause[k] || 0) + v; }));
      line('  by cause', Object.entries(cause).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') || 'none');
      const bys = {};
      results.forEach(r => Object.entries(r.wxBySector || {}).forEach(([k, v]) => { bys[k] = (bys[k] || 0) + v; }));
      const byt = {};
      results.forEach(r => Object.entries(r.wxTurnsBySector || {}).forEach(([k, v]) => { byt[k] = (byt[k] || 0) + v; }));
      // Per turn under weather, which is the only form of this row that compares sectors: the
      // raw totals track where runs end, not what the sky does once you are there.
      line('  per weather turn, by sector', Object.keys(bys).sort((a, b) => a - b)
        .map(k => `s${k} ${(bys[k] / Math.max(1, byt[k] || 0)).toFixed(1)}`).join('  ') || 'none');
      line('  weather turns, by sector', Object.keys(byt).sort((a, b) => a - b).map(k => `s${k} ${byt[k]}`).join('  ') || 'none');
      // And what a tick was worth against the bar it hit. This is the row the item turns on:
      // a flat number stays flat while the bodies on the other side of it do not.
      const shr = who => {
        const acc = {};
        results.forEach(r => Object.entries(r[who] || {}).forEach(([k, v]) => {
          acc[k] = acc[k] || [0, 0]; acc[k][0] += v[0]; acc[k][1] += v[1];
        }));
        return Object.keys(acc).sort((a, b) => a - b)
          .map(k => `s${k} ${(acc[k][0] / Math.max(1, acc[k][1]) * 100).toFixed(1)}%`).join('  ') || 'none';
      };
      line('  a tick as a share of the squad bar', shr('wxShrPlayer'));
      line('  and of the hostile bar', shr('wxShrFoe'));
    } else line('  the sky took', 'nothing — no weather ledger reached this report');
  }
  // A faction's own sky over its own ground - the rarest thing the weather system makes, since
  // it needs the faction, then the right one of its two grounds, then the weather roll.
  const confTotal = tables.conf.reduce((a, c) => a + (field[c.cell] || 0), 0);
  line('confluences', `${(confTotal / fieldTotal * 100).toFixed(1)}% of fights - ` +
    tables.conf.map(c => `${c.faction} ${((field[c.cell] || 0) / fieldTotal * 100).toFixed(1)}%`).join(', '));
  // Every thread listed, including the ones that fired zero times - a list of what turned up
  // cannot show you what never did, and "two of six never appeared" is the whole finding.
  const threads = {};
  results.forEach(r => (r.threads || []).forEach(t => { threads[t] = (threads[t] || 0) + 1; }));
  const allThreads = await page.evaluate(() => FOLLOWUPS.map(f => f.title));
  allThreads.forEach(t => line(`  thread: ${t}`, `${threads[t] || 0} of ${n} runs`));
  // A mean is what a random walk hides behind: +1 and -1 average to zero and report as "barely
  // moves". What matters is how far it got, and how often it got far enough to open a door.
  const stand = {};
  results.forEach(r => Object.entries(r.standings || {}).forEach(([k, v]) => { (stand[k] = stand[k] || []).push(v); }));
  Object.entries(stand).forEach(([k, v]) => {
    const mean = (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1);
    const hi = Math.max(...v), lo = Math.min(...v);
    const gated = v.filter(x => Math.abs(x) >= 2).length;
    line(`  standing: ${k}`, `mean ${mean}, range ${lo} to ${hi}, reached a gate in ${gated}/${v.length}`);
  });

  console.log('\n── RELICS ' + '─'.repeat(48));
  const relics = {};
  results.forEach(r => r.relics.forEach(id => { relics[id] = (relics[id] || 0) + 1; }));
  const allRelics = await page.evaluate(() => RELIC_POOL.map(r => ({ id: r.id, tier: r.tier })));
  allRelics.forEach(r => line(`${r.id} (${r.tier})`, `${((relics[r.id] || 0) / n * 100).toFixed(0)}% of runs`));
  line('relics held, mean', (Object.values(relics).reduce((a, b) => a + b, 0) / n).toFixed(1));
  const unreachable = allRelics.filter(r => !relics[r.id]).map(r => r.id);
  line('never dropped', unreachable.length ? unreachable.join(', ') : 'none');
  // A per-run percentage for a curse says nothing without knowing how often one was even on
  // the table: a commander offer is the only place a curse can appear, and the median run
  // does not reach many commanders. Counts, then rates off those counts.
  const tot = k => results.reduce((a, r) => a + (r[k] || 0), 0);
  const relOffers = tot('relicOffers'), cOff = tot('cursedOffered'), cTook = tot('cursedTaken');
  line('relic offers seen', `${relOffers} across ${n} runs (${(relOffers / n).toFixed(2)} per run)`);
  line('offers holding a curse', relOffers ? `${cOff} of ${relOffers} (${(cOff / relOffers * 100).toFixed(0)}%)` : '0 - no offers');
  const cacheOff = tot('cacheOffered'), cacheTk = tot('cacheTaken');
  line('camp caches offered', `${cacheOff} across ${n} runs (${(cacheOff / n).toFixed(2)} per run)`);
  line('camp caches taken', `${cacheTk} (policy: ${RELICS})`);
  line('curses taken', `${cTook} in total \u2014 ${cTook - cacheTk} from ${cOff} commander offers, ${cacheTk} from the camp (policy: ${RELICS})`);

  console.log('\n── THE BOARD ' + '─'.repeat(45));
  line('bounties completed, mean', mean(nums('bountiesDone')).toFixed(2));
  const settled = {};
  results.forEach(r => Object.entries(r.settled || {}).forEach(([k, v]) => { settled[k] = (settled[k] || 0) + v; }));
  const allTypes = await page.evaluate(() => BOUNTY_POOL.map(b => b.type));
  line('contracts settled', allTypes.map(t => `${t} ${settled[t] || 0}`).join(', '));
  const unsettled = allTypes.filter(t => !settled[t]);
  line('never settled', unsettled.length ? unsettled.join(', ') : 'none');
  const bookedN = results.reduce((a, r) => a + (r.booked || 0), 0);
  const doneN = results.reduce((a, r) => a + r.consequences, 0);
  line('consequences booked, mean', (bookedN / n).toFixed(2));
  line('consequences resolved, mean', mean(nums('consequences')).toFixed(2));
  line('  of what was booked', bookedN ? `${doneN} of ${bookedN} (${(100 * doneN / bookedN).toFixed(0)}%)` : 'nothing was booked');
  const kinds = {};
  results.forEach(r => Object.entries(r.bookedKinds || {}).forEach(([k, v]) => { kinds[k] = (kinds[k] || 0) + v; }));

  // ── H06/H08: what the road offered against what was taken ───────────────────────
  const sumMap = key => { const m = {}; results.forEach(r => Object.entries(r[key] || {})
    .forEach(([k, v]) => { m[k] = (m[k] || 0) + v; })); return m; };
  const off = sumMap('offeredNodes'), took = sumMap('takenNodes');
  const offTot = Object.values(off).reduce((a, b) => a + b, 0);
  const tookTot = Object.values(took).reduce((a, b) => a + b, 0);
  const shareOf = (m, t) => Object.entries(m).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${v} (${t ? (v / t * 100).toFixed(0) : 0}%)`).join(', ');
  const cMet = tot('cachesMet');
  line('sealed caches met', `${cMet} (${(cMet / n).toFixed(2)} per run)`);
  if (cMet) {
    line('  opened clean by somebody on the line', `${tot('cachesClean')} (${(tot('cachesClean') / cMet * 100).toFixed(0)}%)`);
    line('  forced', `${tot('cachesForced')} (${(tot('cachesForced') / cMet * 100).toFixed(0)}%)`);
    line('  scrap out of them', `${tot('cacheScrap')} (${Math.round(tot('cacheScrap') / cMet)} a cache)`);
    line('  which lock they were', shareOf(sumMap('cacheLocks'), cMet));
    const opn = sumMap('cacheOpener');
    line('  who opened them', Object.entries(opn).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') || 'nobody');
  }
  const from = sumMap('bookedFrom');
  const fromTot = Object.values(from).reduce((a, b) => a + b, 0);
  line('consequences booked, by source', shareOf(from, fromTot) || 'none');
  line('node kinds offered on the road', shareOf(off, offTot) || 'none');
  line('node kinds taken', shareOf(took, tookTot) || 'none');
  const forks = tot('forks'), withChoice = tot('forksWithChoice'), allFights = tot('forksAllFights');
  line('routing decisions faced', `${forks}`);
  line('  with something other than a fight on offer', `${withChoice} (${forks ? (withChoice / forks * 100).toFixed(0) : 0}%)`);
  line('  where every option was a fight', `${allFights} (${forks ? (allFights / forks * 100).toFixed(0) : 0}%)`);
  line('  and a non-fight was actually taken', `${tot('tookNonFight')} (${forks ? (tot('tookNonFight') / forks * 100).toFixed(0) : 0}%)`);
  const evOpt = tot('evOptions'), evBk = tot('evBookable'), evCould = tot('evCouldBook');
  // I01: the second chance, and whether it is on sale. `open` is every moment a squad was losing
  // and the engine would have let it break away but for the money; `afford` is how many of those
  // it could actually pay for. Nothing in this file takes the retreat, so this is the door as the
  // game offers it, not as a policy uses it.
  {
    const open = tot('retreatOpen'), afford = tot('retreatAfford');
    const all = a => results.flatMap(r => r[a] || []);
    const med = a => a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)] : 0;
    line('retreat was on the table', `${open} times`);
    line('  and affordable when it was', `${afford} of ${open} (${open ? (afford / open * 100).toFixed(0) : 0}%)`);
    line('  median price asked', med(all('retreatAsked')));
    line('  median purse at that moment', med(all('retreatPurse')));
    const by = {};
    results.forEach(r => Object.entries(r.retreatBySector || {}).forEach(([k, v]) => {
      const row = by[k] || (by[k] = { open: 0, afford: 0 });
      row.open += v.open; row.afford += v.afford;
    }));
    const cols = Object.keys(by).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
    line('  affordable by sector',
      cols.map(k => `${k.slice(1)}: ${by[k].open ? Math.round(by[k].afford / by[k].open * 100) : 0}% of ${by[k].open}`).join('  '));
  }

  line('event choices offered, total', `${evOpt}`);
  // H14: what the income constant actually buys. A choice priced at a sector-one constant costs
  // a falling fraction of a node as income compounds, so this rate is the exchange rate between
  // the two economies - not a fact about the cards.
  const evShown = tot('evShown'), evPriced = tot('evPriced'), evTook = tot('evPricedTook');
  line('  of those, priced at a sector-one constant',
    `${evPriced} of ${evShown} (${evShown ? (evPriced / evShown * 100).toFixed(0) : 0}%)`);
  line('  and affordable when offered',
    `${evTook} of ${evPriced} (${evPriced ? (evTook / evPriced * 100).toFixed(0) : 0}%)`);
  {
    const by = {};
    results.forEach(r => Object.entries(r.pricedBySector || {}).forEach(([k, v]) => {
      const row = by[k] || (by[k] = { offered: 0, afford: 0 });
      row.offered += v.offered; row.afford += v.afford;
    }));
    const cols = Object.keys(by).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
    line('  affordable by sector',
      cols.map(k => `${k.slice(1)}: ${by[k].offered ? Math.round(by[k].afford / by[k].offered * 100) : 0}%`).join('  '));
  }
  line('  of them, ones that book a consequence', `${evBk} (${evOpt ? (evBk / evOpt * 100).toFixed(0) : 0}%)`);
  line('  events where a consequence was on the table', `${evCould} of ${tot('events')} (${tot('events') ? (evCould / tot('events') * 100).toFixed(0) : 0}%)`);
  line('  and the ceiling this run left on the table', `${evCould - tot('booked')} bookings not taken`);
  line('  by kind', Object.entries(kinds).map(([k, v]) => `${k} ${v}`).join(', ') || 'none');
  line('events seen, mean', mean(nums('events')).toFixed(1));

  if (errors.length) {
    console.log('\n── PAGE ERRORS ' + '─'.repeat(43));
    [...new Set(errors)].slice(0, 10).forEach(e => console.log('  ' + e));
  }
  // F03: two-sided, and it says which side. The old form compared this file's count with the
  // engine's AFTER the post-fight block had written this file's count into the engine, so the
  // engine's number could only ever be >= this one and the check could fire on a double count
  // and on nothing else. It could not see the engine under-counting at all, because the top-up
  // silently repaired it - and the top-up is exactly the path that used to pay less than
  // checkWinState. The repair is reported now: how much of the number the engine banked itself,
  // and how much this file had to add.
  const simB = results.reduce((a, r) => a + r.bosses, 0), engB = results.reduce((a, r) => a + (r.engineBosses || 0), 0);
  const simE = results.reduce((a, r) => a + r.elites, 0), engE = results.reduce((a, r) => a + (r.engineElites || 0), 0);
  const topB = results.reduce((a, r) => a + (r.bossTopUps || 0), 0);
  const topE = results.reduce((a, r) => a + (r.eliteTopUps || 0), 0);
  const rawB = engB - topB, rawE = engE - topE;
  const bad = [];
  if (engB > simB) bad.push(`the engine banked ${engB} commander kills against ${simB} nodes here - it is counting one twice`);
  if (engB < simB) bad.push(`the engine banked ${engB} commander kills against ${simB} nodes here, and the top-up did not close it`);
  if (engE > simE) bad.push(`the engine banked ${engE} elite kills against ${simE} nodes here - it is counting one twice`);
  if (engE < simE) bad.push(`the engine banked ${engE} elite kills against ${simE} nodes here, and the top-up did not close it`);
  if (bad.length)
    console.log(`\n  !! COUNTS DISAGREE: ${bad.join('; ')}.`
              + `\n     Every score above is wrong. Fix the post-fight block before believing any of this.`);
  else
    console.log(`\n  counts agree both ways: ${simB} commanders (${rawB} banked by the engine, ${topB} topped up here),`
              + ` ${simE} elites (${rawE} banked, ${topE} topped up).`);

  console.log(`\n${n} expeditions, ${errors.length} page errors.\n`);

  await browser.close();
  server.close();
  process.exit(errors.length ? 2 : 0);
})().catch(e => { console.error(e); process.exit(1); });
