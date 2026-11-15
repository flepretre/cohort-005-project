import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import noDisguisedElse from "./eslint-rules/no-disguised-else.js";

// Only the mechanical rules this repo has agreed on. Judgement calls live in
// CODING_STANDARDS.md, where the review agent applies them.
export default tseslint.config(
  { ignores: ["build/", ".react-router/", "node_modules/", "drizzle/"] },
  {
    files: ["app/**/*.{ts,tsx}"],
    languageOptions: { parser: tseslint.parser },
    linterOptions: { reportUnusedDisableDirectives: "off" },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      // Registered so existing `eslint-disable react-hooks/...` comments resolve.
      "react-hooks": reactHooks,
      local: { rules: { "no-disguised-else": noDisguisedElse } },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "no-negated-condition": "error",
      "local/no-disguised-else": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXExpressionContainer > JSXEmptyExpression",
          message:
            "No comments in markup. If the JSX needs explaining, extract a named component.",
        },
        {
          selector:
            "BinaryExpression[right.type='Literal'][left.name='intent']",
          message:
            "Compare `intent` against a shared constant, not a string literal.",
        },
        {
          selector:
            "BinaryExpression[right.type='Literal'][left.arguments.0.value='intent']",
          message:
            "Compare the intent against a shared constant, not a string literal.",
        },
        {
          selector:
            "BinaryExpression[right.type='Literal'][left.expression.arguments.0.value='intent']",
          message:
            "Compare the intent against a shared constant, not a string literal.",
        },
        {
          selector:
            "JSXOpeningElement:has(JSXAttribute[name.name='name'][value.value='intent']) > JSXAttribute[name.name='value'][value.type='Literal']",
          message:
            "Set the intent input's value from a shared constant, not a string literal.",
        },
        {
          selector:
            "TSAsExpression[typeAnnotation.type='TSStringKeyword'][expression.callee.property.name='get']",
          message:
            "Parse form data and search params with a zod schema instead of casting with `as string`.",
        },
      ],
    },
  }
);
