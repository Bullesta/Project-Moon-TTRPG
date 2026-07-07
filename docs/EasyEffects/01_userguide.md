This guide is for **Game Masters and content creators** who want to write effects on weapons, outfits, augments, and skills without touching any code.

---

# What is EasyEffects?

EasyEffects is a small scripting language built into the Project Moon TTRPG system. It lets you describe what an item *does* in plain, readable text — and the system handles the rest automatically.

You write EasyEffects scripts directly on an item sheet, in the **EasyEffects** text field.

---

# The Basic Idea

Every EasyEffects script is made of one or more **blocks**. A block says:

> *"When **this thing** happens… do **that**."*

```
[Clash Win]
gain 1 Charge;
```

That's it. When the item's actor wins a clash, they gain 1 stack of Charge.

---

# Triggers

A trigger tells the system **when** to fire your effect. Write it in square brackets on its own line.

| Trigger | When it fires |
|---------|--------------|
| `[Always Active]` | A passive effect that's applied while the item is equipped |
| `[On Clash Start]` | Before clash rolls are resolved |
| `[On Clash]` | During clash resolution |
| `[Clash Win]` | The item's actor wins a clash |
| `[Clash Lose]` | The item's actor loses a clash |
| `[On Damage Calc]` | Before damage is finalized |
| `[On Hit]` | An attack connects (one-sided or after a Clash Win) |
| `[On Instant]` | Instant skill activation |
| `[On Burst]` | Tremor/Rupture Burst |
| `[On Critical]` | Critical Hit |
| `[On Devastation]` | Devastating Hit |
| `[On Action]` | At the end of an action |
| `[On Stagger]` | The item's actor becomes Staggered |
| `[Turn Start]` | The start of the item's actor's turn in combat |

One item can have **multiple trigger blocks** — just list them one after another:

```
[Clash Win]
gain 1 Charge;

[Turn Start]
lose 1 Charge;
```

## Passive Effects

The `[Always Active]` trigger is special. It doesn't wait for combat events, and applies the bonus ONCE when it's equipped, and inverts the bonus when unequipped (bringing it back to normal).

You cannot use math, dice or randomness with `[Always Active]` effects. It is strictly intended for passive effects that do not depend on any other variables, such as :

```
[Always Active]
dice max up attack 2;
```

---

# Actions

An action is one thing the effect does. Each action ends with a semicolon `;`.

## Gaining and losing statuses

```
gain 1 Burn on target;
lose 2 Bleed on self;
```

- `gain` adds stacks of a status
    - similarly `inflict` adds stacks of a status, but defaults to `target` instead of `self`.
- `lose` removes stacks of a status
- `on self` / `on target` controls who is affected

If you leave out `on ...`, the effect defaults to `self`, unless using `inflict`.

### Multi-word status names

Wrap the name in double quotes:

```
gain 1 "Stagger Fragile" on target;
lose 1 "Stagger Fragile" on self;
```

Single-word names don't need quotes, but you can add them if you want.

## Dealing damage and healing

```
do deal damage 5 on target;
do heal 10 on self;
```

## Modificating your Combat Bonuses

These are only applicable during clashes.

```
power up attack 2;
power down block 1;

dice max up attack 1;
dice max down evade 2;

regen hp 5;
regen st 2;
```

- `power up` gives a flat bonus to your dice power.
    - `power down` does the opposite.
- `dice max up` gives a flat bonus to your dice max.
    - `dice max down down` does the opposite.
- `regen st` heals ST.
- `regen hp` heals HP.

You can also say whether this applies to an `attack`/`block`/`evade`.

---

# Amounts

Amounts can be plain numbers, dice rolls, or values read from the actor.

| Form | Example | Meaning |
|------|---------|---------|
| Flat number | `3` | Always 3 |
| Dice | `1d6` | Roll a d6 at runtime |
| Actor value | `(self.rank)` | Equal to the actor's Rank |
| Math expression | `(self.rank * 2 + 1)` | Calculated at runtime |

```
gain (self.rank) Charge;
do deal damage 1d6 on target;
do deal damage (self.rank * 2) on target;
```

Dice and math can even be combined inside parentheses:

```
do deal damage (1d6 + self.rank) on target;
```

---

# Conditions

You can make an action conditional — it only runs if something is true.

## `require ... then`

```
require 3 self Charge then gain 1 Poise;
```

Reads: *"If you have at least 3 Charge, gain 1 Poise."*

Short form: `require <amount> <who> <Status> then <action>`

Full expression form:

```
require (self.status.Charge) >= 3 then gain 1 Poise;
```

## `spend ... to`

`spend` is the most powerful shorthand. It:

1. Checks that the actor has enough stacks
2. Runs the actions you specify
3. Automatically removes the spent stacks — you never write `lose` manually

```
spend 3 Charge to gain 1 Poise;
```

Reads: *"If you have at least 3 Charge, gain 1 Poise, then lose 3 Charge."*

You can specify who spends with `on`:

```
spend 3 "Stagger Fragile" on target to deal damage 5 on target;
```

---

# Chaining Actions (`and`)

Multiple actions can be chained with `and`. The condition (if any) applies to all of them.

```
require 3 self Charge then gain 1 Poise and lose 3 Charge;
gain 1 Burn on target and gain 1 Smoke on target;
```

You can also give each action in a chain its own target:

```
do add status Poise 1 on self and deal damage 1d6 on target;
```

If you omit `on` for a later action, it inherits the previous action's target.

---

# Scaling with `per`

You can multiply an amount by a live value using `per`:

```
do deal damage 2 per (self.status.Charge) on target;
```

Reads: *"Deal 2 damage for each stack of Charge on self."*

---

# Flags (boolean checks)

These let you check whether someone is in a certain state:

| Flag | What it checks |
|------|---------------|
| `isStaggered self/target` | Is currently Staggered |
| `isPanicking self/target` | Is currently Panicking |
| `hasStatus <Name> self/target` | Has at least 1 stack of that status |

```
require isStaggered target == 1 then gain 2 Bleed on target;
require hasStatus Burn target == 1 then do deal damage 3 on target;
```

---

# Comments

Lines starting with `#` are ignored:

```
[Clash Win]
# Build charge on each win
gain 1 Charge;
# Dump at 3
spend 3 Charge to gain 1 Poise;
```

---

# Full Examples

## Charge → Poise dump
```
[Clash Win]
gain 1 Charge;
spend 3 Charge to gain 1 Poise;
```

## Burn on hit, burst at 3 stacks
```
[On Hit]
gain 1 Burn on target;
spend 3 Burn on target to do deal damage 2d8 on target;
```

## Rank-scaling bleed
```
[On Hit]
gain (self.rank) Bleed on target;
```

## Combo weapon — two triggers
```
[Clash Win]
gain 1 Charge;

[On Hit]
do deal damage 1d6 on target;
```

## Punish the Staggered
```
[On Hit]
gain 1 Bleed on target;
require isStaggered target == 1 then gain 2 Bleed on target;
```

## AoE Smoke on Clash Win
```
[Clash Win]
gain 1 Smoke on enemies;
```

## Outfit — rally aura
```
[Turn Start]
do heal 5 on allies;
```

## Scale damage by clash margin
```
[Clash Win]
do deal damage (clash.margin * 2) on target;
```

## Dice + math combo
```
[Clash Win]
do deal damage (1d6 + self.rank) on target;
```

## Hardblood shield
```
[On Damage Calc]
spend 1 self Bleed to regen hp 3;
```

## Limbus style clashing buff
```
[On Clash Start]
power up attack 1 per (self.status.Burn) on target;
power up attack 1 per (self.status.Burn) on target;
```

---

# Quick Reference Card

## Triggers
`[Clash Win]` · `[Clash Lose]` · `[On Hit]` · `[On Stagger]` · `[Turn Start]`

## Targets
`self` · `target` · `ally` · `enemies` · `allies` · `all`

## Actions
| Statement | Meaning |
|-----------|---------|
| `gain <N> <Status> [on <target>]` | Add N stacks (target defaults to `self`) |
| `inflict <N> <Status> [on <target>]` | Add N stacks (target defaults to `target`) |
| `lose <N> <Status> [on <target>]` | Remove N stacks |
| `spend <N> <Status> [on <target>] to <actions>` | Require + remove + do |
| `require <condition> then <actions>` | Conditional block |
| `do deal damage <N> on <target>` | Deal HP damage |
| `do heal <N> on <target>` | Restore HP |
| `power <up/down> <attack/block/evade> <N>` | Flat Bonus/Malus on attack/block/evade. |
| `dice max <up/down> <attack/block/evade> <N>` | Dice Bonus/Malus on attack/block/evade. |
| `regen <hp/st/sp/light> <N>` | Shorthand to gain HP/ST/SP/Light |

## Readable values
| Path | Value |
|------|-------|
| `self.hp` / `sp` / `st` / `light` | Core attributes |
| `self.rank` | Rank |
| `self.attack` / `evade` / `block` | Combat modifiers |
| `self.stat.for` / `pru` / `jus` / `cha` / `ins` / `tem` | Ability scores |
| `self.status.Burn` | Stack count of Burn on self |
| `clash.margin` | Winning roll − losing roll |
| `clash.attackerRoll` / `clash.defenderRoll` | Raw clash dice |

## Math
`+` `-` `*` `/` `%` `//` (floor division) — all usable inside `( )`