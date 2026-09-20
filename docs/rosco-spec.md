# La Rosca — especificació de producte

## Decisions del propietari (David), per ordre cronològic

- **Marca**: MAI fer servir "Pasapalabra" públicament (marca registrada). La mecànica
  del joc és lliure; el nom, la UI i el trade dress han de ser propis. El botó del joc
  diu "Passo", no "Pasapalabra". Nom públic pendent d'elecció de l'usuari
  (candidats: La Rosca / Rosca Diària / Volta de Lletres). De moment el site usa
  "La Rosca" de manera descriptiva i és trivial canviar-lo (index.html + og).
- **Rosca diària**: 22 cel·les, alfabet català sense k/w/y/z (23 lletres; cada dia una
  en descansa, rotació determinista). Lletra ç sempre present, en mode "conté" si cal.
- **Dificultat**: mitjana per rosca ~14.4 fàcils / 5.7 mitjanes / 1.9 difícils
  (wordfreq zipf). El ç és SEMPRE difícil (sense fallback a fàcil).
- **Modes conté**: q, x, u, j van en mode "conté" per decisió de l'usuari.
- **Definicions**: textuals del Viccionari (CC BY-SA 3.0), sentit principal, sense
  gloses de flexió ni sinònims pelats. DIEC2 exclòs (llicència no compatible).
  Res d'inventat: cada glosa traçable al dump del Viccionari.
- **Roscos temàtics amb noms propis**: funció FUTURA. La diària es manté 100% diccionari.
- **Àudio (🔊)**: veu AINA/Matxa-TTS v2 multiaccent (Elia, spk=2, temp 0.667, rate 1.0).
  Decisió "A" de l'usuari (2026-09-20): Matxa és de llicència NO COMERCIAL
  (custom-ro-nc-openrail-m); acceptable mentre jocs.noeba.cat sigui gratuït i sense
  publicitat. Si algun dia es monetitza, cal re-enfornar TOT l'àudio amb Piper
  ca_ES (dataset CC BY-SA 3.0 ES, segur per a ús comercial).
  La config final de veu pendent de confirmació de l'usuari (proves A-L en curs);
  els clips actuals es poden post-processar amb ffmpeg si tria una variant de tempo/EQ.
- **Recursos**: tot gratuït (Viccionari, wordfreq, Matxa/AINA, Piper, fastText).
- **Dies futurs amagats**: la cua viu a tools/raw/ (gitignored), el web porta els dies
  en base64 a js/data.js i només renderitza el dia actual (Europe/Madrid).

## Arquitectura

- `tools/factory.py`: genera cues de roscos (determinista per llavor), amb deduplicació
  entre lots, filtre de spoilers per forma accent-insensible, exclude.txt manual.
- `tools/audit.py`: auditoria d'un lot (duplicats, mismatch comença/conté, spoilers,
  residu wikitext/HTML, gloses curtes/llargues, flexions, castellanismes ñ,
  corba de dificultat, reutilització a la cua).
- `tools/genera_web.py`: empaqueta la cua a site/js/data.js (base64).
- `tools/num2ca.py`: números i xifres romanes a català parlat per al TTS.
- `tools/bake_audio.py`: enforna site/audio/d<dia>/<i>.ogg (opus 32k) + manifest.json.
- `site/`: estàtic pur (index.html, css, js). Desplegament: Cloudflare Workers assets
  (wrangler.jsonc), domini jocs.noeba.cat.

## Estat de la cua

- 180 dies generats (3 lots de 60), audits sense errors durs.
- Àudio: enfornat continu des del dia 0 (cron nocturn 03:30 fins completar 60 dies,
  després es revisa).
