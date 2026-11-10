// Lighthouse CI: speed, accessibility and best-practice budgets on the pages members use most.
// Runs against the local production build (e2e/serve.sh), never production.
//   LH_PAGES=public  landing, sign-up, log-in, privacy
//   LH_PAGES=app     feed, a club, projects, network, logged in (session from e2e/session-cookie.cjs)
const fs = require("fs");
const BASE = "http://localhost:3200";
const app = process.env.LH_PAGES === "app";
let cookie = "";
if (app) cookie = fs.readFileSync(`${__dirname}/.results/lh-cookie.txt`, "utf8").trim();

const pages = app ? ["/feed", "/c/rkt", "/projects", "/network"] : ["/", "/signup", "/login", "/privacy"];

module.exports = {
  ci: {
    collect: {
      url: pages.map((p) => BASE + p),
      numberOfRuns: 1,
      settings: {
        preset: "desktop",
        chromeFlags: "--headless=new --no-sandbox",
        ...(cookie ? { extraHeaders: JSON.stringify({ Cookie: cookie }) } : {}),
      },
    },
    assert: {
      assertions: {
        // Hard limits: these fail CI.
        "categories:accessibility": ["error", { minScore: 0.9 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
        "categories:best-practices": ["error", { minScore: 0.9 }],
        // Speed on a shared CI machine is noisy: warn now, tighten to errors once we have a baseline.
        "categories:performance": ["warn", { minScore: 0.8 }],
        "largest-contentful-paint": ["warn", { maxNumericValue: 2500 }],
        "total-blocking-time": ["warn", { maxNumericValue: 300 }],
      },
    },
    upload: { target: "filesystem", outputDir: `${__dirname}/../.lighthouse/${app ? "app" : "public"}` },
  },
};
