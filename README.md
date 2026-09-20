# jocs.noeba.cat

Word games in Catalan, free forever. First game: **La Rosca** (daily letter-wheel
game: 22 letters, 22 dictionary definitions, Catalan-only UI). Second game:
**Contexto català** (semantic-proximity word guessing with fastText Catalan
vectors), after launch.

- Live: https://jocs.noeba.cat (pending deploy)
- Part of the noeba.cat family (retos.noeba.cat, pixels.noeba.cat)

## Data honesty rules (non-negotiable)

- Definitions come verbatim from the Catalan Wiktionary (Viccionari, CC BY-SA 3.0),
  extracted from the official Wikimedia dump with our own parser. Attribution in
  the site footer. The IEC's DIEC2 is copyrighted and NOT used (checked
  2026-09-20: iec.cat/legal reserves reproduction/transformation rights).
- Catalan semantic vectors (game 2): fastText crawl vectors for Catalan (CC BY-SA 3.0).
- No invented definitions, ever. A word without a verified definition does not ship.

## Branding

Original name and UI. We never use the TV-show trademark publicly: the pass button
says "Passo", and the mechanics are described in our own words.

## Audio

The 🔊 definitions are synthesized with AINA's Matxa-TTS v2 (voice: Elia),
non-commercial license — fine while the site is free and ad-free. If the site ever
monetizes, all audio must be re-baked with Piper ca_ES (CC BY-SA dataset). See
docs/rosco-spec.md.

## Repo layout

- `site/` - static frontend (plain HTML/CSS/JS, no build step, Catalan only) +
  baked audio (`site/audio/`, deployed as static assets)
- `tools/` - data pipeline: dump extraction, rosco factory, audit, web packer,
  TTS bake (matxa model lives outside the repo)
- `tools/raw/` - rosco queue and dictionary extracts (gitignored: future days stay hidden)
- `docs/` - design, licensing and audit reports

## Development

Everything is static-hostable (Cloudflare Workers assets, see wrangler.jsonc).
Data files are generated deterministically (seeded) by `tools/`; the web bundle
is rebuilt with `python3 tools/genera_web.py`.
