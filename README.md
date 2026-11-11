# aiv.raw

Vieno puslapio interaktyvi nuotraukų galerija: nuotraukos spirale sukasi aplink saulę – ratuku, tempimu,
rodyklėmis ar braukimu, o paspaudus atsidaro per visą ekraną. Prie kiekvienos nuotraukos rodoma vieta,
kur ji daryta. Svetainė visiškai statinė – be serverio ir duomenų bazės.

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
  "title": "aiv.raw",
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
| `description` | ne | Trumpas aprašas peržiūroje |

- **Tvarka spiralėje = tvarka faile.** Pirmoji sąraše yra ta, kuri atidarius būna centre.
- Jei kuris nors laukas tuščias, jis tiesiog nerodomas.
- Pavyzdinėse nuotraukose įrašas „Vieta bus čia“ reiškia, kad tikros vietos nežinau – pakeisk ją savo.
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

## Spiralės derinimas

Visi nustatymai (tankumas, sukimosi kryptis, dydžiai, inercija, savaiminio sukimosi greitis, saulės dydis
ir kt.) yra faile **`js/config.js`** su paaiškinimais. Saulės spalvos ir judėjimo greitis – `css/style.css`
skyriuje „Saulė fone“.

Patogiausia derinti gyvai: atidaryk svetainę su **`?derinti`** adreso gale
(pvz. `http://localhost:8080/?derinti`). Atsiras skydelis su slankikliais; kai rezultatas patinka,
spausk „Kopijuoti nustatymus“ ir įklijuok reikšmes į `js/config.js`.

## Valdymas

| Veiksmas | Rezultatas |
|---|---|
| Pelės ratukas / touchpad, tempimas pele, braukimas pirštu (aukštyn–žemyn arba ratu) | Spiralė sukasi |
| ← → | Viena nuotrauka atgal / pirmyn |
| Paspaudimas ant mažos nuotraukos | Spiralė prisisuka iki jos |
| Paspaudimas ant centrinės nuotraukos, Enter | Peržiūra per visą ekraną |
| Peržiūroje: ← →, braukimas į šonus, rodyklės šonuose | Kita / ankstesnė nuotrauka |
| Peržiūroje: Esc, ×, paspaudimas šalia nuotraukos, braukimas žemyn | Uždaryti |
| Peržiūroje: du pirštai, dvigubas bakstelėjimas, Ctrl + ratukas | Priartinti |
| Mygtukas apatiniame dešiniajame kampe | Sustabdyti / tęsti saulės ir spiralės savaiminį judesį |

Kiekviena nuotrauka turi savo nuorodą: `…/#nuotrauka-12` iškart atidaro galeriją su 12-ąja nuotrauka centre.

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
js/config.js          spiralės ir judesio nustatymai
js/spiral.js          spiralė (piešiama <canvas>), valdymas, inercija
js/sun.js             saulė fone (spinduliai ir paviršius)
js/viewer.js          peržiūra per visą ekraną, priartinimas, gestai
js/main.js            paleidimas, klaviatūra, nuorodos
js/tune.js            derinimo skydelis (?derinti)
photos/               nuotraukų originalai
photos.json           nuotraukų sąrašas ir aprašai
optimized/            automatiškai sukuriamos sumažintos versijos (į git nekeliamos)
scripts/              nuotraukų paruošimas ir vietinis serveris
fonts/                šriftai „Megrim“ ir „Fraunces“ (SIL Open Font License)
```

Dabartinės nuotraukos yra laikinos pavyzdinės; jų autoriai surašyti `photos/CREDITS.md`.
