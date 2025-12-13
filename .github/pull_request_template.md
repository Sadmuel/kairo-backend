## Summary

> Briefly explain **why** this change exists and **what** it does.
> **Type of Change:**

- [ ] New feature (non-breaking)
- [ ] Feature enhancement (non-breaking)
- [ ] Fix
- [ ] Breaking change
- [ ] Other

## Scope

> Summarize if any changes are out of scope for this PR.

## What Changed?

<!-- Bullet list of major changes -->

-
-
-

## Implementation Notes

> Mention any key design decisions, tradeoffs, or alternatives considered.

## Tests & Evidence

- [ ] Have you reviewed if tests need to be added/modified? If not, why?
- [ ] Have you confirmed this change in a deployed environment? If not, why?
<!-- Step-by-step testing instructions:

1. Action to take
2. Expected result
   -->

## Risk & Rollout

- [ ] Code passes linting/formatting checks
- [ ] I've reviewed my own code for clarity
- [ ] No sensitive data (API keys, credentials) committed
- [ ] Have you requested a copilot review?
- [ ] Do these code changes use a feature flag? If not, why?
- [ ] Have you considered if documentation needs to be updated? (README, CLAUDE, Notion, etc.)
- [ ] Is a DB migration required? If so, have you linked the migration PR?
- [ ] Environment variables added/modified/necessary?

### Worst case scenario and rollback plan

> Explain here.

## Reviewer Quick Guide

**Gate checks:** CI green, scope clear, linting/tests pass, PR size reasonable (XS/S/M/L)
**High level scan:** Read summary, confirm scope is tight, check for surprises (renames, vendor files, huge diffs), rollback plan clear?
**Design:** Approach agreed? Interfaces stable? Security/performance implications?
**Code details:** Check error handling, logging, edge cases, test adequacy. Use "nit/optional/blocking" tags.
