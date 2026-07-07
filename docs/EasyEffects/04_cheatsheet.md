# EasyEffects — Syntax Cheatsheet

## Statement forms

```
# Natural language (recommended for most content)
gain <N> <Status> [on <target>];
lose <N> <Status> [on <target>];
spend <N> <Status> [on <target>] to <actions>;
require <N> <target> <Status> then <actions>;
require (<expr>) <op> <value> then <actions>;

# Standard syntax (full control)
if (<expr>) <op> <value> do <verb> <noun> <arg> <amount> [per (<expr>)] [on <target>];

# Chaining — applies to both styles
<action> and <action> and ...;
```

---

## Triggers

```
[Clash Win]      [Clash Lose]      [On Hit]
[On Stagger]     [Turn Start]
```

---

## Targets

```
self    target    ally    enemies    allies    all
```

---

## Verbs (standard syntax)

```
do add status <Name> <N> on <target>
do remove status <Name> <N> on <target>
do deal damage <N> on <target>
do heal <N> on <target>
do set stat <name> <N> on <target>
```

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
+   -   *   /   %   //
```
`*` `/` `%` `//` bind tighter than `+` `-`. Parentheses nest freely.

---

## Readable paths

```
self.hp        self.sp        self.st        self.light
self.rank      self.attack    self.evade     self.block     self.speed
self.stat.for  .pru  .jus  .cha  .ins  .tem
self.status.Burn
self.status."Stagger Fragile"
clash.margin   clash.attackerRoll   clash.defenderRoll
```
Replace `self` with `target` or `ally` as needed.

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