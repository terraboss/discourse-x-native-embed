# Discourse X Native Embed

Fork of [Lhcfl/discourse-twitter-native-embed](https://github.com/Lhcfl/discourse-twitter-native-embed) — a Discourse theme component that converts X/Twitter links into native embeds (with images, video, like/reply counts) using X's `widgets.js`.

**Status:** Experimental. Use at your own risk.

## Why this fork exists

The upstream component could throw an uncaught error and trigger Discourse's safe-mode warning banner ("one of the post decorators on your site threw an error"). The most likely trigger is a post whose X/Twitter onebox does not carry the expected `data-onebox-src` attribute (e.g. because of X's ongoing API/embed instability). This has not been confirmed with a captured stack trace. The fork guards the decorator against that case and fixes a few related issues.

## How it works

- `javascripts/discourse/initializers/discourse-twitter-native-embed.js` finds X/Twitter status links (oneboxed, bare, or in onebox cards) and quoted tweets in each rendered post, adds a hidden `blockquote.twitter-tweet` for each, and lets X's `widgets.js` turn it into the native embed. The embed follows the forum's light/dark colours.
- `common/common.scss` hides the plain link (or the onebox card's own content) once the tweet has actually rendered, and reserves some space while it loads. If `widgets.js` is blocked or fails to load, the link stays visible as a fallback.

## Installation

1. In Discourse Admin → Customize → Themes, install this component via its Git URL:
   `https://github.com/terraboss/discourse-x-native-embed`
2. Add it to the themes you want it enabled on.
3. Keep "Automatically update when Discourse updates" enabled to pick up future fixes.

## Changelog

Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

### [Unreleased]
- **Add:** bare X/Twitter status links that Discourse did not onebox are now embedded too, if the link stands alone in its paragraph with the URL as link text (links inside sentences and `[text](url)` links are left alone); also recognises `www.` and `mobile.` hosts
- **Change:** the onebox card's own content is now hidden by `common/common.scss` only once the tweet has rendered (previously hidden immediately by script, which left an empty post if `widgets.js` failed)
- **Add:** embeds use X's dark theme (`data-theme="dark"`) when the forum is displayed with a dark colour scheme
- **Add:** placeholder space (`$x-embed-placeholder-height` in `common.scss`) is reserved while a tweet loads to reduce layout jumps; it is released again after 10 seconds if nothing rendered

### 2026-09-28
- **Change:** the plain link in front of an embedded tweet is now hidden via `common/common.scss`, but only once the tweet has rendered (falls back to showing the link if `widgets.js` is blocked or fails). The tweet blockquote is now inserted next to the link instead of inside it.
- **Fix:** already-decorated links are marked with `data-x-embed` to avoid duplicate embeds on re-render
- **Fix:** quoted-tweet detection now also matches `x.com` links (previously only `twitter.com`)
- **Fix:** tightened the onebox link selector to `[href*="/status/"]` to avoid false matches on unrelated links containing the word "status"
- **Add:** `data-dnt="true"` on generated `blockquote.twitter-tweet` elements to request Do-Not-Track behavior from X's embed script (privacy/GDPR)
- **Refactor:** extracted shared `makeTweetBlockquote()` helper to remove duplication across the embed code paths

### 2026-09-27
- **Fix:** wrapped the entire `decorateCookedElement` callback in try/catch so a single malformed post can no longer crash the decorator pipeline and trigger Discourse's safe-mode banner
- **Fix:** guarded `data-onebox-src` attribute access — this is the most likely root cause of the safe-mode errors (`.replaceAll()` was called on a `null` value when the attribute was missing); not yet confirmed via a captured console stack trace
- **Fix:** prevented `widgets.js` from being appended to `<head>` more than once in parallel; added a loading-state guard
- **Fix:** when `widgets.js` is already loaded, newly rendered posts (e.g. from infinite scroll) are now re-scanned via `window.twttr.widgets.load(el)` instead of being silently skipped
- **Chore:** updated `LICENSE` copyright line

### Upstream history (inherited from Lhcfl/discourse-twitter-native-embed)
- 2026-03-30 — Merged support for converting *existing* oneboxes (not just raw links), contributed by [communiteq](https://github.com/communiteq)
- 2023-08-12 — Adjusted for Twitter → X domain rename (`twitter.com` → `x.com`)
- 2023-04-15 — Initial release

## License

MIT — see [LICENSE](./LICENSE). This is a derivative work; the original copyright notice is retained alongside the fork's modifications, per the MIT license terms.
