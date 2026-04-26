
const express = require('express');
const app = express();
const PORT = 8080;

app.set('view engine', 'ejs');

const path = require('path'); 
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'resurse')));

app.use((req, res, next) => {
    res.locals.ipUtilizator = req.ip; 
    next(); 
});

const fs = require('fs'); // Modulul nativ Node.js pentru lucrul cu fișiere (File System)

let obGlobal = {
    obErori: null
};

// funcția de inițializare a erorilor
function initErori() {
    const caleFisier = path.join(__dirname, 'erori.json');
    const continutJson = fs.readFileSync(caleFisier, 'utf-8');
    
    const obiectErori = JSON.parse(continutJson);

    obiectErori.eroare_default.imagine = obiectErori.cale_baza + '/' + obiectErori.eroare_default.imagine;

    for (let i = 0; i < obiectErori.info_erori.length; i++) {
        obiectErori.info_erori[i].imagine = obiectErori.cale_baza + '/' + obiectErori.info_erori[i].imagine;
    }

    obGlobal.obErori = obiectErori;
}

const vect_foldere = ["temp", "logs", "backup", "fisiere_uploadate"];

for (let folder of vect_foldere) {
    const caleFolder = path.join(__dirname, folder);

    if (!fs.existsSync(caleFolder)) {
        fs.mkdirSync(caleFolder);
        console.log(`[Init] Folderul '${folder}' a fost creat automat.`);
    } else {
        // daca exista deja, lasam un mesaj de confirmare ascuns
        // console.log(`[Init] Folderul '${folder}' există deja.`);
    }
}

initErori();

function afisareEroare(res, identificator, titlu, text, imagine) {
    let eroareGasita = null;
    let codStatus = 200; // cod de baza

    if (identificator) {
        eroareGasita = obGlobal.obErori.info_erori.find(e => e.identificator === identificator);
    }

    if (!eroareGasita) {
        eroareGasita = obGlobal.obErori.eroare_default;
        codStatus = identificator || 500; 
    } else {
        if (eroareGasita.status) {
            codStatus = identificator;
        }
    }

    const titluFinal = titlu || eroareGasita.titlu;
    const textFinal = text || eroareGasita.text;
    const imagineFinala = imagine || eroareGasita.imagine;

    res.status(codStatus).render('pagini/eroare', {
        titlu: titluFinal,
        text: textFinal,
        imagine: imagineFinala
    });
}

// modificam ruta pt "acasa" pt a fii async
app.get(['/', '/index', '/home'], async (req, res) => {
    try {
        const imaginiGalerie = await pregatesteImaginiGalerie();
        res.render('pagini/index', { imagini: imaginiGalerie }); 
    } catch (err) {
        console.error("Eroare la galerie:", err);
        afisareEroare(res, 500);
    }
});

// ruta noua pt pagina de galerie statica
app.get('/galerie-statica', async (req, res) => {
    try {
        const imaginiGalerie = await pregatesteImaginiGalerie();
        res.render('pagini/galerie-statica', { 
            imagini: imaginiGalerie,
            titlu: "Galerie Statică Elynxium"
        }); 
    } catch (err) {
        console.error("Eroare la galerie:", err);
        afisareEroare(res, 500);
    }
});

app.get('/favicon.ico', (req, res) => {
    const caleFavicon = path.join(__dirname, 'resurse', 'ico', 'favicon.ico');
    res.sendFile(caleFavicon);
});

app.get(new RegExp('^/resurse(/.*)?$'), (req, res) => {
    afisareEroare(res, 403);
});

app.get(/\.ejs$/, (req, res) => {
    afisareEroare(res, 400);
});

app.get(/.*/, (req, res) => {
    
    if (req.path.includes('.')) {
        return afisareEroare(res, 404);
    }

    const numePagina = 'pagini' + req.path;

    res.render(numePagina, function(eroare, rezultatRandare) {
        if (eroare) {
            if (eroare.message.startsWith("Failed to lookup view")) {
                afisareEroare(res, 404);
            } else {
                afisareEroare(res, 500); 
            }
        } else {
            res.send(rezultatRandare);
        }
    });
});

app.listen(PORT, () => {
    console.log(`Serverul rulează pe http://localhost:${PORT}`);
});

console.log("Calea folderului fișierului (__dirname): ", __dirname);
console.log("Calea completă a fișierului (__filename): ", __filename);
console.log("Folderul curent de lucru (process.cwd()): ", process.cwd());



const sharp = require('sharp');

// functie asincronă pentru a pregăti imaginile galeriei
async function pregatesteImaginiGalerie() {
    const caleJson = path.join(__dirname, 'galerie.json');
    const dateGalerie = JSON.parse(fs.readFileSync(caleJson, 'utf-8'));

    const minutCurent = new Date().getMinutes();
    let sfertCurent = 1;
    if (minutCurent >= 15 && minutCurent < 30) sfertCurent = 2;
    else if (minutCurent >= 30 && minutCurent < 45) sfertCurent = 3;
    else if (minutCurent >= 45) sfertCurent = 4;

    // filtrare si trunchere imagini
    let imaginiFiltrate = dateGalerie.imagini.filter(img => parseInt(img.sfert_ora) === sfertCurent);
    imaginiFiltrate = imaginiFiltrate.slice(0, 10);

    const folderSursa = path.join(__dirname, 'resurse', dateGalerie.cale_galerie);

        // procesare cu sharp
    for (let img of imaginiFiltrate) {
        const numeFisier = img.cale_imagine;
        const ext = path.extname(numeFisier); // ex: .jpg
        const baza = path.basename(numeFisier, ext); // ex: cafea1

        const caleAbsoluta = path.join(folderSursa, numeFisier);
        const caleMic = path.join(folderSursa, `${baza}-mic${ext}`);
        const caleMediu = path.join(folderSursa, `${baza}-mediu${ext}`);

        // salvare cai web relative
        img.cale_web_mare = `/${dateGalerie.cale_galerie}/${numeFisier}`;
        img.cale_web_mediu = `/${dateGalerie.cale_galerie}/${baza}-mediu${ext}`;
        img.cale_web_mic = `/${dateGalerie.cale_galerie}/${baza}-mic${ext}`;

        if (fs.existsSync(caleAbsoluta)) {
            if (!fs.existsSync(caleMediu)) {
                await sharp(caleAbsoluta).resize(300).toFile(caleMediu);
            }
            if (!fs.existsSync(caleMic)) {
                await sharp(caleAbsoluta).resize(150).toFile(caleMic);
            }
        }
    }

    return imaginiFiltrate;
}