# Discourse X Native Embed

Fork of [Lhcfl/discourse-twitter-native-embed](https://github.com/Lhcfl/discourse-twitter-native-embed) — a Discourse theme component that converts oneboxed X/Twitter links into native embeds (with images, video, like/retweet counts) using X's `widgets.js`.

**Status:** Experimental. Use at your own risk.

## Why this fork exists

The upstream component would throw an uncaught error and trigger Discourse's safe-mode warning banner whenever a post's X/Twitter onebox didn't carry the expected `data-onebox-src` attribute (e.g. due to X's ongoing API/embed instability). This fork hardens the decorator against that and a few related issues.

## Installation

1. In Discourse Admin → Customize → Themes, install this component via its Git URL:
   `https://github.com/terraboss/discourse-x-native-embed`
2. Add it to the themes you want it enabled on.
3. Keep "Automatically update when Discourse updates" enabled to pick up future fixes.

## Changelog

Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

### [Unreleased]
- Fix: quoted-tweet detection now also matches `x.com` links (previously only `twitter.com`)
- Fix: tightened onebox link selector to `[href*="/status/"]` to avoid false matches on unrelated links containing the word "status"
- Add: `data-dnt="true"` on generated `blockquote.twitter-tweet` elements to request Do-Not-Track behavior from X's embed script (privacy/GDPR)
- Refactor: extracted shared `makeTweetBlockquote()` helper to remove duplication across the three embed code paths

### 2026-09-27
- **Fix:** wrapped the entire `decorateCookedElement` callback in try/catch so a single malformed post can no longer crash the decorator pipeline and trigger Discourse's safe-mode banner
- **Fix:** guarded `data-onebox-src` attribute access — this was the confirmed root cause of the safe-mode errors (`.replaceAll()` was called on a `null` value when the attribute was missing)
- **Fix:** prevented `widgets.js` from being appended to `<head>` more than once in parallel; added a loading-state guard
- **Fix:** when `widgets.js` is already loaded, newly rendered posts (e.g. from infinite scroll) are now re-scanned via `window.twttr.widgets.load(el)` instead of being silently skipped
- **Chore:** updated `LICENSE` copyright line

### Upstream history (inherited from Lhcfl/discourse-twitter-native-embed)
- 2026-03-30 — Merged support for converting *existing* oneboxes (not just raw links), contributed by [communiteq](https://github.com/communiteq)
- 2023-08-12 — Adjusted for Twitter → X domain rename (`twitter.com` → `x.com`)
- 2023-04-15 — Initial release

## License

MIT — see [LICENSE](./LICENSE). This is a derivative work; the original copyright notice is retained alongside the fork's modifications, per the MIT license terms.
