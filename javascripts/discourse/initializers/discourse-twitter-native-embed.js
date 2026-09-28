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

export default {
    name: "discourse-twitter-native-embed",
    initialize() {
        withPluginApi("1.0.0", (api) => {

            let scriptLoading = false;

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
                if (scriptLoading) return;
                scriptLoading = true;
                const scriptnode = document.createElement("script");
                scriptnode.setAttribute("async", "");
                scriptnode.setAttribute("src", "https://platform.twitter.com/widgets.js");
                scriptnode.setAttribute("charset", "utf-8");
                scriptnode.onload = () => { scriptLoading = false; };
                scriptnode.onerror = () => { scriptLoading = false; };
                document.head.appendChild(scriptnode);
            }

            function safeAttr(node, name) {
                try {
                    return node && node.getAttribute(name);
                } catch (e) {
                    return null;
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
                    return href.replaceAll("https://x.com", "https://twitter.com");
                }
            }

            // Is the forum currently shown in a dark colour scheme? Looks at the real
            // background colour, so it works with any theme / colour scheme.
            function isDarkPage() {
                try {
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

            function makeTweetBlockquote(href, dark) {
                const blockquote = document.createElement("blockquote");
                blockquote.setAttribute("style", "display: none");
                blockquote.setAttribute("data-dnt", "true"); // request Do-Not-Track from X's embed script
                if (dark) blockquote.setAttribute("data-theme", "dark");
                blockquote.classList.add("twitter-tweet");
                const anchor = document.createElement("a");
                anchor.setAttribute("href", toTwitterUrl(href));
                anchor.setAttribute("rel", "nofollow");
                blockquote.appendChild(anchor);
                return blockquote;
            }

            // common/common.scss reserves space for a loading tweet. If the tweet never
            // renders, flag the link so that reserved space is released again.
            function watchForStall(link) {
                setTimeout(() => {
                    try {
                        const next = link.nextElementSibling;
                        if (!(next && next.classList.contains("twitter-tweet-rendered"))) {
                            link.setAttribute("data-x-embed-stalled", "true");
                        }
                    } catch (e) {
                        // ignore
                    }
                }, STALL_TIMEOUT_MS);
            }

            api.decorateCookedElement((el) => {
                try {
                    let hasQuote = false;
                    const dark = isDarkPage();

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
                        link.insertAdjacentElement("afterend", makeTweetBlockquote(link.href, dark));
                        watchForStall(link);
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
                        aside.appendChild(makeTweetBlockquote(src, dark));
                    }

                    // 3) Quoted tweets (blockquotes containing a tweet link)
                    for (const quote of el.getElementsByTagName("blockquote")) {
                        if (quote.querySelector('a[href^="https://twitter.com/"], a[href^="https://x.com/"]')) {
                            quote.classList.add("twitter-tweet");
                            quote.setAttribute("data-dnt", "true");
                            if (dark && !quote.hasAttribute("data-theme")) {
                                quote.setAttribute("data-theme", "dark");
                            }
                            hasQuote = true;
                        }
                    }

                    if (hasQuote || el.querySelector("blockquote.twitter-tweet")) {
                        loadTwitterWidgets(el);
                    }
                } catch (err) {
                    // Never let a single malformed post crash the whole decorator
                    // pipeline / trigger Discourse's safe-mode warning banner.
                    console.warn("discourse-twitter-native-embed: skipped a post due to an error", err);
                }
            }, {
                id: "discourse-twitter-native-embed",
                afterAdopt: true,
                onlyStream: true,
            });

        });
    }
};
