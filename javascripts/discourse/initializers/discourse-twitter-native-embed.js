import { withPluginApi } from "discourse/lib/plugin-api";

// Hosts whose status links are turned into native embeds
const TWEET_HOSTS = [
    "twitter.com",
    "www.twitter.com",
    "mobile.twitter.com",
    "x.com",
    "www.x.com",
];

// If a tweet has not rendered after this long (widgets.js blocked, X down, ...),
// stop reserving placeholder space for it and just leave the plain link.
const STALL_TIMEOUT_MS = 10000;

// If widgets.js cannot be loaded (blocked by an ad blocker, X down, ...), give up
// after this many attempts instead of retrying for every post on the page.
const MAX_SCRIPT_ATTEMPTS = 3;

export default {
    name: "discourse-twitter-native-embed",
    initialize() {
        withPluginApi("1.0.0", (api) => {

            let scriptLoading = false;
            let scriptAttempts = 0;

            function loadTwitterWidgets(el) {
                // Already loaded: just re-scan the newly added element
                // (fixes tweets not rendering on infinite-scroll / lazy-loaded posts)
                if (window.twttr && window.twttr.widgets) {
                    try {
                        window.twttr.widgets.load(el);
                    } catch (e) {
                        // ignore, non-fatal
                    }
                    return;
                }
                if (scriptLoading || scriptAttempts >= MAX_SCRIPT_ATTEMPTS) return;
                scriptLoading = true;
                scriptAttempts++;
                const scriptnode = document.createElement("script");
                scriptnode.setAttribute("async", "");
                scriptnode.setAttribute("src", "https://platform.twitter.com/widgets.js");
                scriptnode.setAttribute("charset", "utf-8");
                scriptnode.onload = () => { scriptLoading = false; };
                scriptnode.onerror = () => {
                    scriptLoading = false;
                    scriptnode.remove(); // don't leave failed script tags behind
                };
                document.head.appendChild(scriptnode);
            }

            function safeAttr(node, name) {
                try {
                    return node && node.getAttribute(name);
                } catch (e) {
                    return null;
                }
            }

            // Discourse "cloaks" (removes) far-off-screen posts to save memory, then
            // rebuilds them from scratch when scrolled back into view. That destroys
            // our previous embed, so it has to be created again — but we already know
            // how tall it rendered last time, so we can reserve that exact space
            // instead of a generic guess, which avoids a second layout jump.
            const tweetHeightCache = new Map(); // tweet path -> last known rendered height in px

            function tweetKey(href) {
                try {
                    return new URL(href).pathname; // ignore host (x.com/twitter.com) and query string
                } catch (e) {
                    return href;
                }
            }

            function applyCachedHeight(el, href) {
                const height = tweetHeightCache.get(tweetKey(href));
                if (height) {
                    el.style.setProperty("--x-embed-cached-height", height + "px");
                    el.setAttribute("data-x-embed-cached", "true");
                }
            }

            // Watches a freshly-created placeholder and records the tweet's real
            // height once widgets.js has finished rendering it, for next time.
            function rememberHeightWhenRendered(container, href) {
                try {
                    const key = tweetKey(href);
                    const observer = new window.MutationObserver(() => {
                        const rendered = container.querySelector(".twitter-tweet-rendered");
                        if (!rendered) return;
                        const height = rendered.getBoundingClientRect().height;
                        if (height > 0) tweetHeightCache.set(key, height);
                        observer.disconnect();
                    });
                    observer.observe(container, {
                        childList: true,
                        subtree: true,
                        attributes: true,
                        attributeFilter: ["class"],
                    });
                    // disconnect() is safe to call again even if the callback above
                    // already did; this just guarantees we stop watching eventually.
                    setTimeout(() => observer.disconnect(), STALL_TIMEOUT_MS);
                } catch (e) {
                    // ignore, non-fatal — just means this tweet's height won't be cached
                }
            }

            // https://x.com/<user>/status/<id>  (also twitter.com, www., mobile.)
            function isTweetUrl(href) {
                try {
                    const url = new URL(href);
                    return TWEET_HOSTS.includes(url.hostname) &&
                        /^\/[^/]+\/status\/\d+/.test(url.pathname);
                } catch (e) {
                    return false;
                }
            }

            // widgets.js expects twitter.com links
            function toTwitterUrl(href) {
                try {
                    const url = new URL(href);
                    url.protocol = "https:";
                    url.hostname = "twitter.com";
                    return url.toString();
                } catch (e) {
                    // href should always be a valid URL here (it came from isTweetUrl() or
                    // a server-provided onebox), so this is a last-resort fallback for the
                    // rare malformed case — covers the x.com host variants in TWEET_HOSTS.
                    return href.replace(/^https?:\/\/(?:www\.|mobile\.)?x\.com/i, "https://twitter.com");
                }
            }

            // Is the forum currently shown in a dark colour scheme? Discourse's colour
            // schemes set the custom property --scheme-type to "light" or "dark"; if it
            // is missing (older versions, unusual themes) we judge by the background colour.
            function isDarkPage() {
                try {
                    for (const node of [document.body, document.documentElement]) {
                        if (!node) continue;
                        const type = window.getComputedStyle(node)
                            .getPropertyValue("--scheme-type")
                            .replace(/["'\s]/g, "");
                        if (type === "dark") return true;
                        if (type === "light") return false;
                    }
                    for (const node of [document.body, document.documentElement]) {
                        if (!node) continue;
                        const bg = window.getComputedStyle(node).backgroundColor || "";
                        const m = bg.match(
                            /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+%?))?\s*\)/
                        );
                        if (!m) continue;
                        if (m[4] !== undefined && parseFloat(m[4]) === 0) continue; // transparent
                        const luminance =
                            (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255;
                        return luminance < 0.5;
                    }
                } catch (e) {
                    // ignore, fall back to light
                }
                return false;
            }

            // A bare URL alone in its paragraph, link text == URL: this is what Discourse
            // itself would onebox. Links inside sentences or [text](url) links are left alone.
            // This is a heuristic, not a parse of Discourse's own oneboxing rules — it can
            // miss edge cases, but errs on the side of under-embedding rather than embedding
            // a link the person didn't intend as a standalone reference.
            function isStandaloneLink(link) {
                const parent = link.parentElement;
                if (!parent || parent.tagName !== "P") return false;
                const text = (link.textContent || "").trim();
                const href = (link.getAttribute("href") || "").trim();
                if (!text || text !== href) return false;
                for (const node of parent.childNodes) {
                    if (node === link) continue;
                    if (node.nodeType === 3 && !node.textContent.trim()) continue; // whitespace
                    if (node.nodeType === 1 && node.tagName === "BR") continue;
                    return false;
                }
                return true;
            }

            // True if nothing but whitespace / <br> follows `link` inside `container`
            function endsWithLink(container, link) {
                let node = link;
                while (node && node !== container) {
                    for (let sib = node.nextSibling; sib; sib = sib.nextSibling) {
                        if (sib.nodeType === 3 && !sib.textContent.trim()) continue;
                        if (sib.nodeType === 1 && sib.tagName === "BR") continue;
                        return false;
                    }
                    node = node.parentNode;
                }
                return true;
            }

            function makeTweetBlockquote(href, dark) {
                const blockquote = document.createElement("blockquote");
                blockquote.setAttribute("style", "display: none");
                blockquote.setAttribute("data-dnt", "true"); // request Do-Not-Track from X's embed script
                if (dark) blockquote.setAttribute("data-theme", "dark");
                blockquote.classList.add("twitter-tweet");
                const anchor = document.createElement("a");
                anchor.setAttribute("href", toTwitterUrl(href));
                anchor.setAttribute("rel", "nofollow noopener noreferrer");
                blockquote.appendChild(anchor);
                return blockquote;
            }

            // common/common.scss reserves space for a loading tweet. If the tweet never
            // renders, flag the link so that reserved space is released again.
            // Watches el for a rendered tweet; if none shows up within
            // STALL_TIMEOUT_MS, marks it as stalled (so common.scss stops
            // reserving space for it) and stops watching. isRendered is checked
            // once, after the timeout — not on every DOM change — since this is
            // just a one-shot give-up check, not a live status indicator.
            function watchForStall(el, isRendered) {
                setTimeout(() => {
                    try {
                        if (!isRendered()) {
                            el.setAttribute("data-x-embed-stalled", "true");
                        }
                    } catch (e) {
                        // ignore
                    }
                }, STALL_TIMEOUT_MS);
            }

            api.decorateCookedElement((el) => {
                try {
                    // Computed lazily: most posts have nothing to embed, and
                    // getComputedStyle() is wasted work for those.
                    let darkResolved;
                    const dark = () => (darkResolved ??= isDarkPage());

                    // 1) Links: oneboxed links, and bare links Discourse did not onebox
                    for (const link of el.querySelectorAll('a[href*="/status/"]')) {
                        if (link.hasAttribute("data-x-embed")) continue; // already decorated
                        if (!isTweetUrl(link.href)) continue;
                        if (!link.classList.contains("onebox")) {
                            if (link.closest("aside, blockquote")) continue;
                            if (!isStandaloneLink(link)) continue;
                        }
                        // Marker used by common/common.scss. The tweet goes next to the
                        // link (not inside it) so the link can be hidden without the tweet.
                        link.setAttribute("data-x-embed", "true");
                        applyCachedHeight(link, link.href);
                        link.insertAdjacentElement("afterend", makeTweetBlockquote(link.href, dark()));
                        watchForStall(link, () => {
                            const next = link.nextElementSibling;
                            return !!(next && next.classList.contains("twitter-tweet-rendered"));
                        });
                        if (link.parentElement) {
                            rememberHeightWhenRendered(link.parentElement, link.href);
                        }
                    }

                    // 2) Full onebox cards. common/common.scss hides the card's own content
                    //    once the tweet has rendered.
                    for (const aside of el.querySelectorAll("aside.onebox.twitterstatus")) {
                        if (aside.hasAttribute("data-x-embed")) continue;
                        // Guard: bail out cleanly if the expected attribute is missing
                        // instead of throwing (this was the likely cause of the safe-mode errors)
                        const src = safeAttr(aside, "data-onebox-src");
                        if (!src) continue;
                        aside.setAttribute("data-x-embed", "true");
                        // A card that already shows an image/video is likely to render as a
                        // taller tweet; common/common.scss uses this to reserve more space
                        // up front, so the layout shifts less once the real tweet appears.
                        if (aside.querySelector("article.onebox-body img, article.onebox-body video")) {
                            aside.setAttribute("data-x-embed-media", "true");
                        }
                        applyCachedHeight(aside, src);
                        aside.appendChild(makeTweetBlockquote(src, dark()));
                        rememberHeightWhenRendered(aside, src);
                        watchForStall(aside, () => !!aside.querySelector(".twitter-tweet-rendered"));
                    }

                    // 3) Tweet blockquotes, i.e. X's own embed HTML pasted into a post: the
                    //    quote must END with a link to a tweet. Discourse's own quote boxes
                    //    (aside.quote) and ordinary quotes that merely mention a tweet are left alone.
                    for (const quote of el.getElementsByTagName("blockquote")) {
                        if (quote.closest("aside.quote")) continue;
                        const links = quote.querySelectorAll("a[href]");
                        const last = links[links.length - 1];
                        if (!last || !isTweetUrl(last.href) || !endsWithLink(quote, last)) continue;
                        quote.classList.add("twitter-tweet");
                        quote.setAttribute("data-dnt", "true");
                        if (dark() && !quote.hasAttribute("data-theme")) {
                            quote.setAttribute("data-theme", "dark");
                        }
                    }

                    if (el.querySelector("blockquote.twitter-tweet")) {
                        loadTwitterWidgets(el);
                    }
                } catch (err) {
                    // Never let a single malformed post crash the whole decorator
                    // pipeline / trigger Discourse's safe-mode warning banner.
                    console.warn("discourse-twitter-native-embed: skipped a post due to an error", err);
                }
            }, {
                // Current Discourse only looks at onlyStream; id and afterAdopt are ignored
                // there but kept because older Discourse versions may still use them.
                id: "discourse-twitter-native-embed",
                afterAdopt: true,
                onlyStream: true,
            });

        });
    }
};
