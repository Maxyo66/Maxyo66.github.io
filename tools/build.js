// Builds a standalone copy of the portfolio (Main.dc.html) for GitHub Pages.
// The design-canvas markup ({{holes}}, sc-if, sc-for, refs, events) is parsed once
// here and interpreted at runtime with Preact, so the same source runs in both places.
const fs = require('fs'), path = require('path');
const { parseDocument } = require('htmlparser2');
const [src, outDir, assetMapFile] = process.argv.slice(2);
const html = fs.readFileSync(src, 'utf8');
const assetMap = JSON.parse(fs.readFileSync(assetMapFile, 'utf8'));
const swap = (s) => s.replace(/\/_blob\/([0-9a-f]{32})/g, (m, id) => { if (!assetMap[id]) throw new Error('no local file for asset ' + id); return 'assets/' + assetMap[id]; });

const xdc = html.slice(html.indexOf('<x-dc>') + 6, html.indexOf('</x-dc>'));
const helmet = xdc.slice(xdc.indexOf('<helmet>') + 8, xdc.indexOf('</helmet>'));
const markup = xdc.slice(xdc.indexOf('</helmet>') + 9);
const sm = html.match(/<script type="text\/x-dc" data-dc-script data-props='([^']*)'>([\s\S]*?)<\/script>/);
const props = JSON.parse(sm[1]), script = sm[2];
const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || 'Maxyo66';

// markup -> compact tree: [tag, {attrs}, children] or a text string
const doc = parseDocument(markup, { lowerCaseAttributeNames: false, lowerCaseTags: false, recognizeSelfClosing: true, decodeEntities: true });
const conv = (n) => {
  if (n.type === 'text') return n.data.trim() === '' && /\n/.test(n.data) ? null : n.data;
  if (n.type !== 'tag' && n.type !== 'script' && n.type !== 'style') return null;
  const attrs = {};
  for (const [k, v] of Object.entries(n.attribs || {})) if (!k.startsWith('hint-')) attrs[k] = v;
  return [n.name, attrs, (n.children || []).map(conv).filter((c) => c !== null)];
};
const tree = doc.children.map(conv).filter((c) => c !== null);

const preact = fs.readFileSync(path.join(__dirname, 'node_modules/preact/dist/preact.min.umd.js'), 'utf8').replace(/\/\/# sourceMappingURL=.*$/m, '');
const defaults = Object.fromEntries(Object.entries(props).filter(([k]) => !k.startsWith('$')).map(([k, v]) => [k, v.default]));

const runtime = `
(function(){
var P = window.preact, h = P.h;
var BOOL = { autoplay:1, muted:1, loop:1, playsinline:1, disabled:1, checked:1, controls:1, open:1, hidden:1, required:1, readonly:1, selected:1, novalidate:1 };
function look(path, scopes){ var parts = path.trim().split('.'); for (var i = 0; i < scopes.length; i++) { var s = scopes[i]; if (s && parts[0] in s) { var v = s; for (var j = 0; j < parts.length; j++) { if (v == null) return undefined; v = v[parts[j]]; } return v; } } return undefined; }
var ONE = /^\\{\\{\\s*([\\w.$]+)\\s*\\}\\}$/;
function interp(str, scopes){ return str.replace(/\\{\\{\\s*([\\w.$]+)\\s*\\}\\}/g, function(m, p){ var v = look(p, scopes); return v == null ? '' : String(v); }); }
function val(str, scopes){ var m = ONE.exec(str); return m ? look(m[1], scopes) : interp(str, scopes); }
function kids(list, scopes){ var out = []; for (var i = 0; i < list.length; i++) { var r = build(list[i], scopes); if (Array.isArray(r)) out.push.apply(out, r); else if (r != null) out.push(r); } return out; }
function build(n, scopes){
  if (typeof n === 'string') return n.indexOf('{{') < 0 ? n : interp(n, scopes);
  var tag = n[0], a = n[1], c = n[2];
  if (tag === 'sc-if') return val(a.value, scopes) ? kids(c, scopes) : null;
  if (tag === 'sc-for') { var list = val(a.list, scopes) || [], as = a.as || 'it', out = []; for (var i = 0; i < list.length; i++) { var sc = {}; sc[as] = list[i]; out.push(h(P.Fragment, { key: i }, kids(c, [sc].concat(scopes)))); } return out; }
  var p = {}, isInput = tag === 'input' || tag === 'textarea';
  for (var k in a) {
    var raw = a[k], v = raw.indexOf('{{') >= 0 ? val(raw, scopes) : raw;
    if (k === 'ref') { p.ref = typeof v === 'function' ? v : null; continue; }
    if (k.length > 2 && k[0] === 'o' && k[1] === 'n' && k[2] === k[2].toUpperCase()) {
      var ev = k; if (k === 'onChange' && isInput && a.type !== 'checkbox' && a.type !== 'radio') ev = 'onInput';
      p[ev] = typeof v === 'function' ? v : undefined; continue;
    }
    if (BOOL[k.toLowerCase()]) { v = raw === '' ? true : (v === 'false' ? false : !!v); if (k === 'playsinline') { p.playsInline = v; continue; } }
    p[k] = v;
  }
  return h(tag, p, kids(c, scopes));
}
window.__dcMount = function(tree, Comp, defaults, el){
  window.DCLogic = window.DCLogic;
  var app = new Comp(); app.props = Object.assign({}, defaults, app.props || {}); app.state = app.state || {};
  var root = null, pending = false;
  app.setState = function(o, cb){ var nx = typeof o === 'function' ? o(app.state, app.props) : o; app.state = Object.assign({}, app.state, nx); if (root) root.forceUpdate(cb); else if (cb) setTimeout(cb, 0); };
  function Root(){ P.Component.call(this); root = this; }
  Root.prototype = Object.create(P.Component.prototype);
  Root.prototype.componentDidMount = function(){ if (app.componentDidMount) app.componentDidMount(); };
  Root.prototype.render = function(){ return h(P.Fragment, null, kids(tree, [app.renderVals()])); };
  P.render(h(Root), el);
  window.addEventListener('pagehide', function(){ if (app.componentWillUnmount) app.componentWillUnmount(); });
};
window.DCLogic = function DCLogic(){ this.props = {}; this.state = {}; };
})();`;

// Page views: GoatCounter (free, no cookies, no personal data); the stats are private to Max.
// Clicks on links that leave the site (itch.io, GitHub, email) are counted as events.
const analytics = String.raw`<script data-goatcounter="https://maxyo66.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>
<script>
document.addEventListener('click', function (e) {
  var a = e.target.closest && e.target.closest('a[href]');
  if (!a || !window.goatcounter || !window.goatcounter.count) return;
  var u; try { u = new URL(a.href, location.href); } catch (_) { return; }
  if (u.protocol === 'mailto:') u = { host: 'email', pathname: '' };
  else if (u.host === location.host) return;
  window.goatcounter.count({ path: 'out: ' + u.host + u.pathname.replace(/\/$/, ''), title: (a.textContent || '').trim().slice(0, 80), event: true });
}, true);
</script>`;

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="Max (Maxyo66): games, tools and a desktop ocean, from Florida.">
${swap(helmet)}
${analytics}
</head>
<body>
<div id="app"></div>
<script>window.__STANDALONE__ = true;</script>
<script>${preact}</script>
<script>${runtime}</script>
<script>
var __tree = ${JSON.stringify(JSON.parse(swap(JSON.stringify(tree))))};
var Component = (function(DCLogic){ ${swap(script)}; return Component; })(window.DCLogic);
window.__dcMount(__tree, Component, ${JSON.stringify(defaults)}, document.getElementById('app'));
</script>
</body>
</html>
`;
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'index.html'), page);
console.log('built', path.join(outDir, 'index.html'), (page.length / 1024).toFixed(0) + ' KB');
