# electron-upgrade — plan: debito moduli nativi (prerequisito ai gradini Electron)

## Perché questo plan esiste

Scoperto empiricamente durante il tentativo di gradino 1 (39→40, 2026-07-07): `npm run rebuild-native`
fallisce perché `native-keymap@3.3.9` (latest reale) non compila contro la V8 di Electron 40
(`error C4996: v8::Object::GetAlignedPointerFromInternalField ... use ... EmbedderDataTypeTag`).
L'upgrade Electron NON è bloccato da un warning isolato: è bloccato dallo **stato dei moduli nativi
di terze parti**, che vanno ricompilati contro la V8 di ogni major.

## Principio (deciso con l'utente 2026-07-07)

Portare il codice a usare il **più possibile API native di Electron** (integrate, mantenute dal team
Electron, zero ricompilazione) al posto di **addon C++ esterni** (legati alla V8, tassa a ogni major),
**senza perdere funzionalità** e **senza forzature**. Obiettivo = miglior compromesso
complessità / natività / funzionalità, valutato caso per caso (non "rimuovere tutto ciò che è nativo").

Distinzione chiave:
- **Addon nativo esterno** (keytar, native-keymap, ced): C++ di terzi, ricompilato contro la V8 di
  Electron → si rompe quando la V8 cambia API. È la tassa da ridurre.
- **API nativa di Electron** (safeStorage, ecc.): dentro Electron, mantenuta da loro, nessun addon
  da compilare → solida e senza dipendenze. È il bersaglio verso cui spostarsi.
- **Binario prebuilt** (@vscode/ripgrep): eseguibile esterno, NON addon V8 → non soffre la tassa,
  si lascia com'è.

## Inventario e verdetto per dipendenza

| Modulo | Tipo | Uso nel progetto | Stato upstream | Alternativa nativa Electron | Verdetto |
|--------|------|------------------|----------------|------------------------------|----------|
| **keytar** ^7.9.0 | addon C++ | `dataCenter/index.js`: `getPassword/setPassword` (secret uploader immagini) | **ARCHIVIATO 2023, morto** | **safeStorage** (crittografia legata all'utente OS) | **SOSTITUIRE** (valore alto, addon morto) |
| **native-keymap** ^3.3.9 | addon C++ | `keyboard/index.js`: `getKeyMap`, `getCurrentKeyboardLayout`, `onDidChangeKeyboardLayout` (scorciatoie consapevoli del layout) | vivo ma segue l'Electron di VS Code (indietro) | **nessuna** (Electron non espone il keymap) | **TENERE + fix al sorgente** |
| **ced** ^2.0.0 | addon C++ | rilevamento charset all'apertura file | vivo, compila ora | jschardet/chardet (puro JS) | **VALUTARE, non ora** (tradeoff qualità) |
| **@vscode/ripgrep** ^1.17.0 | binario prebuilt | ricerca file | vivo | — (non è addon V8) | **LASCIARE** (nessuna tassa) |

## Task nativi (da fare PRIMA o INSIEME ai gradini Electron)

### N1 — keytar → safeStorage (SOSTITUZIONE, priorità alta)
- **Cosa fa keytar oggi**: salva/legge secret nel keychain OS (Windows Credential Manager, macOS
  Keychain, libsecret su Linux). In `dataCenter/index.js` (3 call: 2 get, 1 set).
- **safeStorage** (API Electron): `safeStorage.encryptString(str)` → Buffer cifrato con chiave
  fornita dall'OS; `safeStorage.decryptString(buf)`. NON è un keychain: **tu** persisti il blob
  cifrato (es. nel file di config in userData). Modello diverso ma sicurezza equivalente per l'uso
  di MarkText (token uploader legati all'utente OS).
- **Compromesso**: piccola migrazione, elimina un addon nativo **morto** → alta priorità, basso
  rischio. Da gestire:
  - Persistenza del blob cifrato (dove: config esistente in `dataCenter`).
  - **Linux**: `safeStorage.isEncryptionAvailable()` può essere false senza backend (libsecret) →
    degradare con grazia (feature secret disabilitata o fallback), non crashare.
  - **Migrazione dati esistenti**: al primo avvio dopo l'update, se esiste un secret in keytar,
    leggerlo una volta, ri-cifrarlo con safeStorage, poi si può rimuovere keytar. (Valutare se vale
    la migrazione o se si accetta il re-inserimento del token da parte dell'utente — decisione da
    prendere con l'utente prima di implementare.)
- **Esito atteso**: keytar rimosso da `dependencies` → un addon nativo in meno da ricompilare a
  ogni major.
- **Fonte da consultare prima**: doc Electron `safeStorage` (verificare API e caveat Linux al
  momento dell'implementazione).

### N2 — native-keymap: fix al sorgente (NON sopprimere) — sblocca la compilazione su 40+
- **Fix corretto**: aggiornare `keymapping.cc` (call a `GetAlignedPointerFromInternalField` ~righe
  564/581 dell'header V8) alla firma nuova **con `EmbedderDataTypeTag`**, protetta da `#if` sulla
  versione V8 così compila sia su Electron vecchi sia nuovi. Idealmente **PR upstream**
  (`microsoft/node-native-keymap`); nel frattempo portare la patch con **patch-package**.
- **NON** la soppressione `/wd4996`: quella nasconde il warning ma continua a usare l'API
  deprecata → se un Electron futuro la **rimuove**, hard fail. Accettabile SOLO come stampella
  temporanea per un test rapido, non come soluzione.
- **Compromesso**: native-keymap non è sostituibile con API Electron (il keymap non è esposto) →
  l'unica strada "nativa Electron" non esiste. Si tiene il modulo e si fa il fix minimo corretto.
  Se e quando esce una native-keymap con supporto V8 aggiornato, si rimuove la patch.
- **Prerequisito reale**: senza N2 (o la stampella) il gradino 1 (39→40) non compila. N2 è
  **bloccante** per tutti i gradini Electron.

### N3 — ced → detector charset JS (VALUTARE, non urgente)
- **Cosa fa ced**: rileva l'encoding all'apertura di file non-UTF-8.
- **Alternativa**: jschardet/chardet puro JS → elimina un addon nativo.
- **Compromesso onesto**: ced (detector di Chrome) è generalmente **più accurato** dei detector JS
  su encoding legacy anomali. Per un editor markdown la maggior parte dei file è UTF-8 → l'impatto
  è sui casi limite. ced **compila ancora** (non è il blocco attuale) → **bassa priorità**: farlo
  solo se in un major futuro ced diventa un blocco di compilazione, o se si vuole ridurre la
  superficie nativa accettando un detector meno accurato. Decisione da prendere con l'utente.

### N4 — @vscode/ripgrep: nessuna azione
- Binario prebuilt, non addon V8 → non soffre la tassa. Lasciare com'è.

## Ordine consigliato rispetto ai gradini Electron

1. **N1 (keytar→safeStorage)** su Electron **39** (ambiente stabile, nessun rischio V8) → elimina
   un addon morto prima di muovere Electron.
2. **N2 (native-keymap source fix)** → sblocca la compilazione su 40+. Bloccante per il gradino 1.
3. Poi i **gradini Electron 39→40→41→42→43** (plan task1 + task2-4), ora che lo stack nativo regge.
4. **N3 (ced)** eventuale, solo se serve, in qualsiasi momento (indipendente).

## Note di metodo

- Ogni task nativo = ricerca fonte (doc Electron / repo upstream) PRIMA di implementare, poi
  eventuale Agent-Code con gate (riepilogo + OK + istruzioni su file, DECISIONS.md 2026-07-03).
- Build/rebuild/test **solo sul PC principale** (Group Policy blocca qui).
- Nessuna forzatura: se una sostituzione richiede codice fragile o perde funzionalità (es. ced che
  degrada troppo la detection), segnalare il compromesso e fermarsi, non forzare.
