const KEYWORDS = new Set([
  // core syntax
  "if", "do", "on", "per", "and", "to",
  // targets (single)
  "self", "target", "ally",
  // targets (multi)
  "enemies", "allies", "all",
  // flag keywords
  "isStaggered", "isPanicking", "hasStatus",
  // natural-language aliases
  "gain", "spend", "lose", "require", "then", "inflict",
  // verb component keywords (power up/down, dice max up/down, regen)
  "power", "dice", "regen", "up", "down", "max",
]);

/**
 * @param {string} source
 * @returns {{ type: string, value: string }[]}
 */
export function tokenize(source) {
  const tokens = [];
  let i = 0;

  while (i < source.length) {
    if (/\s/.test(source[i])) { i++; continue; }

    // Comment
    if (source[i] === "#") {
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }

    // TRIGGER [...]
    if (source[i] === "[") {
      const end = source.indexOf("]", i);
      if (end === -1) throw new LexError("Unclosed '[' in trigger", i);
      tokens.push({ type: "TRIGGER", value: source.slice(i + 1, end).trim() });
      i = end + 1;
      continue;
    }

    // STRING "..."
    if (source[i] === '"') {
      let j = i + 1;
      while (j < source.length && source[j] !== '"') {
        if (source[j] === "\n") throw new LexError("Unterminated string (newline inside quotes)", i);
        j++;
      }
      if (j >= source.length) throw new LexError("Unterminated string", i);
      tokens.push({ type: "STRING", value: source.slice(i + 1, j) });
      i = j + 1;
      continue;
    }

    // ACCESSOR (...) — raw capture with depth tracking
    if (source[i] === "(") {
      let depth = 1, j = i + 1;
      while (j < source.length && depth > 0) {
        if (source[j] === "(") depth++;
        if (source[j] === ")") depth--;
        if (depth > 0) j++;
      }
      if (depth !== 0) throw new LexError("Unclosed '(' in accessor", i);
      tokens.push({ type: "ACCESSOR", value: source.slice(i + 1, j).trim() });
      i = j + 1;
      continue;
    }

    // SEMICOLON
    if (source[i] === ";") {
      tokens.push({ type: "SEMICOLON", value: ";" });
      i++;
      continue;
    }

    // OPERATOR >= <= == != > <
    if (/[><!]/.test(source[i]) || (source[i] === "=" && source[i + 1] === "=")) {
      const two = source.slice(i, i + 2);
      if ([">=", "<=", "==", "!="].includes(two)) {
        tokens.push({ type: "OPERATOR", value: two }); i += 2;
      } else {
        tokens.push({ type: "OPERATOR", value: source[i] }); i++;
      }
      continue;
    }

    // NUMBER or DICE
    if (/[0-9]/.test(source[i])) {
      let num = "";
      while (i < source.length && /[0-9]/.test(source[i])) num += source[i++];
      if (source[i] === "d" || source[i] === "D") {
        let diceStr = num + "d"; i++;
        if (!/[0-9]/.test(source[i])) throw new LexError("Expected number after 'd' in dice expression", i);
        while (i < source.length && /[0-9]/.test(source[i])) diceStr += source[i++];
        tokens.push({ type: "DICE", value: diceStr });
      } else {
        tokens.push({ type: "NUMBER", value: num });
      }
      continue;
    }

    // KEYWORD or IDENT
    if (/[a-zA-Z_]/.test(source[i])) {
      let word = "";
      while (i < source.length && /[a-zA-Z0-9_]/.test(source[i])) word += source[i++];
      tokens.push({ type: KEYWORDS.has(word) ? "KEYWORD" : "IDENT", value: word });
      continue;
    }

    throw new LexError(`Unexpected character '${source[i]}'`, i);
  }

  tokens.push({ type: "EOF", value: "" });
  return tokens;
}

/**
 * Tokenizes the interior of an accessor for math-expression parsing.
 */
export function tokenizeExpression(source) {
  const tokens = [];
  let i = 0;

  while (i < source.length) {
    if (/\s/.test(source[i])) { i++; continue; }
    if (source[i] === "(") { tokens.push({ type: "LPAREN", value: "(" }); i++; continue; }
    if (source[i] === ")") { tokens.push({ type: "RPAREN", value: ")" }); i++; continue; }
    if (source[i] === ".") { tokens.push({ type: "DOT",    value: "." }); i++; continue; }

    if (source[i] === '"') {
      let j = i + 1;
      while (j < source.length && source[j] !== '"') j++;
      if (j >= source.length) throw new LexError("Unterminated string in expression", i);
      tokens.push({ type: "STRING", value: source.slice(i + 1, j) });
      i = j + 1;
      continue;
    }

    if (source[i] === "/" && source[i + 1] === "/") {
      tokens.push({ type: "MATHOP", value: "//" }); i += 2; continue;
    }
    if ("+-*/%".includes(source[i])) {
      tokens.push({ type: "MATHOP", value: source[i] }); i++; continue;
    }

    if (/[0-9]/.test(source[i])) {
      let num = "";
      while (i < source.length && /[0-9]/.test(source[i])) num += source[i++];
      if (source[i] === "d" || source[i] === "D") {
        let diceStr = num + "d"; i++;
        if (!/[0-9]/.test(source[i])) throw new LexError("Expected number after 'd'", i);
        while (i < source.length && /[0-9]/.test(source[i])) diceStr += source[i++];
        tokens.push({ type: "DICE", value: diceStr });
      } else {
        tokens.push({ type: "NUMBER", value: num });
      }
      continue;
    }

    if (/[a-zA-Z_]/.test(source[i])) {
      let word = "";
      while (i < source.length && /[a-zA-Z0-9_]/.test(source[i])) word += source[i++];
      tokens.push({ type: "IDENT", value: word });
      continue;
    }

    throw new LexError(`Unexpected character '${source[i]}' in expression`, i);
  }

  tokens.push({ type: "EOF", value: "" });
  return tokens;
}

export class LexError extends Error {
  constructor(message, position) {
    super(`[EasyEffects Lexer] ${message} at position ${position}`);
    this.position = position;
  }
}