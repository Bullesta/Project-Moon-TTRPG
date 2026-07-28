import { tokenize, tokenizeExpression, LexError } from "./lexer.js";
import { isApplyPoolNoun, isBonusNoun, isRegenNoun, isReservedNoun, isResourceNoun, lookupNoun, nounAllowsOp, resolveApplyPool} from "./nouns.js";
import { normalizeTakingDamageTrigger } from "./damage-filter.js";

const SINGLE_TARGETS = new Set(["self", "target", "ally", "attacker"]);
const MULTI_TARGETS  = new Set(["enemies", "allies", "all"]);
const ALL_TARGETS    = new Set([...SINGLE_TARGETS, ...MULTI_TARGETS]);
const FLAG_KEYWORDS  = new Set(["isStaggered", "isPanicking", "hasStatus"]);
const MUL_OPS = new Set(["*", "/", "%", "//", "//f", "//c"]);
const EXPR_PATH_ROOTS = new Set([
  "self", "target", "ally", "attacker",
  "damage", "incoming", "item", "clash",
]);

export { normalizeTakingDamageTrigger, matchesDamageFilter } from "./damage-filter.js";

export function parse(source) {
  const tokens = tokenize(source);
  return new Parser(tokens).parseScript();
}

class Parser {
  constructor(tokens) { this.tokens = tokens; this.pos = 0; }

  skipNewlines() {
    while (this.tokens[this.pos]?.type === "NEWLINE") this.pos++;
  }

  _peekOffset(offset = 0) {
    let i = this.pos;
    for (let n = 0; n <= offset; n++) {
      while (this.tokens[i]?.type === "NEWLINE") i++;
      if (n === offset) return this.tokens[i];
      i++;
    }
    return this.tokens[i];
  }

  peek() { return this._peekOffset(); }

  consume(type, value) {
    this.skipNewlines();
    const tok = this.tokens[this.pos];
    if (type && tok.type !== type)
      throw new ParseError(`Expected ${type} but got ${tok.type} ('${tok.value}')`, tok);
    if (value !== undefined && tok.value !== value)
      throw new ParseError(`Expected '${value}' but got '${tok.value}'`, tok);
    this.pos++;
    return tok;
  }

  advance() {
    this.skipNewlines();
    const tok = this.tokens[this.pos];
    this.pos++;
    return tok;
  }

  /** `;`, newline(s), or next trigger / EOF. */
  consumeStatementEnd() {
    const start = this.pos;
    while (this.tokens[this.pos]?.type === "NEWLINE") this.pos++;
    const tok = this.tokens[this.pos];

    if (tok?.type === "SEMICOLON") {
      this.pos++;
      while (this.tokens[this.pos]?.type === "NEWLINE") this.pos++;
      return;
    }

    if (this.pos > start) return;

    if (tok?.type === "EOF" || tok?.type === "TRIGGER") return;

    throw new ParseError(
      `Expected ';' or newline to end statement, got ${tok.type} ('${tok.value}')`,
      tok
    );
  }

  check(type, value) {
    const tok = this.peek();
    return tok.type === type && (value === undefined || tok.value === value);
  }

  checkAny(type, values) { return values.some(v => this.check(type, v)); }

  // ── Status name ────────────────────────────────────────────────────────────
  parseStatusName() {
    if (this.check("STRING")) return this.consume("STRING").value;
    if (this.check("IDENT"))  return this.consume("IDENT").value;
    if (this.check("KEYWORD")) {
      const tok = this.peek();
      throw new ParseError(
        `'${tok.value}' is reserved; quote it as a status name, e.g. "${tok.value}"`,
        tok
      );
    }
    throw new ParseError(`Expected status name, got '${this.peek().value}'`, this.peek());
  }

  isStatusNameToken() {
    return this.check("STRING") || (this.check("IDENT") && !isReservedNoun(this.peek().value));
  }

  // ── Top level ──────────────────────────────────────────────────────────────
  parseScript() {
    const blocks = [];
    this.skipNewlines();
    while (!this.check("EOF")) {
      blocks.push(this.parseBlock());
      this.skipNewlines();
    }
    return { type: "Script", blocks };
  }

  parseBlock() {
    const rawTrigger = this.consume("TRIGGER").value;
    const { trigger, damageFilter } = normalizeTakingDamageTrigger(rawTrigger);
    const statements = [];
    this.skipNewlines();
    while (!this.check("EOF") && !this.check("TRIGGER")) {
      statements.push(this.parseStatement());
      this.skipNewlines();
    }
    if (trigger === "Always Active") {
      for (const stmt of statements) this._assertAlwaysActiveSafe(stmt);
    }
    return { type: "Block", trigger, damageFilter, statements };
  }

  _assertAlwaysActiveSafe(stmt) {
    const okBonus = new Set(["power up", "power down", "dice max up", "dice max down"]);
    for (const action of stmt.actions ?? []) {
      if (okBonus.has(action.verb)) continue;
      if ((action.verb === "add" || action.verb === "remove") && action.noun === "resource") continue;
      if (action.verb === "set" && action.noun === "resource") continue;
      throw new ParseError(
        `[Always Active] does not allow '${action.verb}'`
        + (action.noun === "status" ? " (status stacks)" : "")
        + "; use combat triggers for statuses/damage. Only max resources, power, and dice max are allowed here",
        this.peek()
      );
    }
  }

  parseStatement() {
    const polarity = this._parsePolarityPrefix();

    let stmt;
    if (this.check("KEYWORD", "spend"))   stmt = this.parseSpendStatement();
    else if (this.check("KEYWORD", "require")) stmt = this.parseNaturalStatement();
    else if (this.checkAny("KEYWORD", ["gain", "lose", "inflict", "reduce", "increase", "halve", "double", "convert"])) {
      stmt = this.parseNaturalStatement();
    }
    else if (this.check("IDENT", "deal") || this.check("IDENT", "set")) stmt = this.parseNaturalStatement();
    else if (this._isBonusVerbAhead()) stmt = this.parseBonusVerbStatement();
    else stmt = this.parseDoStatement();

    stmt.polarity = polarity;
    return stmt;
  }

  /**
   * Optional `positive:` / `negative:` effect-template polarity.
   * @returns {"positive"|"negative"|null}
   */
  _parsePolarityPrefix() {
    if (!this.checkAny("KEYWORD", ["positive", "negative"])) return null;
    if (this._peekOffset(1)?.type !== "COLON") return null;
    const polarity = this.consume("KEYWORD").value;
    this.consume("COLON");
    return polarity;
  }

  _parseOptionalAmount() {
    return this._parseAmountExpr({ required: false });
  }

  // Parse numbers, dice, N, accessors, or bare formulas.
  _parseAmountExpr({ required = false } = {}) {
    if (!this._isAmountAhead() && !this._isUnaryMinusAhead()) {
      if (required) {
        throw new ParseError(`Expected amount, got '${this.peek().value}'`, this.peek());
      }
      return null;
    }

    const expr = this._parseMainExpr();
    if (expr.type === "Num") return { type: "NUMBER", value: expr.value };
    if (expr.type === "Dice") return { type: "DICE", value: expr.formula };
    if (expr.type === "EffectN") return { type: "EFFECT_N" };
    if (expr.type === "Path" && expr.segments?.length === 1 && expr.segments[0] === "N") {
      return { type: "EFFECT_N" };
    }
    return { type: "ACCESSOR", expr };
  }

  _isUnaryMinusAhead() {
    const next = this._peekOffset(1);
    return this.check("MATHOP", "-") && (
      next?.type === "NUMBER"
      || next?.type === "DICE"
      || next?.type === "ACCESSOR"
      || (next?.type === "IDENT" && next.value === "N")
      || (next?.type === "IDENT" && this._isBareStatusAmountIdent(next.value))
    );
  }

  _parseMainExpr() {
    let node = this._parseMainTerm();
    while (this.check("MATHOP", "+") || this.check("MATHOP", "-")) {
      const op = this.advance().value;
      node = { type: "BinOp", op, left: node, right: this._parseMainTerm() };
    }
    return node;
  }

  _parseMainTerm() {
    let node = this._parseMainFactor();
    while (this.peek()?.type === "MATHOP" && MUL_OPS.has(this.peek().value)) {
      const op = this.advance().value;
      node = { type: "BinOp", op, left: node, right: this._parseMainFactor() };
    }
    return node;
  }

  _parseMainFactor() {
    if (this.check("MATHOP", "-")) {
      this.advance();
      return { type: "BinOp", op: "-", left: { type: "Num", value: 0 }, right: this._parseMainFactor() };
    }
    if (this.check("ACCESSOR")) {
      return parseAccessorExpression(this.consume("ACCESSOR").value);
    }
    if (this.check("NUMBER")) {
      return { type: "Num", value: Number(this.consume("NUMBER").value) };
    }
    if (this.check("DICE")) {
      return { type: "Dice", formula: this.consume("DICE").value };
    }
    if (this.check("IDENT", "N") || this.check("KEYWORD", "N")) {
      this.advance();
      return { type: "EffectN" };
    }
    // A bare status name reads its stack count on self.
    if (this.check("IDENT") && this._isBareStatusAmountIdent(this.peek().value)) {
      const name = this.consume("IDENT").value;
      return { type: "Path", segments: ["self", "status", name] };
    }
    throw new ParseError(`Unexpected token in amount: '${this.peek().value}'`, this.peek());
  }

  /** Ident that can start an amount (not a pool noun like `hp`). */
  _isBareStatusAmountIdent(name) {
    if (!name || typeof name !== "string") return false;
    if (EXPR_PATH_ROOTS.has(name)) return false;
    if (isApplyPoolNoun(name) || isResourceNoun(name) || isReservedNoun(name)) return false;
    return true;
  }

  _isBonusVerbAhead() {
    const t0 = this.peek();
    const t1 = this._peekOffset(1);
    const t2 = this._peekOffset(2);
    if (!t0 || t0.type !== "KEYWORD") return false;
    if (t0.value === "power" && t1?.type === "KEYWORD" && (t1.value === "up" || t1.value === "down")) return true;
    if (t0.value === "dice"  && t1?.type === "KEYWORD" && t1.value === "max" &&
        t2?.type === "KEYWORD" && (t2.value === "up" || t2.value === "down")) return true;
    if (t0.value === "regen" && t1 && (t1.type === "KEYWORD" || t1.type === "IDENT") && isRegenNoun(t1.value))
      return true;
    return false;
  }

  /**
   * Parses a bare bonus verb statement (no leading 'do', no 'if'):
   *   power up attack 2;
   *   regen hp 5;
   * Wraps it in a standard Statement with condition:null.
   */
  parseBonusVerbStatement() {
    const action = this.parseSingleAction();
    this.consumeStatementEnd();
    return { type: "Statement", condition: null, actions: [action], polarity: null };
  }

  // ── Standard if/do ────────────────────────────────────────────────────────
  parseDoStatement() {
    let condition = null;
    if (this.check("KEYWORD", "if")) condition = this.parseCondition();
    const actions = this.parseActionChain();
    this.consumeStatementEnd();
    return { type: "Statement", condition, actions, polarity: null };
  }

  parseCondition() {
    this.consume("KEYWORD", "if");
    const lhs = this.parseCondLhs();
    const operator = this.consume("OPERATOR").value;
    const rhs = this.parseCondRhs();
    return { type: "Condition", lhs, operator, rhs };
  }

  parseCondLhs() {
    if (this.check("KEYWORD") && FLAG_KEYWORDS.has(this.peek().value)) return this.parseFlagExpr();
    if (this.check("ACCESSOR")) {
      const raw = this.consume("ACCESSOR").value;
      return { type: "ACCESSOR", expr: parseAccessorExpression(raw) };
    }
    throw new ParseError(`Expected accessor or flag in condition LHS, got '${this.peek().value}'`, this.peek());
  }

  parseFlagExpr() {
    const flag = this.consume("KEYWORD").value;
    let statusName = null;
    if (flag === "hasStatus") statusName = this.parseStatusName();
    let flagTarget = "self";
    if (this.check("KEYWORD") && ALL_TARGETS.has(this.peek().value)) flagTarget = this.consume("KEYWORD").value;
    return { type: "FLAG", flag, statusName, target: flagTarget };
  }

  parseCondRhs() {
    if (this.check("ACCESSOR")) {
      return { type: "ACCESSOR", expr: parseAccessorExpression(this.consume("ACCESSOR").value) };
    }
    if (this.check("DICE"))   return { type: "DICE",   value: this.consume("DICE").value };
    if (this.check("NUMBER")) return { type: "NUMBER", value: Number(this.consume("NUMBER").value) };
    if (this.check("STRING") || this.check("IDENT")) return { type: "IDENT", value: this.parseStatusName() };
    throw new ParseError(`Expected value on RHS of condition, got '${this.peek().value}'`, this.peek());
  }

  // ── Action chain ──────────────────────────────────────────────────────────
  parseActionChain() {
    this.consume("KEYWORD", "do");
    const actions = [this.parseSingleAction()];
    while (this.check("KEYWORD", "and")) {
      this.consume("KEYWORD", "and");
      actions.push(this.parseSingleAction());
    }
    return actions;
  }

  /**
   * Parses a single action, handling multi-keyword verbs:
   *   power up / power down / dice max up / dice max down / regen / <IDENT>
   *
   * Returns { type:"Action", verb, noun, argument, amount, per, target }
   */
  parseSingleAction() {
    let verb, noun;
    let dealPool = null;
    let dealDamageType = null;

    // ── Multi-keyword verb detection ────────────────────────────────────────
    const t0 = this.peek();
    const t1 = this._peekOffset(1);
    const t2 = this._peekOffset(2);

    if (t0.type === "KEYWORD" && t0.value === "power") {
      if (t1.type === "KEYWORD" && t1.value === "up") {
        this.consume("KEYWORD", "power"); this.consume("KEYWORD", "up");
        verb = "power up";
      } else if (t1.type === "KEYWORD" && t1.value === "down") {
        this.consume("KEYWORD", "power"); this.consume("KEYWORD", "down");
        verb = "power down";
      } else {
        throw new ParseError(`Expected 'up' or 'down' after 'power', got '${t1.value}'`, t1);
      }
      noun = this._parseBonusNoun();

    } else if (t0.type === "KEYWORD" && t0.value === "dice" &&
               t1.type === "KEYWORD" && t1.value === "max") {
      if (t2.type === "KEYWORD" && t2.value === "up") {
        this.consume("KEYWORD","dice"); this.consume("KEYWORD","max"); this.consume("KEYWORD","up");
        verb = "dice max up";
      } else if (t2.type === "KEYWORD" && t2.value === "down") {
        this.consume("KEYWORD","dice"); this.consume("KEYWORD","max"); this.consume("KEYWORD","down");
        verb = "dice max down";
      } else {
        throw new ParseError(`Expected 'up' or 'down' after 'dice max', got '${t2.value}'`, t2);
      }
      noun = this._parseBonusNoun();

    } else if (t0.type === "KEYWORD" && t0.value === "regen") {
      this.consume("KEYWORD", "regen");
      verb = "regen";
      noun = this._parseRegenNoun();

    } else {
      // Standard single-word verb (IDENT)
      verb = this.consume("IDENT").value;
      if (verb === "deal" || verb === "heal") {
        ({ noun, pool: dealPool, damageType: dealDamageType } = this._parseDealHealTail(verb));
      } else {
        noun = this.consume("IDENT").value;
      }
    }

    // Optional status/resource name argument (only for standard verbs)
    let argument = null;
    let pool = dealPool ?? null;
    if (!["power up","power down","dice max up","dice max down","regen","deal","heal"].includes(verb)) {
      if (noun === "resource") argument = this.parseStatusName();
      else if (this.isStatusNameToken()) argument = this.parseStatusName();
    }

    let amount = this._parseOptionalAmount();

    // Optional per
    let per = null;
    if (this.check("KEYWORD", "per")) {
      this.consume("KEYWORD", "per");
      per = {
        type: "MULTIPLIEDPATH",
        multiplier: { type: "NUMBER", value: 1 },
        path: { type: "Path", segments: [] },
      };

      if (this.check("NUMBER")) {
        per.multiplier.value = Number(this.consume("NUMBER").value);
      }
      if (!this.check("ACCESSOR")) {
        throw new ParseError(`Expected accessor after 'per', got '${this.peek().value}'`, this.peek());
      }
      per.path = parseAccessorExpression(this.consume("ACCESSOR").value);
    }

    let target = null;
    if (this.check("KEYWORD", "on") || this.check("KEYWORD", "to")) {
      this.consume("KEYWORD");
      const tok = this.peek();
      if (!ALL_TARGETS.has(tok.value)) throw new ParseError(`Expected target after 'on'/'to', got '${tok.value}'`, tok);
      target = this.consume("KEYWORD").value;
    }

    return { type: "Action", verb, noun, argument, amount, per, target, pool, damageType: dealDamageType ?? null };
  }

  // Damage type and pool may appear in either order.
  _parseDealTypeAndPool() {
    let pool = null;
    let damageType = null;
    for (let n = 0; n < 2; n++) {
      const tok = this.peek();
      if (!tok) break;
      if (tok.type === "STRING") {
        if (damageType) break;
        damageType = this.consume("STRING").value;
        continue;
      }
      if (tok.type !== "IDENT" && tok.type !== "KEYWORD") break;
      if (tok.value === "damage") break;
      if (ALL_TARGETS.has(tok.value) || tok.value === "on" || tok.value === "to" || tok.value === "and") break;

      if (isApplyPoolNoun(tok.value)) {
        if (pool) break;
        pool = resolveApplyPool(tok.value);
        this.advance();
        continue;
      }

      if (damageType) break;
      damageType = tok.value;
      this.advance();
    }
    return { pool, damageType };
  }

  _consumeDamageNoun(after) {
    const token = this.peek();
    if (!["IDENT", "KEYWORD"].includes(token.type) || token.value !== "damage") {
      throw new ParseError(`Expected 'damage' after ${after}, got '${token.value}'`, token);
    }
    this.advance();
  }

  // Parse the optional type and pool before the damage noun.
  _parseDealHealTail(verb) {
    let pool = null;
    let damageType = null;
    if (verb === "deal") {
      ({ pool, damageType } = this._parseDealTypeAndPool());
    } else {
      const tok = this.peek();
      if ((tok.type === "IDENT" || tok.type === "KEYWORD") && isApplyPoolNoun(tok.value)) {
        pool = resolveApplyPool(tok.value);
        this.advance();
      }
    }

    // Heal may omit "damage" when the amount comes next.
    if (verb === "heal" && (this.check("NUMBER") || this.check("DICE") || this.check("ACCESSOR"))) {
      return { noun: "damage", pool, damageType: null };
    }

    this._consumeDamageNoun(`'${verb}'`);
    return { noun: "damage", pool, damageType };
  }

  /** Parses the noun for power up/down and dice max up/down: attack|block|evade|damage */
  _parseBonusNoun() {
    const tok = this.peek();
    if ((tok.type === "IDENT" || tok.type === "KEYWORD") && isBonusNoun(tok.value)) {
      this.advance();
      return lookupNoun(tok.value).id;
    }
    throw new ParseError(`Expected bonus noun (attack/block/evade/damage) after verb, got '${tok.value}'`, tok);
  }

  /** Parses the noun for regen: hp|st */
  _parseRegenNoun() {
    const tok = this.peek();
    if ((tok.type === "IDENT" || tok.type === "KEYWORD") && isRegenNoun(tok.value)) {
      this.advance();
      return lookupNoun(tok.value).id;
    }
    throw new ParseError(`Expected a regen noun after 'regen', got '${tok.value}'`, tok);
  }

  // ── Natural language ──────────────────────────────────────────────────────
  parseNaturalStatement() {
    let condition = null;
    if (this.check("KEYWORD", "require")) condition = this.parseRequireCondition();
    const actions = this.parseNaturalActionChain();
    this.consumeStatementEnd();
    return { type: "Statement", condition, actions, polarity: null };
  }

  parseRequireCondition() {
    this.consume("KEYWORD", "require");
    let lhs, operator, rhs;

    if (this.check("ACCESSOR")) {
      lhs = { type: "ACCESSOR", expr: parseAccessorExpression(this.consume("ACCESSOR").value) };
      operator = this.consume("OPERATOR").value;
      rhs = this.parseCondRhs();
    } else if (this.check("IDENT", "damage") || (this.check("KEYWORD") && this.peek().value === "damage")) {
      this.advance();
      this.consume("KEYWORD", "from");
      const statusName = this.parseStatusName();
      lhs = { type: "ACCESSOR", expr: { type: "Path", segments: ["damage", "source"] } };
      operator = "==";
      rhs = { type: "IDENT", value: statusName };
    } else if (this.check("NUMBER")) {
      const amount = this.consume("NUMBER").value;
      const tok = this.peek();
      if (!ALL_TARGETS.has(tok.value)) throw new ParseError(`Expected target in 'require', got '${tok.value}'`, tok);
      const tgt = this.consume("KEYWORD").value;
      const sName = this.parseStatusName();
      lhs = { type: "ACCESSOR", expr: { type: "Path", segments: [tgt, "status", sName] } };
      operator = ">=";
      rhs = { type: "NUMBER", value: Number(amount) };
    } else {
      throw new ParseError(`Expected accessor, 'damage from', or amount after 'require', got '${this.peek().value}'`, this.peek());
    }

    this.consume("KEYWORD", "then");
    return { type: "Condition", lhs, operator, rhs };
  }

  parseNaturalActionChain() {
    const actions = [this.parseNaturalAction()];
    while (this.check("KEYWORD", "and")) {
      this.consume("KEYWORD", "and");
      actions.push(this.parseNaturalAction());
    }
    return actions;
  }

  // Accept amount-first and noun-first forms, such as "deal 5 hp damage".
  parseNaturalDealAction() {
    this.consume("IDENT", "deal");

    let pool = null;
    let damageType = null;
    let amount;

    if (this._isAmountAhead()) {
      amount = this._parseOptionalAmount();
      ({ pool, damageType } = this._parseDealTypeAndPool());
      this._consumeDamageNoun("deal amount");
    } else {
      ({ pool, damageType } = this._parseDealTypeAndPool());
      this._consumeDamageNoun("'deal'");
      amount = this._parseOptionalAmount();
      if (!amount) {
        throw new ParseError(`Expected amount after 'deal … damage', got '${this.peek().value}'`, this.peek());
      }
    }

    let target = "target";
    if (this.check("KEYWORD", "on") || this.check("KEYWORD", "to")) {
      this.consume("KEYWORD");
      const tok = this.peek();
      if (!ALL_TARGETS.has(tok.value)) {
        throw new ParseError(`Expected target after 'on'/'to', got '${tok.value}'`, tok);
      }
      target = this.consume("KEYWORD").value;
    }

    return {
      type: "Action",
      verb: "deal",
      noun: "damage",
      argument: null,
      amount,
      per: null,
      target,
      pool,
      damageType,
    };
  }

  parseNaturalSetAction() {
    this.consume("IDENT", "set");

    const nameTok = this.peek();
    if ((nameTok.type !== "IDENT" && nameTok.type !== "KEYWORD") || !isResourceNoun(nameTok.value)) {
      throw new ParseError(`Expected resource noun after 'set' (maxHp/maxSt/maxSp/maxLight), got '${nameTok.value}'`, nameTok);
    }
    if (!nounAllowsOp(nameTok.value, "set")) {
      throw new ParseError(`'set' is not allowed on '${nameTok.value}'; use maxHp, maxSt, maxSp, or maxLight`, nameTok);
    }
    const resourceHit = lookupNoun(nameTok.value);
    this.advance();

    this.consume("KEYWORD", "to");
    const amount = this._parseAmountExpr({ required: true });

    return {
      type: "Action",
      verb: "set",
      noun: "resource",
      argument: resourceHit.id,
      amount,
      per: null,
      target: "self",
      pool: null,
    };
  }

  parseNaturalConvertAction() {
    this.consume("KEYWORD", "convert");

    let amount = null;
    let setAmount = false;
    if (this._isAmountAhead() || this._isUnaryMinusAhead()) {
      amount = this._parseAmountExpr({ required: true });
      setAmount = true;
    }

    this._consumeDamageNoun("'convert'");

    this.consume("KEYWORD", "to");

    let convertKind;
    let convertTo;
    if (this.check("STRING")) {
      convertKind = "damageType";
      convertTo = this.consume("STRING").value;
    } else {
      const destTok = this.peek();
      if (destTok.type !== "IDENT" && destTok.type !== "KEYWORD") {
        throw new ParseError(`Expected pool or damage type after 'convert … to', got '${destTok.value}'`, destTok);
      }
      const raw = destTok.value;
      const poolKey = String(raw).toLowerCase();
      if (isApplyPoolNoun(poolKey)) {
        convertKind = "pool";
        convertTo = resolveApplyPool(poolKey);
      } else {
        convertKind = "damageType";
        convertTo = raw;
      }
      this.advance();
    }

    return {
      type: "Action",
      verb: "convert",
      noun: "damage",
      argument: null,
      amount,
      setAmount,
      convertKind,
      convertTo,
      per: null,
      target: null,
      pool: null,
    };
  }

  _isAmountAhead() {
    if (this.check("NUMBER") || this.check("DICE") || this.check("ACCESSOR")) return true;
    if (this.check("IDENT", "N") || this.check("KEYWORD", "N")) return true;
    // deal Burn hp damage: status name as amount, not a pool noun
    if (this.check("IDENT") && this._isBareStatusAmountIdent(this.peek().value)) {
      const next = this._peekOffset(1);
      if (!next) return false;
      if (next.type === "MATHOP") return true;
      if ((next.type === "IDENT" || next.type === "KEYWORD") && (next.value === "damage" || isApplyPoolNoun(next.value))) {
        return true;
      }
    }
    return false;
  }

  parseNaturalAction() {
    if (this.check("IDENT", "deal")) return this.parseNaturalDealAction();
    if (this.check("IDENT", "set")) return this.parseNaturalSetAction();
    if (this.check("KEYWORD", "convert")) return this.parseNaturalConvertAction();

    const verbTok = this.consume("KEYWORD");
    if (!["gain", "lose", "inflict", "reduce", "increase", "halve", "double"].includes(verbTok.value))
      throw new ParseError(`Expected 'gain', 'lose', 'inflict', 'reduce', 'increase', 'halve', 'double', 'convert', 'set', or 'deal', got '${verbTok.value}'`, verbTok);

    if (verbTok.value === "halve" || verbTok.value === "double") {
      return this._desugarStatusScaleAction(verbTok.value);
    }

    if (verbTok.value === "reduce" || verbTok.value === "increase") {
      this._consumeDamageNoun(`'${verbTok.value}'`);
      if (this.check("KEYWORD", "by")) this.consume("KEYWORD", "by");
      const amount = this._parseAmountExpr({ required: false }) ?? { type: "NUMBER", value: 1 };
      return {
        type: "Action",
        verb: verbTok.value,
        noun: "damage",
        argument: null,
        amount,
        per: null,
        target: null,
        pool: null,
      };
    }

    if (
      (verbTok.value === "lose" || verbTok.value === "gain")
      && (this.check("KEYWORD", "half") || this.check("KEYWORD", "double"))
    ) {
      const scale = this.consume("KEYWORD").value;
      if (verbTok.value === "lose" && scale !== "half") {
        throw new ParseError(`Expected 'half' after 'lose', got '${scale}'`, this.peek());
      }
      if (verbTok.value === "gain" && scale !== "double") {
        throw new ParseError(`Expected 'double' after 'gain', got '${scale}'`, this.peek());
      }
      if (this.check("KEYWORD", "of")) this.consume("KEYWORD", "of");
      return this._desugarStatusScaleAction(verbTok.value === "lose" ? "halve" : "double");
    }

    let amount = this._parseOptionalAmount() ?? { type: "NUMBER", value: 1 };

    const nameTok = this.peek();
    const isResource = (nameTok.type === "IDENT" || nameTok.type === "KEYWORD") && isResourceNoun(nameTok.value);
    if (isResource) {
      const resourceHit = lookupNoun(nameTok.value);
      if (verbTok.value === "inflict")
        throw new ParseError(`'inflict' cannot target resource nouns like '${nameTok.value}'`, nameTok);
      if (!nounAllowsOp(nameTok.value, verbTok.value))
        throw new ParseError(`'${verbTok.value}' is not allowed on resource '${resourceHit.id}'`, verbTok);
      this.advance();

      let target = "self";
      if (this.check("KEYWORD", "on")) {
        this.consume("KEYWORD", "on");
        const tok = this.peek();
        if (!ALL_TARGETS.has(tok.value)) throw new ParseError(`Expected target after 'on', got '${tok.value}'`, tok);
        target = this.consume("KEYWORD").value;
      }

      const verb = verbTok.value === "lose" ? "remove" : "add";
      return {
        type: "Action",
        verb,
        noun: "resource",
        argument: resourceHit.id,
        amount,
        per: null,
        target,
      };
    }

    const statusName = this.parseStatusName();

    // inflict defaults to "target"; gain/lose default to "self"
    const defaultTarget = verbTok.value === "inflict" ? "target" : "self";

    let target = null;
    if (this.check("KEYWORD", "on")) {
      this.consume("KEYWORD", "on");
      const tok = this.peek();
      if (!ALL_TARGETS.has(tok.value)) throw new ParseError(`Expected target after 'on', got '${tok.value}'`, tok);
      target = this.consume("KEYWORD").value;
    }

    // Resolve verb → add/remove, baking in the default target
    const verb = verbTok.value === "lose" ? "remove" : "add";

    return {
      type: "Action",
      verb,
      noun: "status",
      argument: statusName,
      amount,
      per: null,
      target: target ?? defaultTarget,
    };
  }

  // Halving removes ceil(stacks / 2); doubling adds the current stack count.
  _desugarStatusScaleAction(kind) {
    const statusName = this.parseStatusName();
    let target = "self";
    if (this.check("KEYWORD", "on")) {
      this.consume("KEYWORD", "on");
      const tok = this.peek();
      if (!ALL_TARGETS.has(tok.value)) throw new ParseError(`Expected target after 'on', got '${tok.value}'`, tok);
      target = this.consume("KEYWORD").value;
    }

    const stackPath = { type: "Path", segments: [target, "status", statusName] };
    const amount = kind === "halve"
      ? {
        type: "ACCESSOR",
        expr: {
          type: "BinOp",
          op: "//c",
          left: stackPath,
          right: { type: "Num", value: 2 },
        },
      }
      : { type: "ACCESSOR", expr: stackPath };

    return {
      type: "Action",
      verb: kind === "halve" ? "remove" : "add",
      noun: "status",
      argument: statusName,
      amount,
      per: null,
      target,
    };
  }

  // ── Spend ─────────────────────────────────────────────────────────────────
  parseSpendStatement() {
    this.consume("KEYWORD", "spend");

    let spendAmount;
    if (this.check("NUMBER")) {
      spendAmount = { type: "NUMBER", value: Number(this.consume("NUMBER").value) };
    } else if (this.check("DICE")) {
      spendAmount = { type: "DICE", value: this.consume("DICE").value };
    } else if (this.check("ACCESSOR")) {
      spendAmount = { type: "ACCESSOR", expr: parseAccessorExpression(this.consume("ACCESSOR").value) };
    } else {
      throw new ParseError(`Expected amount after 'spend', got '${this.peek().value}'`, this.peek());
    }

    const statusName = this.parseStatusName();

    let spendTarget = "self";
    if (this.check("KEYWORD", "on")) {
      this.consume("KEYWORD", "on");
      const tok = this.peek();
      if (!ALL_TARGETS.has(tok.value)) throw new ParseError(`Expected target after 'on' in spend, got '${tok.value}'`, tok);
      spendTarget = this.consume("KEYWORD").value;
    }

    this.consume("KEYWORD", "to");
    const gainActions = this.parseNaturalActionChain();
    this.consumeStatementEnd();

    const condition = {
      type: "Condition",
      lhs: { type: "ACCESSOR", expr: { type: "Path", segments: [spendTarget, "status", statusName] } },
      operator: ">=",
      rhs: spendAmount,
    };

    const loseAction = {
      type: "Action",
      verb: "remove", noun: "status", argument: statusName,
      amount: spendAmount, per: null, target: spendTarget,
    };

    return { type: "Statement", condition, actions: [...gainActions, loseAction] };
  }
}

// ── Math-expression parser ────────────────────────────────────────────────────

export function parseAccessorExpression(raw) {
  const tokens = tokenizeExpression(raw);
  const ep = new ExprParser(tokens);
  const node = ep.parseExpr();
  ep.expect("EOF");
  return node;
}

class ExprParser {
  constructor(tokens) { this.tokens = tokens; this.pos = 0; }

  peek() { return this.tokens[this.pos]; }

  expect(type, value) {
    const tok = this.tokens[this.pos];
    if (tok.type !== type || (value !== undefined && tok.value !== value))
      throw new ParseError(`Expected ${type}${value ? ` '${value}'` : ""} in expression, got ${tok.type} ('${tok.value}')`, tok);
    this.pos++;
    return tok;
  }

  check(type, value) {
    const tok = this.peek();
    return tok.type === type && (value === undefined || tok.value === value);
  }

  parseExpr() {
    let node = this.parseTerm();
    while (this.check("MATHOP", "+") || this.check("MATHOP", "-")) {
      const op = this.expect("MATHOP").value;
      node = { type: "BinOp", op, left: node, right: this.parseTerm() };
    }
    return node;
  }

  parseTerm() {
    let node = this.parseFactor();
    while (
      this.check("MATHOP","*") || this.check("MATHOP","/") ||
      this.check("MATHOP","%") || this.check("MATHOP","//") ||
      this.check("MATHOP","//c") || this.check("MATHOP","//f")
    ) {
      const op = this.expect("MATHOP").value;
      node = { type: "BinOp", op, left: node, right: this.parseFactor() };
    }
    return node;
  }

  parseFactor() {
    if (this.check("MATHOP", "-")) {
      this.expect("MATHOP", "-");
      return { type: "BinOp", op: "-", left: { type: "Num", value: 0 }, right: this.parseFactor() };
    }
    if (this.check("LPAREN")) {
      this.expect("LPAREN");
      const node = this.parseExpr();
      this.expect("RPAREN");
      return node;
    }
    if (this.check("NUMBER")) return { type: "Num",  value: Number(this.expect("NUMBER").value) };
    if (this.check("DICE"))   return { type: "Dice", formula: this.expect("DICE").value };
    if (this.check("STRING")) {
      const name = this.expect("STRING").value;
      return { type: "Path", segments: ["self", "status", name] };
    }
    if (this.check("IDENT")) {
      // Bare N is the effect intensity.
      if (this.peek().value === "N") {
        const j = this.pos + 1;
        if (this.tokens[j]?.type !== "DOT") {
          this.expect("IDENT");
          return { type: "EffectN" };
        }
      }
      const segments = [this.expect("IDENT").value];
      while (this.check("DOT")) {
        this.expect("DOT");
        segments.push(this.check("STRING") ? this.expect("STRING").value : this.expect("IDENT").value);
      }
      // A bare status name reads its stack count on self.
      if (segments.length === 1 && !EXPR_PATH_ROOTS.has(segments[0])) {
        return { type: "Path", segments: ["self", "status", segments[0]] };
      }
      return { type: "Path", segments };
    }
    throw new ParseError(`Unexpected token in expression: '${this.peek().value}'`, this.peek());
  }
}

export class ParseError extends Error {
  constructor(message, token) {
    super(`[EasyEffects Parser] ${message} (token: ${JSON.stringify(token)})`);
    this.token = token;
  }
}