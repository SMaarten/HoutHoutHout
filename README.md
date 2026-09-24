# Hout³ website

Statische website voor hout3.be / houthouthout.be. Geen build-stap: gewoon HTML, CSS en JS.

- `index.html`, `style.css`, `app.js`: de website
- `projects.json`: lijst van projecten (titel, beschrijving, foto's)
- `photos/<project>/`: de foto's
- `admin.html`: beheerpagina om projecten en foto's toe te voegen

## Online zetten (GitHub Pages, gratis)

1. Maak een repository aan op GitHub (bv. `hout3`) en push deze map:
   ```bash
   git init && git add . && git commit -m "Hout3 website"
   git branch -M main
   git remote add origin https://github.com/<gebruiker>/hout3.git
   git push -u origin main
   ```
2. Op GitHub: **Settings → Pages → Source: Deploy from a branch → main / (root)**.
   Het `CNAME`-bestand zet het domein al op `hout3.be`. Vink daarna **Enforce HTTPS** aan.
3. DNS bij je registrar voor **hout3.be**:
   - `A` records voor `@`: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `CNAME` voor `www`: `<gebruiker>.github.io`
4. **houthouthout.be**: stel bij de registrar een (301) doorverwijzing in naar `https://hout3.be`.
   GitHub Pages ondersteunt maar één domein per site.

## Foto's toevoegen

**Via de beheerpagina (ook op je gsm):** ga naar `https://hout3.be/admin.html`.

1. Eenmalig: maak een token op github.com → Settings → Developer settings →
   Personal access tokens → **Fine-grained tokens** → Generate new token.
   Kies *Only select repositories* → `hout3`, en bij Permissions **Contents: Read and write**.
2. Vul op de beheerpagina je GitHub-gebruiker, `hout3` en het token in. Dit wordt enkel in die browser bewaard.
3. Kies een bestaand project of maak een nieuw, selecteer foto's, klik **Toevoegen aan lijst** en daarna **Publiceren**.
   Foto's worden automatisch verkleind en zonder locatiegegevens opgeslagen.
   Na 1 à 2 minuten staat alles online.

Je kan er ook titels en beschrijvingen aanpassen, de volgorde wijzigen en foto's of projecten verwijderen.

**Met de hand:** zet foto's in `photos/<project>/`, voeg ze toe in `projects.json` en push.

## Lokaal bekijken

```bash
python3 -m http.server 8000
```
Open daarna http://localhost:8000.

## Nog aan te passen

- E-mailadres in `index.html` (nu `info@hout3.be`) en eventueel een telefoonnummer.
- Titels en beschrijvingen van de projecten (in `projects.json` of via de beheerpagina).
