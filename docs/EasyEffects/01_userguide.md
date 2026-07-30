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
| `[On Applied]` | This status was created on the actor |
| `[On Removed]` | This status was cleared from the actor |
| `[Turn Start]` | The start of the item's actor's turn in combat |
| `[End of Round]` | When the combat round advances |
| `[On Taking Damage]` | Before damage is applied to the defender (flat resists, etc.) |
| `[On Taking <Filter> Damage]` | Same, but only when the hit matches a pool, status source, or damage type (see below) |

One item can have **multiple trigger blocks** — just list them one after another:

```
[Clash Win]
gain 1 Charge;

[Turn Start]
lose 1 Charge;
```

`[On Applied]` / `[On Removed]` are for **status** items. They fire when that status first appears or fully clears

```
[On Applied]
deal 5 SP damage to self;
heal 1 light damage to self;

[On Removed]
heal 10 ST damage to self;
```

(`gain 1 Light` would add a **status** named Light — use `heal … light damage` to restore the Light pool.)

## Passive Effects

The `[Always Active]` trigger is special. It doesn't wait for combat events, and applies the bonus ONCE when it's equipped, and inverts the bonus when unequipped (bringing it back to normal).

You cannot use dice or randomness with `[Always Active]` effects. It is strictly intended for passive effects that do not depend on any other variables.

Allowed here: resource `gain` / `lose` / `set` on maxes, plus `power` / `dice max` passives.

Example:

```
[Always Active]
dice max up attack 2;
gain 2 maxHp;
set maxSp to 0;
```

- `gain` / `lose` on `maxHp` / `maxSt` / `maxSp` / `maxLight` are **additive** bonuses (misc / light bonus).
- `set maxSp to 0` (also `maxHp`, `maxSt`, `maxLight`) is an **absolute** override of the effective max.
- Lowering a max clamps the current value immediately. Removing the item restores the max, but not the points lost to that clamp. Removing an increased max also clamps current to the natural max.
- If several items `set` the same max, the **lowest** value wins.

### Filtered taking-damage triggers

`[On Taking <Filter> Damage]` is shorthand for "only run this block for matching hits."

| Filter | Matches when… |
|--------|----------------|
| *(omit)* / `Any` | Always (same as `[On Taking Damage]`) |
| `HP` / `ST` / `SP` / `Light` | Pending pool is that resource |
| A status name (`Burn`, `"Bleed"`) | Damage `source` is that status |
| Any other word (`Slash`, `Pierce`, `Blunt`, …) | `damageType` equals that string (case-insensitive) |

```
[On Taking Burn Damage]
reduce damage by 3;

[On Taking SP Damage]
deal (incoming.amount * 2) hp damage to self;
```

Pools win over names: `[On Taking HP Damage]` always means the HP pool, not a status called HP.

---

# Actions

An action is one thing the effect does. End it with a semicolon `;` or put the next action on a new line.

```
[Clash Win]
gain 1 Charge
lose 1 Bleed on self;
```

## Gaining and losing statuses

```
gain 1 Burn on target;
lose 2 Bleed on self;
halve Burn on self;
double Charge;
lose half of Burn on self;
gain double of Poise on self;
```

- `gain` adds stacks of a status
    - similarly `inflict` adds stacks of a status, but defaults to `target` instead of `self`.
- `lose` removes stacks of a status
- `halve <Status>` reduces stacks to half rounded down. (same as `lose half of <Status>`)
- `double <Status>` adds as many stacks as are already there (2x) (same as `gain double of <Status>`)
- `on self` / `on target` controls who is affected

If you leave out `on ...`, the effect defaults to `self`, unless using `inflict`.

### Status names in formulas

A bare status name in an amount/`(…)` formula means **that status’s stack count on self** (same as `self.status.Burn`):

```
deal Burn hp damage to self;
halve Burn on self;
power up attack 1 per (Burn);
```

Use `target.status.Burn` (or `attacker.status.…`) when you need someone else’s stacks.

### Multi-word status names

Wrap the name in double quotes:

```
gain 1 "Stagger Fragile" on target;
lose 1 "Stagger Fragile" on self;
```

Single-word names don't need quotes, but you can add them if you want. Reserved words (`half`, `double`, `halve`, `convert`, `by`, …) must be quoted too: `gain 1 "Double"`.

## Dealing damage and healing

```
do deal damage 5 on target;
deal (self.rank) hp damage to target;
deal (incoming.amount) blunt hp damage to attacker;
do heal 10 on self;
heal 10 ST damage to self;
heal 1 light damage to self;
```

On `[On Taking Damage]`, you can read the pending hit with `incoming.*` (alias of `damage.*`) and reflect or rewrite it:

```
[On Taking Damage]
deal (incoming.amount) hp damage to attacker;

[On Taking HP Damage]
deal (incoming.amount) blunt hp damage to attacker;

[On Taking SP Damage]
convert (incoming.amount * 2) damage to hp;

[On Taking Pierce Damage]
convert damage to blunt;
```

- `incoming.amount` / `damage.amount` - how much is about to apply
- `incoming.pool` - `hp`, `st`, `sp`, or `light`
- `incoming.source` - status name when the damage came from a status (e.g. Burn)
- `incoming.damageType` - slash / pierce / blunt / whatever was passed in
- `attacker` - the actor dealing the damage (same as `target` on this trigger)

`deal` accepts an optional damage type before or after the pool: `blunt hp damage` or `hp blunt damage`. If you omit the type and/or pool while reflecting, the new hit keeps `incoming.damageType` and `incoming.pool` (pool still defaults to `hp` outside that context).

`convert` changes the **pending** hit (pool and/or type, optionally amount) without firing another damage event.

Nested `deal` / `heal` from inside `[On Taking Damage]` does **not** re-run that trigger. Status ticks and other top-level `deal`s still run resists normally.

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

On `[On Taking Damage]`, you can gate by status source (status **name**), or use a filtered trigger instead:

```
require damage from Burn then reduce damage by 2;

[On Taking Burn Damage]
reduce damage by 2;
```

`reduce` / `increase` take an optional `by` and a full amount formula (`N`, `N*2`, `(N // 2)`, dice, etc.):

```
reduce damage by N;
increase damage by N*2;
```

## Effect templates (`N`, `positive:`, `negative:`)

Catalog **effect** items (Burn Resistance, etc.) can ship an EasyEffects template. Those templates may use:

- bare `N` (also inside math like `N*2`) - equals the number of buyins for that effect on the equipment.
- `positive:` / `negative:` - keep only the branch that matches the entry's Positive/Negative mode (sticky until the next polarity label or trigger)

Those tokens are **effect-template only**. They do not exist on equipment after sync.

On a weapon / outfit / skill / etc., linked effect templates are stamped into a managed region on the host EasyEffects script:

```
# >>> synced effects
# Burn Resistance
[On Taking Burn Damage]
reduce damage by 2;
# <<< synced effects
```

Adding, removing, or changing an effect's intensity or mode updates only that block. Put custom scripts **outside** the markers so they are not overwritten.

If you edit *inside* the synced block, auto-update pauses and warns you. Use **Sync with current effects** twice to confirm a rebuild; text outside the markers is preserved.

Example template on Burn Resistance:

```
[On Taking Burn Damage]
positive:
reduce damage by N;
negative:
increase damage by N;
```

Combat runs **only** the host's EasyEffects (not the catalog effect document).

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
`[Clash Win]` · `[Clash Lose]` · `[On Hit]` · `[On Stagger]` · `[On Applied]` · `[On Removed]` · `[Turn Start]` · `[On Taking <Filter> Damage]`

## Targets
`self` · `target` · `ally` · `attacker` · `enemies` · `allies` · `all`

## Actions
| Statement | Meaning |
|-----------|---------|
| `gain <N> <Status> [on <target>]` | Add N stacks (target defaults to `self`) |
| `inflict <N> <Status> [on <target>]` | Add N stacks (target defaults to `target`) |
| `lose <N> <Status> [on <target>]` | Remove N stacks |
| `halve <Status> [on <target>]` | Reduce stacks to half (floor) |
| `double <Status> [on <target>]` | Gain stacks equal to current (2x) |
| `lose half [of] <Status> [on <target>]` | Same as `halve` |
| `gain double [of] <Status> [on <target>]` | Same as `double` |
| `spend <N> <Status> [on <target>] to <actions>` | Require + remove + do |
| `require <condition> then <actions>` | Conditional block |
| `deal <N> [<type>] [hp\|st\|sp\|light] damage [to\|on <target>]` | Deal damage |
| `do deal damage <N> on <target>` | Deal HP damage (standard form) |
| `convert [amount] damage to <pool\|type>` | Rewrite pending hit on `[On Taking Damage]` |
| `set maxHp\|maxSt\|maxSp\|maxLight to <N>` | Absolute max (`[Always Active]` only) |
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
| `incoming.amount` / `.pool` / `.source` / `.damageType` | Pending damage (`damage.*` also works) |

## Math
`+` `-` `*` `/` `%` `//` or `//f` (floor) · `//c` (ceil) — all usable inside `( )`