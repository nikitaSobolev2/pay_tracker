/** Safe arithmetic for amount fields: + - * / with * / before + -. */

const EXPRESSION_PATTERN = /^[\d.\s+\-*/]+$/;
const OPERATOR_CHARS = /[+\-*/]/;

/** True when the raw amount includes a binary math operator (leading minus ignored). */
export function looksLikeAmountExpression(raw: string): boolean {
  return OPERATOR_CHARS.test(raw.replace(/^-/, ""));
}

export function evaluateAmountExpression(raw: string): number | null {
  const cleaned = raw.replace(/,/g, ".").replace(/\s+/g, "");
  if (!cleaned || !EXPRESSION_PATTERN.test(cleaned)) {
    return null;
  }
  if (/[+\-*/]{2,}/.test(cleaned) || !/^\d/.test(cleaned.replace(/^[+-]/, ""))) {
    // allow leading minus as unary via rewrite
  }

  try {
    const tokens = tokenize(cleaned);
    if (tokens.length === 0) {
      return null;
    }
    const result = evaluateTokens(tokens);
    if (!Number.isFinite(result)) {
      return null;
    }
    return result;
  } catch {
    return null;
  }
}

type Token =
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "op"; readonly value: "+" | "-" | "*" | "/" };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < input.length) {
    const char = input[index];
    if (char >= "0" && char <= "9" || char === ".") {
      let end = index + 1;
      while (
        end < input.length &&
        ((input[end] >= "0" && input[end] <= "9") || input[end] === ".")
      ) {
        end += 1;
      }
      const value = Number(input.slice(index, end));
      if (!Number.isFinite(value)) {
        throw new Error("Invalid number");
      }
      tokens.push({ kind: "number", value });
      index = end;
      continue;
    }
    if (char === "+" || char === "-" || char === "*" || char === "/") {
      const isUnary =
        char === "-" &&
        (tokens.length === 0 || tokens[tokens.length - 1]?.kind === "op");
      if (isUnary) {
        let end = index + 1;
        while (
          end < input.length &&
          ((input[end] >= "0" && input[end] <= "9") || input[end] === ".")
        ) {
          end += 1;
        }
        if (end === index + 1) {
          throw new Error("Invalid unary");
        }
        const value = -Number(input.slice(index + 1, end));
        if (!Number.isFinite(value)) {
          throw new Error("Invalid number");
        }
        tokens.push({ kind: "number", value });
        index = end;
        continue;
      }
      tokens.push({ kind: "op", value: char });
      index += 1;
      continue;
    }
    throw new Error("Unexpected character");
  }
  return tokens;
}

function evaluateTokens(tokens: Token[]): number {
  const values: number[] = [];
  const ops: Array<"+" | "-" | "*" | "/"> = [];

  for (const token of tokens) {
    if (token.kind === "number") {
      values.push(token.value);
      continue;
    }
    while (ops.length > 0 && precedence(ops[ops.length - 1]!) >= precedence(token.value)) {
      applyOp(values, ops.pop()!);
    }
    ops.push(token.value);
  }
  while (ops.length > 0) {
    applyOp(values, ops.pop()!);
  }
  if (values.length !== 1) {
    throw new Error("Invalid expression");
  }
  return values[0]!;
}

function precedence(op: "+" | "-" | "*" | "/"): number {
  return op === "*" || op === "/" ? 2 : 1;
}

function applyOp(values: number[], op: "+" | "-" | "*" | "/"): void {
  const right = values.pop();
  const left = values.pop();
  if (left === undefined || right === undefined) {
    throw new Error("Missing operand");
  }
  if (op === "/" && right === 0) {
    throw new Error("Division by zero");
  }
  const result =
    op === "+"
      ? left + right
      : op === "-"
        ? left - right
        : op === "*"
          ? left * right
          : left / right;
  values.push(result);
}
