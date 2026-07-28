# EasyEffects — Syntax Cheatsheet

## Statement forms

```
# Natural language (recommended for most content)
gain <N> <Status> [on <target>];
lose <N> <Status> [on <target>];
halve <Status> [on <target>];
double <Status> [on <target>];
lose half [of] <Status> [on <target>];
gain double [of] <Status> [on <target>];
deal <N> [hp|st|sp|light] damage [to|on <target>];
deal <N> blunt hp damage [to|on <target>];
deal <N> hp blunt damage [to|on <target>];
deal (incoming.amount) damage to attacker;
convert [amount] damage to <pool|type>;
set maxHp|maxSt|maxSp|maxLight to <N>;
spend <N> <Status> [on <target>] to <actions>;
require <N> <target> <Status> then <actions>;
require (<expr>) <op> <value> then <actions>;

# Standard syntax (full control)
if (<expr>) <op> <value> do <verb> <noun> <arg> <amount> [per (<expr>)] [on <target>];

# Chaining — applies to both styles
<action> and <action> and ...;

# Semicolons are optional when each statement is on its own line
```

---

## Triggers

```
[Clash Win]      [Clash Lose]      [On Hit]
[On Stagger]     [Turn Start]      [End of Round]
[On Taking Damage]
[On Taking Burn Damage]   [On Taking HP Damage]   [On Taking Slash Damage]
[On Taking SP Damage]     [On Taking Any Damage]
```

Filter = pool (`HP`/`ST`/`SP`/`Light`), status source name, or any `damageType` string.

---

## Targets

```
self    target    ally    attacker    enemies    allies    all
```

`attacker` is set on `[On Taking Damage]` (the actor dealing the hit).

---

## Verbs (standard syntax)

```
do add status <Name> <N> on <target>
do remove status <Name> <N> on <target>
do deal damage <N> on <target>
do deal hp|st|sp|light damage <N> on <target>
deal <N> hp|st|sp|light damage to <target>
convert [amount] damage to hp|st|sp|light
convert [amount] damage to slash|pierce|blunt
set maxSp to 0
do heal <N> on <target>
do heal hp|st|sp damage <N> on <target>
do set stat <name> <N> on <target>
reduce damage [by] <amount>
increase damage [by] <amount>
```

On **effect templates** only, bare `N` is the gear entry's intensity. Sync replaces it with a number.

Use polarity branches for Positive and Negative versions:

```
positive:
reduce damage by N;
negative:
increase damage by N;
```

Polarity stays active until the next polarity label or trigger.

Synced effects live between `# >>> synced effects` and `# <<< synced effects`. Keep custom scripts outside that block.

---

## Amounts

```
3              # flat number
1d6            # dice roll
(self.rank)    # actor value
(1d6 + self.rank)   # dice + math
(self.rank * 2 + 1) # full expression
```

---

## Math operators

```
+   -   *   /   %   //   //f   //c
```
`//` and `//f` are floor division; `//c` is ceil.
`*` `/` `%` `//` `//f` `//c` bind tighter than `+` `-`. Parentheses nest freely.

---

## Readable paths

```
self.hp        self.sp        self.st        self.light
self.rank      self.attack    self.evade     self.block     self.speed
self.stat.for  .pru  .jus  .cha  .ins  .tem
self.status.Burn
self.status."Stagger Fragile"
clash.margin   clash.attackerRoll   clash.defenderRoll
incoming.amount   incoming.pool   incoming.source   incoming.damageType
damage.amount     damage.pool     damage.source     damage.damageType
```
`incoming.*` is an alias of `damage.*` (pending hit on `[On Taking Damage]`).
Replace `self` with `target`, `attacker`, or `ally` as needed.

---

## Conditions

```
(<expr>) >  <value>         (<expr>) <  <value>
(<expr>) >= <value>         (<expr>) <= <value>
(<expr>) == <value>         (<expr>) != <value>
isStaggered self/target == 1
isPanicking self/target == 0
hasStatus Burn self/target == 1
hasStatus "Stagger Fragile" target == 0
require damage from Burn then …   # [On Taking Damage] only
# or use [On Taking Burn Damage] instead of require damage from
```

---

## Flags

```
isStaggered <target>
isPanicking <target>
hasStatus <Status> <target>
```

---

## Status names

```
Burn                  # single word — no quotes needed
"Stagger Fragile"     # multi-word — always quote
```

---

## Comments

```
# This line is ignored
```

---

## Common patterns

```
# Build and dump a resource
[Clash Win]
gain 1 Charge;
spend 3 Charge to gain 1 Poise;

# Halve / double stacks (halve -> remaining = floor half)
[Turn Start]
halve Burn on self
double Poise

# Bare status name = self.status.Burn
[End of Round]
deal Burn hp damage to self
halve Burn

# Conditional on clash margin
[Clash Win]
if (clash.margin) >= 5 do add status Poise 2 on self;

# Rank-scaling effect
[On Hit]
gain (self.rank) Bleed on target;

# Dice + math
[On Hit]
do deal damage (1d6 + self.rank) on target;

# Per-stack scaling
[Clash Win]
do deal damage 2 per (target.status.Bleed) on target;

# Reflect incoming damage
[On Taking Damage]
deal (incoming.amount) hp damage to attacker

# AoE
[Clash Win]
gain 1 Smoke on enemies;

# Two triggers on one item
[Clash Win]
gain 1 Charge;

[Turn Start]
lose 1 Charge;

# Chained actions with different targets
[On Hit]
do add status Poise 1 on self and deal damage 1d6 on target;
```