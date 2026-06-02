<span class="lvl-badge lvl-2"></span>

# Il dialogo di ricarica

MarkText **sorveglia** i file aperti. Quando uno cambia sul disco, parte una catena che
finisce per mostrare il dialogo — ma solo se la scheda di quel file è quella **attiva**.

## Dettagli che noti

- Se il file modificato è in una scheda **in secondo piano**, il dialogo **non** ti
  interrompe subito: la modifica viene "messa in attesa" e il dialogo compare quando apri
  quella scheda.
- Se hai l'**autosave** attivo e non avevi modifiche, la ricarica può avvenire in silenzio.

Il "sorvegliante" dei file lavora in una parte separata dell'app (il processo principale),
non nell'interfaccia: il perché è nel livello tecnico.

[Approfondisci: come funziona →](lvl3-come-funziona/index.md){ .md-button .md-button--primary .lvl-cta .lvl-3 }
