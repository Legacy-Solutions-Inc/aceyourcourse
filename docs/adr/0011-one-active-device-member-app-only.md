# 11. One Active Device per Member, for the Member App only

Date: 2026-10-29

## Status

Accepted

## Decision

Each Member has one **Active Device** for the Member App.

- Signing in to the Member App on a new device makes it the Active Device.
  The previous device's next request lands on a "Session ended" screen.
- Every request for protected content checks the Active Device: decks, quiz
  questions, Reviewer PDF pages and video.
- Admin sessions are exempt.
- Every device switch is logged with its time and device label.
- Owners can see a Member's switch count and force a sign-out.
- There is no automatic lockout at launch.

## Why not Supabase's built-in "single session per user"

That setting applies to the whole account, so Staff (who are also Members)
using the Admin and the Member App at the same time would sign themselves
out. It also doesn't record the switch history we want for spotting shared
accounts. A small custom Active Device record covers both needs.
