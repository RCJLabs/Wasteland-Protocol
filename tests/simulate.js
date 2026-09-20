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
// ── THAT PROHIBITION IS NOW A NUMBER. READ THIS BEFORE ACTING ON THE PARAGRAPH ABOVE ────
// "Never for comparing two" stood for four letter-series, and it was a rule of thumb standing
// in for a quantity nobody had measured: the win count could not compare two arms because its
// SPREAD was unknown, not because a proportion is unusable in principle. K06 measured it.
//
//   sd of one 150-expedition career's win count            6.4
//   sd of a three-career arm mean                          3.7
//   gap two arms of THREE can settle                       wider than ~14 wins
//   gap two arms of SIX can settle                         wider than ~9 wins
//
// So the honest statement is not "never". It is: at fourteen runs, three wins is inside its
// own noise and the D09 story above is what that looks like; at 150 expeditions and SIX
// careers an arm, a gap wider than about nine wins is real. K11 then used exactly that -
// eighteen careers, three arms of six - and measured the trinket slot at +10.0 wins against a
// 3.2 sd, which is a claim the paragraph above would have forbidden and which the instrument
// can in fact support. See the K06 and K11 records below for both.
//
// Two things the measurement does NOT license, because they are the part the old rule got
// right. Three careers an arm still cannot settle a win-count difference unless it is very
// large, so the many "3 x 60" and "3 x 150" arms recorded below are describing samples and are
// not comparisons on that row whatever they say. And none of this touches the whole-report
// problem in the next section: a floor per row says nothing about reading two hundred rows at
// once.
//
// The general shape, which is the thing to carry forward: a claim this file cannot make is
// usually a claim whose instrument nobody has characterised yet. Measure the instrument, and
// the prohibition turns into a threshold.
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
//   ^^ READ: not an open question - the sentence says itself it does not need measuring.
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
//   ^^ READ: HALF OF THIS IS WRONG AS WRITTEN, corrected by the P-audit. The line IS re-drafted
//   every expedition: EXPEDITION calls confirmNewGame per run, which rebuilds playerRoster from
//   ROSTER_TEMPLATE, and the draft block runs after it. There is no roster to "change between
//   expeditions" because the roster resets. What is true, and what this was reaching for, is
//   that the draft POLICY never adapts to mastery - confirmNewGame does not touch `mastery`, so
//   a career accumulates ranks while `--draft line` opens with a Bruiser or a Shotgunner on
//   expedition 1 and on expedition 150 alike, though by then every class has a fourth ability.
//   THE CAPSTONE HALF STANDS AND IS STILL OPEN: no policy banks one to take later.
//   ^^ ANSWERED by F10b, and the reason nobody had is that the play does not exist. `--perks
//   bank` walks the BANK THE POINT button now; capstones arrive through the promotion screen at
//   1.9-2.9 a run and off the Outpost shelf at 0.14-0.22, so banking skips the door capstones
//   come through to queue at the one that barely stocks them. The point becomes a stat card: 11
//   signatures a run traded away, wins unmoved at +0.67 across three careers an arm.
//   Split out deliberately, because the P-audit's correction above reclassified this whole entry
//   in one stroke while its own text said half of it still stood - and stale.js then stopped
//   counting a live claim. A marker that settles two claims at once can only be right about one.
//   Worth noting how long this survived: the claim is present-tense AND marked, so stale.js
//   counts it as read and never looks again. A marker is only as good as the reading behind it.

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
// WHAT THIS DID NOT DO. The wipe rate barely moved (6.4 -> 5.8-6.2 a run ^^ O-audit: was "a career", and
// the report has always printed this one as "wipes per run, mean"): runs still end in
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
//   ^^ ANSWERED BY O16: the arm exists, the blocker was one line (I02 had already built
//   engineOpened for it), and walking through the door is a well-powered null. The "much larger
//   change" this paragraph predicted was wrong, and O16 says so where it belongs.

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
//   ^^ READ: not an open claim - the next clause closes it ("the engine books it now").
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
// squad meets bio on 32% of the blows aimed at it and energy on 20% (K08's figure - the 13%
// written here originally predated the sky being wired to a type), which is to say every run;
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
// WITHDRAWN BY K06, AND SETTLED BY K11. What this said was: "the catalogue is neutral at one
// answer a body and expensive at two", off max1 (53.7 wins) against road6 (40.7). K06 re-ran
// that same max1 configuration twice more and got 41.3 and 48.3, so the gap it rested on was
// inside the instrument's own noise. K11 then measured it properly, six careers an arm:
//
//   careers won of 150   capped at one 45.8   uncapped 44.3   -1.5, 0.6 sd, on a design that
//                                                             settles a gap wider than 8.0
//
// UNCAPPING THE ANSWERS IS A NULL. Every row overlaps - depth, wipes, score, bodies lost - and
// the largest of them is 0.8 sd. The original claim was ten wins; the measurement is one and a
// half in the same direction, which is to say nothing. And the row that explains why sits beside
// it: augments installed per run reads 15.45 capped against 15.47 uncapped. The cap never
// changed how much of the bench got bought, only WHICH - so it was always a question about the
// mix, and the mix turns out not to be worth a wall reading either way.
//
// What still stands from the arms is the shape: the road policy takes answers into 35% of
// installs unrestricted and 18% capped, and the sets it produces are Optics+Optics+Rod and
// Optics+Pump+Weave rather than three of the same. --augmax stays at 1, on the mechanism K09
// re-based it onto rather than on a wall reading, because there is no wall reading to have.
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

// ── M03: TYPING BLEED COSTS FOURTEEN POINTS OF WIN RATE, AND THE SCAR REPRICE IS A NULL
// Two owner design calls, measured together and then BISECTED because both were live and the
// combined arm could not attribute anything. Three arms, 3 x 150 each, this file identical
// throughout, before = the M01 tree.
//
//                              before    bleed typed ONLY    both changes
//   runs won of 150              44.3          24.7              27.3      42 45 46 / 20 35 19 / 23 29 30
//   wipes per run                5.27          6.08              6.21
//   grudge commanders % won        44            36                36
//   wipes at tier ten             704           810               830
//   % of scars treated             90            89                87
//
// TYPING BLEED IS THE WHOLE EFFECT. The bleed-only arm sits at or below the both-changes arm on
// every row, so the scar reprice contributes nothing to the difficulty move - the commander rate
// falls the full 8 points on bleed alone, and wipes and tier-ten wipes do 84-86% of their move
// there. The win count drop clears K06's ~14 floor and the ranges separate completely, so this
// is real and not three noisy careers.
//
// In the terms I06 tuned to: the win rate goes from about 30% to about 16%.
//
// WHY IT IS SO EXPENSIVE, and it is ARMOUR rather than resistance. L03 measured the squad
// DEALING 10.8% of its damage as bleed and TAKING only 2.3%. Hostiles carry far more armour
// than operators do, and mitigate subtracts armour from every tick now - so the change cuts the
// squad's own bleed output roughly five times harder than it cuts the squad's intake. Fights run
// longer, the squad eats more on the way, and the commander rate falls. A correctness fix landed
// as a one-sided nerf because the two sides of the ledger were never symmetric.
//
// AND THE SCAR REPRICE DID NOT DO ITS JOB. 90% -> 87% treated is a null. Doubling the price
// within an expedition does not bite because the purse is large by the time scars accumulate and
// the harness policy only asks for scrap >= cost x 3; even 960 clears that late. If scars are
// meant to stick, PRICE IS THE WRONG LEVER - the fix has to be scarcity (a cap per expedition, a
// cost in something other than scrap) rather than a bigger number.
//
// A ROW NOT TO QUOTE FROM THIS PAIR: "damage BY the squad, a run" reads +24.9% and means nothing,
// because M03 moved bleed OUT of L03's untyped bag and INTO the typed rows - so the metric counts
// different things on the two sides. The typed ledger also books the RAW figure before armour
// eats it, so the number can rise while actual damage dealt falls, which is exactly what happened.
// Same trap as L02's "+5.8% squad damage", wearing a different costume.
//
// ── T06: THE CLOCK'S DOOR IS THE WRONG DOOR, AND THE OTHER ONE CANNOT BE READ ────────
// R02b measured the clock converting deaths into setbacks - wipes a run up 0.46, operators lost
// for good down 0.41 - and wrote down what it had not done: "THAT PAIRING IS THE READING AND IT
// IS NOT ISOLATED ... nothing here withheld the rescue channel to prove it." That was the last
// un-isolated chain in this record, and T05 had just shown one such chain to be arithmetic
// coincidence. Asked as a CENSUS rather than as an arm, because the claim is about WHERE the
// saved bodies are and a census answers that for the price of one run.
//
// THE DOOR. forceBreakContact ends with recoverDowned, so anybody on the floor when the clock
// runs out walks away with the squad. That is the only way a clock can keep a body. It is now
// booked by which of the two exits opened it, and every other door a body comes off the floor
// through is booked beside it. 150 expeditions:
//
//   door                                       bodies   exits   an exit   a run   share
//   the harness's own fight-end stand-in         1649     729      2.26    10.99    82%
//   a withdraw the player chose                   334     267      1.25     2.23    17%
//   the engine's own win block                     16      16      1.00     0.11     1%
//   the harness's stand-in, won fights             11      11      1.00     0.07     1%
//   A CLOCK ENDING THE FIGHT                        0     175         -     0.00     0%
//
// ACROSS FOUR RUNS THE CLOCK HAS PICKED UP TWO BODIES IN 365 ENDINGS: 0 of 24, 0 of 26, 2 of
// 140, 0 of 175. R02b's pairing needs 0.41 operators a run through this door. It delivers about
// 0.006. Seventy times short, and stable.
//
// AND THE REASON IS STRUCTURAL RATHER THAN A TUNING ACCIDENT. A withdraw is CHOSEN, and the
// policy chooses it when the squad is losing - which is exactly when somebody is on the floor.
// It collects 0.53 bodies an exit. A clock fires on a turn count and asks nothing about how the
// fight is going, so it catches the average moment, and on the average moment the floor is
// empty. Same code path, same recoverDowned, opposite selection. The exit R02 deliberately
// SHARED with withdraw - "one exit, not two", which suite 181 pins - is the reason the channel
// looked available, and sharing the code never shared the situation.
//
// THE OTHER DOOR CANNOT BE READ AT THIS SAMPLE SIZE, and saying so is the whole discipline. A
// clock could keep a body without picking one up, by ending the fight before anybody falls. The
// row for that is deaths on the ROAD that happened in a clocked fight, against the clock being
// dealt to about 19% of road fights - and `pressedFor` deals it off a hash of node and sector
// with no read of difficulty or faction, so there is no selection to correct for. Three
// identical 150-expedition careers read:
//
//   13 of 106  (12.3%)      7 of 129  (5.4%)      3 of 114  (2.6%)
//
// Thirteen, seven and three. A factor of five apart on the same build with the same policy,
// which is K06's floor arriving on a count nobody had looked at before. Every one of them is
// below the 19% exposure and I am not entitled to that direction: the spread is the finding.
// Reading the lowest of three and calling it a mechanism is precisely what this file has caught
// itself doing four times.
//
// SO R02b'S COST STANDS AND ITS READING IS HALF WITHDRAWN. S04 settled the body claim at
// p = 0.0006 and nothing here touches it - the clock really does keep 0.41 operators a run. What
// is refuted is the door: it is not the rescue channel, because that channel carries nothing.
// One candidate eliminated, the other unresolved, and the +0.41 still unexplained - which is a
// better position than "suggestive of the same bodies" and an honest one.
//
// AND AN INSTRUMENT FINDING NOBODY HAD SEEN, which is what a census is for: 82% of every
// recovery in a simulated career is THE HARNESS STANDING IN FOR THE ENGINE. The sim's fight loop
// never reaches checkWinState's victory block, so it calls recoverDowned itself - documented at
// its own site since it was written, and invisible in any report until this table. The engine's
// own win door reads 1% here for the same reason. Nothing is wrong with it; it is labelled now,
// because an unlabelled majority reads as a fifth door the game has.
//
// ── T05: PAY A FLED BODY ITS 15 - THE CHAIN IS A COINCIDENCE OF SCALE ────────────────
// R03 shipped a morale break, measured it costing about half an operator a run, and explained
// the cost by arithmetic through momentum: 4,254 fled bodies a career at 15 apiece is ~63,800
// forgone, ~2,127 STIMs not bought, fewer rescues, recovery 84% -> 80%. Predicted STIM fall
// ~4,327 against an observed 4,425 - within 2%. It then said plainly that nothing had withheld
// the momentum term ON ITS OWN, wrote the arm down, and priced it at one arm of three careers.
// That marker has read STILL OPEN ever since. This is that arm.
//
// THE ARM. `--morale pay` keeps the break and hands the squad exactly the momentum killing the
// body would have paid - the same KILL_MOMENTUM a kill pays, by construction - and nothing else:
// no kill credit, no bounty, no bestiary, because those are noteKill's. One term, isolated.
// Three careers of 150 a side, same commit, against `--morale on`.
//
//   row                          on                      pay                   mean        sep
//   ended the road               32 / 25 / 16            22 / 23 / 22          24.3 -> 22.3  overlap
//   actor turns per fight        32.1 / 31.3 / 34.1      30.6 / 30.4 / 32.5    32.5 -> 31.2  overlap
//   lost for good, per run       3.89 / 4.41 / 3.79      3.94 / 3.86 / 3.82    4.03 -> 3.87  overlap
//   wipes per run                6.29 / 6.69 / 6.24      6.61 / 6.65 / 6.81    6.41 -> 6.69  overlap
//   put on the floor, per run    17.4 / 18.6 / 16.1      17.5 / 18.6 / 17.5    17.4 -> 17.9  overlap
//   dragged clear, per run       13.4 / 14.7 / 12.7      13.9 / 14.8 / 14.6    13.6 -> 14.4  overlap
//   recovery %                   77.0 / 79.0 / 78.9      79.4 / 79.6 / 83.4    78.3 -> 80.8  DISJOINT
//   rescues by STIM              3766 / 4061 / 3504      3615 / 3781 / 3819    3777 -> 3738  overlap
//   turns STIM was AFFORDABLE    73% / 73% / 73%         72% / 72% / 71%       73 -> 71.7    DISJOINT
//
// I WROTE THE PREDICTION IN THE COMMIT BEFORE THE RUN AND THE HEADLINE HALF IS WRONG BY TWO
// ORDERS OF MAGNITUDE. Predicted: STIM purchases up ~2,100 a career. Measured: -39, a flat null
// on overlapping ranges. Predicted: operators lost for good pulled from 4.42 toward 3.81.
// Measured: 4.03 -> 3.87, overlapping. The one thing I got right was recovery leaning up.
//
// THE ROW THAT KILLS THE CHAIN IS THE AFFORDABILITY ONE, and it moves the WRONG WAY. If momentum
// were the constraint on rescues, handing over 63,800 more points a career would make the 30-cost
// STIM tactic affordable on more of the turns that could reach a body. It was affordable on 73%
// of them before and 72% after, disjoint in the wrong direction. Momentum was never what was
// stopping the squad picking people up.
//
// AND THE REASON IS TWO LINES OF THE ENGINE THE CHAIN NEVER ASKED ABOUT. addMomentum clamps at
// 100, and bankNode - the one choke point every node banks through - sets momentum to 0 at the
// end of every one. So 4,254 x 15 is not a career purse. It is 15 points at a time into a wallet
// that holds 100 and is emptied after every fight, roughly 6,800 times a career. The 2% agreement
// was two numbers of the right magnitude meeting, not a mechanism: multiply a per-event value by
// an event count and you get something the size of the observed change whether or not the
// currency can be held.
//
// WHAT SURVIVES, AND WHAT IT IS WORTH. Recovery is disjoint 3/3, 78.3% against 80.8%. R03's own
// convention would call that separated, and this file has learned better twice: Welch on it is
// t = 1.71 on df = 2.9, which does not clear, and the pay arm's spread is doing the work (83.4
// against 79.4 and 79.6). Disjoint at three a side is what K06's floor exists to refuse. So the
// honest reading is a lean, not a finding, and it is a lean on the row the chain does NOT run
// through - recovery moved while the STIM purchases that were supposed to cause it did not.
//
// SO R03'S COST STANDS AND ITS EXPLANATION DOES NOT. The half-operator a run was measured against
// `--morale off` and nothing here touches that. What is withdrawn is the channel: the momentum
// half is not the mechanism, the arithmetic that named it was a coincidence of scale, and this
// item's own prediction repeated the same mistake in the same direction. Three open claims
// become two.
//
// AND A FLAW IN MY OWN DESIGN, said rather than buried. My fourth predicted row - "turns per
// fight stays short at 31.9 rather than restoring 33.9" - was written as the discriminating one
// and could never have discriminated: BOTH arms here have the break on, so there was no reason
// for fight length to move either way and 33.9 is a number from a control this experiment does
// not contain. A discriminating row has to be one the two arms could actually differ on.
//
// ── T04: THE LIST NOBODY HAD READ, AND SEVEN CANDIDATES THE FILE KILLED ITSELF ────────
// G11 built the coverage line four hundred items ago and named two examples off it. Nobody has
// ever read the list. It stood at 143 of 931 exports named by no suite - 129 at the H-audit,
// 148 of 822 when G11 measured it, so roughly flat in count while the surface grew, which is
// already gentler than G11's own fear that it "grows faster than suites close it".
//
// SORTED BY WHAT THE ENGINE ITSELF DOES WITH THEM, five names are used nowhere in game.js
// outside their own definition: exported, untested, and uncalled. That is the L02/N05 shape -
// a helper with no reader is either dead weight or a missing call - so all five were walked.
//
// THE HEADLINE WAS A DEFECT I WROTE THE FIX FOR AND THEN HAD TO WITHDRAW. syncAllRankPerks is
// the bulk "re-read the whole line" helper, and two things move an operator between ranks
// mid-fight without calling it: REPOSITION, the player's own swap, and DRAG_DOWN, the hostile
// signature that hauls the furthest body forward. HARDENED pays HP only in the front rank and
// SWIFT pays speed only out of it, so a swap looked like a free keep of both. It measures:
//
//   REPOSITION, front <-> mid    17-21 maxHp carried out of the front, 4 speed carried into it
//
// Fixed at both sites, re-measured at 0 and 0, and then suite 160 went red on a row I had not
// read: "and neither health bar moves when it does". Its comment is unambiguous - the rank
// cards read the DEPLOYED rank, a health bar that jumps when two operators trade places is the
// thing that made the first cut of M04 reach for a per-hit cut instead, and "mutation testing
// caught that - ADDING A SYNC CALL INSIDE THE REPOSITION BRANCH survived the earlier row", so
// the row exists to catch precisely the edit I had just made. The card text already says
// "while DEPLOYED in the front rank". Reverted whole; the design is right and it is written
// down at the site.
//
// AND THE SECOND ONE WAS DELIBERATE TOO. noteUntyped books L03's untyped bag and has no caller,
// which reads like a census recording nothing - except the report that prints it already says
// so out loud: "M03 typed the last unledgered path, so this bag is expected to be EMPTY", and
// the row prints `none - every path to a bar goes through it` rather than a blank. Kept as the
// instrument standing ready, correctly.
//
// THREE WERE REAL AND ARE GONE, and two of the three were carrying a justification that is not
// true:
//
//   castName          formatted "Name, the Epithet" and was never called. The two screens that
//                     name a face build the string inline and DIFFERENTLY on purpose - prose in
//                     the codex, a chip on the event tag - so a shared formatter would have to
//                     pick one register and be wrong on the other. K04's rule reversed: here a
//                     third spelling was the hazard, not the cure.
//   SCAR_TREAT_COST   a 120-scrap price, kept with the note "saves, older records and the
//                     migration path still name it". Nothing named it: not a save, not a
//                     migration, not a suite - one comment in 66, now corrected to the skulls
//                     M03 moved treatment onto.
//   FIELD_PAD         11px, described as "the budget recentreField spends". recentreField never
//                     read it; the 11 that is real is .battlefield's own `padding: 0 11px`, in a
//                     language that cannot see this one.
//
// 143 -> 140 of 931 -> 928. What is left in the never-called bucket is the two that are
// deliberate, which is the right end state for that bucket: examined, not unexamined.
//
// AND THE RATCHET I CAME TO ADD IS REFUSED, by the file that owns the number. S07 bounded the
// sleep count on the rule that a counted debt which is not bounded grows unnoticed, and the
// obvious next move was to do the same here. 132's own header already argues the opposite and
// records the scar: "A readout, not a gate. Failing the battery whenever a new export arrives
// would turn the number into an obstacle to route around" - and an earlier gate on two symbols
// staying UNCOVERED failed three batteries when a suite covered them. The sleep count and the
// export count are not the same kind of debt: a sleep is always a cost, an export is what
// shipping a feature looks like. Left as a readout.
//
// SEVEN CANDIDATES, THREE DEFECTS, and six of the seven were killed by notes already sitting at
// the site - the mutation-tested assertion, the report's own "expected to be EMPTY", the two
// screens that format a name differently on purpose. That is what the prose in this repo is
// FOR, and it is the second item running where reading it before pitching changed the answer.
//
// ── T03: EVERY FLOATING READOUT IN THE GAME WAS DRAWN BESIDE THE BODY IT REPORTED ─────
// T01 looked at five screens. This walked all twenty, by CLICKING rather than teleporting -
// title, citadel, chronicle, settings, manual, difficulty, contracts, muster, map, outpost and
// its three tabs and its bag, then the road itself: fights played turn by turn off the command
// deck, events, camps, the Armory, a recruit. Photographed at 1280x800 and 390x844, with a
// text-on-text counter, a clipping check, a tap-target check and page-error capture on each.
//
// NINETEEN OF TWENTY SCREENS CAME BACK CLEAN. That is the first half of the answer and it is a
// real one: N13, F13, F14, G05, G08, C11, Q01, Q02 and T02 have left the static layout in good
// order at both widths. The find was on the twentieth, in a screenshot: a floating readout cut
// off mid-word at the right edge of a phone, reading "!BREAKIN".
//
// TWO DEFECTS, ONE CAUSE, AND THE CAUSE IS THREE WORDS OF CSS. .fct carried
// `transform: translateX(-50%)` to centre itself on the body it belongs to, and
// `animation: floatUp`, whose keyframes set `transform` themselves. An animation's transform
// REPLACES the element's from frame zero, so the centring was dead the instant the readout
// appeared - every floating number in this game was drawn with its LEFT EDGE on the body's
// centre, half a string to the right of whoever it was reporting on. Measured across the 58
// distinct strings spawnFCT can print, on five field draws each:
//
//                  readout sat      landed on the WRONG body     ran off the screen
//    1280 wide       44px right       44.0%  ->  0.0%             0.2%  ->  0.0%
//     390 phone      35px right       77.0%  ->  2.7%            17.8%  ->  0.0%
//     320 phone         -                -                       18.4% ->  0.0%
//
// So on a phone three readouts in four were painted over somebody else's card and one in six ran
// off the glass. On a desktop it was four in ten and almost none off - the same overlap, three
// times the room - which is why it survived five hundred suites and fourteen phases: the harness
// runs at 400 wide but nothing in it ever asked where a damage number LANDED.
//
// THE FIX IS BOTH HALVES, and the second half is not optional. floatUp now carries
// translateX(-50%) through both keyframes, which restores the centring; spawnFCT then clamps the
// result to the part of the fx-layer the player can actually see, because "OVER THE TOP" is
// 169px at 390 and a 37px body near the edge cannot hold it even centred. The clamp is against
// the visible layer rather than the layer, because fxLayer lives inside .battlefield and
// recentreField translates that past the viewport - clamping to the layer would hold a readout
// inside a box that is itself off screen. The residual 2.7% is the clamp working as intended: a
// readout pulled back on screen can sit over a neighbour, and legible beats perfectly placed.
//
// WHAT NEARLY WENT OUT WRONG, twice. The first counter called the Citadel and the manual broken
// because a scrolling list passes UNDER an opaque footer button and pure geometry cannot tell
// that from text on text - nine false collisions on the settings panel alone, which is suite
// 185's counter being sound only because everything on .battlefield is transparent. And the
// first cut of suite 186 printed "at 1280 wide" while measuring at the runner's own 400, which
// is F03's rule arriving in a new place: a report is one edit from quoting a number the run did
// not use. Both caught before pitching, neither by luck - by asking the page what it was
// actually painting rather than trusting a rectangle.
//
// THE SIX SCREENS THE ROAD DID NOT REACH were then walked separately, through the DEV TOOLS
// panel that ships in the settings menu - so still pressed rather than teleported into. The
// perk offer, the promotion taken, the boss node at the final tier, the last fight itself and
// the run-over screen all came up clean. Only the cache had no control anywhere that opens one,
// and that shot is labelled STAGED. And pressing the panel found the second defect:
//
// WINNING A FIGHT FROM THE DEV PANEL LEFT YOU ON THE DEV PANEL. renderDev switches away from
// the fight; checkWinState ends a won fight by writing a LOOT button into the command deck and
// switches nothing, because every other caller is already standing on the combat screen. So
// "Win it" ended the fight, and the payout and the node bank sat behind a screen still reading
// "Win it" with no sign anything had happened - and BACK TO THE MAP walked away from both.
// devResolve now returns to the field, guarded on still being on the panel so a squad wipe that
// has already landed on its own screen keeps it. Suite 17 gains three rows; two fail without it.
//
// AND THE VICTORY SCREEN WAS NOT A THIRD DEFECT, which I checked before saying so. The walk's
// boss win came out on the map rather than on the victory screen, which reads like the ending
// never fires. Measured instead of filed: the final boss killed by the squad's own blow through
// resolveAction, and the same boss killed by the panel, both set runStats.won and both land on
// the relic offer that precedes the ending. The walk lost its own thread; the game did not.
//
// TWO MORE THAT DIED THE SAME WAY. A 900x15 collision on the boss screen between the turn queue
// and THE ROAD ENDS HERE banner: re-measured on a freshly staged boss fight at 1280, 390 and
// 320, there is no box overlap at all on that layer - the walk photographed a banner mid-
// animation. And "Q: MED > SCA > BRU > THE" reads like a truncation and is renderQueue's own
// three-letter code, by design since N02. Five candidates, two defects: the ratio this file
// has been printing since the S-audit.
//
// AND ONE THING FOR THE OWNER, filed as taste rather than as a defect: .map-graph is
// `max-width: 340px`, so the route map is the same 340px ribbon on a 1280px desktop as on a
// 390px phone, with the three columns at 18/50/82% of it. On a phone that is exactly right. On a
// desktop the road uses a quarter of the width it is given. Nothing is clipped, nothing collides
// and nothing is unreadable - it is a question about how the map should use a big screen, which
// is the owner's call and not a number I can settle.
//
// ── T02: THE LABELS FIT NOW, AND THE SECOND HALF OF THE FIX WAS THE HALF THAT MATTERED ──
// T01 closed by saying the layout fix wanted somebody able to iterate against the rendered page
// rather than make a blind CSS edit. T01 is what built that, so the excuse expired with it.
//
// THE CAUSE IS ARITHMETIC. Sprites overlap on purpose - .entity carries a negative margin of
// --overlap a side - so a 110px card at 1280 wide stands 72px from its neighbour. A label given
// the card's full width reaches 38px into the next one, which is exactly the overlap T01
// measured on every pair. And .status-badge ALREADY CARRIED THE FIX: `max-width: calc(100% - 2 *
// var(--overlap))`. One of the six readouts on that slot had the rule and five did not.
//
// THE FIRST CUT WAS NOT ENOUGH AND THE NUMBERS SAID SO. Giving the other five the same max-width
// took the overlap from 38px to 4-6px and stopped there:
//
//   before   FRONT over MID 38x8, MID over BACK 38x5, RANGING SHOT over FRENZY 38x12
//   after 1  a forecast over MID 4x10, FRENZY over OVERWATCH 6x9, OVERWATCH over PACK HUNT 6x10
//   after 2  none, at either width, four runs each
//
// The residual was the box model. This sheet sets box-sizing per element and never globally, so
// the tags default to content-box and their 3px of padding a side plus a 1px border sit OUTSIDE
// max-width - eight pixels the constraint could not see. border-box closed it.
//
// I WOULD HAVE SHIPPED THE FIRST CUT IF I HAD READ THE COUNTER INSTEAD OF RUNNING IT. My own
// probe returned zero collisions on the staging I happened to have; the suite, on its own roster
// draw, kept finding one or two. The roster is the variable, and one sample of it is not a
// measurement - which is the same lesson the win column taught this file eleven items ago in a
// medium nobody had thought to apply it to.
//
// WHAT WAS CHECKED BESIDE THE COUNTER, because a narrowed box that pushes ink outside itself
// satisfies a counter and fools a player: 155 (clipping) and the 11- band both stay green, and
// the field was photographed again at both widths. BACK / MID / FRONT now sit over their own
// operators, the damage forecasts under their own chips, and RANGING SHOT clear of CALL IT IN.
// HP TEXT WAS DELIBERATELY LEFT OUT of the rule for that reason: digits that must hold one line
// would have overflowed a narrower box and gone on overlapping invisibly.
//
// Suite 185's ratchet comes down from 6 to 1 - eight post-fix measurements read zero, and one is
// a single unit of slack rather than a bound with none, which is K03's rule about the file that
// exists to enforce K03's rule.
//
// ── T01: SOMEBODY LOOKED AT THE GAME, WHICH HAD NOT HAPPENED BEFORE ───────────────────
// Six items of measurement and hygiene, 4970 assertions and hundreds of simulated careers, and
// nobody had SEEN a screen. R02's clock banner shipped six items ago and had never been looked
// at. So the game was served, driven and photographed at 1280x800 and 390x844.
//
// WHAT IS FINE, and worth writing down because a feature nobody has seen is a feature nobody can
// vouch for: the clock banner renders, reads `2 TURNS BEFORE THE ROAD MOVES ON`, takes its
// clock-out class under three turns, and sits at y=53 directly under the weather banner at y=31.
// No page errors at either width. The badges, the staggered ranks and the map all draw.
//
// WHAT IS NOT: THE BATTLEFIELD PUTS TEXT ON TEXT, and nothing in the tree could see it. 155
// measures whether a card is CLIPPED and C11 whether the field scrolls SIDEWAYS; both pass, and
// neither asks whether two labels occupy the same pixels. Measured at 1280 on a hurt, badged
// squad against a crowded row:
//
//   FRONT        over MID              38 x  8 px
//   MID          over BACK             38 x  5
//   MID          over a threat number  38 x  4
//   RANGING SHOT over FRENZY           38 x 12
//
// Ranks leaning on each other is arguably the staggered line doing its job. A rank label over a
// damage forecast, and one enemy's signature over another's, are not: both are something the
// player came to read with something else on top of it. Suite 185 ratchets it; the layout fix
// wants somebody who can iterate against the rendered page and is not this item.
//
// TWO FALSE FINDINGS DIED ON THE WAY, BOTH MINE, BOTH THE SAME SHAPE. I had "the clock banner
// never renders" written down before checking - pressedFor keys on currentSector and my probe
// picked a clocked node at sector 1 and then moved to sector 3, so the fight genuinely had no
// clock. And "a route prompt fires during combat, covering the log" is my staging too: the
// prompt is queued by the map render inside confirmNewGame, and I teleported into a fight
// without ever showing the map. STAGED INSPECTION MANUFACTURES ARTEFACTS at about the rate
// staged measurement does, which is D05's lesson arriving in a new medium.
//
// AND THE RATCHET ITSELF NEARLY SHIPPED MISCALIBRATED. Which labels collide depends on the
// drafted roster and the rolled enemy row: six runs read 2,3,1,1,1,1 wide and 1,1,1,1,3,1 on the
// phone, against a first-cut bound of 4 that a differently-staged fight had already touched. A
// bound inside its own noise is K03's subject and a poor thing to ship in the suite that exists
// to catch sloppiness. It sits at 6 now, two clear of everything measured, and its job is a
// regression IN KIND rather than a one-count drift it could not see anyway.
//
// ── S07: THE SLEEP DEBT WAS UNBOUNDED, AND I AM THE ONE WHO PROVED IT ─────────────────
// Picked because this session produced the evidence: S03 had a battery die 26 assertions into a
// suite and never reproduce, and fixed sleeps are the mechanism H12 has been closing since G12.
//
// THE COUNT WENT 44 -> 48 THREE ITEMS AGO AND NOTHING SAID A WORD. Suites 182 and 183, written
// for the S-audit, carried four fresh 700ms sleeps after a Continue click. Suite 133 reports the
// remaining sleeps on every battery and asserted only `remaining.length > 0` - that the COUNTER
// works, never that the number does not grow. So the row built to watch this debt watched me add
// to it, across 4969 green assertions.
//
// Four paid, and the hole closed: 133 now ratchets at 44, the count may fall and may not rise,
// which is L06's shape for the same problem. Negative-tested by adding a sleep back: `45 of 44 -
// a new fixed sleep was added; give it a real condition, or lower CEILING here if you removed
// one`. The failure line names the chore because a red there is a chore, not a defect.
//
// THE OTHER 44 ARE NOT GROUND DOWN, deliberately. H12 left them on purpose and boot.js says why:
// after a click there is a real condition but it is a DIFFERENT one each time, and G06 showed
// that pulling one carelessly changes what the assertion was measuring. Most of what is left is
// a DRAIN - `combatActive = false` then 900ms - which is waiting for the engine's in-flight
// setTimeout chain to empty, and there is no condition for "nothing further will happen".
//
// AND THE CONDITION FOR THE FOUR HAD TO NOT BE WHAT THE SUITE ASSERTS. Waiting on the clock
// banner would have made the row that checks the clock banner vacuous. They wait on the fight
// being back up with bodies on the field, which is causally prior to every row those suites read.
//
// THE NOISE SWEEP, TWELVE BATTERIES: no reds, 4945 assertions compared, 359 printing a number
// that moves, and exactly ONE row under 3 sd of its own bound.
//
//   2.8 sd below its <= 24   [155-what-you-shrug-off.js:138]   measured 11.5 +/- 4.52, seen 4 to 14
//
// I HAD THIS ROW DOWN AS STANDING DEBT AND IT IS NOT DEBT. The comment eight lines above it
// already carries the answer, written at M04: the distribution is BIMODAL - 14 whenever the field
// renders at full scale, about 4 when fitField shrinks the cards for a crowded enemy row - so a
// two-sided sd across both modes against a one-sided bound reads room running out at the top
// where none is. This sweep reproduces that exactly at an independent twelve batteries: seen 4 to
// 14, nothing above the upper mode, against a bound of 24. The row is correctly left alone and
// the sweep cannot represent why. Three rows sit at 3.8 to 4.0 sd and none is worth moving.
//
// ONE LINE IN THAT REPORT IS MINE, NOT A FINDING. "Suites that assert a different number of times
// between batteries: The wait that is real - 24 / 25" is suite 133, which I edited while the
// sweep was in flight: early batteries read the file with 24 assertions and later ones with 25.
// A real 24/25 split would be a branch that only sometimes runs, which is worth chasing. This one
// is a process artefact and is recorded as one so nobody chases it.
//
// ── S06: THE ELEVEN POINTS WERE R02'S CLOCK - AND MY FRAMING WAS WRONG BEFORE THE DATA WAS ──
// S05 filed an open claim: tier ten's share of wipes reads 77% where #230 read 88.5 to 90.3% at
// the same wall setting. Answered without running anything, off the arms S04 already had:
//
//   arm                        n   t10 share
//   old shipped 1.08/1.10     12       77.0%
//   new shipped 1.06/1.075     6       78.0%
//   --capshape off             6       77.2%    a null, as R01 was everywhere else
//   --morale   off             6       71.5%    morale ADDS 5.5 points
//   --pressed  off             6       90.1%    <- #230's number, exactly
//
// CHRONOLOGY CONFIRMS IT. R03's morale shipped 17 Sep, #230's curve was measured on the 18th, and
// R02's clock was built after it the same day. So #230's configuration - morale on, clock not yet
// built - IS the --pressed off arm, and it reads 90.1% against #230's 88.5 to 90.3%.
//
// I WAS ABOUT TO WRITE "AND NOTHING NOTICED". IT WOULD HAVE BEEN FALSE FOR THE SECOND TIME IN
// THIS FILE - #230 made exactly that claim about the wall and had to withdraw it when M03 turned
// out to have measured it eleven entries down. R02 DID notice: its own table carries `wipes at
// tier ten 631 / 673 / 650` against a control of `835 / 802 / 853`, and it uses that fall as the
// row that PROVES the clock is not making fights harder. The movement was measured, by the item
// that caused it, in this file.
//
// SO THE REAL DEFECT IS NARROWER AND IT IS A CONTRADICTION, not a blind spot. Two entries written
// the same day sit in this file disagreeing: #230 says "tier ten's share of wipes reads 88.5 /
// 88.7 / 89.5 / 90.3% across the whole sweep - tier ten stays the gate", and R02, shipped hours
// later, records tier ten's wipes falling by 179. #230's figure was true when measured and was
// stale by the end of the day, and nothing reconciled them. S05 nearly re-published it.
//
// WHAT R02'S OWN NUMBERS IMPLIED AND NOBODY STATED, which is the one reading this item adds.
// R02 read the tier-ten fall as evidence of setbacks replacing deaths. Split the same census the
// other way - tier ten against everything under it - and the road is where the movement went:
//
//                       clock ON (n=12)   clock OFF (n=6)    t
//   road wipes t2-t9             224.0              94.3   -20.75    the clock is 2.4x the road
//   tier ten wipes               752.2             860.3    +6.79
//
// The clock MORE THAN DOUBLES the road's death toll, and tier ten's falls because fewer squads
// live to reach it - 75.7 nodes cleared against 80.0, 24.5k score against 28.0k. "Tier ten is the
// gate" is a structural claim F01, H13 and I06 all rest on, and it is 77% now rather than 90%.
// Still the gate; less exclusively so.
//
// NOTHING IS RETUNED. PRESSED.share (20%) and PRESSED.at (25 turns) are both turnable and this is
// the third price on the same card - 0.41 bodies kept, a win column this file cannot resolve, and
// now a road that kills 2.4x more. Whether that trade is the wanted one is a design call and it
// is the owner's, like the wall's target was.
//
// S05's OWN CLAIM ABOUT THE WALL SURVIVES THIS INTACT: easing hp 1.08 -> 1.06 moved the share
// 77.0 to 78.0 (t +1.02). The wall dial does not relocate where runs die. The clock does.
//
// ── S05: THE WALL TURNED, AT THE OWNER'S TARGET - 13.7% TO 18.4% ──────────────────────
// #230 made the dial turnable, measured its curve and TURNED NOTHING, because the target behind
// it is the owner's to set and this file has said so since H13. The owner set it: about 19%. One
// step down #230's curve, hp 1.08 -> 1.06 and dmg 1.10 -> 1.075, damage moving in I06's own 1.25x
// ratio on the increment so this stays one dial with a shape rather than two numbers chosen apart.
//
// WHAT LANDED, six careers on the shipped constant against the twelve-career baseline:
//
//   row                      old(12)    new(6)     delta        t        p
//   wins                       20.58     27.67     +7.08    +2.20    0.063   = 18.4% of 150
//   reached final sector       32.83     43.00    +10.17    +3.59    0.004
//   score, median             24,492    27,621    +3,129    +2.69    0.027
//   wiped                     110.08    102.50     -7.58    -1.78    0.122
//   nodes cleared, median      75.67     77.00     +1.33    +0.84    0.427
//   operators lost a run       17.86     17.55     -0.31    -0.61    0.559
//
//   win counts [20, 22, 25, 29, 30, 40]
//
// THE TARGET WAS ~19% AND THE DIAL READS 18.4%. That is the deliverable and the p on the win row
// is not the question: whether the two settings differ was already established by #230's monotone
// curve and S03's six-career arm. What this measures is WHERE the dial now sits.
//
// AND THE SHIPPED CONSTANT WAS CHECKED AGAINST THE ARM, which is the part worth having. S03, S04
// and #230 all reached this setting through --wallhp/--walldmg; shipping it reaches the same
// scaling through the module constant instead. If those two paths disagreed, three items would be
// resting on a lever that does not do what the game does. They agree on the row that matters:
//
//   wins  arm 28.33  vs  shipped 27.67   p 0.862
//
// Five of seven rows agree. `recalled` reads 26.33 against 19.83 at p 0.009 uncorrected, which
// over seven rows is inside what noise produces - and the SHIPPED path sits with the twelve-career
// baseline (19.83 against 19.33) while the ARM is the outlier, so if anything it is those six arm
// careers that drew high rather than the constant path misbehaving. Flagged, not acted on.
//
// WHAT DID NOT MOVE, and it is the property I06 picked this lever for: tier ten's share of wipes,
// 77.0% before and 78.0% after, t +1.02. Easing the curve lowers the wall without relocating where
// runs die.
//
// AND MEASURING THAT SHARE CAUGHT A STALE NUMBER IN MY OWN DRAFT. #230 read the same row at 88.5
// to 90.3% across its whole sweep; this build reads 77% at the very setting #230 measured. THE
// SHARE HAS DRIFTED ABOUT ELEVEN POINTS SINCE #230, on neither setting this item touched - runs
// are dying earlier than they were, and nothing here caused it or fixes it. The first draft of the
// note over the constants quoted #230's figure as current, and the only reason it is not shipped
// that way is that the row was measured rather than copied. That is E09's defect with a fresher
// date on it, and it is filed here rather than chased, because chasing it is its own item.
//   ^^ ANSWERED by S06, on data already in hand: the eleven points are R02's clock, and the
//   reading is sound. Nothing drifted quietly - R02 measured the same movement itself.
//
// ── S04: THE THREE OPEN CLAIMS, RE-READ - ONE SETTLES, ONE INVERTS, AND S03 LOSES ALL THREE ──
// S03 measured that a difficulty lever resolves about three times cheaper on the wipe count than
// on the win count, and the record carried three claims that had died on the win column. This is
// the first use of that finding, and the first thing to say is that IT DID NOT HELP HERE.
//
// TWELVE BASELINE CAREERS (already run for S03, same commit, game.js untouched since) against SIX
// per arm, each arm withholding one feature whole. Every arm verified BY CONSTRUCTION first: the
// report prints "none - the arm is off" on that feature's own census row, so a dead arm cannot be
// read as a null. The first cut of that check looked for a number, found the prose, and declared
// all three arms dead - which is the check working on itself.
//
//   arm            row                  base(12)   off(6)    delta       t     df        p
//   --capshape     wins                    20.58    16.50    -4.08   -2.19   14.3   0.0456  PRE
//                  wiped                  110.08   113.83    +3.75   +1.72   13.2   0.1084
//   --pressed      wins                    20.58    24.50    +3.92   +1.77   11.0   0.1038  PRE
//                  wiped                  110.08   100.50    -9.58   -3.14    8.3   0.0131
//                  operators on the floor  17.86    20.10    +2.24   +5.45    7.9   0.0006  PRE
//   --morale       wins                    20.58    15.50    -5.08   -2.37   11.5   0.0364  PRE
//                  wiped                  110.08   109.00    -1.08   -0.32    7.5   0.7603
//
// WELCH, NOT A NAIVE z, AND THE DIFFERENCE IS NOT COSMETIC. Twelve against three (the first pass)
// put almost all the variance in the small arm and collapsed the degrees of freedom to about two:
// the operators row read +5.73 as a naive z and +3.52 as a Welch t at p=0.057. Any asymmetric arm
// in this file should be read the same way or it will overstate itself by half again.
//
// AND FOUR PRE-SPECIFIED TESTS MEANS A BONFERRONI THRESHOLD OF 0.0125, not 0.05. The four are
// pre-specified because each claim named its own row before this item ran; the other rows are
// exploratory and are printed above without stars for exactly that reason. This is the header's
// own whole-report problem made concrete: p < 0.05 on one of twelve rows is what noise looks like.
//
// R02b's BODY CLAIM IS SETTLED, and it is the only thing here that clears correction. Removing the
// clock puts 2.24 MORE operators on the floor a run, p = 0.0006. R02b priced the clock at "+0.41
// operators KEPT a run, SEPARATED" and this is the same direction at a far stronger bar. The two
// numbers are not the same quantity - bodies kept against bodies put on the floor - so 2.24 is
// corroboration, not a restatement. The mechanism is plain: a clock ENDS fights, and the fights it
// ends are the ones grinding the squad down.
//
// R02b's WIN CLAIM REPLICATES AND STILL DOES NOT SETTLE. R02b read -3.00 and this reads -3.92 (the
// clock costs that many wins), same direction, same size, p = 0.1038. Left open, and now with two
// independent samples agreeing on a lean this file still cannot call.
//
// R01 REPLICATES AND DOES NOT SETTLE EITHER. R01 read +5.33 wins for the capped commander shape;
// this reads +4.08, p = 0.0456 - under 0.05, over the correction. Direction and size confirmed
// twice, verdict unchanged.
//
// R03'S POINT ESTIMATE IS INVERTED, AND ITS VERDICT IS VINDICATED. R03 measured `ended the road`
// at 19/16/15 with the break against 21/14/25 without it - 16.67 against 20.00, morale apparently
// COSTING 3.33 wins - and refused to conclude, calling it a clean null on overlapping ranges. That
// refusal was right. With four times the baseline the lean runs the other way: morale is worth
// +5.08 wins, p = 0.0364. Note what R03's own arms look like against a twelve-career baseline that
// spans 10 to 27: its "off" arm of 14 to 25 sits entirely inside that spread, and its 3.33 gap was
// three careers a side reading noise. NOTHING R03 PUBLISHED WAS WRONG, because it published a null
// rather than a direction. Two cautions on the new number: it does not clear the correction either,
// and R03's arms were measured on an older build, so only the twelve-against-six pair here is a
// clean within-commit comparison.
//
// AND THE PART THAT COSTS S03 SOMETHING. The wipe row won on NONE of the three:
//
//   capshape   wins p 0.046   vs   wiped p 0.108      the win row wins
//   morale     wins p 0.036   vs   wiped p 0.760      the win row wins, and the wipe row is BLIND
//   pressed    wins p 0.104   vs   wiped p 0.013   vs   operators p 0.0006   a THIRD row wins
//
// S03 measured its 2.6x on the wall - a difficulty dial - and wrote down the limit that would
// break it: "a lever that only moves how a surviving run ENDS is invisible on this row and visible
// only on the win count". Morale is that lever, measured: p 0.76 on wipes against p 0.036 on wins.
// The limit clause was not hedging, it was the finding's actual boundary, and it is now measured
// rather than reasoned. S03's headline stands for difficulty dials and for nothing else yet.
//
// THE ROW THAT ACTUALLY SETTLED SOMETHING IS NEITHER OF THEM. `operators put on the floor, per
// run` carried the only result clearing correction, at p = 0.0006 where wins read 0.10 on the same
// arm. It is NOT given a printed floor beside the other two, deliberately: it is the mean of a
// continuous per-run quantity, not a count of successes out of n, so `resolves` - which is the sd
// of a proportion - would be the wrong formula wearing the right label. Printing a floor computed
// the wrong way is worse than printing none, which is F03's whole rule.
//
// ── S03: THE ROW EVERY BALANCE PHASE QUOTES IS THE SECOND-BEST ROW ON ITS OWN LINE ────
// Six items in a row ended unresolved on the win column - R01's +5.33, R02b's -3.00, R03's
// momentum arm, R04's 4.33 against a floor of 9, R05 unpriceable, K11b a null at twelve an arm.
// The bottleneck was never any of those questions. K06 characterised the win count and nothing
// else, so `nodes cleared` and `deepest sector` sat beside it on every report, unreadable,
// because nobody had measured their spread. This item measures all of them, on the rule this
// header already states: measure the instrument, and the prohibition turns into a threshold.
//
// TWELVE 150-EXPEDITION CAREERS ON IDENTICAL CODE, then six more on the wall arm #230 built
// (hp 1.08/1.10 -> 1.06/1.075), which is the smallest step #230 could separate and therefore the
// honest place to ask which row sees it first:
//
//   row                     base mean      sd     cv    arm mean     delta      sd of the gap
//   wins                        20.58    4.68  22.7%      28.33     +7.75           +2.89
//   wiped                      110.08    5.20   4.7%      95.33     -14.75          -7.41
//   recalled                    19.33    3.80  19.7%      26.33     +7.00           +3.77
//   score, median              24,492    1994   8.1%     26,128   +1,636            +0.82
//   deepest sector, mean         3.96    0.20   5.0%       4.08      +0.12          +0.63
//   reached final sector        32.83    5.89  17.9%      38.83     +6.00           +1.02
//   bounties completed           8.72    0.39   4.4%       8.83      +0.11          +0.27
//   operators lost a run        17.86    0.67   3.7%      17.50      -0.36          -0.54
//   nodes cleared, median       75.67    2.71   3.6%      75.00      -0.67          -0.25
//   fights, total                8518     263   3.1%       8543     +25.08          +0.10
//
// I WROTE THE PREDICTION DOWN FIRST AND IT WAS WRONG. I expected a null - that wins would stay
// the best row, because #230's own table shows this step moving wins +42% relative against score
// +7.4% and tier-10 share +0.2%, and I reasoned a quieter row would be quieter because it was
// less responsive. That reasoning is right about the quiet rows and it missed the loud one.
//
// THE WIPE COUNT SEES THE SAME CHANGE AT 2.6x THE SEPARATION. Per-career counts, sorted:
//     wins    base [10,15,19,19,19,21,22,23,23,23,26,27]   arm [22,23,27,28,34,36]   OVERLAP
//     wiped   base [103,104,104,106,107,110,111,113,114,115,116,118]  arm [89,95,97,97,97,97]
//                                                                                    DISJOINT
// In the file's own 3-sd convention that is about 2 careers an arm against about 7 - a balance
// question this file has been calling unresolvable at three careers is resolvable at three, on
// the row printed one line above the one everybody reads.
//
// THE MECHANISM IS IN THE ARITHMETIC AND IT IS WHY THIS IS NOT LUCK. The fifteen wipes the easing
// removed came back as +7.75 wins and +7.00 recalls, almost exactly half each. The win count sees
// 53% of the movement; the wipe count sees all of it, off a base of 110 rather than 20.
//
// WHAT THIS DOES NOT LICENSE. It is ONE lever, and the mechanism says exactly where it stops: a
// lever that moves how often runs DIE shows up here, and a lever that only moves how a surviving
// run ENDS - pushing recalled to won - is invisible on this row and visible only on the win
// count. The two fail in opposite directions, they cost nothing to print together, and an arm
// should read both. Do not read this as "the wipe count is the better row"; read it as "the win
// count was never the only row, and it is the weaker of the two for difficulty".
//
// AND THE QUIET ROWS ARE QUIET BECAUSE THEY ARE DEAF, which is the trap this item was built to
// avoid and which it caught with numbers. `nodes cleared, median` is the tightest row on the
// report at 3.6% - and it moves -0.67 on a change that removes fifteen wipes, which is 297
// careers an arm and the wrong sign. `fights, total` needs 999. A low spread is not an
// instrument; a low spread against a real effect is.
//
// A NULL THAT CAME WITH IT, AND MY OWN SUSPICION REFUTED. The printed `what that count can
// resolve` is modelled, sqrt(n.p.(1-p)), and was validated once by K06 at a 32% win rate. The
// build wins 13.7% now, so I checked whether the model still holds there. It does:
//
//   pooled win rate 13.72% over 1800 expeditions   modelled sd 4.21   observed 4.68
//   chi-square 13.57 on 11 df, variance ratio 1.23x, +0.65 sd -> consistent with the model
//
// Tested by dispersion across 1800 trials rather than by comparing two sd estimates, because an
// sd from twelve careers carries +-1.1 of its own and would have settled nothing either way - at
// eight careers the same measurement read 5.01 and at twelve it read 4.68, which is that
// wandering in the flesh. K06 saw 6.4 against a modelled 5.7 and this sees 4.68 against 4.21:
// both about 11% above the model in sd, neither significant alone, and pooled still not. THE
// PRINTED FIGURE IS SOUND AND IF ANYTHING SLIGHTLY OPTIMISTIC. Nothing changed on that line.
//
// ALSO AN INDEPENDENT REPLICATION OF #230, which was not the point and is worth having: that
// item measured this step at 22.0 -> 31.3 wins on three careers a point. This reads 20.58 ->
// 28.33 on twelve against six. Same direction, same rough size, a different sample.
//
// ── S-AUDIT: TWO FACTS THAT CROSSED A BOUNDARY WRONG - ONE A RELOAD, ONE A FIGHT ──────
// A fresh sweep of the tree after the R-series. Eight candidates were killed before they were
// worth writing down, most of them because THIS FILE ALREADY SAYS SO: `walked out 0 of 150` is
// the simulator's own `--extract off` (recorded at "extraction is dead content"), ONE MORE
// FALLBACK at 0 of 150 runs is H03's, with `--reqpolicy fallback` existing to buy it, and the
// hurt-arrival cliff already carries its own x1.78 reading. Two survived, and both are the same
// shape: a fact written on one side of a boundary and read on the other.
//
// S01, THE DEADLINE A RELOAD FORGOT. R02 shipped the pressed-fight clock two commits earlier and
// put nothing in COMBAT_STATE. fightLog is in that table, so a reload brought the TURN COUNT back
// and left the deadline at its module default. Staged at turn 18 of a 25-turn fight and resumed
// through the real path:
//     before {clock:25, turns:18, left:7}   after {clock:0, turns:18, left:0, live:true}
// The squad kept every turn it had spent and lost the limit those turns were counting against,
// and pressedOut could never fire again in that fight - saving on the last turn was a free
// extension. One COMBAT_STATE entry, and suite 182 fails twelve ways without it.
//
// S02, THE CHASE CREDITED TO THE WRONG FIGHT. `fightLog.chased` was relayed through a module-level
// flag that initiateCombat WROTE near its bottom and READ near its top - twenty-five lines apart
// in the same function, which is one fight apart in time. Measured by construction across three
// fights: the one with two chasers standing on the field logged chased:false, and the next one,
// with none, logged chased:true. TURN AND BREAK N CHASES was therefore paid by the ordinary fight
// AFTER a chase, and a chase that ended a run was never paid at all.
//
// WHAT THAT WAS WORTH, matched 150-expedition careers on either side of the one-line move:
//     contracts settled, CHASED     49  ->  19
// I wrote the prediction down first and got the sign right and the size badly wrong: I expected a
// 15-25% fall on the grounds that a chase fight is somewhat harder than the fight after it. It
// fell 61%. A chase fight carries the survivors of a fight the squad ran from ON TOP of a fresh
// node, so it is not somewhat harder, it is much harder - THIRTY OF THE FORTY-NINE OLD CREDITS
// WERE PAID BY A FIGHT NOBODY WAS CHASED INTO. The bounty now does what its own text says and is
// about 2.6x rarer for it. Whether its target range of 1-2 should move is a dial, and it is the
// owner's; nothing here touches it.
//
// NOT TO BE QUOTED FROM THIS PAIR: wins 20 -> 24, median score 25,435 -> 22,079, nodes cleared
// 77 -> 75. These are ONE career each. This file's own line says a single career resolves +-4.2
// wins, and the header says median score at 150 has printed anywhere from 11,455 to 25,435 on
// stable code. A bounty worth 95 scrap landing thirty fewer times across 150 runs is 19 scrap a
// run; it cannot move a score column by 13%. That is career divergence, and the only row here
// that carries signal is the count of the thing that changed.
//
// ── R05: LIGHT ORDER WALKED THE WAY O22 WALKED NO HANDS - AND THE WIN COLUMN CANNOT SAY ──
// R05 filed that LIGHT_ORDER "has never had the same treatment" as NO_HANDS: O22 split that
// card's cost into the LINE (drafting melee-free, -7.33) and the CARD (taking the thing you
// drafted for, -4.34) using `--doctrine off`, which rolls and reads the same offers and then
// banks nothing. That is the one comparison in which the card is the only thing that moved.
// Run here in O22's exact shape, three arms interleaved, three careers of 150 each,
// `--arrange front` throughout because O13 established that any other arrangement measures the
// harness's draft rather than the doctrine.
//
//                        baseline          line, card held   line + card
//   ended the road       23 / 11 / 16      15 / 24 / 21      16 / 13 / 16
//   reached sector 7     36 / 21 / 33      34 / 34 / 33      25 / 25 / 25
//   nodes cleared, med   79 / 71 / 80      80 / 71 / 72      71 / 70 / 72
//   score, median        24.8 / 24.3 / 27.3k  21.8 / 20.5 / 19.9k  23.5 / 19.8 / 22.3k
//   lost for good, run   3.80 / 3.72 / 3.95   3.46 / 3.14 / 2.67   2.58 / 2.42 / 2.80
//
//   wins mean   baseline 16.67   held 20.00   took 15.00
//     the LINE    16.67 -> 20.00   +3.33  ranges OVERLAP, under the floor
//     the CARD    20.00 -> 15.00   -5.00  ranges OVERLAP, under the floor
//     both        16.67 -> 15.00   -1.67  ranges OVERLAP, under the floor
//
// THE READING HAS BEEN TAKEN AND THE ANSWER IS THAT THIS INSTRUMENT CANNOT PRICE IT. Every
// pairwise gap on the win column overlaps and sits under K06's 8-10 floor. The -5.00 for the
// card is NOT a price and is not published as one; O22 got separation and this does not.
//
// AND THE CONTRAST IS THE FINDING. NO_HANDS was priceable at three careers because it was
// enormous - -11.67 wins end to end, every column separating. LIGHT_ORDER end to end is -1.67.
// The card is not hard to measure because the instrument got worse; it is hard to measure
// because there is so little there.
//
// WHICH IS WHAT THE MECHANISM PREDICTED, written down before the run. O22 explained NO_HANDS'
// card cost by closeRanks: a doctrine is a promise the game will not break on the player's
// behalf, so a forbidden class is never stepped into a gap, and under NO_HANDS most of the
// bench is forbidden - every loss permanent. LIGHT_ORDER forbids TWO of seven starters, the
// Bruiser at 80 and the Shotgunner at 65; the Medic, Scavenger, Pyromaniac, Sniper and Hound
// all sit at or under the 55 cap. A far smaller forbidden set should bite far less, and -1.67
// against -11.67 is consistent with that. DIRECTIONALLY SUPPORTED, NOT ESTABLISHED: this pair
// cannot separate the card from the line, so it cannot attribute the difference to closeRanks
// rather than to the two cards simply being different sizes.
//
// THREE ROWS DO SEPARATE, and they agree on what a light line is:
//   lost for good a run   3.82 -> 3.09 -> 2.60   monotone down, baseline separated from both
//   score, median         25.5k -> 20.7k -> 21.8k  baseline separated from both
//   reached sector 7      30.0 -> 33.7 -> 25.0   held separated from took
// A squad under the cap loses fewer people and scores less; taking the card on top costs the
// deep reach. That is a lower-variance, lower-ceiling squad, which is a coherent picture of a
// light line even though the win column will not resolve it.
//
// AND IT REPRODUCES O15 ON A BUILD MANY ITEMS NEWER, which is worth more than it cost: O15 read
// the cap-55 arm at 15/17/10, mean 14.00, `--arrange front`. This run reads 16/13/16, mean
// 15.00. Two independent measurements of the same arm a long way apart agreeing inside a win is
// a check on the instrument that no single run can give.
//
// WHAT WOULD SETTLE IT is more careers an arm than this file has ever run for one question -
// K11 needed twelve to price the trinket slot. That is now the THIRD debt of exactly this shape
// in this record, beside R01's +5.33 and R02b's -3.00, and none of the three justifies twelve
// careers alone. If any of them is ever worth settling, they are worth settling together.
//
// ── R02b: RE-TUNED, AND THE TRADE IS A TRADE NOW - 0.4 OPERATORS A RUN FOR A NULL ──
// The first tuning cost 10.67 wins and the entry below says why: the clock's cost is in the
// ECONOMY, not the fight. So it was re-cut off the same histogram that sized it - 25 turns
// instead of 20 (25 catches 14% of fights where 20 catches 19%) on 20% of fights instead of
// 35% - with the shape untouched and only the exposure changed.
//
// IT LANDED WHERE THE HISTOGRAM SAID IT WOULD, which is the first thing worth saying about it:
// predicted roughly 1.0 timeouts a run, measured 0.9. The sizing row was honest.
//
//                          retuned 25/20%        first 20/35%         control (off)
//   ended the road         18 / 17 / 26          12 / 12 / 14         22 / 23 / 25
//   wipes per run          6.75 / 6.67 / 6.33    6.82 / 6.80 / 6.94   6.28 / 5.87 / 6.22
//   lost for good, a run   3.97 / 3.89 / 3.47    2.90 / 2.93 / 3.03   4.12 / 4.21 / 4.23
//   wipes at tier ten      811 / 788 / 730       631 / 673 / 650      835 / 802 / 853
//   nodes cleared, median  75 / 77 / 74          69 / 70 / 71         78 / 75 / 80
//   relics held, mean      10.3 / 11.2 / 10.5    9.0 / 9.6 / 10.0     10.5 / 11.0 / 11.2
//   score, median          24.3k / 28.5k / 25.7k 20.6k / 21.1k / 22.8k 23.8k / 27.6k / 28.3k
//
//   against the control    wins        bodies kept a run
//     first 20/35%         -10.67  SEPARATED, clears the floor     +1.23  SEPARATED
//     retuned 25/20%        -3.00  OVERLAPPING, under the floor    +0.41  SEPARATED
//
// THE WIN COLUMN IS A NULL AT THIS FILE'S RESOLUTION and the body column is not. -3.00 is under
// K06's 8-10 floor with overlapping ranges, so it is not established; +0.41 operators a run is
// 3/3 with no overlap. The economy damage that drove the first tuning is gone with it - nodes
// cleared 75.3 against 77.7, relics 10.7 against 10.9, score flat - which is the mechanism
// agreeing that the fix addressed the cause rather than masking it.
//
// AND IT IS NOT TUNED FURTHER, deliberately. -3.00 leans negative and might be real; three
// careers cannot say. Chasing a number this file cannot resolve is how a measurement turns into
// a story, and R01's +5.33 was left alone one item ago for exactly this reason.
// ^^ READ: STILL OPEN, and it is the same debt R01 filed with the opposite sign - a lean under
// the floor, left unresolved rather than tuned away. Both want the same thing to settle them:
// more careers an arm than this file has ever run for one question. K11 needed twelve to price
// the trinket slot, and neither of these is worth twelve on its own. Worth settling together if
// anything ever justifies a run that long.
//
// WHAT THE MECHANIC DOES, in one line: it converts deaths into setbacks. Wipes per run go UP by
// 0.46 (barely separated, 6.33 against 6.28) while operators lost for good go DOWN by 0.41. The
// squad goes to the floor more often and comes back off it more often. THAT PAIRING IS THE
// READING AND IT IS NOT ISOLATED - the two numbers are close in size and opposite in sign, which
// is suggestive of the same bodies, and nothing here withheld the rescue channel to prove it.
//   ^^ READ: HALF ANSWERED by T06, and the half it answers is NO. The rescue channel is now
//   censused: a clock ending a fight has picked up 2 bodies in 365 endings across four runs,
//   about 0.006 a run against the 0.41 this pairing needs. It shares withdraw's exit and not
//   withdraw's selection - a withdraw is chosen when somebody is down, a clock fires on a turn
//   count and catches the floor empty. The other half, deaths avoided by ending a fight before
//   anybody falls, reads 12.3% / 5.4% / 2.6% on three identical careers and cannot be resolved.
//
// ── R02: THE CLOCK COSTS WINS, NOT BODIES - AND MY PREDICTION HAD THE SIGN BACKWARDS ──
// The build commit wrote its prediction down before the careers ran: "I expect the win column to
// go UP rather than down - the clock's most common effect is ending a fight the squad was
// losing, and a fight that ends is a fight that stops costing." It went DOWN by 10.67.
//
// FIRST PAIR, 20 TURNS ON 35% OF FIGHTS, three careers of 150 an arm:
//
//                          on (clock)              off (control)        delta
//   ended the road         12 / 12 / 14            22 / 23 / 25        -10.67  SEPARATED
//   wipes per run          6.82 / 6.80 / 6.94      6.28 / 5.87 / 6.22   +0.73  SEPARATED
//   lost for good, a run   2.90 / 2.93 / 3.03      4.12 / 4.21 / 4.23   -1.23  SEPARATED
//   wipes at tier ten      631 / 673 / 650         835 / 802 / 853       -179  SEPARATED
//   score, median          20.6k / 21.1k / 22.8k   23.8k / 27.6k / 28.3k -5066  SEPARATED
//   deepest sector, median 3 / 3 / 3               3 / 3 / 4             -0.33  overlap
//
// The clock met 2,571 fights a career and ran out on 367 of them - 14% of the fights that
// carried one, about 2.4 a run.
//
// WHY THE PREDICTION WAS BACKWARDS, AND IT IS THE USEFUL HALF: I reasoned about the FIGHT and
// the effect is entirely in the ECONOMY. A timed-out fight pays nothing, and 2.4 of those a run
// compounds. The progression rows say it plainly - nodes cleared 69 against 78, mean level on
// arrival at a commander 7.6/7.8 against 8.1/8.3, relics held 9.0 against 10.5. The squad
// reaches the same commanders half a level lower with a relic and a half less.
//
// AND THE ROW THAT PROVES IT IS NOT HARDER FIGHTS: tier ten's wipes FELL by 179 while wipes per
// run ROSE. Runs are not losing worse commander fights, they are dying before they get there.
// That is the signature of a poorer squad rather than a steeper wall, and it is the row I would
// have missed if I had only watched the win count.
//
// WHAT THE ITEM ACTUALLY DELIVERS IS REAL AND IT IS THE OTHER DIRECTION: 1.23 fewer operators
// lost for good a run, separated 3/3. The squad wins less and keeps more of its people. That is
// precisely the inverse of R03, which cost bodies and left the win column alone, and the two
// together say the same thing from opposite ends - this game trades people against progress
// through channels neither mechanic touches directly.
//
// SO THE SHAPE HOLDS AND THE PRICE DOES NOT. 10.67 wins on a base of 23 is a 46% cut; against
// #230's wall curve that is most of two notches of the difficulty dial, spent by accident. A
// mechanic that costs that much is not a trade, it is a different game.
//
// ── #230: THE WALL, MEASURED AND LEFT WHERE IT IS - THE CURVE IS THE DELIVERABLE ──
// R01 filed "the win rate has drifted under its target and NOTHING NOTICED". The second half is
// withdrawn and corrected at its site: M03 noticed, measured it, and stated the resulting level
// in as many words - "the win rate goes from about 30% to about 16%" - eleven entries down this
// same file. What is true is that the wall has sat near half I06's stated target ever since, and
// that the re-cut was never done as its own item, because compensating for one change by buffing
// something unrelated is correctly refused INSIDE every other item and so belongs to none of them.
//
// SO THIS ITEM MAKES THE DIAL TURNABLE AND MEASURES IT, AND TURNS NOTHING. SECTOR_HP_SCALE and
// SECTOR_DMG_SCALE are an arm now (--wallhp / --walldmg) defaulting to empty, which means "leave
// the shipped constant alone". Damage is moved in I06's own ratio - its increment is 1.25x the
// health increment - rather than chosen freely, so this is one dial with a shape and not two.
//
// FOUR POINTS, THREE CAREERS OF 150 EACH:
//
//   wall hp / dmg          wins /150        mean   win%   wipes   t10 share   score
//   1.08 / 1.10  SHIPPED   21 / 24 / 21     22.0   14.7%   6.38     88.5%     25.7k
//   1.06 / 1.075           25 / 36 / 33     31.3   20.9%   6.09     88.7%     27.6k
//   1.04 / 1.05            42 / 29 / 42     37.7   25.1%   5.81     89.5%     33.4k
//   1.02 / 1.025           50 / 50 / 61     53.7   35.8%   5.09     90.3%     39.0k
//
// Monotone on every row, and each step from the baseline clears K06's 8-10 win floor: +9.3,
// +15.7, +31.7. Adjacent eased points do NOT all separate from each other - 1.06 to 1.04 is
// +6.3 with overlapping ranges - so the curve's fine shape between them is not established,
// only its direction and its ends.
//
// THE WALL'S SHAPE NEVER MOVES, which is the row that makes this a tuning dial rather than a
// redesign. Tier ten's share of wipes reads 88.5 / 88.7 / 89.5 / 90.3% across the whole sweep.
// Easing the curve lowers the wall without relocating where runs die; tier ten stays the gate.
// That is the lever I06 picked and it still behaves the way I06 said it did.
//   ^^ THOSE FOUR PERCENTAGES WENT STALE THE SAME DAY THEY WERE MEASURED. R02's clock shipped
//   hours after this arm ran and moved the share to 77%, which S06 traced back to this row. The
//   CONCLUSION survives and the numbers do not: S05 re-measured the wall dial at 77.0 -> 78.0
//   (t +1.02), so easing the curve still does not relocate where runs die. Read the sentence,
//   not the four figures.
//
// WHERE THE TARGET LIVES: interpolating the last two points, I06's 30% lands at about
// hp 1.03 / dmg 1.0375. THAT IS NOT A RECOMMENDATION TO SET IT THERE. The target is the owner's
// to set, as this file has said since H13, and the 30% figure is itself nine items old - it was
// chosen for a game that has since had bleed typed, quirks rebuilt, the mark re-homed and three
// new mechanics added. Restoring it by default would be treating a number as a fact.
//
// AND A CALIBRATION FIGURE THAT CAME FREE, worth more than it cost. The shipped row was measured
// TWICE: once as R01's control, once fresh on this build with only bookkeeping between them.
//
//   R01's control    19 / 19 / 19    mean 19.0
//   fresh baseline   21 / 24 / 21    mean 22.0    +3.0 wins on identical behaviour
//
// Three careers of the same build differ by three wins. That is this instrument's own noise at
// n=3, measured directly rather than argued, and it is independent support for K06's floor: a
// gap of three is nothing, and the 8-10 bar is not conservative.
//
// IT ALSO CLOSED A SUSPICION HONESTLY. R01's control read 19/19/19 - three identical counts
// across independent careers, about a one-in-a-thousand coincidence at that spread - and I flagged
// it rather than dismissing it, because a repeated value is what quantization looks like. The
// fresh run reads 21/24/21. It was a fluke. The check cost one arm and the alternative was
// carrying an unexamined doubt about every win count in this file.
//
// TWO SUSPECTS RULED OUT BEFORE ANY OF THIS WAS RUN. The harness defaults have moved a long way
// since K02 - `--augments` went `on` -> `road`, `--augmax` appeared at 1 where the game's slot cap
// is 3 - which is exactly D05's shape, a policy change reporting itself back as a game change. It
// is not that: both were measured neutral against the greedy baseline before being changed, with
// the arms printed. And the row is the same row, `runs that ended the road, N of 150`, identical
// in K02's simulate.js and today's.
//
// ── R02: WHAT SHAPE A FIGHT IS - THE CENSUS THAT DECIDES WHAT THE FEATURE CAN BE ──
// checkWinState ends a fight on `!pA` or `!eA` and on nothing else. No rout, no reinforcement,
// no clock, no objective, and no way to FAIL a fight while still standing. THIS IS NOT THE
// FEATURE - it is the feasibility measurement, taken before anything was designed, in the order
// H02 used when the Reckoning was refuted twice by its own measurement before a line shipped.
//
// THREE CAREERS OF 150, 26,186 FIGHTS: 20,831 won, 2,504 lost, 2,851 ended by neither.
//
//                                    c1        c2        c3      mean
//   squad turns to WIN, median         9         9         9       9.0
//     p90                             27        26        27      26.7
//     worst                          233       209       239     227.0
//   squad turns to LOSE, median       19        19        19      19.0
//     p90                             60        56        56      57.3
//   won inside 6 turns               23%       22%       20%     21.7%
//   damage taken by squad turn 12    55%       58%       56%     56.3%
//   fights still running at turn 12  41%       41%       41%     41.0%
//
// EVERY ROW IS A COUNT, NOT A SAMPLE, which is why three careers agree to a point or two. None
// of the sample-size machinery at the head of this file applies; these are censuses of 26,000
// fights and they mean what they say.
//
// FINDING 1 - DAMAGE IS LINEAR IN TURNS, NOT FRONT-LOADED. 22% of everything the squad takes has
// landed by squad turn 3, 37% by 6, 48% by 9, 56% by 12. So a fight that ended at turn 6 would
// hand the player back about 63% of the damage it was going to do. THIS KILLS THE CHEAP VERSION
// OF THE FEATURE: "hold N turns and they break off" is not content, it is a large difficulty cut
// wearing content's clothes, and it would have to be priced as one. The convenient answer would
// have been front-loaded damage and it is not what the instrument says.
//
// FINDING 2 - LOSING TAKES TWICE AS LONG AS WINNING. Median 19 squad turns to lose, 9 to win,
// with a p90 of 57. A fight the squad is losing is a long grind, and the worst fight in each
// career ran 209 to 239 squad turns - seventy rounds at three deployed. The game has no way to
// end that except by killing everything, because there is nothing else an ending can be.
//
// FINDING 3 - AND THE LONG FIGHTS ARE WHERE THE SQUAD GETS HURT. 44% of all damage the squad
// takes lands after squad turn 12, and only 41% of fights are still running then. That is the
// pairing that makes a clock a LARGE lever in both directions at once: end long fights early and
// the player keeps a great deal of health they would have lost; end them badly and it is the
// harshest thing in the game. Either way it is not a small feature and it cannot be shipped
// without an arm.
//
// FINDING 4 - THE FIELD BARELY EMPTIES. Mean hostiles still standing reads 3.2 at squad turn 1,
// 3.0 at 3, 2.6 at 6, 2.3 at 9, 2.2 at 12 - conditioned on the fight still running, so it is
// survivorship and reads as "a long fight is one where the field is still full". A rout that
// cleared the field would be walking away from two live bodies, not mopping up one.
//
// WHAT THE CENSUS POINTS AT, stated as a direction rather than a decision: the only shape that
// ADDS rather than removes is a fight the squad can FAIL WHILE STANDING. `!pA` is currently the
// only loss condition in the game, findings 2 and 3 say the grind is real and expensive, and a
// deadline is the one thing that bites there without handing damage back. That is a proposal,
// not a result, and it gets its own build and its own arm.
//
// ONE ROW HERE IS HARNESS POLICY AND NOT THE GAME, flagged rather than quoted: "fights that
// ended by neither side falling" reads 10-12%, and this file runs with a retreat policy that
// runs from fights it is losing - the banner says so on every run. That number is the POLICY's
// withdrawal rate. It is real evidence that a non-body-count exit gets used when offered, and it
// is not a property of the combat model. D05's trap is exactly this shape and it has been caught
// three times in this record already.
//
// AND THE SAME CAVEAT TOUCHES FINDING 2 at one remove: a policy that runs from fights it is
// losing means the fights that actually reach a loss are the ones it failed to escape. The
// 19-turn median is a median over those, not over all fights going badly.
//
// ── R01: THE TABLE - THE CONTENT LANDS, THE DIFFICULTY IS A NULL, AND I NAMED THE WRONG RISK ──
// Filed in two commits, the build and then this table, the way R04 and R03 were. The build
// commit wrote its prediction down in public before a career ran. Judged below, in both
// directions: the win column came out where I said it would, and the RISK I named was the wrong
// one - I worried the trade would make commander fights harder, and it leans the other way.
//
// THREE CAREERS OF 150 AN ARM, --capshape off withholding the shape whole:
//
//                              on (capped shape)      off (control)        mean
//   ended the road            25 / 25 / 23          19 / 19 / 19         24.33 vs 19.00
//   wipes per run           6.47 / 6.21 / 6.25     6.43 / 6.63 / 6.47     6.31 vs 6.51  overlap
//   wipes at tier 10         881 / 830 / 818       854 / 900 / 870        843 vs 875    overlap
//   tier 10 share of wipes  90.7 / 89.2 / 87.2%   88.6 / 90.5 / 89.6%    89.0 vs 89.5% FLAT
//   score, median          27.6k / 27.5k / 29.2k  25.7k / 26.1k / 24.2k   intervals overlap
//   commander fights        1362 / 1318 / 1307    1307 / 1362 / 1303     1329 vs 1324  matched
//   phase opened            55.8 / 56.4 / 51.6%   42.8 / 43.8 / 41.4%    54.6 vs 42.7% SEPARATED
//   phase tail, mean turns  11.2 / 11.3 / 11.4     6.9 / 6.2 / 6.8       11.30 vs 6.63 SEPARATED
//   two turns or fewer         7 / 10 / 12%         16 / 16 / 15%                      SEPARATED
//
// THE CONTENT CLAIM LANDS, AND IT IS THE ONE ROW THAT MATTERS. Commander turns spent inside the
// grudge phase go 3,741 -> 8,197 a career, 2.19x. The phase opens in 54.6% of commander fights
// against 42.7%, and once open it runs 11.3 commander turns against 6.6. Every census row is
// 3/3 in the same direction with no overlap, and unlike a win count these are proportions and
// medians over ~1,300 commander fights a career, which is the sample K11c's lesson says to
// measure a per-fight mechanism on. That is the item delivering exactly what it was for: more of
// the most memorable fight in the game spent against behaviour instead of against a stat line.
//
// AND MOST OF THAT IS ARITHMETIC, NOT DISCOVERY, which is worth saying plainly because a table
// that presented it as a surprise would be flattering itself. The phase covers 45% of the health
// bar instead of 25%, so it should last 45/25 = 1.80x longer; it lasts 1.70x longer. The gap is
// the right sign for the right reason - the commander is swinging without its enrage multiplier,
// so it kills fewer of the squad on the way down and the squad's damage holds up better. A
// threshold moved 20 points of health bar produced the movement a threshold moved 20 points of
// health bar should produce. What is NOT arithmetic is the next paragraph.
//
// THE DIFFICULTY COLUMN IS A NULL AT THIS FILE'S OWN RESOLUTION. Wipes per run overlap (6.31 vs
// 6.51), tier-10 wipes overlap (843 vs 875), and the tier-10 SHARE of wipes is flat at 89.0%
// against 89.5% - so the wall is not only the same height, it is the same shape, which is the
// constraint the build commit set itself and the one that mattered.
//
// THE WIN COLUMN IS WHERE THE DISCIPLINE HAS TO BITE. 24.33 against 19.00 is +5.33, it is 3/3 in
// the same direction, and the ranges do not overlap (23-25 against 19-19). That is D17's
// separation rule passing - AND D17'S RULE WAS FOUND UNSOUND AT THREE CAREERS BY K06, whose
// measured floor says two arms of three only settle a gap wider than about 8-10 wins. 5.33 is
// under the floor. The floor beats the range test whenever they disagree, so THIS IS NOT
// SETTLED, and the three identical 19s in the control are a good reminder of why a tight-looking
// range at n=3 is not evidence of anything. Score says the same: the arms rank on > off in all
// three, and every printed bootstrap interval overlaps.
//
// AND THE +5.33 IS LEFT OPEN RATHER THAN TUNED, which R05 found this record was not actually
// tracking: the scanner keys on phrases, "THIS IS NOT SETTLED" is not one of them, and so the
// one number this entry deliberately declined to resolve was invisible to the instrument built
// to count exactly that. It was represented only second-hand, through R02b's marker naming it.
// Marked at its own site now. The gap in the win column is not measured here and three careers
// an arm cannot measure it.
//   ^^ READ: STILL OPEN. Same shape as R02b's -3.00: a lean under K06's floor, left alone rather
//   than tuned against a number this file cannot resolve. Both want more careers an arm than
//   this project has ever run for one question, and neither justifies that alone.
//
//   (The marker above first read "before R05 ANSWERED it" of LIGHT ORDER, and the scanner took
//   that word as this claim's own verdict - verdictOf tests for it first, and a marker that
//   mentions another item's outcome is indistinguishable from one declaring its own. Reworded.
//   The instrument was right and the prose was wrong, which is the usual direction.)
//
// SO THE PREDICTION WAS HALF RIGHT, AND THE HALF IT GOT WRONG IS THE USEFUL HALF. "The win
// column will be a null" - correct at this file's resolution. "The readable change should be in
// the phase census and in turns per commander fight" - correct, and by a wide margin. But the
// RISK the build commit wrote down was "if commander-fight wipes rise, the price is too small".
// Commander-fight wipes did not rise. Every difficulty row that moved at all moved toward the
// PLAYER. I stated the danger with the sign inverted.
//
// THE MECHANISM FOR THAT IS PLAIN ONCE LOOKED AT, and it says the refund may be the larger half
// of the trade rather than the smaller one. In the control the commander carries its enrage
// damage multiplier from 50% health all the way to 0. Under the shape it carries that multiplier
// from 50% to 45% and then gives it up for the whole remaining 45% of the bar. So the price is
// paid over nearly half the fight, while what it buys is 20 points of health bar moved from
// "enraged" to "enraged and doing the interesting thing". Seen that way a small lean toward the
// player is the expected shape of the trade, not an anomaly.
//
// WHAT IS NOT DONE, stated rather than buried: the +5.33 is unresolved and it is left unresolved
// rather than tuned away, because tuning a dial against a difference this file cannot resolve is
// how a measurement turns into a story. Two honest options if the owner wants it neutral, both
// cheap: refund half the enrage multiplier instead of all of it, or move GRUDGE_CAP.phaseAt from
// 0.45 to about 0.35. Either would need its own paired arm to price, and neither should be done
// on the strength of the table above.
//
// A SEPARATE FINDING THIS PAIR FELL OVER, filed rather than chased because it is not R01's: THE
// WIN RATE IS A LONG WAY UNDER ITS TARGET. The control arm - the shipped game with only this one
// shape withheld - wins 19 of 150 three times, 12.7%, against the 30% target I06 cut the wall to.
// R03's control, measured days ago, reads 20 of 150.
//
// AS FIRST FILED THIS CARRIED A SECOND CLAIM - "and nothing noticed", with "no single item since
// K02 claims a cost anywhere near that size" - AND THAT HALF IS WITHDRAWN. Corrected at the
// marker below rather than deleted, because the mistake is the useful part: I filed a finding
// about this record without reading eleven entries of it.
// ^^ ANSWERED BY #230, AND THE CLAIM ABOVE WAS WRONG WHERE IT MATTERED MOST. "No single item
// since K02 claims a cost anywhere near that size" is false, and so was the headline's "nothing
// noticed". M03 claims exactly that size and states the resulting level in as many words: "In
// the terms I06 tuned to: the win rate goes from about 30% to about 16%." It sits eleven entries
// further down this same file.
//
// WHAT #230 FOUND INSTEAD, which is a different and better finding: the drop is attributed and
// documented. M03 typed bleed as a correctness fix and measured it landing as a one-sided nerf -
// hostiles carry far more armour than operators and mitigate subtracts armour from every tick,
// so the change cut the squad's own bleed output about five times harder than its intake. 44.3
// runs won of 150 before, 24.7 on the bleed term alone. Every item since has then correctly
// DECLINED to compensate, each saying so at its own site: "a compensating buff would be
// re-tuning against a row that did not move."
//
// SO THE LIVE QUESTION WAS NEVER WHERE IT WENT. It is that the wall has sat at roughly half its
// stated target since M03, and the re-cut was never done as its own item because re-tuning is
// correctly refused inside every other item and belongs to none of them. That is an owner
// decision rather than a defect, so #230 puts the dial in front of it instead of turning it:
// SECTOR_HP_SCALE and SECTOR_DMG_SCALE are an arm now (--wallhp / --walldmg), defaulted to the
// shipped values, so the curve is answerable in one run rather than one commit per point.
//
// WHAT THE R-AUDIT FOUND. GRUDGE.cap is 3 on purpose - "a wall you cannot pass is not a nemesis"
// - and LEARNED_AT hands a commander exactly one new move. Measured across a career that means
// 426 of 492 commander fights are against a Thrice-Risen, with the grudge drift reading
// 2.27 / 3.00 / 3.00 across career thirds. From roughly expedition 20 of 150, the opponent the
// game is built around stops changing in any way at all, for the remaining 130.
//
// MEASURED BEFORE ANYTHING WAS BUILT, because the proposed shape is worth nothing if the grudge
// phase is a death rattle: it opens in 45% of commander fights REACHED, runs a median of 6
// commander turns, and only 18% of openings last two turns or fewer. A slice somebody plays.
// That census had to be repaired on its way in - the first cut divided by commanders FELLED and
// printed 116%, because a phase can open in a fight the squad then loses. The row caught its own
// defect by going over a hundred, which is the one thing a share is good for.
//
// THE CONSTRAINT, which is most of the item: tier 10 already takes 89% of every wipe and H13 cut
// that wall to where it is deliberately. A capped commander that simply hit harder would be
// moving the difficulty dial sideways while calling itself content. So at the cap it stops
// GROWING and starts SPENDING - the grudge phase arrives at 45% health instead of 25%, and in
// exchange the commander hands back the damage multiplier its enrage put on the swing.
//
// THE FIRST CUT OF THIS WAS A BUFF WEARING A TRADE'S CLOTHES, and it is worth writing down
// because nothing in the measurement would have caught it cleanly. It opened the phase early and
// withheld `armorBonus`, described in its own comment as "the plate", as though that were
// something every commander carried. It is not: `armorBonus` appears on exactly ONE of the eight
// grudge blocks - the Marshal's, at 14. Seven commanders in eight were being handed a fifth of a
// health bar's worth of extra charging, laying, venting and blood debt for free. Found by
// reading the TABLE rather than the function, before a single career ran on it. The price is now
// the enrage multiplier, which sits on 7 of 8 and is a real one everywhere it appears
// (1.15 to 1.5), and suite 178 pins the shelf itself so the same mistake cannot be made twice.
//
// Smoke at 14 expeditions, both halves firing: 29 capped openings of 45, 780 damage handed back,
// 26.9 a time, and the health it opened at reads "25%: 16, 45%: 29" - booked by the ENGINE and
// read back, per F03, rather than the report keeping its own copy of the threshold.
//
// THE PREDICTION AS IT WAS WRITTEN, kept in its original words because the table above judges
// it and a prediction edited after the fact judges nothing. "The win column will be a null -
// K06's floor says two arms of three careers only settle a gap wider than about 8-10 wins, and
// this is a trade, not a dial. The readable change should be in the phase census (openings up,
// the tail longer) and in turns-per-commander-fight, which is where K11c's lesson says to look."
// Both halves held.
//
// AND THE RISK AS IT WAS WRITTEN, which is the half that did not: "the trade may not be even.
// Opening at 45% buys the commander roughly a fifth of its health bar spent on the more
// dangerous behaviour, and the refund takes back only what phase two added to the swing. If
// commander-fight wipes rise, the price is too small." Commander-fight wipes did not rise - 843
// against 875, overlapping - and every difficulty row that moved at all moved toward the player.
// The danger was real and I wrote it down with the sign inverted. ^^ ANSWERED by the table at
// the head of this entry: null on difficulty, leaning player-side, unresolved at 5.33 wins.
//
// ── R03: A SIDE THAT LOSES HEART - AND IT COSTS BODIES, NOT WINS ──────────────────
// Filed in two commits, the build then this table. The build commit wrote down its own worry:
// "fight payout and XP are both per-NODE rather than per-kill, so a fight that ends early costs
// the player nothing... if the arms separate upward this is a difficulty cut wearing a tactics
// hat". They did not separate upward. They separated somewhere else entirely, and the chain
// that gets there closes on arithmetic.
//
// WHAT THE R-AUDIT FOUND. The squad has four ways out of a fight - withdraw (N07), retreat
// (I01), fall back, extract (A01). The road has none. Every hostile in the game stood to the
// last body whatever its losses, whatever its commander was doing, and whatever it came for.
// "Kill that one and the rest lose heart" is the oldest idea in squad tactics and this combat
// model had never had it.
//
// MEASURED BEFORE A LINE WAS WRITTEN, because M12 and D06 both died on exactly this question:
// would the condition ever fire? A break needs somebody left to break, so everything turns on
// where the side's BIGGEST body falls.
//
//   fights where the anchor fell at all      557
//     and it fell LAST                       121 (22%) - nobody left to break
//     with somebody still up                 436 (78%)
//     of them, a commander fight              30 (5%)
//     bodies still standing when it fell   0: 121  1: 169  2: 181  3: 42  4: 30  5: 14
//
// REACHABLE, AND THE CENSUS CANNOT SAY MORE THAN THAT. Eighty per cent of the firings have one
// or two bodies left, which reads like a thin payoff - and reading it that way would be D05's
// trap in a coat nobody has seen it in yet. That distribution is play under the OLD rule, where
// the anchor dies late because it has the most health to chew through, not because anybody
// chose it. The whole point of a break reward is to move the anchor EARLIER, so the shape this
// is read off is the shape the change exists to shift. It answers "can it fire" and refuses to
// answer "is it worth anything", and the second question needs the arm.
//
// THE RULE, stated once. A side breaks when its biggest body goes down and somebody is still
// standing to see it. Each survivor checks for itself at MORALE.chance, so a break THINS a
// fight rather than ending it, and the ones that hold are the ones worth the next swing.
//
// NOT IN A COMMANDER FIGHT, and that is a rule rather than a tuning choice. Tier 10 takes 89%
// of every wipe and H13 cut the wall to where it is on purpose; a mechanic that eased the one
// node this record calls a gate would be moving that dial sideways while calling itself tactics.
//
// A BROKEN BODY IS NOT A KILLED ONE, and that is where the cost lives. It leaves by dropping to
// zero rather than by being spliced out of activeEntities - nothing in this engine is ever
// removed mid-fight and 148 readers test `hp > 0`, so a body that vanished from the array would
// have to be right in every one of them. `fled` is what keeps it from paying: noteKill is only
// ever called off the damage path, so a body that goes this way gives no kill credit, no
// momentum, no bounty progress and nothing to the bestiary. It spends a turn leaving, and that
// turn is the squad's one chance to take the kill instead. THAT is the decision the item is for.
//
// THE SMOKE, twelve expeditions, which proves it armed and prices nothing:
//
//   sides that lost their nerve   304 of 520 fights it could fire in (58%)
//   bodies that broke             413
//     of those, got away          352 (85%)
//     caught before they went      61 (15%)
//
// AND 15% IS A POLICY FIGURE BEFORE IT IS A GAME FIGURE. This file has no rule about chasing a
// runner - it targets what it always targeted - so the 15% is what happens to fall in the way
// rather than what a player who wanted the kill would take. Named because the row it sits in is
// the one that reads most like a finding, and it is the one least entitled to.
//
// THREE CAREERS OF 150 AN ARM, `--morale off` withholding it whole:
//
//                              on (the break)         off (control)
//   ended the road             19 / 16 / 15          21 / 14 / 25      16.67 -> 20.00
//   actor turns per fight    32.7 / 31.7 / 31.3    33.8 / 34.2 / 33.7   SEPARATED
//   lost for good, per run   4.39 / 4.42 / 4.46    3.55 / 4.04 / 3.85   SEPARATED
//   wipes per run            6.59 / 6.44 / 6.65    6.37 / 6.29 / 6.37   SEPARATED
//   put on the floor, per run 20.9 / 20.4 / 20.1    20.2 / 19.7 / 20.2   flat
//   dragged clear, per run   17.0 / 16.1 / 16.3    16.9 / 16.5 / 17.1   flat
//
// THE WIN COLUMN IS A CLEAN NULL, and this one does not even need the floor argument R04 needed:
// 16.67 against 20.00 is a 3.33 gap whose ranges OVERLAP - 15-19 against 14-25 - and which is
// not even the same direction 3/3. Nothing to argue about.
//
// THE FIGHT IS TWO TURNS SHORTER AND THAT DOES SEPARATE. 31.9 against 33.9, 3/3, no overlap.
// This is the reading K11c's lesson says to take: turns-per-fight is a median over roughly
// 7,500 fights a career, not one number off a heavy tail, so it resolves where a win count
// cannot. The mechanism is real and it is 6% of a fight.
//
// AND THE SQUAD LOSES MORE PEOPLE. 4.42 a run against 3.81, 3/3, no overlap - while the number
// PUT ON THE FLOOR is flat and the number DRAGGED CLEAR is flat. So the same bodies go down and
// fewer of them come back: recovery runs 80% against 84%.
//
// THE CHAIN, AND IT CLOSES ON ARITHMETIC RATHER THAN ON A STORY.
//
//   a fled body pays no momentum       4,254 of them a career x 15 = ~63,800 forgone
//   which is STIMs not bought          ~2,127 at 30 each
//   and the fight is 7% shorter        ~10,000 fewer turns x the 22% that are STIM = ~2,200
//   so STIMs should fall by            ~4,327
//   observed                            3,709 / 5,022 / 4,543, mean 4,425
//
// Within 2% of the sum. And STIM is 88% of every rescue in the game, so fewer STIMs is fewer
// bodies picked up, which is the 84% -> 80% and the extra half-operator a run. The cost the
// build commit hoped for is real, it is paid in people, and it is paid through momentum - a
// channel nothing in the feature touches directly.
//
// SO THE WORRY IS REFUTED RATHER THAN CONFIRMED. This is not a difficulty cut wearing a tactics
// hat: fights get shorter AND the squad gets thinner, and the win column absorbs both without
// moving. What the item bought is a trade, which is what it was for.
//
// WHAT IS NOT SETTLED, said plainly: the chain above is arithmetic plus three careers an arm.
// The sum landing within 2% is strong for a mechanism and is not a controlled measurement of
// one: nothing here withheld the momentum term on its own, so the momentum half is not measured.
// That arm exists if somebody wants it - pay a fled body its 15 and re-run - and it is the
// honest way to close this rather than a second pass at the same six careers.
//   ^^ ANSWERED by T05, and answered NO. The arm was built and run - three careers a side, same
//   commit, `--morale pay` handing a fled body exactly the 15 a kill pays and nothing else. The
//   momentum term on its own buys no STIMs: rescues by STIM read 3777 against 3738, a null
//   against the +2,100 the chain predicts, and the turns STIM was AFFORDABLE on went 73% to 72%
//   rather than up. The 2% agreement above is a coincidence of scale. Momentum is capped at 100
//   and bankNode zeroes it at the end of every node, so 4,254 x 15 was never a career purse - it
//   is 15 points into a wallet that holds 100 and is emptied after every fight. The COST this
//   entry measured is real; the CHANNEL named for it is not.
//
// AND THE 15% CAUGHT IS STILL A POLICY FIGURE. 4,313 of 5,104 broken bodies got away in the
// first career and the ratio held at 85% in all three, because this file has no rule about
// chasing a runner. A player who wanted the kill credit - and the momentum, which the chain
// above makes worth wanting - would catch more, and every number in this entry would move.

// ── R04: A RECRUIT WHO WANTS A RANK - AND MY PREDICTION WAS WRONG ─────────────────
// Filed in two commits: the build, then this table. The prediction written into the first one
// said "the win column is expected to be a null - it has been for O05b, F10b and M10". It is
// not a null. It is not a finding either, and the gap between those two things is most of what
// this entry is about.
//
// WHAT THE R-AUDIT FOUND. Every recruit node in the game offered a card and a price, and 166 of
// 187 offers went to a line that was ALREADY FULL. Nine times in ten "can you afford this" was
// really "will you replace somebody", asked in the wrong currency. I03 and I05 measured that
// decision carefully; neither could change that the node only knows one way to ask.
//
// A TERM IS WHAT THE BODY WANTS INSTEAD. PRICE is the offer that has always been here and
// nothing about it moves - the scrap, the bench, the player's choice of where to stand them.
// LINE wants a rank: no scrap at all, straight into the deployed line over the weakest hand
// standing in it, and no bench afterwards - put them there and they are gone for the run.
// RECRUIT_LINE_SHARE is 50, so half the nodes ask it.
//
// THE TERM BELONGS TO THE NODE, not to the visit. Same construction as the cache's lock and for
// the same reason: seeded off the node id and the sector, so walking away and coming back asks
// the same thing, reload included. A per-visit roll would let a player shop for the term they
// wanted, which is not a decision.
//
// THREE THINGS NEEDED CARE AND SUITE 176 HOLDS ALL THREE.
//
//   the card NAMES the body that steps down, and the body it names is the body that moves.
//     Both read handRate, one function, because a card that promised one thing and moved
//     another is F03's defect wearing a recruit's coat.
//   the bench rule is enforced AFTER the assignment. assignSlot SWAPS: putting somebody else
//     into a rank-holder's slot hands the rank-holder the OTHER body's old slot, which can be
//     the bench. A check on the requested move walks straight past every one of those, and it
//     is the case a suite would not think to write.
//   a LINE offer is not an affordability question. The rank IS the price, so the harness's purse
//     gate cannot decide it - a policy that only read the purse would take every free body and
//     report that free bodies are popular. That is D05's trap for the third time this session,
//     and it was caught in the writing rather than in the reading. Both policies ask the merit
//     question the card asks, compared on the ARRIVAL rather than the template and therefore on
//     a different basis from the `value` policy twenty lines down, which compares a raw template
//     against an upgraded incumbent and says in its own comment that this understates the
//     recruit. Here that understatement would be a thumb on the scale for the arm being
//     measured. The two bases differ on purpose and the difference is named at both sites.
//
// THREE CAREERS OF 150 AN ARM. `--recruitterm off` withholds the whole thing, which is the O11
// shape: one build, one difference, nothing else moved.
//
//                              on (the term)          off (control)
//   ended the road             15 / 16 / 13          18 / 18 / 21       14.67 -> 19.00
//   score, median           24.6/25.2/25.1k       24.6/25.3/23.8k
//   nodes cleared, median      76 / 76 / 80          77 / 73 / 74
//   deepest sector, median      3 / 3 / 3             3 / 3 / 3
//   commander fell-rate       37% / 37% / 36%       36% / 37% / 34%
//   bosses felled, mean      2.83 / 2.91 / 2.96    3.02 / 2.81 / 2.75
//
// THE WIN COLUMN LEANS DOWN 3/3 AND THE RANGES DO NOT OVERLAP - 13-16 against 18-21 - AND THAT
// IS STILL NOT A FINDING. The gap is 4.33 wins. Each of these six reports prints its own
// resolution and every one of them says the same thing: "two arms of three only settle a gap
// wider than about 8-10 wins". 4.33 is inside that floor, comfortably.
//
// The non-overlapping ranges are exactly the trap. D17's separation rule - same direction 3/3
// AND non-overlapping ranges - is the rule K06 found UNSOUND at three careers, and the printed
// floor is the authority over the range test every time the two disagree. Writing this up as
// "the term costs 4.3 wins" would be the fourth time in this record that a median was believed
// past what its interval could carry, and the first three are all marked WITHDRAWN.
//
// SO THE HONEST VERDICT IS: NOT SETTLED, AND LEANING. Settling a 4.33 gap against a floor of 9
// needs about (9/4.33)^2 x 3 = 13 careers an arm - 26 careers of 150, roughly four times what
// this item has already spent. Not bought, and named so the next person does not re-derive it.
//
// AND THE OBVIOUS MECHANISM FOR A WIN COST IS REFUTED. A LINE recruit arrives at 60% of their
// bar, and H04 established that arrival health is what decides a commander fight - so "the term
// puts hurt bodies on the line at tier ten" is the story this table invites. The table refuses
// it: commander fell-rate reads 37/37/36 against 36/37/34 and bosses felled 2.83-2.96 against
// 2.75-3.02. Both flat. Whatever the lean is, it is not that, and the check cost one grep.
//
// WHAT DID SEPARATE, and it is a census over hundreds of signings rather than a career mean:
//
//   offers asking for a rank     259/521  321/539  286/516   (50%, 60%, 55%)
//   signed for a rank            109/259  161/321  143/286   (42%, 50%, 50%)
//   signed for scrap             143/262  136/218  129/230   (55%, 62%, 56%)
//   rank-holders benched, who left  10       12       12     across 150 runs each
//   median purse at an offer       312      312      295     against 286 / 232 / 235
//
// A RANK IS REFUSED MORE OFTEN THAN A PRICE, 42-50% against 55-62% taken. The question is
// harder, which is the whole of what the item set out to do.
//
// AND THE FIRST VERSION OF THIS PARAGRAPH WAS A TAUTOLOGY. The headline row read "signed
// recruits fielded 72-75% against 52-56%" and I nearly published it. A LINE recruit is fielded
// BY DEFINITION - the rank is the term - so that lift is the feature restating itself, not a
// measurement of it. Decomposed instead, which is the row worth having:
//
//   the PRICE half of the on arm, fielded   50% / 46% / 47%
//   the off arm, fielded                    52% / 53% / 56%
//
// So the old half did not move, which is what "no dial moves on PRICE" has to mean - and if
// anything it moved DOWN, because a rank already held by somebody who out-rated the incumbent
// raises the bar for every signing after it. That is an interaction nobody designed and it is
// the most interesting thing in the table.
//
// ONE CONSEQUENCE NOBODY ASKED FOR AND IT IS COHERENT: a walked-off recruit leaves playerRoster,
// and recruitables() is "the pool minus who you already have" - so they can be met and signed
// again further down the road. They did leave; they are out there. Named because it was found by
// reading the offer counts (521/539/516 on against 437/471/495 off) and wondering why the arm
// that signs MORE bodies sees MORE cards rather than fewer.
//
// NO DIAL MOVES on the old half: a PRICE offer charges what it charged, arrives where it
// arrived, and holds nothing. Suite 176 pins that as carefully as it pins the new term.
//
// AND IT SHIPS ON, WITH THE LEAN ON THE RECORD RATHER THAN BURIED. Defaulting it off would be
// treating an unsettled lean as a finding, which is the same error as publishing it - pointed
// the other way. The mechanical case stands on censuses; the win reading does not stand at all.
// If the owner would rather withhold it pending a settlement nobody has bought, it is one
// number: RECRUIT_LINE_SHARE = 0 turns every node back into a card and a price, and
// `--recruitterm off` is the same thing for the harness.

// ── R-AUDIT: A BRAINSTORM RUN THE WAY THIS FILE RUNS AUDITS ───────────────────────
// Asked for by the owner: find NEW FEATURES. Every audit before this one hunted defects, so the
// method changed and the discipline did not - read the record first, measure before pitching,
// and report what the record refuted as carefully as what it did not. Five candidates went in
// and five came out refuted before a line was written. That is the headline: this record is now
// dense enough that most feature ideas are already answered in it, and the value of an audit is
// increasingly in the ideas it KILLS.
//
// THE MEASUREMENT: one 60-expedition career at default policy, tree at 79ef401. Every figure
// below is read off that report unless it names a source.
//
// ── WHAT THE RECORD KILLED, AND WHY EACH LOOKED GOOD ──────────────────────────────
//
//   "the forecast you cannot act on"   The map promises the next node's ground, sky and shape,
//     and the squad looked frozen from the muster. It is not: the OUTPOST COMMAND button lives
//     on the map screen, and assignSlot, the gear slots and the medbay are all live between
//     nodes. checkDoctrine runs on the reassignment. The lever already exists.
//
//   "put jeopardy in the nine tiers"   Tier 10 takes 339 of 383 wipes (89%) and the nine tiers
//     below it take 44. H04 already measured exactly this and INVERTED it: the walk decides the
//     fight, through arrival health - 0% felled arriving under 80%, 33% felled arriving over it,
//     and the gap holds inside every sector separately. Danger in the nine tiers is not missing
//     content; it is the mechanism H04 found already working.
//
//   "extraction is dead content"   `walked out 0 of 60`. It is `--extract off`, this file's own
//     default. D05's trap, and this is the third audit to catch it.
//
//   "the order only ever gets downgraded"   Re-signed 45 of 60 (75%), cut to SORTIE 34 and
//     PATROL 11, never extended. resignOrder extends as readily as it cuts - the harness only
//     reaches for it when `worn`. D05's trap twice in one audit, which is the rate at which it
//     should be expected rather than a surprise.
//
//   "skulls pile up once the Citadel caps"   Citadel at the end of the sample: every spot at
//     cap. But H03 measured this, derived the ledger properly (earned = rise + spent), found
//     the requisition shelf takes 89% of income, and shipped a capability item onto it. The
//     surplus does not exist and the sink is not underused - H03's own words are that it is
//     selling the wrong thing, which is a different item and already filed.
//
// ── R01: THE COMMANDER LADDER IS EXHAUSTED IN THE FIRST THIRD OF A CAREER ─────────
// The marquee opponent stops changing early and then does not change again.
//
//   commander fights reached      492
//   met for the first time         12 fought, 67% won
//   met again, carrying a grudge  480 fought, 30% won
//     risen x1                     25       risen x2  29       risen x3  426  (87%)
//   grudge on commanders met, by career third   2.27 / 3.00 / 3.00
//
// GRUDGE.cap is 3 and the comment on it is right - "a wall you cannot pass is not a nemesis".
// LEARNED_AT is 2, so a commander brings exactly one new move and then nothing further. A04,
// C09 and B02 built the arc; what nobody measured is that it COMPLETES by roughly expedition 20
// of a 150-expedition career, and the remaining ~130 meet a capped opponent whose numbers and
// deck are both finished.
//
// THE PITCH IS QUALITATIVE, NOT NUMERIC, because the numeric ladder is deliberately capped and
// tier 10 already takes 89% of every wipe. At the cap a commander stops SCALING and starts being
// DIFFERENT: arriving with a retinue drawn from a faction that is not its own, or already
// knowing the doctrine the muster took, or trading its grudge phase for a different phase rather
// than a bigger one. Every mechanism that needs exists - BOSS_PASSIVES, learnedMove,
// tradeIntents, FORMATIONS, FACTION_ALLIES.
// SIZE: medium, and it must be priced against the wall before it ships.
//
// ── R02: EVERY FIGHT IN THE GAME HAS ONE WIN CONDITION ────────────────────────────
// checkWinState ends a fight on `!pA` or `!eA` and on nothing else. There is no reinforcement
// path, no rout, and no code anywhere that takes a body off activeEntities without killing it.
// The eight intents are ATTACK, AOE, HEAVY, STATUS, DEFEND, FLANK, CHARGE, SALVO - all of them
// verbs for fighting, none for leaving, calling, or guarding a thing.
//   ^^ CORRECTED by R02's own suite, one item after this was written. There are NINE now and the
//   ninth is BREAK, which R03 added: a hostile pulling out, which is exactly a verb for leaving.
//   The sentence was true the day it was typed and stopped being true three commits later.
//   THE CORRECTION STRENGTHENS THE FINDING RATHER THAN DENTING IT. R03 shipped a way for a BODY
//   to leave a fight - built it, measured it, priced it - and the terminal condition still did
//   not move a line. What was missing here was never an exit for a hostile. It is that a fight
//   cannot END on anything except one side's last body going down.
//
// Set against what the composition layer does: 22 formations (none unmet, KILL_BOX 199 down to
// CONVOY 16), 6 grounds, 9 skies, 5 factions, 19 commanders, affixes on 70% of elite hostiles.
// The game has enormous variety in what a fight IS and none at all in what a fight is FOR.
//
// AND THE VOCABULARY IS ALREADY BUILT. The bounty pool counts sixteen different things that
// happen inside a fight - BLITZ turns, OVERKILL, FLAWLESS, EXECUTE, REACH, GROUND, COMBO, SIG,
// HEAVY, CHASED. Those are win conditions wearing a reward's clothes: the engine can already
// tell that a fight was won in four turns, or without a body going down, or by killing the
// marked one. What it cannot do is END on one.
// SIZE: large, and it deserves its own phase. Combat is the most-measured system in this
// project and every figure above the line would need re-reading if the terminal condition moved.
//   The terminal condition was NOT BUILT by R02's census commit, which shipped the feasibility
//   measurement and nothing that changes how a fight ends.
//   ^^ ANSWERED by R02's build and R02b's re-tune. A fight can be failed while standing now: a
//   clock on 20% of road fights, never a commander, ending through withdraw's own exit so the
//   squad walks away whole and paid nothing. Priced at 0.41 operators kept a run against a win
//   column this file cannot resolve.
//   ^^ READ: STILL OPEN, and narrowed by measurement rather than by argument. The census - the
//   R02 table at the head of this file - rules out the cheap version: damage is linear in turns,
//   so any objective that ends a fight early hands the player back damage in proportion and is a
//   difficulty cut rather than content. What it points at instead is a fight the squad can FAIL
//   WHILE STANDING, since `!pA` is the only loss condition the game has, and losing fights run a
//   median of 19 squad turns against 9 for a win. A direction the census supports, not a result
//   it establishes, and it gets its own build and its own arm.
//
// ── R03: NOTHING EVER RETREATS BUT YOU ────────────────────────────────────────────
// The squad has four ways out of a fight - withdraw (N07), retreat (I01), fall back, extract
// (A01). The road has none. Every hostile fights to the last body whatever its losses, whatever
// its commander is doing, and whatever it came for. A faction that broke when its champion fell
// would make the champion worth targeting, and the game currently has no way to express "kill
// that one and the rest lose heart" - which is the oldest idea in squad tactics and the one
// mechanic this combat model has never had.
//   ^^ ANSWERED by R03, which is the item this claim IS - and it went stale the moment that
//   item shipped, three commits after this paragraph was written. The oldest failure mode in
//   this record, caught by the instrument built for it, in the one entry whose whole subject is
//   that failure mode. A side breaks now when its biggest body falls; the mechanic exists, it
//   fires in 52-55% of the fights it can fire in, and it costs half an operator a run.
//
//   THE SIZING WAS RIGHT AND THE JUSTIFICATION WAS WRONG. "Small-medium: a morale check and an
//   exit" held - the exit was six lines, because nothing in this engine is ever removed from
//   activeEntities and dropping to zero with a `fled` flag does the whole job. What did NOT
//   hold is "would make the champion worth targeting": the census found the anchor already
//   dies late for mechanical reasons, and whether a break reward moves it earlier is a
//   question three careers of a fixed policy cannot answer.
// Filed separately from R02 because it is much smaller: it needs a morale check and an exit, not
// a new terminal condition. SIZE: small-medium.
//
// ── R04: THE RECRUIT NODE ASKS ONE QUESTION ───────────────────────────────────────
//   offers seen                                     187
//     offered while the squad had a hole to fill     21 (11%)
//     offered to a line that was already full       166 (89%)
//     signed on the spot 87, walked past 100
//     of those signed, put on the line 51, benched   36
//
// So nine times in ten the node is asking "replace somebody", and I03/I05 already measured that
// decision carefully (declining beats signing; the body is the drag, not the price). What has
// never varied is the SHAPE of the offer: a card and a price, every time. A recruit who comes
// with a condition instead of a price - joins only if you take their fight, will not stand
// beside a class they have history with, leaves after three fights - asks a different question
// with the same screen. SIZE: small-medium, and it is the cheapest item in this audit.
//
// ── R05: TWO DOCTRINES ARE NEVER LIVE, AND ONE OF THEM HAS NEVER BEEN WALKED ──────
//   NO_HANDS      offered 27, live 0        LIGHT_ORDER   offered 34, live 0
// NO_HANDS was walked properly by O22/O23 and priced at 4.34 wins for the card on top of 7.33
// for the line. LIGHT_ORDER has never had the same treatment, and 0 of 34 under `--draft line`
// is a policy figure before it is a game figure - which is D05's trap, and the reason this is
// filed as a MEASUREMENT to take rather than a feature to build.
//   ^^ ANSWERED by R05, which took the reading in O22's exact shape - three arms, three careers
//   each, `--arrange front`, `--doctrine off` splitting the line from the card. The answer is
//   that THIS INSTRUMENT CANNOT PRICE IT: every pairwise gap on the win column overlaps and sits
//   under K06's floor, where NO_HANDS separated on every column. That is not a failed
//   measurement, it is the measurement - NO_HANDS was priceable because it was enormous
//   (-11.67 end to end) and LIGHT_ORDER is -1.67. See the R05 table at the head of this file.
//
// ── AND ONE THING THAT IS A DESIGN STANCE RATHER THAN A GAP ───────────────────────
// NOTHING ABOUT AN OPERATOR SURVIVES AN EXPEDITION. buildNewRun rebuilds playerRoster from
// ROSTER_TEMPLATE and clears bonds, cast standing, the gear stash and the purse; its own
// comments say so on purpose ("Nobody carries over. Every expedition starts with the seven and
// finds the rest again."). Everything that persists is class-level (mastery), building-level
// (the Citadel), or commander-level (grudges). Levels, perks, scars, quirks and bonds are all
// built and thrown away every run.
//
// That is the single largest lever on how a 150-expedition career feels, and it is a decision
// rather than a defect - so it goes to the owner with the rest rather than becoming an item.
// Naming it because an audit that lists five features and does not mention the biggest structural
// choice in the game would be describing the furniture.
//
// NO DIAL MOVES AND NOTHING SHIPS. This entry is the deliverable.

// ── Q02: THE BAG THAT SAT AT THE BOTTOM OF EVERY SCREEN ───────────────────────────
// Asked for by the owner, and the same complaint as Q01 one row further down: TACTICAL INVENTORY
// was a bordered panel pinned below the tab views - a title row and two rows of slot buttons -
// up on the roster tab, the workbench and the cybernetics bench alike, whether or not anybody
// wanted to look in it. On a phone that is a fifth of the screen spent on four boxes that
// usually say EMPTY SLOT.
//
// IT IS A DRAWER NOW, shut by default. Measured on the same screen at 430 wide: 44px shut
// against 167px open, so the four slots cost what they are worth exactly when somebody wants
// them. Suite 175 reads both heights rather than trusting the description.
//
// THE 44 IS A FLOOR AND NOT A CHOICE, and the first cut did not have it. The handle was a 15px
// text row - it met every goal in this entry, read correctly, and could not be hit with a thumb.
// Suite 46 has had a 44px floor under everything pressable on this screen since G08 and it went
// red on the first full battery, which is the ratchet doing exactly its job on a change that
// looked finished. Three times as tall as I first drew it and still a third of the panel.
//
// THE HANDLE KEEPS THE COUNT, and that is not decoration. craftItem refuses on a full bag, so
// the count is what answers "why is every schematic greyed out"; hiding it along with the slots
// would have traded one confusion for a worse one. Full turns the handle orange and prints FULL
// on it, which is the one state where a hidden bag could otherwise cost the player the reason.
//
// THE SLOTS ARE BUILT EITHER WAY and only their container is hidden. The cheaper build renders
// the cells only while the drawer is open, passes every row that opens it first, and silently
// empties the bag for every reader that does not - including one suite in this tree that reads
// the cells without touching the handle. Pinned at four of four while hidden.
//
// ONE SUITE DID HAVE TO MOVE, and it is the right kind of move. The delegated-controls walk
// clicked [data-action="sell-item"] straight off the Outpost; a hidden control is not clickable,
// so it now presses the handle first - which is what a player does, and adds a row for the new
// control while it is there. A test that changes because the interaction changed is not the same
// thing as a test bent to fit.
//
// AND THE STATE IS THE SCREEN'S, NOT THE SAVE'S. renderOutpost runs after every sell, so a
// drawer that reset on each render would be worse than no drawer - but a field in the save is a
// field every reload has to migrate (E10), for a preference with no bearing on the run. A module
// variable defaulting shut is the whole of it, and the row that matters is that selling an item
// leaves the drawer open.
//
// NO SIMULATION, NO DIAL. Same as Q01: this is a screen, the harness drives the model rather
// than the Outpost, and suite 175 is the whole of the evidence.

// ── Q01: THE MEDBAY YOU HAD TO SCROLL TO, AND THE LINE BURIED IN THE LIST ─────────
// Asked for by the owner, and both halves are the same complaint: the Outpost's roster is seven
// tall cards, the four bodies actually going out are scattered through it in roster order, and
// healing the squad after a bad expedition meant finding each one and pressing TRIAGE six times
// apiece. F10 already cut that to one press PER BODY - PATCH UP, billed at exactly what the
// presses would have cost. What it did not cut was the FINDING.
//
// TWO CHANGES, NEITHER OF THEM A DIAL. Every number this file measures is untouched: same
// MEDBAY_STEP, same MEDBAY_SHARE, same price per click, same treatment. What moved is where the
// buttons are and what order the cards come in.
//
//   the line first     rosterOrder() puts gridPos 1, 2, 3 at the top and the bench below,
//                      on the roster tab and the cybernetics tab alike.
//   one press          a bar above the list: TRIAGE ALL, and PATCH UP ALL when the two would
//                      not quote the same price. Both bill the sum of the single buttons.
//
// THE ORDER IS A RENDER ORDER AND NOTHING ELSE, which is the part that needed care rather than
// typing. rosterOrder() returns a NEW array. Sorting playerRoster in place is one character
// shorter and would have moved the save, the muster, the draft and every gridPos-swapping call
// site with it - assignSlot swaps two bodies' positions by reaching for whoever holds a slot,
// and a roster that reorders under it is a different function. Suite 174 pins the copy by
// checking the id order before and after a render, which is the only way to see it: a sort in
// place passes every row that looks at the screen.
//
// AND THE ALL BUTTON QUOTES OR REFUSES. The obvious build loops the roster calling medBay()
// until the scrap runs out, which leaves three healed, four not, and a price that was never on
// the button. The bill is totalled first and the button is dead below it - the same rule the
// single PATCH UP has followed since F10. Held at the boundary in both directions: one scrap
// short buys nothing and heals nobody even when the function is called past the disabled
// button; at the exact quoted price the whole roster comes up full and the scrap reads zero.
//
// WHAT THE BAR SAYS WHEN THERE IS NOTHING TO DO is as much of the point as the buttons. A row
// that only appears when somebody is hurt makes you scroll the list to find out that nobody is,
// which is the thing being fixed. It says the roster is at full health and offers nothing.
//
// THE DEAD ARE NOT ON THE BILL. Nothing at the Outpost brings anybody back - that door was shut
// deliberately, and it is what makes a death a loss rather than an invoice - so a body at zero
// is not counted, not charged for and not raised. Pinned, because a squad-wide function that
// quietly resurrected on a rounding error would be the one bug here that changes the game.
//
// NO SIMULATION. This is a screen, and the harness drives the model rather than the Outpost;
// nothing in this file reads differently and no arm was run. Suite 174 is the whole of the
// evidence and it is the right kind for what changed.

// ── O05b / F10b: THE LAST TWO OPEN CLAIMS, BOTH WALKED AND BOTH NULL ──────────────
// Two claims had sat open since their own items. Both asked for a door to be built before the
// question could be asked at all, and both are built now.
//
// O05b: THE ELITE OFFER, PLUMBED. O05 built the offer, watched every card fall on the floor and
// reverted, leaving "re-doing it needs the offer plumbed through a path the harness actually
// walks". Two fixes get there. The harness's offer RESOLVER lived inside `if (node.type ===
// 'BOSS')`, so a commander's cards were picked up and anything else's could not be, whoever
// staged them - lifted to the node, which is the whole of the plumbing. And the elite drop
// itself is now a lever in game.js, ELITE_OFFER_CARDS, defaulted to 0 so nothing about the
// shipped game moves. Proven armed rather than assumed: the `staged by an elite` row reads 0
// with it off and 5.00 / 5.69 / 5.11 a run with it on.
//
// THAT THE LIFT IS A NO-OP AT THE DEFAULT IS STRUCTURAL, NOT MEASURED, and the difference
// matters because I first wrote it the other way round. Nothing but the commander branch stages
// an offer while the lever is off - which is what the 0 above says across 450 runs - so where
// the resolver sits cannot change which offers get resolved. The paired 60-run arms I reached
// for instead read 172 offers against 150, a 13% spread that is noise at that size and carries
// no claim in either direction; the figures I published off them, "175 vs 177", were the RECRUIT
// offer row four lines further down the report. That is the second time in this item that two
// rows named `offers` got crossed - the first read as a dead lever for about a minute while I
// was checking whether the arm was armed at all - and the report prints both under a heading
// containing the word `offers`, which is how a grep finds the wrong one twice in a day.
//
//                       grant (0)            two cards (2)
//   ended the road      16 / 17 / 22          21 / 20 / 18     18.33 -> 19.67
//   score, median    21.1/25.6/24.6k       24.0/25.2/23.3k
//   nodes, median       70 / 76 / 73          70 / 77 / 72
//   relics held, mean  9.1/10.7/10.8       10.3/11.1/10.3     10.20 -> 10.57
//
// NOTHING SEPARATES, and the row that matters is the last one. O05's fear was that touching this
// channel would cut it - it priced the elite relic at 5.8 a run and a large share of the wins -
// and the count is intact, marginally up and well inside noise. So the asking is FREE: the
// player gets a decision where they had a die roll, and pays nothing measurable for it at three
// careers an arm. That is a decision-ready result rather than a recommendation; the lever stays
// at 0 and moving it is the owner's call, like every other card in this file.
//
// F10b: BANKING A CAPSTONE, AND YOU CANNOT. F10's other half said no policy banks a capstone to
// take later. The door is real - BANK THE POINT (spend it at the Outpost), on the promotion
// screen - and `--perks bank` now walks it: refuse anything that is not a capstone, and let the
// Outpost's spend path buy one when it opens.
//
//                                take (default)              bank
//   ended the road              12 / 14 / 18            14 /  9 / 23        14.67 -> 15.33
//   promotions a run         18.3 / 20.4 / 20.5      19.9 / 18.4 / 23.2
//     of them a signature    10.8 / 11.1 / 11.2        0.0 / 0.0 / 0.0
//   capstones, promotion screen 2.35 / 2.82 / 2.87    2.32 / 1.90 / 2.92
//   capstones, Outpost shelf    0.00 / 0.00 / 0.00    0.18 / 0.14 / 0.22
//   points at the Outpost, stat  89% / 89% / 90%       75% / 74% / 76%
//     on a signature             11% / 11% / 10%       24% / 26% / 24%
//     on a capstone               0% / 0% / 0%          0% / 0% / 0%
//
// All three careers per cell, because the first draft of this table printed career 1 alone in
// every row but the wins and read as though it were the arm. Nothing in the conclusion changes
// - the shelf column is 0.00 three times and the signature column is 0.0 three times, which is
// the whole finding - but a table that shows one career while the row above it shows three is
// how a spread gets lost, and losing spreads is what this file corrects itself for most.
//
// The `points banked instead` row was added after these careers ran and is not in the table,
// because putting a number there that this measurement did not produce is how a figure gets
// believed past what it measured. What it shows is structural and holds at any sample size: in
// the bank arm every promotion is either a capstone taken or a point banked, and the two add up
// to the promotion count.
//
// THE PREMISE IS REFUTED MECHANICALLY, WHICH IS BETTER THAN A NULL. Capstones arrive through the
// promotion screen at 1.9-2.9 a run in BOTH arms, and the Outpost shelf sells 0.14-0.22 a run
// and only to the arm that banks. Banking skips the one door capstones come through in order to
// queue at the one that barely stocks them. What the point actually becomes is a stat card: the
// bank arm throws away 11 signatures a run to buy a fifth of a capstone and a pile of +5 DMG.
// The win column does not separate (+0.67, ranges 12-18 against 9-23) because stat cards partly
// pay for what the signatures did, which is the least interesting thing in the table.
//
// SO THE CLAIM IS ANSWERED AND THE ANSWER IS "THE PLAY DOES NOT EXIST". Nobody banked for a
// capstone because banking cannot buy one. Whether it SHOULD - whether the Outpost shelf ought
// to stock capstones so the BANK button means what its own label implies - is a design question
// and goes to the owner with the rest.
//
// NO DIAL MOVES. Two levers, both defaulted off, and the shipped game is byte-identical in
// behaviour at those defaults.
//
// ── K11c: THE MECHANISM IS REAL, IT IS HUGE, AND IT CANCELS - K11b CORRECTED ──────
// K11b closed by filing its own follow-up: win counts are the wrong instrument, and the question
// belongs on something that moves per FIGHT. It also wrote that K05's compounding argument was
// "unsupported". THE SECOND HALF WAS WRONG, and the first half is why. The same twenty-four
// careers already carried the answer; no new run was needed, only the right column.
//
//                             IRON_KNUCKLES (+3 DMG)   RIOT_SHIELD (+6 phys)   gap
//   actor turns per fight            34.08                   37.31           -3.23   6.9 sd
//   blows taken, a career          146,821                 162,451         -15,630   6.5 sd
//   points per blow                 14.272                  12.945          +1.327   8.9 sd
//   POINTS TAKEN, A CAREER       2,094,142               2,101,863          -7,721   0.27 sd
//
// OUTPUT TAKES 9.6% FEWER BLOWS BECAUSE ITS FIGHTS ARE 8.7% SHORTER. ARMOUR TAKES 9.3% LESS PER
// BLOW. THE TOTALS DIFFER BY 0.4%. Two mechanisms, each measured at better than six sd, whose
// product is a null at a quarter of one. K05 was right: output compounds, a shorter fight cuts
// incoming damage on every later turn, and the effect is enormous. What is not true is that it
// makes output BETTER - the game prices +3 DMG and +6 phys to the same survival by opposite
// routes, and that is why every career-level arm since K05 has come back flat.
//
// SO K11b's "UNSUPPORTED" IS WITHDRAWN and marked at its own site. The null it measured is real
// and its arithmetic stands; the inference from it was wrong. A null at the top of a causal chain
// does not license "no mechanism" when nothing measured the middle - and K11b had the middle on
// disk while it was writing that sentence.
//
// WHY WIN COUNTS COULD NEVER HAVE SEEN THIS, stated because it is the reusable part. A career is
// one number off a heavy tail; turns-per-fight is a median over roughly 7,500 fights. K11b
// costed 134 careers an arm to resolve a one-win gap. The same twelve careers resolve the
// mechanism at 6-9 sd, because the question was never about careers. When an argument is about a
// per-fight mechanism, measure the fight.
//
// AND THE REPORT SAYS IT NOW. Every row in WHAT REACHES THE SQUAD was a SHARE, and a share cannot
// tell the two apart: fewer blows and less per blow shrink the same total. One line prints blows,
// points a blow, and the product - which is the whole of this item in the place someone reading
// the output would look.
//
// WHAT THIS DOES NOT SAY. These are two specific trinkets sized to be comparable, not "output"
// and "mitigation" in general; +3 DMG against +6 phys is one point on a curve. And the careers
// are not exposure-matched - the armour arm cleared 77.3 nodes against 75.8 - so the TOTAL row
// carries about 2% more exposure on the armour side, which flatters it slightly and does not
// come close to mattering at 0.27 sd.
//
// NO DIAL MOVES. One report line, and a withdrawal.
//
// ── K11b: TWELVE CAREERS AN ARM, AND OUTPUT STILL DOES NOT BEAT ARMOUR ────────────
// K11 left one debt and named its own price: "+3 DMG reads ten wins and +6 phys reads six, and
// head to head every row overlaps - the widest is 1.1 sd on the win count. An arm cannot say. It
// would take about twelve." Paid. Twelve 150-expedition careers an arm, interleaved, 3,600
// expeditions:
//   ^^ READ: this line QUOTES K11's claim rather than making one; the claim is marked ANSWERED at
//   its own site below. Third time a record has tripped its own scanner by quoting the thing it
//   answers, which is the cost of the scanner matching on phrasing - and the right cost, because
//   the alternative is a scanner that misses a claim made in the same words.
//
//                    IRON_KNUCKLES (+3 DMG)          RIOT_SHIELD (+6 phys)
//   wins            32 30 28 24 15 16 28 27 23 24 17 21   22 19 24 23 21 28 25 18 17 25 24 26
//   mean                 23.75   sd 5.36                      22.67   sd 3.22
//   reached sector 7     34.17                               34.25
//   nodes, median mean   75.83                               77.33
//   score, median mean  25,950                              27,710
//   wipes per run         6.26                                6.23
//
// IT DOES NOT SEPARATE, AND THE FAILURE IS NOT THE INTERESTING KIND. +1.08 wins at 0.60 sd would
// be "too small to see at this sample". What is actually there is worse for the hypothesis: the
// COLUMNS DISAGREE ON A SIGN. Wins lean output by a win; score leans armour by 1,760 and nodes
// by 1.5; sector-7 reach is level to within a tenth of a career. Four rows, no agreed direction.
// A real effect hiding under noise moves every row the same way and loses on significance. This
// loses on direction.
//
// SO K05's COMPOUNDING ARGUMENT IS UNSUPPORTED, and that is the finding.
//   ^^ WITHDRAWN by K11c, from these same twenty-four careers. The mechanism is real and large:
//   the output arm clears fights 3.23 turns sooner (6.9 sd) and takes 15,630 fewer blows a career
//   (6.5 sd), exactly as K05 described. It cancels because armour takes 9.3% less per blow, and
//   the totals land 0.4% apart. The null below is sound; this inference from it was not. Nothing
//   here measured the middle of the chain, and the middle was already in these files. K05 reasoned that
// output compounds where mitigation cannot, because a shorter fight cuts incoming damage on
// every later turn - a mechanism that predicts output pulls ahead AND pulls further ahead as the
// sample grows. Six careers an arm could not see it. Twelve cannot either, and the rows that
// should have firmed up are the ones pointing the other way. The argument is not refuted - a
// mechanism can be real and worth a fraction of a win - but it has now had its best shot at the
// sample its own file asked for, and it should stop being cited as though it were established.
//
// AND THE COST ESTIMATE WAS WRONG BY AN ORDER OF MAGNITUDE, which is the methodological half.
// "About twelve" assumed both arms behave alike. They do not: the output arm's spread is 1.7x
// the armour arm's (sd 5.36 against 3.22, and the raw range is 15-32 against 17-28). The noisier
// arm sets the sample. Bringing a 1.08-win gap to 2 sd with these spreads needs
// sqrt((5.36^2 + 3.22^2)/n) <= 0.54, which is n >= 134 CAREERS AN ARM - 268 careers, better than
// a day of compute, for a difference of one win in twenty-three. That is not a measurement worth
// buying, and saying so is more useful than another arm.
//
// WHAT TO DO WITH THE QUESTION INSTEAD. Win counts are the wrong instrument for it: they are the
// coarsest thing this file prints and the one with the heaviest tail. If output-vs-mitigation
// matters, it should be asked of something that moves per FIGHT rather than per career - turns
// to clear a fight, damage taken per fight cleared - where the sample is thousands rather than
// twelve and the compounding claim makes a sharper prediction anyway. Filed rather than built.
//
// A NOTE ON THE VARIANCE ITSELF, because it is a finding and not just an obstacle. An output
// trinket makes careers less predictable and an armour trinket makes them more so, at the same
// mean. Nothing in this file has said that before, and it is the kind of thing a player feels
// long before a win rate shows it.
//
// NO DIAL MOVES. Nothing shipped but the measurement and the correction to its price.
//
// ── P01-P03: THE BENCH LEVER IS OFF HALF THE TIME, AND THE FILE SAID IT WAS ON ────
// The P-audit's three findings, converted into fixes, and the open claim behind them cashed.
//
// P02 IS THE ONE WITH A NUMBER. stat.benchHeld was set in the muster block and printed as "held
// on all N runs"; the game pays the job through hasBenchJob -> benchJobHolder, whose own comment
// states the condition - "a job whose holder was deployed after the muster is not in force" -
// and closeRanks draws its replacement from exactly that pool without excluding them. Asked at
// the door instead of at the muster, over three 150-expedition careers:
//
//   taken at the muster        150 of 150 runs, every career
//   still in force at the door 49.2% / 48.7% / 56.4%
//
// THE LEVER IS OFF ABOUT HALF THE TIME IT WAS BELIEVED ON. Two rows now, because they are two
// questions: what was taken, and what was in force. The second is the one worth anything.
//
// AND THAT IS WHY THE O-AUDIT'S OPEN CLAIM COULD NOT BE CASHED. "The bench job measured alone"
// has been open since that audit; measured through the old row it would have been a blend of a
// lever that is on and a lever that is off, read as a lever that is on. Run alone now, --bench
// scout against the default, three careers an arm, interleaved:
//
//                     no job             scout
//   ended the road    21 / 20 / 21       22 / 26 / 22        mean 20.67 -> 23.33, +2.66
//   nodes, median     74 / 74 / 75       77 / 78 / 70
//   score, median   24.6/25.3/24.4k    26.9/30.1/26.1k
//
// THE DIRECTION IS CONSISTENT AND THE SIZE IS NOT SETTLED, and the second half matters more.
// This file prints its own bar for these arms and it says so: "+-4.2 wins on one career; an arm
// of three means +-2.5, so two arms of three only settle a gap wider than about 10 wins." The
// gap is 2.66. The raw win counts happen not to overlap - 21 against 22 - and that is a
// coincidence of three small samples rather than evidence; the bootstrap SCORE intervals do
// overlap (22.3-27.2k against 24.8-31.2k on the first pair), which is the reading to trust. I
// nearly published "score separates 3/3" off the medians alone, which is comparing the wrong
// thing: ordered medians with overlapping intervals are what a null looks like from the side.
//
// SO THE CLAIM IS CASHED IN THE SENSE IT ASKED FOR - the job has been run on its own for the
// first time - and the answer is "positive, under three wins, unresolved at this sample". K11's
// shape: the direction, and what it would cost to settle it, which here is roughly twelve
// careers an arm on the wins column or a metric with a tighter bar.
//
// P03 IS A GAME FIX WITH NO DIAL IN IT. Nothing told the player either. The step-up was logged
// and the consequence was not, so a player had to know the rule to connect them, and none of the
// three job descriptions named it. One constant - BENCH_JOB_CONDITION - used at all three render
// sites rather than three copies, because two spellings of one rule kept in step by hand is
// exactly what N04's guard got wrong. And closeRanks now says it when it happens, reading the
// holder BEFORE the step-up because benchJobHolder gates on gridPos === 0 and the next line
// makes that false.
//
// P01 IS A RATCHET ON A CENSUS THREE ITEMS REST ON. runStats.outMoves and outMelee were named by
// no suite. Suite 170 holds them now through applyDamageHit - the real door, not a hand-built
// figure, which is the bug O19 found rather than a guard against it: a melee swing books its
// move and its thrower, the same swing under a live card names the card, and a ranged swing
// books nothing in either map.
//
// AND A MARKER SPLIT, because the P-audit's own correction was too broad. It settled F10's entry
// whole while its own text said the capstone half still stood, and stale.js stopped counting a
// live claim - open read three for one commit and is four again. A correction that touches two
// claims has to say something about each.
//
// NO DIAL MOVES. One log line, one shared sentence of card text, two instrument rows.
//
// ── P-AUDIT: THREE FINDINGS, AND TWO OF THEM ARE O21's BUG WEARING A DIFFERENT HAT ─
// Nine items since the O-audit and four of them consecutive doctrine follow-ups, which is how a
// line of work goes narrow. Audited the tree fresh at c2dd3cb rather than mining further, hunting
// the classes this repo keeps producing. Findings are filed here with evidence and a check; none
// is fixed in the audit itself.
//
// P01. THE CENSUS THAT SETTLED THREE ITEMS HAS NO RATCHET. runStats.outMoves and
// runStats.outMelee are written at one site in game.js, read at one site here, and named by NO
// SUITE. The O-audit cleared ten thin runStats keys on exactly this test - "all have readers in
// game.js and are named by suites, so none is an L02-style dead field" - and these two are the
// first additions since that fail it. They are not ornamental: outMelee is what answered O20's
// open question and what O21 reported as "0 melee thrown under a live card". Break cut.who, or
// the activeDoctrine read beside it, and nothing goes red. CHECK: a suite row that books a melee
// swing through the real door and reads both maps back, the way suite 170 holds the landing
// figure.
//
// P02. THE BENCH LEVER IS READ AT THE MUSTER AND PRINTED AS THE WHOLE RUN. stat.benchHeld is set
// in the muster block and the report prints it as "held on all N runs", under a comment saying
// it is "printed as what was actually held". But the game decides whether the job PAYS through
// hasBenchJob -> benchJobHolder, and that function's own comment says the condition out loud:
// "The holder has to be on the roster and on the bench: a job whose holder was deployed after
// the muster is not in force." closeRanks draws its replacement from exactly that pool -
// playerRoster.filter(c => c.gridPos === 0) - and does not exclude the holder. So the job stops
// paying the moment casualties pull them into the line, and this row says it was held all run.
// Same shape as O21's doctrineKept, in a second lever, and it lands on a claim that is open
// right now: the O-audit's "the bench job measured alone" would be measured through this row.
// CHECK: book whether the job was still in force at each node, not whether it was taken at the
// muster; then the bench arm can be measured at all.
//
// P03. AND THE PLAYER IS NOT TOLD EITHER, which is the same root with a game face. Nothing logs
// the job ending. closeRanks logs the step-up - "X steps up into the second rank" - and the
// consequence is silent, so a player must already know the rule to connect the two. None of the
// three BENCH_JOBS descriptions names the condition: SCOUT, QUARTERMASTER and MEDIC each say
// what the job does and none says it ends if its holder is ever deployed. A lever that turns
// itself off without saying so is the N02 class, and the fix is a line of text rather than a
// dial. CHECK: the card text, and a log line where benchJobHolder first returns null.
//
// WHAT THE AUDIT DID NOT FIND, because an audit that only reports hits is not an audit. Every
// BENCH_JOBS id has exactly one hasBenchJob reader, so no bench content is dead. The ten thin
// runStats keys the O-audit cleared are still clean. The muster block holds fifteen other
// stat.X assignments and the rest are genuinely muster-time questions - lineSize is G13's
// empty-line guard and belongs there, doctrineOffered and doctrineLive are what was on the table
// rather than what survived, and gearMit/gearAnswers are probes of the pool.
//
// AND ONE RECORD CORRECTION, made at its own site above - WHICH I THEN MADE TOO BROADLY, marked
// here rather than quietly repaired. The correction settled F10's entry whole, and the same
// paragraph said its capstone half still stood; stale.js promptly stopped counting a live claim
// and the open count read three for one commit. The marker is split now. A correction that
// touches two claims has to say something about each.
//
// F10's open claim says "none re-drafts
// its line between expeditions as the roster changes". The line IS re-drafted every expedition,
// because EXPEDITION calls confirmNewGame per run. The true half is that the draft policy never
// adapts to mastery, which confirmNewGame leaves alone. It survived because the claim is
// present-tense AND marked, so stale.js counts it read and never looks again - the instrument
// checks that every claim HAS a marker, not that the marker is right.
//
// NOTHING SHIPPED BUT THE FINDINGS AND THAT CORRECTION.
//
// ── O24: THE TWO FAMILIES HAVE OPPOSITE SIGNS, AND THE CARD DOES NOT SAY WHICH ────
// O23 split the seven by the shape of their rule and priced neither. The split rested on a
// mechanism - share of doors fought under strength - and the WIN cost was measured for exactly
// one card. If a membership card charged bodies and cost nothing, O23's framing would have been
// a story about a statistic. One card from each family, priced the way O22 priced NO HANDS:
// --doctrine off as the control, which holds the drafted line fixed and moves only the take.
// Three 150-expedition careers an arm, interleaved.
//
//                        card taken        take withheld     gap
//   CONSCRIPTS wins       6 /  5 /  6       8 /  9 / 11      -3.66
//     nodes, median      61 / 63 / 62      69 / 70 / 68
//     score, median    13.8/14.8/13.4k   17.8/16.4/18.1k
//     doors under strength 24.3/26.6/17.8%  5.7/5.0/2.9%
//
//   THE WALL wins        23 / 13 / 23      13 / 15 / 12      +6.34
//     nodes, median      75 / 77 / 73      72 / 77 / 76
//     score, median    28.0/25.1/25.5k   21.8/22.8/22.2k
//     doors under strength  0.0/0.0/0.0%   7.3/7.5/5.9%
//
// THE MEMBERSHIP FAMILY COSTS WINS, AND THE TWO CARDS AGREE TO WITHIN A WIN. CONSCRIPTS is
// -3.66 against NO HANDS' -4.34, and the arms land on top of each other: both withheld arms sit
// near 9.3-9.7 wins and both taken arms near 5.3-5.7. Three careers, same direction, and wins,
// nodes and score all non-overlapping. O23's grouping is a property of the game rather than of
// one card.
//
// THE COMPOSITION CARD RUNS THE OTHER WAY, AND THE WIN COLUMN DOES NOT SETTLE IT. THE WALL's
// mean is +6.34, every column points the same way, and its score intervals separate 3/3 -
// 25.1-28.0k against 21.8-22.8k. But one taken career read 13 against a withheld arm holding a
// 13 and a 15, so the win counts OVERLAP and the D17 rule is not met on them. Directionally
// positive and score-separated; not a settled +6.34. Settling the win column would take more
// careers than this item bought, and the score separation is the stronger evidence anyway.
//
// WHAT THAT MEANS FOR A PLAYER AT THE MUSTER. The draw offers three of seven, and two cards of
// almost the same advertised size sit on opposite sides of zero: CONSCRIPTS pays +15% and costs
// about four wins, THE WALL pays +12% and appears to gain. Nothing on either card distinguishes
// them - both read as a rule and an edge, and the difference is whether the rule survives losing
// somebody. The bonus number does not track the sign, and it is the only number shown.
//
// THIS IS A DESIGN FINDING AND IT IS NOT MINE TO ACT ON. It joins the parked NO HANDS decision
// rather than moving a dial, and it should be read with that one: the same mechanism, priced
// twice more, now with a card on the other side of it for contrast.
//
// TWO THINGS REPLICATED ON THE WAY. THE WALL read 0.0% under strength on all three careers at
// 150 expeditions, having read 0.0% on all three at 60 - the structural claim holds at both
// sample sizes. And CONSCRIPTS bites HARDER at 150 than at 60 (24.3-26.6% against 15.2%), which
// is what its rule predicts: doctrineFavourites is a habit, and a longer career has one.
//
// NO DIAL MOVES. Nothing shipped but the measurement.
//
// ── O23: TWO PRICES, AND THE CARD'S OWN RULE DECIDES WHICH ONE YOU PAY ─────────────
// O22 priced the NO HANDS card alone at -4.34 wins and found the mechanism in closeRanks, which
// leaves a vacated rank empty rather than step a forbidden body into it. closeRanks does not
// special-case NO HANDS, so I expected a doctrine fact. IT IS NOT ONE. It is a fact about the
// SHAPE of a card's rule, and the seven split into three groups that nothing here has ever
// named. Share of fight doors fought under strength, counted only where the card was LIVE,
// against the same drafted line with the take withheld. Three careers of 60 expeditions a cell:
//
//                    withheld   live-only, three careers      mean   live share
//   NO HANDS           8.3%     25.8 / 31.2 / 30.1            29.0   84-96%
//   CONSCRIPTS         7.2%     16.7 / 14.0 / 14.9            15.2   94-100%
//   FIELD SURGERY      6.3%     10.0 /  8.3 /  7.2             8.5   100%
//   OLD GUARD          7.2%      6.7 /  6.7 /  6.8             6.7   94-95%
//   LIGHT ORDER        8.8%      4.7 /  6.3 /  6.4             5.8   71-86%
//   BROAD SPECTRUM     6.6%      1.3 /  0.0 /  0.0             0.4   38-40%
//   THE WALL           4.4%      0.0 /  0.0 /  0.0             0.0   29-36%
//
// A RULE ABOUT MEMBERSHIP IS STILL TRUE OF A LINE THAT HAS LOST SOMEBODY. Nobody owns melee;
// nobody is one of your three favourites - a squad of two satisfies both as readily as a squad
// of three. So the card stays live, closeRanks keeps refusing the bench, and the hole is
// permanent. That is the family that charges you in BODIES, and NO HANDS is its extreme because
// melee is the commonest thing on a bench.
//
// A RULE ABOUT COMPOSITION CANNOT BE TRUE OF A SHORT LINE AT ALL. THE WALL wants a front rank
// and at least two behind it; BROAD SPECTRUM wants three damage types across three operators.
// The loss itself breaks the card, doctrineBroken latches, keeps() goes back to returning true,
// and the rank refills on the same call. That family charges you in MULTIPLIER instead - and the
// live-share column is the receipt: those two ran live for about a third of a run, the others
// for nearly all of it. THE WALL's 0.0% is not luck, it is arithmetic, and it printed three
// times out of three.
//
// CONSTRUCTED IN SUITE 79 rather than left as a table. The same shape of loss, both families:
// THE WALL over a line built for it breaks on the loss and comes out 3 standing; NO HANDS over a
// line built for it does not break and comes out 2 standing, still live, still paying.
//
// WHAT I WOULD NOT READ OFF THIS TABLE. The bottom three rows sit BELOW their withheld arm, and
// that is at least partly a depth confound rather than protection: the withheld arm survives
// longer, so it meets harder content and takes more casualties per door. The confound runs
// against the top of the table and with the bottom, so NO HANDS at 3.5x is if anything
// understated and LIGHT ORDER's 0.7x should not be read as the card helping. Separating that
// needs depth-matched arms and this item did not run them.
//
// AND ONE INSTRUMENT NOTE THAT CHANGED THE ANSWER. The first pass counted every door rather than
// every LIVE door, which blends "the card is refusing step-ins" with "the card is dark and
// refusing nothing" - and it understates exactly the two cards whose rule is hardest to keep.
// THE WALL read 7.2% that way and 0.0% correctly, which is the difference between a mild finding
// and a structural one. The census books both now and the report prints the live-only row
// whenever the two differ.
//
// A CAVEAT ON THE CELL SIZE, found the same way. LIGHT ORDER read 8.6% and then 4.0% on two
// identical 60-expedition careers, which is why every cell above is three careers and not one.
// Casualties cluster by run, so thousands of doors do not buy the precision the door count
// suggests.
//
// NO DIAL MOVES. One census split, one report row.
//
// ── O22: NO HANDS RE-PRICED - MY PREMISE WAS WRONG AND THE CARD COSTS FOUR WINS ────
// I pitched this item on a prediction: O12 priced NO HANDS at -11.33 wins on an arm where O21
// later found the card dark four fights in five, so the gap had to be a handicap without its
// compensation. IT IS NOT. Re-run in O12's own shape - baseline against --draft
// doctrine:NO_HANDS, three 150-expedition careers each, interleaved - with the card now live at
// 85-91% of fight doors and kept on 120-126 runs of 150:
//
//                        baseline          NO HANDS line    same line, take withheld
//   ended the road        15 / 22 / 14      7 /  5 /  4      9 /  9 / 11
//   reached sector 7      21 / 34 / 27      9 /  6 /  4     15 / 13 / 23
//   nodes cleared, median 72 / 75 / 72     51 / 48 / 51     68 / 66 / 70
//   score, median      23.4/25.6/24.1k    8.5/ 4.1/ 7.8k  17.5/17.5/16.6k
//   wipes per run       6.46/6.24/6.31   5.90/5.53/5.71   6.38/5.91/6.51
//
//   wins mean   baseline 17.00   NO HANDS 5.33   gap -11.67, against O12's -11.33
//
// THE GAP DID NOT MOVE. O12's finding is CONFIRMED, and now on an instrument that can see the
// card. The file's own error bars make the separation legible rather than asserted: it prints
// +-2.1 wins for the baseline arm and +-1.5 for the NO HANDS arm and says two arms of three
// settle a gap wider than about nine and about six. 11.67 clears both, same direction 3/3, and
// no column overlaps - the score intervals are 20.8-29.3k against 3.7-10.7k.
//
// AND THE CONTROL ARM O11 BUILT AND NOBODY HAD EVER USED SPLITS IT. `--doctrine off` withholds
// only the BANK: the same draft, the same line, the same three offers rolled and read, and then
// nothing taken. That is the one comparison in which the card is the only thing that moved.
//
//   the LINE costs   17.00 -> 9.67    -7.33 wins    (drafting melee-free)
//   the CARD costs    9.67 -> 5.33    -4.34 wins    (taking the thing you drafted for)
//
// A +15% score multiplier that also softens incoming front-rank melee by a fifth COSTS FOUR
// WINS AND HALVES THE SCORE MEDIAN. That cannot come from a multiplier, so it comes from
// somewhere else, and closeRanks says where in its own comment: "Better to leave the rank
// empty." A doctrine is a promise the game will not break on the player's behalf, so when a body
// falls it will not step a forbidden class into the gap - and under NO HANDS most of the bench
// is forbidden. The loss is permanent for the rest of the run.
//
// MEASURED AT THE DOOR RATHER THAN ARGUED, 60 expeditions an arm, same line both sides:
//
//                                   card taken    card withheld
//   bodies standing, mean              2.80          2.92
//   doors fought under strength     18.6%          6.9%
//
// And constructed in suite 79, which is where it belongs: one melee body on the bench, rank 2
// falls, and the line comes out at 2 standing with the card live and 3 with it withheld. Same
// loss, same bench, same everything else.
//
// WHAT THIS SAYS ABOUT O18. Its null is no longer a puzzle. A quarter more damage on every swing
// bought one win because it was being paid into a hole four wins deep that damage does not
// touch - the card's price is bodies, and O18 was paying in output.
//
// WHAT I AM NOT DOING. The step-in rule is deliberate, and the codex already carries it: "the
// game will never break it for you when it closes ranks behind a loss." That sentence is true
// and it reads as a reassurance, which is the wrong register for the dominant term in the card's
// price - but rewording a card whose shape is already parked with the owner is a design call and
// not mine. Filed with the parked NO HANDS decision rather than acted on.
//
// A NOTE ON THE COMPARISON. The -7.33 for the line is not "melee-free costs seven wins" in
// general; it is what THIS draft policy's melee-free line costs against THIS default opener,
// which is a Bruiser or a Shotgunner and then usually a Medic. O13 already measured 4.33 wins of
// arrangement inside a NO HANDS line, so the line term is a policy figure and the CARD term is
// the one that is about the game.
//
// NO DIAL MOVES. One diagnostic added: bodies standing at each fight door, and the share fought
// under strength.
//
// ── O21: THE CARD WAS NEVER LIVE - THIS FILE READ THE PROMISE FOUR LINES TOO EARLY ─
// O20 closed on one question with one answer: how does a Bruiser reach a line that owns no
// melee? It does not. No Bruiser has ever stood in a live NO HANDS line. The card was DARK for
// four fights in five, and this file said it was kept.
//
// I proposed a mechanism three times - the Scavenger's knife, the BAYONET, closeRanks - and was
// wrong three times, so this item proposed nothing. It instrumented the line at the fight door:
// at every fight, if a doctrine is taken and unbroken, ask the doctrine its OWN holds() of
// whoever is standing, and record the line rather than a theory. Two counters, one key, and the
// answer came back on the first run:
//
//   --draft doctrine:NO_HANDS, 12 careers      before          after both fixes
//     fight doors under a live doctrine        136 of 689      678 of 733
//     where its own rule was false at the door   9 (1.3%)        0 (0.0%)
//     doors run with the card BROKEN           553             55
//     runs still keeping it at the end         12 of 12        16 of 20
//     melee as a share of output               13.9%           4.3%
//     of that melee, thrown under a live card  0               0
//
// TWO BUGS, BOTH IN THIS FILE, BOTH ABOUT WHERE A LINE SITS.
//
// THE FIRST IS THE ONE THAT COST THREE ITEMS. `stat.doctrineKept` was set in the MUSTER TAIL,
// four lines below the take, and printed under the heading "still keeping it at the end". It
// could only ever come back 100%, and it did - 150 of 150 on the careers O18 and O20 read, which
// is the row both of them reasoned from. It is read after the last fight door now. The default
// arm, which has never been able to say this: 19 of 25 runs take a card and 10 of those 19 are
// still keeping it at the end, with 784 of 1295 fight doors run under a live one.
//
// THE SECOND IS WHY THE CARD WENT DARK SO FAST, and it is the same shape. `applyBench` - the
// policy that decides which three of four abilities a rank III operator brings - ran in the
// muster tail too, BELOW the draft and below the take. So the draft asked holds() of decks it
// was about to change. The Scavenger is the clean case: their fourth is a SHIV, the engine
// benches the fourth by default, NO HANDS signs off on a deck that reads clean, and then this
// policy benches the basic instead and the SHIV comes off the bench. First breach at sector 1,
// fight 1, before a single blow. The bench policy runs above the draft now, and the breach
// count at the door is zero on both arms - which is the row to watch, because it goes red the
// moment a fourth path into a deck opens.
//
// AND ONE REAL HOLE IN THE GAME, found on the way and closed. O19 shut the two doors that change
// a loadout on their own - a promotion and a gear fit - and left the one a PLAYER uses: the bench
// chip, which is the screen where you pick which three of four to bring. Bench the Scavenger's
// PIPE_RIFLE and the SHIV comes off the bench with it, and nothing asked, so the badge went on
// reading live over a line that was now throwing melee. It re-asks now, in the run only; the
// muster deliberately does not, because nothing is committed until DEPLOY and musterDeploy
// already drops a card the line stops keeping rather than latching it broken. Constructed in
// suite 79: holds and pays 1.15, bring the SHIV, the rule goes false, nothing breaks until
// something asks, and then it pays 1.00.
//
// WHAT THIS OVERTURNS. O20's headline - a Bruiser standing in a NO HANDS line - is withdrawn at
// its own site. O18's "its rule does not hold in play" was the right worry aimed at the wrong
// mechanism: the rule holds at 100% of live doors, and what was actually happening is that the
// card broke almost immediately and a broken card forbids nothing, so the melee O18 and O20 both
// measured was ordinary play by an ordinary line. Every doctrine figure this file has printed
// was read through a keep rate of 100% that was not a measurement.
//
// WHAT IT DOES NOT CLAIM. The melee share is not the cost of NO HANDS - O18 already corrected
// that once and the "so NO HANDS trades" row still prints both halves career-wide, including
// stretches where the card is dark. What the card is worth is a paired measurement on a working
// instrument, and it has not been taken. It is the first thing the next item should do, because
// for the first time the arm it would be taken on carries the card for the whole run.
//
// NO DIAL MOVES. One call added in the game, two lines moved in the instrument.
//
// ── O20: THE CENSUS, CORRECTED - AND A BRUISER IS STANDING IN A NO HANDS LINE ──────
// O19 fixed the outgoing census to read the move being resolved rather than a global, withdrew
// two published figures, and left the re-measurement to this item. Three careers an arm against
// a paired baseline, interleaved, on the corrected instrument.
//
// FIRST, O15's FIGURE WAS NEARLY RIGHT AND IS RESTORED. The squad throws 35.3% of its damage in
// melee on a default line, against the broken reading's 37.7%. So the bug barely moved the
// default arm - pendingAction happened to agree with the move often enough there - and the shape
// O15 concluded on survives at roughly 5 to 1 rather than 5.5. The incoming buckets are
// unchanged as O19 said they would be: 35.2% melee onto the front rank, 7.0% covered by the edge.
//
// AND SECOND, O18's LEAK IS REAL AND WAS NEVER THE BUG. A NO HANDS career still throws 25.8% of
// its damage in melee on the corrected census, with the card taken 150 of 150 and kept 150 of
// 150. O19's fix - the doctrine re-asking on promotion and on gear, carriesMelee reading through
// moveReachFor - did not move it at all.
//
// SO THE REPORT NAMES THE MOVE NOW, because two items were spent guessing at a share. 60
// expeditions, --draft doctrine:NO_HANDS --arrange front:
//
//   heavy_wrench 1236   shiv 1007   shield_slam 464   ripsaw 278   trench_sweep 213
//   bayonet_thrust 159  buckshot 1
//
// HEAVY WRENCH AND SHIELD SLAM ARE THE BRUISER'S, and the Bruiser carries melee in its BASE
// three - it cannot pass carriesMelee at any rank, with any bench choice, wearing anything. A
// class that can never hold this doctrine is standing in a line that reports holding it, and it
// is throwing the largest share of the melee. This is not the promotion hole and not the mod
// hole; both of those are real, constructed in suite 79, and neither explains a Bruiser.
//   ^^ O21 WITHDRAWS THIS, INCLUDING THE TITLE ABOVE. The Bruiser is real and the deck read is
//   right; what is wrong is "a line that reports holding it". Instrumented at the fight door,
//   NO HANDS was BROKEN at 553 of 689 doors on this very arm, and no Bruiser has ever stood in
//   a live one. The row that said otherwise - "kept 150 of 150" - was read in the muster tail,
//   four lines below the take, and could not have said anything else.
//
// WHAT IS RULED OUT, checked rather than assumed: closeRanks is not the path. It already refuses
// to step a body into a vacated rank when that would break the promise - `keeps()` asks
// holds([...deployedLine(), c]) before moving anybody - and it re-asks checkDoctrine afterwards.
// assignSlot re-asks. The draft only sets wantDoctrine when it built a line that holds.
//
// SO THE CAUSE IS NOT YET FOUND, and this item stops here rather than guessing a fourth time.
//   ^^ O21 FOUND IT, and stopping was the right call: the fourth guess would have been wrong
//   too, because there was nothing in the game to find. Instrumenting the line at the door
//   instead of reasoning about it answered it on the first run.
// What it leaves is better than what it started with: the leak is confirmed real on a corrected
// instrument, the two published figures are restored or withdrawn correctly, and the report names
// the move instead of printing a share - so the next item begins by asking how a Bruiser reaches
// a line that owns no melee, which is one question with one answer rather than a hunt.
//
// NO DIAL MOVES. The only engine change is the move id riding on the figure so the census can
// name it.

// ── O19: THE DOCTRINE RE-ASKS NOW - AND THE CENSUS THAT FOUND THE HOLE WAS BROKEN ──
// O18 closed on a plan: call checkDoctrine on promotion and on gear, re-measure, then decide the
// card's edge. The first half is done and the second half turned into something else.
//
// WHAT SHIPPED, three changes and the third is the one that matters:
//   awardXp re-asks when the mastery RANK moves - gated on the rank rather than called on every
//   award, because awardXp fires on every kill and doctrineHolds walks the line each time.
//   equipGear re-asks after a piece goes on.
//   carriesMelee reads reach through moveReachFor instead of off the ability's declaration. The
//   first two cannot help without this one: a deck read cannot see a mod, and moveReachFor is
//   the function the fight itself asks. One source of truth for reach.
//
// AND TWO THINGS O18 GOT WRONG, both found by trying to construct what it asserted.
//
// THE PROMOTION HOLE NEEDS A CHOICE. O18 said a line legal at the muster stops being legal as
// the career runs. It does not: benchedFor DEFAULTS TO BENCHING THE FOURTH, so ranking up alone
// changes nothing and the first cut of the row went red saying so. The hole opens only when the
// operator BRINGS the fourth by benching a basic - a choice on the promotion screen, which this
// file's applyBench makes for every rank III body it fields and a player may never make.
//
// THE MOD HOLE IS REAL AND CONTRIBUTED NOTHING. This file never fits a BAYONET. So whatever the
// leak was, the mod half was not in it - a hole a PLAYER can walk into that the instrument
// cannot, which is D05's trap with the sides swapped.
//
// AND THEN THE MEASUREMENT REFUSED TO CONFIRM ANY OF IT. Three careers with the fix in:
// "still keeping it at the end" stayed 150 of 150, and the squad's melee share stayed at
// 22-24.5%. Nothing broke. Chasing that found the real defect, and it is mine:
//
//   O15's census asked moveReachFor(pendingAction, attacker) for the OUTGOING half. pendingAction
//   is set to null at the top of processTurn and again after every resolve, so by the time a blow
//   reaches the damage door it is routinely null or stale. applyDamageHit is handed abilityStr -
//   the move actually being thrown - and that is what both the door and the pierce shortcut read
//   now.
//
// SUITE 170 WAS PASSING BECAUSE OF THE BUG, which is how it survived two items. Its fixture set
// the global pendingAction and passed null as abilityStr; the census read the global the test
// had set rather than the move the engine resolves. Fixed to hand the door the move, and it then
// reads melee correctly.
//
// SO TWO PUBLISHED FIGURES ARE WITHDRAWN, marked ^^ at their own records: O15's "the squad
// throws 37.7% of its damage in melee" and the 5.5:1 trade shape built on it, and O18's "22-27%
// of a NO HANDS career is melee". THE INCOMING FOUR BUCKETS ARE UNAFFECTED - they read
// attacker.range and gridPos, properties of the bodies rather than a global - so 33.8-34.1% onto
// the front rank and the 6.8% the edge covers both stand.
//
// WHAT IS SETTLED: the doctrine re-asks, carriesMelee and the fight agree about reach, and both
// holes are held by construction in suite 79 rather than by a sampled figure.
// WHAT IS NOT: how much melee a NO HANDS line actually throws, and therefore what the card is
// worth. That needs the corrected census re-run, and it is the next item rather than this one -
// a measurement taken to confirm a fix should not also be the measurement the fix is judged by.
//
// NO DIAL MOVES beyond the three above, none of which is a tuning number.

// ── O18: NO HANDS CANNOT BE PRICED, BECAUSE ITS RULE DOES NOT HOLD IN PLAY ─────────
// O15 measured the card's trade for the first time and the owner picked the direction: pay in
// the currency it charges in. The line gives up its knives, so what it still carries hits
// harder. Built as NO_HANDS_EDGE = 1.25 on every swing the line throws, sized at a quarter
// because K06's floor is about fourteen wins across three careers an arm and anything smaller
// would read as nothing whichever way it went. Three careers against a paired baseline,
// interleaved, 900 expeditions:
//
//                             baseline              NO HANDS + output edge   D17
//   runs that ended the road   17 / 23 / 19          10 / 13 / 18            3/3, overlap
//   reached sector 7           32 / 30 / 29          18 / 19 / 28            separates, WRONG WAY
//   score, median            23.7k/ 22.4k/ 23.4k   19.7k/ 18.9k/ 24.0k       reverses
//
//   wins mean   baseline 19.67   NO HANDS 13.67   gap -6.00, against O13's -7.00
//
// A QUARTER MORE DAMAGE ON EVERY SWING THE SQUAD THROWS IS WORTH ONE WIN. That is the headline
// and it is not about this card: it is the fourth time this instrument has priced a large
// output change near zero - M04b's matching at ten, K11's augment cap at 1.5, M10's overdrive
// fork at 0.7. The wall is not made of squad damage.
//
// THE EDGE DID FIRE, checked rather than assumed, because D06 is what happens when it did not:
// melee points a blow read 30.5-32.2 on the baseline and 37.8-43.7 on the arm.
//
// AND THE MEASUREMENT FOUND THE REASON THE CARD CANNOT BE PRICED AT ALL. 22-27% of the damage a
// NO HANDS career deals is MELEE, on a card whose entire rule is that nobody in the line owns a
// melee ability, taken 150 of 150 and "still keeping it at the end" 150 of 150. Two holes, and
// neither is visible to the rule:
//   ^^ O21: AND "150 OF 150" WAS NOT A MEASUREMENT. That row was set in the muster tail, four
//   lines below the take, under a heading claiming to read the end of the run - so it returned
//   100% by construction. Read at the door, this arm ran four fights in five with the card
//   BROKEN. The worry in the title is upheld and the mechanism is not: the rule holds at every
//   live door; the card simply went dark in sector 1, and a broken card forbids nothing.
//   ^^ O19 WITHDRAWS THE 22-27% TOO, and for the same reason: it is the same broken census. What
//   remains true is that the two holes below are real - both are constructed in suite 79 - and
//   that a doctrine could not be priced while they were open. How much melee a NO HANDS line
//   actually threw is now unknown and needs the corrected census re-run.
//
//   carriesMelee reads deckFor(), and deckFor GROWS - at mastery rank 3 it appends the class's
//   fourth ability, and the Scavenger's fourth is SHIV, reach melee. A line legal at the muster
//   stops being legal as the career runs.
//     ^^ O19 CORRECTS THIS, having tried to construct it and failed on the first attempt: rank
//     alone changes nothing, because benchedFor DEFAULTS TO BENCHING THE FOURTH. The hole needs
//     the operator to BRING the fourth by benching a basic instead - a choice on the promotion
//     screen. This file's own applyBench makes that choice for every rank III body it fields,
//     which is why the leak showed up in the measurement above; a player who never touches the
//     screen is safe from this half.
//
//   moveReachFor returns melee for PIPE_RIFLE on any body wearing a BAYONET. The engine's own
//   comment says so - "the same move can be melee in one pair of hands and ranged in another" -
//   and a deck read cannot see a mod at all.
//     ^^ O19: REAL, AND IT CONTRIBUTED NOTHING TO THE FIGURE ABOVE. This file never fits a
//     BAYONET - the word appears in no policy in it - so the 22-27% was the promotion half
//     alone. The mod half is a hole a PLAYER can walk into and this instrument cannot, which is
//     the mirror of D05's trap and worth naming as one.
//
// AND NOTHING RE-ASKS: checkDoctrine has three callers, two in the draft and one in assignSlot.
// Not promotion, not gear. The promise is checked when it is made and when a body changes slot,
// and never again.
//
// SO THE DIAL IS REVERTED. game.js carries no part of the output edge. Not because the direction
// is wrong - it is the owner's call and it is a reasonable one - but because a card that is not
// enforcing its own rule cannot be priced, and an edge measured on a line that is still swinging
// is measuring something other than the card. Suite 79 holds all three halves of the hole, and
// the caller row is written against the LIST rather than a count, so adding the missing call
// from promotion or gear reds it and asks for this note to be updated.
//
// WHAT IT WOULD TAKE, in order: call checkDoctrine when mastery ranks up and when gear is
// fitted, re-measure the card as it then actually plays, and only then decide what its edge
// should be. That is one item and the first half of it is small.

// ── O17: THE RECORD NOW READS ITSELF, AND IT WAS STALE IN FIVE PLACES ──────────────
// Three times in two days a closing sentence in this file was answered by the item that
// followed it and left standing in the present tense. This record is newest-first, so the
// answer sits ABOVE the question - eleven lines above it, in one case - and nothing re-reads
// the older block. The O-audit swept the arms, the dead fields and the denominators and caught
// none of them: staleness in prose is a property of the RECORD, not of the code.
//
// tests/stale.js is the instrument. It finds every present-tense open claim in this header and
// reports which have been READ since - marked ^^ with what settled them, or with why they still
// stand. Fifteen claims; ten minutes of reading. THE SCAN FOUND TWO MORE I DID NOT KNOW ABOUT:
//
//   O10's    "what a doctrine is WORTH is still unmeasured"      answered by O11   (known)
//   O-audit  "NOTHING HAS EVER TAKEN A RETREAT ... NOT BUILT"    answered by O16   (known)
//   M-audit  "WHICH HALF IS BETTER IS NOT MEASURED HERE"         answered by M10   (known)
//   I01      "does walking through it change anything? - is not" answered by O16   <- new
//   K06/P02  "no reading has ever come off the second half"      answered by M10   <- new
//   ^^ READ: the five rows above QUOTE claims rather than making any - which the scan cannot
//   tell apart, so it flags them and this line clears them. Each claim is marked at its own
//   site. My first draft of this table went red against the row I had just written, the same
//   way my O15 write-up went red against suite 163's hand-rolled-accumulator scan: a record
//   that quotes what an instrument looks for will trip it, and that is the instrument working.
//
// I01's is the one worth looking at twice. It does not just leave a question open - it PREDICTS
// that answering it needs "a much larger change than a policy flag". O16 answered it with one
// line, because I02 had already built the mechanism. A stale claim is not only out of date; it
// can carry a wrong estimate of the work, and that estimate is what keeps an item parked.
//
// WHAT THE INSTRUMENT DELIBERATELY DOES NOT DO is nominate which item answered which claim. That
// was built first, run, and thrown away: scoring a claim's words against the titles of newer
// items gave nine candidates with one right answer; widening to the claim's paragraph - needed
// to catch the M-audit case, whose subject word sits three lines above the claim - gave twelve
// with two. The rest matched on `policy`, `work`, `engine`, `runs`, `never`, words this record
// uses everywhere, and filtering to words in three titles or fewer did not save it. A list that
// is three-quarters wrong trains you to skim it, which is worse than no list. The enumeration is
// exact and the judgement stays with whoever reads it.
//
// THE RATCHET IS NOT "NO CLAIM MAY BE OPEN". Open claims are how this file says what it does not
// know, and there should be plenty. The bar is that none sits UNREAD: an item that closes on an
// open question marks it in the same breath, which costs one line. The count has run 4 -> 3 -> 4
// -> 2 -> ZERO, and this is the first time the record has held no open claim at all - not
// because nothing is unknown, which would be a lie, but because every question this file has
// raised in its own words has now been walked to an answer, a refutation or a price nobody is
// paying. What is still unknown sits in two other places that this scan deliberately does not
// read: the design decisions parked with the owner, and the items priced and declined on
// arithmetic. Zero here is a statement about MARKERS, not about knowledge, and reading it as
// "nothing left to do" would be the same mistake as every other number in this file that got
// believed past what it measured.
//
// THE LAST TWO WENT TOGETHER IN O05b/F10b, and both needed a door built before the question was
// askable: the elite offer had to be plumbed through a path the harness walks, and the capstone
// bank had to have a policy that presses the button. Both came back null on the win column and
// both said something mechanical instead - the asking is free, and the banking cannot buy what
// it is banking for.
//
// IT READ THREE FOR ONE COMMIT AND THAT WAS MY ERROR, not a settlement: the P-audit read F10's
// marker instead of trusting it, found the re-draft half false, and reclassified the WHOLE entry
// while its own text said the capstone half still stood. The marker is split now and the live
// half was counted again until F10b answered it. Two lessons, and the second is the one that
// cost something: a claim that is present-tense AND marked is invisible to the scanner, which
// checks that a marker EXISTS and cannot check that it is RIGHT; and a marker that settles two
// claims at once can only be right about one of them.
//
// AND THE THIRD LESSON CAME OUT OF WRITING THIS PARAGRAPH, which is the third time that has
// happened. Syncing these numbers meant reading every marker, and one of them - K11's - carried
// TWO, disagreeing: K11b wrote its answer above the existing "STILL OPEN" line and left it
// standing, so the last word a reader got was the stale one. The scan passed it silently,
// because it tested the whole window for an answer, took the first hit and stopped. An
// instrument built for exactly one failure mode was blind to that failure mode occurring inside
// a claim it had already cleared. stale.js reads marker BLOCKS now: the last DECLARED verdict is
// the live one, quoted spans are stripped so a correction quoting its own old text is not read
// as still making it, and an answer followed by a re-opening is reported rather than swallowed.
// Restoring the stale line reds three rows at once - the conflict count, the open count, and
// that claim's verdict - where before it reddened nothing.
//
// AND THAT SENTENCE ONCE SAID "five of the fifteen", WHICH WAS WRONG ON BOTH NUMBERS. Four were
// open, not five; seventeen claims existed, not fifteen, because the write-up above added two of
// its own. I wrote it an hour after doing the marking, in the item whose entire subject is claims
// in this record being wrong, and found it only when somebody asked "so nothing left?" and I
// grepped for the answer rather than repeating myself.
//
// SO THE COUNTS ARE NO LONGER PROSE. tests/stale.js reads what each mark SAYS - answered, still
// open, or not a claim after reading - and suite 173 pins all five numbers. A miscount now reds
// the battery instead of sitting in the paragraph that warns about miscounts. The breakdown, as
// the file reports it rather than as I remember it:
//
//   14 answered by a later item     2 still open     6 not an open claim after reading
//
// and 0 carrying two verdicts that disagree.
//
// AND R02 FOUND THE SCANNER READING ONE OF THEM OFF THE WRONG ENTRY. The window was a flat
// twelve lines from the claim, and tests/stale.js had computed each item's `end` since the day
// it was written and never used it - so a claim in the last twelve lines of an entry read the
// NEXT entry's markers as its own. An R02 claim marked STILL OPEN sat twelve lines above R03's
// `^^ ANSWERED`, both blocks landed in one window, and last-declared-verdict-wins handed the
// R02 claim R03's answer. It reported as answered and the counts stayed plausible. The conflict
// rule cannot catch it either: open-then-answered is the healthy direction, so a borrowed answer
// is shaped exactly like a settled one and only the item boundary tells them apart. Bounded now,
// and pinned in suite 173 by a window built to straddle two entries.
//
// R01 MOVED THIS ROW AND THE SUITE CAUGHT IT, which is the second time the mechanism has paid
// for itself inside the entry that describes it. R01's table filed a finding it could not chase
// - the control arm winning 19 of 150 where the last entry to quote the figure recorded 34%
// against a 30% target - and marked it STILL OPEN. The battery then went red on THIS paragraph,
// because the prose above still said 2, exactly the drift the paragraph is about.
//
// AND THE ZERO LASTED TWO COMMITS, WHICH IS WHAT IT SHOULD DO. The R-audit put two back on the
// board - R03's morale exit and R05's LIGHT_ORDER reading - because an audit's findings are open
// claims by construction: that is what a finding IS. Reading the count as a score to protect
// would make the next audit a thing to avoid, which is the exact failure the paragraph above
// warns about in the other direction. What the ratchet asks is that every one has been READ,
// and both of these were marked in the same breath as they were filed.
//
// NO DIAL MOVES. game.js is untouched.

// ── O16: THE DOOR I01 PRICED, WALKED THROUGH AT LAST - AND IT IS A NULL ────────────
// I01 moved retreat's perDepth 15 -> 6 and could only report AFFORDABILITY: 25-28% of the
// moments it was on the table, up to 56-62%. Whether taking it does anything was never asked,
// because nothing here pressed the button. The O-audit filed that as the one place a shipped
// change to the game had never been measured at all.
//
// THE BLOCKER WAS REAL AND THE FIX IS ONE LINE, because I02 built it and did not connect it.
// retreat()'s failure calls nextTurn(), which OPENS the next actor's turn through the engine -
// turn-start applied, turn counted - so this loop, which walks the queue itself, would do both
// again. I01 filed that as needing "the loop to hand the turn walk back to the engine, a much
// larger change", and I02 repeated it three paragraphs after building `engineOpened` for exactly
// that state. Constructed with Math.random pinned so the break cannot hold:
//
//   before   activeIndex 0, actor p3, fightLog.turns 0, every cooldown 5
//   after    activeIndex 1, actor p2, fightLog.turns 1, p2's cooldown 4, p3 untouched
//
// One turn-start, one count, on the body nextTurn landed on. Handing that body to engineOpened
// is the whole of it. Suite 146 holds the contract, and two mutations: taking nextTurn() out of
// the failure path reds the three constructed rows, and dropping the engineOpened line reds the
// row that pins the fix.
//
// THE ARM, NAMED. `--retreat losing` takes the break on the same condition the withdraw policy
// uses, and sits ABOVE it - so retreat is the first answer to a fight going wrong and withdraw
// is the fallback when the purse is short or the break fails. That is what the button is for: a
// fall-back keeps the node, a withdrawal gives it up. It measures WHAT TAKING THE DOOR DOES,
// under a policy that takes it whenever the squad is losing and can pay. It does not measure how
// often a player would. `off` stays the default so every figure on record stays comparable.
//
// Three careers an arm, 150 expeditions each, interleaved OFF/ON/OFF/ON/OFF/ON so machine drift
// falls on both. 900 expeditions.
//
//                             --retreat off          --retreat losing        D17
//   withdrawals per run       5.26 / 5.21 / 5.08     2.87 / 3.27 / 3.89      3/3, NO OVERLAP
//   runs that ended the road    20 /  21 /  15         24 /  15 /  15        direction reverses
//   reached sector 7            34 /  26 /  29         37 /  29 /  25        direction reverses
//   wipes per run             6.61 / 6.41 / 6.34     6.29 / 6.39 / 6.52      direction reverses
//   nodes cleared, median       80 /  77 /  75         77 /  75 /  74        3/3, ranges overlap
//   score, median            27.4k/ 23.4k/ 23.0k    27.6k/ 25.2k/ 23.4k      3/3, ranges overlap
//
// THE ONE ROW THAT SEPARATES IS THE ONE THIS POLICY MOVES BY CONSTRUCTION, and it is the control
// check rather than the finding - O11's lesson about the score multiplier, one phase later. The
// retreat sits above the withdraw branch and pre-empts it, so withdrawals MUST fall. They fall
// by about half, and the arithmetic ties out: 178-358 withdrawals avoided a career against
// 259-284 breaks that held. The arm does what it says, and the engine's own count agrees with
// this file's press for press (511/511, 487/487, 559/559) - the row prints MISMATCH if it ever
// does not, because a policy that silently does nothing is this project's oldest failure.
//
// AND WITH THAT SUBSTITUTION HAPPENING FIVE HUNDRED TIMES A CAREER, NOTHING DOWNSTREAM MOVES.
// Not one outcome row. Wins reverse direction, sector 7 reverses, wipes reverse, and the two
// that hold direction overlap. Wins move -0.7 on the mean against K06's measured floor of about
// 14 across three careers, which is not a reading at all.
//
// THIS IS A WELL-POWERED NULL RATHER THAN A QUIET ONE, which is the difference between this and
// a door nobody opened. The treatment is enormous: 487-559 presses a career, about 3.4 a run,
// half of them failing, and 87,500-106,900 scrap spent breaking off - roughly 700 a run, against
// a purse I01 measured at a median of 287 at a recruit node. A run spends more on breaking off
// than it holds at the moment it would sign a body, and the road is no deeper for it.
//
// WHY, AS MECHANISM RATHER THAN CONCLUSION: a fall-back re-faces the same node with the same
// squad, so the scrap and the fight it took to break off buy another attempt at the thing that
// was going badly. `nodes cleared` is slightly LOWER on the ON arm (77/75/74 against 80/77/75)
// and `fights per run` slightly higher (60/56/56 against 58/56/53), both consistent with paying
// a fight to re-take a node rather than walking on. The door is not broken and it is not a trap;
// it is a wash, and it was a wash at every depth the sample reached.
//
// NO DIAL MOVES. I01's retune stands - the door SHOULD be affordable, and a player who wants the
// node back should be able to buy the attempt. What is now on the record is that buying it is
// worth nothing measurable, so any future repricing of RETREAT has a baseline to move against
// rather than a guess. Whether a fall-back should do more than hand back the same fight - heal,
// or scatter the enemy, or cost the node's guard something - is a design question this measures
// the need for and does not answer.

// ── O-AUDIT: THE REPORT HAS TWO WORDS FOR ONE DENOMINATOR, AND USES BOTH ──────────
// O01-O15 are done, and the tree was audited the way F03, H, L, M and N were: look for a
// reading the instrument could not make, or did not make, but reported as though it had.
//
// ONE, AND IT IS THIS FILE'S OWN RULE BROKEN BY THIS FILE. `n` is results.length - the number
// of EXPEDITIONS in the sample - so anything divided by n is per expedition. A career, in the
// vocabulary this file uses everywhere else, is the whole sample: every measurement on record
// is described as "three 150-expedition careers". Eight report lines divided by n and said
// "a career"; seventeen divided by n and said "per run". Both spellings sit in one report
// eleven lines apart, on the identical computation:
//
//   operators put on the floor   125 (12.5 per run)
//   combos fired                 260 (26.0 a career)
//
// Measured rather than argued, because a word can be defended and a number cannot: the
// mitigate line reads 17,109 at --runs 4 and 16,272 at --runs 8. A career total would double.
//
// SO THE RECORD CARRIES BOTH MEANINGS AND THE READER CANNOT TELL WHICH. M11's own table prints
// "combos fired 3508" beside "(23.4 a career)", and 3508/150 = 23.4 - the total and the
// per-expedition figure on one line, the second wearing the first's name. Six header rows are
// corrected in place above, each marked ^^. N01's 17,003, M11's 23.4, #201's shortenings,
// #197's 117-137 and H13's 6.4 wipes were all per expedition; M01's "160-173 scars a career"
// and H03's "263 skulls over forty carried runs" were already career totals and are untouched.
//
// WHAT IS NOT AFFECTED, AND IT IS MOST OF IT: every ratio and every percentage. N01's THICK_HIDE
// at 14-20x, M11's pairing shares, K09's soak figures, O15's four buckets - the error divides
// out of all of them. What moves is absolute magnitudes, and only where the word was wrong.
//
// AND THE GUARD COULD NOT HAVE CAUGHT IT, because the guard stated the rule backwards. Suite
// 163's denominator row - written by N04 against "the rule rather than the spelling" - said
// "a line that divides by n is printing a per-career figure", so it accepted the wrong word as
// proof of compliance. Both halves are fixed: the rule now says what n is, and "a career" is
// refused on a line that divides by it. Two mutations: putting one "a career" back reds the new
// row at its line number, and stripping the scale word entirely reds the old one.
//
// TWO. NOTHING HAS EVER TAKEN A RETREAT. I01 moved perDepth 15 -> 6 and reported the retreat
// door opening from 25-28% affordable to 56-62% - and affordability is the whole of what was
// measured, because this file has no policy that presses the button. It says so at both sites
// ("Nothing here takes the retreat"), so this is an honest gap rather than a false claim, but
// it is a gap with a shape: WITHDRAW has an arm, retreat has none, and the engine already keeps
// runStats.retreats and runStats.retreatsFailed that no report reads because nothing generates
// them. A `--retreat` arm is one item, and it is the only way to find out whether I01 bought
// anything. NOT BUILT HERE - an audit that ships a measurement is an audit that stopped auditing.
//   ^^ BUILT AND ANSWERED BY O16, the item directly above. The arm exists, the blocker was one
//   line (I02 had already built engineOpened for it), and taking the door is a well-powered
//   null: 500 presses a career, 700 scrap a run, and not one outcome row moves. Marked rather
//   than deleted because the paragraph is why O16 exists - and because this is the SECOND time
//   in two items that an O-series closing line was answered by the item that followed it. The
//   first was O10's, marked the same way. A closing sentence written in the present tense goes
//   stale the moment the next item picks it up, and nothing in this file re-reads them.
//
// THREE, STATED CAREFULLY BECAUSE THE OBVIOUS VERSION IS WRONG. The bench job has been measured
// ONCE, and never on its own. G13 ran `--bench scout` bundled with `--tactics smart` and
// `--draft doctrine` as a single three-lever arm; nothing separated under D17 and the bound was
// the finding. So SCOUT, QUARTERMASTER and MEDIC have a door, it has been walked through, and
// what any one of them is worth is unmeasured. That is a smaller claim than "C10 shipped content
// nothing has ever exercised", which is what the flag default alone would have suggested.
//   ^^ ANSWERED by P01-P03, and the answer needed the row fixed first. --bench scout against the
//   default, three 150-expedition careers an arm: 20.67 -> 23.33 wins, +2.66, with nodes and
//   score medians moving the same way and NONE of it settling - this file's own bar for those
//   arms is about ten wins. The claim asked for the job to be run on its own and it has been; the
//   size is open and would take roughly twelve careers an arm. What the run found instead is
//   bigger than the pricing: the job is in force at 49-56% of fight doors, not the 100% the
//   muster-time row reported, so any earlier measurement through it would have been a blend.
//   Marked late, which is the rule this file states and I broke: P01-P03 cashed this claim and
//   committed without touching it, and the mark is a separate commit it should not have needed.
//
// WHAT THE AUDIT DID NOT FIND, stated because an audit that only reports hits is not an audit.
// The other never-named arms are documented at their definitions and deliberate: `--order long`
// says it is kept so figures predating orders stay comparable (worth knowing that every score in
// this repo describes a player on the longest of three orders, while the GAME defaults to
// PATROL - declared, not hidden); `--ending walk`, `--extract off`, `--stage 0` and
// `--reckoning off` each carry their reason. Ten runStats keys the report never reads -
// ascension, chapelUsed, contracts, doctrineMult, lastKiller, orderCut, retreats,
// retreatsFailed, scrapEarned, setsAnnounced - all have readers in game.js and are named by
// suites, so none is an L02-style dead field. frontsSeen IS read, and the fronts are drawn by
// the engine rather than forced, which is right. Exactly one assertion in 172 suites has a
// constant-true condition (159:152) and its comment says why it is a warning rather than a
// failure.
//
// AND ONE THING IT MISSED, added the same day. The paragraph here first read "no O-phase claim
// was found stale beyond the six scale labels above", and O10's closing line - "what a doctrine
// is WORTH is still unmeasured" - is stale, answered by O11 eleven lines above it in this file
// and marked there.   ^^ READ: this line QUOTES a claim rather than making one; the claim itself
//   is marked at its own site. The audit checked the arms, the dead fields and the denominators and never
// read the O-series' own closing sentences against the items that followed them. That is the
// fourth time this session a closing statement was broader than what was behind it, and the
// only one of the four I found by being asked a question rather than by running a check.

// ── O15: NO HANDS TRADES A THIRD OF THE SQUAD'S OUTPUT FOR A FIFTEENTH OF ITS SKIN ─────
// O12/O13 left LIGHT_ORDER and NO_HANDS measured at about seven wins below a default line, with
// the remedy a design call. Two directions were available - loosen what the card ASKS, or raise
// what it PAYS - and both were guesses. Priced instead.
//
// THE ASK IS NOT THE LEVER, and the measurement says so cleanly. LIGHT ORDER's cap is one
// constant: at 55 the only melee body under it is the Hound, at 65 the Shotgunner comes in, a
// real front-liner. Three careers an arm, --arrange front, against O13's on disk:
//
//   cap 55   15/17/10   14.00 wins    reachable by 120 of 720 arrangements
//   cap 65   16/18/13   15.67 wins    reachable by 336 of 720
//
// +1.67 wins, 3/3 in direction and overlapping in range - inside the +/- 2.4 this instrument
// states for an arm of three, so not separable from zero - bought by nearly tripling how many
// lines keep the card. A worse choice for a gain that cannot be measured. REVERTED; the constant
// is back at 55 and game.js carries no part of this.
//
// SO THE PAY, AND MY HYPOTHESIS THERE WAS REFUTED TOO. NO HANDS pays a fifth off enemy melee
// that reaches the front rank, and I expected that to be a thin slice of a big total. Nothing
// had ever counted it: the report splits incoming blows by damage TYPE and has never split them
// by the attacker's REACH, which is the axis this card is about. Stamped on the figure mitigate
// hands back and booked at the landing point - M08b's rule, and N01's bug if it is booked
// anywhere else. Two 150-expedition careers:
//
//   melee, onto the front rank    33.8% / 34.1% of damage taken   <- what the edge covers
//   shot,  onto a rank behind it  42.4% / 42.3%
//   melee, onto a rank behind it  13.0% / 12.7%
//   shot,  onto the front rank    10.7% / 10.9%
//
// The edge covers the largest single bucket of melee damage in the game and cuts a fifth of it:
// 6.8% of everything the squad takes, both careers. That is not a thin edge. It is worth about
// what a good relic is worth.
//
// AND THE OTHER HALF OF THE TRADE, ON THE SAME SCALE, WHICH IS THE FINDING. The card takes the
// squad's melee away. The squad's melee is 37.4% / 38.0% of the damage it deals.
//
//   NO HANDS gives up ~37.7% of output to get 6.8% off what it takes.
//     ^^ O19 WITHDRAWS THE 37.7%. The outgoing half of this census classified reach by asking
//     moveReachFor(pendingAction, ...) - and pendingAction is nulled at the top of processTurn
//     and after every resolve, so at the damage door it is routinely null or stale. mitigate is
//     handed abilityStr, the move actually being thrown; that is what it reads now. The INCOMING
//     four buckets are unaffected - they read attacker.range and gridPos, which are properties of
//     the bodies rather than a global - so 33.8-34.1% and the 6.8% stand. What the squad throws
//     in melee has to be re-measured, and with it the 5.5:1 shape this item concluded on.
//
// Lopsided about 5.5 to 1. Neither number is wrong on its own - the ask is a third of your
// damage and the pay is a real defensive edge - but the card is trading offence for defence in a
// game whose road is finished on about a third of runs, where a squad that hits softer mostly
// arrives at the same wall later with the same squad. That is a shape problem, not a dial
// problem, and it is why loosening the cap on its sibling bought nothing: both cards are priced
// on the wrong axis, and moving the price along that axis does not help.
//
// WHAT WOULD: an edge that returns OUTPUT rather than skin - the line gave up its swings, so
// what it still carries hits harder - or a defensive edge several times the current one. Either
// is a design call with a number behind it now rather than a guess. NO DIAL MOVES on this commit.
//
// AND THE CENSUS IS THE DURABLE PART, whatever is decided. "What reaches the squad" is four
// buckets the report has never printed, it is the denominator for every positional question
// after this one, and suite 170 holds it at the same door it holds THICK_HIDE's: forecasts and
// probes book nothing, every landed blow lands in exactly one bucket.
//
// TWO THINGS THIS ITEM GOT WRONG AND THE BATTERY CAUGHT, both worth the space because both are
// the same class of mistake this file keeps a list of.
//
// FIRST, I HAND-ROLLED THE ACCUMULATOR. Both censuses above walked the runs themselves and
// added each bucket's two keys by name - the exact shape M07, M08 and M09 each fixed once, and
// which the M-audit unified behind foldStats specifically so there would not be a fourth. Suite
// 163's class row - "and none is still hand-rolled" - fired on the first battery and printed
// the offending line back at me. (It scans for that shape by name, so this paragraph describes
// it rather than quoting it; quoting it fails the row, which is the row working.) Both are
// foldAll now, which is what it exists for and why it is written against a PATTERN rather than
// against the five accumulators that existed when it was written. The figures are unchanged:
// the same sum over the same per-run bags.
//
// SECOND, O14's FIX TO SUITE 101 WAS TOO STRONG BY ONE CASE, in the same shape as the bug it
// replaced. It branched on whether the body the save was taken on still had health AFTER the
// resume, reading a dead one as "fell before the save, so the fight stepped over it". That one
// reading covers two states and calls them both stepped-over:
//
//   the fight came back onto it, still up                      not charged
//   the fight came back onto it and its own turn-start bleed    not charged   <- reads as fallen
//     killed it on that turn
//   it was already down, the fight stepped over it onto ours        charged
//   ... onto a hostile, whose turn is not a squad turn          not charged
//
// Red once in three batteries on the second line. 40 runs of suite 101 staged the case twice,
// so it was forced in suite 03 instead - one point of health and a bleed - which is #209's
// method and the same method O14 used for the case it did find. All four states are held there
// now; 101 branches on WHERE THE FIGHT LANDED, which separates them and is what the row is
// named for. Three mutations: dropping the resume guard reddens 101 every time rather than
// intermittently, counting hostile turns as squad turns reddens the fourth state, and a bleed
// that cannot kill reddens the second.
//
// The pattern across both: a claim that is one case stronger than the thing it is named for.
// O14 recorded that lesson about the row it replaced and then made the same error writing the
// replacement.

// ── O13: A THIRD OF O12's COST WAS MY OWN DRAFT, AND THE OTHER TWO THIRDS ARE REAL ─────
// O12 measured LIGHT_ORDER and NO_HANDS at about ten and eleven wins below a default line and
// called both traps. The arm it measured them with takes the FIRST satisfying arrangement off a
// shuffled list. Those two cards constrain MEMBERSHIP only - any three bodies under the cap, or
// any three without melee, in any order - so the body standing at rank 1 was arbitrary, and with
// a Sniper in the pool it was regularly a Sniper. THE WALL is not that kind: its own rule demands
// the front carry melee and be the toughest, so every arrangement it accepts is already sensible.
// That is exactly why it made a clean control, and exactly why the comparison was unfair.
//
// `--arrange front` prefers, among the lines that hold, the one whose rank-1 body carries melee
// and is heaviest - THE WALL's own two tests, used to rank instead of to reject, so the standard
// is the game's rather than mine. Three careers of 150 an arm, against O12's on disk:
//
//                      wins (3 careers)   mean    vs baseline 21.33   sector 7   depth   score
//   THE_WALL  any        21/21/23        21.67        +0.33  overlap    34.3     4.00   26.1k
//   THE_WALL  front      22/27/19        22.67        +1.33  overlap    34.3     3.97   25.4k
//   NO_HANDS  any        10/ 9/11        10.00       -11.33  no         13.7     2.73   14.8k
//   NO_HANDS  front      14/12/17        14.33        -7.00  no         21.3     3.10   18.4k
//   LIGHT_ORD any        12/ 9/13        11.33       -10.00  no         16.7     2.90   15.3k
//   LIGHT_ORD front      15/17/10        14.00        -7.33  no         21.0     3.07   16.3k
//
// THE ARRANGEMENT IS WORTH +4.33 AND +2.67 WINS ON THE TWO CONSTRAINED CARDS AND +1.00 ON THE
// WALL - and that last figure is the control on the new arm itself. Preferring a good front rank
// where the card already forced one buys about a win, which is the residual; where the card
// forced nothing it buys three to four. So roughly a third of what O12 charged these cards was
// the harness drafting badly on their behalf.
//
// THE OTHER TWO THIRDS ARE THE CARDS. Seven wins each, still 3/3 with no overlap against the
// baseline, and the depth rows move with them - sector 7 back from 13.7 and 16.7 to 21.3 and
// 21.0, against a baseline of 33.0. A player who builds for either of these and arranges it as
// well as the game's own best-front rule allows still finishes the road a third less often than
// one who drafts a Bruiser and gets on with it.
//
// WHAT THIS CORRECTS AND WHAT IT DOES NOT. O12's direction, its control, its mechanism (these
// lines stop sooner rather than dying faster) and its "trap" reading all stand. Its magnitude was
// overstated by about a third, because an arm that picks arbitrarily among satisfying lines is
// not the player the finding is about. The O12 record keeps its numbers with a correction marker
// rather than being rewritten, which is what this file did for THICK_HIDE.
//
// AND THE GENERAL FORM IS WORTH MORE THAN THE ITEM. A policy arm that satisfies a constraint is
// not the same as a policy arm that satisfies it WELL, and the difference is a third of the
// effect here. Where a card constrains membership and leaves arrangement free, the arrangement
// has to be named as part of the arm - the same discipline as naming the denominator, the scale
// and the arm itself, one level further in.
//
// NO DIAL MOVES.

// ── O12: THE TWO CARDS NOBODY TAKES ARE TRAPS, AND THE ARM THAT PROVED IT WAS BROKEN ───
// O10 found LIGHT_ORDER and NO_HANDS offered 70-76 times in 150 expeditions and live zero, and
// established they are keepable by 120 of 720 lines - so the zero is the draft, not the game.
// The question that leaves: a player who WANTS one has to give up the front rank. Is that a
// choice or a trap? Four arms, three 150-expedition careers each.
//
//                        baseline      THE_WALL      NO_HANDS      LIGHT_ORDER
//   runs that ended road  19/23/22      21/21/23      10/ 9/11      12/ 9/13
//   reached sector 7      27/34/38      33/38/32      16/12/13      16/14/20
//   deepest sector, mean  3.60/4.00/4.00 3.90/4.00/4.10 2.90/2.50/2.80 3.10/2.70/2.90
//   nodes cleared, median 73/78/75      74/74/79      69/65/64      69/69/67
//   wipes per run         6.22/6.18/6.37 6.15/6.37/6.33 6.49/6.16/6.01 6.61/6.41/6.27
//   score, median         24.4/25.9/24.5k 26.2/25.0/27.0k 17.0/13.1/14.5k 18.4/13.7/13.8k
//
//   means                 21.33 wins    21.67         10.00         11.33
//   ^^ O22 CONFIRMS THE NO_HANDS COLUMN on a repaired instrument, and refutes the reason I
//   expected it to move. O21 found the card dark at four doors in five on this very arm, so the
//   -11.33 looked like a handicap charged without its compensation; re-measured with the card
//   live 85-91% of the time the gap is -11.67. Do not read the ABSOLUTE numbers across the two
//   items - the baseline is 17.00 now against 21.33 here, because the wall has been re-cut since
//   - only the paired gap, which is what both arms were run for.
//   wipes per NODE        0.0831        0.0831        0.0942        0.0941
//
// BOTH ARE TRAPS AND THE CONTROL IS WHAT SAYS SO. THE_WALL, built around deliberately in exactly
// the same way, is indistinguishable from the default line on every row - 21.67 wins against
// 21.33, ranges overlapping, and wipes per node identical to four decimal places. So "building
// around a doctrine" costs nothing. The two cards that forbid the front rank cost about eleven
// and ten wins, half the win rate, a third of the depth and 40% of the score, 3/3 with no
// overlap on every depth row.
//   ^^ THE ELEVEN AND TEN ARE OVERSTATED BY ABOUT A THIRD AND ARE LEFT STANDING SO O13 HAS
//   SOMETHING TO POINT AT. This arm takes the FIRST satisfying arrangement off a shuffled list,
//   and these two cards constrain membership only - so the body at rank 1 was arbitrary, and
//   regularly a Sniper. THE WALL made a clean control precisely because its own rule forces a
//   tough melee front, which is the asymmetry that makes the comparison unfair. Arranged well,
//   the cost is about seven wins each rather than eleven and ten. The direction and the "trap"
//   reading survive; the magnitude does not. See O13.
//
// THE MECHANISM IS IN THE LAST TWO ROWS AND IT IS NOT WHAT I EXPECTED. Wipes per RUN is flat
// across all four arms - these lines do not go down more often. They clear nine fewer nodes
// while going down the same number of times, so they go down more often PER NODE OF PROGRESS:
// 0.094 against 0.083, and the two arms agree to three decimal places with each other. A line
// with no heavy body at the front does not die faster; it stops sooner.
//
// AND THE CONTROL ARM WAS BROKEN THE FIRST TIME, which is the other half of this. Three careers
// of `--draft doctrine:THE_WALL` ran to completion reporting a deepest sector of 1, 0 commanders
// and 0 elites - with G13's own guard firing on every one: 150 of 150 RUNS FIELDED NOBODY.
//
// The cause is G13's bug in a door G13 did not close. A doctrine is a predicate on the WHOLE
// line; building one legal member at a time asks holds() of every PREFIX, and THE WALL asks who
// holds rank 1 before any rank is handed out. G13 diagnosed exactly that, rewrote the pooled
// `--draft doctrine` branch to build-place-then-ask, and left the identical test in `--draft
// doctrine:<id>` TEN LINES ABOVE ITS OWN FIX, in a comment that names THE WALL as the case that
// breaks. Two of seven doctrines were unmeasurable through that flag and nothing said so until
// an arm was pointed at one.
//
// Fixed as one helper both callers use, so a third copy cannot drift in - and the named-doctrine
// arm now records an unfieldable card rather than fielding nobody, which the pooled branch
// already did. BROAD_SPECTRUM, the other whole-line predicate G13 named, was equally broken and
// is equally fixed.
//
// THEN THE SUITE ROW WRITTEN TO HOLD THAT FIX FOUND A THIRD COPY. The tail that tops up a short
// draft carried the same prefix test. It was dormant - only the policies that never set a wanted
// doctrine leave a short draft, so the filter never ran - and dormant is not harmless, it is the
// copy nobody re-reads. Dropped. My own fix was incomplete and the row I wrote to hold it is
// what said so, which is the whole argument for asserting a property about duplicated logic on
// the source rather than trusting a careful edit.
//
// NO DIAL MOVES. Two of seven doctrines charge about half a career's wins for the line they ask
// for, and whether that price should come down - or the cards should ask for less - is a design
// call with the wall behind it. What is established is that it is a price and not a shrug, and
// that a player taking either one is not making the trade the card implies.

// ── O11: WHAT A DOCTRINE IS WORTH - THE SCORE MULTIPLIER, AND NOTHING THAT SEPARATES ───
// G13 ran the doctrine lever bundled with two others and nothing separated; O10 closed with the
// question still open. Answering it needed an arm this file did not have. The DEFAULT is not a
// doctrine-free control - `--draft line` banks one opportunistically on 120 of 150 runs - and
// `--draft random`, which skips the bank, changes the draft too, so its difference carries a
// different line as well as a missing multiplier. `--doctrine off` withholds only the TAKE: the
// same draft, the same line, the same three offers rolled and read, nothing banked.
//
// Three careers an arm, 150 expeditions each, interleaved ON/OFF/ON/OFF/ON/OFF so machine drift
// falls on both - the G13 discipline. 900 expeditions.
//
//                             doctrine ON              doctrine OFF        D17
//   doctrines taken           120 / 123 / 117          0 / 0 / 0           (the arm works)
//   runs that ended the road   19 /  23 /  22         19 / 21 / 18         direction reverses
//   reached sector 7           27 /  34 /  38         31 / 34 / 31         direction reverses
//   wipes per run            6.22 / 6.18 / 6.37     6.36 / 6.19 / 6.76     3/3, ranges overlap
//   nodes cleared, median      73 /  78 /  75         76 / 73 / 79         direction reverses
//   score, median            24.4k/ 25.9k/ 24.5k    20.6k/ 21.5k/ 22.9k    3/3, NO OVERLAP
//
// ONE ROW SEPARATES AND IT IS THE ONE THE MULTIPLIER IS APPLIED TO. computeScore multiplies by
// st.doctrineMult directly, so a score gap is the first thing a doctrine buys by construction
// and the last thing that should be read as an effect. Priced rather than waved at: the 360
// doctrines actually taken carry a weighted mean bonus of 0.1352, read off game.js's own table
// against the take counts, and they land on 80% of runs so the median run in the ON arm carries
// one. That predicts +13.5% of score. The observed lift is +15.1%. The residual is 1.6 points
// against per-career medians that themselves range over 6%.
//
// SO THE SEVEN EDGES ARE A NULL AT THIS SAMPLE. Wipes per run moves 6.44 -> 6.26, the doctrine's
// way, three times out of three - and the ranges overlap, which is the same disposition M10
// reached on the overdrive fork and K11 on the augment cap. Wins move +2.0 against K06's
// measured floor of about 14 on three careers, and do not hold direction. Nodes cleared moves
// the WRONG way. Nothing here is an effect; the honest ceiling is "worth less than the noise".
//
// AND THE ARM HAS A NAME, which is the whole of O10's lesson. This measures THE MIX THIS POLICY
// TAKES, and that mix is not the table: OLD_GUARD and THE_WALL are ~72% of every career's takes,
// FIELD_SURGERY and CONSCRIPTS are a handful each, and LIGHT_ORDER and NO_HANDS are taken ZERO
// times because the default draft opens on a body that fails both. Two of the seven edges never
// ran in any of these 900 expeditions. "Doctrines are a null" would be wrong; what is measured
// is that OLD GUARD's +10% on veterans and THE WALL's opening brace, at the rate this policy
// takes them, do not move survival at three careers an arm.
//
// THE D06 CHECK, RUN BEFORE PUBLISHING THE NULL. A null measured over an edge that never fires
// is not a null. Six of seven edges were already held - THE WALL's brace and OLD GUARD's 10% in
// suite 79, LIGHT ORDER's speed, FIELD SURGERY's patch and CONSCRIPTS' doubled XP in 59,
// BROAD SPECTRUM's seam in 79. NO HANDS' 80% was held nowhere; it is now, exactly, on mitigate's
// own figure, with the half the engine's comment states and nothing checked - that giving up
// reach does not also buy cover. Held by three mutations.
//
// (I first wrote that TWO edges were unheld, THE WALL's among them, off a grep that searched for
// the wrong words. Four rows at 79:157-161 hold it. Corrected before it reached the record, and
// noted because a claim about what is not tested is exactly as checkable as any other.)
//
// NO DIAL MOVES. A doctrine pays 13.5% of score and an amount of survival this instrument cannot
// resolve from zero. Whether that is the right price is a design call and score is a real
// channel, not a readout - the same reason O04 censused the relic shelf and stopped.

// ── O10: THE DOCTRINE CENSUS, READ AT LAST - AND TWO DEAD CARDS THAT ARE NOT DEAD ──────
// This block has printed since G13 and nobody had ever run it and written the numbers down. The
// first 150-expedition career taken of it, default policy:
//
//   musters with a live offer   114 of 150        runs that took one       114 of 150
//   offers live, mean of 3      1.03              still keeping it at end  114 of 114
//
//   OLD_GUARD        offered 62, live 61  (98%)   THE_WALL      offered 55, live 50  (91%)
//   BROAD_SPECTRUM   offered 56, live 22  (39%)   FIELD_SURGERY offered 68, live 17  (25%)
//   CONSCRIPTS       offered 63, live  5  ( 8%)   NO_HANDS      offered 76, live  0
//   LIGHT_ORDER      offered 70, live  0
//
// Read flat that is two doctrines dead in a hundred and fifty expeditions and, at 1.03 live of
// three cards offered, barely a choice at the muster.
//
// IT IS D05's TRAP AND I NEARLY FILED IT. `--draft line` opens every muster on a BRUISER or a
// SHOTGUNNER and then takes a MEDIC 70% of the time. NO_HANDS forbids melee and both openers
// carry it. LIGHT_ORDER caps the line at 55 health and a Bruiser is 80. FIELD_SURGERY forbids a
// Medic. Three of the four lowest rows have one cause and it is this file's first pick.
//
// The question a career cannot answer is whether a line EXISTS that keeps each card, and that
// one needs no sampling: ten classes, 120 three-class lines, six arrangements each, against each
// doctrine's own holds(). Shipped as suite 172 and measured there rather than estimated here:
//
//   FIELD_SURGERY  504 of 720      BROAD_SPECTRUM  234      CONSCRIPTS  210
//   THE_WALL       170             NO_HANDS        120      LIGHT_ORDER 120      OLD_GUARD 6
//
// NO_HANDS and LIGHT_ORDER are keepable by 120 arrangements each - a sixth of the space - and go
// live zero times. Nothing is wrong with either card. What the census measures is the draft.
//
// AND THE FIRST CUT OF THAT ENUMERATION FELL INTO THE SAME TRAP FROM THE OTHER SIDE, which is
// the part worth keeping. Built on level-1 bodies with an empty career it reported OLD_GUARD
// keepable by NO line and CONSCRIPTS by EVERY line. Both are the fixture: OLD_GUARD reads
// masteryRank off career mastery, CONSCRIPTS reads doctrineFavourites off fielding history, and
// an empty save makes the first impossible and the second free. Judged instead at the state each
// one's own offerable() gate waits for, they come back 6 and 210 - and 6 is right, because three
// veteran classes make exactly one line, six ways round. I caught D05's trap in the career and
// walked into it in the instrument built to check the career, inside an hour.
//
// WHAT SHIPPED. The census line now NAMES ITS ARM - "live = the offer THIS draft policy's line
// could keep - draft line" - which is the fix N04 and D06 each got for the same reason, and the
// one sentence that stops the next reader filing what I nearly filed. Suite 172 holds the
// property the career cannot see: every card in the table is keepable by some line, and none is
// keepable by every line. Held by three mutations - a health cap below every class in the game,
// a rule inverted to hold on everything, and a lowered offer gate.
//
// AND MUTATING THAT GATE FOUND A REAL COUPLING NOBODY HAD WRITTEN DOWN. OLD_GUARD_VETS is how
// many classes must reach veteran before the card is offered; holds() then asks all DEPLOYED
// line slots to be veterans. At OLD_GUARD_VETS = 2 the muster offers a card a two-veteran save
// can never keep - the exact offerable-but-unkeepable state the table's own comment says the
// composition doctrines were added to end. The constants are three lines apart and neither
// mentions the other; they are equal today and that is the only reason the card works. Pinned.
//
// NO DIAL MOVES, AND THE DRAFT POLICY IS LEFT ALONE ON PURPOSE. `--draft line` is the default
// precisely so runs measured before doctrines existed stay comparable, and `--draft doctrine`
// already exists for the other question. What a doctrine is WORTH is still unmeasured: G13 only
// ever ran it bundled with two other levers, where nothing separated under D17.
//   ^^ ANSWERED BY O11, the item directly above, which built the `--doctrine off` control and
//   priced it at +13.5% of score by construction and a null on everything else. Marked rather
//   than deleted because the sentence is why O11 exists. Found while answering "what is left" -
//   the O-audit one commit earlier closed with "no O-phase claim was found stale beyond the six
//   scale labels", and this is one, sitting eleven lines below the item that answers it.

// ── O08: THE WOUNDED RUN IS ALREADY BUILT - AND WHY FOUR PITCHES IN A ROW WERE WRONG ───
// Filed as a phase: 71% of runs wipe, so the middle of a collapsing run is the most-played part
// of the game and the least designed - triage, carrying wounded, choosing what to abandon.
// REFUTED on evidence already in this file and this report, before any new measurement.
//
// INSIDE THE FIGHT, over 150 expeditions: 2,879 operators go on the floor (19.2 a run) and 2,311
// are dragged clear (15.4); 704 are lost for good (4.69). The squad spends 4,911 turns picking
// people up, and of the 6,016 turns taken with somebody down, 80% had a way to reach them. The
// rescue game is not missing, it is most of what a losing fight consists of.
//
// AND THE MONOPOLY WAS ASKED AND ANSWERED. The report reads 88% of rescues as the STIM tactic and
// 5% as the medic's hands, which looks exactly like one button. H05 built `--rescue hands` for
// precisely that suspicion and measured it: 87/7/6 becomes 65/16/20 with the ordering reversed,
// complete separation, so the share was this file reaching for the bar first. What the GAME
// offers is unchanged between arms - the bar reaches 71-75% of down-turns, a deck move 16-20%,
// the bag 13-21%. And bar-first is half a sector deeper: the dominant tool dominates because it
// is the renewable one and spending it first keeps the bag full. H05 shipped nothing and was
// right to.
//
// LEAVING THE FIGHT IS ALSO BUILT AND ALSO USED: 4.75 withdrawals a run, 5.75 regroups spent,
// 4.91 fallbacks deployed with, and a retreat on the table 713 times at 62% affordable after I01
// opened that door. Losing is a sequence of decisions roughly five times a run.
//
// ── AND THE PART WORTH KEEPING: FOUR PITCHES, FOUR REFUTATIONS, ONE CAUSE ──────────────
// O03, O06, O07 and this one came out of a single brainstorm and every one failed the same way.
// They were generated FROM THIS REPORT'S SUMMARY LINES without checking those lines against what
// the file already records:
//
//   O03  "0% of points buy a capstone"      a door attribution; capstones are bought 3.3 a run
//   O06  "58% of forks are all fights"      62% of those offer two DIFFERENT factions
//   O07  "46% of steps are forced"          the fix trades against a bound a suite already sets
//   O08  "88% of rescues are one button"    H05 measured it as the harness's own ordering
//
// A report line describes a measurement someone already took for a reason. Read as a gap, it is
// an invitation to re-file work that is done. THE CHECK THAT WOULD HAVE CAUGHT ALL FOUR is one
// grep of this header and the item list for the system being pitched, BEFORE the pitch - not
// after, when a career has been spent measuring it.
//
// That is not an argument against reading the report for ideas. Three of the four turned up
// something real on the way - a mis-worded line fixed in O03, a census shipped in O06, a coupling
// nobody had measured in O07. It is an argument for spending five minutes on the record first,
// because the difference between "nobody has looked at this" and "somebody looked and wrote down
// why not" is the whole value of having written it down.

// ── O07: THE MAP'S LOPSIDEDNESS IS LOAD-BEARING, AND THE ONE-NUMBER DIAL IS TWO ────────
// O06 left "the road is corridor too often" with what looked like a single dial: the edge
// extension in generateSectorMap, `if (hi + 1 < b.length && rng() < 0.5)`. Building it found the
// extension reaches ONE WAY ONLY - it offers b[hi + 1] and never b[lo - 1] - so a node already at
// the right of its tier cannot gain a fork at all. Measured over 4,000 generated maps:
//
//   single-exit nodes, by position in their tier     left 39.5%   middle 37.6%   RIGHT 71.6%
//
// The rightmost node of a tier is a forced step nearly twice as often as the leftmost, from
// geometry rather than from any roll. That looks exactly like a defect, and fixing it is two
// lines. It is not a defect.
//
// WHAT THE SUITE CAUGHT. 87-recruit-routing asserts that 10-30% of tier 2-9 nodes are reachable
// from ONLY ONE of the two tier-1 openings - the map has to commit you to something, or the first
// choice of a run means nothing. A symmetric extension at the same 0.5 drops that to 7.8% and the
// battery goes red. Swept against both constraints at once:
//
//   shape         p     forced%   left%   right%   one-opening%   (bound 10-30)
//   right-only   0.50    51.7     39.5    71.6        17.8         <- today
//   symmetric    0.50    38.1     41.4    41.3         7.8   OUT
//   symmetric    0.30    49.2     52.7    52.8        13.1
//   symmetric    0.25    52.1     55.4    55.5        14.8
//   symmetric    0.20    55.0     57.8    57.8        17.3
//
// THE BIAS IS WHAT MAKES THE COMMITMENT. Concentrating every extension on one side is what makes
// reachability asymmetric, and asymmetric reachability IS the one-opening share. Hold commitment
// where it is today (17.8%) and a symmetric road needs p = 0.20, which leaves it MORE corridor
// than it is now - 55.0% against 51.7%. Hold the corridor rate where it is and commitment falls
// to 14.8%. There is no setting that buys both, so the lopsidedness is not a bug sitting next to
// the dial; it is the other half of the dial.
//
// SO #1 IS NOT A ONE-NUMBER CHANGE and the pitch behind it was wrong in the same way O06's was.
// "Fewer forced steps" and "your first turning matters" are the same knob pulling opposite ways,
// and picking a point on that curve is a design call with a target behind it - the owner's, like
// J04's plate and O01's scar price. NOTHING SHIPPED; game.js is byte-identical to before.
//
// WORTH KNOWING IF ANYONE RETURNS TO IT: the curve above is the whole decision, already measured.
// A road that is both less forced AND still committing needs a different mechanism - exclusivity
// that does not come from geometry, such as a node that shuts a branch behind you - rather than a
// number moved on this one.

// ── O06: THE ROAD'S FORKS, COUNTED - AND "FIGHT NODES DO NOT DIFFER" IS REFUTED ────────
// Scoping a phase that would give factions a memory of you, on the premise that fight nodes do
// not differ so the 58% of routing decisions that are all-fight are not really decisions. The
// premise is wrong, and the number that was supposed to support it says something else.
//
// 12,265 routing decisions over 150 expeditions, bucketed by what was actually on the table.
// The four buckets are exclusive and sum to the total, which is how they should be read:
//
//   a forced step, one node           5,624   46%
//   a fight against something else    2,887   24%
//   fights whose factions differ      2,346   19%
//   the same faction twice            1,408   11%
//
// FIGHT NODES DIFFER, AND THE ROAD OFFERS THE CHOICE. Of the forks carrying two or more fights
// and nothing else, 62% put two DIFFERENT factions side by side - a different pool, formation,
// ground and sky in each. H11 established the faction-formation tie; this says a player meets it
// as a choice rather than as a sequence. So the phase's premise is refuted before it was built.
//
// A NUMBER I DERIVED AND HAD TO GO BACK FOR. The first pass at this table was computed from an
// earlier instrument's buckets rather than printed by this one, and it was wrong twice over: it
// put the forced step at 33% by assuming every single-node fork was a fight, when a lone CAMP or
// SHOP is just as forced, and one of its four rows was an inference with no measurement under it
// at all. Re-run against the census above, every figure here is one the report printed.
//
// THE REAL SHAPE IS THE FORCED STEP. NEARLY HALF of every routing decision in the game offers
// exactly one node. availableNodeIds returns the current node's edges, so that is a node with a single
// exit, and generateSectorMap says where they come from: tiers are 2 or 3 wide, edges are a
// proportional window, and the window is ONE node wide whenever the two tiers are the same width
// - widened by `if (hi + 1 < b.length && rng() < 0.5) src.edges.push(...)`. The generator's own
// comment calls that extension "the forks that make routing a real decision instead of a
// corridor". It is a deliberate density knob sitting at 0.5, and at 0.5 nearly half the road is
// corridor. The convergence onto the boss at the last tier is forced by design and is part of it.
//
// SO THE DIAL EXISTS AND IS ONE NUMBER. Nothing moves on this commit - raising it lengthens every
// run's options and would move the wall, which is the owner's call - but "the road is not a
// decision often enough" now has a measured size and a single place to change it.
//
// WHAT IS LEFT OF THE ORIGINAL IDEA, stated so it is not quietly dropped: the choice between two
// factions exists but carries NO MEMORY. There is no per-faction state anywhere in the engine -
// FACTIONS holds bg, weather, ground, allies and a couple of caps, and `allies` is read only by
// N14's deep-tier pool mixing. Standing is per-CAST, not per-faction. So fighting the Choir all
// run changes nothing about the Choir. That is a real phase, but it is about giving an existing
// choice consequence rather than creating one, which is a different pitch from the one filed.
//
// SHIPPED: the four-way fork census above, because "58% all fights" was the line that made the
// wrong pitch sound right, and a corridor and a crossroads should never read the same again.

// ── O05: THE ELITE OFFER WAS BUILT, MEASURED, AND REVERTED - AND IT PRICED THE CHANNEL ─
// O04 found 56% of the relic shelf arriving from elites as a die roll with nothing asked. The
// change that followed from it: hand over TWO cards instead of one, so the biggest channel asks
// something, with the commander's three kept bigger so the hierarchy the file states survives.
// Two cards and not three, and the count deliberately NOT cut - a game that wipes 71% of runs is
// not one to take relics away from, so the intent was to change whether the player chose, not
// how much they got.
//
// ONE TRAP AVOIDED IN THE BUILDING, worth keeping even though the change went back. The obvious
// implementation is rollRelicOffer(2), and it is wrong: that builder SEEDS A RARE FIRST by
// construction, so an offer built from it hands a rare-preferring player one every time - a 30%
// rare rate turned into 100% and called "a choice". A separate draw at rollRelic's own odds puts
// a rare on at least one of two cards 51% of the time, which is what choosing is actually worth.
//
// IT DID NOT INTEGRATE AND THE ARM SAID SO IMMEDIATELY. The elite branch lives inside
// checkWinState and set pendingRelicOffer, which the engine shows through afterNode - a path
// this file does not take, since it calls bankNode rather than collectLoot. The offers were
// staged and never picked up. One career, against the O01 baseline:
//
//                             baseline (3 careers)      the broken arm (1)
//   relics held, mean          10.6                     4.8
//   relic offers seen          2.47 a run               2.21 a run   <- never rose
//   runs that ended the road   21 / 19 / 17             9
//
// AND THAT ACCIDENT PRICED THE CHANNEL, which is the one thing worth keeping. Destroying the
// elite relic destroys 5.8 relics a run - which reconciles with O04's census of 5.6 FIGHT_DROPs a
// run, so the arm really did remove that channel and nothing else - and the career that lost them
// ended the road 9 times against a baseline of 21/19/17. ONE CAREER, so the win figure is
// suggestive rather than established (K06 resolves +/-4.2 on one). The relic count is a census
// over a whole career and reads at that size.
//
// Which settles a question the brainstorm had open: the first instinct was to make the elite drop
// RARER so the commander's offer would dominate. Had that shipped it would have cut a channel
// carrying half the shelf and, on this evidence, a large share of the wins. The channel is
// load-bearing. Anything done here has to keep the count and change only the asking.
//
// REVERTED. game.js is byte-identical to before the attempt; what stands is O04's census and this
// price. Re-doing it needs the offer plumbed through a path the harness actually walks, which is
// its own piece of work rather than a line in the elite branch.
//   ^^ ANSWERED by O05b. The resolver was lifted out of the commander branch to the node - that
//   was the whole of the path - and the elite drop is a defaulted-off lever now, armed and proven
//   (0 offers staged off, 5.00-5.69 a run on). Nothing separates on wins, score or nodes, and the
//   relic COUNT is intact at 10.20 -> 10.57, which was the one thing O05 said must not move. The
//   asking is free; taking it is the owner's call.

// ── O04: WHERE THE RELIC SHELF COMES FROM, AND IT IS NOT THE DECISION ──────────────────
// A run ends holding 10.6 relics of a pool of 20, and every non-cursed one lands in 67-86% of
// runs - so two runs end with nearly the same shelf and a relic is a collection rather than a
// build. Before proposing scarcity, the obvious question: 2.5 commander offers a run cannot
// supply ten relics, so WHERE DO THEY COME FROM. Tagged at every acquisition site in the engine,
// 150 expeditions, 1,498 relics:
//
//   FIGHT_DROP        834  56%   an elite node, unconditional
//   COMMANDER_OFFER   371  25%   three cards, pick one - the only one that is a decision
//   CITADEL_CACHE     140   9%   stocked at the muster
//   EVENT_DRAW2       114   8%   one event, two relics at once
//   shop, three paths  39   3%   260 scrap, 180 scrap, and a shelf item
//   MAGPIE x3, CITADEL_SPOT, CAMP_CACHE   0   not reached by this policy
//
// FIFTY-SIX PER CENT OF THE SHELF IS A DIE ROLL NOBODY MAKES. `if (isCurrentNodeElite) { const
// rDrop = rollRelic(); ... }` - no chance gate on the relic itself, one per elite cleared, and
// rollRelic's pool filters CURSED out, so the largest channel is all upside with no decision and
// no cost attached. The channel that IS a decision, the commander's three cards, is a quarter of
// what a run ends holding.
//
// The engine says this about itself two lines under the drop: "A commander is worth a decision
// rather than a die roll, so it hands over three". The distinction is already the design's; the
// die roll is simply the bigger supplier.
//
// WHAT IS THE GAME AND WHAT IS THE ROBOT. The structure is the game's: an elite hands over a
// relic with nothing asked. The RATE is this policy's - it takes 1,303 of 1,379 elites offered
// (94%), and a player who routes around elites sees fewer. So "56%" is the share under a squad
// that fights everything; the shape - that the biggest channel asks nothing - holds at any rate.
// 834 drops from 1,303 elites is 64%; the other 36% found the pool already empty and paid scrap.
//
// NOTHING SHIPPED ON THIS COMMIT. The census is the deliverable and any change here moves the
// relic economy, which moves the wall, and the wall's target is the owner's - the same reason
// J04 and O01 recorded and stopped.

// ── O03: THE CAPSTONE NOBODY BUYS IS BOUGHT 3.3 TIMES A RUN ────────────────────────────
// Filed off two lines of this report as a dead feature - "90% of points on a stat card, 10% on a
// signature, 0% on a capstone" beside "3.21 taken on promotion, 0.00 bought at the Outpost" - and
// REFUTED by the first measurement taken of it. Both halves of that second line are PURCHASES AT
// THE SAME PRICE. assignPerk charges capstoneCost() whichever door the card came through, so the
// 0.00 is a door attribution and not a feature nobody buys.
//
// Instrumented at the moment a banked point is in hand, every reason exclusive, 150 expeditions:
//
//   levelShort   5522  (90%)   the body is under CAPSTONE_LEVEL
//   alreadyHas    640  (10%)   at the gate, forks shut - and holding the capstone already
//   forksOpen       0          never once the blocker
//   tooDear         0          NEVER ONCE unaffordable
//   bought          0          which is the row that started this
//
// THE PRICE IS NOT THE GATE AND NEVER WAS. Zero of 6,162 opportunities were open-and-unaffordable,
// so any proposal to cut CAPSTONE_BUY_BASE would have moved a number that was already never read.
// The mechanism is order, not economy: rollPerkOffer puts the capstone FIRST the moment it opens,
// and this file's promotion policy takes it first by name, so by the time the Outpost loop runs
// the trait is held and capstoneOpen is false. The shelf never sees one still open.
//
// THE SHELF IS STILL REACHABLE FOR A PLAYER, which is the part that keeps this from being a bug.
// capstoneOpen shuts on holding the trait, not on having been offered it, so a player who
// DECLINES the capstone at the promotion screen finds it on the Outpost shelf afterwards. What is
// unreachable is the shelf under a policy that always takes it at the first door - and that is
// this harness's taste, not the game's shape. D05's trap, and I walked into it filing the item.
//
// WHAT SHIPPED IS THE WORDING. "taken on promotion" against "bought at the Outpost" reads as free
// against paid; it is the sentence that produced this whole item. Now "through the promotion
// screen / off the Outpost shelf - same card, same price". An instrument that invites a misreading
// is an instrument bug, the same class as N04's unnamed scale and D06's unnamed arm.
//
// NO DIAL MOVES. CAPSTONE_LEVEL and CAPSTONE_BUY_BASE both stay.

// ── O01: BOTH PARKED DIALS RE-MEASURED, BOTH LEFT ALONE - AND ONE MOVED ON ITS OWN ────
// The two balance calls parked for the owner, measured on the current tree before anything was
// touched. Three careers of 150, default policy (perks random, draft line, order long), taken
// on the tree at fe128ab:
//
//                            c1        c2        c3       mean
//   runs that ended the road  21        19        17       19.0
//   scars dealt              196       195       227       206   (1.31 / 1.30 / 1.51 a run)
//   treated at the Outpost   54%       53%       53%        53%
//   plate share, sector 1     41.2%     39.1%     38.2%
//   plate share, sector 7     16.0%     14.4%     18.4%
//
// THE SCAR DIAL MOVED WITHOUT ANYBODY TURNING IT, which is the finding here. M03b left this at
// 67% treated (range 66-69 over 160-173 scars a career) with the design question stated: "whether
// 67% is low enough is a design question, and the dial is SCAR_TREAT_SKULLS". It is now 53%
// (range 53-54 over 195-227), and the ranges do not overlap. Nobody edited the price.
//
// The cause is the numerator, not the purse: SCARS PER RUN ROSE about 20%, from 1.07-1.15 to
// 1.31-1.51, while the price stayed at 40 skulls. More scars arriving at the same cost means a
// smaller share of them gets bought off. So M03's goal - a scar that is a decision rather than a
// scrap tax - was reached further by drift than the commit that aimed at it, and the question
// M03b left open has answered itself at 53%.
//   ^^ READ: not an open claim - the sentence records the answer.
//
// SCAR_TREAT_SKULLS STAYS AT 40, at the owner's call. Turning it now would be tuning on top of a
// drift nobody has decided to keep, and the lever is pointed the right way already.
//
// THE PLATE RE-CONFIRMS J04 ON A MUCH-CHANGED TREE. 38.2-41.2% of a hit at sector one falling to
// 14.4-18.4% at sector seven, against J04's 34% -> 14% measured before M04 through N07 shipped. The
// middle sectors are noisy at one career each (c3 reads 42.1% at s5, above its own s1) and should
// not be read as a curve; the two ends are what three careers agree on. Same
// shape, both ends slightly higher. J04's disposition holds and for a stronger reason than it had:
// making the plate keep pace at depth hardens exactly the sectors a run already struggles to
// reach. NOTHING RETUNED, at the owner's call.
//
// AND A CORRECTION I MADE BEFORE THE NUMBERS WERE IN. Career one read 21 runs that ended the road
// and I took it for a collapse against M04b's 34.7, which would have been a 14-win regression.
// M04b's 34.7 IS THE MATCHED-PICK ARM. The default is `perks random`, whose own note says "`random`
// is the default and stays the baseline", and its recorded figure is 25.0 from arms of 28, 21, 26.
// Against that, 19.0 from 21, 19, 17 is a gap of six wins with the ranges touching - inside K06's
// ~14 floor, and NOT a regression. Comparing a default-arm run to an arm-specific figure is the
// same denominator error D05, D06, M06 and M08b were each filed for, committed here against this
// file's own table.
//
// A THIRD SIGHTING OF THE SMOKE-SAMPLE TRAP, and it is worth a rule. A 40-expedition smoke read
// the treated share at 11% against 53% at 150 - a fivefold understatement, not noise. The cause is
// structural rather than statistical: SKULLS ACCUMULATE ACROSS A CAREER and the Citadel is the
// competing sink, so a short career spends every skull on upgrades and never holds the 80 the
// policy wants, while a long one maxes the Citadel and banks the rest for scars. The figure is
// therefore a function of career LENGTH, not just of sample size.
//
// M01 read 81% at 20 runs against 91-93% at 150; J04's 25-run smoke doubled an effect it then
// measured at half; this is the third. The header's rule is "150+ before believing anything about
// depth"; it should be read to cover ANYTHING THAT ACCUMULATES ACROSS A CAREER - skulls, the
// Citadel, scars, the roster - because a short sample of those is not a noisy estimate of the long
// one, it is a measurement of a different and poorer player.

// ── N01: MITIGATE COMPUTES AND MUST NOT COUNT ─────────────────────────────────────────
// Out of the N-audit, and it is M08b's own defect sitting one line from where M08b fixed it.
// mitigate carried `noteQuirk('THICK_HIDE', true)` INSIDE itself. mitigate is reached by five
// paths that are not blows - four threatBoard forecasts, which price every hostile's attack
// against every operator every turn, and the roster card's resist probe - so the quirk census
// counted a hit every time anything WONDERED about a hit.
//
// M05 published the result as a count of firings and nobody questioned it:
//
//   "every quirk with a runtime effect fired - VAMPIRIC 3,414 and 5,519,
//    THICK_HIDE 182,859 and 189,321, SECOND_WIND 252 and 204, ..."
//
// A fifty-fold gap read as a hit-taken quirk being common. It was the instrument. The old
// counter is kept deliberately, incrementing in exactly the place noteQuirk used to sit, so the
// size of the error is measured rather than asserted. Three 150-expedition careers:
//
//                                          a         b         c
//   mitigate asked, an expedition       17,003    18,222    18,925   ^^ O-audit: was "a career"
//   blows that actually landed           1,988     2,182     2,191
//                                          8.6x      8.4x      8.6x
//   THICK_HIDE, as the old counter saw  211,729   188,214   103,879
//   THICK_HIDE, as it fires              10,808    10,960     7,231
//                                         19.6x     17.2x     14.4x
//
// M05's PUBLISHED FIGURE WAS FOURTEEN TO TWENTY TIMES THE REAL ONE, and the reproduction lands
// in the same range as what it published (211,729 / 188,214 / 103,879 against 182,859 and
// 189,321), which is the cross-check that the old counter has been reproduced exactly.
//
// THE CORRECTED PICTURE, and it is an ordinary one:
//
//   vampiric 4,953 / 5,475 / 5,850      thick_hide 10,808 / 10,960 / 7,231
//   scrap_rat 1,472 / 1,615 / 1,138     slow_bleeder 801 / 640 / 807
//   second_wind 292 / 254 / 262         overcharged 326 / 240 / 257
//
// THICK_HIDE is the most-fired runtime quirk by about two to one over VAMPIRIC, which is what a
// quirk that pays on every hit TAKEN should look like beside one that pays on hits LANDED while
// hurt. Fifty to one was never a fact about the game. M05's own conclusion - that nothing in the
// pool is unreachable and every runtime quirk fires - survives; only its largest number moves.
//
// ── AND THE MIRROR OF IT, WHICH NOBODY HAD NOTICED AT ALL ─────────────────────────────
// noteCover was wired to three landing points by hand and typedToll is a FOURTH: the vents, the
// turned tank, the chem spill. Those run their damage through mitigate like everything else, so
// the ground's front cover reduces them - and M08b's cover ledger had never seen one. One census
// was counting blows nobody threw and the other was missing blows that landed, for the same
// reason: the bookings were spread across sites that nothing held together.
//
// noteLanding is the door now, and mitigate keeps exactly one counter - its own call count -
// against which the 8.4-8.6x above is the standing denominator. That ratio is the thing that
// makes this class of bug visible the next time somebody adds a counter, which is why it is a
// printed line rather than a comment.
//
// ── #197 TIER A: THE BLEED, BY WHAT OPENED IT ─────────────────────────────────────────
// Every timed status in this game was a bare integer on a body, so a tick could never be booked
// back to whatever applied it. The #197 scope split the sixteen of them three ways and this is
// tier A, the only one where a source stamp gives an exact answer: a bleed ticks on its own, so
// the whole tick belongs to whatever opened the wound. Nineteen sites apply one. The gate for
// starting it was M11's own measurement - 45% to 61% of every combo in the game reads a bleed.
//
// Three 150-expedition careers. EVERY FIGURE HERE IS PER CAREER.
//
//                                          a         b         c
//   THE SQUAD OPENS
//   bleeds applied                      99.6     102.5      98.8   over 12-13 sources
//   turns of bleeding granted            200       210       209
//   ticks                                108       115       112
//   health removed, raw / landed  5313/3640 5371/3601 5713/3935
//   ticks that killed                    4.4       4.4       4.3
//
//   THE ROAD OPENS
//   bleeds applied                     136.7     116.1     124.7   over 5 sources
//   ticks                               78.8      69.8      74.6
//   health removed, raw / landed    623/259   542/233   599/245
//   ticks that killed                   0.85      0.84      0.97
//
//   squad sources, landed a career / per application
//   rad_shot         1145 / 29    1348 / 30    1279 / 33
//   ripsaw            775 / 122    581 / 131   1052 / 118
//   cap_nail_bomb     616 / 53     440 / 45     590 / 48
//   rip_and_tear      341 / 27     403 / 31     223 / 20
//   barbed_shot       220 / 108    274 / 89     286 / 114
//   shiv              213 / 24     240 / 25     232 / 30
//   feral_bite        141 / 12     167 / 13     109 / 10
//   blood_moon        134 / 22     107 / 28     136 / 23
//   the other four     ~45 total    ~42 total    ~27 total
//
// THE SAME INVERSION M11 FOUND, ON A SECOND AND INDEPENDENT LEDGER. RAD SHOT tops the total in
// all three careers and is among the cheapest per use at 29-33. RIPSAW and BARBED SHOT are worth
// far more a use and are applied so rarely that RIPSAW only reaches second place. (#201 ran two
// further careers, which WIDEN those per-use figures rather than moving them: across five, RAD
// SHOT runs 29-35, RIPSAW 118-131, BARBED SHOT 89-162. The gap is the finding; the exact
// multiple is noisier than three careers could show, and BARBED SHOT is the noisy one.) Frequency and worth rank oppositely here exactly as they do in the combo table,
// which is now two separate measurements of the same shape rather than one result.
//
// THE TWO SIDES ARE NOT THE SAME MECHANIC. The road APPLIES MORE bleeds than the squad does -
// 117-137 an expedition against 99-103 (^^ O-audit: both were "a career") - and removes about a fifteenth as much health with them
// (233-259 against 3601-3935). The per-application column says why: every road source is worth
// 1-5 points a use against the squad's 10-131. A bleed is 8% of the victim's maxHp, and an
// operator is a far smaller bar than a sector-7 hostile.
//
// And the mitigation is asymmetric in the same direction: the squad's outgoing bleeds lose
// 31-33% between raw and landed, the road's incoming lose 57-59%. M03 zeroed armour against a bleed on
// purpose - plate does not stop a wound - so the whole of that gap is RESISTANCES, which every
// operator carries and most of the bestiary does not.
//
// THE DEFERRED MEASUREMENT, NOW PRICED - AND THE DEFECT IS DECLINED. Seven of the nineteen sites
// ASSIGN the counter rather than raising it, so a SHIV's two turns can overwrite a five-turn
// BARBED SHOT. Tier A deliberately did not fix it - an instrument that changes the game while
// measuring it cannot be trusted about either - and counted it instead. #201 then PRICED it,
// because a rate cannot be acted on: 1% of applications is one turn a career or a hundred
// depending on how much each one throws away, and an arm cannot settle it either - K06 put the
// floor at about fourteen wins across three careers and this is orders below that. So the
// census counts the turns lost, and the answer is arithmetic:
//
//                                        a       b       c
//   shortenings an expedition           0.2     0.6     1.1      ^^ O-audit: was "a career"
//   turns of bleeding thrown away       0.3     0.7     1.2
//   points that costs the squad          12      24      45
//   against, landed by its own bleeds  3662    3647    3940
//                                      0.3%    0.7%    1.1%
//
// A third to one percent of ONE damage channel, which is itself a fraction of what a squad
// deals. DECLINED, on the M08b precedent: measure the change, state the size, decline it. The
// seven sites keep their semantics and bleedSet keeps counting, so if a future card ever makes
// a long bleed common the column will say so without anybody having to remember this.
//
// Nothing here moves a dial. The census is the deliverable; what to do about RAD SHOT carrying a
// third of the squad's bleed damage at a thirtieth of RIPSAW's value a use is a balance question
// and wants an arm, not a column.
//
// ── M11: THE TEN PAIRINGS, COUNTED FOR THE FIRST TIME ──────────────────────────────────
// COMBOS has been in this game since Phase 1 and nothing had ever counted any of it. This file
// booked a combo turn as "claimed the turn" and stopped there, so a pairing nobody can reach and
// a pairing everybody reaches read identically. Came out of the #197 scope as the largest
// unmeasured channel the statuses feed. Three 150-expedition careers:
//
//                                    a        b        c
//   combos fired                  3508     3534     3398      (23.4 / 23.6 / 22.7 an expedition)
//   pairings reached              9/10     9/10    10/10
//   kills landed on a combo swing  27%      33%      28%
//
//                            fired a / b / c        premium a firing
//   rip_and_tear>bleeding    1764 / 1392 / 1961        12 / 23 / 19
//   thermite>corroded         670 /  870 /  587       105 / 78 / 111
//   molotov>oiled  *          332 /  725 /  266        79 / 101 / 103
//   buckshot>oiled *          198 /  268 /  135        77 / 71 / 99
//   bayonet_thrust>bleeding   185 /  146 /   86        14 / 30 / 29
//   execute_shot>marked *     156 /   60 /  168        59 / 56 / 70
//   scrap_blade>stunned        69 /    5 /   32        34 / 32 / 23
//   spray_gun>corroded         68 /    0 /   59        36 /  - /  9
//   pipe_rifle>bleeding        66 /   37 /   33        21 / 18 / 22
//   harpoon>corroded            0 /   31 /   71         - / 37 / 61
//                                                   (* spends the status it reads)
//
// THE FINDING, AND IT HOLDS ON ALL THREE: the most-fired pairing is among the least valuable a
// firing. RIP AND TEAR is the top of the fired column in every career - 50%, 39% and 58% of all
// combos - and sits in the bottom third of the premium order in every career, at 12, 23 and 19
// points. THERMITE tops or nearly tops the premium order in all three at 105, 78 and 111, and
// MOLOTOV and BUCKSHOT sit with it. Roughly a five-fold gap, stable across the three, between
// what happens most and what is worth most. A tuning pass reading only "which combos happen"
// would have had this backwards, which is what the column was missing rather than a detail.
//
// Not claimed: an exact ordering below the top. The middle of the premium column moves between
// careers (pipe_rifle 21/18/22 against bayonet_thrust 14/30/29) and three careers cannot
// separate rows that close - K06's floor applies to a census as much as to a comparison.
//
// The `*` is most of the mechanism. Three of the ten SPEND the status they read; the other
// seven leave it on the body, so one application is cashable every turn until it expires. RIP
// AND TEAR does not spend its bleed and BARBED SHOT keeps applying it.
//
// ── AND A READING I PUBLISHED AND HAD TO WITHDRAW WITHIN THE HOUR ─────────────────────
// Career (a) alone showed harpoon>corroded at ZERO of 3508, with the HARPOONER deployed in 48 of
// those 150 careers - and I wrote it up as the M06 shape: not weak, unreached. It is not. A
// twenty-career run immediately fired HARPOON thirty-two times and left SPRAY GUN cold instead,
// career (b) did the same, and career (c) reached all ten. HARPOON, SPRAY GUN and BAYONET THRUST
// belong to the three N08 RECRUIT classes, so which of them a census sees is decided by which
// recruits that career happened to sign. THE PER-PAIRING COUNT OFF ONE CAREER IS A ROSTER
// HISTORY, NOT A PROPERTY OF THE GAME - the same error K06 named for win counts, wearing the
// costume of a census rather than a comparison. Suite 168 stages all ten off the table and every
// one of them fires, which is the reading a cold column can actually support.
//
// What IS stable across the three is the total (23.4 / 23.6 / 22.7 an expedition ^^ O-audit), the top of the
// premium order, and the inversion above. Read those; do not read a single career's zero.
//
// ── WHY THE PREMIUM COLUMN IS A RANKING AND M10's DAMAGE COLUMN IS NOT ─────────────────
// The one below says in capitals that it cannot rank the overdrive halves, and the difference is
// worth stating because the two columns look alike. It is the WINDOW. An overdrive's value leaks
// into the turns after the one it fires in, so its own resolution cannot price it. A combo is a
// multiplier on a single swing that resolves inside that swing, and mitigate hands back cd, rv
// and ac - so the same blow without the pairing is max(1, floor(cd / mult) - rv - ac), which is
// arithmetic on figures the engine already produced rather than a model of the formula. No
// second mitigate call: that re-fires its own side effects and counts a quirk twice for a number
// nobody was dealt. Short by integer flooring, a unit or two a swing, one direction only.
//
// Three independent figures agreed to the point on the fixture in suite 168: what the census
// claimed, what taking the status away actually cost, and half the swing a 2.0x multiplied.
//
// Points a career rather than a share, for K09's reason - there is no landed-damage denominator
// in this file to take a share OF (the type ledger counts raw, before armour), and inventing one
// is how M06 and M08b both went wrong.
//
// ── M10: THE OVERDRIVE FORK IS A NULL, AND MY OWN COLUMN CANNOT SAY OTHERWISE ──
// The M-audit opened `--overdrive second` and deliberately answered nothing with it. Nine
// variants had never fired in this project and P02 priced overdrive choice without ever
// exercising it. Three 150-expedition careers an arm:
//
//                          first (every career on record)      second
//   runs that ended the road              18 / 23 / 24      21 / 24 / 22
//                      mean                       21.7              22.3
//   wipes per run      mean                       6.28              6.35
//                                        6.18/6.29/6.36    6.23/6.57/6.25
//   overdrives fired                    344 / 281 / 458   375 / 487 / 476
//
// THE WALL DOES NOT CARE. +0.7 wins against the floor K06 measured at about fourteen for three
// careers an arm, 0.07 wipes, and the arms' spreads sitting inside each other - and the second
// arm is the TIGHTER of the two, so this is not one arm being noisy. Whichever half of each pair
// a player takes, the road is the same length. That is a real answer to the question the audit
// left open, and it is the boring one.
//   ^^ READ: not an open claim - this is M10 CLOSING the audit's question, not raising one.
//
// AND THE COLUMN I BUILT TO ANSWER IT MORE SENSITIVELY CANNOT. Health removed per firing reads
// like a ranking and is not one:
//
//                   first                       second            what the second actually does
//   pyromaniac      hellfire      115           backburner    59  3 turns of burning, after
//   scavenger       scrap storm    87           booby trap    52  corrode and oil, after
//   trench fiend    meatgrinder    99           last charge   58  3.4x, minus a fifth of his own
//   harpooner       full haul      97           iron barb     67  hauls and bleeds
//   hazmat          full purge     31           clean room     0  cleanses and heals the squad
//   shotgunner      breach charge  69           scatterstorm  93
//   bruiser / hound / sniper       level
//
// The window is the overdrive's OWN RESOLUTION, and the second half of nearly every pair puts
// its value outside that window - burns, bleeds, corrode, a cleanse, a cost to its own holder.
// The firsts are the immediate ones. So the bias is structural and it runs the way that flatters
// the arm I was comparing against, which is exactly the shape of error that would have had me
// report "the first halves are better" off a table that measures no such thing. Read as what it
// is - how much of each overdrive lands inside its own turn - it is a fair description and a
// useful one. Read as a ranking it is wrong, and the report now says so on the line itself.
//
// WHAT WOULD SETTLE IT is attributing a status tick back to whatever applied it, which needs
// statuses to carry a source and is a piece of work rather than a counter. Filed. Until then the
// careers are the answer and the answer is that it does not matter.
//
// ONE THING WORTH KEEPING from the biased column, because it does not depend on the window:
// CLEAN ROOM and both medic overdrives remove nothing at all, ever. Three of eighteen overdrives
// are pure support, and no reading in this file - damage, kills, or the wall - can price them.
// That is not a defect, it is a gap in what this instrument is for.
//
// ── M-AUDIT: TWO THINGS THIS FILE COULD NOT SEE, AND DID NOT SAY SO ────────────
// M01-M09 and four b-items are done. Audited the way F03, H and L were, and the two findings
// are the same kind: a reading the instrument could not make, reported as though it had.
//
// ONE. HALF THE OVERDRIVES HAVE NEVER FIRED HERE. Every class carries a PAIR and keeps the
// first one it ever uses for the rest of the run. overdriveFor falls back to pair[0] when
// nothing has chosen, and this file never chose - `odChoices` appeared nowhere in it. Measured:
//
//   overdrives fired over 40 expeditions        175
//   of them, the first of their pair            175
//   of them, the second                           0
//   distinct variants reached              9 of 18
//
// P02 WAS A PHASE CALLED "MOMENTUM WORTH SPENDING - TACTICS AND OVERDRIVE CHOICE", and no
// reading in this project has ever come off the second half of one. It surfaced through M09:
// the mark census listed SPOTTERS_MARK as the only source of a mark in 150 expeditions, and
// OVERWATCH - the sniper's second overdrive, which marks everything it hits - should have been
// the other. It was not rare. It was unreachable.
//
// `--overdrive second` opens it, set AFTER confirmNewGame because that zeroes odChoices - the
// first cut set it before and the arm silently did nothing, which is this phase's signature
// mistake one more time. On the same sample it reads 0 vs 77, and all nine that had never fired
// do: siegebreaker, backburner, booby trap, scatterstorm, triage protocol, overwatch, last
// charge, blood scent, clean room. WHICH HALF IS BETTER IS NOT MEASURED HERE - that is a
// measurement and this is the door it needs. `first` stays the default so every career on
// record is still comparable.
//   ^^ ANSWERED BY M10, seventy lines above: three careers an arm, first against second, +0.7
//   wins against K06's floor of about fourteen. Whichever half a player takes, the road is the
//   same length. The door this paragraph asked for was walked through by the very next item.
//
// TWO. THE CENSUS ACCUMULATORS KEPT THEIR KEY LISTS APART FROM THEIR SEEDS, and the mismatch
// shipped three items running: M07 in nums(), M08's per-card ledger, M09's mark ledger. The
// audit found five more carrying that shape - rch, hl, cv, qk, sg/sgGate - of which three did
// not coerce at all, so a missing key would have reached the page as a bare NaN rather than a
// believable zero. All nine censuses go through one fold now, and it has no key list: it walks
// what the run actually carried, sums numbers, recurses into bags, and carries `_`-prefixed
// labels rather than adding them up. A counter added to a note* function in game.js now arrives
// in the report without this file being edited, which is the only version of this fix that
// closes the class rather than the instance.
//
// WHAT THE AUDIT DID NOT FIND, stated because an audit that only reports hits is not an audit:
// all nine note* censuses are reached in a normal run; the M-phase's move-gated signatures
// (IRONSIGHTS 0%, SHRAPNEL_LOAD 3%) are explained by M07 rather than open, because both sit on
// their class's cooldown-free first ability and this harness throws those on about one turn in
// twenty; and no M-phase header claim was found stale beyond the ones M08 and M09 already
// superseded in place.
//
// ── M09: THE SNIPER LOSES THE RACE FOR ITS OWN MARK, AND ALWAYS WILL ───────────
// M06's last open finding. CALLED SHOT paid the SNIPER +25% against a marked target and fired on
// 1% of that sniper's swings - the lowest rate of any signature in the game. M06 checked the
// obvious artefact and ruled it out: the mark IS reachable, SPOTTERS_MARK firing over a thousand
// times a career. It then EXPLAINED the 1% by saying the sniper is almost never the body that
// swings at the marked target next. That explanation was asserted, not measured. It is right.
//
// WHAT HAPPENS TO A MARK, over 150 expeditions:
//
//   placed on a hostile                 1,061      every one from SPOTTERS_MARK
//   cashed before it ran out              914      86%
//   ran out unspent                        25      2%
//   cashed by the body that PLACED it      83      9%
//   cashed by an ally                     831      91%
//   who cashed them      bruiser 247, shotgunner 203, scavenger 152, SNIPER 83, medic 80, ...
//
// THE CAUSE IS TEMPO AND IT IS STRUCTURAL. A mark is one-shot - the first damaging move to land
// takes MARK_BONUS and zeroes the timer, whoever swings - and the sniper places it on ITS OWN
// TURN, so every other body acts before its next one. MARK_BONUS is exactly what makes that
// target the obvious thing to hit, so the sniper's setup is what sends the squad at it. The card
// asked its holder to win a race that its own ability is designed to lose.
//
// PROVED WITH AN ARM RATHER THAN ARGUED, because "the policy just does not do it" is the D05,
// D06, D07 and I05 mistake and this file has made it four times. `--mark own` teaches the
// targeting to steer a CALLED SHOT holder onto its own mark; `blind` is the old behaviour and
// stays the default so every earlier career is comparable.
//
//                                          blind          --mark own
//   marks placed                           1,061               1,387
//   cashed                                   914               1,193
//   cashed by the setter                 83 (9%)           186 (16%)
//   CALLED SHOT's rate                        1%                  2%
//   holder steered onto its own mark           -                 204
//
// SIXTEEN PER CENT IS THE CEILING, AND THE SAME RUN SAYS WHY: the steer succeeded 186 times out
// of the 204 chances it got, from 1,387 marks placed. It is not that the policy tries and fails.
// It is that by the sniper's next turn the mark is already spent. Deliberate play recovers seven
// points and then stops.
//
// SO THE CARD IS PAID WHERE ITS OWN SIBLING IS PAID. SPOTTER_NETWORK, the other half of the same
// fork, gives momentum whenever a mark is cashed BY ANYBODY. CALLED SHOT now gives damage on
// that same trigger, off the sniper who placed the mark rather than the body that spends it -
// so the fork is two currencies on one trigger instead of one live option and one dead one, and
// a sniper cashing its own mark still gets it, because then the setter IS the holder.
//
//   of its holder's marks, the share that now pays it      51 of 54      94%
//   what it was before                                                    9%
//
// THE WALL, three 150-expedition careers an arm, differing only in where the card is paid:
//
//                            base (paid on the swing)   head (paid on the mark)
//   runs that ended the road           19 / 8 / 17              16 / 18 / 11
//                      mean                   14.7                      15.0
//   wipes per run      mean                   6.47                      6.43
//                                    6.45/6.33/6.64            6.24/6.39/6.65
//   cashes that paid it                          0        855 of 3,176 (27%)
//
// THE WALL IS UNMOVED and the card is alive. +0.3 wins against the noise floor K06 measured at
// about fourteen for three careers an arm, 0.05 wipes, and the two arms' spreads sitting inside
// each other. What moved is reach: nothing at all on the base arm's cash site - it paid in the
// perk layer, on 1% of its holder's swings - against better than a quarter of every mark the
// squad cashes. A card that contributed approximately zero now contributes something, and the
// game did not notice, which is the right outcome for fixing dead content rather than tuning
// live content. The base arm's 8-win career is worth naming rather than smoothing: three careers
// an arm cannot resolve a gap this size and the spread is the reason the rule exists.
//
// AND I MADE THE SAME INSTRUMENT MISTAKE FOR THE THIRD ITEM RUNNING. M07 found a missing key
// reading NaN and fixed the class in nums(). M08's per-card accumulator hand-listed its keys and
// dropped one. M09's mark accumulator listed `called` and `setByHolder` in the SUM and not in
// the SEED, so `undefined + n` came out NaN, `|| 0` turned it into a clean zero, and a working
// card read as "no sniper on the road took that fork" for three runs before I stopped believing
// it. A zero is worse than a NaN because it is believable. The seed is the schema now - the sum
// walks Object.keys(SEED) - and suite 166 holds that shape rather than the values.
//
// THE OTHER THING I DID TWICE: solved a problem this repo had already solved, worse. M08b's
// first counter sat inside mitigate, which the threat forecast calls four times over, when the
// type ledger was already sitting at the three places damage lands. M09's first fixture compared
// single swings, which came back 45/70/49/54/56 on arms that differ in nothing, when suite 29's
// __perkAvg had averaged twelve swings for exactly this reason since P07. Read how it was done
// before re-deriving it.
//
// ── M08b: THE CODE WAS RIGHT AND THE DOCUMENTATION WAS WRONG ───────────────────
// M08 left this open. TERRAIN's legend said frontCover applied to "whoever stands in the front
// rank, whichever side they are on", and mitigate reads `t.gridPos === 1` - which M08 proved no
// hostile ever satisfies. It looked like a missing guard. It is a wrong sentence.
//
// The legend was wrong TWICE. It also said "takes less", and the two grounds carrying the field
// point opposite ways: RUINS at 0.8 is cover, FLOODED WORKS at 1.2 is exposure. No single verb
// describes it, which is a decent sign nobody had read the line against the table under it.
//
// WHAT IT IS WORTH, over 150 expeditions, split by direction because the two halves have
// different denominators and one blended figure answers neither question:
//
//   what the squad TAKES on those grounds     85,541 of 227,488 (38%) at its own front rank
//     FLOODED x1.2   +8,671        RUINS x0.8   -8,437        net  +234  - a wash
//   what it would DEAL under symmetry        464,723 of 689,412 (67%) at the enemy front
//     FLOODED x1.2  +38,215        RUINS x0.8  -54,730        net -16,515 - one way only
//
// THE SHIPPED RULE IS VERY NEARLY NEUTRAL - the two grounds cancel to 0.1% of what the squad
// takes on them - and SYMMETRY WOULD NOT BE, because the squad's damage CONCENTRATES on one
// target (67-70%, M08's census) while what it takes spreads across three ranks (38%). A
// front-rank rule always bites the attacker harder than the defender. That is structural: no
// wording of the rule makes it neutral.
//
// AND THE DESIGN REASON, which is what actually settles it rather than the arithmetic. The
// squad's ranks are a formation committed to at the Outpost and paid for. The enemy's "front" is
// index 0 of the living, and haulForward lets the squad shuffle it mid-fight - 2,245 attempts a
// career, moving somebody on about half. Under a symmetric RUINS the harpooner's entire kit
// would be dragging foes INTO cover, and SLACK LINE's +25% against the enemy front would be half
// cancelled by the commonest ground it stands on. Cover that attaches to a queue position the
// ATTACKER controls is incoherent. So the legend and both banners were rewritten to say whose
// front rank they mean - which is what the two backline grounds already did - and no dial moved.
//
// I FILED THIS WRONG AND THE MEASUREMENT CORRECTED ME. M08 filed it as "one ground is quietly
// pro-player and the other quietly anti-player". True of each ground alone; false of the pair,
// which cancel to +234 of 227,488. A finding about a portfolio that is only ever checked one
// holding at a time is not checked.
//
// TWO INSTRUMENT BUGS, both found by numbers that could not be true:
//
//   1. THE FIRST DRAFT COUNTED INSIDE MITIGATE and read the squad TAKING SIX TIMES what it
//      dealt. mitigate is called five times over by things that are not blows - four forecast
//      paths in threatBoard, which price every enemy's intent against every target every turn,
//      and the resist probe the roster card renders with. The figure goes back with the result
//      now and is booked at the three places damage is actually applied: applyDamageHit, the sky
//      tick and the bleed tick. The existing type ledger already sat at those three; I should
//      have looked at where it sat before choosing where to put mine.
//   2. __dummy GAVE EVERY TEST HOSTILE gridPos: 1 - a body the engine never builds. So it
//      silently satisfied the one unguarded gridPos read in mitigate, and any fixture standing a
//      dummy on RUINS was measuring a rule that does not apply to it. Removed; nothing else in
//      4479 assertions depended on it, which is the good outcome and also the worrying one.
//
// ── M08: ONE CONDITION, TWO CARDS, AND ONLY ONE OF THEM WAS THE PROBLEM ────────
// M05 and M06 each ended on a card reading `dist === 0` and calling it a position taken up:
// DUELIST "+15% DMG against the enemy front" at 75-79% of its holder's swings, SLACK LINE "+25%
// against whatever stands at the enemy front" at 66-72%. Filed as one finding - two pieces of
// content describing a common state as a rare one. They turned out to be two different cards
// that happen to share a sentence.
//
// FIRST, WHAT "THE ENEMY FRONT" REFERS TO. `dist` is the target's index in the living-enemy
// list, not a rank, and I spent a probe assuming the card meant a rank and the engine had lost
// it. It has not: THERE ARE NO ENEMY RANKS. All eight sites that write gridPos write it to a
// playerRoster member, no enemy constructor sets one, and 134 hostiles built across five
// factions, four depths, both node kinds and the boss path carry gridPos undefined every time.
// The squad has a three-rank formation; the enemy side is an ordered list. Both cards implement
// the only reading available, and my probe was right where I suspected it of being broken.
//
// SECOND, WHAT THE RATE IS MADE OF - 79,162 swings over 120 expeditions:
//
//   swings that landed on the front                    79%
//   with only one foe standing                         29%   nobody chose anything
//   with two or more up, how many still took the front 70%   of 56,509
//   the same, if the target were drawn at random       39%
//
// So the preference is real and it is not the harness's: the simulator's targeting takes a
// finishable foe or the biggest threat and never consults position. The front is simply where
// the fight tells you to swing. WHICH MEANS THE CONDITION CANNOT BE MADE RARE BY MOVING A
// THRESHOLD - even a player picking at random fires it 29% + 71%x39% = 57% of the time. The
// problem was the question, not the dial.
//
// THIRD, THE SPLIT, which is the whole finding:
//
//                        of its holder's swings   against a line   hauled there by the squad
//   DUELIST         80%            of 6,013                 72%                          1%
//   SLACK LINE      66%            of 1,025                 57%                         30%
//   every swing     79%            of 79,162                70%                           -
//
//   DUELIST rides the baseline exactly. Beside its own pool - PACK HUNTER 16%, LONER 10%, FIRST
//   BLOOD 16%, CLOSER 17% - it is a 5x outlier, and at +15% on 80% it paid about +12% expected
//   damage against their +4.0 to +4.8%. The mildest-looking card on the sheet was the strongest
//   in play by nearly three times. PREMISE CONFIRMED.
//
//   SLACK LINE does not. It fires BELOW the population rate, and a third of its firings land on
//   something the squad put there: Drag Line, Set The Hook and Iron Barb all call haulForward,
//   which is counted here for the first time. Over a full 150-expedition career - 101,358 swings,
//   2,245 haul attempts, 934 of them moving somebody - the hauled share reads 37%, higher than
//   the 30% of the 120-run sample above, so if anything the short sample understated it. This is
//   a class card paired with its own class's verb. PREMISE REFUTED, and re-keying it would have
//   broken the one pairing in this pool that demonstrably works.
//
// SO ONE CARD CHANGED. DUELIST now reads what its name always promised - one of them left
// standing - which the census puts at 29%, against the pool's 10-17%, priced at +25% for an
// expected +7.3%. Still the pool's strongest, deliberately: a card that has to wait for the end
// of a fight is worth less than its expected damage says.
//
// THE WALL, three 150-expedition careers an arm, differing only in DUELIST's condition and price:
//
//                                  base (the front, +15%)      head (one left, +25%)
//   the condition held on                 78 / 80 / 77%              30 / 28 / 28%
//   runs that ended the road              24 / 15 / 17               16 / 25 / 19
//                          mean                   18.7                       20.0
//   wipes per run           mean                   6.42                       6.31
//                                          6.29/6.39/6.59             6.24/6.08/6.60
//
// THE WALL IS UNMOVED. The win gap is +1.3 in the new card's favour against a noise floor K06
// measured at about fourteen wins for three careers an arm, and the wipe gap is 0.12 with the
// arms' spreads sitting inside each other. Neither is a result; the correct reading is that a
// card whose expected damage fell from +12% to +7.3% cost this game nothing measurable, because
// it is one quirk of fifteen on one body rather than five cards every operator banks. M04 is
// the contrast and the reason this was measured at all: the same shape of change, applied to
// the progression cards, cost sixteen wins.
//
// AND THE RE-KEY LANDED ON THE PROBE. The census predicted 29% from swings-with-one-foe-left;
// the shipped card fires at 28-30% across three careers. Same as M05b - a condition designed
// against a measured rate arrives at that rate. Do not read the rest of the pool's movement
// between these careers as anything: PACK HUNTER reads 19/31/34% on the base arm alone, which
// is the draw varying, not the change.
//
// WHAT I GOT WRONG ON THE WAY, both worth the same lesson. I read "no rank" off my own probe and
// nearly filed it as an engine defect before checking the source - the D06 mistake, aimed at my
// own instrument this time. And the per-card accumulator went to production with a missing key
// and printed NaN, which is the exact bug M07 fixed in nums() one item earlier, in a different
// function. Fixing the instance is not fixing the class; the accumulator sums Object.keys now.
//
// WHAT IS STILL OPEN: mitigate's ruins front-cover read is `t.gridPos === 1` with no isPlayer
// guard, and TERRAIN documents frontCover as applying "whichever side they are on". Since no
// hostile has a rank, it has never applied to one - so one ground is quietly pro-player and
// another quietly anti-player, both against the stated intent. Suite 164 pins it. Not fixed
// here: it is a terrain question with its own difficulty cost and belongs in its own item.
//
// ── M07: THE MOVE POLICY IS SOUND. THE INSTRUMENT WAS NOT, AND THE NUMBER BARELY MOVED ──
// Filed on a suspicion: M06 ended with basic attacks at "4.4-4.7% of moves" and could not say
// what it meant, and that looked far too low for a squad whose abilities cool down in two to
// four turns. If the harness was refusing to swing a basic attack, every damage figure in this
// file was measuring a robot rather than a player - which is D05, D06, D07 and I05 in a row.
//
// THE SUSPICION IS REFUTED. Two 150-expedition careers:
//
//                                                   career 1        career 2
//   turns the squad took                             133,869         145,633
//   tactics bought without spending a turn            36,187          39,450
//   turns that got as far as the ranking                  78%             77%
//   abilities off cooldown when it did    0 up:            7%              6%
//                                         1 up:           29%             26%
//                                         2 up:           46%             47%
//                                         3 up:           18%             22%
//   basic attacks, of the turns with a ranking to do     6.4%            5.7%
//                  of every turn                         5.0%            4.4%
//   of those, thrown with nothing else up                 64%             55%
//
// THE HAND IS ALMOST NEVER EMPTY - six or seven turns in a hundred - and two or three specials
// are up on two turns in three. So a basic attack at one turn in twenty is not a policy refusing
// to swing; it is a deck whose cooldowns are short enough that something is nearly always ready.
// Better than half of the basic attacks thrown are forced, and the rest are the resist term
// doing its job. A competent player would do the same thing. No dial moves and none should.
//
// THE INSTRUMENT WAS WRONG IN THREE WAYS ALL THE SAME, and all three are fixed:
//
//   1. THE DENOMINATOR WAS NOT TURNS. stat.moves counts a bought tactic beside an ability, and
//      a tactic is free - buy() does not return and the actor still picks a move. Better than a
//      fifth of that tally never cost anybody a turn. turnsPlayer had counted turns correctly
//      since F10 and no readout had ever divided by it.
//   2. THE NUMERATOR CAME OFF A NARROWER PATH than the denominator. Basic attacks are picked by
//      the ranking, and the ranking only runs on the turns no earlier case claimed - about four
//      in five. A ranking-path count over every turn understates it.
//   3. A COUNTER NO RUN TOUCHED READ AS NaN, because nums() returned undefined for a missing key
//      and the sums built on it propagated that. It only surfaces the day a run scores zero, and
//      then it reads as a broken report rather than as a missing initialiser. nums() coerces now,
//      which fixes the class rather than the instance.
//
// AND THE CORRECTED NUMBER IS ALMOST THE SAME ONE: 4.4-5.0% of turns against M06's 4.4-4.7% of
// moves. Three bugs, and the figure moved by half a point. What changed is that it can now be
// READ - a share against a named denominator, with the forced half separated from the chosen
// half - and reading it is what refuted the premise. A number being right is not the same as a
// number being interpretable, and only the second kind settles anything.
//
// MY OWN SMOKES WERE OFF BY THREE TIMES, THREE TIMES RUNNING. Twelve-run samples during this
// phase said 13.7%, then 12.0%, then 13.4%; the settled figure is 4.4-5.0%. The header of this
// file has said "150+ before believing anything" since the beginning and it is still the most
// expensive line in it to ignore. A smoke is for checking a readout prints, not for reading.
//
// WHAT THIS SETTLES FOR M06: its three move-gated signatures are hard to reach because of the
// GAME. They are attached to the basic attack, and the basic attack is what you swing when you
// have nothing better - which is one turn in twenty, because you nearly always do.
//
// ── M06: THE SIGNATURE CONDITIONS, AND THE ONES THIS HARNESS CANNOT SEE ────────
// The promotion screen has two halves. M02 measured the split - 91% of perk points buy a stat
// card, 9% buy a signature - M04 took the stat cards apart and found three of five conditions
// barely firing, M05 did the quirks and found one holding on 98% of swings and its partner on
// 2%. Eight signatures carry a condition of the same shape and none had ever been counted.
//
// Two 150-expedition careers. FIVE ASK ABOUT THE WORLD:
//
//                                                    career 1        career 2
//   SLACK_LINE   the target is the enemy front      66%  890/1356   72% 1555/2153
//   TRENCH_FOOT  standing in the front rank         61% 1445/2383   42%  677/1597
//   CATALYST     the target is corroded             53%  368/688    56% 1001/1795
//   GRUDGE       this body is under half health     11% 1130/10162  10% 1059/11018
//   CALLED_SHOT  the target is marked                1%   32/3484    1%   35/3612
//
// SLACK LINE IS THE THIRD CARD IN A ROW TO DESCRIBE A COMMON STATE AS IF IT WERE A RARE ONE.
// PACK HUNTER measured 98%, DUELIST 75-79%, and this is 66-72% - all three word themselves as a
// position you take up, and all three are simply where the fight usually is. That is now a
// pattern in this game's content rather than three separate accidents.
//
// CALLED SHOT at 1% is the low one, and it is a real finding rather than an artefact: the mark
// it needs is reachable, SPOTTERS_MARK being fired 1,226 times in a career. The Sniper holding
// the signature is just almost never the body that swings at the marked target next.
//
// AND THREE ARE A CONJUNCTION - a named ability AND a state - WHICH IS WHERE THIS INSTRUMENT
// RUNS OUT. Counted in two parts, because one rate over both cannot say which half failed:
//   ^^ READ: not an open claim - it explains why the census is split in two, and then splits it.
//
//                            holder reached for it        of those, the state held
//   GO_FOR_THE_THROAT        18%, 16%                     28%, 17%
//   SHRAPNEL_LOAD             2%,  1%                     48%, 66%
//   IRONSIGHTS                1%,  1%                     (the ability IS the condition)
//
// THE GATE IS WHAT FAILS, NOT THE CONDITION. When a Scavenger does fire the Pipe Rifle the
// target is armoured about half the time - SHRAPNEL LOAD is well conditioned. Its holder just
// does not fire it: basic attacks are 4.4-4.7% of every move this harness makes, because the
// move ranking in this file scores anything with a cooldown above anything without one. So a
// signature keyed to a basic attack is nearly invisible HERE, and that is a fact about the
// policy driving the swing rather than about the game. D06 was filed as "Rad Shot has never
// been fired" and had to be voided when the cause turned out to be this file; the split exists
// so that mistake is not available to make again.
//
// MY OWN NUMBER FOR THAT WAS WRONG TWICE BEFORE IT SETTLED, which is worth writing down. Read
// off individual rows it looked like 0.1% - that is one move's share, not the category's. A
// twelve-run smoke then said 13.7%, which was a small sample. Two full careers say 4.4-4.7%,
// and that is the figure. A share read off a row of a table is not the share of the table.
//
// NO DIAL MOVES ON THIS COMMIT. The census is the deliverable, the same order M05 used and M04
// paid for getting wrong. What it leaves open is one question the instrument cannot answer as
// it stands: whether a player reaches for a basic attack more often than this harness does, and
// therefore whether the three gated signatures are content or decoration.
//
// ── M05b: THE PAIR REBUILT, AND THE RATES LANDED WHERE THE PROBE SAID ──────────
// M05 measured PACK HUNTER at 97-98% and LONER at 1-3% - one condition read from two sides, so
// one quirk was an unconditional bonus in disguise and the other was dead. Nine candidate
// replacements were counted over 24,804 swings BEFORE anything was written, which killed the
// whole "the squad is in trouble" family at a stroke (half-down 1%, last standing 2%, isolated
// 2%) and left three live ones: an ally on both sides 27%, only one foe left 30%, the foes
// outnumber us 14%. The pair was rebuilt on the two of those that are genuine opposites.
//
// WHAT THE PROBE PREDICTED AND WHAT PLAY DELIVERED, three 150-expedition careers after:
//
//                     before          probe said   measured in play
//   PACK_HUNTER     98%, 97%             27%       24%, 31%, 35%
//   LONER            3%,  1%             14%       15%, 13%, 12%
//
// Both land on the probe. And the three conditions NOBODY TOUCHED are the control that says the
// instrument is reading the change rather than the weather: FIRST_BLOOD 18-19% before and 17%
// three times after, CLOSER 18-20% and 17-18%, DUELIST 75-79% and 76-78%.
//
// THE WALL, against the pooled default arm - five careers of it, because M04b's blind-pick arm
// and M05's two census careers were run on the same configuration and are the same measurement:
//
//                       runs won                    mean    wipes                      mean
//   before   28, 21, 26, 17, 21                     22.6    5.95 6.39 6.51 6.41 6.37    6.33
//   after    19, 20, 15                             18.0    6.52 6.59 6.73              6.61
//
// The win count is UNMOVED: 4.6 wins apart, well inside K06's floor for arms of this size. The
// wipes are a hair higher and the ranges only just clear each other - 6.51 against 6.52, which
// is a hundredth of a wipe and five careers against three. THAT IS NOT A SEPARATION and it is
// written down as suggestive rather than measured, because the temptation to read it as one is
// exactly what L05 was.
//
// It also points the right way for the right reason, which is worth saying because it is the
// arithmetic the change was sized on: PACK HUNTER fell from about 14.7 points of average damage
// (98% of a 15% bonus) to about 9 (30% of 30%), and LONER rose from about 0.5 to about 5.2. Net,
// a point of average damage lost across two quirks in a pool of fifteen - so a squad that is a
// shade softer, and a lethality reading a shade higher, is what this should look like.
//
// ── M05: THE QUIRK POOL, COUNTED FOR THE FIRST TIME ────────────────────────────
// Fifteen quirks, five of them carrying a condition, and until this phase nothing in this file
// had ever counted one. M04 is why that was worth fixing before anything else: it shipped five
// perk cards whose conditions were designed and then measured, three of the five fired so
// rarely that the change cost sixteen wins of a career, and the condition that broke it - "the
// target is further off than arm's reach" - is the exact complement of DUELIST's, which has
// described itself as situational since this pool was written. So: count first.
//
// Two 150-expedition careers, 1,253 and 1,262 quirks drawn, all fifteen reachable and every one
// of the ten with a runtime effect firing at least once. How often each condition HELD, of the
// times a body holding that quirk was asked:
//
//                                                   career 1        career 2
//   PACK_HUNTER  an ally in the next rank          98% 5721/5814   97% 4503/4630
//   DUELIST      the target is the enemy front     75% 3927/5212   79% 6514/8218
//   CLOSER       the target is below 30%           18% 1287/7115   20% 1255/6348
//   FIRST_BLOOD  the target is unhurt              18% 1107/6214   19% 1243/6499
//   LONER        no ally in the next rank           3%  182/5955    1%   65/4520
//
// PACK HUNTER IS NOT A SITUATIONAL QUIRK. It pays on 97-98% of every swing its holder takes,
// because the condition is "somebody stands in the rank next to you" and a three-deep line is
// three adjacent ranks: rank 2 neighbours both, ranks 1 and 3 neighbour rank 2, and nobody is
// ever alone unless the squad has been thinned. Its card says "+15% DMG with an ally in the
// next rank", which reads as something you arrange. You never have to.
//
// AND LONER IS THE SAME FACT FROM THE OTHER SIDE. It reads the identical test negated, so it
// fires on 1-3% and its +20% headline is worth about four tenths of a percent in play - against
// RECKLESS in the same pool, which is +5 DMG on every swing forever. The two are not a pair of
// choices. They are one card that is nearly always on and one that is nearly never, and that
// was invisible while nothing counted.
//
// FIRST BLOOD AND CLOSER ARE HEALTHY and worth saying so, because a census that only names what
// is broken teaches the wrong lesson. 18-20% each, an opener and a finisher on the same axis,
// firing at rates that are close to each other and far from both extremes.
//
// DUELIST at 75-79% is milder than PACK HUNTER but is still mostly on. Worth noting against the
// separate probe M04 ran, which measured dist === 0 at 81% of ALL player swings: the two
// numbers are different populations - every swing against swings by DUELIST holders - and they
// agree to a few points, which is the cross-check.
//
// WHAT IS NOT BROKEN, stated because it was the thing this phase was filed to look for: nothing
// in the pool is unreachable. All fifteen were drawn in both careers, and every quirk with a
// runtime effect fired - VAMPIRIC 3,414 and 5,519, THICK_HIDE 182,859 and 189,321, SECOND_WIND
// 252 and 204, SLOW_BLEEDER 943 and 702, SCRAP_RAT 1,195 and 1,399, OVERCHARGED 299 and 191.
//   ^^ THICK_HIDE's FIGURE HERE IS WRONG BY 14-20x AND IS LEFT STANDING SO THE CORRECTION HAS
//   SOMETHING TO POINT AT. It was counted inside mitigate, which four forecasts and a UI probe
//   reach for every blow that lands, so it counted wondering rather than happening. Re-measured
//   at 7,231-10,960 in N01, which puts it about two to one over VAMPIRIC rather than fifty. The
//   sentence this belongs to - that nothing in the pool is unreachable - is unaffected.
// The four pure stat quirks have no runtime read at all and correctly report none: RECKLESS is
// written onto the sheet the moment it is rolled and has nothing to fire.
//
// NO DIAL MOVES ON THIS COMMIT. The census is the deliverable and the fix is a separate
// question, which is the order M04 got wrong and paid for.
//
// ── M04b: THE RE-CUT LANDS THE WALL BACK, AND MATCHING FINALLY MEASURES ─────────
// The first cut's conditions were re-keyed onto the two axes that are genuinely about the
// operator - the verb it carries and the rank it is deployed in - with max health left as max
// health and one card, FORTIFIED, left asking nothing. Two more arms, three 150-expedition
// careers each, against the same base measured earlier in the same session:
//
//                                          runs won            mean    wipes/run          mean
//   base       pre-M04, the five flat cards  36, 41, 30        35.7    5.51 5.68 5.79      5.66
//   cut 1      blind pick                    25, 16, 18        19.7    6.41 6.65 6.46      6.51
//   cut 1      matched pick                  22, 18, 29        23.0    6.49 6.37 6.25      6.37
//   re-cut     blind pick                    28, 21, 26        25.0    5.95 6.39 6.51      6.28
//   re-cut     matched pick                  35, 33, 36        34.7    5.84 5.77 5.94      5.85
//
// THE WALL IS BACK WHERE IT WAS for a player who matches the card to the body: 34.7 against a
// 35.7 baseline is a difference of one win, far inside K06's floor, and the wipes overlap
// (base 5.51-5.79, re-cut fit 5.77-5.94). The sixteen-win regression the first cut cost is gone.
//
// AND THE QUESTION M04 EXISTS FOR IS ANSWERED. Matched 34.7 against blind 25.0 is 9.7 wins,
// which at three careers an arm is suggestive rather than settled on the win count - but the
// wipes separate cleanly, 3 against 3 with no overlap at all (5.77-5.94 against 5.95-6.51), and
// this file's own header calls wipes the stable figure. Matching a card to the body it is
// offered to is worth roughly ten wins of a career and half a wipe a run.
//
// That gap did not exist before M04 and could not: the old five were identical on every body, so
// there was nothing for a policy to get right. The first cut could not measure it either, for a
// different reason - its `fit` set counted HONED as suiting any backline body while HONED keyed
// on the TARGET's distance, so one of the three cards it picked from was nearly dead and the two
// arms came out 19.7 against 23.0, inside the floor. The unanswered reading filed with cut 1 is
// now answered, and the reason it was unanswerable was the same defect the cards had.
//
// WHAT THE TWO ARMS ARE, so neither is read as "the" number: blind is the floor - every point
// spent on whatever the shuffle offered - and matched is the ceiling, a player who reads every
// card against the body in front of them and never once takes the wrong one. A real player sits
// between 25.0 and 34.7. The blind arm alone still beats the first cut by about five wins, so
// the re-cut is not only better for somebody paying attention.
//
// The census moved with it: a blind pick lands on a body that meets the condition 60% of the
// time, up from the 57% the first cut managed, and both are read against FORTIFIED asking
// nothing - which is three cards in five fitting any body before judgement is applied at all.
//
// ── M04: THE CARDS READ THE OPERATOR, AND THREE OF THE FIVE CONDITIONS BARELY FIRE ──
// M04 made the five training cards situational and this is what it cost. Five arms, three
// 150-expedition careers each, all measured in one session on one machine:
//
//                                                   runs won              mean   wipes/run   mean
//   base      pre-M04, the five flat cards          36, 41, 30            35.7   5.51 5.68 5.79  5.66
//   random    M04 as shipped, blind pick            25, 16, 18            19.7   6.41 6.65 6.46  6.51
//   fit       M04 as shipped, matched pick          22, 18, 29            23.0   6.49 6.37 6.25  6.37
//   diagdef   M04 offence, the OLD two HP cards     28, 32, 28            29.3   6.17 6.46 6.13  6.25
//   fixpct    M04, defence as a 10%/stack cut       19, 21, 11            17.0   6.55 6.58 6.55  6.56
//
// M04 AS SHIPPED COSTS ABOUT SIXTEEN WINS OF A CAREER. base -> random is 16.0, which clears
// K06's floor for two arms of three (~14); every other pairwise gap here sits under it and is
// suggestive only. The wipes column is the one to read, because this file's own header calls it
// the stable figure: base's three careers are 5.51-5.79 and every M04 arm's nine are 6.13-6.65,
// a clean separation with no overlap at all. The squad is measurably more fragile.
//
// WHY, MEASURED RATHER THAN REASONED. A probe on the resolver counted what each of the five
// conditions actually does, over 14,559 player swings in 25 expeditions:
//
//   VETERAN    body at half health or better       81% of swings
//   SWIFT      thrower standing off the front rank  68%
//   HARDENED   thrower standing in the front rank   32%
//   FORTIFIED  body under half health               19%
//   HONED      target further off than arm's reach  21%
//
// HONED IS THE ONE THAT MATTERS AND THE ERROR IN IT IS STRUCTURAL, NOT A PRICE. "Further off
// than arm's reach" is not a property of the operator at all: dist is the target's index in the
// living-enemy list, so it is a property of whichever foe the targeting picked, and 81% of every
// swing in the game lands on the front of the enemy line. HONED was the only multiplicative
// offence axis a player has against enemies that scale exponentially, it used to be always on,
// and M04 converted it to a card that pays on one swing in five. The whole design rested on an
// assumption about how often a condition fires that was never measured - which is D05, D06 and
// K06 exactly, committed here rather than found here.
//
// The verb's OWN reach, which IS a body property - the Medic carries a pistol and the Bruiser a
// blade - fires on 60% of swings. That is the condition HONED should have had.
//
// AND THE RANK-KEYED CARDS WERE NEVER AN UPTIME PROBLEM. 32% is the share of swings thrown from
// rank 1, which is how much of the line stands there - not the uptime for a body that TAKES
// HARDENED, which stands there permanently and has it on always. So doubling those two for
// "conditionality" was a buff, not compensation, and their loss is entirely the CURRENCY: the
// old cards were +25 HP and +10% max HP, compounding, and M04 made both a flat -6 off each
// blow. diagdef isolates it - putting only those two back recovers 19.7 -> 29.3 of the 35.7,
// about ten of the sixteen wins, leaving roughly six on HONED.
//
// THE REPAIR I EXPECTED TO WORK DOES NOT, WHICH IS WHY IT IS IN THE TABLE. fixpct keeps the
// conditions and restores a MULTIPLICATIVE defensive axis - 10% off each blow per stack,
// 0.9^n, which cannot reach invulnerability the way a flat cut cannot either. It measured 17.0,
// no better than the 19.7 it was meant to fix. A 10% cut at these uptimes is simply worth less
// than compounding max health, and the number that would break even is large enough to be its
// own design question. Tried and refuted before being proposed, not after.
//
// WHAT THIS DOES NOT SETTLE, and must not be read as settling: whether matching a card to a
// body pays. random 19.7 against fit 23.0 is inside the floor, and the wipes are 6.51 against
// 6.37 - indistinguishable either way. But the fit policy was built on the same wrong
// assumption as the cards: it treats HONED as fitting any backline body, and HONED fires on 21%
// of swings whatever rank threw them. One of the three cards in its backline set was nearly
// dead. So this arm says nothing about the value of matching, and the question has to be re-run
// once the conditions are repaired. Reported as unanswered rather than as a null.
//
// ── M02: THE FIVE FLAT PERKS ARE NOT FILLER. THEY ARE 91% OF THE PROGRESSION ────
// Filed on the premise that the stat pool was the boring option sitting beside the signatures on
// the promotion card, and thin at five. The census inverts it. One 150-expedition career:
//
//   points spent at the Outpost            7,200
//     on a stat card                         91%
//     on a signature                          9%
//     on a capstone                           0%   (capstones arrive on promotion, 4.04 a run)
//   why a point became a stat card
//     no signature was left to buy         3,785
//     one was open and unaffordable        2,752
//
// NINE POINTS IN TEN BECOME A FLAT STAT BUMP, and two-thirds of that is a STRUCTURAL CEILING
// rather than a preference: signatures are finite per operator and stat cards are not, so once a
// body has taken the ones its class offers, every remaining point it ever earns is +5 DMG or
// +25 HP forever. The other third is an economy answer - a signature was open and the purse was
// short - which is a separate question and a smaller one.
//
// So the premise this was filed under is REFUTED, and the real finding is worse than the one it
// replaced. Five entries is not thin filler beside the interesting track; it is the whole of
// long-run progression, and all five are the same shape - a number going up. P07 was called
// "Perks that change the verb" and built the signature track to do exactly that; what it left
// behind is the thing a career actually spends its points on.
//
// WHAT THIS CENSUS CANNOT TELL YOU, stated so the next phase does not read it wrongly: the split
// between the five (veteran 1336, fortified 1335, swift 1318, honed 1264, hardened 1284) is
// UNIFORM BY CONSTRUCTION. The harness picks among them with Math.random, so those five numbers
// say the pool is reached evenly and say nothing whatever about which perk is worth taking. A
// policy with a preference is the next question and is deliberately not answered here - building
// the taste and measuring it in one step would have meant the first measurement was of my own.
//
// ── M03b: HALF THE BLEED COST RECOVERED, AND SKULLS DID WHAT NO SCRAP PRICE COULD ──
// Acting on M03's bisect: armour excluded from a bleed (resistances kept), and the treatment
// price moved from Scrap to Skulls. Same baseline, 3 x 150 each.
//
//                            before    M03 armour applied    M03b armour excluded
//   runs won of 150            44.3           27.3                  36.0        42 45 46 / 23 29 30 / 31 44 33
//   wipes per run              5.27           6.21                  5.86
//   grudge commanders % won      44             36                    40
//   wipes at tier ten           704            830                   786
//   % of scars treated           90             87                    67
//
// THE ARMOUR EXCLUSION RECOVERED ABOUT HALF, and all four difficulty rows agree on the
// direction. The useful statement is about what can be RESOLVED rather than about the halfway
// point: M03's gap to baseline was -17 wins, which cleared K06's ~14 floor with ranges
// separating completely, and was therefore established. M03b's gap is -8.3 with the ranges
// overlapping (42-46 against 31-44), which is INSIDE the floor. So M03b is no longer
// distinguishable from the pre-M03 tree at this sample size, where M03 plainly was.
//
// That is NOT the same as "fully recovered" and must not be quoted as it. The remaining -8.3
// could be real and this instrument cannot see it; six careers an arm would settle it if the
// question ever matters enough. The M03b win arm is also wide - 31, 44, 33 - so its own mean is
// softer than the others here.
//
// WHAT IS ESTABLISHED, cleanly: SKULLS DID WHAT NO SCRAP PRICE COULD. 90% of scars treated on
// the baseline, 87% at a doubling Scrap price - a null - and 67% once the currency became the
// one that does not regenerate. The ranges separate completely (87-92 against 66-69) over
// 160-173 scars a career, so this reads at the sample size. A third of scars now stick.
//
// AND TWO-THIRDS STILL DO NOT, which is worth saying plainly rather than declaring victory at
// 67%. The lever works and is now pointed the right way; whether 67% is low enough is a design
// question, and the dial is SCAR_TREAT_SKULLS rather than any new mechanism.
//
// ── M01: TEN SCARS INSTEAD OF FIVE, AND THE WALL DID NOT NOTICE ─────────────
// Five situational scars added to five flat ones. Matched pair, 3 x 150 an arm, this file
// byte-identical on both sides, the before arm a frozen game.js at 5 scars - so the SAME treat
// policy ran on both and the only difference is the pool.
//
//                             before      after     arms (before / after)
//   runs won of 150               47         54     43 51 47 / 58 58 45     overlap
//   wipes per run               5.33       5.28     dead flat
//   grudge commanders % won       44         45     overlap, thousands of fights behind it
//   nodes cleared, median         77         78     overlap
//
// NOTHING ESTABLISHED. Runs won is +6.7 against a floor of ~14 at three careers an arm (K06),
// so it is inside the noise whatever it looks like; wipes and the commander rate are flat, and
// the commander rate is a proportion over thousands of fights so it reads at this size. Score
// moved +10k and must NOT be quoted: the arms overlap wildly and both sit inside the 28.3k to
// 40.2k band K06's nine-career control measured.
//
// TWO ROWS LOOKED LIKE THEY MOVED AND NEITHER SURVIVES INSPECTION, recorded because the next
// phase to diff this report will see them again:
//   scars dealt          145 -> 163   [137 143 155] / [148 174 168]   ranges OVERLAP
//   runs that took none   61 ->  55   [61 62 61]    / [60 48 57]      separate by ONE, on the
//                                                                     strength of a single arm
// At n=3 across ~220 rows I07 measured about 25 spurious movers expected under the null. A
// one-unit separation carried by one arm is that, not a finding.
//
// AND A MECHANISM I PROPOSED AND THEN REFUTED, which is the useful part. The story I reached
// for was that the five new scars carry no stat, so scarFits can never reject them, so the
// "nothing left that fits" escape hatch in giveScar shrank and more scars landed. Probed
// directly rather than asserted:
//
//   bodies with NO scar available, pool of 5,  carrying 2 :  1 of 2,200
//   bodies with NO scar available, pool of 10, carrying 2 :  0 of 9,900
//
// The escape hatch is used about once in two thousand, so it cannot explain anything. The
// mechanism is not there, and neither is the effect it was invented to explain.
//
// WHAT DID COME BACK SOLID is a census, and it is about the system rather than the pool:
// 91-93% OF SCARS ARE TREATED, on both arms, at 150 runs. (A 20-run smoke read 81%; the small
// sample understated it.) With the money the game gives you, a scar is affordable to erase, so
// it is a scrap tax rather than a condition that shapes a run - and the situational scars M01
// added are bought off before they get to be situational. Whether that is right is a design
// question. The arm that would answer the design half - does a policy that READS THE ROAD beat
// one that just treats what it can afford - is not this one, and the policy here is naive on
// purpose so it does not smuggle in an answer.
//
// ── L03: WHAT THE TYPE LEDGER CANNOT SEE, MEASURED AT LAST ──────────────────
// noteDamageType has exactly two callers - the damage door and the sky's tick - so every share
// this file prints for damage by type, K09's soak figures among them, is a share of LEDGERED
// damage rather than of damage taken. L02 closed three unledgered paths and measured them at
// under 1%. Bleed was the one left: 8% of maxHp a turn, on a status nine moves can apply.
//
// Booked without being changed, and the distinction matters. Whether a bleed should meet
// mitigate, or carry a damage type at all, is a DESIGN question - bleeding is bleeding and a Gas
// Mask has no obvious business stopping it - and it should not be settled as a side effect of
// wanting an honest denominator. The arithmetic is untouched; only the ledger grew. Kept in its
// own bag rather than as a fourth key on `dt`, because a reader who found `bleed` sitting beside
// phys, bio and energy would reasonably conclude there was a badge that answers it.
//
// One 150-expedition career, and these are counts over ~24,000 ticks so they read at any size:
//
//                          points a run    ticks      share of all that side took
//   at the squad   BLEED          539      9,901                    2.3%
//   at the hostiles BLEED       5,455     14,051                   10.8%
//
// SO K09'S ABSOLUTE SHARES WERE VERY NEARLY RIGHT. The baseline soak of 16.3% was 16.3% of a
// denominator short by 2.3%, which puts the true figure at 15.9% - a 0.4-point correction, well
// inside how precisely anyone was going to use it. K09's comparisons were never in question
// (same lens both sides), and now its absolutes are not either.
//
// THE BLIND SPOT WAS ON THE OTHER SIDE, which nobody had thought to look at. The squad DEALS
// about ten times the bleed it takes - 5,455 points a run against 539 - because E12b gave nine
// moves a mark to cash and the line actually uses them. So "blows at the hostiles, by type" has
// been under-reporting what the squad puts out by about a ninth, and every reading of the
// squad's damage composition taken off that row has been short by that much. That is a bigger
// error than the one this task was filed to find, and it was found by looking at both columns of
// a row that had only ever been read down one.
//
// STILL OPEN, and deliberately: whether bleed should be typed. The case for leaving it alone is
// that it is not elemental and a resistance answering it would be strange. The case against is
// that the codex says "Armour subtracts from every hit" and a bleed is a hit. Nothing here
// decides it - the instrument is honest now either way, which is what was actually blocking.
//
// ── L02: THREE EFFECTS THAT IGNORED EVERY DEFENCE, AND WHAT IT COST TO FIX ─────
// K08 sent the sky through mitigate and left three in-combat paths to zero behind: the
// Vatborn's grudge aura, the Stormcaller's skyToll, and the Hazmat capstone's vent. The
// Vatborn's was declared `aura: { share: 0.06, type: 'bio', rank: 1 }` with `aura.type` read
// ZERO times in the file. All three now go through mitigate and book into the damage-type
// ledger, which means armour and a badge answer them for the first time.
//
// THE WORRY WAS A QUIET NERF: three effects that ignored every defence now meet one, so they
// land softer, and the intent was answerable rather than weaker. Matched pair, 3 x 150 an arm,
// this file byte-identical on both sides, the before arm run from a frozen copy of the tree:
//
//                                    before      after     arms (before / after)
//   grudge commanders, % won            43         44      45 41 43 / 45 44 42   overlap
//   risen x3, % won                     43         43      44 41 43 / 44 44 41   overlap
//   runs won of 150                     48         48      52 44 47 / 51 47 45   overlap
//   wipes per run                     5.41       5.54      5.23 5.57 5.43 / 5.33 5.35 5.95
//
// NOTHING MOVED. The commander rows are the ones that matter here, because the aura and the
// toll are GRUDGE-PHASE content and that is where they fire - and they carry 3,744 and 3,925
// fights behind them, so they are proportions over thousands rather than career samples, and
// they read at this sample size. Runs won is dead flat at 48 against 48.
//
// WHY IT COST NOTHING, which is the part worth keeping: mitigate floors at `Math.max(1, cd -
// rv - ac)`, and K06 established that the squad's bio and energy resistances are mostly ZERO
// because the mitigation content is hard to aim at. So for a squad that bought nothing, the
// vent still lands very nearly whole and only armour takes anything off it. The fix creates a
// REWARD for buying the answer without punishing the squad that did not - the shape K07 gave
// the Armory.
//
// AND A TRAP THIS FILE SHOULD NOT FALL INTO AGAIN. The first read of this pair was that squad
// damage went UP 5.8% a run, which looked like the ledger seeing what it had been blind to:
//
//   damage at squad, raw/run       23,180 -> 24,535   +5.8%   ranges separate
//   fights per run, median             55 -> 58       +4.8%   ranges overlap
//   damage per FIGHT                421.5 -> 425.5    +0.9%   <- normalised
//
// It was not. Normalised by fights the row is flat, and +5.8% a run is +4.8% more fights a run
// wearing a different label. Every "per run" row in this report divides by RUNS, so any change
// in how far careers get moves all of them together; a phase reading one of them as an effect
// is reading run length. THE THREE PATHS L02 CLOSED WERE WORTH UNDER 1% OF SQUAD DAMAGE - they
// are grudge-phase-rare, and the ledger was not missing much through them.
//
// WHICH LEAVES BLEED AS THE BIG ONE. It is the fourth raw subtraction, it is 8% of maxHp a
// turn, and bleeding is common rather than grudge-phase - so the remaining blind spot in the
// damage-type ledger is almost all bleed, and sizing it is worth doing before any absolute
// share this file prints for soak is quoted again. L02 deliberately did not decide whether
// bleed should be typed; that is a design question, not an evident defect.
//
// NOT ESTABLISHED, and listed so it is not mistaken for a finding: nodes cleared, score and
// fights per run all point at careers running slightly longer. That is ONE signal read four
// ways, not four confirmations - they are the same quantity - and runs won is flat against it.
// Score's arms do separate (25.7k-30.5k against 31.0k-34.9k) but both sit inside the 28.3k to
// 40.2k band K06's nine-career control measured for score, so it is noise with a direction.
//
// ── K11: THE TWO DEBTS K06 LEFT, PAID AT SIX CAREERS AN ARM ───────────────────────
// K06 measured the career instrument's own noise and withdrew two claims for resting inside it:
// K05's reading of the augment cap, and its own trinket-bench arms. Both were filed with the
// sample size written on them. This is that sample: four arms of six 150-expedition careers,
// 3,600 expeditions, run back to back on one tree with the checksum held across all of it.
//
// The baseline arm is the shipped configuration - answers capped at one, no trinket forced - so
// it serves as the control for both questions at once and the whole set costs 24 careers rather
// than the 48 two separate designs would have.
//
//   base       41 49 45 39 48 53   mean 45.8  sd 5.2
//   augfree    46 37 48 44 44 47   mean 44.3  sd 3.9    --augmax 3, answers uncapped
//   knuckles   53 50 50 61 58 63   mean 55.8  sd 5.6    --trinket IRON_KNUCKLES, +3 DMG a body
//   shield     56 52 63 45 43 52   mean 51.8  sd 7.3    --trinket RIOT_SHIELD, +6 phys a body
//
// THE AUGMENT CAP IS A NULL (see the K05 record for the detail). -1.5 wins at 0.6 sd, every row
// overlapping, and installs per run identical at 15.45 against 15.47.
//
// THE TRINKET SLOT IS WORTH ABOUT TEN WINS, which is the first thing in this file to come out of
// the trinket bench that the instrument can actually hold:
//
//                          base      knuckles                 shield
//   careers won of 150      45.8   55.8  (+10.0, 3.2 sd)   51.8  (+6.0, 1.6 sd)
//   reached sector 7        52.0   62.8  (+10.8, 3.7)      59.0  (+7.0, 2.1)
//   score, median          29.2k   41.8k (+12.6k, 4.4 sd, RANGES SEPARATE)   40.0k (+10.8k, 2.6)
//   wipes per run            5.42   5.18  (-0.24, 2.2)      5.24  (-0.18, 1.6)
//
// The score row is the only one that separates outright, and it separates hard - 29.2k against
// 41.8k, where K06's nine-career control put score's whole noise band at 28.3k to 40.2k. The win
// row at 3.2 sd clears the bar this file set itself (a gap wider than 9.4 here) but its ranges
// still touch, which is what a ten-win effect looks like at six careers: real, and only just.
//
// OUTPUT AGAINST MITIGATION DOES NOT SEPARATE. +3 DMG reads ten wins and +6 phys reads six, and
// head to head every row overlaps - the widest is 1.1 sd on the win count. K05 argued that output
// compounds and mitigation does not, because a shorter fight cuts incoming damage on every later
// turn; these numbers lean that way and cannot carry it. What K09 settled on the SOAK axis - the
// shield takes 9.0 points off every hundred incoming against the knuckles' nothing - is not in
// dispute; what is unresolved is whether that soak is worth as much as the swing, and six careers
// an arm cannot say. It would take about twelve.
//   ^^ ANSWERED by K11b, and the estimate was wrong. Twelve an arm reads +1.08 wins at 0.60 sd,
//   with score and nodes leaning the OTHER way and sector-7 reach level - four rows that do not
//   agree on a sign. The twelve was costed assuming both arms behave alike; the output arm is
//   1.7x noisier (sd 5.36 against 3.22), and settling a gap this small actually needs about 134
//   careers an arm. Not bought. K05's compounding argument has had its best shot and should not
//   be cited as established.
//   ^^ AND THIS MARKER USED TO SAY "STILL OPEN, and priced - twelve careers an arm. Nothing
//   since has spent them." K11b spent them and wrote its answer ABOVE this line without taking
//   the old one out. For two commits the claim carried two markers that disagreed, the last
//   word a reader got was the stale one, and the scan said nothing: it tested the whole window
//   for an answer, found K11b's, and stopped. The one instrument built to catch a stale verdict
//   was blind to a stale verdict sitting inside a claim it had already passed. Fixed at the
//   site, and stale.js reads marker BLOCKS now - last declared verdict wins, and an answer
//   followed by a re-opening is reported rather than swallowed.
//
// AND THE ARMS ARE STILL A BENCH. Every one of them fits the whole deployed line with one piece
// at every muster, which no player can do: K07 measured that the Armory sells one piece per visit
// and the other three doors are blind. So "the trinket slot is worth ten wins" is a CEILING on
// what the slot could be worth, not what it is worth to somebody playing.

// ── K10: THE SKY IS STILL A SKY — THE PREMISE IS REFUTED ──────────────────────────
// K08 routed the sky's tick through mitigate, which was the correctness fix, and it cost the
// sky most of its weight: 6.87 damage a turn to 2.76. That was left un-re-cut deliberately, and
// filed as "is TOXIC_SMOG still worth being a sky, and does the chip want raising about 3.3x to
// put its old totals back?" The answer is no, and the reason is that the question had never been
// asked in a unit that could answer it.
//
// NOBODY HAD EVER PUT THE SEVEN SKIES SIDE BY SIDE. Four of them are not damage at all - a
// ranged penalty, plating and an AoE cut, cooldowns and a damage cut, a backline screen - so
// "the smog does 2.76 a turn" could not be compared to anything. `--sky <ID>` stamps one sky on
// every fight a run takes, so each can be read against a forced-CLEAR floor in the only unit
// they share: what the exchange looks like underneath them.
//
// 60 expeditions an arm, raw damage per run, against a forced-clear baseline:
//
//   sky               at the squad    at the hostiles    the shift    wipes
//   TOXIC_SMOG           +37.8%           +22.6%           -15.2       4.97
//   SHRAPNEL_WINDS       +24.5%           +11.6%           -12.9       4.97
//   BLOOD_HAZE           +12.3%            +0.4%           -11.9       5.62
//   SANDSTORM            +30.0%           +26.2%            -3.8       5.77
//   ASHFALL              +27.6%           +32.1%            +4.5       5.35
//   ION_STORM             -0.3%            +7.5%            +7.8       5.12
//   (clear)                  --               --              --       4.77
//
// THE SMOG IS THE HARSHEST SKY IN THE GAME ON THE SQUAD SIDE, not a spent one. A squad under it
// takes about 38% more raw damage than under a clear sky, and that figure is the one thing here
// that replicates tightly: a second set of arms read +38.8% against +37.8%. Every other column
// wobbles, because the forced-clear baseline is itself a single 60-run sample and it moved 8%
// between the two sets - so the SHIFT column is an ordering rather than a measurement, and the
// only ordering claim worth making from it is that the smog sits at the bottom of it twice.
//
// SO THE RE-CUT IS REFUSED, and now on evidence rather than caution. Raising the chip 3.3x to
// restore the pre-K08 totals would be a large buff to the most punishing sky of the seven. K08
// made the smog smaller AND more one-sided at the same time, and the second half is what
// matters: what it lost was mostly what it used to do to the Choir, the Carrion and the machines,
// which are precisely the factions built to shrug bio off. A sky that hurts you and not the
// thing you are fighting is a harder sky, not a weaker one, whatever its total says.
//
// TWO THINGS THIS ARM IS NOT. It forces one sky on every fight, so a faction's OWN sky and the
// confluence that fires when a sky meets its matching ground both come up far more than they
// would on a road - the smog over FLOODED bites twice, and FLOODED is 5.6% of ground, so the
// smog arm carries about 5% more sky damage than a played run would. And 60 expeditions is a
// bench, not a career: nothing above is a wall reading and none of it is quoted as one.
//
// WHAT SHIPS IS THE INSTRUMENT. No dial moves. The sky flag stays because the next phase to ask
// what a sky is worth should not have to build it again, and because the table above is the
// first time this repo could answer "compared to what".

// ── K09: WHAT A RESISTANCE IS WORTH, MEASURED INSTEAD OF MODELLED ─────────────────
// K08 left an owed correction: bio is 32% of the blows aimed at the squad, not the 13% every
// phase since K02 had quoted, so every conclusion reasoned from "incidence times size" had the
// wrong incidence. Redoing that arithmetic is what this item was filed as. It got about four
// lines in before the arithmetic itself turned out to be the problem.
//
// THE MODEL WAS WRONG TWICE OVER, not once. "A flat resistance is worth its size times how often
// the type it answers lands" forgets the flat part: a resistance saves min(R, blow), not R. The
// sky's tick is 2 at tier 1 and 8 at tier 9, so against the largest single source of bio in the
// game a +10 Gas Mask saves the TICK and not the ten, and a +35 Sealed Rebreather saves exactly
// the same as the mask does. No amount of correcting the incidence fixes that - the term the
// model is missing is not a number, it is the min().
//
// SO IT IS MEASURED. Five arms of 60 expeditions, each fitting the whole deployed line with one
// piece at every muster (K06's --trinket bench), reading the ledger's raw and soaked in POINTS
// rather than in shares - which is the row K09 added, because a share cannot answer this:
//
//   arm                        soaks, of every 100 points aimed at the squad
//   none                        16.3        the baseline: class lines, perks, what the bench bought
//   RIOT_SHIELD   +6 phys       25.2        +9.0
//   GAS_MASK     +10 bio        20.6        +4.3
//   INSULATED_COAT +10 energy   19.3        +3.0
//   PLATED_VEST  +15 HP         15.9        -0.4   (not a resistance - the control, and it reads as one)
//
// And what each does to its OWN type, as a share of that type's raw: the Gas Mask takes bio from
// 28% soaked to 64%, the Coat takes energy from 19% to 49%, the Shield takes phys from 12% to
// only 24% - the SMALLEST proportional lift of the three, and still the biggest piece, because
// phys is 65% of the points even at 48% of the blows.
//
// K07'S CONCLUSION HOLDS AND ITS REASONING DOES NOT. K07 wrote that the Riot Shield beats both
// answer trinkets, off 0.61 x 6 = 3.7 against 0.13 x 10 = 1.3. The conclusion is right - the
// shield is worth about twice either - but the ratio is 2.1 rather than 2.8, one input was wrong
// by a factor of two and a half, and the model that produced it was missing a term. A right
// answer from broken arithmetic is worth correcting, because the next question it is asked will
// not come out right.
//
// AND THE ANSWER TO "ARE THEY UNDERSIZED" IS NO. A situational piece SHOULD be worth less on
// average and more where it lands, and both of these now have somewhere to land:
//   THE COAT'S HOME IS MACHINE UPRISING. Walked through generateEnemies, that front is 57%
//   energy against a 20% baseline, and 34% phys against 62% - so the coat roughly triples while
//   the shield roughly halves, and on that front the coat is the better buy by about two to one.
//   THE MASK'S HOME IS IRRADIATED, and it is K08 that gave it one. Smog on 70% of roads and on
//   the boss, and a line in Gas Masks cuts what the sky takes off the squad from 54,215 to
//   27,505 over 60 expeditions - it halves the weather. Before K08 that number was zero, which
//   is exactly why K07 could find no front where the mask was the right buy.
//
// NOTHING IS RE-SIZED. The pieces measure as what they are meant to be. What was wrong was the
// arithmetic being used to judge them, and that is what this record replaces.

// ── K08: THE SKY SAID BIO DMG AND WAS NOT BIO AT ALL ──────────────────────────────
// READ THIS BEFORE QUOTING THE DAMAGE-TYPE LEDGER. Every figure this file has carried since K02
// - "the squad meets bio on 13% of the blows aimed at it", and everything built on top of it -
// excluded the largest source of bio damage in the game, because that source was not damage of
// any type at all.
//
// TOXIC_SMOG's banner reads "passive Bio DMG to active units". Its description says everything
// in it is being poisoned, including them. The log says "choked by Smog". And the arithmetic was
// `ent.hp = Math.max(0, ent.hp - sDmg)` - a raw subtraction that never went near mitigate. A Gas
// Mask did nothing about it. Neither did the HAZMAT perk Closed Circuit at +40, the Hazmat
// Specialist's own baked bio 25, or three Sealed Rebreathers stacking a body past a hundred,
// which the manual promises is a wall. Neither did the bio 25-100 the Choir, the Carrion and the
// machines carry. It was untyped true damage wearing a bio label, on 19% of all fights.
//
// WHY IT WAS FOUND HERE. K07 measured, through the engine's own draw, that no front in the game
// makes the Gas Mask the right buy - the Insulated Coat wins decisively on Machine Uprising
// (0.57 x 10 against a Riot Shield's 0.34 x 6) but bio never concentrates anywhere, and even
// Carrion Bloom at 28% leaves the shield ahead. The reason bio had no home is that its biggest
// threat was not plumbed into the system the answers live in.
//
// THE FIX IS THE ENGINE'S OWN DOOR: the tick goes through mitigate, and books through the same
// ledger function applyDamageHit uses - which K08 lifted out of applyDamageHit so both callers
// share one definition rather than one growing a copy. Shrapnel is typed phys for the same
// reason. The type sits on the WEATHER table so the arithmetic and the manual read one source.
//
// WHAT A SQUAD IS ACTUALLY MEETING, six careers an arm against the K07 tree. These rows did not
// change because the blows changed - they are the same blows. They changed because the ledger
// can see the sky:
//
//                        before        after
//   phys                  62.7%        47.7%     20.2 sd, separates
//   bio                   13.7%        31.9%     37.1 sd, separates
//   energy                23.6%        20.4%      3.0 sd, overlaps
//
// BIO WAS NEVER 13%. It is about a third of what the squad meets and always was. Every phase
// since K02 that reasoned from 13% - K05's sizing of the bench answers, K07's finding that the
// Gas Mask never wins a front - was reasoning from a number with the biggest term missing.
// Those conclusions are not overturned by this (the shelf census and the reachability finding
// stand on their own counts), but the arithmetic under them wants redoing, and that is filed.
//
// AND THE SKY GOT MUCH SMALLER, which is the honest cost of making it meet resistances:
//
//   damage a turn, both sides    6.87 → 2.76
//   taken off the squad        221,603 → 125,568   (-43%)
//   taken off the hostiles     136,071 →  40,497   (-70%)
//
// The hostile side falls further because the smog-heavy factions are exactly the ones built to
// shrug bio off - the machines at bio 100 take nothing now, which is the right answer and a
// legible one, because K04 put the badge on the field. A squad under smog can see which of them
// it is working on.
//
// THE WALL DID NOT MOVE, at six careers an arm, on a design that settles a gap wider than about
// nine wins: careers won 47.3 → 49.0 (0.5 sd), wipes 5.45 → 5.44 (0.1), reached sector 7
// 53.5 → 56.0 (0.8), score 34.3k → 31.3k (0.9), lost for good 511 → 532 (1.4). Every row
// overlaps. That is worth saying twice: the sky lost 43% of what it was taking off the squad and
// nothing downstream of it moved, which bounds how much the weather was ever driving.
//
// SO THE MAGNITUDE IS NOT RE-CUT HERE, DELIBERATELY. Restoring the sky to its old weight would
// be a second change on top of a correctness fix, and the pair would land in one number - the
// exact error this file warns about two records down. The sky is weaker and answerable now
// rather than heavier and unanswerable, and weaker is the safe direction to be wrong in. What
// the right weight is, given that a resistance is FLAT and a 2-to-8 tick is small enough for any
// resistance to erase, is its own question and is filed with these numbers on it.

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
// SET THAT AGAINST WHAT THE SQUAD MEETS: 32% of the blows aimed at it are bio and 20% are
// energy (K08's figure; this record was written at K02's 13%, which was missing the sky), which
// at 150 expeditions means every single run meets both. It ends about one
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
//   K11 RAN IT AT SIX: none 45.8, knuckles 55.8, shield 51.8. The knuckles arm replicated almost
//   exactly and the shield arm came down five wins - which is this record's own point landing on
//   itself, since the three-career shield arm was the one overstating.
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
// O16: THE DOOR I01 PRICED AND NOBODY HAS EVER WALKED THROUGH. I01 moved perDepth 15 -> 6 and
// reported the retreat going from 25-28% affordable to 56-62% - affordability, which is all this
// file could see, because no policy here presses the button. Both I01 and I02 record WHY, and the
// reason was that retreat()'s failure path calls nextTurn(), which opens the next actor's turn
// through the engine: this loop would then tick that actor's turn-start a second time and count
// their turn twice. I01 filed it as needing "the loop to hand the turn walk back to the engine,
// a much larger change".
//
// IT IS NOT A LARGER CHANGE, BECAUSE I02 ALREADY BUILT THE MECHANISM AND DID NOT CONNECT IT.
// `engineOpened` exists for exactly this state - a turn the ENGINE has already opened, which the
// loop must accept rather than re-open - and I02 built it for initiateCombat's opening
// processTurn while writing, three paragraphs later, that "the retreat path stands as I01 left
// it". Constructed rather than argued, with Math.random pinned so the break cannot succeed:
//
//   before   activeIndex 0, actor p3, fightLog.turns 0, every cooldown 5
//   after    activeIndex 1, actor p2, fightLog.turns 1, p2's cooldown 4, p1 and p3 untouched
//
// One turn-start, one count, on the actor nextTurn landed on. Handing that actor to
// `engineOpened` is the whole of the fix.
//
// `off` is the default so every figure on record stays comparable. `losing` takes the break on
// the same condition the withdraw policy uses, which makes retreat the FIRST answer to a fight
// going wrong and withdraw the fallback when the purse is short or the break fails - that is
// what the button is for, since a fall-back keeps the node and a withdrawal does not. NAME THE
// ARM: this measures what taking the door does to a run, under a policy that takes it whenever
// the squad is losing and can pay. It does not measure how often a player would.
const RETREAT_POLICY = flag('retreat', 'off');
// The draft policy was hardcoded to a front-liner, usually a medic, and one other - which meant
// "which classes get deployed" reported that policy back rather than anything about the game.
// `--draft random` fields three drawn flat from the roster; `--draft only:PYROMANIAC` forces one
// class into the line and rolls the rest. The cost of an unusual squad is the number doctrines
// have to be priced against, and it cannot be read off a policy that never fields one.
// `--draft doctrine` takes one of the three offered and builds a line that keeps it, which is
// what a player with a free multiplier on the table actually does. It is not the default: the
// default is left alone so runs measured before doctrines existed stay comparable.
const DRAFT = flag('draft', 'line');
// M01: whether the Outpost ever takes a scar off. `off` is the behaviour every career before
// M01 ran with, kept so those records stay comparable.
const SCAR_POLICY = flag('scars', 'treat');
// O11: THE CONTROL ARM A DOCTRINE HAS NEVER HAD. Asking what a doctrine is worth needs a run
// that does not have one, and this file had no such policy: `--draft line`, the default, banks
// one opportunistically whenever the line it drafted happens to keep an offered card, which O10
// measured at 114 of 150 runs. `--draft random` skips the bank - but it also changes the draft,
// so the difference would carry a different line as well as a missing multiplier and neither
// could be read off it.
//
// `--doctrine off` suppresses only the BANK. The same draft, the same line, the same three
// offers rolled and read, and then nothing taken. That is the one comparison in which the
// doctrine is the only thing that moved.
const DOCTRINE_POLICY = flag('doctrine', 'on');
// O13: WHICH of the satisfying lines a doctrine draft takes, which O12 left uncontrolled and
// which may be most of what O12 measured. lineKeeping walks ordered selections and takes the
// FIRST that holds, off a shuffled list - so for a doctrine that constrains membership only, the
// body standing at rank 1 is arbitrary. LIGHT_ORDER and NO_HANDS are both that kind, and their
// arms regularly fronted a Sniper. THE WALL is not: its own rule demands the front carry melee
// and be the toughest, so every arrangement it accepts is already a sensible one - which is
// exactly why it made a clean control, and exactly why the comparison may have been unfair.
//
// `--arrange front` prefers, among the lines that satisfy the card, the one whose rank-1 body
// carries melee and is heaviest. That is not my taste imported from outside: it is THE WALL's
// own stated notion of a good front rank, borrowed as a preference rather than a requirement.
// `any` is the default and is what every O12 number was taken under, so those stay comparable.
const ARRANGE = flag('arrange', 'any');
// M04 made the five training cards situational, and M02 had already established that this file
// picks among them uniformly at random. Under the OLD five that was harmless - every card was
// worth the same on every body, so there was nothing for a policy to get right. Under the new
// five a random pick buys a card whose condition this operator will often not meet, which is a
// different game from the one a player plays.
//
// So there are two arms, and the GAP BETWEEN THEM is the measurement M04 is actually for: how
// much is it worth to match the card to the body. Under the old five that gap was zero by
// construction. `random` is the default and stays the baseline, so every career measured before
// M04 is still comparable; `fit` is the arm that reads the decision.
//
// `fit` encodes THE CONDITION AND NOTHING ELSE - it narrows to the cards whose condition this
// body meets and then still picks uniformly inside that set. It is deliberately not a ranking:
// deciding which of the five is strongest and measuring that would be measuring my own taste
// rather than the game's, which is the trap M02 named when it declined to fix the policy and
// the census in one step.
// F10 left a claim open that nothing has walked since: "no policy here banks a capstone to take
// later". The door is real and it is on the promotion screen - BANK THE POINT (spend it at the
// Outpost) - and this file has always pressed one of the cards instead, taking a capstone when
// the offer happened to hold one and a signature or the first card when it did not. `bank` is
// the other player: refuse anything that is not a capstone, and let the Outpost's own spend path
// buy one when it opens. It is not obviously better - a banked point buys nothing until a
// capstone is reachable, and a signature taken now compounds for the rest of the run - which is
// why it is a measurement rather than a fix.
const PERK_POLICY = flag('perks', 'random');
// M09: whether the targeting knows a mark exists. CALLED_SHOT pays its holder +25% against a
// marked target, and M06 measured it at 1% of that sniper's swings. The mark is reachable -
// 1,061 placed over 150 expeditions, 86% of them cashed - but the SETTER cashes only 9%, because
// pickFoe below takes a finishable foe or the biggest threat and has never consulted a mark.
// That 9% is therefore what happens BY ACCIDENT, and a player holding the card would simply
// shoot the thing they just marked. So it is an arm rather than a reading: `blind` is the old
// behaviour and stays the default so every career measured before this is comparable, and `own`
// has a CALLED_SHOT holder take its own mark when one is standing. It encodes the decision and
// nothing else - no re-ranking of anybody else's targets, because routing the whole squad off
// the mark would be measuring my own taste rather than the card, which is the trap M04's `fit`
// arm was written to avoid.
const MARK_POLICY = flag('mark', 'blind');
// M-audit: WHICH HALF OF EACH OVERDRIVE PAIR. Every class has two and takes the first one it
// ever fires for the rest of the run; overdriveFor falls back to pair[0] when nothing has
// chosen, and this file has never chosen - `odChoices` appears nowhere in it. Measured: 175
// overdrives fired over 40 expeditions, every one of them the first of its pair, nine of
// eighteen variants reached. P02 was a phase called "momentum worth spending - tactics and
// OVERDRIVE CHOICE" and no reading in this project has ever come off the second half of one.
//   ^^ ANSWERED: the M-audit opened `--overdrive second` and M10 measured it at three careers an
//   arm. Readings come off the second half now, and they say it does not matter which half.
//
// `first` is what every career before this ran and stays the default so those records hold.
// `second` takes the other half for every class, which is the arm that makes the other nine
// reachable at all. It moves no dial: it is the same door P02 built, opened from this side.
const OVERDRIVE_POLICY = flag('overdrive', 'first');
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
// resistance pays only on the blows of its own type, 32% of incoming for bio and 20% for energy,
// while a bar or a swing pays on all of them, so each further answer displaces a better flat
// option than the last did. One is the cautious default in the direction the mechanism points.
// Whether it is the right one is UNMEASURED; see the K06 record and the arm it asks for.
const AUGMENT_MAX = Math.max(0, Number(flag('augmax', '1')));
// K10: stamp one sky on every fight this run takes, so what a sky is WORTH can be asked in the
// same unit for all seven of them. `--sky none` forces CLEAR, which is the floor the other six
// are read against. A bench arm, not a policy: nobody plays under one sky for 150 expeditions.
// The node is stamped rather than currentWeather being set, because the node is where the game
// puts it - the banner, the forecast and the confluence all read from there, and a run that had
// the sky forced somewhere further down would be measuring a different thing to the one played.
const SKY_ARM = flag('sky', '');
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
// O05: the elite drop as a choice. 0 is the grant that ships; 2 hands over two cards drawn at
// rollRelic's own odds, the count deliberately unchanged. The lever lives in game.js so the arm
// measures the GAME rather than a harness impersonation of it; this only turns it on.
const ELITE_OFFER = Number(flag('eliteoffer', '0')) || 0;
// R04: the control the recruit-term arm withholds. `on` is the shipped game; `off` puts every
// recruit node back to a card and a price, which is what every figure printed above this line
// was measured under. A withholding control rather than a lever, for the same reason O11 built
// `--doctrine off`: the comparison wanted is "with the thing" against "without it", on one
// build, with nothing else moved.
const RECRUIT_TERM = flag('recruitterm', 'on');
// R03: the control the morale arm withholds. `on` is the shipped game; `off` puts every hostile
// back to fighting to the last body, which is what every figure above this line was measured
// under. Same shape as --doctrine off and --recruitterm off: one build, one difference.
// T05 adds a THIRD value: `pay`. The break still happens, and a body that leaves still gives no
// kill credit, no bounty and nothing to the bestiary - but the squad collects the momentum it
// would have collected for killing it. R03 explained its half-operator cost by arithmetic
// through momentum and said nothing had withheld that term alone; this is that term alone.
const MORALE_ARM = flag('morale', 'on');
// R01: the control the capped-commander arm withholds. `on` is the shipped game; `off` puts a
// Thrice-Risen back to waiting for a quarter and bringing the plate, which is what every figure
// above this line was measured under.
// #230: THE WALL ITSELF, AS AN ARM. Empty means "leave the shipped value alone", so the default
// run is byte-identical to before this existed. I06 cut this dial by editing game.js, running
// careers, and editing it back - the only tuning question in the project without a flag, and the
// one with a stated target behind it.
const WALL_HP = flag('wallhp', '');
const WALL_DMG = flag('walldmg', '');
const PRESSED_ARM = flag('pressed', 'on');
const CAP_SHAPE = flag('capshape', 'on');
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
const EXPEDITION = ({ pressedArm, wallHp, wallDmg, capShapeArm, moraleArm, recruitTermArm, eliteOffer, difficulty, contracts, capNodes, withdrawPolicy, EXTRACT_AT, draftPolicy, benchPolicy, tacticPolicy, AUGMENTS_ON, augPolicy, augCat, augMax, shelfSee, shopPick, trinketArm, skyArm, relicPolicy, metaPolicy, facePolicy, endingPolicy, orderPolicy, rungPolicy, stagePolicy, stageProfile, reckoning, reqPolicy, rescuePolicy, resignPolicy, recruitPolicy, investPolicy, scarPolicy, perkPolicy, markPolicy, odPolicy, doctrinePolicy, arrange, retreatPolicy }) => {
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
                 promotions: 0, promoEmpty: 0, capsBanked: 0, held: 0, turnsPlayer: 0, ranked: 0, basicPicked: 0, basicForced: 0, freeActions: 0, sigsTaken: 0, sigsBought: 0, capsTaken: 0, capsBought: 0, gearEquipped: 0, shops: 0, shopScrap: 0, sigsFaced: {},
                 maxBond: 0, bondSaves: 0, frontsSeen: [],
                 endedBy: 'cap', score: 0, contractMult: 1, recruited: [], recruitOffers: [], saves: 0, downs: 0, lost: [], bossMet: [],
                 extracted: false, walkedAt: 0, formations: {}, factionFights: {}, loose: 0, doctrine: null, doctrineKept: false,
                 benchHeld: null,
                 docDoorAll: 0, doorBodies: [], doorBodiesLive: [], benchNodes: 0, benchInForce: 0, docDark: {}, docDoor: 0, docBreach: 0, docBreachLine: {}, docBreachFirst: null, docArrived: {},
                 booked: 0, bookedKinds: {}, augments: 0,
                 offeredNodes: {}, takenNodes: {}, forks: 0, forksWithChoice: 0, forksAllFights: 0,
                 cachesMet: 0, cachesClean: 0, cachesForced: 0, cacheScrap: 0, cacheLocks: {}, cacheOpener: {},
                 bookedFrom: {},
                 tookNonFight: 0, evOptions: 0, evBookable: 0, evCouldBook: 0,
                 evShown: 0, evPriced: 0, evPricedTook: 0, pricedBySector: {},
                 retreatOpen: 0, retreatAfford: 0, retreatAsked: [], retreatPurse: [], retreatBySector: {},
                 // O16: and what taking it did. Seeded here rather than self-started, because
                 // the report divides by them and M07's NaN came from a key a run never touched.
                 retreatTook: 0, retreatFailed: 0, retreatPaid: 0, retreatTookBySector: {}, fellBack: 0,
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
  // Set after confirmNewGame for the same reason odChoices is - a fresh run must not reset it.
  ELITE_OFFER_CARDS = eliteOffer;
  RECRUIT_TERMS_ON = recruitTermArm !== 'off';
  MORALE_ON = moraleArm !== 'off';
  MORALE_PAYS = moraleArm === 'pay';
  CAP_SHAPE_ON = capShapeArm !== 'off';
  PRESSED_ON = pressedArm !== 'off';
  // #230: set AFTER confirmNewGame, like every other arm, because confirmNewGame is what rebuilds
  // the run. Empty leaves the shipped constant untouched rather than writing it back over itself.
  if (wallHp) SECTOR_HP_SCALE = Number(wallHp);
  if (wallDmg) SECTOR_DMG_SCALE = Number(wallDmg);
  // M-audit: AFTER confirmNewGame, which zeroes odChoices - the first cut set it before and the
  // arm silently did nothing, which is the same shape as every other harness bug this phase
  // found. Set here rather than at the fire site because odChoices is exactly what the engine's
  // own prompt writes, so this is the player's door rather than a back one.
  if (odPolicy === 'second') {
    odChoices = Object.fromEntries(Object.entries(OVERDRIVES)
      .filter(([, pair]) => pair.length > 1).map(([cls, pair]) => [cls, pair[1].id]));
  }
  stat.contractMult = runStats.contractMult;
  stat.frontsSeen.push(sectorFront);

  // The template deploys the same three operators every time, so a sim that leaves the formation
  // alone measures three classes and reports the other four as dead content. A player rotates the
  // roster; so does this.
  // A player fields a line, not a lottery: someone to hold the front, usually a medic, and
  // whoever else. The old shuffle regularly deployed three glass cannons and measured the
  // resulting deaths as difficulty.
  // O21: AND IT RUNS BEFORE THE DRAFT NOW, BECAUSE A DOCTRINE IS A QUESTION ABOUT A DECK.
  // It used to run in the muster tail, forty lines BELOW the doctrine take - so the draft asked
  // holds() of decks this policy was about to change, and the change is exactly the kind a
  // prohibition cares about. The Scavenger is the clean case: their fourth is a SHIV, the engine
  // benches the fourth by default, so at draft time their deck reads clean and NO HANDS signs
  // off on them; this policy then benches the basic instead, SHIV comes off the bench, and the
  // run starts with the rule already false. Measured before the move, on 12 careers at
  // `--draft doctrine:NO_HANDS`: 553 of 689 fight doors ran with the doctrine BROKEN, and the
  // first breach landed at sector 1, fight 1. A loadout is decided before a promise is made.
  const applyBench = c => {
    if (!c || masteryRank(c.classType) < 3) return;
    const basic = (ABILITIES[c.classType] || []).find(a => !a.cd && a.reach !== 'self');
    if (basic) c.benchedMove = basic.move;
  };
  playerRoster.forEach(applyBench);
  const slots = hasContract('SHORT_HANDED') ? [1, 2] : [1, 2, 3];
  playerRoster.forEach(p => { p.gridPos = 0; });
  const byClass = c => playerRoster.filter(p => c.includes(p.classType));
  const pickFrom = list => list[Math.floor(Math.random() * list.length)];
  const draft = [];
  let wantDoctrine = null;   // aimed at while drafting; banked below, once ranks are real
  // O12: G13's FIX, FACTORED, BECAUSE THE TWO DOCTRINE POLICIES HAD ALREADY DRIFTED APART.
  // G13 found that building a line one legal member at a time asks holds() of every PREFIX, and
  // three of the seven cannot be true of one - BROAD SPECTRUM wants all three damage types
  // across the line, and THE WALL asks who holds rank 1 when no rank has been handed out yet.
  // It rewrote the pooled `--draft doctrine` branch to build, place, then ask. It left the
  // identical prefix test in `--draft doctrine:<id>` ten lines above, and its own comment names
  // THE WALL as the case that breaks.
  //
  // That sat there until O12 pointed `--draft doctrine:THE_WALL` at it and got the guard G13
  // built firing on every line of the report: 150 of 150 RUNS FIELDED NOBODY, three careers
  // running to completion and reporting a deepest sector of 1, 0 commanders and 0 elites. The
  // guard worked perfectly; the thing it guards had a second door.
  //
  // One helper now, so a third caller cannot reintroduce it. Ordering matters because THE WALL
  // reads rank 1, so this walks ordered selections rather than combinations.
  const lineKeeping = d => {
    const place = line => { playerRoster.forEach(p => { p.gridPos = 0; });
                            line.forEach((p, i) => { p.gridPos = slots[i]; }); };
    const ordered = (pool, k) => k === 0 ? [[]]
      : pool.flatMap((c, i) => ordered(pool.filter((_, j) => j !== i), k - 1).map(rest => [c, ...rest]));
    const cands = ordered(playerRoster, Math.min(slots.length, playerRoster.length))
      .sort(() => Math.random() - 0.5);
    let held = null;
    if (arrange !== 'front') {
      for (const cand of cands) { place(cand); if (d.holds(cand)) { held = cand; break; } }
    } else {
      // O13: the best front rank among the lines that hold, rather than the first line that
      // holds. Melee first, then weight - THE WALL's own two tests, used to rank instead of to
      // reject. Every candidate is still placed before being asked, because that is the whole
      // point of this helper.
      let best = -1;
      for (const cand of cands) {
        place(cand);
        if (!d.holds(cand)) continue;
        const f = cand[0];
        const score = (carriesMelee(f) ? 1e6 : 0) + baseHpOf(f);
        if (score > best) { best = score; held = cand; }
      }
    }
    playerRoster.forEach(p => { p.gridPos = 0; });   // the tail below does the real placing
    return held;
  };
  if (draftPolicy === 'random') {
    // No shape at all: whatever the roster hands you. This is the floor.
  } else if (draftPolicy.startsWith('doctrine:')) {
    // One named doctrine, every run, so a pool average cannot hide a single expensive one.
    const want = draftPolicy.slice(9);
    const d = doctrineById(want);
    if (d) {
      doctrineOffer = [want];
      const held = lineKeeping(d);
      if (held) { draft.push(...held); wantDoctrine = want; }
      // And it reports rather than fielding nobody, which the pooled branch already did and
      // this one did not: an arm aimed at a doctrine this roster cannot keep is a finding about
      // the doctrine, not a run to quietly throw away.
      else { stat.doctrineUnfieldable = want; }
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
    const held = lineKeeping(d);
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
  // O12: AND THE SAME PREFIX TEST WAS HERE TOO, IN A THIRD PLACE. This tail tops up any draft
  // that came back short, and it filtered candidates by asking holds() of the draft-so-far plus
  // one candidate - the exact test G13 deleted from one branch and I had just deleted from a
  // second. (Spelled out in words rather than in code, because the suite row below asserts that
  // the literal appears nowhere in this file and a comment quoting it would red the row.) It was
  // dormant: the
  // only policies that leave a short draft (`only:` and the default line) never set
  // wantDoctrine, so `d` was always null here and the filter never ran. Dormant is not the same
  // as harmless - a doctrine policy that ever returned a partial line would have walked straight
  // into it - and it is exactly the copy nobody re-reads. Found by the suite row written to hold
  // the first fix, which is what that row is for.
  //
  // Dropped rather than converted: the doctrine branches place a whole line through lineKeeping
  // above, so there is nothing for a doctrine-aware top-up to do, and a predicate on a partial
  // line cannot be asked correctly in any case.
  while (draft.length < slots.length) {
    const rest = playerRoster.filter(p => !draft.includes(p));
    if (!rest.length) break;
    draft.push(pickFrom(rest));
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
    // O11: the control arm. The offer is still rolled and still read - doctrineOffered and
    // doctrineLive below are the same numbers either way, so the census stays honest - and the
    // take is what is withheld.
    if (take && doctrinePolicy !== 'off') { activeDoctrine = take; stat.doctrine = take; }
    stat.doctrineSuppressed = !!take && doctrinePolicy === 'off';
    stat.doctrineOffered = doctrineOffer.slice();
    stat.doctrineLive = doctrineOffer.filter(id => { const d = doctrineById(id); return d && d.holds(standing); });
  }
  // The real deploy button is what applies a doctrine's edge and banks its multiplier, so the
  // sim goes through it rather than around it.
  musterDeploy();
  // O21: who the muster actually put on the field, by id, so the door check below can tell a
  // body that was drafted from one that turned up later. The draft's own list is not enough -
  // the tail tops it up, the arrangement can move people, and musterDeploy is the last word.
  const openingLine = playerRoster.filter(p => p.gridPos > 0).map(p => p.id);
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
  playerRoster.forEach(applyBench);
  // The opening draft, so a run that never reaches a fight still reports who it picked.
  // Everyone who actually stands in a line is added at the door of each fight below.
  stat.deployed = playerRoster.filter(p => p.gridPos > 0).map(p => p.classType);
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
      // F10: the banking arm. A capstone on the table is taken by every policy - that is not the
      // question - and what `bank` changes is the OTHER branch, where this file used to press a
      // signature or, failing that, whatever card sat first.
      if (perkPolicy === 'bank' && capIdx < 0) {
        stat.capsBanked = (stat.capsBanked || 0) + 1;
        bankPerkOffer();
        stat.promotions++;
        continue;
      }
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
    // M01: AND THE SCAR THE OUTPOST WILL TAKE OFF. This file counted scars from the day they
    // shipped and never treated one, so the only decision C02 built - is this worth 120 scrap -
    // has never been exercised by the instrument. That is the D06 shape: a feature measured by
    // a harness that cannot reach it, and it matters more now that M01 made the scars differ
    // from each other in how bad they are.
    //
    // Deliberately a NAIVE policy, and named as one. It treats what it can comfortably afford,
    // preferring the line over the bench; it does not read the road ahead. A policy that scored
    // each scar against the coming sector would measure my own model of a player rather than
    // the game - the D05 trap - so the interesting comparison (does road-reading beat this?)
    // is filed as its own arm rather than smuggled in as the default.
    if (scarPolicy !== 'off') {
      const carrying = [...playerRoster].sort((a, b) => (b.gridPos > 0) - (a.gridPos > 0));
      for (const c of carrying) {
        for (const id of [...(c.scars || [])]) {
          // M03b: the price is in SKULLS now, and the policy has to ask the right purse. Kept at
          // "comfortably afford" rather than "can afford" for the same reason as before - a
          // policy that spends its last skull on a scar is modelling a player nobody is.
          const cost = typeof scarTreatCost === 'function' ? scarTreatCost() : 40;
          if (cost > 0 && bossSkulls < cost * 2) continue;
          const had = (c.scars || []).length;
          healScar(c.id, id);
          if ((c.scars || []).length < had) stat.scarsTreated = (stat.scarsTreated || 0) + 1;
        }
      }
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
        // M02: WHY a point falls through to a stat card, which decides whether 91% is the game or
        // the policy. Two very different answers: the operator has no signature LEFT to buy
        // (a structural ceiling - signatures are finite per body, stat cards are not), or it has
        // one and cannot afford it (an economy question). Counted separately.
        if (!open.length) stat.sigNoneLeft = (stat.sigNoneLeft || 0) + 1;
        else if (scrap < sigBuyCost()) stat.sigTooDear = (stat.sigTooDear || 0) + 1;
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
        // M02: AND THE STAT CARD, WHICH NOTHING HAS EVER COUNTED. The rows above have reported
        // signatures and capstones since E08b; the five flat perks beside them on the same card
        // have never appeared in this report at all, so "is the stat pool thin" has never been a
        // question anyone could answer.
        //
        // M04: the pick is a decision now, so there is a policy. `random` is M02's arm, kept as
        // the default so those records stay comparable. `fit` narrows to the cards whose
        // condition this body meets and still picks uniformly inside that set, so it encodes the
        // condition and not a ranking - deciding which of the five is strongest and measuring
        // that would be measuring my own taste rather than the game's.
        //
        // Both axes are read off the body rather than off the fight, which is the correction the
        // first cut of M04 needed: its `fit` set counted HONED as suiting any backline body, and
        // HONED then keyed on the TARGET's distance, which fired on 21% of swings whatever rank
        // threw them. One of the three cards it was picking from was nearly dead, which is why
        // that arm could not answer the question it was built for. Rank and deck are both
        // decided at the Outpost and hold for as long as the player leaves them alone.
        const fits = [
          c.gridPos === 1 ? 'HARDENED' : 'SWIFT',
          carriesMelee(c) ? 'VETERAN' : 'HONED',
          'FORTIFIED'                       // asks nothing, so it fits every body
        ];
        const from = perkPolicy === 'fit' ? fits : PERK_POOL.map(p => p.id);
        const pick = from[Math.floor(Math.random() * from.length)];
        // Whether the card bought was one this body will meet the condition of, counted under
        // BOTH arms - so the random arm reports its own hit rate rather than leaving it modelled.
        if (fits.includes(pick)) stat.statFit = (stat.statFit || 0) + 1;
        assignPerk(c.id, pick);
        if (c.perkPoints < had) {
          stat.statsBought = (stat.statsBought || 0) + 1;
          stat.statPicks = stat.statPicks || {};
          stat.statPicks[pick] = (stat.statPicks[pick] || 0) + 1;
        }
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
      // M09's arm. Only the holder, only its OWN mark, and only when that mark is still standing
      // and reachable with the move in hand - so what this measures is "can the card's holder get
      // to it if it tries", which is the question the blind arm cannot answer.
      if (markPolicy === 'own' && typeof hasTrait === 'function' && hasTrait(actor, 'CALLED_SHOT')) {
        const mine = pool.find(f => (f.markedTurns || 0) > 0 && f.markedBy === actor.id);
        if (mine) { stat.markTaken = (stat.markTaken || 0) + 1; return mine; }
      }
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
      // M07: a tactic is bought and the turn CARRIES ON - buy() does not return, and the actor
      // still picks a move below. Counting it in stat.moves beside things that end a turn is
      // what made M06's basic-attack share unreadable, so the free ones are tallied apart.
      stat.freeActions = (stat.freeActions || 0) + 1;
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
      // M07: what this ranking was actually choosing between. M06 ended on a figure it could not
      // interpret - basic attacks at 4.4-4.7% of "moves" - and the first thing wrong with it was
      // the denominator: stat.moves counts tactic purchases, which are FREE and do not consume
      // the turn, beside actions that do. STIM alone is a fifth of that total. turnsPlayer has
      // been the honest denominator all along and no readout used it.
      //
      // The second thing is that a share cannot say whether the basic attack was a CHOICE. The
      // deck is already filtered to what is off cooldown, so a basic attack wins either because
      // nothing else was up, or because everything else was soft or resisted against this board.
      // Those are opposite findings and the share conflates them, so both are counted here: how
      // deep the hand was, and whether the pick was forced.
      // Counted here too, and not skipped: this block is only reached when none of the earlier
      // cases claimed the turn - a combo, a rescue, a guard, a vent. Dividing a numerator that
      // only exists on THIS path by every turn the squad took is the same error M06 made with
      // the move tally, one level down, so the path has its own denominator.
      stat.ranked = (stat.ranked || 0) + 1;
      const special = usable.filter(a => a.cd).length;
      stat.handDepth = stat.handDepth || {};
      stat.handDepth[Math.min(special, 4)] = (stat.handDepth[Math.min(special, 4)] || 0) + 1;
      if (chosen && !chosen.cd) {
        stat.basicPicked = (stat.basicPicked || 0) + 1;
        if (!special) stat.basicForced = (stat.basicForced || 0) + 1;
      }
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
    // O21: THE LINE, CHECKED AGAINST THE PROMISE IT IS BEING PAID FOR. O20 closed on one
    // question it could not answer: a NO HANDS career throws a quarter of its damage in melee,
    // and the moves it throws are heavy_wrench and shield_slam - the Bruiser's base deck, a
    // class that can never pass carriesMelee and so can never be drafted into that line. I
    // proposed a mechanism for that three times (the Scavenger's knife, the BAYONET, and
    // closeRanks) and was wrong three times, so this stops proposing one. It asks the doctrine
    // its own holds() of whoever is standing at each fight door, and when the answer is no it
    // records the line that failed rather than a theory about why.
    //
    // The badge reads live the whole time - taken on 150 runs of 150, kept on 150 of 150 - so
    // if a breach is ever seen here, the run is being paid a multiplier for a rule that is not
    // true of the field. That is the whole finding, and it needs no interpretation: the line's
    // own classes are the answer, and whether each body was at the muster or arrived later.
    stat.docDoorAll++;
    // P02: WHETHER THE BENCH JOB IS STILL IN FORCE, asked at the door rather than at the muster.
    // stat.benchHeld below records that a job was TAKEN, and the report printed that as "held on
    // all N runs" - but the game pays the job through hasBenchJob -> benchJobHolder, and that
    // function's own comment states the condition: "The holder has to be on the roster and on the
    // bench: a job whose holder was deployed after the muster is not in force." closeRanks draws
    // its replacement from exactly that pool and does not exclude them, so the job ends the first
    // time a rank falls empty and they are the healthiest body left. Two questions, two numbers.
    if (benchPolicy !== 'off') {
      stat.benchNodes++;
      if (benchJobHolder()) stat.benchInForce++;
    }
    // O22: HOW MANY BODIES ARE ACTUALLY STANDING. Named doorBodies and not lineSize, because
    // lineSize is TAKEN - G13 books it once per run as a number and the report reads it as
    // `r.lineSize === 0` to find runs that fielded nobody. Seeding it as an array here turned
    // that guard's own field into a list and the arm died at the first door with "push is not a
    // function", which is the cheap version of this mistake; the expensive version is the one
    // that keeps running and quietly answers a different question. The control arm priced the CARD alone - same
    // line, take withheld - at -4.34 wins, and a card that pays +15% and softens incoming melee
    // cannot cost four wins through its multiplier. closeRanks is where it goes: it will not step
    // a body into a vacated rank when that would break the promise, and says so in as many words
    // ("Better to leave the rank empty"). Under NO HANDS most of the bench carries melee, so a
    // casualty is not replaced for the rest of the run. That is a structural claim about the SIZE
    // of the line, so it is counted at the door rather than argued from the win column.
    {
      const standing = playerRoster.filter(p => p.gridPos > 0).length;
      stat.doorBodies.push(standing);
      // O23: AND THE SAME COUNT ON LIVE DOORS ONLY, because two of the seven cards spend most of
      // a run broken - BROAD SPECTRUM ran live at 42% of doors and THE WALL at 37% - and a share
      // taken over every door is then a blend of "the card is refusing step-ins" and "the card is
      // dark and refusing nothing". That blend understates the live effect on exactly the two
      // cards whose rule is hardest to keep, which is the wrong direction to be wrong in.
      if (activeDoctrine && !doctrineBroken) stat.doorBodiesLive.push(standing);
    }
    if (!activeDoctrine || doctrineBroken) {
      const k = (!activeDoctrine ? 'never taken' : 'broken') + ' s' + currentSector;
      stat.docDark[k] = (stat.docDark[k] || 0) + 1;
    }
    if (activeDoctrine && !doctrineBroken) {
      const d = doctrineById(activeDoctrine);
      const line = playerRoster.filter(p => p.gridPos > 0);
      stat.docDoor++;
      if (d && !d.holds(line)) {
        stat.docBreach++;
        const key = line.map(c => c.classType + (openingLine.includes(c.id) ? '' : '*'))
                        .sort().join('+') || '(empty)';
        stat.docBreachLine[key] = (stat.docBreachLine[key] || 0) + 1;
        // A star above means the body was not on the field at the muster. Counted on its own
        // too, because that is the difference between a line that was wrong from the start and
        // one that became wrong when somebody walked into it.
        line.filter(c => !openingLine.includes(c.id)).forEach(c => {
          stat.docArrived[c.classType] = (stat.docArrived[c.classType] || 0) + 1;
        });
        if (!stat.docBreachFirst) {
          stat.docBreachFirst = activeDoctrine + ': ' + key + ' at sector ' + currentSector +
                                ', fight ' + stat.fights;
        }
      }
    }
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
    let rounds = 0, fled = false, fellBack = false;
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
      // This census runs BEFORE the taking policy below and books every losing moment, so on the
      // default arm it is the shipped baseline - the split describes the game rather than a
      // robot's taste. Splitting "the door was relevant" from "the door was affordable" is H10's
      // lesson: a door nobody walks through is an empty purse or a closed gate before it is ever
      // a dull offer.
      //
      // O16: AND UNDER `--retreat losing` IT IS NOT A BASELINE, which the row has to say rather
      // than leave to whoever reads it. The counts are still taken at the right moment, but a run
      // that has been breaking off is a different run by the second sector - different purse,
      // different depth, different nodes - so affordability on that arm describes the arm, not
      // the game. Compare arms on it at your peril; the default is the one I01's figures came
      // from and the one they are still comparable to.
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
      // O16: AND THE POLICY THAT TAKES IT, above withdrawing because a fall-back keeps the node
      // and a withdrawal gives it up. canRetreat() is asked of the engine - no hand copy of the
      // gate - and retreat() is pressed twice because it arms on the first press like withdraw.
      if (actor.isPlayer && retreatPolicy !== 'off' && losing(enemyStartHp) && canRetreat()) {
        const purse = scrap, down = bleedingOut().slice();
        stat.retreatTook++;
        stat.retreatTookBySector['s' + currentSector] = (stat.retreatTookBySector['s' + currentSector] || 0) + 1;
        retreat(); retreat();
        stat.retreatPaid += purse - scrap;
        if (!combatActive) {
          // The break worked. fallBackToNode has already run recoverDowned, so the bodies it
          // picked up are counted here for the same reason withdraw's are: the scar denominator
          // is every operator recovered, and one missing branch read 12% against a 0.08 chance.
          countBodies();
          stat.recovered += down.length;
          down.forEach(e => stat.clockLeft.push(e.downTurns || 0));
          fellBack = true;
          break;
        }
        // It failed: the scrap is gone and so is the turn. retreat() called nextTurn(), which
        // opened the NEXT actor's turn through the engine - turn-start applied, turn counted.
        // That is what engineOpened is for, so the loop accepts that turn instead of re-opening
        // it. Without this line the actor behind the break gets two turn-starts and two counts,
        // which is the double-tick I01 filed as the blocker and I02 had already solved.
        stat.retreatFailed++;
        engineOpened = turnQueue[activeIndex];
        continue;
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
      // R02: noteSquadTurn does the increment AND books what was standing when the turn opened.
      // Called rather than re-implemented, so this loop and the engine's cannot drift - the
      // census's first cut hooked processTurn alone and this loop walked straight past it.
      if (actor.isPlayer && fightLog && !engineDidOpen) {
        noteSquadTurn();
        // R02: the clock, checked through the engine's own door. This loop re-implements the
        // turn walk (I02), so a check written only into processTurn would never fire here - the
        // exact way R02's census first read one sample per fight instead of one per turn.
        if (pressedOut()) break;
      }
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
    // T06: the same slice, split by whether the fight they fell in was on one of R02's clocks.
    // R02b read the clock as converting deaths into setbacks; if that is where the saved bodies
    // are, the clock's ~20% of fights should carry materially less than 20% of the deaths.
    // AND THE DENOMINATOR HAS TO EXCLUDE COMMANDERS OR IT SAYS NOTHING. R02's clock is never
    // dealt to a commander fight, and tier ten takes 89% of every wipe - so "clocked fights carry
    // 3% of deaths against 20% of fights" is mostly the clock being absent from the fights that
    // kill people. Split four ways and read the ROAD half; the boss half is the confound, printed
    // so it can be seen rather than assumed away.
    (runStats.fallen || []).slice(stat.lost.length).forEach(f => {
      const k = (f.boss ? 'boss' : 'road') + (f.clocked ? 'Clocked' : 'Plain');
      stat.deadBy = stat.deadBy || { roadClocked: 0, roadPlain: 0, bossClocked: 0, bossPlain: 0 };
      stat.deadBy[k]++;
      stat.lost.push(f.name);
    });
    activeEntities.forEach(e => { delete e.__counted; });
    stat.rounds += rounds;
    // O16: a fall-back is not a withdrawal. The node is un-cleared and retreatNode sends the
    // walk straight back at it, so the run has spent scrap and a fight and kept the node; a
    // withdrawal gives the node up and takes a wound and a pursuit. Counted apart.
    if (fellBack) { tallyScars(); stat.fellBack++; return 'fellback'; }
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
    // T06: labelled SIM_END rather than left unlabelled, because this stand-in is 82% of every
    // recovery in a simulated career and an unlabelled majority reads as a fifth door the game
    // has. It is this loop standing in for the engine's own ending, which the comment above
    // explains; the engine's WON door reads 1% here for the same reason.
    const up = recoverDowned(won ? 'once the field is held' : 'as the squad is dragged off',
                             won ? 'SIM_END_WON' : 'SIM_END_WIPE');
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
    // O06: A FORK OF ONE IS NOT A FORK, and "58% of decisions were all fights" does not separate
    // a corridor from a choice between two different roads. Bucketed by how many fight nodes were
    // actually on the table and how many DISTINCT factions they were, because a fight against the
    // Choir and a fight against the Carrion are different fights - different pool, formation,
    // ground and sky - and counting them as "two fights" hides the only variety the road has.
    {
      const fightsHere = avail.filter(isFight);
      const kinds = [...new Set(fightsHere.map(n => n.type))];
      stat.forkShape = stat.forkShape || {};
      const k = avail.length === 1 ? 'forced'
              : fightsHere.length <= 1 ? 'oneFightPlusOther'
              : kinds.length > 1 ? 'factionsDiffer' : 'sameFactionTwice';
      stat.forkShape[k] = (stat.forkShape[k] || 0) + 1;
    }
    stat.takenNodes[kindOf(node)] = (stat.takenNodes[kindOf(node)] || 0) + 1;
    if (!isFight(node)) stat.tookNonFight++;
    // K10: the bench arm. Stamped here rather than at generation because a node's sky is rolled
    // when the map is, and a run crosses seven of them - this catches every fight on every map
    // with one line, and leaves the node untouched when no arm is asked for.
    if (skyArm && (node.type === 'BOSS' || FIGHT_NODES.includes(node.type)))
      node.weather = skyArm === 'none' ? 'CLEAR' : skyArm;
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
          who: tpl.classType, rank: tpl.rank, term: recruitTerm(),
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
      const term = recruitTerm();
      // R04: A LINE OFFER IS NOT AN AFFORDABILITY QUESTION - the rank IS the price - so the purse
      // gate below cannot decide it, and a policy that only reads the purse would take every one
      // of them for free and report that free bodies are popular. Both policies ask the same
      // merit question here, which is the question the card asks: is the line short, or does this
      // hand out-rate the body that would step down for it.
      //
      // Compared on the ARRIVAL rather than the template, and deliberately differing from the
      // `value` policy twenty lines down, which compares a raw template against an upgraded
      // incumbent and says in its own comment that this understates the recruit. Here the
      // understatement would be a thumb on the scale for the arm being measured, and
      // recruitArrival is exactly what the card quotes - so the policy reads what the player
      // reads. The gap between the two bases is named rather than quietly reconciled.
      if (term === 'LINE' && tpl) {
        const line = deployed();
        const seats = hasContract('SHORT_HANDED') ? DEPLOYED - 1 : DEPLOYED;
        const out = recruitDisplaced();
        const arr = recruitArrival(tpl);
        wants = line.length < seats || (!!out && (arr.dmgBase + arr.maxHp / 4) > handRate(out));
        why = !wants ? 'declined-line' : (line.length < seats ? 'seat' : 'better-line');
        stat.recruitWhy[why] = (stat.recruitWhy[why] || 0) + 1;
      }
      else if ((recruitPolicy === 'value' || recruitPolicy === 'burn') && tpl) {
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
      // The reserve is a scrap rule and a LINE offer never touches the scrap, so it does not
      // apply to one. Keeping it would have declined free bodies for want of triage money.
      if (tpl && wants && (term === 'LINE' || scrap >= pendingRecruit.cost + 80)) {
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
        // R04: a LINE recruit was placed by signOnRecruit, on the engine's own rule and over the
        // body the card named. Running this block on top would field them a second time and, on
        // a full line, bench somebody twice for one signing.
        if (me && term === 'LINE') {
          if (me.gridPos > 0) stat.recruitFielded = (stat.recruitFielded || 0) + 1;
          else stat.recruitBenched = (stat.recruitBenched || 0) + 1;
        }
        else if (me) {
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
    // O16: the same shape, and availableNodeIds() puts the squad back in front of the same node
    // because fallBackToNode set retreatNode - so the next pass re-faces it rather than walking on.
    if (outcome === 'fellback') { spend(); continue; }

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
    }
    // O05: AND THE RESOLVER SITS AT THE NODE NOW, NOT INSIDE THE COMMANDER BRANCH. O05 built an
    // elite offer, watched every card fall on the floor, and reverted - the engine stages an
    // offer from checkWinState and shows it through afterNode, a path this file deliberately does
    // not take (it banks so it can drive resolveConsequence itself, see G04). But the half that
    // was actually in this file's gift was never the path: it was that the only code here which
    // PICKS a card lived inside `if (node.type === 'BOSS')`. A commander's offer resolved; an
    // offer staged by anything else could not, whoever staged it.
    //
    // Lifted out, it is a no-op today - nothing but the commander branch stages one, and the
    // relic rows below are identical across a paired run - and it is the whole of "plumbed
    // through a walked path". The elite drop is still a grant (rollRelic straight into
    // activeRelics, 56% of the shelf by O04's census); what changes is that an offer from ANY
    // node would now be picked up rather than staged and dropped.
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
  stat.qk = runStats.qk || {};             // M05: every quirk condition, asked and answered
  stat.sg = runStats.sg || {};             // M06: and every signature condition beside them
  stat.sgGate = runStats.sgGate || {};     // the ability half of the three that are a conjunction
  stat.rch = runStats.rch || null;         // M08: how far off the target was, and how many were up
  stat.frt = runStats.frt || {};           // and the same split per card that reads it
  stat.hl = runStats.hl || null;           // and the haul, which is the one verb that sets it up
  stat.cv = runStats.cv || null;           // M08b: what the ground's front cover is reaching
  stat.mk = runStats.mk || null;           // M09: every mark placed, cashed and run out
  stat.od = runStats.od || {};             // M-audit: which half of each overdrive pair fired
  stat.odPairs = Object.keys(OVERDRIVES || {}).length;   // read in the page; the report has no OVERDRIVES
  stat.cb = runStats.cb || {};             // M11: every one of the ten pairings, and what it bought
  stat.bl = runStats.bl || {};             // #197 tier A: every bleed, by what opened it
  stat.mit = runStats.mit || {};           // N01: mitigate's calls against the blows that landed
  stat.reach = runStats.reach || {};       // O15: what reaches the squad, by attacker reach x rank
  stat.out = runStats.out || {};
  stat.outMoves = runStats.outMoves || {};   // O20: which move, when it reads as melee
  stat.outMelee = runStats.outMelee || {};   // O21: and which body, under which promise
  stat.eliteOffers = runStats.eliteOffers || 0;   // O05: did the elite branch stage anything
  stat.fightShape = runStats.fightShape || null;    // R02: how long a fight runs and where it hurts
  stat.pressedMet = runStats.pressedMet || 0;       // R02: fights that carried a clock
  stat.pressedOut = runStats.pressedOut || 0;       // R02: and fights the clock actually ended
  stat.grudgePhase = runStats.grudgePhase || null;  // R01: is the grudge phase a slice anyone plays
  stat.capShaped = runStats.capShaped || 0;        // R01: and how often the capped shape fired
  stat.capRefund = runStats.capRefund || 0;        // R01: and what it handed back to get there
  stat.anchorFell = runStats.anchorFell || null;  // R03: where in a fight its biggest body dies
  stat.broke = runStats.broke || 0;              // R03: fights where a side lost its nerve
  stat.brokeBodies = runStats.brokeBodies || 0;  // R03: bodies that broke
  stat.fled = runStats.fled || 0;                // R03: and bodies that got away with it
  stat.lineTerms = runStats.lineTerms || 0;      // R04: signings that were paid in a rank
  stat.walkedOff = runStats.walkedOff || 0;      // R04: and rank-holders benched, who left           // O15: and what the squad throws, by the reach of the move
  // O16: read back what the ENGINE booked, not what the policy thinks it pressed - G13's rule.
  // The two are printed against each other so a policy that silently does nothing says so.
  stat.engineRetreats = runStats.retreats || 0;
  stat.engineRetreatsFailed = runStats.retreatsFailed || 0;
  // The full key list, not just a count: the report is asked which pairings NEVER fired, and a
  // count can only say how many are missing. Same key the census builds, so the two cannot drift.
  stat.cbAll = (COMBOS || []).map(c => `${c.move}>${c.needs.replace('Turns', '')}`);
  // And which of those belong to a class a career has to RECRUIT rather than start with. Three of
  // the ten do, and a cold column is far likelier to be a roster history than a finding - which
  // is a mistake this file's M11 record has already published and withdrawn once.
  {
    const recruit = new Set((RECRUIT_POOL || []).map(r => r.classType));
    const clsOf = m => Object.keys(ABILITIES).find(k => ABILITIES[k].some(a => a.move === m))
                    || Object.keys(FOURTH_ABILITIES).find(k => FOURTH_ABILITIES[k].move === m);
    stat.cbRecruit = (COMBOS || []).filter(c => recruit.has(clsOf(c.move)))
                                   .map(c => `${c.move}>${c.needs.replace('Turns', '')}`);
  }
  stat.qkDrawn = runStats.qkDrawn || {};   // and what the pool actually handed out
  stat.ut = runStats.ut || {};   // L03: the damage the type ledger cannot see
  stat.brokeKept = runStats.brokeKept || null;   // T06: bodies a break picked up, by its cause
  stat.offFloor = runStats.offFloor || null;    // T06: every door a body comes off the floor through
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
  // O21: READ AT THE END OF THE RUN, WHICH IS WHAT THE ROW HAS ALWAYS CLAIMED TO SAY. This sat
  // in the muster tail, four lines below the take - "still keeping it at the end" was a reading
  // taken at the START, and it could only ever come back 100%. Three items were spent on what
  // that number hid. O18 priced NO HANDS against a career it believed was carrying the card the
  // whole way; O20 found a quarter of that career's damage thrown in melee and, reading the same
  // row, concluded a Bruiser must be standing in a line that cannot draft one; and I proposed
  // three mechanisms for that and was wrong three times. The doctrine was simply BROKEN - 553 of
  // 689 fight doors on the arm that found it - and a broken doctrine pays nothing and forbids
  // nothing, so the melee was ordinary play by an ordinary line. One row, read four lines too
  // early, is the whole of it.
  stat.doctrineKept = !!activeDoctrine && !doctrineBroken;
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
  let PERK_IDS = [], QUIRK_IDS = [], CONDITIONAL_QUIRKS = [], STAT_QUIRKS = [];
  let CONDITIONAL_SIGS = [], MOVE_GATED_SIGS = [], BASIC_ATTACKS = [];
  let SIG_SHAPES = { applied: 0, moveGated: 0, other: 0, total: 0 };
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
  PERK_IDS = await page.evaluate(() => PERK_POOL.map(p => p.id));
  // Read off the engine rather than listed here - a hand-kept copy of a content pool in this
  // file is the F03 defect, and the whole point of the census is that it cannot fall behind.
  QUIRK_IDS = await page.evaluate(() => QUIRK_POOL.map(q => q.id));
  // The ones whose whole effect is a stat written at the muster, read off the pool's own
  // numbers. These have no runtime read and counting them as "never fired" would be a lie.
  STAT_QUIRKS = await page.evaluate(() =>
    QUIRK_POOL.filter(q => q.dmg || q.hp || q.spd).map(q => q.id));
  // M06: the conditional signatures, read off the resolver the same way the conditional quirks
  // are - the ids the `sig` dispatcher names ARE the set, so the census cannot fall behind a
  // signature that gains or loses a condition.
  CONDITIONAL_SIGS = await page.evaluate(async () => {
    const src = await (await fetch('game.js')).text();
    return [...src.matchAll(/sig\('([A-Z_]+)'/g)].map(m => m[1]);
  });
  // Which of those ask "which ability was this" rather than "what is true": read off the
  // condition the resolver actually passes, so a signature that gains or drops a move gate
  // moves between the two lists without anybody remembering to edit one.
  MOVE_GATED_SIGS = await page.evaluate(async () => {
    const src = await (await fetch('game.js')).text();
    return [...src.matchAll(/gate\('([A-Z_]+)'/g)].map(m => m[1]);
  });
  // The no-cooldown opener of every class, read off the ability table rather than listed here.
  BASIC_ATTACKS = await page.evaluate(() =>
    [...new Set(Object.values(ABILITIES).flat().filter(a => !a.cd && a.act !== 'self').map(a => a.move))]);
  // And the shape of the rest of the pool, so the eight are never read as the whole of it.
  SIG_SHAPES = await page.evaluate(async () => {
    const src = await (await fetch('game.js')).text();
    const cond = new Set([...src.matchAll(/sig\('([A-Z_]+)'/g)].map(m => m[1]));
    let applied = 0, moveGated = 0, other = 0;
    SIG_PERKS.forEach(p => {
      if (cond.has(p.id)) return;
      if (p.apply) { applied++; return; }
      // A move-gated signature is named on a line that also names a pendingAction or a deck
      // move; anything else is read some other way (traitOnField, a cooldown, a reach).
      const lines = src.split('\n').filter(l => l.includes(`'${p.id}'`) && !/^\s*\{ id:/.test(l));
      if (lines.some(l => /pendingAction|cooldowns\.|livingEnemies|bleedingTurns|oiledTurns/.test(l))) moveGated++;
      else other++;
    });
    return { applied, moveGated, other, total: SIG_PERKS.length };
  });
  // Which of them carry a condition, also read off the engine: quirkDmgMult is the one place
  // a quirk is asked a question, so the ids it names ARE the conditional set.
  CONDITIONAL_QUIRKS = await page.evaluate(async () => {
    const src = await (await fetch('game.js')).text();
    const at = src.indexOf('function quirkDmgMult(');
    let d = 0, i = src.indexOf('{', at), end = i;
    for (; end < src.length; end++) {
      if (src[end] === '{') d++;
      else if (src[end] === '}') { d--; if (!d) break; }
    }
    const body = src.slice(i, end);
    const out = []; const re = /on\('([A-Z_]+)'/g; let m;
    while ((m = re.exec(body))) out.push(m[1]);
    return out;
  });
  FINAL_SECTOR_N = await page.evaluate(() => FINAL_SECTOR);
  const ordSpec = await page.evaluate(id => { const o = orderById(id); return o ? { name: o.name, sectors: o.sectors } : null; }, ORDER);
  ORDER_NAME = ordSpec ? ordSpec.name : ORDER;
  ORDER_SECTORS = ordSpec ? ordSpec.sectors : FINAL_SECTOR_N;

  console.log(`\nSimulating ${RUNS} expeditions at difficulty ${DIFFICULTY}, draft ${DRAFT}${BENCH !== 'off' ? `, bench ${BENCH}` : ''}, tactics ${TACTICS}, relics ${RELICS}, meta ${META}, faces ${FACES}${RUNG > 0 ? `, ascension \u25B2${RUNG}` : ''}` +
              (CONTRACTS.length ? ` under ${CONTRACTS.join(', ')}` : '') +
              (WITHDRAW_POLICY ? ', running from fights it is losing' : ', fighting every node to a finish') + '\n');

  const results = [];
  for (let i = 0; i < RUNS; i++) {
    const r = await page.evaluate(EXPEDITION, { pressedArm: PRESSED_ARM, wallHp: WALL_HP, wallDmg: WALL_DMG, capShapeArm: CAP_SHAPE, moraleArm: MORALE_ARM, recruitTermArm: RECRUIT_TERM, eliteOffer: ELITE_OFFER, difficulty: DIFFICULTY, contracts: CONTRACTS, capNodes: 400, withdrawPolicy: WITHDRAW_POLICY, EXTRACT_AT, draftPolicy: DRAFT, benchPolicy: BENCH, tacticPolicy: TACTICS, AUGMENTS_ON, augPolicy: AUGMENT_POLICY, augCat: AUGMENT_CAT, augMax: AUGMENT_MAX, shelfSee: SHELF_SEE, shopPick: SHOP_PICK, trinketArm: TRINKET_ARM, skyArm: SKY_ARM, relicPolicy: RELICS, metaPolicy: META, facePolicy: FACES, endingPolicy: ENDING, orderPolicy: ORDER, rungPolicy: RUNG, stagePolicy: STAGE, stageProfile: STAGE_PROFILE, reckoning: RECKONING, reqPolicy: REQPOLICY, rescuePolicy: RESCUE, resignPolicy: RESIGN, recruitPolicy: RECRUIT, investPolicy: INVEST, scarPolicy: SCAR_POLICY, perkPolicy: PERK_POLICY, markPolicy: MARK_POLICY, odPolicy: OVERDRIVE_POLICY, doctrinePolicy: DOCTRINE_POLICY, arrange: ARRANGE, retreatPolicy: RETREAT_POLICY });
    results.push(r);
    if ((i + 1) % 10 === 0) process.stdout.write(`  ${i + 1}/${RUNS}\n`);
  }

  const n = results.length;
  // M07: a counter a run never touched comes back undefined here, and every sum built on it
  // then reads NaN - which only shows up on the day some run happens to score zero, and reads
  // as a broken report rather than as a missing initialiser. Every key this is asked for is a
  // numeric tally, so an absent one IS zero. Coerced once, here, rather than relying on each
  // new counter remembering to declare itself in newRunStats.
  // ── M-audit: one fold for every census this file adds up ───────────────────────────────
  // The same defect shipped three items running and a fourth was one edit away. M07 found a
  // missing key reading NaN and fixed the class in nums(); M08's per-card accumulator hand-listed
  // its keys and dropped one; M09's mark ledger listed two keys in the SUM and not in the SEED,
  // so `undefined + n` came out NaN, `|| 0` turned it into a believable zero, and a working card
  // read as absent for three runs. The audit then found five accumulators carrying that shape -
  // rch, hl, cv, qk, sg/sgGate - of which three did not even coerce, so a missing key would have
  // reached the page as a bare NaN.
  //
  // The cause is always the same: a key list maintained somewhere other than the thing it counts.
  // So there is no key list. This walks what the RUN actually carried - numbers are summed,
  // nested bags are folded key by key - which means a counter added to a note* function in
  // game.js arrives in the report without this file being edited at all. A key beginning with
  // `_` is a label rather than a count (a ground's multiplier, say) and is carried, not added.
  const foldStats = (into, from) => {
    if (!from || typeof from !== 'object') return into;
    Object.entries(from).forEach(([k, v]) => {
      if (k[0] === '_') { if (into[k] === undefined) into[k] = v; return; }
      if (typeof v === 'number') into[k] = (Number(into[k]) || 0) + v;
      else if (v && typeof v === 'object') foldStats(into[k] = into[k] || {}, v);
    });
    return into;
  };
  const foldAll = key => results.reduce((a, r) => foldStats(a, r[key]), {});
  const nums = key => results.map(r => Number(r[key]) || 0).sort((a, b) => a - b);
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
  // S03: ONE CONVENTION FOR EVERY ROW THAT JUDGES AN ARM, so two floors printed side by side
  // cannot be computed two different ways. The sd of a count of successes out of `of`, the sd of
  // the mean of three such careers, and the 3-sd bar two arms of three have to clear. K06 wrote
  // this for the win count; S03 measured that the wipe count on the line above resolves the same
  // difficulty question at 2.6x the separation, so both rows read it from here.
  const resolves = (count, of, unit) => {
      const p = count / of, sd = Math.sqrt(of * p * (1 - p)), arm = sd / Math.sqrt(3);
      return `±${sd.toFixed(1)} ${unit} on one career; an arm of three means ±${arm.toFixed(1)}, `
           + `so two arms of three only settle a gap wider than about ${Math.round(3 * arm * Math.SQRT2)} ${unit}`;
  };

  const signed = {};
  let withRecruits = 0;
  results.forEach(r => { if (r.recruited.length) withRecruits++; r.recruited.forEach(c => { signed[c] = (signed[c] || 0) + 1; }); });
  const met = results.flatMap(r => r.bossMet).filter(m => m.won !== undefined);
  const cold = met.filter(m => !m.grudge), risen = met.filter(m => m.grudge > 0);
  const rate = a => a.length ? (a.filter(m => m.won).length / a.length * 100).toFixed(0) + '%' : '-';
  // L05: what kind of number each row is. The L-audit filed this as "225 rows, 4 with an error
  // bar" and concluded the reader could not tell which survive the sample size. That count was
  // right and the conclusion was wrong - most of those rows are counts over thousands of events
  // and need no bar. What was actually missing was the reader being TOLD that, so the three
  // kinds are named once here rather than marked 225 times.
  console.log('\n── HOW TO READ THESE NUMBERS ' + '─'.repeat(29));
  console.log('  counts and shares over events (blows, purchases, fights, wipes by tier) read at');
  console.log('  any sample size. Per-career figures do not, and the two that carry the most weight');
  console.log('  say so themselves: every median prints a bootstrap 90% interval, and runs won');
  console.log('  prints the gap it can resolve. Anything labelled "mean" over ' + RUNS + ' runs sits');
  console.log('  between the two - stable for a common quantity, thin for a rare one.');
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
  // ── T06: R02b's "same bodies", asked of the bodies ──────────────────────────────────
  // R02b measured the clock costing 0.46 more wipes a run and saving 0.41 operators, and called
  // the pairing "suggestive of the same bodies" while saying nothing had isolated it. These rows
  // are that isolation, and they are a census rather than an arm: WHERE the saved bodies are,
  // not what the outcome was.
  const dead = results.reduce((a, r) => {
    const b = r.deadBy; if (!b) return a;
    Object.keys(a).forEach(k => { a[k] += b[k] || 0; }); return a;
  }, { roadClocked: 0, roadPlain: 0, bossClocked: 0, bossPlain: 0 });
  const road = dead.roadClocked + dead.roadPlain;
  if (road) line('  of the ones that fell on the ROAD, in a clocked fight',
    `${dead.roadClocked} of ${road} (${(100 * dead.roadClocked / road).toFixed(1)}%)`
    + ` — against the clock being dealt to about 20% of road fights`);
  if (dead.bossClocked + dead.bossPlain)
    line('  and at a commander, where no clock is ever dealt',
      `${dead.bossPlain + dead.bossClocked}`
      + (dead.bossClocked ? ` (${dead.bossClocked} of them CLOCKED, which should be zero)` : ''));
  const keep = results.reduce((a, r) => {
    const b = r.brokeKept; if (!b) return a;
    a.CLOCK.exits += b.CLOCK.exits; a.CLOCK.bodies += b.CLOCK.bodies;
    a.WITHDRAW.exits += b.WITHDRAW.exits; a.WITHDRAW.bodies += b.WITHDRAW.bodies;
    return a;
  }, { CLOCK: { exits: 0, bodies: 0 }, WITHDRAW: { exits: 0, bodies: 0 } });
  if (keep.CLOCK.exits || keep.WITHDRAW.exits) {
    const row = (lbl, k) => line(lbl, `${k.bodies} off the floor in ${k.exits} exits `
      + `(${k.exits ? (k.bodies / k.exits).toFixed(2) : '0'} an exit, ${(k.bodies / n).toFixed(2)} a run)`);
    row('  picked up by a clock ending the fight', keep.CLOCK);
    row('  picked up by a withdraw the player chose', keep.WITHDRAW);
  }
  // AND EVERY OTHER DOOR, because the two above are a seventh of the answer. A body comes off
  // the floor when the fight is won, when the squad is dragged off it, when it falls back, or
  // when it breaks contact - and R02b's pairing has to be paid through one of them.
  const doors = results.reduce((a, r) => {
    Object.entries(r.offFloor || {}).forEach(([k, v]) => {
      a[k] = a[k] || { exits: 0, bodies: 0 };
      a[k].exits += v.exits; a[k].bodies += v.bodies;
    });
    return a;
  }, {});
  const offFloorAll = Object.values(doors).reduce((a, v) => a + v.bodies, 0);
  if (offFloorAll) {
    line('  every door a body comes off the floor through',
      `${offFloorAll} bodies, ${(offFloorAll / n).toFixed(2)} a run`);
    Object.entries(doors).sort((a, b) => b[1].bodies - a[1].bodies).forEach(([k, v]) =>
      line(`    ${k.toLowerCase()}`, `${v.bodies} in ${v.exits} exits `
        + `(${(v.bodies / v.exits).toFixed(2)} an exit, ${(v.bodies / n).toFixed(2)} a run, `
        + `${(100 * v.bodies / offFloorAll).toFixed(0)}% of them)`));
  }
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
  // M01: and how many were paid off rather than carried. A census - a treatment either happened
  // or it did not - so it reads at any sample size.
  {
    const treated = results.reduce((a, r) => a + (r.scarsTreated || 0), 0);
    line('  treated at the Outpost', `${treated} of ${allScars.length} (${allScars.length ? Math.round(treated / allScars.length * 100) : 0}%), policy ${SCAR_POLICY}`);
  }
  line('share of recoveries scarred', recovered ? `${Math.round(allScars.length / recovered * 100)}%` : 'n/a');
  const byScar = {};
  allScars.forEach(id => { byScar[id] = (byScar[id] || 0) + 1; });
  SCAR_IDS.forEach(id => line(`  ${id.toLowerCase().replace(/_/g, ' ')}`, byScar[id] || 'never dealt'));

  // R01: IS THE GRUDGE PHASE A SLICE ANYBODY PLAYS. The ladder tops out at grudge 3 and the
  // audit's safest proposal was to trade the capped phase for a different one rather than a
  // bigger one. Worth building only if the phase opens often and lasts long enough to be a
  // fight rather than a death rattle - the same question R03 asked of its anchor, and the same
  // reason to ask it before writing anything.
  {
    const gs = results.map(r => r.grudgePhase).filter(Boolean);
    const opened = gs.reduce((a, c) => a + c.opened, 0);
    // THE DENOMINATOR IS FIGHTS REACHED, NOT COMMANDERS FELLED, and the first cut of this row
    // used the second and printed 116%. A phase can open in a fight the squad then loses, so
    // felling was never the population - the row caught its own defect by going over a hundred,
    // which is the one thing a share is good for.
    const bosses = results.reduce((a, r) => a + (r.bossMet || []).length, 0);
    const tails = gs.flatMap(c => c.turnsAfter);
    const byG = {};
    gs.forEach(c => Object.entries(c.byGrudge).forEach(([k, v]) => { byG[k] = (byG[k] || 0) + v; }));
    if (opened || bosses) {
      console.log('\n── THE GEAR A COMMANDER ONLY SHOWS TWICE ' + '─'.repeat(19));
      line('commander fights reached', bosses);
      line('  of them, the grudge phase opened', bosses
        ? `${opened} (${Math.round(opened / bosses * 100)}%)` : opened);
      line('  at what grudge', Object.keys(byG).sort().map(k => `\u25B2${k}: ${byG[k]}`).join(', ') || 'none');
      if (tails.length) {
        const sorted = [...tails].sort((a, b) => a - b);
        line('  commander turns after it opened',
          `median ${sorted[Math.floor(sorted.length / 2)]}, mean ${(tails.reduce((a, b) => a + b, 0) / tails.length).toFixed(1)}, worst ${sorted[sorted.length - 1]}`);
        const short = tails.filter(t => t <= 2).length;
        line('  of those, two turns or fewer',
          `${short} of ${tails.length} (${Math.round(short / tails.length * 100)}%) - a death rattle rather than a phase`);
      }
      // R01: and how many of those openings were the capped shape - the gear arriving at 45%
      // having handed its enrage multiplier back, rather than at 25% still carrying it. Separate
      // from the count above because the whole claim is that the SAME phase is reached more
      // often and earlier, not that a new one was added; one number covering both could not.
      const shaped = results.reduce((a, r) => a + (r.capShaped || 0), 0);
      const refund = results.reduce((a, r) => a + (r.capRefund || 0), 0);
      const at = {};
      gs.forEach(c => Object.entries(c.at || {}).forEach(([k, v]) => { at[k] = (at[k] || 0) + v; }));
      line('  of them, the capped shape', CAP_SHAPE === 'off'
        ? 'none - the arm is off'
        : `${shaped} of ${opened} (${opened ? Math.round(shaped / opened * 100) : 0}%)`);
      // THE PRICE HALF OF THE TRADE, which the first cut of this item did not have. It opened
      // the phase early and took away `armorBonus` - and `armorBonus` is on exactly one of the
      // eight grudge blocks, so seven commanders in eight were being handed the early phase for
      // nothing. This row is what stops that happening silently a second time: if the swing
      // given back ever reads zero while the shape is firing, the trade is one-sided again.
      if (CAP_SHAPE !== 'off') {
        line('  and the swing it handed back',
          shaped ? `${refund} damage over ${shaped} openings, ${(refund / shaped).toFixed(1)} a time`
                 : 'nothing - the shape never fired');
      }
      // The thresholds the ENGINE used, read back rather than restated - F03's rule. A report
      // quoting its own copy of a constant is one edit away from printing a number the game
      // does not use, and this row would go silent rather than lie if the two ever parted.
      line('  and the health it opened at',
        Object.keys(at).sort((a, b) => a - b).map(k => `${k}%: ${at[k]}`).join(', ') || 'not booked');
    }
  }

  // R03: IS A MORALE BREAK REACHABLE CONTENT AT ALL. The R-audit found that nothing on the road
  // ever leaves a fight and proposed "kill that one and the rest lose heart". A break needs
  // somebody left to break, so everything turns on where the side's BIGGEST body falls. If the
  // anchor dies last, there is nobody to lose heart and the mechanic is content nobody can
  // reach - which is how M12 and D06 both ended, and the reason this census is taken before a
  // line of the feature is written.
  {
    const cs = results.map(r => r.anchorFell).filter(Boolean);
    const tot = cs.reduce((a, c) => a + c.total, 0);
    const last = cs.reduce((a, c) => a + c.last, 0);
    const boss = cs.reduce((a, c) => a + c.boss, 0);
    const standing = {};
    cs.forEach(c => Object.entries(c.standing).forEach(([k, v]) => { standing[k] = (standing[k] || 0) + v; }));
    if (tot) {
      console.log('\n── WHEN THE BIGGEST BODY FALLS ' + '─'.repeat(29));
      line('fights where it fell at all', tot);
      line('  and it fell LAST', `${last} of ${tot} (${Math.round(last / tot * 100)}%) - nobody left to break`);
      line('  with somebody still up', `${tot - last} of ${tot} (${Math.round((tot - last) / tot * 100)}%)`);
      // A commander fight is a gate the record says must not be eased, so it is separated here
      // rather than folded in - a reachability figure that counted them would be measuring a
      // population the feature would never be allowed to touch.
      line('  of them, a commander fight', `${boss} of ${tot} (${Math.round(boss / tot * 100)}%)`);
      line('  bodies still standing when it fell',
        Object.keys(standing).sort((a, b) => a - b).map(k => `${k}: ${standing[k]}`).join(', '));
      // R03: and what the break actually did with that reachability. The three numbers are
      // deliberately separate: a side can break without a body getting away, because a broken
      // body spends a turn leaving and the squad gets that turn to take the kill instead.
      // Collapsing them into one rate would hide the decision the whole item is for.
      const broke = results.reduce((a, r) => a + (r.broke || 0), 0);
      const bodies = results.reduce((a, r) => a + (r.brokeBodies || 0), 0);
      const fled = results.reduce((a, r) => a + (r.fled || 0), 0);
      line('sides that lost their nerve', MORALE_ARM === 'off'
        ? 'none - the arm is off'
        : `${broke} of ${tot - boss} fights it could fire in (${Math.round(broke / Math.max(1, tot - boss) * 100)}%)`);
      if (broke) {
        line('  bodies that broke', bodies);
        line('  of those, got away', `${fled} of ${bodies} (${Math.round(fled / bodies * 100)}%)`);
        line('  caught before they went', `${bodies - fled} of ${bodies} (${Math.round((bodies - fled) / bodies * 100)}%)`);
      }
    }
  }

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
  // R04: WHAT EACH OFFER ASKED FOR, and how the two questions were answered differently. Split
  // rather than summed, because the whole point of the item is that they are not the same
  // question - a PRICE offer is answered by the purse and a LINE offer by the line, and one
  // sign rate over both would be the average of two things that share nothing.
  {
    const byTerm = t => offers.filter(o => o.term === t);
    const priced = byTerm('PRICE'), ranked = byTerm('LINE');
    const lineSigned = results.reduce((a, r) => a + (r.lineTerms || 0), 0);
    line('  of them, asking for a rank', ranked.length
      ? `${ranked.length} of ${offers.length} (${Math.round(ranked.length / offers.length * 100)}%), ${RECRUIT_TERM === 'off' ? 'arm off' : 'arm on'}`
      : `none - ${RECRUIT_TERM === 'off' ? 'the arm is off' : 'the roll never landed on one'}`);
    if (ranked.length) {
      line('    signed for a rank', `${lineSigned} of ${ranked.length} (${Math.round(lineSigned / ranked.length * 100)}%)`);
      const pSigned = totalSigned - lineSigned;
      line('    signed for scrap', priced.length
        ? `${pSigned} of ${priced.length} (${Math.round(pSigned / priced.length * 100)}%)`
        : 'no priced offers seen');
      // The cost the rank actually collected. A body that walks off later gave the rank back
      // and took itself with it, which is the only way this term can lose you a hand.
      const walked = results.reduce((a, r) => a + (r.walkedOff || 0), 0);
      line('    rank-holders later benched, who left', `${walked} across ${n} runs`);
    }
  }
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
  // K06 withdrew a claim read off this row - "points of depth" across a career - because a third
  // of a career is ~50 runs of a heavy-tailed quantity and the thirds move that much on identical
  // code. Printed with the spread of the three so the row cannot be read as a trend without it.
  const thirds = [depthOf(band(0, third)), depthOf(band(third, 2 * third)), depthOf(band(2 * third, n))];
  const tSpread = Math.max(...thirds.map(Number)) - Math.min(...thirds.map(Number));
  line('deepest sector, mean, by third', `${thirds.join(' / ')}   (spread ${tSpread.toFixed(2)} on ~${Math.round(n / 3)} runs a third)`);
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
  // S03: THE ROW TO COMPARE TWO ARMS ON, AND IT IS NOT THE ONE UNDERNEATH. Every balance phase in
  // this file has reached for `runs that ended the road` below, and the wipe count on this line
  // resolves the same question about three times cheaper. Measured on the wall arm #230 built,
  // hp 1.08/1.10 -> 1.06/1.075, twelve baseline careers against six:
  //
  //     wins      20.58 -> 28.33   d  +7.75   +2.89 sd   base [10..27] vs arm [22..36], overlapping
  //     wiped    110.08 -> 95.33   d -14.75   -7.41 sd   base [103..118] vs arm [89..97], disjoint
  //     recalled  19.33 -> 26.33   d  +7.00   +3.77 sd
  //
  // The mechanism is in the arithmetic: the fifteen wipes the easing removed split almost evenly
  // into wins and recalls, so THE WIN COUNT SEES ABOUT HALF THE MOVEMENT AND THIS ROW SEES ALL OF
  // IT, at a similar spread and off a base of 110 rather than 20.
  //
  // WHEN THAT HOLDS AND WHEN IT DOES NOT. It holds for any lever that moves how often runs die,
  // which is what a difficulty dial is. It does NOT hold for a lever that only changes how a
  // surviving run ends - push runs from recalled to won and this row is blind while the win count
  // is the only one that can see it. Read both; they are cheap to print together and they fail in
  // opposite directions. Measured on ONE lever, which is what licenses the mechanism above and
  // not a general law.
  line('  what the wipe count can resolve', resolves(ends.wiped || 0, n, 'wipes'));

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
  line('  what that count can resolve', resolves(wins.length, n, 'wins'));
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
    line(`asked for ${BENCH}`, held.length === n ? `taken at the muster on all ${n} runs`
      : held.length ? `taken at the muster on ${held.length} of ${n}` : `TAKEN ON NONE - the lever did nothing`);
    // P02: and what it was worth is a question about DOORS, not musters. This row used to say
    // "held on all N runs" off the muster reading alone, which could only ever come back 100%
    // and is the same mistake O21 found in doctrineKept one lever over.
    const bNodes = results.reduce((a, r) => a + (r.benchNodes || 0), 0);
    const bForce = results.reduce((a, r) => a + (r.benchInForce || 0), 0);
    line('  and still in force at the door', bNodes
      ? `${bForce} of ${bNodes} (${(100 * bForce / bNodes).toFixed(1)}%)`
      : 'no doors counted');
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
    //
    // O10: AND "LIVE" IS A FACT ABOUT THE DRAFT POLICY, NOT ABOUT THE GAME. It counts offers
    // this file's line could have kept, so `--draft line` - which opens on a Bruiser or a
    // Shotgunner and then takes a Medic 70% of the time - reports NO_HANDS and LIGHT_ORDER at
    // zero live over 150 expeditions, because both openers carry melee and a Bruiser is 25
    // health over LIGHT ORDER's cap. Enumerated exhaustively in suite 172 rather than sampled,
    // each is keepable by 120 of 720 lines. A zero here is the policy's first pick, and the
    // arm is named on the line so nobody reads it as a dead card. D05's trap, and this block
    // was one careless sentence away from it.
    console.log(`  (live = the offer THIS draft policy's line could keep - draft ${DRAFT})`);
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
    // O21: the badge says live; this says whether the rule is true of the field. A non-zero
    // breach count is a multiplier being paid for a promise the line is not keeping, and the
    // key names the classes that were standing - a star on a class means that body was not on
    // the field at the muster, so the line became wrong rather than starting wrong.
    const doors = results.reduce((a, r) => a + (r.docDoor || 0), 0);
    const breaches = results.reduce((a, r) => a + (r.docBreach || 0), 0);
    // O22: the line's own size at every fight door, which is what a refused step-in costs.
    const sizes = results.flatMap(r => r.doorBodies || []);
    if (sizes.length) {
      const mean = sizes.reduce((a, v) => a + v, 0) / sizes.length;
      const short = sizes.filter(v => v < 3).length;
      line('bodies standing at a fight door, mean', mean.toFixed(2));
      line('  doors fought under strength', `${short} of ${sizes.length} (${(100 * short / sizes.length).toFixed(1)}%)`);
      const liveSizes = results.flatMap(r => r.doorBodiesLive || []);
      if (liveSizes.length && liveSizes.length !== sizes.length) {
        const ls = liveSizes.filter(v => v < 3).length;
        line('  and on live-doctrine doors only',
             `${ls} of ${liveSizes.length} (${(100 * ls / liveSizes.length).toFixed(1)}%), ` +
             `mean ${(liveSizes.reduce((a, v) => a + v, 0) / liveSizes.length).toFixed(2)}`);
      }
    }
    const doorsAll = results.reduce((a, r) => a + (r.docDoorAll || 0), 0);
    line('fight doors under a live doctrine', `${doors} of ${doorsAll}`);
    line('  where its own rule was false', `${breaches} (${(100 * breaches / Math.max(1, doors)).toFixed(1)}%)`);
    const dark = {};
    results.forEach(r => Object.entries(r.docDark || {}).forEach(([k, v]) => { dark[k] = (dark[k] || 0) + v; }));
    const darkRows = Object.entries(dark).sort((a, b) => b[1] - a[1]);
    line('  and dark at', darkRows.length ? darkRows.map(([k, v]) => `${k} x${v}`).join(', ') : 'nowhere');
    if (breaches) {
      const byLine = {}, byArr = {};
      results.forEach(r => {
        Object.entries(r.docBreachLine || {}).forEach(([k, v]) => { byLine[k] = (byLine[k] || 0) + v; });
        Object.entries(r.docArrived || {}).forEach(([k, v]) => { byArr[k] = (byArr[k] || 0) + v; });
      });
      Object.entries(byLine).sort((a, b) => b[1] - a[1]).slice(0, 8)
        .forEach(([k, v]) => line('  line', `${k} x${v}`));
      const arr = Object.entries(byArr).sort((a, b) => b[1] - a[1]);
      line('  standing but not mustered', arr.length ? arr.map(([k, v]) => `${k} ${v}`).join(', ') : 'nobody');
      const first = results.find(r => r.docBreachFirst);
      if (first) line('  first seen', first.docBreachFirst);
    }
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

  // R02: WHAT SHAPE A FIGHT IS, which nothing here has ever printed. checkWinState ends a fight
  // on `!pA` or `!eA` and on nothing else: there is no rout, no clock, no objective and no way
  // to fail one while still standing. Whether an alternate terminal condition would be CONTENT
  // or a DIFFICULTY CUT turns entirely on three numbers nobody has read - how long a fight runs
  // in squad turns, where in that span the squad actually gets hurt, and how much is still on
  // its feet at each mark. Measurement only; nothing in the game offers an objective yet, which
  // is deliberately the same order H02 did it in.
  {
    const fold = key => {
      const out = {};
      results.forEach(r => { const fs = r.fightShape; if (fs) Object.entries(fs[key] || {})
        .forEach(([k, v]) => { out[k] = (out[k] || 0) + v; }); });
      return out;
    };
    const len = fold('len'), lost = fold('lenLost'), dmgAt = fold('dmgAt');
    const upAt = fold('upAt'), nAt = fold('nAt');
    const total = Object.values(len).reduce((a, b) => a + b, 0);
    const totalLost = Object.values(lost).reduce((a, b) => a + b, 0);
    if (total) {
      // A histogram read as quantiles, because the question is "how many fights are SHORT", not
      // "what is the average" - an objective that fires at turn 6 lives or dies on the left tail.
      const quant = (h, q) => {
        const n = Object.values(h).reduce((a, b) => a + b, 0);
        let seen = 0;
        for (const k of Object.keys(h).map(Number).sort((a, b) => a - b)) {
          seen += h[k]; if (seen >= n * q) return k;
        }
        return null;
      };
      const share = (h, upTo) => {
        const n = Object.values(h).reduce((a, b) => a + b, 0);
        const c = Object.entries(h).filter(([k]) => +k <= upTo).reduce((a, [, v]) => a + v, 0);
        return n ? Math.round(c / n * 100) : 0;
      };
      console.log('\n── WHAT SHAPE A FIGHT IS ' + '─'.repeat(34));
      line('fights the squad won', total);
      line('  squad turns to finish',
        `p10 ${quant(len, 0.10)}, median ${quant(len, 0.5)}, p90 ${quant(len, 0.90)}, worst ${Math.max(...Object.keys(len).map(Number))}`);
      // The engine's own VERDICT on its own threshold, counted there and read back here, so
      // this row and the BLITZ bounty cannot come to different conclusions about one fight.
      const bz = results.map(r => r.fightShape && r.fightShape.blitz).filter(Boolean);
      if (bz.length) {
        const won = bz.reduce((a, b) => a + (b.won || 0), 0);
        line(`  won inside ${bz[0].turns} turns`,
          `${Math.round(won / total * 100)}% - what BLITZ already pays for`);
      }
      line('  won inside 3 turns', `${share(len, 3)}%`);

      // R02 SIZING: WHAT A DEADLINE WOULD CATCH. The census's own finding is that damage is
      // linear in turns, so an objective that ends a fight early is a difficulty cut unless it
      // costs something. The shape it points at instead is a fight the squad can FAIL while
      // standing - a clock that runs out. Before building one, this says how much of the game
      // each candidate clock would touch, off the histogram rather than off a guess.
      //
      // Read over EVERY fight that started, not just the won ones, because a clock does not care
      // which way the fight was going - a fight the squad was losing at turn 20 is exactly the
      // one a deadline is for. Wins, losses and walk-outs all counted in the denominator.
      const allLen = {};
      [len, lost].forEach(h => Object.entries(h).forEach(([k, v]) => { allLen[k] = (allLen[k] || 0) + v; }));
      const startedAll = nAt[1] || Object.values(allLen).reduce((a, b) => a + b, 0);
      // A fight is CAUGHT by a deadline at N if it was still running when turn N opened, which
      // nAt already counts directly - no need to infer it from the length histogram.
      // Every fight that OPENED, which is the denominator for anything about clocks or shares -
      // checkWinState never runs for a fight the squad walks out of, so won+lost undercounts.
      // Hoisted here because two rows below need it; it used to be declared inside the last one.
      const started = nAt[1] || (total + totalLost);
      // R02: AND WHAT THE CLOCK ACTUALLY DID, beside the sizing it was chosen from. `met` is how
      // many fights carried one at all and `out` is how many it ended - the gap between them is
      // the fights that beat the clock, which is the whole of what the mechanic asks for.
      const met = results.reduce((a, r) => a + (r.pressedMet || 0), 0);
      const out = results.reduce((a, r) => a + (r.pressedOut || 0), 0);
      line('  fights on a clock', PRESSED_ARM === 'off' ? 'none - the arm is off'
        : `${met} of ${started} (${Math.round(met / started * 100)}%), and it ran out on ${out} (${met ? Math.round(out / met * 100) : 0}%)`);
      line('  a deadline would catch',
        [12, 16, 20, 25, 30].map(n => `t${n}: ${Math.round((nAt[n] || 0) / startedAll * 100)}%`).join(', '));
      if (totalLost) {
        line('fights the squad lost', totalLost);
        line('  squad turns before it fell',
          `p10 ${quant(lost, 0.10)}, median ${quant(lost, 0.5)}, p90 ${quant(lost, 0.90)}`);
      }
      // THE ROW THE DESIGN TURNS ON. If the squad's damage is taken early, a fight that ended at
      // turn N saves the player almost nothing and an objective is content; if it is taken late,
      // ending early IS the difficulty cut and any objective has to be priced as one.
      const dmgTotal = Object.values(dmgAt).reduce((a, b) => a + b, 0);
      const dmgUpTo = n => Object.entries(dmgAt).filter(([k]) => +k <= n)
        .reduce((a, [, v]) => a + v, 0);
      if (dmgTotal) {
        line('damage the squad took, by when it landed',
          [3, 6, 9, 12].map(n => `by turn ${n}: ${Math.round(dmgUpTo(n) / dmgTotal * 100)}%`).join(', '));
      }
      // AND WHAT YOU WOULD BE WALKING AWAY FROM. Mean hostiles still up at the top of each turn,
      // over the fights that reached it - the direct size of "the rest of them break off".
      const marks = [1, 3, 6, 9, 12].filter(n => nAt[n]);
      if (marks.length) {
        line('still standing at the top of turn',
          marks.map(n => `t${n}: ${(upAt[n] / nAt[n]).toFixed(1)}`).join(', '));
        // THE DENOMINATOR IS FIGHTS THAT STARTED, NOT FIGHTS THAT ENDED IN A BODY COUNT, and
        // the first cut of this row used the second and printed 116% - the same way R01's phase
        // census printed 116% one item ago, and caught by the same thing, a share exceeding a
        // hundred. The cause is the finding: checkWinState books len/lenLost, and checkWinState
        // never runs for a fight the player WITHDRAWS, RETREATS or FALLS BACK out of. Those
        // fights start, take turns, and never reach a terminal condition at all. `started`
        // counts every fight that opened, which is the population this row is about.
        line('fights still running at turn',
          marks.map(n => `t${n}: ${Math.round(nAt[n] / started * 100)}%`).join(', '));
        // AND WHAT THAT GAP IS, printed rather than left as an artefact. A fight the squad left
        // is the one exit this game already has that is not a body count - the player's own -
        // and it is the honest starting point for asking what a second one would be worth.
        const left = started - total - totalLost;
        line('fights that ended by neither side falling',
          `${left} of ${started} (${Math.round(left / started * 100)}%) - the squad walked out`);
      }
    }
  }
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
    // M07: the basic attack, against the denominator that is actually a turn. M06 reported
    // 4.4-4.7% and could not say what it meant; this says what was in the hand when the choice
    // was made, and whether there was a choice at all.
    {
      const turns = tot(nums('turnsPlayer'));
      const picked = tot(nums('basicPicked')), forced = tot(nums('basicForced'));
      const free = tot(nums('freeActions'));
      const moves = results.reduce((a, r) => a + Object.values(r.moves || {}).reduce((x, y) => x + y, 0), 0);
      line('turns the squad actually took', `${turns}, plus ${free} tactics bought without spending one`);
      const ranked = tot(nums('ranked'));
      line('  turns that got as far as the ranking', turns
        ? `${ranked} of ${turns} (${Math.round(ranked / turns * 100)}%) - the rest were claimed by a combo, a rescue, a guard or a vent`
        : 'none');
      line('  basic attacks, of the turns that had a ranking to do', ranked
        ? `${picked} of ${ranked} (${(picked / ranked * 100).toFixed(1)}%), which is ${(picked / turns * 100).toFixed(1)}% of all turns and ${(picked / moves * 100).toFixed(1)}% of the move tally M06 read`
        : 'none');
      line('  and how many of those had any choice', picked
        ? `${forced} of ${picked} (${Math.round(forced / picked * 100)}%) were thrown with nothing else off cooldown`
        : 'none');
      const depth = {};
      results.forEach(r => Object.entries(r.handDepth || {}).forEach(([k, v]) => { depth[k] = (depth[k] || 0) + v; }));
      const dTot = Object.values(depth).reduce((a, b) => a + b, 0);
      line('  abilities off cooldown when the choice was made', dTot
        ? Object.keys(depth).sort().map(k => `${k === '4' ? '4+' : k}: ${Math.round(depth[k] / dTot * 100)}%`).join(', ')
        : 'none');
    }
    const h = tot(nums('held')), t = tot(nums('turnsPlayer'));
    line('turns held, nothing else to press', t
      ? `${h} of ${t} player turns (${(100 * h / t).toFixed(2)}%), skipped outright before F10`
      : 'no player turns recorded');
  }
  line('signatures bought at the Outpost', `${mean(nums('sigsBought')).toFixed(1)} per run`);
  // O03: BOTH NUMBERS ARE PURCHASES AT THE SAME PRICE, and the wording here used to be "taken on
  // promotion" against "bought at the Outpost" - which reads as free against paid. It is not:
  // assignPerk charges capstoneCost() whichever door the card came through. The 0.00 on the
  // right is a DOOR ATTRIBUTION, not a dead feature, and I filed it as a dead feature off this
  // line before measuring it. rollPerkOffer puts the capstone first the moment it opens and the
  // promotion policy above takes it first, so the shelf never sees one still open. A player who
  // DECLINES it at the promotion screen finds it on the shelf afterwards - capstoneOpen only
  // shuts once the trait is held - so the right-hand door is reachable, just not by this policy.
  line('capstones bought', `${mean(nums('capsTaken')).toFixed(2)} through the promotion screen, `
    + `${mean(nums('capsBought')).toFixed(2)} off the Outpost shelf, per run - same card, same price`);
  // F10b: and how many points went into the bank instead of onto a card, which is the row that
  // says the `bank` arm is armed rather than quietly reading the default. Booked and not printed
  // for one draft, which is the dead-field shape every audit here has caught at least once. Read
  // it against the two figures directly above: banking queues at the right-hand door, and the
  // right-hand door is the one that barely stocks the card being queued for.
  line('  points banked instead', `${mean(nums('capsBanked')).toFixed(1)} per run`
    + (mean(nums('capsBanked')) > 0 ? '' : ' - no policy here banks one'));
  // M02: what the five training cards actually get. A census - a point either bought a stat card
  // or it did not - so it reads at any sample size. M04 then made the five situational and gave
  // this harness a policy (--perks), so the split below is read against the policy that produced
  // it: under `random` it still says nothing about which card is better, only that the pool is
  // being reached; under `fit` it is the shape of the decision, not a ranking.
  {
    const statN = results.reduce((a, r) => a + (r.statsBought || 0), 0);
    const sigN  = results.reduce((a, r) => a + (r.sigsBought || 0), 0);
    const capN  = results.reduce((a, r) => a + (r.capsBought || 0), 0);
    const spent = statN + sigN + capN;
    line('points spent at the Outpost', spent
      ? `${spent} — ${Math.round(statN / spent * 100)}% on a stat card, ${Math.round(sigN / spent * 100)}% on a signature, ${Math.round(capN / spent * 100)}% on a capstone`
      : 'none');
    const picks = {};
    results.forEach(r => Object.entries(r.statPicks || {}).forEach(([k, v]) => { picks[k] = (picks[k] || 0) + v; }));
    const none = results.reduce((a, r) => a + (r.sigNoneLeft || 0), 0);
    const dear = results.reduce((a, r) => a + (r.sigTooDear || 0), 0);
    line('  why a point became a stat card', (none + dear)
      ? `${none} times no signature was left to buy, ${dear} times one was open and unaffordable`
      : 'it never did');
    line('  stat cards taken, by name', PERK_IDS.length
      ? PERK_IDS.map(id => `${id.toLowerCase()} ${picks[id] || 0}`).join(', ')
      : 'none');
    // M04: the one row that says whether the cards bought were cards this body could use. Under
    // `random` it is the hit rate of picking blind, which is the thing `fit` is measured against;
    // under `fit` it is 100% by construction and the row is a check on the policy, not a finding.
    const fitN = results.reduce((a, r) => a + (r.statFit || 0), 0);
    line('  bought for a body that meets the condition', statN
      ? `${fitN} of ${statN} (${Math.round(fitN / statN * 100)}%), policy ${PERK_POLICY}`
      : `none, policy ${PERK_POLICY}`);
    // M04: FORTIFIED asks nothing, so it counts as fitting every body and a blind pick is right
    // three times in five before any judgement is applied. The row above is read against that,
    // not against zero.
  }
  // ── M05: the quirk pool, which nothing has ever counted ────────────────────────────────
  // Fifteen quirks, five of them carrying a condition, and no readout in this file had ever
  // named one. The order matters and is the M04 lesson: this ships BEFORE anything is changed,
  // because M04 designed five conditions and measured them afterwards, and three of the five
  // fired so rarely that the change cost sixteen wins. A condition's firing rate is the first
  // fact about it, not the last.
  {
    const qk = foldAll('qk'), drawn = foldAll('qkDrawn');
    const ids = QUIRK_IDS.length ? QUIRK_IDS : Object.keys(drawn);
    const total = Object.values(drawn).reduce((a, b) => a + b, 0);
    line('quirks drawn from the pool', total
      ? `${total} across ${ids.length} in the pool, ${ids.filter(id => !drawn[id]).length} never drawn`
      : 'none');
    const never = ids.filter(id => !drawn[id]);
    if (never.length) line('  never drawn', never.map(i => i.toLowerCase()).join(', '));
    // The conditional five, which are the whole reason this block exists. `seen` counts the
    // times a body holding the quirk swung; `fired` the times the condition held.
    const asked = ids.filter(id => (qk[id] || {}).seen && CONDITIONAL_QUIRKS.includes(id));
    line('  conditional quirks, how often the condition held', asked.length
      ? asked.map(id => `${id.toLowerCase()} ${Math.round(qk[id].fired / qk[id].seen * 100)}% (${qk[id].fired}/${qk[id].seen})`).join(', ')
      : 'none asked');
    const quiet = CONDITIONAL_QUIRKS.filter(id => !(qk[id] || {}).seen);
    if (quiet.length) line('  and never asked at all', quiet.map(i => i.toLowerCase()).join(', '));
    // Three kinds in this pool, not two, and the first draft of this block got it wrong: it
    // listed the pure stat quirks as "drawn but never did anything", which is false. RECKLESS is
    // +5 DMG and -15 HP written onto the sheet the moment it is rolled - it has no runtime read
    // to count because it does not need one. Split off the pool's own dmg/hp/spd rather than by
    // a list kept here, so a quirk that gains or loses a stat moves between the groups on its own.
    const statOnly = ids.filter(id => STAT_QUIRKS.includes(id));
    line('  written onto the sheet at the muster, nothing to fire', statOnly.length
      ? statOnly.map(id => `${id.toLowerCase()} ${drawn[id] || 0} drawn`).join(', ')
      : 'none');
    // The ones that ask nothing and DO have a moment: the count is D06's question rather than
    // M04's - not how often a condition held, but whether the thing has ever happened at all.
    const flat = ids.filter(id => !CONDITIONAL_QUIRKS.includes(id) && !STAT_QUIRKS.includes(id));
    line('  quirks that ask nothing, times they did something', flat.length
      ? flat.map(id => `${id.toLowerCase()} ${(qk[id] || {}).fired || 0}`).join(', ')
      : 'none');
    const dead = flat.filter(id => drawn[id] && !(qk[id] || {}).fired);
    if (dead.length) line('  drawn and never once fired', dead.map(i => i.toLowerCase()).join(', '));
  }
  // ── M06: the signature conditions, which are the other half of the promotion screen ────
  // M02 measured that 9% of perk points buy a signature and 91% buy a stat card; M04 then found
  // three of the five stat conditions barely firing. Eight signatures carry a condition of the
  // same shape and none had ever been counted. Same ledger, same order: census before dial.
  {
    const sg = foldAll('sg');
    // TWO KINDS OF LOW NUMBER, and reporting them in one list would hide which is which. A
    // STATE condition asks about the world - is this body hurt, is that target marked - so a low
    // rate means the state does not happen. A MOVE-GATED one asks which ability was used, so a
    // low rate means the holder picked something else, which is D06's question and not M04's.
    // Split off the resolver's own text rather than by a list here.
    const pct = ([k, v]) => `${k.toLowerCase()} ${Math.round(v.fired / v.seen * 100)}% (${v.fired}/${v.seen})`;
    const by = (want) => Object.entries(sg).filter(([k]) => MOVE_GATED_SIGS.includes(k) === want)
      .sort((a, b) => b[1].fired / b[1].seen - a[1].fired / a[1].seen);
    line('signature conditions that ask about the world, how often each held', by(false).length
      ? by(false).map(pct).join(', ') : 'none asked');
    line('  and the ones gated on using one ability, how often its holder used it', by(true).length
      ? by(true).map(pct).join(', ') : 'none asked');
    const gates = foldAll('sgGate');
    const gateRows = Object.entries(gates).sort((a, b) => b[1].fired / b[1].seen - a[1].fired / a[1].seen);
    line('  how often the holder reached for the ability those are gated on', gateRows.length
      ? gateRows.map(pct).join(', ') : 'none');
    // THE LIMIT THIS INSTRUMENT HAS, printed rather than left for somebody to infer: those gates
    // are the basic attacks, and this file's move policy scores anything with a cooldown above
    // them, so they are a fraction of a percent of all moves. A low rate there is a fact about
    // the harness, not about the game - which is the D06 mistake, and it is named here so the
    // next reader does not make it again.
    const moves = {};
    results.forEach(r => Object.entries(r.moves || {}).forEach(([k, v]) => { moves[k] = (moves[k] || 0) + v; }));
    const allMoves = Object.values(moves).reduce((a, b) => a + b, 0);
    const basics = BASIC_ATTACKS.reduce((a, m) => a + (moves[m] || 0), 0);
    line('  and how much of this harness ever swings a basic attack at all', allMoves
      ? `${basics} of ${allMoves} moves (${(basics / allMoves * 100).toFixed(1)}%) - so a signature gated on one is barely reachable here`
      : 'no moves');
    const quiet = CONDITIONAL_SIGS.filter(id => !(sg[id] || {}).seen && !(gates[id] || {}).seen);
    if (quiet.length) line('  never asked at all', quiet.map(i => i.toLowerCase()).join(', '));
    // How the other thirty-two are shaped, so the eight are read as a SLICE of the pool rather
    // than as the pool. Read off the engine: a signature either writes the sheet when it is
    // bought, changes what one named ability does, or asks a question at the moment of use.
    line('  the pool behind them', `${SIG_SHAPES.applied} write the sheet when bought, ${
      SIG_SHAPES.moveGated} change one named ability, ${CONDITIONAL_SIGS.length} ask a question, ${
      SIG_SHAPES.other} are read some other way, of ${SIG_SHAPES.total}`);
  }
  // ── M08: what "the enemy front" is worth as a condition ────────────────────────────────
  // DUELIST and SLACK LINE both read dist === 0 and both call it a position you take up. The
  // raw share says 66-79%. But dist is an INDEX into the living-enemy list, so it is 0 by force
  // whenever one foe is left - and the share cannot tell a choice from an arithmetic
  // inevitability. Conditioned on how many were still standing, it can.
  //
  // The rank reading was checked and ruled out: hostiles carry no gridPos anywhere in the
  // engine, so "the enemy front" has no other referent to mean. The index IS the front.
  {
    const r = foldStats({ atFront: 0, swings: 0, byStanding: {}, frontByStanding: {} },
                        foldAll('rch'));
    if (r.swings) {
      line('swings that landed on the enemy front', `${r.atFront} of ${r.swings} (${Math.round(r.atFront / r.swings * 100)}%)`);
      line('  how much of the line was still up when they landed',
        Object.keys(r.byStanding).sort().map(k =>
          `${k === '5' ? '5+' : k}: ${Math.round(r.byStanding[k] / r.swings * 100)}%`).join(', '));
      // THE ROW THAT SETTLES IT. With one foe left the front is the only thing there is, so
      // those swings say nothing about whether anybody chose it. Two or more standing is where
      // the condition is a condition at all - and the blind rate is what the same swings would
      // have scored if the target were drawn at random from the living, which is the only
      // baseline that can tell a preference from a coincidence.
      const many = Object.keys(r.byStanding).filter(k => +k >= 2);
      const manyTot = many.reduce((a, k) => a + r.byStanding[k], 0);
      const manyFront = many.reduce((a, k) => a + (r.frontByStanding[k] || 0), 0);
      const blind = many.reduce((a, k) => a + r.byStanding[k] / +k, 0);
      line('  and of the swings with a choice of target, how many took the front', manyTot
        ? `${manyFront} of ${manyTot} (${Math.round(manyFront / manyTot * 100)}%) against ${
            Math.round(blind / manyTot * 100)}% if the target were drawn at random from the living`
        : 'none had a choice');
    }
  }
  // And the same split per card, which is what a re-key would move. A card firing on a lone
  // survivor is being paid for arithmetic; a card firing against a line is being paid for a
  // target the holder picked.
  {
    const f = foldAll('frt');
    Object.keys(f).sort().forEach(id => {
      const t = f[id];
      if (!t.seen) return;
      const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : 'n/a';
      line(`  ${id}`, `fires on ${pct(t.fired, t.seen)} of its holder's ${t.seen} swings; ` +
        `against a line of two or more, ${pct(t.firedLine, t.seenLine)} of ${t.seenLine}; ` +
        `${pct(t.fired - t.firedLine, t.fired)} of its firings were a lone survivor; ` +
        `${pct(t.firedHauled, t.fired)} were against something the squad hauled there`);
    });
    const h = foldStats({ tried: 0, moved: 0 }, foldAll('hl'));
    line('  the haul', h.tried
      ? `${h.tried} attempted, ${h.moved} moved something (${Math.round(h.moved / h.tried * 100)}%) - the rest were already at the front`
      : 'NEVER ATTEMPTED - the harness cannot reach the one verb that sets this condition up');
  }
  // ── M08b: what front cover actually covers ─────────────────────────────────────────────
  // TERRAIN documents frontCover as applying to "whoever stands in the front rank, whichever side
  // they are on". mitigate reads t.gridPos === 1, and no hostile has a gridPos - so it has only
  // ever applied to the squad. Read in both DIRECTIONS, because they have different denominators:
  // what the squad takes is what the existing read governs, what the squad deals is what a
  // symmetric read would govern, and one blended figure answers neither. The first draft of this
  // block was that blended figure and it read 6% where the resolver's own census says 79%.
  {
    const acc = foldAll('cv');
    const pc = (n, d) => d ? Math.round(n / d * 100) + '%' : '0%';
    const show = (dir, what, who) => {
      const a = acc[dir];
      if (!a || !a.blows) return;
      line(`front cover: of the damage the squad ${what} on those grounds`,
        `${a.hitDmg} of ${a.dmg} (${pc(a.hitDmg, a.dmg)}) lands on ${who}, over ${a.blows} blows`);
      Object.keys(a.byGround).sort().forEach(id => {
        const g = a.byGround[id];
        // The shipped effect on this half, in damage: what the multiplier does to the share it
        // reaches. Signed, so the two grounds do not look like the same finding.
        const moved = Math.round(g.hitDmg * (g._mult - 1));
        line(`  ${id} (x${g._mult})`, `${g.hitDmg} of ${g.dmg} (${pc(g.hitDmg, g.dmg)}) over ${g.blows} blows` +
          `, worth ${moved > 0 ? '+' : ''}${moved} damage`);
      });
    };
    show('taken', 'TAKES', "its own front rank - the read that exists");
    show('dealt', 'DEALS', "the enemy front - the read the legend promises and mitigate does not make");
  }
  // ── M09: who cashes the mark ───────────────────────────────────────────────────────────
  // CALLED_SHOT pays the SNIPER +25% against a marked target and M06 measured it at 1% of that
  // sniper's swings. The mark is reachable - SPOTTERS_MARK fires over a thousand times a career
  // - so the question is not whether it exists but who gets to it. A mark is one-shot, and the
  // body that placed it spent a turn at 0.4x damage to do so, then has to beat its own squad to
  // the payoff. Three outcomes, all counted, because only one of them pays the card.
  {
    // THE THIRD TIME THIS EXACT BUG HAS SHIPPED IN THIS FILE. M07 found it in nums() and fixed
    // the class there; M08's per-card accumulator hand-listed its keys and dropped one, printing
    // NaN; and this one listed `called` and `setByHolder` in the SUM and not in the SEED, so
    // `undefined + n` came out NaN, `|| 0` turned it into a clean-looking zero, and a working
    // card read as "no sniper took that fork" for three runs. A zero is worse than a NaN because
    // it is believable. So no hand-written key list at all: the seed IS the schema, the sum walks
    // it, and a counter the engine adds without touching this line is a loud missing key rather
    // than a quiet nothing.
    const m = foldStats({ set: 0, cash: 0, own: 0, ally: 0, expired: 0, onSquad: 0,
                          called: 0, setByHolder: 0, bySource: {}, byClass: {} }, foldAll('mk'));
    if (m.set) {
      const pc = (n, d) => d ? Math.round(n / d * 100) + '%' : '0%';
      const named = bag => Object.entries(bag).sort((x, y) => y[1] - x[1])
        .map(([k, v]) => `${k.toLowerCase()} ${v}`).join(', ');
      line('marks placed on a hostile', `${m.set} (${named(m.bySource)})`);
      line('  of those, cashed before they ran out', `${m.cash} (${pc(m.cash, m.set)}), ${m.expired} expired (${pc(m.expired, m.set)})`);
      // THE ROW M06 ASSERTED AND DID NOT MEASURE. A mark cashed by an ally is a mark the setter
      // paid a turn for and somebody else spent - which is the whole of CALLED SHOT's problem if
      // it holds, and a refutation of M06's explanation if it does not.
      line('  and cashed by the body that placed it', `${m.own} of ${m.cash} (${pc(m.own, m.cash)}), an ally took ${m.ally} (${pc(m.ally, m.cash)})`);
      line('  which class cashed them', named(m.byClass) || 'nobody');
      // M09's re-key, read where it is now paid. CALLED SHOT used to sit in the perk layer and
      // fire only when the sniper itself swung at the mark - 1% of its holder's swings. It is
      // paid off the SETTER now, so its reach is the cash count rather than the 9-16% of it the
      // setter could win, and this line is what says whether that landed.
      line('  placed by a CALLED SHOT holder', `${m.setByHolder || 0} of ${m.set} (${pc(m.setByHolder || 0, m.set)})` +
        (m.setByHolder ? '' : ' - so a zero on the next line is an absent fork, not a broken card'));
      line('  cashes that paid CALLED SHOT', m.called
        ? `${m.called} of ${m.cash} (${pc(m.called, m.cash)}) - the holder's marks, cashed by anybody`
        : 'none - no sniper on the road took that fork');
      // How often the arm actually fired, so its result cannot be read as "the policy tried and
      // failed" when the truth might be "the policy never had a holder to try with".
      const took = results.reduce((a, x) => a + (Number(x.markTaken) || 0), 0);
      line('  times the holder was steered onto its own mark', took
        ? `${took} (--mark own)` : 'none - the blind arm, which never consults a mark');
      if (m.onSquad) line('  marks the Carrion put on an operator', `${m.onSquad} - a different mark, steering enemy fire rather than paying a bonus`);
    }
  }
  // ── M-audit: which half of each overdrive pair this file has ever fired ────────────────
  // Every class has two overdrives and takes the first one it ever uses for the rest of the run.
  // overdriveFor falls back to pair[0] when nothing has chosen, and nothing in THIS file ever
  // chooses - `odChoices` does not appear in it. So the second half of every pair may never have
  // been measured at all, which would make P02's "momentum worth choosing" a reading of one arm.
  {
    const od = foldAll('od');
    const rows = Object.entries(od).sort((a, b) => b[1].fired - a[1].fired);
    const firsts = rows.filter(([, v]) => v._at === 0).reduce((a, [, v]) => a + v.fired, 0);
    const seconds = rows.filter(([, v]) => v._at === 1).reduce((a, [, v]) => a + v.fired, 0);
    const pairs = Math.max(...results.map(r => Number(r.odPairs) || 0), 0);
    if (rows.length) {
      line('overdrives fired', `${firsts + seconds} across ${rows.length} of ${pairs * 2} variants`);
      line('  the first of the pair against the second', `${firsts} vs ${seconds}` +
        (seconds ? '' : ' - THE SECOND HALF OF EVERY PAIR HAS NEVER FIRED HERE'));
      line('  by variant', rows.map(([k, v]) => `${k.toLowerCase()}${v._at ? '(2nd)' : ''} ${v.fired}`).join(', '));
      // M10: the health the line lost while the overdrive resolved, per firing. Per firing rather
      // than in total, because the two halves of a pair do not fire the same number of times and
      // a class that reaches its bar more often is not a better overdrive.
      //
      // THIS COLUMN CANNOT RANK THE TWO HALVES AND MUST NOT BE READ AS IF IT COULD. The window is
      // the overdrive's own resolution, and the second half of nearly every pair puts its value
      // OUTSIDE that window: BACKBURNER's three turns of burning, BLOOD SCENT's bleeds, BOOBY
      // TRAP's corrode and oil, CLEAN ROOM's cleanse and heal, LAST CHARGE's cost to its own
      // holder. The firsts are the immediate ones - HELLFIRE 2x now, EARTHSHAKER 1.5x now - so
      // the bias runs one way and it runs the way that flatters them. Read this as "how much of
      // each overdrive lands inside its own turn", which is what it measures, and take the
      // careers above for whether the choice is worth anything.
      const per = ([k, v]) => `${k.toLowerCase()} ${v.fired ? Math.round(v.dmg / v.fired) : 0}`;
      line('  health removed inside the overdrive\'s own turn, per firing (NOT a ranking - see above)',
        rows.filter(([, v]) => v.dmg > 0).sort((a, b) => b[1].dmg / b[1].fired - a[1].dmg / a[1].fired).map(per).join(', ') || 'none dealt damage');
      const heals = rows.filter(([, v]) => !v.dmg);
      if (heals.length) line('  and the ones that remove none at all', heals.map(([k]) => k.toLowerCase()).join(', ')
        + ' - every point of what these buy lands somewhere this counter cannot see');
      const byCls = {};
      rows.forEach(([k, v]) => { (byCls[v._cls] = byCls[v._cls] || []).push([k, v]); });
      line('  per class, the half that fired and what it was worth a firing',
        Object.entries(byCls).sort().map(([c, rs]) => `${c.toLowerCase()} ${rs.map(per).join('/')}`).join(', '));
    }
  }
  // ── M11: the ten pairings, and what each of them actually bought ──────────────────────
  // COMBOS has been in the file since Phase 1 and nothing has ever counted it. This file books a
  // combo turn only as "claimed" - which says a combo happened and nothing about WHICH, so a
  // pairing nobody can reach and a pairing everybody reaches read the same. That is the shape
  // M-audit found in the overdrives (nine of eighteen unreachable) and M06 found in the
  // signatures (CALLED SHOT at 1%), and it is worth checking here before any of it is tuned.
  //
  // UNLIKE THE OVERDRIVE COLUMN ABOVE, the premium here is a ranking and may be read as one.
  // The difference is the window. An overdrive's value leaks into later turns and its own
  // damage cannot price it; a combo is a multiplier on one swing that resolves inside that
  // swing. mitigate hands back cd, rv and ac, so the same blow without the pairing is
  // max(1, floor(cd / mult) - rv - ac) exactly - no second call, no model of the formula.
  // Short by integer flooring, a unit or two a swing, one-directional. VULTURES INSTINCT's own
  // 1.25x sits in both arms and so correctly cancels out of the premium while staying in dmg.
  //
  // Points per career rather than a share, for K09's reason two hundred lines down: what a
  // pairing is worth is how much damage it adds, and a share of a total nobody landed cannot
  // say that. There is no landed-damage denominator in this file to take a share OF - the type
  // ledger counts raw, pre-mitigation - and inventing one is how M06 and M08b went wrong.
  {
    const cb = foldAll('cb');
    const rows = Object.entries(cb).sort((a, b) => b[1].fired - a[1].fired);
    const all = [...new Set(results.flatMap(r => r.cbAll || []))];
    const pairs = all.length;
    const fired = rows.reduce((a, [, v]) => a + v.fired, 0);
    line('combos fired', `${fired} (${(fired / n).toFixed(1)} a run) across ${rows.length} of ${pairs} pairings`);
    if (rows.length) {
      // `eats` is the half that explains the fired column. Three of the ten SPEND the status they
      // read - IGNITE takes the oil, CONFIRMED takes the mark - and the other seven leave it on
      // the body, so one application can be cashed every turn until it runs out. RIP AND TEAR is
      // half of all combos in this game and does not consume its bleed, which is most of why.
      line('  by pairing (* spends the status it reads)',
        rows.map(([k, v]) => `${k.toLowerCase()}${v._eats === 'y' ? '*' : ''} ${v.fired}`).join(', '));
      // The column this census exists for. Sorted by it, because that IS the ranking.
      const prem = rows.filter(([, v]) => v.fired > v.pierced)
                       .sort((a, b) => b[1].premium - a[1].premium);
      // N04: TOTALS, like every other count in this block and like nine of the eleven censuses in
      // this file. It read "points a career" and sat between two lines of raw totals, which is
      // the defect #197 tier A found in the bleed block and I shipped again here one commit
      // earlier. Within a block the scale has to be one thing; across blocks the header records
      // state their own, and the per-firing line below is a rate and belongs to neither.
      line('  damage the pairing itself added, points across the sample',
        prem.map(([k, v]) => `${k.toLowerCase()} ${v.premium}`).join(', ') || 'none');
      // Per firing, against the whole swing it sat on - the second figure is the context for the
      // first. A 2.0x that reads half its swing is the arithmetic working; anything far off that
      // is armour or a resistance eating into the difference, which is a real effect and not a
      // fault in the column.
      line('  and per firing, the pairing\'s share of the swing it multiplied',
        prem.map(([k, v]) => { const f = Math.max(1, v.fired - v.pierced);
          return `${k.toLowerCase()} x${v._mult} ${Math.round(v.premium / f)} of ${Math.round(v.dmg / f)}`; }).join(', ') || 'none');
      line('  kills landed on a combo swing', rows.reduce((a, [, v]) => a + v.kills, 0) +
        ` of ${fired} (${(rows.reduce((a, [, v]) => a + v.kills, 0) / Math.max(1, fired) * 100).toFixed(0)}%)`);
      // A pierced swing takes the target's whole health and the multiplier never touches it, so
      // it is a firing with no premium rather than a firing worth nothing. Named when it happens.
      const pierced = rows.reduce((a, [, v]) => a + v.pierced, 0);
      if (pierced) line('  of those, pierced (HEADSHOT - the multiplier does not apply)', String(pierced));
    }
    // A cold pairing, and WHAT IT IS SAFE TO CONCLUDE FROM ONE. Three of the ten belong to the
    // N08 recruit classes, so whether a career ever sees them is decided by which recruits it
    // signed - and the first version of this line said "unreached, which is a different finding
    // from unrewarding", which read a roster history as a property of the game and had to be
    // withdrawn the same day. Marked per row instead, and the reading is spelled out rather than
    // left to whoever quotes the line.
    const cold = all.filter(k => !cb[k]);
    const recruit = new Set(results.flatMap(r => r.cbRecruit || []));
    if (cold.length) {
      line('  never fired in this sample', cold.map(s => s.toLowerCase() + (recruit.has(s) ? ' (recruit class)' : '')).join(', '));
      line('    what that means', cold.every(k => recruit.has(k))
        ? 'all of them belong to classes a career has to recruit - this is a roster history, not a finding'
        : 'at least one is a starting class, which IS worth chasing - see suite 168, which stages all ten');
    }
  }
  // ── #197 tier A: the bleed, by what opened it ─────────────────────────────────────────
  // Nineteen sites in this game apply a bleed and the tick could say only that one had happened.
  // It is the only status that does something on its own each turn, it is 8% of maxHp a tick,
  // and M11 measured that 45-61% of every combo in the game reads one - so "which of the
  // nineteen" is the largest single question the status system could not answer.
  //
  // TWO FIGURES, AND THE SECOND IS NEW. `raw` is what the tick asked for before armour and
  // resistances, which is the number noteDamageType already books a line earlier and so can be
  // reconciled against it. `landed` is what the body actually lost, and nothing in this project
  // has ever counted it: the tick's only other ledger is the death. Both are printed because the
  // gap between them IS the mitigation, and M03 typed bleed as phys precisely so that gap exists.
  {
    const bl = foldAll('bl');
    const sides = [['atFoe', 'the squad opens'], ['atSquad', 'the road opens']];
    sides.forEach(([side, what]) => {
      const rows = Object.entries(bl[side] || {});
      if (!rows.length) return;
      const sum = k => rows.reduce((a, [, v]) => a + (v[k] || 0), 0);
      // EVERY FIGURE IN THIS BLOCK IS PER CAREER. The first cut of these two lines mixed the two
      // scales on one line - a per-career damage figure beside a raw total for ticks - which is
      // how a reader ends up quoting "667 lethal bleeds a career" off a number that is 4.4.
      const per = k => sum(k) / n;
      line(`bleeds ${what}`, `${per('applied').toFixed(1)} a run over ${rows.length} sources, ` +
        `granting ${per('turns').toFixed(0)} turns of bleeding`);
      line('  what the ticks took, raw / landed', `${Math.round(per('raw'))} / ${Math.round(per('dmg'))} ` +
        `a run over ${per('ticks').toFixed(0)} ticks, ${per('kills').toFixed(1)} of them lethal`);
      // The column the item exists for, ranked by what it actually removed rather than by how
      // often it was applied - M11's whole finding was that those two rank oppositely.
      const by = rows.filter(([, v]) => v.dmg > 0).sort((a, b) => b[1].dmg - a[1].dmg);
      line('  by source, health removed a run',
        by.map(([k, v]) => `${k.toLowerCase()} ${Math.round(v.dmg / n)}`).join(', ') || 'none');
      line('  and per application, which is what one use of it is worth',
        by.map(([k, v]) => `${k.toLowerCase()} ${Math.round(v.dmg / Math.max(1, v.applied))}`).join(', ') || 'none');
      // Applied and never ticked: a bleed that was cleansed, or landed on something that died
      // first. Real information rather than a rounding error - it is the whole of what a cleanse
      // is worth, seen from the other side.
      const dead = rows.filter(([, v]) => v.applied > 0 && !v.ticks);
      // N04: through per(), like every other figure in this block. This line read v.applied raw
      // and the scale guard #197 tier A shipped did not catch it, because that guard looked for
      // a bare sum() and this is a bare FIELD. The guard below is written against the shape
      // rather than the spelling now.
      if (dead.length) line('  applied but never ticked once, a run',
        dead.map(([k, v]) => `${k.toLowerCase()} ${(v.applied / n).toFixed(1)}`).join(', '));
      // THE MEASUREMENT THAT DECIDES THE NEXT ITEM. Seven of the nineteen sites ASSIGN the
      // counter rather than raising it, so a SHIV's two turns can overwrite a five-turn BARBED
      // SHOT. #197 tier A deliberately did not fix that - an instrument that changes the game
      // while measuring it cannot be trusted about either - and counts it instead.
      const shortened = sum('shortened');
      line('  applications that SHORTENED a longer bleed', shortened
        ? `${(shortened / n).toFixed(1)} a run, ${(shortened / (sum('applied') + shortened) * 100).toFixed(1)}% of them - ` +
          `the seven assigning sites`
        : 'none in this sample');
      // #201: and what that costs, which is the figure a decision can actually be made on. A
      // rate cannot be acted on by itself - 1% of applications is one turn a career or a hundred
      // depending on how much each one throws away - and an arm cannot settle an effect this
      // small either: K06 put the floor at about fourteen wins across three careers. Turns lost
      // against the tick they would each have done is the whole cost, as arithmetic.
      if (shortened) {
        const lost = per('turnsLost');
        const perTick = per('dmg') / Math.max(1, per('ticks'));
        line('    and what it threw away', `${lost.toFixed(1)} turns of bleeding a run, ` +
          `about ${Math.round(lost * perTick)} points against the ${Math.round(per('dmg'))} this side's bleeds land`);
      }
    });
  }
  // ── N01: what mitigate is asked, against what actually lands ──────────────────────────
  // The denominator that makes a counter kept in the wrong place visible. mitigate is reached by
  // four threatBoard forecasts - the AI previewing its own damage - and the roster card's resist
  // probe, none of which is a blow. Anything counted INSIDE it therefore counts wondering rather
  // than happening, which is how THICK_HIDE came to be published at 182,859 beside VAMPIRIC's
  // 3,414 and read as a common quirk rather than as a broken instrument.
  //
  // `hide seen` is what the old counter counted, kept deliberately: it is the same increment in
  // the same place, so the gap between it and the quirk census's THICK_HIDE row IS the size of
  // the error, measured rather than argued.
  {
    const m = foldAll('mit');
    if (m.calls) {
      const hide = (foldAll('qk').THICK_HIDE || {}).fired || 0;
      line('mitigate asked / blows landed', `${Math.round(m.calls / n)} / ${Math.round(m.blows / n)} a run ` +
        `- ${(m.calls / Math.max(1, m.blows)).toFixed(1)}x, and the rest are forecasts and probes`);
      line('  THICK_HIDE, as the old counter saw it / as it fires', `${m.hideSeen || 0} / ${hide}` +
        (hide ? ` - the published figure was ${((m.hideSeen || 0) / hide).toFixed(1)}x the real one` : ''));
    }
  }
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
      // K09: and the same thing in POINTS. Every row above is a share, and a share cannot answer
      // the question the trinket bench asks - what a piece is worth is how much damage it stops,
      // not what fraction of a category it stops. A flat resistance saves min(R, blow) per blow,
      // so a +10 against the sky's 2-to-8 tick saves the tick and not the ten: the shares hide
      // exactly the term that decides it. Absolute, per run, so two arms can be read side by side.
      line('  and in points a run, raw / soaked', Object.entries(b).sort((x, y) => y[1].hits - x[1].hits)
        .map(([t, v]) => `${t} ${Math.round(v.raw / n)} / ${Math.round(v.resisted / n)}`).join(', '));
    };
    show('atSquad', 'blows at the squad, by type');
    show('atFoe', 'blows at the hostiles, by type');

    // O15: AND THE SAME BLOWS BY SHAPE, which is the denominator NO HANDS' edge sits on and
    // which nothing has ever printed. The card asks the whole line to give up melee and pays a
    // fifth off enemy melee that reaches the FRONT RANK - one of these four buckets. O12/O13
    // measured the card at about seven wins below a default line and established that loosening
    // the ask is not the lever (raising LIGHT ORDER's cap bought 1.67 wins, inside the floor,
    // for nearly tripling how many lines keep it). So the question is the pay, and this is what
    // the pay covers.
    {
      const r = foldAll('reach');
      const tot = Object.values(r).reduce((a, v) => a + v.dmg, 0);
      if (tot > 0) {
        console.log('\n── WHAT REACHES THE SQUAD ' + '─'.repeat(31));
        const pc = v => `${(100 * v.dmg / tot).toFixed(1)}%`;
        [['meleeFront', 'melee, onto the front rank'],
         ['meleeBehind', 'melee, onto a rank behind it'],
         ['rangedFront', 'shot, onto the front rank'],
         ['rangedBehind', 'shot, onto a rank behind it']].forEach(([k, label]) => {
          const v = r[k] || { blows: 0, dmg: 0 };
          line('  ' + label, `${pc(v)} of damage taken (${v.blows.toLocaleString()} blows, ` +
                             `${Math.round(v.dmg).toLocaleString()} points)`);
        });
        // K11c: THE TWO WAYS A SQUAD SURVIVES, ON ONE LINE. Every row above is a SHARE, and a
        // share cannot tell the two apart: taking fewer blows and taking less per blow both
        // shrink the same total. K11b spent twenty-four careers failing to separate output from
        // armour on win counts and concluded the mechanism was unsupported; these two numbers
        // separate them at better than six sd from the same runs. Printed together because the
        // product is what matters and either half alone is a story.
        const allB = Object.values(r).reduce((a, v) => a + v.blows, 0);
        if (allB > 0) {
          line('blows taken, and points a blow',
               `${allB.toLocaleString()} blows at ${(tot / allB).toFixed(2)} points each ` +
               `= ${Math.round(tot).toLocaleString()} taken`);
        }
        const mf = r.meleeFront || { dmg: 0 };
        line('what NO HANDS\' edge covers', `${pc(mf)} of what the squad takes, and it cuts a ` +
             `fifth of that - so ${(100 * 0.2 * mf.dmg / tot).toFixed(1)}% of damage taken`);
        // AND WHAT IT ASKS FOR, on the same scale, because a trade needs both halves. The card
        // takes the squad's melee away; this is what the squad's melee is worth.
        const o = foldAll('out');
        const otot = Object.values(o).reduce((a, v) => a + v.dmg, 0);
        if (otot > 0) {
          const om = o.melee || { blows: 0, dmg: 0 };
          line('what the squad throws in melee', `${(100 * om.dmg / otot).toFixed(1)}% of the damage ` +
               `it deals (${om.blows.toLocaleString()} blows, ${Math.round(om.dmg).toLocaleString()} points)`);
          // O20: named rather than shared, because "a quarter is melee" cannot say what is
          // throwing it and two items were spent guessing.
          const mv = foldAll('outMoves');
          const top = Object.entries(mv).sort((a, b) => b[1] - a[1]).slice(0, 8);
          line('    and the melee it throws is', top.map(([k, v]) => `${k.toLowerCase()} ${v}`).join(', ') || 'none');
          // O21: the same blows, keyed by the body that threw them and the card that was live
          // when they landed. The move names a deck; this names a hand and a moment, which is
          // what separates "a Bruiser is standing in that line" from "the card was not live".
          const wh = foldAll('outMelee');
          Object.entries(wh).sort((a, b) => b[1] - a[1]).slice(0, 10)
            .forEach(([k, v]) => line('    thrown by', `${k} x${v}`));
          line('  so NO HANDS trades', `${(100 * om.dmg / otot).toFixed(1)}% of output for ` +
               `${(100 * 0.2 * mf.dmg / tot).toFixed(1)}% off what it takes`);
        }
      }
    }

    // L03: AND WHAT THE ROWS ABOVE CANNOT SEE. noteDamageType has exactly two callers - the
    // damage door and the sky's tick - so the shares above, K09's soak figures among them, are
    // shares of LEDGERED damage rather than of damage taken. L02 closed three unledgered paths
    // and measured them at under 1% of squad damage; bleed is the one that is left, and it is
    // common rather than grudge-phase. This row is the denominator's honesty: raw points, the
    // same unit the row above uses, so the two can simply be added.
    const ut = {};
    results.forEach(r => Object.entries(r.ut || {}).forEach(([side, bag]) =>
      Object.entries(bag).forEach(([cause, v]) => {
        const k = side + '/' + cause;
        ut[k] = ut[k] || { hits: 0, points: 0 };
        ut[k].hits += v.hits; ut[k].points += v.points;
      })));
    const typedRaw = (side) => Object.values((acc[side] || {})).reduce((a, v) => a + v.raw, 0);
    // M03 typed the last unledgered path, so this bag is expected to be EMPTY and the row says
    // so out loud rather than disappearing. A blank where a number used to be reads as a bug in
    // the report; "none" reads as the finding it is.
    if (!Object.keys(ut).length)
      line('damage the type ledger cannot see', 'none - every path to a bar goes through it');
    ['atSquad', 'atFoe'].forEach(side => {
      const rows = Object.entries(ut).filter(([k]) => k.startsWith(side + '/'));
      if (!rows.length) return;
      const pts = rows.reduce((a, [, v]) => a + v.points, 0);
      const typed = typedRaw(side);
      line(side === 'atSquad' ? 'damage the type ledger cannot see' : '  the same at the hostiles',
        `${rows.map(([k, v]) => `${k.split('/')[1]} ${Math.round(v.points / n)} a run over ${v.hits} ticks`).join(', ')}`);
      line('  as a share of all damage that side took',
        `${(pts / Math.max(1, pts + typed) * 100).toFixed(1)}%  (${Math.round(pts / n)} untyped against ${Math.round(typed / n)} typed, a run)`);
    });
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
  // O05: how many of those offers came from an elite node rather than a commander. Zero with the
  // lever off is the point - the elite drop is a grant and stages nothing - and a non-zero here
  // is the only proof that the arm is actually armed rather than quietly reading the baseline.
  const eOffers = tot('eliteOffers');
  line('relic offers seen', `${relOffers} across ${n} runs (${(relOffers / n).toFixed(2)} per run)`);
  line('  of them staged by an elite', `${eOffers} (${(eOffers / n).toFixed(2)} per run)`);
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
  { const sh = {}; results.forEach(r => Object.entries(r.forkShape || {}).forEach(([k, v]) => sh[k] = (sh[k] || 0) + v));
    const t = Object.values(sh).reduce((a, b) => a + b, 0);
    const say = k => `${sh[k] || 0} (${t ? Math.round(100 * (sh[k] || 0) / t) : 0}%)`;
    line('  a forced step, one node on the table', say('forced'));
    line('  a fight against something else', say('oneFightPlusOther'));
    line('  fights whose factions differ', say('factionsDiffer'));
    line('  the same faction twice', say('sameFactionTwice')); }
  line('  with something other than a fight on offer', `${withChoice} (${forks ? (withChoice / forks * 100).toFixed(0) : 0}%)`);
  line('  where every option was a fight', `${allFights} (${forks ? (allFights / forks * 100).toFixed(0) : 0}%)`);
  line('  and a non-fight was actually taken', `${tot('tookNonFight')} (${forks ? (tot('tookNonFight') / forks * 100).toFixed(0) : 0}%)`);
  const evOpt = tot('evOptions'), evBk = tot('evBookable'), evCould = tot('evCouldBook');
  // I01: the second chance, and whether it is on sale. `open` is every moment a squad was losing
  // and the engine would have let it break away but for the money; `afford` is how many of those
  // it could actually pay for. On the default arm nothing presses the button, so this is the door
  // as the game offers it rather than as a policy uses it - O16 added `--retreat losing`, which
  // does press it, and the taking rows below only print on that arm.
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
    // ── O16: AND WHAT TAKING IT DID, which is the half I01 could not reach ──────────────
    // Only under `--retreat losing`; the default arm presses nothing and says so rather than
    // printing a row of zeroes that reads like a finding about the game.
    const took = tot('retreatTook'), failed = tot('retreatFailed'), back = tot('fellBack');
    if (!took) {
      line('  and taken', `never - this arm does not press it (--retreat ${RETREAT_POLICY})`);
    } else {
      // The engine's own count beside this file's. They must agree: retreat() books every press
      // itself, so a gap means the policy pressed something that was not the button.
      const eng = tot('engineRetreats'), engF = tot('engineRetreatsFailed');
      line('  and taken', `${took} times (${(took / n).toFixed(2)} a run), engine booked ${eng}` +
        (eng === took ? '' : ` - MISMATCH, the policy and the button disagree`));
      line('    the break held', `${back} of ${took} (${(back / took * 100).toFixed(0)}%), ` +
        `failed ${failed}` + (engF === failed ? '' : ` - MISMATCH against the engine's ${engF}`));
      line('    scrap spent breaking off', `${tot('retreatPaid')} (${Math.round(tot('retreatPaid') / n)} a run, ` +
        `${Math.round(tot('retreatPaid') / took)} a press)`);
      const bt = foldAll('retreatTookBySector');
      const bcols = Object.keys(bt).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
      line('    taken by sector', bcols.map(k => `${k.slice(1)}: ${bt[k]}`).join('  ') || 'none');
    }
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
