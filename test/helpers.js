// Loads the initializer in a jsdom window with a fake Discourse plugin API,
// so the decorator can be run against hand-written post HTML.
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const SOURCE = path.join(
  __dirname,
  "../javascripts/discourse/initializers/discourse-twitter-native-embed.js"
);

function setup({ html = "", colorSchemeType } = {}) {
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`, {
    url: "https://forum.example/",
  });
  const { window } = dom;
  const { document } = window;
  if (colorSchemeType) {
    document.body.style.setProperty("--scheme-type", colorSchemeType);
  }

  // Controllable timers: nothing fires until tick() is called.
  const timers = [];
  const fakeSetTimeout = (fn) => { timers.push(fn); return timers.length; };
  const tick = () => { while (timers.length) timers.shift()(); };

  const warnings = [];
  const fakeConsole = { warn: (...a) => warnings.push(a), log() {}, error() {} };

  let decorator;
  const api = { decorateCookedElement: (fn) => { decorator = fn; } };
  const withPluginApi = (_v, cb) => cb(api);

  const src = fs
    .readFileSync(SOURCE, "utf8")
    .replace(/^import .*$/m, "")
    .replace("export default", "return");
  const component = new Function(
    "withPluginApi", "window", "document", "URL", "setTimeout", "console",
    src
  )(withPluginApi, window, document, window.URL, fakeSetTimeout, fakeConsole);
  component.initialize();

  // Fake widgets.js: counts load() calls, optionally renders the tweets.
  const widgets = { calls: 0 };
  function installWidgets({ render = false } = {}) {
    window.twttr = {
      widgets: {
        load(el) {
          widgets.calls++;
          if (!render) return;
          for (const bq of el.querySelectorAll("blockquote.twitter-tweet")) {
            const div = document.createElement("div");
            div.className = "twitter-tweet twitter-tweet-rendered";
            bq.replaceWith(div);
          }
        },
      },
    };
  }

  function cook(inner) {
    const el = document.createElement("div");
    el.innerHTML = inner;
    document.body.appendChild(el);
    decorator(el);
    return el;
  }

  return { window, document, cook, decorate: (el) => decorator(el), tick, warnings, widgets, installWidgets, timers };
}

module.exports = { setup };
