# Changelog

Alle ændringer i TvFin. Opdater TV'et med `./update.sh` på serveren.

## 1.2.0 – 2026-11-14

### Nyt
- **Flere sprog i appen:** dansk, engelsk, tysk, svensk og norsk. Følger TV'ets sprog automatisk og kan skiftes med 🌐-knappen på forsiden.
- **Lyd og undertekster:** tryk **▲** under afspilning for at vælge lydspor og undertekster. Dit valg af sprog huskes til næste gang.
  - Tekst-undertekster (SRT, ASS, VTT …) vises af appen selv, så der ikke skal omkodes.
  - Billed-undertekster (PGS/DVD) brændes ind af serveren.
- **Næste afsnit automatisk:** når et afsnit slutter, vises "Næste afsnit – starter om 10 sek" med *Afspil nu* og *Annuller*.
- **Søgning:** 🔍-knap på forsiden; søg i film, serier, afsnit og videoer.
- **Sortering i mapper:** navn, dato tilføjet, udgivelsesdato, bedømmelse, sidst set eller tilfældig, stigende eller faldende. Valget huskes pr. mappe.

### Rettet
- Venstre/højre-navigation kunne springe over knapper, der lå tæt op ad hinanden.
- Ned-pil fra et felt går nu til det element, der står længst til venstre, i stedet for et tilfældigt.

## 1.1.0 – 2026-11-14

### Nyt
- **Infoside** når man vælger en video: billede, år, spilletid, "slutter kl.", video- og lydinfo, beskrivelse, studie og genre.
- Knapper til **Afspil / Fortsæt**, **Start forfra**, **Marker som set** og **Favorit**.
- **Scener:** kapitelbilleder; vælg et kapitel for at starte derfra.

## 1.0.1 – 2026-11-14

### Rettet
- Thumbnails blev ikke vist, når serveren ikke sendte billed-tags med. Appen prøver nu flere billedtyper efter tur.

## 1.0.0 – 2026-11-14

Første version.
- Login med **Quick Connect**.
- Forside med *Fortsæt med at se*, *Næste afsnit* og biblioteker.
- Afspilning med Samsungs AVPlay (direkte afspilning eller HLS-omkodning fra serveren).
- **Husker hvor du er nået til:** positionen gemmes på Jellyfin-serveren.
- Installation via Docker (samme container som georift/install-jellyfin-tizen) og `update.sh` fra GitHub.
