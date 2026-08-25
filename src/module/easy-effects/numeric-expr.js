import { parseAccessorExpression } from "./parser.js";

/**
 * One binary EE op. Applies the operator to the left and right operands.
 * `//` / `//f` floor, `//c` ceil.
 * @param {string} op
 * @param {number} left
 * @param {number} right
 * @returns {number}
 */
export function applyMathOp(op, left, right) {
  switch (op) {
    case "+":  return left + right;
    case "-":  return left - right;
    case "*":  return left * right;
    case "/":  return right === 0 ? (console.warn("[EasyEffects] Division by zero"), 0) : left / right;
    case "%":  return right === 0 ? (console.warn("[EasyEffects] Modulo by zero"), 0)   : left % right;
    case "//":
    case "//f":
      return right === 0 ? (console.warn("[EasyEffects] Floor-div by zero"), 0) : Math.floor(left / right);
    case "//c": return right === 0 ? (console.warn("[EasyEffects] Ceil-div by zero"), 0) : Math.ceil(left / right);
    default:   console.warn(`[EasyEffects] Unknown operator '${op}'`); return 0;
  }
}

function isNumericAst(node) {
  if (!node) return false;
  switch (node.type) {
    case "Num":
    case "EffectN":
      return true;
    case "BinOp":
      return isNumericAst(node.left) && isNumericAst(node.right);
    default:
      return false;
  }
}

function evalNumericAst(node, effectN) {
  switch (node.type) {
    case "Num":
      return node.value;
    case "EffectN":
      return Math.max(0, Number(effectN) || 0);
    case "BinOp":
      return applyMathOp(node.op, evalNumericAst(node.left, effectN), evalNumericAst(node.right, effectN));
    default:
      return null;
  }
}

/**
 * Parse and eval a math string that is only numbers, `N`, and ops.
 * Used for effect description `[…]` so we share the EE op table.
 * Dice, paths, `$vars`, and parse errors return `null`.
 * @param {string} source
 * @param {{ effectN?: number }} [options]
 * @returns {number|null}
 */
export function evaluateNumericExpression(source, { effectN } = {}) {
  try {
    const node = parseAccessorExpression(String(source ?? "").trim());
    if (!isNumericAst(node)) return null;
    const value = evalNumericAst(node, effectN);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}
