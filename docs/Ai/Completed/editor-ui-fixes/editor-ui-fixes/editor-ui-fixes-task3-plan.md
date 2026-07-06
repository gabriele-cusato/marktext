# editor-ui-fixes — task3 — plan: quick-insert "@" — risultati bloccati dopo la prima ricerca

## Obiettivo
Il menu quick-insert (@) deve mostrare di nuovo l'elenco completo quando si cancella la ricerca o si ripreme @ altrove; oggi resta bloccato sull'ultimo sottoinsieme filtrato e si restringe progressivamente.

## Prerequisiti bloccanti
- Questo plan e il worklog `editor-ui-fixes-task3-worklog.md` esistenti e leggibili.
- File richiesti: `src/muya/lib/ui/quickInsert/index.js`.
- Target di verifica: `npm run build` exit 0; test utente: @ → cerca "heading1" → cancella → lista completa riappare; @ in un altro paragrafo → lista completa.
- Version control: solo `git status`/`git diff`; vietati commit (DECISIONS.md 2026-07-01).

## Fatti verificati (Agent-Explorer 2026-07-06)
- `quickInsert/index.js:125-154 search(text)`: parte da `deepCopy(this.renderObj)` (riga 128) e alla fine `this.renderObj = result` (riga 152, setter che sovrascrive `this._renderObj`). Nessuna copia pristina dell'elenco completo: dopo la prima ricerca la base è il sottoinsieme filtrato; con `text === ''` ritorna lo stesso sottoinsieme (righe 145-146) invece della lista completa.
- Elenco completo creato nel costruttore (riga 22, `createQuickInsertObj(translateFn)`).

## File da toccare
- `src/muya/lib/ui/quickInsert/index.js`

## Regole rilevanti
- Muya: solo JS puro + DOM, niente Electron/Node (CLAUDE.md §8).
- Modifica minima: introdurre il riferimento pristino, non ristrutturare il componente.
- Attenzione all'i18n: `createQuickInsertObj(translateFn)` dipende dalla lingua — il riferimento pristino va creato nello stesso punto/con la stessa translateFn dell'attuale (se esiste un punto di refresh su cambio lingua, aggiornare anche quello: verificarlo con grep su `createQuickInsertObj`).

## Sottoproblemi in ordine
1. Grep di tutti gli usi di `createQuickInsertObj` e di `renderObj` nel file (e fuori, se esportato) per confermare i punti da toccare.
2. Costruttore: `this.fullRenderObj = createQuickInsertObj(translateFn)`; `this.renderObj = this.fullRenderObj` per il render iniziale. Se esiste un punto di rigenerazione (es. cambio lingua), aggiornare anche `fullRenderObj` lì.
3. `search(text)`: base = `deepCopy(this.fullRenderObj)` (era `this.renderObj`).
4. Build `npm run build`.
5. Worklog (checkbox + DA TESTARE).

## Esecutore e skill
- Agent-Code. Skill: coding-standard.
