import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { compile } from "svelte/compiler";

/**
 * The gap the "Edit home" link sits at is CSS, and CSS is the one thing this runner cannot reach — no DOM
 * implementation, so nothing computes a computed style. What can be checked is the compiled output Svelte
 * produces for the component, because that is the text the browser is handed.
 *
 * The assertions below read as two independent requirements rather than one, which is the point: the same
 * rule with a single value would pass while quietly breaking the other layout.
 */
const source = readFileSync("src/routes/+page.svelte", "utf8");
const compiled = compile(source, {
  filename: "src/routes/+page.svelte",
  generate: "client",
});

/** Whitespace-normalized, so the assertions are about declarations rather than formatting. */
const css = compiled.css.code.replace(/\s+/g, " ").trim();

describe("home page edit link spacing", () => {
  it("compiles a rule for the home actions block at all", () => {
    expect(css).toContain(".home-actions");
  });

  it("hangs the link 1.5rem below the top of the header band on desktop", () => {
    // The base rule positions the block absolutely in the header band, so a margin is what keeps it from
    // sitting flush against the logo row.
    expect(css).toMatch(
      /\.home-actions[^}]*position: absolute[^}]*margin-top: 1\.5rem/,
    );
  });

  it("keeps the link in flow with the same top gap inside the single-column layout", () => {
    // Under the single-column breakpoint the block is static, so a margin-top alone would collapse into the
    // element above it; the rule must carry the gap explicitly.
    expect(css).toMatch(
      /\.home-actions[^}]*position: static[^}]*margin: 1\.5rem 0 1rem/,
    );
  });

  it("applies the static rule inside the components own breakpoint, not unconditionally", () => {
    // The compiled sheet has exactly one media block: the single-column breakpoint the site uses. A rule
    // written outside it would apply at every width and quietly win over the desktop rule.
    const mediaStart = css.indexOf("@media");

    expect(mediaStart, "no media block in the compiled sheet").toBeGreaterThan(
      -1,
    );
    expect(
      css.slice(0, mediaStart).includes("position: static"),
      "the static rule sits outside the media block",
    ).toBe(false);

    const mobile = css.slice(mediaStart);
    const rule = mobile.match(/\.home-actions[^}]*}/);

    expect(rule, "no home-actions rule inside the media block").not.toBeNull();
    expect(rule[0]).toContain("position: static");
    expect(rule[0]).toContain("margin: 1.5rem 0 1rem");
  });

  it("orders the mobile rule after the desktop one so the cascade wins on small screens", () => {
    const desktop = css.indexOf(".home-actions");
    const mediaStart = css.indexOf("@media");
    const mobile = css.slice(mediaStart).indexOf("position: static");

    expect(desktop).toBeLessThan(mediaStart);
    expect(mobile).toBeGreaterThan(-1);
  });
});
