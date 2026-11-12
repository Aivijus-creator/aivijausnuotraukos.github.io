/*
  Stalo nustatymai. Skaičius galima keisti čia – išdėstymas visada lieka toks pat,
  kol nesikeičia nuotraukų sąrašas ir šie nustatymai.
*/
export const CONFIG = {
  table: {
    seed: 1207,          // išdėstymo „sėkla“: pakeitus gaunamas kitas, bet vėl pastovus išdėstymas
    perScreen: 10,       // kiek nuotraukų matosi kompiuterio ekrane (kai priartinimas 100 %)
    perScreenPhone: 4,   // …ir telefone
    photoSize: 0.66,      // nuotraukos ilgoji kraštinė stalo langelio dalimis
    sizeJitter: 0.2,     // dydžių skirtumai: 0.2 = nuo 80 % iki 120 %
    maxRotation: 8,      // didžiausias pasukimas laipsniais (abiem kryptimis)
    jitter: 0.11,        // kiek nuotrauka gali nukrypti nuo langelio centro
    stillLife: 9,        // kas kelintas langelis vietoje nuotraukos turi didesnį daiktą (0 = jokių)
    smallItems: 0.2,     // kokia dalis tarpų tarp nuotraukų turi smulkų daiktą
    pins: 0.28,          // kokia dalis nuotraukų „prisegta“ (antspaudu, vinute, akmenėliu, raktu)
    minZoom: 0.5,
    maxZoom: 2,
    inertia: 0.42,       // kiek laiko (s) stalas slysta po brūkštelėjimo
  },
  print: {
    margin: 0.03,        // šviesus popieriaus kraštas (nuotraukos pločio dalis)
    tint: 0.32,          // senėjimo atspalvio stiprumas (0–1)
  },
  light: {
    flicker: 0.035,      // žvakių mirgėjimo stiprumas (0 = nemirga)
    dust: 22,            // dulkių dalelių skaičius (0 = be dulkių)
    vignette: 0.8,       // ekrano kraštų patamsėjimas
  },
  intro: {
    duration: 2.6,       // įžangos trukmė sekundėmis
  },
};
