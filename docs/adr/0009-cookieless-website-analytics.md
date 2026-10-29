# 9. Cookieless, anonymous analytics on the Website, with no consent banner

Date: 2026-10-29

## Status

Accepted. Amends [ADR 0007](0007-analytics-posthog.md), whose consent-gated
default meant zero events fire because no banner exists.

## Decision

The Website runs PostHog in **cookieless, anonymous** mode:

- Nothing is persisted on the device (memory persistence, so no cookies or
  local storage).
- IP addresses are discarded and no person profiles are created.
- No consent banner is shown.

Captured events are pageviews and a `marketplace_click` event with the
Product, the Marketplace and the page.

Signed-in Members in the Member App may be identified, under the consent they
give on its consent screen.

The Privacy Policy discloses both.

## Why

The Website's key metric is whether it sends buyers to the Marketplaces.
Anonymous, cookieless data isn't personal information under the Data Privacy
Act of 2012, so a banner would cost a first-visit pop-up and lose the 30–60%
of visitors who decline, for no compliance gain.

## Considered options

- **A cookie consent banner with full PostHog.** Rejected. It gives richer
  data only from the visitors who accept.
