const { createApp, ref } = Vue;

createApp({
    setup() {
        // --- GESTIONE LOGIN ---
        const currentRole = ref(null);

        
        function impostaRuolo(ruolo) {
            currentRole.value = ruolo; // Imposta utente (Pubblico Generico o Specialista)
            genStep.value = 0; // Reset Step Pubblico Generico
            specStep.value = 0; // Reset Step Specialista
            trasporti.value = [];
            alloggi.value = [];
            attrazioni.value = [];
            itinerari.value = [];
            specItinerariTrovati.value = [];
        }

        function logout() {
            currentRole.value = null;
        }

        // --- STATO APPLICAZIONE PUBBLICO GENERICO ---
        const genStep = ref(0); // Step interfaccia -> 0: Ricerca, 1: Trasporti, 2: Alloggi, 3: Attrazioni, 4: Itinerari
        const partenza = ref(''); 
        const destinazione = ref(''); 
        const filtroTipologia = ref('Hotel'); // Default filtro tipologia alloggi
        const filtroOspiti = ref(2); 
        const filtroCategoriaAttrazione = ref('Tutte');

        // Array per memorizzare i risultati delle query SPARQL
        const trasporti = ref([]); 
        const alloggi = ref([]);
        const attrazioni = ref([]);
        const itinerari = ref([]);
        
        // Variabile per gestire lo stato di successo dell'aggiornamento
        const updateSuccess = ref(false);
        // --- FINE STATO APPLICAZIONE PUBBLICO GENERICO ---

        // --- STATO APPLICAZIONE SPECIALISTA  ---
        const specStep = ref(0); // Step interfaccia -> 0: Ricerca, 1: Itinerari, 2: Attrazioni, 3: Alloggi, 4: Trasporti
        const specDestinazione = ref('');
        const specTappeMinime = ref(); 
        const specPartenza = ref('');
        const specScopo = ref('Cultura'); // Default scopo itinerario
        
        // Array per memorizzare i risultati delle query SPARQL
        const specItinerariTrovati = ref([]);
        const specItinerarioSelezionato = ref(null);
        const specAttrazioniTrovate = ref([]); 
        const specAlloggioTrovato = ref(null); 
        const specTrasportiTrovati = ref([]);
        // --- FINE STATO APPLICAZIONE SPECIALISTA  ---

        // --- COSTANTI GRAPHDB (tramite PROXY poiché il browser blocca la richiesta a localhost: Errore CORS) ---
        const REPO_NAME = 'ModSem'; 
        const GRAPHDB_ENDPOINT = `/proxy-graphdb/repositories/${REPO_NAME}`;
        
        const PREFIXES = `
            PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX : <http://www.semanticweb.org/matteo/ontologies/2026/turismo-mobilita/>
        `;

        // Funzione generica per eseguire query SPARQL e gestire errori
        async function executeSPARQL(query) {
            try {
                const response = await fetch(GRAPHDB_ENDPOINT, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/sparql-query',
                        'Accept': 'application/sparql-results+json'
                    },
                    body: query
                });
                
                if (!response.ok) throw new Error("Errore nella richiesta SPARQL");
                const data = await response.json();
                return data.results.bindings;
            } catch (error) {
                console.error("Errore:", error);
                alert("Impossibile connettersi al database GraphDB.");
                return [];
            }
        }

        // --- QUERIES PUBBLICO GENERICO ---

        // QUERY 1: Funzione per cercare trasporti in base alla partenza e destinazione
        async function cercaTrasporti() {
            const query = `
                ${PREFIXES}
                SELECT ?Mezzo ?Partenza ?Arrivo ?Compagnia
                WHERE {
                    ?mezzo :haPuntoPartenza ?stazionePartenza .
                    ?mezzo :haPuntoArrivo ?stazioneArrivo .
                    ?mezzo :fornitoDa ?compagnia .
                    ?stazionePartenza :haSede :${partenza.value} .
                    ?stazioneArrivo :haSede :${destinazione.value} .
                    ?mezzo rdfs:label ?Mezzo .
                    ?stazionePartenza rdfs:label ?Partenza .
                    ?stazioneArrivo rdfs:label ?Arrivo .
                    ?compagnia rdfs:label ?Compagnia .
                }
            `;
            trasporti.value = await executeSPARQL(query);
            genStep.value = 1; // Sposta la UI allo step Trasporti
        }

        // QUERY 2: Funzione per cercare alloggi in base alla destinazione, tipologia e numero di ospiti
        async function cercaAlloggi() {
            const query = `
                ${PREFIXES}
                SELECT ?Alloggio ?Stelle ?Ospiti ?Prezzo
                WHERE {
                    ?alloggio :haSede :${destinazione.value} .
                    VALUES ?tipologia { :${filtroTipologia.value} }
                    ?alloggio rdf:type ?tipologia .
                    ?alloggio :haNumeroStelle ?Stelle .
                    ?alloggio :capacitaOspiti ?Ospiti .
                    ?alloggio :haPrezzo ?Prezzo .
                    ?alloggio rdfs:label ?Alloggio .
                    FILTER (?Ospiti >= ${filtroOspiti.value})
                }
                ORDER BY DESC(?Stelle) ASC(?Prezzo)
            `;
            alloggi.value = await executeSPARQL(query);
            genStep.value = 2; // Sposta la UI allo step Alloggi
        }

        // QUERY 3 - 4: Funzione per cercare attrazioni in base al filtro categoria e alla destinazione
        async function cercaAttrazioni() {
            let query = "";
            if (filtroCategoriaAttrazione.value === 'Cultura') {
                query = `
                    ${PREFIXES}
                    SELECT DISTINCT ?nomeAttrazione ?anno ?prezzo
                    WHERE {
                        ?attrazione :haSede :${destinazione.value} .
                        VALUES ?tipoAttrazione { :Monumento :Museo }
                        ?attrazione rdf:type ?tipoAttrazione .
                        ?attrazione rdfs:label ?nomeAttrazione .
                        OPTIONAL { ?attrazione :annoCostruzione ?anno . }
                        OPTIONAL { ?attrazione :haPrezzo ?prezzo . }
                    }
                    ORDER BY ?nomeAttrazione
                `;
            } else {
                query = `
                    ${PREFIXES}
                    SELECT DISTINCT ?nomeAttrazione ?anno ?prezzo
                    WHERE {
                        ?attrazione :haSede :${destinazione.value} .
                        ?attrazione rdf:type :AttrazioneTuristica .
                        ?attrazione rdfs:label ?nomeAttrazione .
                        OPTIONAL { ?attrazione :annoCostruzione ?anno . }
                        OPTIONAL { ?attrazione :haPrezzo ?prezzo . }
                    }
                    ORDER BY ?nomeAttrazione
                `;
            }
            attrazioni.value = await executeSPARQL(query);
            genStep.value = 3; // Sposta la UI allo step Attrazioni
        }
        
        // QUERY 5: Funzione per cercare itinerari in base alla destinazione
        async function cercaItinerari() {
            const query = `
                ${PREFIXES}
                SELECT DISTINCT ?nomeItinerario (COUNT(?tappa) AS ?numeroTappe)
                WHERE {
                    ?itinerario rdf:type :Itinerario .
                    ?itinerario rdfs:label ?nomeItinerario .
                    ?itinerario :haTappa ?alloggio .
                    ?alloggio rdf:type :StrutturaRicettiva .
                    ?alloggio :haSede :${destinazione.value} .
                    ?itinerario :haTappa ?tappa .
                    FILTER NOT EXISTS { 
                        ?itinerario :haTappa ?altraAttrazione .
                        ?altraAttrazione rdf:type :AttrazioneTuristica .
                        FILTER NOT EXISTS { ?altraAttrazione rdf:type :Monumento }
                        FILTER NOT EXISTS { ?altraAttrazione rdf:type :Museo }
                    }
                }
                GROUP BY ?itinerario ?nomeItinerario
            `;
            itinerari.value = await executeSPARQL(query);
            genStep.value = 4; // Sposta la UI al risultato finale
        }

        // --- QUERIES SPECIALISTA ---

        // QUERY 1: Funzione per cercare itinerari in base allo scopo e al numero minimo di tappe
        async function cercaItinerariSpecialista() {
            const classeItinerario = `Itinerario${specScopo.value}`;
            const query = `
                ${PREFIXES}
                SELECT ?nomeItinerario (COUNT(?tappa) AS ?numeroTappe) ?itinerario
                WHERE {
                    ?itinerario rdf:type :${classeItinerario} . 
                    ?itinerario :haTappa ?tappa .
                    ?itinerario rdfs:label ?nomeItinerario .
                }
                GROUP BY ?itinerario ?nomeItinerario
                HAVING (COUNT(?tappa) >= ${specTappeMinime.value})
                ORDER BY DESC(?numeroTappe)
            `;
            specItinerariTrovati.value = await executeSPARQL(query);
            specStep.value = 1; //Sposta la UI allo step Itinerari
        }

        // QUERY 2: Funzione per scoprire le attrazioni di un itinerario selezionato 
        async function esploraItinerario(itinerarioScelto) {
            specItinerarioSelezionato.value = itinerarioScelto;
            const uriItinerario = itinerarioScelto.itinerario.value;
            const query = `
                ${PREFIXES}
                SELECT DISTINCT ?nomeAttrazione ?anno ?prezzo
                WHERE {
                    <${uriItinerario}> :haTappa ?attrazione .
                    ?attrazione rdf:type :AttrazioneTuristica .
                    ?attrazione rdfs:label ?nomeAttrazione .
                    OPTIONAL { ?attrazione :annoCostruzione ?anno . }
                    OPTIONAL { ?attrazione :haPrezzo ?prezzo . }
                }
                ORDER BY ?nomeAttrazione
            `;
            specAttrazioniTrovate.value = await executeSPARQL(query);
            specStep.value = 2; // Sposta la UI allo step Attrazioni
        }

        // QUERY 3: Funzione per scoprire l'alloggio di un itinerario selezionato
        async function esploraAlloggio() {
            const uriItinerario = specItinerarioSelezionato.value.itinerario.value;
            const query = `
                ${PREFIXES}
                SELECT ?nomeAlloggio ?stelle ?prezzo
                WHERE {
                    <${uriItinerario}> :haTappa ?alloggio .
                    ?alloggio rdf:type :StrutturaRicettiva .
                    ?alloggio rdfs:label ?nomeAlloggio .
                    OPTIONAL { ?alloggio :haNumeroStelle ?stelle . }
                    OPTIONAL { ?alloggio :haPrezzo ?prezzo . }
                }
            `;
            const risultati = await executeSPARQL(query);
            if (risultati.length > 0) specAlloggioTrovato.value = risultati[0]; 
            specStep.value = 3; // Sposta la UI allo step Alloggi
        }

        // QUERY 4: Funzione per scoprire i trasporti di un itinerario selezionato
        async function esploraTrasporti() {
            const uriItinerario = specItinerarioSelezionato.value.itinerario.value;
            const query = `
                ${PREFIXES}
                SELECT DISTINCT ?nomeMezzo ?nomePartenza ?nomeArrivo ?nomeCompagnia
                WHERE {
                    <${uriItinerario}> :haTappa ?tappa .
                    ?tappa rdf:type :StrutturaRicettiva .
                    ?tappa :haSede ?cittaDestinazione .
                    ?mezzo :haPuntoPartenza ?stazionePartenza .
                    ?mezzo :haPuntoArrivo ?stazioneArrivo .
                    ?mezzo :fornitoDa ?compagnia .
                    ?stazionePartenza :haSede :${specPartenza.value} .
                    ?stazioneArrivo :haSede ?cittaDestinazione .
                    ?mezzo rdfs:label ?nomeMezzo .
                    ?stazionePartenza rdfs:label ?nomePartenza .
                    ?stazioneArrivo rdfs:label ?nomeArrivo .
                    ?compagnia rdfs:label ?nomeCompagnia .
                }
            `;
            specTrasportiTrovati.value = await executeSPARQL(query);
            specStep.value = 4; // Sposta la UI allo step Trasporti
        }

        // Ritorna le variabili e le funzioni per l'uso nel template Vue
        return {
            // --- GESTIONE LOGIN ---
            currentRole, impostaRuolo, logout,
            
            // --- STATO PUBBLICO GENERICO ---
            genStep, partenza, destinazione, 
            filtroTipologia, filtroOspiti, filtroCategoriaAttrazione,
            trasporti, alloggi, attrazioni, itinerari, updateSuccess,
            cercaTrasporti, cercaAlloggi, cercaAttrazioni, cercaItinerari,
            
            // --- STATO SPECIALISTA ---
            specDestinazione, specTappeMinime, specScopo, specItinerariTrovati,
            specItinerarioSelezionato, specAttrazioniTrovate,
            specStep, specAlloggioTrovato, 
            specPartenza, specTrasportiTrovati,
            cercaItinerariSpecialista, esploraItinerario, esploraAlloggio, esploraTrasporti
        }
    }
}).mount('#app');