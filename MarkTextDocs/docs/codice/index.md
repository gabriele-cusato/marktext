# Codice sorgente — esempio snippet

Questa pagina dimostra il meccanismo chiave del "docs as code": **includere codice
reale dal repository senza copia-incolla**. Quando il sorgente cambia, alla prossima
generazione del sito la pagina è già aggiornata.

## Come funziona

Nel file Markdown si scrive una riga speciale invece di incollare il codice:

```text
--8<-- "src/main/index.js:1:24"
```

- `--8<--` è il marcatore dell'estensione `pymdownx.snippets`.
- Il percorso è relativo a `base_path` (in `mkdocs.yml` → `..`, cioè la root del repo).
- `:1:24` è opzionale e seleziona solo le righe **1–24** del file.

## Risultato: entry point reale (`src/main/index.js`)

Sotto c'è il contenuto **vero** del file, preso live dal repository:

```javascript title="src/main/index.js (righe 1-24)"
--8<-- "src/main/index.js:1:24"
```

!!! tip "Prova tu"
    Modifica `src/main/index.js` nel repo, salva, e ricarica questa pagina con
    `mkdocs serve` attivo: il blocco qui sopra cambia da solo.

## Livelli di approfondimento sullo stesso pezzo

=== "Per il cliente"
    L'avvio dell'app prepara logging e gestione degli errori prima di tutto il resto,
    così un eventuale crash iniziale viene registrato.

=== "Per lo sviluppatore esterno"
    `setupExceptionHandler()` e `initializeLogger()` vengono invocati per primi in
    `src/main/index.js`; `log.transports.file.resolvePathFn` instrada i log del renderer
    su file separati per `browserWindow.id`.

=== "Codice"
    ```javascript
    --8<-- "src/main/index.js:1:24"
    ```
