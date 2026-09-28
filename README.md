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

What changed, in plain language. Newest first.

### 2026-09-28

**New**
- Links to X posts that Discourse did not turn into a preview on its own are now shown as full tweets too, as long as the link is on a line by itself.
- Tweets are shown in dark mode when your forum is dark.
- Tweets ask X not to track visitors ("Do Not Track"). This is a request, not a guarantee.
- While a tweet is loading, some space is kept free so the page jumps around less. If nothing shows up after 10 seconds, the space is given back.

**Improved**
- The plain link above a tweet now disappears once the tweet is displayed. If X cannot be reached, the link stays, so nothing gets lost. The same goes for preview cards.

**Fixed**
- Quoting a post that contains an X link no longer risks replacing your quote with the tweet. Only pasted X embed code is treated as a tweet.
- If X's script is blocked (for example by an ad blocker), the forum now tries three times and then stops, instead of trying again for every post.
- Only real tweet links are recognised, not any link that merely contains the word "status".
- A tweet is no longer shown twice when a post is redrawn.

**Behind the scenes**
- Code tidied up, no visible change.

### 2026-09-27

**Fixed**
- One problematic post can no longer push the whole forum into Discourse's "safe mode".
- The most likely cause of those safe-mode errors: the code assumed a piece of information was always there and crashed when it was missing. It now checks first. This is our best guess and has not been confirmed.
- X's script is loaded once instead of over and over.
- Posts that appear while you scroll now get their tweets too.

**Housekeeping**
- The licence now credits both the original author and this fork.

### Before this fork (original project by Lhcfl)
- 2026-03-30 — Also works with X links that Discourse had already turned into previews (contributed by [communiteq](https://github.com/communiteq)).
- 2023-08-12 — Updated for the Twitter to X rename.
- 2023-04-15 — First release.

## License

MIT — see [LICENSE](./LICENSE). This is a derivative work; the original copyright notice is retained alongside the fork's modifications, per the MIT license terms.
