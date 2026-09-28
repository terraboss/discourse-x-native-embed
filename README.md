# Discourse 𝕏 Native Embed

Fork of [Lhcfl/discourse-twitter-native-embed](https://github.com/Lhcfl/discourse-twitter-native-embed) — a Discourse theme component that converts X/Twitter links into native embeds (with images, video, like/reply counts) using X's `widgets.js`.

**Status:** Experimental. Use at your own risk.

## Why this fork exists

The upstream component could throw an error while a post was being displayed. Discourse catches such errors and shows administrators a warning banner ("one of the post decorators on your site raised an error") with a link to safe mode; the forum itself is not switched into safe mode, but the tweet in that post is not embedded. The most likely trigger is a post whose X/Twitter onebox does not carry the expected `data-onebox-src` attribute (e.g. because of X's ongoing API/embed instability). This has not been confirmed with a captured stack trace. The fork guards the decorator against that case and fixes a few related issues.

## How it works

- `javascripts/discourse/initializers/discourse-twitter-native-embed.js` finds X/Twitter status links (oneboxed, bare, or in onebox cards) and quoted tweets in each rendered post, adds a hidden `blockquote.twitter-tweet` for each, and lets X's `widgets.js` turn it into the native embed. The embed follows the forum's light/dark colours.
- `common/common.scss` hides the plain link (or the onebox card's own content) once the tweet has actually rendered, and reserves some space while it loads. If `widgets.js` is blocked or fails to load, the link stays visible as a fallback.

## Installation

1. In Discourse Admin → Customize → Themes, install this component via its Git URL:
   `https://github.com/terraboss/discourse-x-native-embed`
2. Add it to the themes you want it enabled on.
3. Keep "Automatically update when Discourse updates" enabled to pick up future fixes.

## Changelog

Format loosely follows [Keep a Changelog](https://keepachangelog.com/), written in plain language.

### 2026-09-28
- **Add:** X links that Discourse did not turn into a preview by itself are now shown as full tweets too, as long as the link is on a line by itself. Links inside a sentence are left alone.
- **Add:** Tweets use dark mode when the forum is displayed in a dark colour scheme. This is read from the forum's own colour scheme setting; if that is missing, the background colour is used as a fallback.
- **Add:** Tweets ask X not to track visitors ("Do Not Track"). This is a request, not a guarantee.
- **Add:** Some space is kept free while a tweet is loading, so the page jumps around less. If nothing appears after 10 seconds, the space is given back.
- **Change:** The plain link above a tweet now disappears once the tweet is shown. If X cannot be reached, the link stays, so nothing gets lost.
- **Change:** Preview cards work the same way: their own text is hidden only once the tweet is actually shown. Before, it was hidden right away, which could leave an empty post.
- **Fix:** Quoting a post that contains an X link no longer risks replacing your quote with the tweet. Only pasted X embed code is treated as a tweet.
- **Fix:** If X's script is blocked (for example by an ad blocker), the forum now tries three times and then stops, instead of trying again for every post.
- **Fix:** Only real tweet links are recognised, not any link that merely contains the word "status".
- **Fix:** A tweet is no longer shown twice when a post is redrawn.
- **Fix:** Dark tweets no longer have a light edge around their corners.
- **Refactor:** Code tidied up, no visible change.
- **Chore:** The component's info now links to the project page and the licence, and its name uses the 𝕏 symbol.

### 2026-09-27
- **Fix:** One problematic post no longer triggers Discourse's administrator warning banner about a broken post decorator.
- **Fix:** The most likely cause of those errors: the code assumed a piece of information was always there and crashed when it was missing. It now checks first. This is our best guess and has not been confirmed.
- **Fix:** X's script is loaded once instead of over and over.
- **Fix:** Posts that appear while you scroll now get their tweets too.
- **Chore:** The licence now credits both the original author and this fork.

### Upstream history (inherited from Lhcfl/discourse-twitter-native-embed)
- 2026-03-30 — Also works with X links that Discourse had already turned into previews (contributed by [communiteq](https://github.com/communiteq))
- 2023-08-12 — Updated for the Twitter to X rename
- 2023-04-15 — First release

## License

MIT — see [LICENSE](./LICENSE). This is a derivative work; the original copyright notice is retained alongside the fork's modifications, per the MIT license terms.
