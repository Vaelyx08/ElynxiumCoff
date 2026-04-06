

// 1. Importăm modulul express
const express = require('express');

// 2. Creăm obiectul server (numit de obicei 'app')
const app = express();

// 3. Definim portul
const PORT = 8080;

// Setăm EJS ca motor de template-uri
app.set('view engine', 'ejs');

// Opțional, dar recomandat: specificăm explicit unde este folderul 'views'
// folosind variabila __dirname pentru a evita problemele de căi discutate anterior
const path = require('path'); 
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'resurse')));

// --- MIDDLEWARE PENTRU DATE GLOBALE ÎN EJS ---
app.use((req, res, next) => {
    // req.ip extrage automat adresa IP a clientului
    res.locals.ipUtilizator = req.ip; 
    
    // next() îi spune lui Express să treacă la următoarea funcție (adică la rutele tale)
    next(); 
});

const fs = require('fs'); // Modulul nativ Node.js pentru lucrul cu fișiere (File System)

// 1. Crearea variabilei globale
let obGlobal = {
    obErori: null
};

// 2. Funcția de inițializare a erorilor
function initErori() {
    // Citim JSON-ul de pe disc
    const caleFisier = path.join(__dirname, 'erori.json');
    const continutJson = fs.readFileSync(caleFisier, 'utf-8');
    
    // Transformăm textul JSON într-un obiect JavaScript
    const obiectErori = JSON.parse(continutJson);

    // Setăm calea absolută (completă) pentru imaginea erorii default
    obiectErori.eroare_default.imagine = obiectErori.cale_baza + '/' + obiectErori.eroare_default.imagine;

    // Parcurgem vectorul info_erori și modificăm calea pentru fiecare imagine în parte
    for (let i = 0; i < obiectErori.info_erori.length; i++) {
        obiectErori.info_erori[i].imagine = obiectErori.cale_baza + '/' + obiectErori.info_erori[i].imagine;
    }

    // Salvăm obiectul gata procesat în variabila globală
    obGlobal.obErori = obiectErori;
}

// =======================================================
// INIȚIALIZARE FOLDERE PROIECT
// =======================================================

// 1. Definim vectorul cu numele folderelor cerute
const vect_foldere = ["temp", "logs", "backup", "fisiere_uploadate"];

// 2. Iterăm prin vector pentru a verifica și crea fiecare folder
for (let folder of vect_foldere) {
    // Construim calea absolută folosind strict path.join(), conform cerinței
    const caleFolder = path.join(__dirname, folder);

    // Verificăm dacă folderul NU există
    if (!fs.existsSync(caleFolder)) {
        // Dacă nu există, îl creăm
        fs.mkdirSync(caleFolder);
        console.log(`[Init] Folderul '${folder}' a fost creat automat.`);
    } else {
        // Dacă există deja, putem lăsa opțional un mesaj de confirmare ascuns
        // console.log(`[Init] Folderul '${folder}' există deja.`);
    }
}

// 3. Apelăm funcția pentru a încărca datele în memorie fix la pornirea serverului
initErori();

// Funcția actualizată, mai flexibilă
function afisareEroare(res, identificator, titlu, text, imagine) {
    let eroareGasita = null;
    let codStatus = 200; // Cod de bază

    // 1. Dacă s-a precizat un identificator, căutăm eroarea în JSON
    if (identificator) {
        eroareGasita = obGlobal.obErori.info_erori.find(e => e.identificator === identificator);
    }

    // 2. Dacă nu s-a specificat identificator SAU dacă identificatorul nu există în JSON (ex: 500)
    if (!eroareGasita) {
        eroareGasita = obGlobal.obErori.eroare_default;
        // Dacă nu avem identificator deloc, trimitem status 500 generic
        codStatus = identificator || 500; 
    } else {
        // Dacă am găsit eroarea și are status: true
        if (eroareGasita.status) {
            codStatus = identificator;
        }
    }

    // 3. PRIORITATEA ARGUMENTELOR: 
    // Folosim operatorul || (SAU logic). Dacă argumentul (ex: titlu) există, îl ia pe acela.
    // Dacă este undefined (lipsește), ia valoarea extrasă din JSON (eroareGasita.titlu).
    const titluFinal = titlu || eroareGasita.titlu;
    const textFinal = text || eroareGasita.text;
    const imagineFinala = imagine || eroareGasita.imagine;

    // 4. Randăm pagina cu datele finale stabilite
    res.status(codStatus).render('pagini/eroare', {
        titlu: titluFinal,
        text: textFinal,
        imagine: imagineFinala
    });
}

// Rută pentru pagina principală (Acasă)
// Definim un vector cu toate căile care duc spre pagina principală
app.get(['/', '/index', '/home'], (req, res) => {
    res.render('pagini/index'); 
});

// --- NOU: RUTA PENTRU FAVICON ---
app.get('/favicon.ico', (req, res) => {
    // Construim calea absolută către fișierul fizic de pe disc
    // (Presupunem că ai pus iconița în resurse/ico/favicon.ico, conform codului tău HTML anterior)
    const caleFavicon = path.join(__dirname, 'resurse', 'ico', 'favicon.ico');
    
    // Trimitem fișierul direct către browser
    res.sendFile(caleFavicon);
});

// --- BLOCARE ACCES FOLDERE (403 Forbidden) ---
// Folosim o expresie regulată pentru a prinde orice URL care începe cu /resurse
app.get(new RegExp('^/resurse(/.*)?$'), (req, res) => {
    // Apelăm funcția de afișare a erorilor, transmițând codul 403
    afisareEroare(res, 403);
});

// --- BLOCARE ACCES DIRECT LA FIȘIERE .EJS (400 Bad Request) ---
app.get(/\.ejs$/, (req, res) => {
    afisareEroare(res, 400);
});

// Aici urmează ruta catch-all pe care o ai deja:
// app.get(/.*/, (req, res) => { ...

// --- RUTA CATCH-ALL ---
app.get(/.*/, (req, res) => {
    
    // NOU: Filtru de siguranță! 
    // Dacă URL-ul conține un punct (ex: fisier.png, script.js), 
    // e clar că e o resursă lipsă, nu o pagină EJS. Oprim procesul și dăm 404.
    if (req.path.includes('.')) {
        return afisareEroare(res, 404);
    }

    // Aici continuă codul tău vechi...
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

// 4. Pornim serverul pentru a asculta cererile HTTP
app.listen(PORT, () => {
    console.log(`Serverul rulează pe http://localhost:${PORT}`);
});

console.log("Calea folderului fișierului (__dirname): ", __dirname);
console.log("Calea completă a fișierului (__filename): ", __filename);
console.log("Folderul curent de lucru (process.cwd()): ", process.cwd());