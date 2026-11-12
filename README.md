# aivijaus.raw

Vieno puslapio interaktyvi galerija: nuotraukos – lyg seni atspaudai – išmėtytos ant begalinio
viduramžiško medinio stalo tarp žvakių, plunksnų, raktų ir pergamento ritinių. Stalą galima
tempti į visas puses ir priartinti, o paspaudus nuotrauką ji pakyla ir atsidaro peržiūroje.
Svetainė visiškai statinė – be serverio ir duomenų bazės.

## Kaip pridėti ar pakeisti nuotraukas

1. Įmesk originalus (JPG, PNG, WebP) į aplanką **`photos/`**. Failų pavadinimuose geriau nenaudoti tarpų.
2. Paleisk **`npm run photos`**. Komanda:
   - kiekvienai nuotraukai sukuria tris sumažintas WebP versijas aplanke `optimized/`
     (mažą spiralei, vidutinę centrui, didelę peržiūrai per visą ekraną);
   - naujus failus pati įrašo į **`photos.json`** sąrašo galą.
3. Atsidaryk `photos.json` ir kiekvienai nuotraukai įrašyk **vietą** (`location`); jei nori – ir pavadinimą,
   metus, sukeisk eilės tvarką. Jei vieta neįrašyta, `npm run photos` apie tai perspėja.

Publikuojant per GitHub (žr. žemiau) 2 žingsnis atliekamas automatiškai – užtenka įkelti nuotraukas
į `photos/` ir, jei reikia, paredaguoti `photos.json`.

### `photos.json`

```json
{
  "title": "aivijaus.raw",
  "photos": [
    { "file": "01-fjordas.jpg", "title": "Veidrodinis fjordas", "location": "Sløverfjorden, Lofotenai, Norvegija", "year": "2015" },
    { "file": "02-krioklys.jpg", "location": "Vakarų fjordai, Islandija" },
    { "file": "03-miskas.jpg", "title": "Rudens miškas", "location": "Labanoro giria", "description": "Ankstyvas rytas po lietaus." }
  ]
}
```

| Laukas | Privalomas | Ką reiškia |
|---|---|---|
| `title` (viršuje) | ne | Pavadinimas viršutiniame kairiajame kampe ir naršyklės kortelėje |
| `file` | **taip** | Failo pavadinimas aplanke `photos/`, tiksliai kaip faile (su `.jpg`) |
| `location` | rekomenduojama | Vieta, kur nuotrauka daryta. Rodoma po centrine nuotrauka ir peržiūroje |
| `title` | ne | Nuotraukos pavadinimas peržiūroje |
| `year` | ne | Metai (rodomi šalia vietos) |

- **Pirmosios sąraše nuotraukos dedamos arčiausiai stalo centro.** Pridėjus ar išėmus nuotraukų, stalas persiskirsto pats.
- Kai nuotraukos baigiasi, jos ant stalo kartojasi, bet kitokia tvarka.
- Jei kuris nors laukas tuščias, jis tiesiog nerodomas.
- Norėdamas išimti nuotrauką, ištrink jos eilutę iš `photos.json` (ir failą iš `photos/`).
- Po kiekvieno įrašo, išskyrus paskutinį, turi būti kablelis. Jei galerija nebeatsidaro, dažniausiai
  kaltas būtent praleistas ar perteklinis kablelis.

## Peržiūra savo kompiuteryje

Reikia [Node.js](https://nodejs.org) 20 ar naujesnės versijos.

```bash
npm install        # tik pirmą kartą
npm run photos     # paruošia nuotraukas
npm start          # http://localhost:8080
```

## Nustatymai

Faile **`js/config.js`** su paaiškinimais: kiek nuotraukų matosi ekrane, jų dydis ir pasukimas,
kiek daiktų tarp nuotraukų, priartinimo ribos, inercija, žvakių mirgėjimas, dulkės, įžangos trukmė.
Išdėstymas visada toks pat (lankytojas gali grįžti į tą pačią vietą); pakeitus `seed` gaunamas kitas.

## Valdymas

| Veiksmas | Rezultatas |
|---|---|
| Tempimas pele ar pirštu bet kuria kryptimi | Stalas juda; greitai brūkštelėjus dar paslysta |
| Pelės ratukas / touchpad dviem pirštais | Stalas slenka |
| Du pirštai, Ctrl + ratukas, + / − | Priartinti / atitolinti (50–200 %) |
| Rodyklės | Stalas pajuda į tą pusę |
| Tab / Shift + Tab, Enter | Pereiti tarp nuotraukų, atidaryti |
| Kompasas kampe, 0 | Grįžti į stalo centrą |
| Varpelis kampe | Įjungti / išjungti garsą (pagal nutylėjimą išjungtas) |
| Peržiūroje: ← →, braukimas į šonus, rodyklės šonuose | Kita / ankstesnė nuotrauka |
| Peržiūroje: Esc, antspaudas su „X“, paspaudimas šalia, braukimas žemyn | Uždaryti |
| Peržiūroje: ratukas, du pirštai, dvigubas bakstelėjimas | Priartinti detales |

Kiekviena nuotrauka turi savo nuorodą: `…/#nuotrauka-12` atidaro stalą su 12-ąja nuotrauka peržiūroje.

## Grafika ir licencijos

Stalo tekstūra, daiktai ant stalo, popieriaus kraštai ir antspaudai nupiešti kodu (`js/texture.js`,
`js/sprites.js`, `js/print.js`), garsai sugeneruojami naršyklėje (`js/sound.js`) – jokių svetimų
paveikslėlių ar garso failų. Šriftai „UnifrakturMaguntia“ ir „EB Garamond“ – SIL Open Font License.

## Publikavimas per GitHub Pages

1. Repozitorijoje: **Settings → Pages → Build and deployment → Source: „GitHub Actions“**.
2. Sujunk pakeitimus į šaką `main`.

Nuo tada kiekvienas pakeitimas šakoje `main` (pvz. naujos nuotraukos) automatiškai paruošia
sumažintas versijas ir atnaujina svetainę – tai daro `.github/workflows/pages.yml`.
Į svetainę keliamos tik sumažintos WebP versijos, originalai lieka repozitorijoje.

> GitHub nepriima didesnių nei 100 MB failų ir rekomenduoja, kad visa repozitorija neviršytų ~1 GB.
> Jei originalai labai dideli, prieš keliant verta juos sumažinti iki maždaug 4000 px ilgosios kraštinės.

## Kas kur yra

```
index.html            puslapis
css/style.css         išvaizda, šriftai
js/config.js          nustatymai
js/table.js           stalas: išdėstymas, kamera, tempimas, artinimas, piešimas
js/print.js           nuotraukos kaip seni atspaudai (kraštai, atspalvis, šešėlis)
js/texture.js         ąžuolo stalo tekstūra
js/sprites.js         daiktai ant stalo ir segtukai
js/light.js           žvakių šviesa, vinjetė, dulkės
js/viewer.js          nuotraukos peržiūra
js/intro.js           įžanga
js/sound.js           garsai
js/main.js            paleidimas, klaviatūra, nuorodos
photos/               nuotraukų originalai
photos.json           nuotraukų sąrašas ir aprašai
optimized/            automatiškai sukuriamos sumažintos versijos (į git nekeliamos)
scripts/              nuotraukų paruošimas ir vietinis serveris
fonts/                šriftai
```

Kol `photos.json` neįrašyta nuotraukos vieta (`location`), po ja nerodoma nieko.
