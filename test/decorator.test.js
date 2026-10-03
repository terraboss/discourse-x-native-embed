const test = require("node:test");
const assert = require("node:assert/strict");
const { setup } = require("./helpers");

const TWEET = "https://x.com/someone/status/1234567890";
const bare = (url = TWEET) => `<p><a href="${url}">${url}</a></p>`;

// ---------- bare links ----------

test("bare standalone x.com link gets a hidden tweet blockquote", () => {
  const t = setup();
  const el = t.cook(bare());
  const link = el.querySelector("a");
  assert.equal(link.getAttribute("data-x-embed"), "true");
  const bq = link.nextElementSibling;
  assert.ok(bq.classList.contains("twitter-tweet"));
  assert.equal(bq.style.display, "none");
  assert.equal(bq.getAttribute("data-dnt"), "true");
});

test("x.com is normalised to twitter.com for widgets.js", () => {
  const t = setup();
  const el = t.cook(bare());
  assert.equal(
    el.querySelector("blockquote a").getAttribute("href"),
    "https://twitter.com/someone/status/1234567890"
  );
});

test("generated link carries safety attributes", () => {
  const t = setup();
  const el = t.cook(bare());
  assert.equal(
    el.querySelector("blockquote a").getAttribute("rel"),
    "nofollow noopener noreferrer"
  );
});

for (const host of ["twitter.com", "www.twitter.com", "mobile.twitter.com", "www.x.com"]) {
  test(`host variant ${host} is recognised`, () => {
    const t = setup();
    const el = t.cook(bare(`https://${host}/u/status/42`));
    assert.ok(el.querySelector("blockquote.twitter-tweet"));
  });
}

test("non-tweet links containing /status/ are ignored", () => {
  const t = setup();
  for (const url of [
    "https://example.com/u/status/42",
    "https://x.com/u/likes",
    "https://x.com/status/42",
    "https://x.com/u/status/notanumber",
  ]) {
    const el = t.cook(bare(url));
    assert.equal(el.querySelector("blockquote"), null, url);
  }
});

test("link inside a sentence is left alone", () => {
  const t = setup();
  const el = t.cook(`<p>Look at <a href="${TWEET}">${TWEET}</a> please</p>`);
  assert.equal(el.querySelector("blockquote"), null);
});

test("link with custom text is left alone", () => {
  const t = setup();
  const el = t.cook(`<p><a href="${TWEET}">my favourite tweet</a></p>`);
  assert.equal(el.querySelector("blockquote"), null);
});

test("bare link inside a Discourse quote box is left alone", () => {
  const t = setup();
  const el = t.cook(`<aside class="quote"><blockquote>${bare()}</blockquote></aside>`);
  assert.equal(el.querySelector("blockquote.twitter-tweet"), null);
});

test("decorating the same post twice does not duplicate the tweet", () => {
  const t = setup();
  const el = t.cook(bare());
  t.decorate(el); // post redraw
  assert.equal(el.querySelectorAll("blockquote.twitter-tweet").length, 1);
});

// ---------- onebox links and cards ----------

test("oneboxed link is embedded even when not standalone", () => {
  const t = setup();
  const el = t.cook(`<p>see <a class="onebox" href="${TWEET}">${TWEET}</a></p>`);
  assert.ok(el.querySelector("blockquote.twitter-tweet"));
});

test("onebox card gets a tweet appended and is marked", () => {
  const t = setup();
  const el = t.cook(
    `<aside class="onebox twitterstatus" data-onebox-src="${TWEET}"><header class="source"></header><article class="onebox-body"></article></aside>`
  );
  const aside = el.querySelector("aside");
  assert.equal(aside.getAttribute("data-x-embed"), "true");
  assert.ok(aside.querySelector("blockquote.twitter-tweet"));
  assert.equal(aside.hasAttribute("data-x-embed-media"), false);
});

test("onebox card with image is flagged as media", () => {
  const t = setup();
  const el = t.cook(
    `<aside class="onebox twitterstatus" data-onebox-src="${TWEET}"><article class="onebox-body"><img src="x.png"></article></aside>`
  );
  assert.equal(el.querySelector("aside").getAttribute("data-x-embed-media"), "true");
});

test("onebox card without data-onebox-src is skipped without error", () => {
  const t = setup();
  const el = t.cook(`<aside class="onebox twitterstatus"><article class="onebox-body"></article></aside>`);
  assert.equal(el.querySelector("blockquote"), null);
  assert.equal(t.warnings.length, 0);
});

// ---------- pasted embed HTML (blockquotes) ----------

test("pasted X embed blockquote ending with a tweet link becomes a twitter-tweet", () => {
  const t = setup();
  const el = t.cook(`<blockquote><p>Hello</p>&mdash; Someone <a href="${TWEET}">date</a></blockquote>`);
  const bq = el.querySelector("blockquote");
  assert.ok(bq.classList.contains("twitter-tweet"));
  assert.equal(bq.getAttribute("data-dnt"), "true");
});

test("ordinary quote that merely mentions a tweet is not replaced", () => {
  const t = setup();
  const el = t.cook(`<blockquote><p>see <a href="${TWEET}">this</a> and then more text</p></blockquote>`);
  assert.equal(el.querySelector("blockquote").classList.contains("twitter-tweet"), false);
});

test("Discourse aside.quote is never turned into a tweet", () => {
  const t = setup();
  const el = t.cook(`<aside class="quote"><blockquote><p><a href="${TWEET}">x</a></p></blockquote></aside>`);
  assert.equal(el.querySelector("blockquote").classList.contains("twitter-tweet"), false);
});

// ---------- dark mode ----------

test("dark scheme-type sets data-theme=dark", () => {
  const t = setup({ colorSchemeType: "dark" });
  const el = t.cook(bare());
  assert.equal(el.querySelector("blockquote").getAttribute("data-theme"), "dark");
});

test("light scheme-type sets no theme", () => {
  const t = setup({ colorSchemeType: "light" });
  const el = t.cook(bare());
  assert.equal(el.querySelector("blockquote").hasAttribute("data-theme"), false);
});

test("quoted scheme-type value ('dark') is understood", () => {
  const t = setup({ colorSchemeType: '"dark"' });
  const el = t.cook(bare());
  assert.equal(el.querySelector("blockquote").getAttribute("data-theme"), "dark");
});

test("without scheme-type a dark background counts as dark", () => {
  const t = setup();
  t.document.body.style.backgroundColor = "rgb(20, 20, 20)";
  const el = t.cook(bare());
  assert.equal(el.querySelector("blockquote").getAttribute("data-theme"), "dark");
});

test("without scheme-type a light background counts as light", () => {
  const t = setup();
  t.document.body.style.backgroundColor = "rgb(250, 250, 250)";
  const el = t.cook(bare());
  assert.equal(el.querySelector("blockquote").hasAttribute("data-theme"), false);
});

// ---------- widgets.js loading ----------

test("posts without tweets do not load widgets.js", () => {
  const t = setup();
  t.cook("<p>just text</p>");
  assert.equal(t.document.head.querySelectorAll("script").length, 0);
});

test("widgets.js is inserted only once while loading", () => {
  const t = setup();
  t.cook(bare());
  t.cook(bare());
  assert.equal(t.document.head.querySelectorAll("script").length, 1);
});

test("gives up after three failed script loads", () => {
  const t = setup();
  for (let i = 0; i < 5; i++) {
    t.cook(bare());
    const s = t.document.head.querySelector("script");
    if (s) s.onerror();
  }
  // each failure removes its tag; after 3 attempts no new tag appears
  assert.equal(t.document.head.querySelectorAll("script").length, 0);
});

test("once widgets.js exists, new posts are rescanned via widgets.load", () => {
  const t = setup();
  t.installWidgets();
  const el = t.cook(bare());
  assert.equal(t.widgets.calls, 1);
  assert.equal(t.document.head.querySelectorAll("script").length, 0);
  assert.ok(el);
});

// ---------- stall detection ----------

test("link is flagged stalled when the tweet never renders", () => {
  const t = setup();
  const el = t.cook(bare());
  t.tick();
  assert.equal(el.querySelector("a").getAttribute("data-x-embed-stalled"), "true");
});

test("link is not flagged stalled when the tweet rendered", () => {
  const t = setup();
  t.installWidgets({ render: true });
  const el = t.cook(bare());
  t.tick();
  assert.equal(el.querySelector("a").hasAttribute("data-x-embed-stalled"), false);
});

test("onebox card is flagged stalled when the tweet never renders", () => {
  const t = setup();
  const el = t.cook(`<aside class="onebox twitterstatus" data-onebox-src="${TWEET}"></aside>`);
  t.tick();
  assert.equal(el.querySelector("aside").getAttribute("data-x-embed-stalled"), "true");
});

test("onebox card is not flagged stalled when the tweet rendered", () => {
  const t = setup();
  t.installWidgets({ render: true });
  const el = t.cook(`<aside class="onebox twitterstatus" data-onebox-src="${TWEET}"></aside>`);
  t.tick();
  assert.equal(el.querySelector("aside").hasAttribute("data-x-embed-stalled"), false);
});

// ---------- robustness ----------

test("a throwing post is skipped with a warning, not an exception", () => {
  const t = setup();
  const poisoned = t.document.createElement("div");
  poisoned.querySelectorAll = () => { throw new Error("boom"); };
  assert.doesNotThrow(() => t.decorate(poisoned));
  assert.equal(t.warnings.length, 1);
});
