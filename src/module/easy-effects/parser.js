import { tokenize, tokenizeExpression, LexError } from "./lexer.js";

const SINGLE_TARGETS = new Set(["self", "target", "ally"]);
const MULTI_TARGETS  = new Set(["enemies", "allies", "all"]);
const ALL_TARGETS    = new Set([...SINGLE_TARGETS, ...MULTI_TARGETS]);
const FLAG_KEYWORDS  = new Set(["isStaggered", "isPanicking", "hasStatus"]);

// Nouns that are valid after bonus verbs — kept as IDENTs or KWORDs
const BONUS_NOUNS = new Set(["attack", "block", "evade", "damage", "hp", "st"]);

export function parse(source) {
  const tokens = tokenize(source);
  return new Parser(tokens).parseScript();
}

class Parser {
  constructor(tokens) { this.tokens = tokens; this.pos = 0; }

  peek()  { return this.tokens[this.pos]; }
  peek2() { return this.tokens[this.pos + 1]; }
  peek3() { return this.tokens[this.pos + 2]; }

  consume(type, value) {
    const tok = this.tokens[this.pos];
    if (type && tok.type !== type)
      throw new ParseError(`Expected ${type} but got ${tok.type} ('${tok.value}')`, tok);
    if (value !== undefined && tok.value !== value)
      throw new ParseError(`Expected '${value}' but got '${tok.value}'`, tok);
    this.pos++;
    return tok;
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
    throw new ParseError(`Expected status name, got '${this.peek().value}'`, this.peek());
  }

  isStatusNameToken() {
    return this.check("STRING") || (this.check("IDENT") && !BONUS_NOUNS.has(this.peek().value));
  }

  // ── Top level ──────────────────────────────────────────────────────────────
  parseScript() {
    const blocks = [];
    while (!this.check("EOF")) blocks.push(this.parseBlock());
    return { type: "Script", blocks };
  }

  parseBlock() {
    const trigger = this.consume("TRIGGER").value;
    const statements = [];
    while (!this.check("EOF") && !this.check("TRIGGER")) {
      statements.push(this.parseStatement());
    }
    return { type: "Block", trigger, statements };
  }

  parseStatement() {
    if (this.check("KEYWORD", "spend"))   return this.parseSpendStatement();
    if (this.check("KEYWORD", "require")) return this.parseNaturalStatement();
    if (this.checkAny("KEYWORD", ["gain", "lose", "inflict"])) return this.parseNaturalStatement();
    // Bonus verbs usable without 'do' prefix: power up/down, dice max up/down, regen
    if (this._isBonusVerbAhead()) return this.parseBonusVerbStatement();
    return this.parseDoStatement();
  }

  /**
   * Returns true if the upcoming tokens start a bonus verb:
   *   power (up|down) …
   *   dice max (up|down) …
   *   regen (hp|st) …
   */
  _isBonusVerbAhead() {
    const t0 = this.tokens[this.pos];
    const t1 = this.tokens[this.pos + 1];
    const t2 = this.tokens[this.pos + 2];
    if (t0.type !== "KEYWORD") return false;
    if (t0.value === "power" && t1?.type === "KEYWORD" && (t1.value === "up" || t1.value === "down")) return true;
    if (t0.value === "dice"  && t1?.type === "KEYWORD" && t1.value === "max" &&
        t2?.type === "KEYWORD" && (t2.value === "up" || t2.value === "down")) return true;
    if (t0.value === "regen" && t1?.type === "KEYWORD" && (t1.value === "hp" || t1.value === "st")) return true;
    if (t0.value === "regen" && t1?.type === "IDENT"   && (t1.value === "hp" || t1.value === "st")) return true;
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
    this.consume("SEMICOLON");
    return { type: "Statement", condition: null, actions: [action] };
  }

  // ── Standard if/do ────────────────────────────────────────────────────────
  parseDoStatement() {
    let condition = null;
    if (this.check("KEYWORD", "if")) condition = this.parseCondition();
    const actions = this.parseActionChain();
    this.consume("SEMICOLON");
    return { type: "Statement", condition, actions };
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

    // ── Multi-keyword verb detection ────────────────────────────────────────
    const t0 = this.peek();
    const t1 = this.peek2();
    const t2 = this.peek3();

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
      noun = this.consume("IDENT").value;
    }

    // Optional status name argument (only for standard verbs)
    let argument = null;
    if (!["power up","power down","dice max up","dice max down","regen"].includes(verb)) {
      if (this.isStatusNameToken()) argument = this.parseStatusName();
    }

    // Optional amount
    let amount = null;
    if (this.check("NUMBER")) {
      amount = { type: "NUMBER", value: Number(this.consume("NUMBER").value) };
    } else if (this.check("DICE")) {
      amount = { type: "DICE", value: this.consume("DICE").value };
    } else if (this.check("ACCESSOR")) {
      amount = { type: "ACCESSOR", expr: parseAccessorExpression(this.consume("ACCESSOR").value) };
    }

    // Optional per
    let per = null;
    if (this.check("KEYWORD", "per")) {
      this.consume("KEYWORD", "per");
      per = {
        type: "MULTIPLIEDPATH",
        multiplier: { type: "NUMBER", value: 1 },
        path: { type: "Path", segments: [] },
      }

      if(check("NUMBER")) per.multiplier.value = Number(this.consume("NUMBER").value);
      if(check("ACCESSOR")) per.path = parseAccessorExpression(this.consume("ACCESSOR").value);
    }

    // Optional on <target>
    let target = null;
    if (this.check("KEYWORD", "on")) {
      this.consume("KEYWORD", "on");
      const tok = this.peek();
      if (!ALL_TARGETS.has(tok.value)) throw new ParseError(`Expected target after 'on', got '${tok.value}'`, tok);
      target = this.consume("KEYWORD").value;
    }

    return { type: "Action", verb, noun, argument, amount, per, target };
  }

  /** Parses the noun for power up/down and dice max up/down: attack|block|evade|damage */
  _parseBonusNoun() {
    const tok = this.peek();
    if (tok.type === "IDENT" && BONUS_NOUNS.has(tok.value)) return this.consume("IDENT").value;
    if (tok.type === "KEYWORD" && BONUS_NOUNS.has(tok.value)) return this.consume("KEYWORD").value;
    throw new ParseError(`Expected bonus noun (attack/block/evade/damage) after verb, got '${tok.value}'`, tok);
  }

  /** Parses the noun for regen: hp|st */
  _parseRegenNoun() {
    const tok = this.peek();
    if ((tok.type === "IDENT" || tok.type === "KEYWORD") && (tok.value === "hp" || tok.value === "st")) {
      this.pos++;
      return tok.value;
    }
    throw new ParseError(`Expected 'hp' or 'st' after 'regen', got '${tok.value}'`, tok);
  }

  // ── Natural language ──────────────────────────────────────────────────────
  parseNaturalStatement() {
    let condition = null;
    if (this.check("KEYWORD", "require")) condition = this.parseRequireCondition();
    const actions = this.parseNaturalActionChain();
    this.consume("SEMICOLON");
    return { type: "Statement", condition, actions };
  }

  parseRequireCondition() {
    this.consume("KEYWORD", "require");
    let lhs, operator, rhs;

    if (this.check("ACCESSOR")) {
      lhs = { type: "ACCESSOR", expr: parseAccessorExpression(this.consume("ACCESSOR").value) };
      operator = this.consume("OPERATOR").value;
      rhs = this.parseCondRhs();
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
      throw new ParseError(`Expected accessor or amount after 'require', got '${this.peek().value}'`, this.peek());
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

  parseNaturalAction() {
    const verbTok = this.consume("KEYWORD");
    if (!["gain", "lose", "inflict"].includes(verbTok.value))
      throw new ParseError(`Expected 'gain', 'lose', or 'inflict', got '${verbTok.value}'`, verbTok);

    let amount = { type: "NUMBER", value: 1 };
    if (this.check("NUMBER")) {
      amount = { type: "NUMBER", value: Number(this.consume("NUMBER").value) };
    } else if (this.check("DICE")) {
      amount = { type: "DICE", value: this.consume("DICE").value };
    } else if (this.check("ACCESSOR")) {
      amount = { type: "ACCESSOR", expr: parseAccessorExpression(this.consume("ACCESSOR").value) };
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
    this.consume("SEMICOLON");

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
      this.check("MATHOP","%") || this.check("MATHOP","//")
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
    if (this.check("IDENT")) {
      const segments = [this.expect("IDENT").value];
      while (this.check("DOT")) {
        this.expect("DOT");
        segments.push(this.check("STRING") ? this.expect("STRING").value : this.expect("IDENT").value);
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