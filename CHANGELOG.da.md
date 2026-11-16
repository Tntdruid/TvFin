[English](CHANGELOG.md) | **Dansk**

# Changelog

Alle ændringer i TvFin. Opdater TV'et med `./update.sh` på serveren.

## 1.9.0 – 2026-11-16

### Nyt
- **Funscript: fortsæt hvor du slap.** Stopper du midt i en session, står *▶ Fortsæt «navn» fra …* øverst på Funscript-skærmen. Positionen deles med Funscript-appen på PC'en, så du kan stoppe på tv'et og fortsætte på PC'en – eller omvendt.
- **Funscript: tv'et melder tilbage til PC-appen.** En session, der afspilles på tv'et, tæller som afspillet, og spilletiden kommer med i Funscripts 📊 Statistik.
- Kræver den tilhørende Funscript-opdatering (nye tv-endpoints til spilletid og position).

## 1.8.0 – 2026-11-16

### Nyt
- **Funscript-sessioner på tv'et:** afspil gemte sessioner fra Funscript Session-appen på PC'en.
  - Parring som Quick Connect: *Hvem ser med? → 🎬 Tilslut Funscript*, indtast PC'ens adresse (står i Funscript under *Fjernbetjening*), og tryk **Tillad** i Funscript på PC'en. Gemmes pr. TvFin-bruger; derefter er der en *🎬 Funscript*-knap på forsiden.
  - Sessionens klip afspilles efter hinanden; ◀ ▶ spol 10 sek, ▲ næste klip, ▼ forrige klip, OK pause, Tilbage stop.
  - **Handy** (API v3, HSSP): sender du Handy-opsætningen med, når du godkender tv'et, følger Handy'en sessionens script – den pauser ved klipskift og synkroniseres igen, og rettes hvis den glider.
  - Kræver den tilhørende Funscript-opdatering (tv-endpoints på dens fjernbetjeningsserver).

## 1.7.0 – 2026-11-16

### Nyt
- **Gruppér et bibliotek efter kanal:** knappen *📺 Gruppér* i et bibliotek skifter mellem *Ingen* og *Kanal*. Med *Kanal* ser du ét kort pr. kanal (Jellyfins *studie* – for downloadede YouTube-videoer er det kanalen), og vælger du en, ser du kun den kanals videoer, uanset hvor i biblioteket de ligger. Der skal ikke flyttes noget på serveren.
  - Huskes pr. bibliotek; hver kanal har sin egen sortering og visning.
  - *Nyligt tilføjet i … ›* åbner stadig de nyeste videoer, ikke kanallisten.

## 1.6.3 – 2026-11-15

### Nyt
- **Slutter kl.** i afspilleren: klokkeslættet hvor videoen er færdig (fx *Slutter 18.24*) ved siden af spilletiden. Mens du spoler, viser den hvornår den slutter fra den nye position.
- **Tilbage til toppen:** når du har rullet ned på en side, hopper **Tilbage** først op til toppen. Tryk Tilbage igen for at gå tilbage (eller lukke appen fra forsiden) som før.

## 1.6.2 – 2026-11-15

### Nyt
- Overskrifterne *Nyligt tilføjet i …* på forsiden er nu links (**Nyligt tilføjet i YouTube ›**): vælg en for at åbne biblioteket sorteret efter dato tilføjet, nyeste først. Bibliotekets egen gemte sortering bliver ikke ændret.
- Den danske tekst hedder nu "Nyligt tilføjet i …" ligesom i Jellyfin.

## 1.6.1 – 2026-11-15

### Ændret
- **Næste afsnit starter før rulleteksterne er færdige:** et *Næste afsnit*-kort vises nu i afspilleren, når rulleteksterne starter (eller 30 sekunder før slut, hvis Jellyfin ikke ved, hvor rulleteksterne er). Efter 10 sekunders nedtælling starter næste afsnit direkte – du skal ikke længere vente på, at rulleteksterne er færdige.
  - **OK** starter det med det samme, **Tilbage** skjuler kortet, så du kan se rulleteksterne.
  - Nedtællingen følger afspilningen, så den står stille, når du pauser.

## 1.6.0 – 2026-11-15

### Nyt
- **Medvirkende** på infosiden: billeder, navne og roller for skuespillerne (initialer når der ikke er et billede).
- **Skuespillersider:** vælg en skuespiller for at se billede, fødselsår, fødested, biografi og alle film og serier med dem på din server, nyeste først.
- **Mere som dette** på infosiden (for afsnit bruges serien).

## 1.5.0 – 2026-11-14

### Nyt
- **Spring intro / resumé / rulletekster over:** knappen *Spring intro over* vises, mens introen kører; tryk OK for at springe den over. Ved rulleteksterne i et afsnit står der *Næste afsnit ▶*, som går direkte til nedtællingen til næste afsnit.
  - Bruger Jellyfin 10.10+ mediesegmenter (kræver en udbyder som Intro Skipper-pluginet), med fallback til Intro Skippers egne endpoints på ældre servere.
- **Besked om ny version:** forsiden viser "Ny version x.y.z af TvFin er klar – kør ./update.sh på serveren", når der ligger en nyere version på GitHub (tjekkes højst hver 6. time).

## 1.4.1 – 2026-11-14

### Rettet
- 4:3-videoer blev strakt ud til 16:9 på TV'et. Afspilleren bevarer nu videoens billedformat (sorte kanter i siderne).

## 1.4.0 – 2026-11-14

### Nyt
- **Flere rækker på forsiden:** *Favoritter* og *Senest tilføjet i …* for hvert bibliotek (nye afsnit samles pr. serie, ligesom i Jellyfin).
- **Flere brugere på samme TV:** brugerknappen på forsiden åbner *Hvem ser med?*, hvor du kan skifte bruger, tilføje en ny med Quick Connect eller logge kun én af dem ud. Er der mere end én gemt bruger, spørger appen ved opstart.
  - Hver bruger får sit eget device-ID, så Jellyfin holder deres sessioner og fremskridt adskilt.
  - Eksisterende login bevares ved opdatering.

## 1.3.1 – 2026-11-14

### Rettet
- Undertekster skjules, mens menuen til lyd og undertekster er åben, så de ikke skinner igennem.

### Dokumentation
- Skærmbilleder i README.
- Links til de andre Jellyfin-projekter.

## 1.3.0 – 2026-11-14

### Nyt
- **Visninger i mapper** (som i Jellyfin): knappen *▦ Visning* skifter mellem
  *Automatisk*, *Plakater*, *Plakatkort*, *Tommel*, *Tommel kort*, *Banner* og *Liste*.
  Valget huskes pr. mappe – også inde i serier og sæsoner.
  - *Liste* viser et lille billede med titel, år, spilletid, bedømmelse og en kort beskrivelse.
  - *Banner* bruger Jellyfins banner-billeder og falder tilbage til tommel/baggrund.

### Rettet
- Sprogknappen på server- og loginskærmen står nu på sin egen linje, så ned-pil fra feltet går til *Forbind*.

## 1.2.1 – 2026-11-14

### Rettet
- **Større thumbnails:** kort er nu 560 px brede (før 420), plakater 300 px (før 240), med større tekst og skarpere billeder.
- Hvis TV'et rapporterer en skærm større end 1920 px (fx 4K), skaleres hele appen op, så intet bliver småt.

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
