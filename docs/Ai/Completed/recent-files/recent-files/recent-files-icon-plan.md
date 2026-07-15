# recent-files — task icona tab bar — plan — 2026-07-12

Origine: TODO.md: aggiungere l'icona "File recenti" nella tab bar, tra l'icona cartella e l'icona
command palette (icona nuova, scelta libera). Lega alla feature `recent-files` (stessa cartella).

## Prerequisiti bloccanti
- La feature `recent-files` (palette) deve essere implementata PRIMA: l'icona ne è il trigger.
- ⚠️ Coordinamento con la feature `window-minwidth-hamburger`: l'hamburger raccoglierà proprio
  queste icone (palette, cartella, recenti) sotto una soglia di width → stessi file. I due task
  vanno in SEQUENZA (prima icona, poi hamburger), mai in parallelo.

## Fatti verificati (Agent-Explorer 2026-07-12)
- Componente: `src/renderer/src/components/editorWithTabs/tabs.vue`, blocco `.v2-topright`
  (righe 138-308). Icone esistenti = glifi Unicode (⌘, riga 184) o SVG inline monocromatici
  `stroke="currentColor"` (cartella, righe 192-204). Nessun componente icona/asset esterno →
  la nuova icona va come SVG inline nello stesso template.
- Azioni: palette → `openCommandPalette` (759-761) `bus.emit('show-command-palette')`;
  cartella → `openFileDialog` (764-766) IPC `mt::cmd-open-file`.
- Apertura palette GIÀ scoped su un comando: `commandPalette/index.vue:145-151` — l'evento bus
  `show-command-palette` accetta un'istanza comando come secondo argomento e apre direttamente
  nei suoi subcommand. Percorso pulito per l'icona: `bus.emit('cmd::execute', 'file.quick-open')`
  (ascoltato in `store/commandCenter.js:62-64` → `executeCommand` 72-81 → `.execute()` di
  `quickOpen.js:65-69` che riapre la palette scoped).
- ⚠️ Timing: `QuickOpenCommand` è registrata a runtime in `store/editor.js:780-787` con
  `setTimeout` 400ms post-bootstrap → gestire il click nei primi istanti (no-op o retry breve).
- ⚠️ i18n: i `title` delle icone in tabs.vue sono hardcoded e MISTI italiano/inglese
  (es. "Command Palette (Ctrl+K)" vs "Apri file (Ctrl+O)") — nessun uso di i18n nel file.
  DECISIONE UTENTE: nuova icona con title hardcoded coerente allo stato attuale, o introdurre
  i18n nel topright (e uniformare le esistenti)?

## Obiettivo
1. Nuova icona (asset coerente con lo stile icone v2 esistenti; scelta libera, proporre 1-2
   opzioni all'utente).
2. Click → aprire il command palette direttamente in modalità "Recent Files" (stesso percorso del
   comando `file.quick-open` trasformato; verificare come invocare il palette con comando
   preselezionato — il commandCenter supporta subcommand, confermare API).
3. Posizione: tra icona cartella e icona command palette.
4. Tooltip + i18n della label.

## File da toccare
- Componente tab bar sezione destra (da confermare) + asset icona + locales.

## Skill di codice
`coding-standard` (Vue 3).

## Test
PC principale: icona visibile nella posizione giusta, click apre Recent Files, tooltip tradotto,
dark/light theme ok.
