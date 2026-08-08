# ADR-0002: Require per-tab entry of the console admin token

## Status

Accepted

## Context

The control API must be protected by `ADMIN_TOKEN`, while the console is a public static application. Embedding a bearer token in a Vite build would publish the token to every visitor.

## Alternatives considered

- Embed a build-time token — convenient for a demo but not authentication.
- Make control endpoints public — conflicts with the product contract.
- Prompt the operator for the token and retain it only in component memory — preserves the bearer boundary without a new backend service.

## Decision

The console prompts for the token and never persists or embeds it. Demo proxy calls do not need the token; receipt inspection and resolution do.

## Consequences

Operators must paste a token after loading the console. This is MVP-grade and does not solve multi-user auth.
