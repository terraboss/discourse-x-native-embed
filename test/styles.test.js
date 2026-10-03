const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const sass = require("sass");

const css = sass.compile(path.join(__dirname, "../common/common.scss")).css;

function rule(selectorPart) {
  const blocks = css.split("}").map((b) => b.trim());
  return blocks.filter((b) => b.includes(selectorPart));
}

test("stylesheet compiles", () => {
  assert.ok(css.length > 0);
});

test("collapsible link starts from a finite max-height (so it can animate)", () => {
  const base = rule("a[data-x-embed] {")[0];
  assert.match(base, /max-height:\s*\d+(\.\d+)?rem/);
  assert.match(base, /transition:[^;]*max-height/);
});

test("collapsed link ends at max-height 0", () => {
  const collapsed = rule("a[data-x-embed]:has(+ .twitter-tweet-rendered) {")[0];
  assert.match(collapsed, /max-height:\s*0/);
});

test("onebox card parts start from a finite max-height", () => {
  const base = rule("aside.onebox.twitterstatus[data-x-embed] header.source")[0];
  assert.match(base, /max-height:\s*\d+(\.\d+)?rem/);
});

test("no element animates max-height from 'none'", () => {
  assert.doesNotMatch(css, /max-height:\s*none/);
});
