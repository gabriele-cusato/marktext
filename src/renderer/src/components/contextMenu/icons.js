// Icone Lucide-style inline per context menu v2.
// Restituite come stringhe HTML (renderizzate via v-html).

const svg = (paths) =>
  `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`

export const ICONS = {
  cut: svg('<circle cx="6" cy="20" r="3"/><circle cx="18" cy="20" r="3"/><path d="M8.12 17.88 12 12"/><path d="M16 6l-8.12 9.88"/><path d="m6 9 6-6 6 6"/>'),
  copy: svg('<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>'),
  paste: svg('<path d="M15 2H9a1 1 0 0 0-1 1v2c0 .6.4 1 1 1h6c.6 0 1-.4 1-1V3c0-.6-.4-1-1-1Z"/><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"/>'),
  upper: svg('<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>'),
  lower: svg('<path d="M4 20V9a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v11"/><path d="M4 14h16"/>'),
  title: svg('<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>'),
  moveup: svg('<path d="m18 15-6-6-6 6"/>'),
  movedn: svg('<path d="m6 9 6 6 6-6"/>'),
  dup: svg('<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>'),
  del: svg('<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>'),
  slash: svg('<line x1="16" y1="4" x2="8" y2="20"/>'),
  cmd: svg('<path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3"/>'),
  file: svg('<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><polyline points="14 2 14 8 20 8"/>'),
  close: svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
  closeOth: svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/><circle cx="12" cy="12" r="10"/>'),
  arrow: svg('<path d="m9 18 6-6-6-6"/>'),
  edit: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
  folder: svg('<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>'),
  insertBefore: svg('<path d="M5 12h14"/><path d="M12 5v14"/><path d="M5 5h14"/>'),
  insertAfter: svg('<path d="M5 12h14"/><path d="M12 5v14"/><path d="M5 19h14"/>')
}
