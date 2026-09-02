import fs from 'node:fs';
import path from 'node:path';

const assetsDir = path.resolve(process.argv[2] ?? 'dist/public/assets');
const asset = fs.readdirSync(assetsDir).find(name => /^index-.*\.js$/.test(name));
if (!asset) throw new Error(`No production JavaScript bundle found in ${assetsDir}`);
const file = path.join(assetsDir, asset);
let source = fs.readFileSync(file, 'utf8');

function replaceOnce(label, from, to) {
  const first = source.indexOf(from);
  if (first < 0 || source.indexOf(from, first + from.length) >= 0) {
    throw new Error(`${label}: expected exactly one match`);
  }
  source = source.slice(0, first) + to + source.slice(first + from.length);
}

replaceOnce(
  'freshness indicator',
  'k.jsx(Kae,{"data-loc":"client/src/pages/Dashboard.tsx:752",posPercent:Ot,neuPercent:En,negPercent:rn})]})',
  'k.jsx(Kae,{"data-loc":"client/src/pages/Dashboard.tsx:752",posPercent:Ot,neuPercent:En,negPercent:rn}),k.jsxs("div",{className:"ml-auto text-xs font-medium text-muted-foreground tabular-nums",role:"status",children:["FULL STREAM · ",Ge.connected?"LIVE":"RECONNECTING"," · ",Ge.lastEventAt?Math.max(0,Math.floor((Date.now()-new Date(Ge.lastEventAt).getTime())/1e3))+"s AGO":"WAITING FOR EVENT"]})]})',
);

replaceOnce(
  'hide raw export',
  'k.jsx(qd,{"data-loc":"client/src/pages/Dashboard.tsx:1343",onClick:je,variant:"outline",className:"px-6 py-3 sm:px-8 sm:py-4 text-xs font-bold min-h-[44px]",children:"Export CSV"})',
  'k.jsx("span",{"aria-hidden":!0})',
);

replaceOnce('Luke link', 'href:"https://dr.eamer.dev/bluesky"', 'href:"https://lukesteuber.com"');
replaceOnce('Luke label', 'children:"Other tools"', 'children:"lukesteuber.com"');
replaceOnce('Data Poems link', 'href:"https://dr.eamer.dev/luke"', 'href:"https://datapoems.io"');
replaceOnce('Data Poems label', 'children:"Me"', 'children:"datapoems.io"');
replaceOnce(
  'language filter label',
  '"select",{"data-loc":"client/src/pages/Dashboard.tsx:884",value:l,onChange:',
  '"select",{"data-loc":"client/src/pages/Dashboard.tsx:884",value:l,"aria-label":"Filter live feed by language",onChange:',
);

fs.writeFileSync(file, source);

const stylesheet = fs.readdirSync(assetsDir).find(name => /^index-.*\.css$/.test(name));
if (!stylesheet) throw new Error(`No production stylesheet found in ${assetsDir}`);
const cssFile = path.join(assetsDir, stylesheet);
fs.appendFileSync(cssFile, `
/* firehose-repair-accessibility */
:root {
  --bsky-blue: #006bb6;
  --sentiment-positive: #08784d;
  --muted-foreground: #59616b;
}
.text-muted-foreground.opacity-60 { opacity: 1 !important; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
`);

console.log(`Patched ${file} and ${cssFile}`);
