# Coding standards

## Fail with a thrown response, not a return value

A loader or an action that cannot continue throws. It does not return an
error shape for the component to unpack.

```ts
if (!course) throw data("Course not found", { status: 404 });
```

The route then has one success path. A returned error shape gives every
component a second path to forget about.

## Parse untrusted input with a schema

Form data, search parameters and request bodies get a zod schema before the
values reach any query, so the type checker sees what was actually checked.

## Make the code clear instead of commenting it

When a block needs a comment to be understood, extract it into a function or
component whose name says what the comment would have said. A comment earns
its place only for what the code cannot say: the reason behind a choice, or
a constraint imposed from outside.

## Mechanical rules live in ESLint

`eslint.config.js` enforces `any`, `!`, `as string` casts on form data,
comments in JSX, string-literal intents, and negated conditions. The
pre-commit hook runs it, so review need not repeat them.
