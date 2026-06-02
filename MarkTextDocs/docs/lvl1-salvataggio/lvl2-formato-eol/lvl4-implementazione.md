<span class="lvl-badge lvl-4"></span>

# Implementazione: rilevamento UTF-8

Il caso critico (bug B3): `ced` su file piccoli/ASCII restituisce `ASCII` → veniva mappato a
`utf8` → byte Windows-1252 letti come UTF-8 → mojibake[^mojibake]. La difesa è verificare se il buffer
è **davvero** UTF-8 valido prima di fidarsi.

Codice **reale** da `encoding.js` (incluso via snippet):

```javascript title="src/main/filesystem/encoding.js (isValidUtf8)"
--8<-- "src/main/filesystem/encoding.js:25:50"
```

## Come viene usato

```javascript
// dopo che ced ha proposto 'utf8':
if (encoding === 'utf8') {
  const hasNonAscii = buffer.some((b) => b > 0x7f)
  if (hasNonAscii && !isValidUtf8(buffer)) {
    encoding = 'windows-1252' // fallback ANSI Western Europe
  }
}
```

## Logica della funzione

- Scorre i byte: un byte `<= 0x7F` è ASCII (0 byte di continuazione).
- I prefissi `110x / 1110x / 11110x` annunciano 1/2/3 byte di continuazione.
- Ogni byte di continuazione deve essere `10xxxxxx` (`& 0xC0 === 0x80`); altrimenti → **non** è UTF-8 valido.
- Il **BOM**[^bom] ha sempre la precedenza su questa euristica.

## Dizionario

[^mojibake]: *Mojibake* = testo illeggibile causato dall'interpretare i byte con la codifica sbagliata (es. `Ã¨` invece di `è`).
[^bom]: *BOM* (Byte Order Mark) = sequenza di byte all'inizio del file che dichiara in modo certo la codifica Unicode usata.
