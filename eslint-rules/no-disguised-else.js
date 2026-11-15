// Flags `if (!x) { ...; return a; } return b;` at the end of a block.
// An early return must return early: when the next statement is the
// block's last `return`, the negated `if` is an if/else in disguise.
// Fix: `if (x) return b; ...; return a;`

function isNegated(test) {
  if (test.type === "UnaryExpression" && test.operator === "!") return true;
  if (test.type === "BinaryExpression") {
    return test.operator === "!==" || test.operator === "!=";
  }
  return false;
}

function endsInReturn(statement) {
  if (statement.type === "ReturnStatement") return true;
  if (statement.type === "BlockStatement") {
    return statement.body.at(-1)?.type === "ReturnStatement";
  }
  return false;
}

/** @type {import("eslint").Rule.RuleModule} */
export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow a negated `if` that returns right before the function's final `return`",
    },
    messages: {
      disguisedElse:
        "This negated `if` sits right before the final `return`, so it is an if/else in disguise. Invert it: test the positive condition and return its result first.",
    },
    schema: [],
  },
  create(context) {
    // Any block whose last statement is a `return` is the end of its path:
    // a function body, or a branch like `if (intent === X) { ... }`.
    function check(block) {
      const statements = block.body;
      if (statements.length < 2) return;
      const last = statements.at(-1);
      const beforeLast = statements.at(-2);
      if (last.type !== "ReturnStatement") return;
      if (beforeLast.type !== "IfStatement" || beforeLast.alternate) return;
      if (!isNegated(beforeLast.test)) return;
      if (!endsInReturn(beforeLast.consequent)) return;
      context.report({ node: beforeLast, messageId: "disguisedElse" });
    }

    return { BlockStatement: check };
  },
};
