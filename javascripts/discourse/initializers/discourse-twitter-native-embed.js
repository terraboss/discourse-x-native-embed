import { withPluginApi } from "discourse/lib/plugin-api";

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

            api.decorateCookedElement((el) => {
                try {
                    let hasQuote = false;

                    for (const domain of ["twitter.com", "x.com"]) {
                        const links = el.querySelectorAll(
                            `a.onebox[href^="https://${domain}/"][href*="status"]`
                        );
                        for (const link of links) {
                            if (!link || !link.href) continue;
                            if (link.querySelector("blockquote.twitter-tweet")) continue;
                            const blockquote = document.createElement("blockquote");
                            blockquote.setAttribute("style", "display: none");
                            blockquote.classList.add("twitter-tweet");
                            const anchor = document.createElement("a");
                            anchor.setAttribute("href", link.href.replaceAll("https://x.com", "https://twitter.com"));
                            anchor.setAttribute("rel", "nofollow");
                            blockquote.appendChild(anchor);
                            link.appendChild(blockquote);
                        }
                    }

                    for (const aside of el.querySelectorAll("aside.onebox.twitterstatus")) {
                        if (aside.querySelector("blockquote.twitter-tweet")) continue;
                        // Guard: bail out cleanly if the expected attribute is missing
                        // instead of throwing (this was the likely cause of the safe-mode errors)
                        const src = safeAttr(aside, "data-onebox-src");
                        if (!src) continue;
                        const blockquote = document.createElement("blockquote");
                        blockquote.setAttribute("style", "display: none");
                        blockquote.classList.add("twitter-tweet");
                        const anchor = document.createElement("a");
                        anchor.setAttribute("href", src.replaceAll("https://x.com", "https://twitter.com"));
                        anchor.setAttribute("rel", "nofollow");
                        blockquote.appendChild(anchor);
                        aside.appendChild(blockquote);
                        for (const oldEl of aside.querySelectorAll("header.source, article.onebox-body")) {
                            oldEl.setAttribute("style", "display: none");
                        }
                    }

                    for (const quote of el.getElementsByTagName("blockquote")) {
                        if (quote.querySelector('a[href^="https://twitter.com/"]')) {
                            quote.classList.add("twitter-tweet");
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
