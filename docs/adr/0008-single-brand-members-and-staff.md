# 8. Single-brand app: three Surfaces, Members and Staff, no tenancy

Date: 2026-10-29

## Status

Accepted. Supersedes [ADR 0005](0005-multi-tenancy.md) (multi-tenancy).

## Context

The template was built as a B2B SaaS starter, with Organizations, Memberships,
an Active Organization, Org Roles and a Superadmin Platform Role. Ace Your
Course is a single brand selling straight to individual board-exam reviewees,
so there are no tenants. The mockups describe three audiences (public visitors,
paying reviewees and AYC staff) who share one catalogue of Exams, Subjects and
Reviewers.

## Decision

- **One Next.js app hosts all three Surfaces**: the Website at `/`, the Member
  App under `/app`, and the Admin under `/admin`. They share one Supabase
  project. Subdomains, if wanted later, are a routing concern and need no
  split.
- **Remove multi-tenancy entirely.** No Organizations, Memberships, Active
  Organization, workspace switcher or Org Roles. Catalogue and content data is
  global. Member-owned data (progress, orders, sessions) is scoped to its User.
- **Two kinds of access:**
  - **Member**: every User who signs in with Google.
  - **Staff**: a User whose email is on the staff list, with a **Staff Role**
    of `owner` or `editor`.
  - The staff list is a database table keyed by email, not auth
    `app_metadata`, because staff are invited before their account exists.
  - One Google account can be both a Member and Staff.

## Considered options

- **Keep tenancy dormant with a single AYC Organization.** Rejected. It keeps
  complexity nobody uses and overloads "member" to mean both a tenant
  membership and a paying Member.
- **A monorepo with three apps.** Rejected for now. It isolates deploys at the
  cost of shared-package plumbing that a small team doesn't need.

## Consequences

- The template's tenancy code, its RLS policies and the Customers reference
  slice's org scoping must be removed or rewritten.
- `CONTEXT.md` terms Organization, Membership, Active Organization, Org Role,
  Platform Role and Superadmin are retired.
- RLS still applies, but scoped by User (member-owned rows) and Staff Role
  (Admin writes) instead of by Organization.
