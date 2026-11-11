/*
  Spiralės nustatymai. Visus skaičius galima keisti čia arba gyvai derinimo
  skydelyje – atidaryk svetainę su ?derinti adreso gale (pvz. …/index.html?derinti).
*/
export const CONFIG = {
  spiral: {
    direction: 1,        // sukimosi kryptis: 1 – pagal laikrodžio rodyklę, -1 – prieš
    turns: 1.3,          // daugiausia apsisukimų (kai nuotraukų mažai, vija trumpesnė)
    spacing: 1.35,       // tankumas: tarpas tarp nuotraukų (1 = liečiasi, 2 = retai)
    visible: 40,         // daugiausia nuotraukų vijoje vienu metu
    startAngle: -90,     // kur prasideda vija (laipsniais; -90 = virš centro, 0 = dešinėje)
    innerRadius: 0.39,   // vijos pradžios atstumas nuo centro (ekrano dalis)
    outerRadius: 0.545,  // vijos galo atstumas nuo centro (0.5 = ekrano kraštas)
    radiusCurve: 1,      // 1 = Archimedo spiralė (tolygu); >1 – ilgiau laikosi arti centro
    stretch: 1,          // kiek spiralė prisitaiko prie ekrano proporcijų (0 = apskrita, 1 = pilnai)
    centerSize: 0.64,    // centrinės nuotraukos aukštis (ekrano aukščio dalis)
    centerMaxWidth: 0.86,// centrinės nuotraukos didžiausias plotis (ekrano pločio dalis)
    nearSize: 0.16,      // arčiausiai centro esančių nuotraukų dydis
    farSize: 0.04,       // tolimiausių nuotraukų dydis (ekrano aukščio dalis)
    sizeCurve: 0.7,      // dydžių kreivė: <1 – nuotraukos greičiau mažėja prie centro
    nearOpacity: 0.95,   // artimiausių nuotraukų ryškumas
    farOpacity: 0.16,    // tolimiausių nuotraukų permatomumas
    opacityCurve: 0.8,
    farBlur: 0.85,       // tolimiausių nuotraukų išliejimas (0–1)
    rotationFollow: 1,   // kiek nuotraukos pasisuka pagal spiralės liniją (0 = visos tiesios)
  },
  motion: {
    inertia: 0.42,       // inercijos trukmė sekundėmis – kuo daugiau, tuo „sunkesnė“ spiralė
    wheelStep: 100,      // kiek ratuko pikselių atitinka vieną nuotrauką
    dragStep: 0.2,       // tempimo jautrumas (ekrano dalis vienai nuotraukai)
    flick: 8,            // daugiausia nuotraukų, kiek spiralė prasisuka pati po stipraus tempimo pele
    trackpad: 0.5,       // touchpad jautrumas (1 = kaip pelės ratuko, mažiau – ramiau)
    touchStep: 0.46,     // braukimo pirštu jautrumas: ekrano dalis vienai nuotraukai (daugiau – ramiau)
    touchInertia: 0.16,  // inercija po braukimo pirštu, sekundėmis
    touchFlick: 1.2,     // daugiausia nuotraukų, kiek prasisuka pati po brūkštelėjimo pirštu
    touchTurn: 0.55,     // sukimo ratu pirštu jautrumas (1 = nuotraukos seka pirštą tiksliai)
    idleDelay: 5,        // po kiek sekundžių spiralė pradeda suktis pati
    idleSpeed: 0.1,      // savaiminio sukimosi greitis (nuotraukų per sekundę)
    introDuration: 1.8,  // įžanginės animacijos trukmė sekundėmis
  },
};
