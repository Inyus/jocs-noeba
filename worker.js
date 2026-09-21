// Serves the static site, except on jocs.noeba.cat, which gets a small
// migration page: it bundles the visitor's localStorage progress into the
// URL hash and sends them to capicua.noeba.cat (the game imports it there).
const MIGRATION_HTML = `<!DOCTYPE html>
<html lang="ca">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Capicua — ens hem mudat!</title>
<link rel="canonical" href="https://capicua.noeba.cat/">
<meta name="robots" content="noindex">
<style>
body{background:#090d12;color:#eef5f5;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;
display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;text-align:center}
p{max-width:34em;line-height:1.6;padding:0 1.2rem;font-size:1.1rem}
a{color:#72e2c4;font-weight:700}
</style>
</head>
<body>
<p>El Capicua s'ha mudat a <a id="go" href="https://capicua.noeba.cat/">capicua.noeba.cat</a>.<br>
T'hi portem ara mateix, amb el teu progrés i la teva ratxa…</p>
<script>
(function () {
  var dest = 'https://capicua.noeba.cat' + location.pathname + location.search;
  try {
    var items = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf('jocs.capicua.') === 0) items.push([k, localStorage.getItem(k)]);
    }
    var b64 = btoa(String.fromCharCode.apply(null, new TextEncoder().encode(JSON.stringify({ k: items }))));
    document.getElementById('go').href = dest + '#m=' + b64;
    location.replace(dest + '#m=' + b64);
  } catch (e) {
    location.replace(dest);
  }
})();
</scr` + `ipt>
</body>
</html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === 'jocs.noeba.cat') {
      return new Response(MIGRATION_HTML, {
        headers: { 'content-type': 'text/html;charset=utf-8', 'cache-control': 'no-cache' },
      });
    }
    return env.ASSETS.fetch(request);
  },
};
