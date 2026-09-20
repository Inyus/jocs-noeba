# Estat del projecte jocs-noeba

Última actualització: 2026-09-20 23:20 (reconstrucció després de l'esborrat del sandbox)

## Fet
- Cua de 180 roscos (3 lots × 60), audits nets (0 errors durs, 0 spoilers).
- Site complet: index.html, style.css, rosco.js, data.js (180 dies, base64),
  favicon + og, robots.txt, sitemap.xml, wrangler.jsonc.
- Pipeline d'àudio reconstruït i VALIDAT (bake_audio.py + num2ca.py + model matxa a /tmp).
  Bug crític trobat i corregit: cal interspersar el token pad (0) entre símbols
  (pipeline oficial matcha); sense això l'àudio sortia inintel·ligible. Verificat
  amb transcripció exacta d'una glosa sencera i durada natural (~5.7s per 76 caràcters).
- Enfornat de dies 0-6 en curs (reiniciat 23:22 amb el pipeline corregit; els clips
  anteriors defectuosos s'han esborrat). ~8.5 min/dia.

## Pendent
- Push a GitHub (PAT al vault) — previst al wake de desplegament 00:20.
- Deploy Cloudflare Workers + domini jocs.noeba.cat.
- Auditoria visual multi-amplada amb screenshots (pressupost de navegador es
  reinicia a les 00:00).
- SEO: Google Search Console (davidgn92@gmail.com), verificar propietat,
  enviar sitemap, demanar indexació.
- Confirmació de l'usuari de la config de veu final (mostres K/L enviades).
- Nom públic definitiu del joc (de moment "La Rosca" descriptiu).
- Joc 2 (Contexto en català) — després del llançament.

## Decisions clau
Veure docs/rosco-spec.md.
