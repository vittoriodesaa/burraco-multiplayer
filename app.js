// 1. IMPORTAZIONE DI FIREBASE TRAMITE CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, set, onValue, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
// I tuoi codici di Firebase
const firebaseConfig = {
  apiKey: "AIzaSyApk22xgLcg0F8vz2REHObWzz9fv9jA4mg",
  authDomain: "burraco-3e56c.firebaseapp.com",
  databaseURL: "https://burraco-3e56c-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "burraco-3e56c",
  storageBucket: "burraco-3e56c.firebasestorage.app",
  messagingSenderId: "877138727580",
  appId: "1:877138727580:web:18276dc05b4e0adb3b5359"
};

// Accendiamo Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// 2. ASSEGNAZIONE RUOLO DALL'URL
const urlParams = new URLSearchParams(window.location.search);
const mioRuolo = urlParams.get('p') === '2' ? 'giocatore2' : 'giocatore1';
console.log("Sistema Avviato. Il tuo ruolo è:", mioRuolo);

// 3. GENERAZIONE E MESCOLAMENTO (Funzioni di base)
function generaMazzo() {
    const semi = ['Cuori', 'Quadri', 'Fiori', 'Picche'];
    const valori = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
    let mazzoTemporaneo = [];

    for (let i = 0; i < 2; i++) {
        for (let seme of semi) {
            for (let valore of valori) {
                let tipoCarta = (valore === 2) ? 'pinella' : 'normale';
                mazzoTemporaneo.push({ seme: seme, valore: valore, tipo: tipoCarta });
            }
        }
        mazzoTemporaneo.push({ seme: 'Jolly', valore: 0, tipo: 'jolly' });
        mazzoTemporaneo.push({ seme: 'Jolly', valore: 0, tipo: 'jolly' });
    }
    return mazzoTemporaneo;
}

function mescolaMazzo(mazzo) {
    for (let i = mazzo.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [mazzo[i], mazzo[j]] = [mazzo[j], mazzo[i]]; 
    }
    return mazzo;
}

function distribuisciCarte(mazzoMescolato) {
    return {
        giocatore1: mazzoMescolato.splice(0, 11),
        giocatore2: mazzoMescolato.splice(0, 11),
        pozzetto1: mazzoMescolato.splice(0, 11),
        pozzetto2: mazzoMescolato.splice(0, 11),
        scarti: [mazzoMescolato.splice(0, 1)[0]],
        mazzoCentrale: mazzoMescolato,
        turnoDi: 'giocatore1', // Il turno iniziale è del Giocatore 1
        faseTurno: 'pesca'     // La prima mossa obbligatoria è pescare
    };
}

// 4. CREAZIONE PARTITA NEL CLOUD
// 4. CREAZIONE PARTITA NEL CLOUD (Versione Intelligente)
function avviaNuovaPartita() {
    // Blocco di sicurezza: se sei il Giocatore 2, non puoi piallare il tavolo!
    if (mioRuolo !== 'giocatore1') return;

    const stanzaRef = ref(db, 'stanza_principale');
    
    // Prima di mescolare le carte, "bussiamo" a Firebase per vedere se c'è già una partita
    get(stanzaRef).then((snapshot) => {
        if (snapshot.exists()) {
            // C'è già una partita in corso! Spegniamo il bulldozer.
            console.log("Partita già esistente. Mi collego al tavolo senza cancellare nulla.");
            return; 
        } else {
            // Firebase è vuoto. Possiamo creare un tavolo nuovo.
            console.log("Tavolo vuoto. Genero un nuovo mazzo e avvio la partita...");
            let mazzoOrdinato = generaMazzo();
            let mazzoMischiato = mescolaMazzo(mazzoOrdinato);
            let tavoloPronto = distribuisciCarte(mazzoMischiato);

            set(stanzaRef, tavoloPronto)
                .then(() => console.log("Partita inizializzata e caricata su Firebase."))
                .catch((err) => console.error("Errore caricamento:", err));
        }
    }).catch((error) => {
        console.error("Errore nel controllo del database:", error);
    });
}

let stoRispondendo = false;
// 5. ASCOLTO E AGGIORNAMENTO GRAFICA DAL CLOUD
function ascoltaTavolo() {
    const stanzaRef = ref(db, 'stanza_principale');
    
    onValue(stanzaRef, (snapshot) => {
        const dati = snapshot.val();
        if (!dati) return; 

        // NUOVO: INTERCETTAZIONE RICHIESTA DI RIAVVIO
        if (dati.richiestaRiavvio && dati.richiestaRiavvio !== mioRuolo && !stoRispondendo) {
            stoRispondendo = true;
            
            // Un micro-ritardo per far caricare la grafica prima di bloccare lo schermo
            setTimeout(() => {
                let accetta = confirm("L'avversario vuole riavviare la partita, accettare?");
                
                if (accetta) {
                    // Se accetta: Facciamo partire il vero Bulldozer
                    let mazzoOrdinato = generaMazzo();
                    let mazzoMischiato = mescolaMazzo(mazzoOrdinato);
                    let tavoloNuovo = distribuisciCarte(mazzoMischiato);
                    tavoloNuovo.chat = []; // Ripuliamo anche la chat
                    
                    set(stanzaRef, tavoloNuovo).then(() => {
                        stoRispondendo = false;
                        alert("Hai accettato! Il tavolo è stato riavviato per entrambi.");
                    });
                } else {
                    // Se rifiuta: Cancelliamo la bandierina e facciamo finta di niente
                    dati.richiestaRiavvio = null;
                    set(stanzaRef, dati).then(() => {
                        stoRispondendo = false;
                    });
                }
            }, 100);
        }

        const mieCarte = (mioRuolo === 'giocatore1') ? dati.giocatore1 : dati.giocatore2;
        const carteAvversario = (mioRuolo === 'giocatore1') ? dati.giocatore2 : dati.giocatore1;

        disegnaManoReale(mieCarte);
        disegnaManoCoperta(carteAvversario);
        
        document.getElementById('deck-count').textContent = dati.mazzoCentrale ? dati.mazzoCentrale.length : 0;
        aggiornaScartiGrafica(dati.scarti);
        disegnaCalate(dati.calate);
        aggiornaChatGrafica(dati.chat);

        document.getElementById('pozzetto-1').style.visibility = dati.pozzetto1 ? 'visible' : 'hidden';
        document.getElementById('pozzetto-2').style.visibility = dati.pozzetto2 ? 'visible' : 'hidden';

        gestisciBottoni(dati.turnoDi, dati.faseTurno);
    });
}

// 6. MOTORE GRAFICO HTML E UI
function formattaCarta(carta) {
    if (carta.tipo === 'jolly') return '🃏 JOLLY';
    
    let simbolo = carta.seme === 'Cuori' ? '♥' : carta.seme === 'Quadri' ? '♦' : carta.seme === 'Fiori' ? '♣' : '♠';
    let nomeValore = carta.valore === 1 ? 'A' : carta.valore === 11 ? 'J' : carta.valore === 12 ? 'Q' : carta.valore === 13 ? 'K' : carta.valore;

    return `${nomeValore} ${simbolo}`;
}

// Memoria temporanea per ricordare quale carta hai toccato
// La memoria ora è un "Array" vuoto, in grado di ricordare più carte contemporaneamente
let indiciCarteSelezionate = [];

// NUOVA MEMORIA: Ricorda l'indice del gruppo a terra che hai cliccato
let indiceCalataSelezionata = null;

function disegnaManoReale(carte) {
    const div = document.getElementById('player-hand');
    div.innerHTML = '';
    if (!carte) return;
    
    carte.forEach((carta, index) => {
        const cDiv = document.createElement('div');
        cDiv.className = 'card';
        cDiv.textContent = formattaCarta(carta);
        if (carta.seme === 'Cuori' || carta.seme === 'Quadri') cDiv.style.color = '#e74c3c';
        
        // Se ridisegniamo il tavolo, teniamo accese di giallo le carte che avevi già selezionato
        if (indiciCarteSelezionate.includes(index)) {
            cDiv.classList.add('selected');
        }
        
        // NUOVO SENSORE: SELEZIONE MULTIPLA
        cDiv.addEventListener('click', () => {
            if (cDiv.classList.contains('selected')) {
                // Deseleziona: toglie il giallo e rimuove il numero dalla memoria
                cDiv.classList.remove('selected');
                indiciCarteSelezionate = indiciCarteSelezionate.filter(i => i !== index);
            } else {
                // Seleziona: aggiunge il giallo e aggiunge il numero alla memoria
                cDiv.classList.add('selected');
                indiciCarteSelezionate.push(index);
            }
            if (typeof aggiornaBottoniAzione === "function") aggiornaBottoniAzione();
        });

        div.appendChild(cDiv);
    });
}

function disegnaManoCoperta(carte) {
    const div = document.getElementById('opponent-hand');
    div.innerHTML = '';
    if (!carte) return;
    carte.forEach(() => {
        const cDiv = document.createElement('div');
        cDiv.className = 'card back';
        div.appendChild(cDiv);
    });
    document.getElementById('opponent-card-count').textContent = `(${carte.length} carte)`;
}

function aggiornaScartiGrafica(scarti) {
    const div = document.getElementById('discard-pile');
    if (scarti && scarti.length > 0) {
        const ultima = scarti[scarti.length - 1];
        div.className = 'card';
        div.textContent = formattaCarta(ultima);
        div.style.color = (ultima.seme === 'Cuori' || ultima.seme === 'Quadri') ? '#e74c3c' : 'black';
    } else {
        div.className = 'card placeholder';
        div.textContent = 'Scarti';
    }
}
function disegnaCalate(calate) {
    const contenitore = document.getElementById('calate-area');
    if (!contenitore) return;
    contenitore.innerHTML = ''; // Puliamo il tavolo prima di ridisegnarlo
    
    if (!calate || calate.length === 0) return;

    // Per ogni tris o scala che troviamo nel database...
    // NOTA: Ho aggiunto "indexGruppo" qui sotto per riconoscere quale colonna clicchi
    calate.forEach((gruppo, indexGruppo) => {
        // Creiamo una "colonna" invisibile per tenerle impilate
        const colonnaDiv = document.createElement('div');
        colonnaDiv.style.display = 'flex';
        colonnaDiv.style.flexDirection = 'column';
        
        // --- INIZIO MODIFICA PER IL CLICK ---
        colonnaDiv.className = 'calata-group';
        colonnaDiv.style.cursor = 'pointer'; 

        // Se la colonna era già selezionata, le rimettiamo la classe per illuminarla
        if (indiceCalataSelezionata === indexGruppo) {
            colonnaDiv.classList.add('selected-meld');
        }

        // Il sensore: cosa succede quando clicchi questa colonna a terra
        colonnaDiv.addEventListener('click', () => {
            // Spegne tutte le altre
            document.querySelectorAll('.calata-group').forEach(el => el.classList.remove('selected-meld'));

            if (indiceCalataSelezionata === indexGruppo) {
                // Se la rilicchi, si spegne
                colonnaDiv.classList.remove('selected-meld');
                indiceCalataSelezionata = null;
            } else {
                // Altrimenti si accende e se la ricorda
                colonnaDiv.classList.add('selected-meld');
                indiceCalataSelezionata = indexGruppo;
            }
            
            // Aggiorna i bottoni
            if (typeof aggiornaBottoniAzione === "function") aggiornaBottoniAzione();
        });
        // --- FINE MODIFICA PER IL CLICK ---

        // Disegniamo le singole carte di quel gruppo (intatto)
        gruppo.forEach((carta, index) => {
            const cDiv = document.createElement('div');
            cDiv.className = 'card';
            cDiv.textContent = formattaCarta(carta);
            if (carta.seme === 'Cuori' || carta.seme === 'Quadri') cDiv.style.color = '#e74c3c';
            
            // Effetto "a cascata": le carte si sormontano verticalmente lasciando leggere solo il numero
            if (index > 0) {
                cDiv.style.marginTop = '-50px'; 
            }
            
            colonnaDiv.appendChild(cDiv);
        });

        contenitore.appendChild(colonnaDiv);
    });
}

function gestisciBottoni(turnoDi, faseTurno) {
    const btnPesca = document.getElementById('btn-draw');
    const btnCala = document.getElementById('btn-meld');
    const btnScarta = document.getElementById('btn-discard');
    const btnChiudi = document.getElementById('btn-close-game');
    const btnAttacca = document.getElementById('btn-attach'); // Aggiunto il nuovo bottone!

    // Se la partita è finita, tutto congelato per sempre
    if (faseTurno === 'fine') {
        if(btnPesca) btnPesca.disabled = true;
        if(btnCala) btnCala.disabled = true;
        if(btnScarta) btnScarta.disabled = true;
        if(btnChiudi) btnChiudi.disabled = true;
        if(btnAttacca) btnAttacca.disabled = true; 
        return;
    }

    // Se non è il tuo turno, spegni tutto
    if (turnoDi !== mioRuolo) {
        if(btnPesca) btnPesca.disabled = true;
        if(btnCala) btnCala.disabled = true;
        if(btnScarta) btnScarta.disabled = true;
        if(btnChiudi) btnChiudi.disabled = true;
        if(btnAttacca) btnAttacca.disabled = true; 
        return;
    }

    // Gestione delle fasi del tuo turno
    if (faseTurno === 'pesca') {
        if(btnPesca) btnPesca.disabled = false;
        if(btnCala) btnCala.disabled = true;
        if(btnScarta) btnScarta.disabled = true;
        if(btnChiudi) btnChiudi.disabled = true;
        if(btnAttacca) btnAttacca.disabled = true; 
    } else if (faseTurno === 'scarto') {
        if(btnPesca) btnPesca.disabled = true;
        if(btnScarta) btnScarta.disabled = false;
        if(btnChiudi) btnChiudi.disabled = false;
        
        // DELEGA AL VIGILE URBANO:
        // Spegniamo Cala e Attacca. Si accenderanno da soli appena il giocatore seleziona le carte giuste.
        if(btnCala) btnCala.disabled = true;
        if(btnAttacca) btnAttacca.disabled = true; 
    }
}

// 7. INIZIALIZZAZIONE
avviaNuovaPartita();
ascoltaTavolo();

// 8. LOGICA DEI BOTTONI: PESCA
document.getElementById('btn-draw').addEventListener('click', () => {
    // 1. Leggiamo lo stato del tavolo in questo esatto millisecondo
    const stanzaRef = ref(db, 'stanza_principale');
    
    get(stanzaRef).then((snapshot) => {
        const dati = snapshot.val();
        if (!dati) return;

        // 2. Controllo di sicurezza: ci sono carte nel mazzo?
        if (!dati.mazzoCentrale || dati.mazzoCentrale.length === 0) {
            alert("Il mazzo centrale è esaurito!");
            return;
        }

        // 3. Preleviamo la prima carta dal mazzo
        const cartaPescata = dati.mazzoCentrale.pop();

        // 4. Mettiamola nella nostra mano in base a chi siamo
        if (mioRuolo === 'giocatore1') {
            // Se l'array giocatore1 per qualche motivo non esiste (es. avevamo 0 carte), lo creiamo
            if (!dati.giocatore1) dati.giocatore1 = []; 
            dati.giocatore1.push(cartaPescata);
        } else {
            if (!dati.giocatore2) dati.giocatore2 = [];
            dati.giocatore2.push(cartaPescata);
        }

        // 5. Cambiamo la fase del turno
        dati.faseTurno = 'scarto';

        // 6. Rimandiamo il tavolo aggiornato al cloud
        set(stanzaRef, dati)
            .then(() => console.log("Hai pescato una carta con successo."))
            .catch((err) => console.error("Errore durante la pesca:", err));
    });
});

// 9. LOGICA DEI BOTTONI: SCARTA
// 9. LOGICA DEI BOTTONI: SCARTA
document.getElementById('btn-discard').addEventListener('click', () => {
    // PROTEZIONE: Deve esserci ESATTAMENTE 1 carta selezionata
    if (indiciCarteSelezionate.length !== 1) {
        alert("Per scartare devi selezionare esattamente UNA sola carta!");
        return;
    }

    const stanzaRef = ref(db, 'stanza_principale');
    get(stanzaRef).then((snapshot) => {
        const dati = snapshot.val();
        if (!dati) return;

        let miaMano = (mioRuolo === 'giocatore1') ? dati.giocatore1 : dati.giocatore2;

        // Tagliamo l'unica carta presente nella memoria
        const indiceDaScartare = indiciCarteSelezionate[0];
        const cartaDaScartare = miaMano.splice(indiceDaScartare, 1)[0];

        if (!dati.scarti) dati.scarti = [];
        dati.scarti.push(cartaDaScartare);

        
        // Azzeriamo la memoria multipla
        indiciCarteSelezionate = [];

        // NUOVO: CONTROLLO POZZETTO CON SCARTO
        if (miaMano.length === 0) {
            if (dati.pozzetto1) {
                miaMano.push(...dati.pozzetto1);
                dati.pozzetto1 = null;
                if (mioRuolo === 'giocatore1') dati.presoPozzettoG1 = true; else dati.presoPozzettoG2 = true;
                alert("Hai preso il primo Pozzetto con lo scarto! Lo giocherai al prossimo turno.");
            } else if (dati.pozzetto2) {
                miaMano.push(...dati.pozzetto2);
                dati.pozzetto2 = null;
                if (mioRuolo === 'giocatore1') dati.presoPozzettoG1 = true; else dati.presoPozzettoG2 = true;
                alert("Hai preso il secondo Pozzetto con lo scarto! Lo giocherai al prossimo turno.");
            }
        }

        // Passaggio del turno (rimane invariato)
        dati.faseTurno = 'pesca';
        dati.turnoDi = (mioRuolo === 'giocatore1') ? 'giocatore2' : 'giocatore1';

        set(stanzaRef, dati)
            .then(() => console.log("Hai scartato e passato il turno."))
            .catch((err) => console.error("Errore scarto:", err));
    });
});

// 10. LOGICA DEI BOTTONI: RIORDINA MANO
document.getElementById('btn-sort').addEventListener('click', () => {
    const stanzaRef = ref(db, 'stanza_principale');
    
    // 1. Scattiamo una foto ai dati correnti
    get(stanzaRef).then((snapshot) => {
        const dati = snapshot.val();
        if (!dati) return;

        // 2. Prendiamo la nostra mano
        let miaMano = (mioRuolo === 'giocatore1') ? dati.giocatore1 : dati.giocatore2;
        
        // Se non abbiamo carte, fermiamo tutto
        if (!miaMano || miaMano.length === 0) return;

        // 3. LA MAPPA DEI PESI: Insegniamo al computer l'ordine di importanza
        const pesoSemi = { 
            'Cuori': 1, 
            'Quadri': 2, 
            'Fiori': 3, 
            'Picche': 4, 
            'Jolly': 5 // I Jolly finiscono sempre in fondo
        };

        // 4. L'ALGORITMO DI ORDINAMENTO (Doppio Filtro)
        miaMano.sort((cartaA, cartaB) => {
            // Se i semi sono diversi, vince il peso del seme
            if (pesoSemi[cartaA.seme] !== pesoSemi[cartaB.seme]) {
                return pesoSemi[cartaA.seme] - pesoSemi[cartaB.seme];
            }
            // Se i semi sono uguali (es. due Cuori), ordiniamo dal numero più piccolo al più grande
            return cartaA.valore - cartaB.valore;
        });

        // 5. Rimettiamo la mano ordinata nel suo cassetto e inviamo a Firebase
        if (mioRuolo === 'giocatore1') {
            dati.giocatore1 = miaMano;
        } else {
            dati.giocatore2 = miaMano;
        }

        set(stanzaRef, dati)
            .then(() => console.log("Mano riordinata e salvata con successo!"))
            .catch((err) => console.error("Errore di riordino:", err));
    });
});

// 11. IL CERVELLO MATEMATICO DELLE CALATE
// 11. IL CERVELLO MATEMATICO DELLE CALATE (Aggiornato per Asso Alto e Matte)
function validaCalata(carteScelte) {
    if (carteScelte.length < 3) return false;

    let matte = carteScelte.filter(c => c.tipo === 'jolly' || c.tipo === 'pinella');
    let naturali = carteScelte.filter(c => c.tipo === 'normale');

    if (matte.length > 1) return false;
    if (naturali.length === 0) return false;

    // Controllo TRIS
    let isTris = naturali.every(c => c.valore === naturali[0].valore);
    if (isTris) return true;

    // Controllo SCALA
    let isScala = naturali.every(c => c.seme === naturali[0].seme);
    if (isScala) {
        
        // Funzione interna per contare i buchi in una scala
        const contaBuchi = (carte) => {
            let sorted = [...carte].sort((a, b) => a.valore - b.valore);
            let buchi = 0;
            for (let i = 0; i < sorted.length - 1; i++) {
                let diff = sorted[i+1].valore - sorted[i].valore;
                if (diff === 0) return -1; // Errore: due carte identiche
                if (diff > 1) buchi += (diff - 1); // Contiamo i gradini mancanti
            }
            return buchi;
        };

        // 1° Tentativo: L'Asso vale 1 (A, 2, 3)
        let buchiBassi = contaBuchi(naturali);
        // NOTA: Qui c'è la correzione (<=) per far funzionare i Jolly all'estremità!
        if (buchiBassi !== -1 && buchiBassi <= matte.length) return true;

        // 2° Tentativo: Se c'è un Asso, proviamo a farlo valere 14 (Q, K, A)
        let haAsso = naturali.some(c => c.valore === 1);
        if (haAsso) {
            // Creiamo una copia temporanea dove l'Asso diventa 14
            let naturaliAssoAlto = naturali.map(c => c.valore === 1 ? { ...c, valore: 14 } : c);
            let buchiAlti = contaBuchi(naturaliAssoAlto);
            if (buchiAlti !== -1 && buchiAlti <= matte.length) return true;
        }
    }

    return false;
}
// 12. LOGICA DEI BOTTONI: CALA
document.getElementById('btn-meld').addEventListener('click', () => {
    if (indiciCarteSelezionate.length < 3) {
        alert("Devi selezionare almeno 3 carte per fare una calata!");
        return;
    }

    const stanzaRef = ref(db, 'stanza_principale');
    get(stanzaRef).then((snapshot) => {
        const dati = snapshot.val();
        if (!dati) return;

        let miaMano = (mioRuolo === 'giocatore1') ? dati.giocatore1 : dati.giocatore2;
        
        // 1. Leggiamo quali carte hai selezionato
        let carteDaCalare = [];
        indiciCarteSelezionate.forEach(indice => {
            carteDaCalare.push(miaMano[indice]);
        });

        // 2. Chiediamo al cervello se la combinazione è legale
        if (!validaCalata(carteDaCalare)) {
            alert("Mossa Illegale! Controlla di avere almeno 3 carte, con scale o tris validi (max 1 matta).");
            return;
        }

        // 3. Se legale, dobbiamo estrarle dalla mano in senso DECRESCENTE
        // (Se tagliamo prima l'indice 1, l'indice 5 diventa 4 e sbagliamo carta!)
        indiciCarteSelezionate.sort((a, b) => b - a);
        indiciCarteSelezionate.forEach(indice => {
            miaMano.splice(indice, 1);
        });

        // 4. Mettiamo le carte fisicamente sul tavolo
        if (!dati.calate) dati.calate = [];
        dati.calate.push(carteDaCalare); 

        // 5. Puliamo la memoria
        indiciCarteSelezionate = [];

        // 6. NUOVO: CONTROLLO POZZETTO AL VOLO
        if (miaMano.length === 0) {
            if (dati.pozzetto1) {
                miaMano.push(...dati.pozzetto1); // Travasa le 11 carte
                dati.pozzetto1 = null;
                if (mioRuolo === 'giocatore1') dati.presoPozzettoG1 = true; else dati.presoPozzettoG2 = true;           // Elimina il pozzetto 1 dal database
                alert("Hai preso il primo Pozzetto al volo! Puoi continuare a calare o scartare.");
            } else if (dati.pozzetto2) {
                miaMano.push(...dati.pozzetto2);
                dati.pozzetto2 = null;
                if (mioRuolo === 'giocatore1') dati.presoPozzettoG1 = true; else dati.presoPozzettoG2 = true;
                alert("Hai preso il secondo Pozzetto al volo! Puoi continuare a calare o scartare.");
            }
        }

        set(stanzaRef, dati)
            .then(() => console.log("Combinazione perfetta, carte calate sul tavolo!"))
            .catch((err) => console.error(err));
    });
});

// IL VIGILE URBANO DEI BOTTONI
function aggiornaBottoniAzione() {
    const btnCala = document.getElementById('btn-meld');
    const btnAttacca = document.getElementById('btn-attach');

    // Spegniamo entrambi di base
    if(btnCala) btnCala.disabled = true;
    if(btnAttacca) btnAttacca.disabled = true;

    // SCENARIO 1: Voglio ATTACCARE (Ho carte in mano e ho selezionato un gruppo a terra)
    if (indiciCarteSelezionate.length > 0 && indiceCalataSelezionata !== null) {
        if(btnAttacca) btnAttacca.disabled = false;
    } 
    // SCENARIO 2: Voglio CALARE (Ho almeno 3 carte in mano e NESSUN gruppo a terra selezionato)
    else if (indiciCarteSelezionate.length >= 3 && indiceCalataSelezionata === null) {
        if(btnCala) btnCala.disabled = false;
    }
}

// IL CERVELLO MATEMATICO DELL'ATTACCO
function isAttaccoValido(gruppoEsistente, carteDaAggiungere) {
    // Uniamo virtualmente le carte a terra con quelle nuove selezionate dalla mano
    let gruppoUnito = [...gruppoEsistente, ...carteDaAggiungere];
    
    // Sfruttiamo il tuo validatore già esistente per controllare se il gruppo finale è legale!
    return validaCalata(gruppoUnito);
}

// --- FINE PATCH ---


// 12.5 LOGICA DEI BOTTONI: ATTACCA
document.getElementById('btn-attach').addEventListener('click', () => {
    // 1. Controlli di base
    if (indiciCarteSelezionate.length === 0 || indiceCalataSelezionata === null) {
        alert("Devi selezionare almeno una carta dalla mano e un gruppo a terra!");
        return;
    }

    const stanzaRef = ref(db, 'stanza_principale');
    get(stanzaRef).then((snapshot) => {
        const dati = snapshot.val();
        if (!dati) return;

        let miaMano = (mioRuolo === 'giocatore1') ? dati.giocatore1 : dati.giocatore2;
        let gruppoBersaglio = dati.calate[indiceCalataSelezionata];

        // 2. Leggiamo quali carte hai selezionato
        let carteDaAttaccare = [];
        indiciCarteSelezionate.forEach(indice => {
            carteDaAttaccare.push(miaMano[indice]);
        });

        // 3. Chiediamo al cervello matematico se l'aggancio è legale
        if (!isAttaccoValido(gruppoBersaglio, carteDaAttaccare)) {
            alert("Mossa Illegale! Le carte non rispettano la scala o la combinazione (ricorda: max 1 matta).");
            return;
        }

        // 4. Se legale, estraiamo le carte dalla mano (in ordine decrescente!)
        indiciCarteSelezionate.sort((a, b) => b - a);
        indiciCarteSelezionate.forEach(indice => {
            miaMano.splice(indice, 1);
        });

        // 5. Inseriamo le carte nel gruppo a terra
        gruppoBersaglio.push(...carteDaAttaccare);

        // 6. RIORDINO DEL GRUPPO A TERRA (Fondamentale!)
        const pesoSemi = { 'Cuori': 1, 'Quadri': 2, 'Fiori': 3, 'Picche': 4, 'Jolly': 5 };
        gruppoBersaglio.sort((cartaA, cartaB) => {
            if (pesoSemi[cartaA.seme] !== pesoSemi[cartaB.seme]) {
                return pesoSemi[cartaA.seme] - pesoSemi[cartaB.seme];
            }
            return cartaA.valore - cartaB.valore;
        });

        // 7. Pulizia memorie e bottoni
        indiciCarteSelezionate = [];
        indiceCalataSelezionata = null;
        aggiornaBottoniAzione(); // Spegne i bottoni

        // 8. CONTROLLO POZZETTO AL VOLO
        if (miaMano.length === 0) {
            if (dati.pozzetto1) {
                miaMano.push(...dati.pozzetto1);
                dati.pozzetto1 = null;
                if (mioRuolo === 'giocatore1') dati.presoPozzettoG1 = true; else dati.presoPozzettoG2 = true;
                alert("Hai preso il primo Pozzetto al volo! Puoi continuare a giocare.");
            } else if (dati.pozzetto2) {
                miaMano.push(...dati.pozzetto2);
                dati.pozzetto2 = null;
                if (mioRuolo === 'giocatore1') dati.presoPozzettoG1 = true; else dati.presoPozzettoG2 = true;
                alert("Hai preso il secondo Pozzetto al volo! Puoi continuare a giocare.");
            }
        }

        // 9. Salviamo sul Database
        set(stanzaRef, dati)
            .then(() => console.log("Carte attaccate con successo!"))
            .catch((err) => console.error(err));
    });
});


// 13. LA CALCOLATRICE DEI PUNTI
function calcolaPunteggio(carte) {
    if (!carte || carte.length === 0) return 0;
    let totale = 0;
    
    carte.forEach(c => {
        if (c.tipo === 'jolly') totale += 30;
        else if (c.valore === 2) totale += 20; // Pinella
        else if (c.valore === 1) totale += 15; // Asso
        else if (c.valore >= 8 && c.valore <= 13) totale += 10;
        else if (c.valore >= 3 && c.valore <= 7) totale += 5;
    });
    return totale;
}

// 14. LOGICA DEI BOTTONI: CHIUDI PARTITA
// 14. LOGICA DEI BOTTONI: CHIUDI PARTITA (Aggiornato con Regole Reali)
document.getElementById('btn-close-game').addEventListener('click', () => {
    const stanzaRef = ref(db, 'stanza_principale');
    
    get(stanzaRef).then((snapshot) => {
        const dati = snapshot.val();
        if (!dati) return;

        let miaMano = (mioRuolo === 'giocatore1') ? dati.giocatore1 : dati.giocatore2;
        let manoAvversario = (mioRuolo === 'giocatore1') ? dati.giocatore2 : dati.giocatore1;

        // 1. Controllo Zero Carte
        if (miaMano && miaMano.length > 0) {
            alert("Mossa illegale! Per dichiarare la chiusura devi non avere carte in mano.");
            return;
        }

        // 2. Controllo Pozzetto
        let hoPresoPozzetto = (mioRuolo === 'giocatore1') ? dati.presoPozzettoG1 : dati.presoPozzettoG2;
        if (!hoPresoPozzetto) {
            alert("Mossa illegale! Non puoi chiudere se non hai prima preso il Pozzetto.");
            return;
        }

        // 3. Controllo Canasta e Calcolo Punti
        let hoCanasta = false;
        let mieiPuntiTerra = 0;
        
        if (dati.calate) {
            dati.calate.forEach(gruppo => {
                mieiPuntiTerra += calcolaPunteggio(gruppo);
                // Se la calata ha 7 o più carte, è una Canasta!
                if (gruppo.length >= 7) {
                    mieiPuntiTerra += 100; // Bonus Canasta Base
                    hoCanasta = true; 
                }
            });
        }

        if (!hoCanasta) {
            alert("Mossa illegale! Devi avere almeno una Canasta (7 o più carte) a terra per chiudere.");
            return;
        }

        // 4. Se tutti i controlli sono passati, la chiusura è valida!
        let mioPunteggioFinale = mieiPuntiTerra + 100; // +100 punti per chi ha chiuso
        let puntiMenoAvversario = calcolaPunteggio(manoAvversario);
        
        dati.faseTurno = 'fine'; // Blocchiamo il tavolo

        set(stanzaRef, dati).then(() => {
            alert(`🏆 PARTITA CONCLUSA! 🏆\nHai chiuso e totalizzato: ${mioPunteggioFinale} punti positivi.\nL'avversario ha ${puntiMenoAvversario} punti negativi in mano.`);
        });
    });
});

// Mostra o nasconde la chat quando clicchi sul bottone in basso
// Mostra o nasconde la chat quando clicchi sul bottone in basso
document.getElementById('btn-toggle-chat').addEventListener('click', () => {
    const chatContainer = document.getElementById('chat-container');
    const btnChat = document.getElementById('btn-toggle-chat');
    
    chatContainer.classList.toggle('hidden');

    // SEPARAZIONE DELLE COMPETENZE: Rimuoviamo solo la classe di stato
    if (!chatContainer.classList.contains('hidden')) {
        btnChat.classList.remove('nuovo-messaggio');
    }
});

// Invia il messaggio quando clicchi sul bottone "Invia"
document.getElementById('btn-send-chat').addEventListener('click', inviaMessaggioChat);

// Invia il messaggio anche se premi il tasto "Invio" sulla tastiera fisica
document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') inviaMessaggioChat();
});

function inviaMessaggioChat() {
    const input = document.getElementById('chat-input');
    const testo = input.value.trim();
    if (!testo) return; // Se l'input è vuoto, non fare nulla

    const stanzaRef = ref(db, 'stanza_principale');
    get(stanzaRef).then((snapshot) => {
        const dati = snapshot.val();
        if (!dati) return;

        if (!dati.chat) dati.chat = [];

        // Identifichiamo chi sta scrivendo per mettergli l'etichetta corretta
        const firma = (mioRuolo === 'giocatore1') ? "G1" : "G2";
        
        dati.chat.push(`[${firma}]: ${testo}`);
        input.value = ''; // Svuota la barra di scrittura

        set(stanzaRef, dati);
    });
}

function aggiornaChatGrafica(chat) {
    const div = document.getElementById('chat-messages');
    if (!div) return;
    
    // Contiamo quanti messaggi ci sono visibili PRIMA di aggiornare
    const numeroMessaggiPrecedenti = div.childElementCount; 
    
    div.innerHTML = ''; // Svuotiamo i vecchi messaggi

    if (!chat) return;

    chat.forEach(msg => {
        const p = document.createElement('p');
        p.textContent = msg;
        p.style.margin = '5px 0';
        p.style.borderBottom = '1px dashed #eee';
        div.appendChild(p);
    });

    // Costringe la chat a scorrere da sola verso il basso
    div.scrollTop = div.scrollHeight;

    const chatContainer = document.getElementById('chat-container');
    const btnChat = document.getElementById('btn-toggle-chat');

    // SEPARAZIONE DELLE COMPETENZE: Il JS aggiunge solo la classe di stato.
    // Sarà poi il CSS a decidere come mostrare il punto esclamativo e il colore rosso.
    if (chat.length > numeroMessaggiPrecedenti && chatContainer.classList.contains('hidden')) {
        btnChat.classList.add('nuovo-messaggio');
    }
}


// 16. LOGICA DEL BOTTONE: RIAVVIA PARTITA (Con Consenso)
document.getElementById('btn-restart-game').addEventListener('click', () => {
    const stanzaRef = ref(db, 'stanza_principale');
    
    get(stanzaRef).then((snapshot) => {
        const dati = snapshot.val();
        if (!dati) return;

        // Invece di resettare, piazziamo una "bandierina" di richiesta
        dati.richiestaRiavvio = mioRuolo;

        set(stanzaRef, dati).then(() => {
            alert("Richiesta inviata! Attendi che l'avversario accetti.");
        });
    });
});