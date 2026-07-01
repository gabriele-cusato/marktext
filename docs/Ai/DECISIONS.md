## 2026-07-01 — Version control consentito

- Consentito usare `git` solo per verifiche operative dopo Agent-Code: `status`, `diff`, elenco file modificati e ispezione patch contro plan.
- Vietati commit, amend, push, pull, rebase, merge o altre operazioni che modificano storia/stato remoto, salvo richiesta esplicita futura dell'utente.

## 2026-07-02 — drag-html5-dnd: gate task1 FAIL, Strada B scartata

- Test manuale spike task1 (`docs/Ai/InProgress/drag-html5-dnd/drag-html5-dnd-task1-worklog.md`): `draggable="true"` su `.v2-tab` NON produce `dragstart` quando l'ancestor `.v2-tabbar` ha `-webkit-app-region: drag` — il window-drag OS intercetta il gesto anche con `no-drag` sul figlio. Rischio #1 di `DRAG-TASK.md §3` confermato reale, non un bug di configurazione (verificato: nessun hook custom tipo `WM_NCHITTEST`, CSS `no-drag` applicato correttamente in cascata).
- Utente ha scartato esplicitamente la "Strada B" (`DRAG-TASK.md §3bis`: restare su dragula + raise-finestre koffi). Non riproporla come opzione nelle prossime sessioni salvo che l'utente la richieda di nuovo esplicitamente.
- Da valutare come prossimo passo (NON iniziato, rimandato a sessione futura su richiesta esplicita dell'utente): mitigazione alternativa — sostituire `-webkit-app-region: drag` sulla tabbar con drag finestra gestito via JS (mousedown+move → IPC → `win.setPosition` manuale lato main), così nessun ancestor ha più `app-region:drag` e `draggable` sui tab dovrebbe poter funzionare liberamente. Richiede ricerca online prima di implementare (pattern non ancora verificato su Electron 39/Windows) e un nuovo spike dedicato prima di riprendere task2-5 della feature `drag-html5-dnd`.
- Finché questa valutazione non è fatta, i task2-5 di `drag-html5-dnd` restano bloccati (gate task1 non superato).
