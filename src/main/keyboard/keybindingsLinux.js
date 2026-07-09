// Key bindings for Linux.

// NOTE: Avoid `Ctrl+Alt` and `Alt` shortcuts on Linux because Ubuntu based OSs have reserved system shortcuts (see GH#2370).
//       Binding shortcuts to these modifiers will result in odd behavior on Ubuntu.
// NOTE: Don't use `Ctrl+Shift+U` because it's used IBus for unicode support.
// NOTE: We can't determine the character for a dead key and no translation is provided. E.g. Ctrl+` (=Ctrl+Shift+´) on a
//       none nodeadkeys german keyboard cannot be interpreted. In general don't bind default shortcuts to characters that
//       can be produced with ^ or ` on any keyboard. --> ^, `, ", ~, ...

export default new Map([
  // MarkText menu on macOS only
  ['mt.hide', ''],
  ['mt.hide-others', ''],

  // File menu
  ['file.new-window', 'Ctrl+N'],
  ['file.new-tab', 'Ctrl+T'],
  ['file.open-file', 'Ctrl+O'],
  ['file.open-folder', ''],
  ['file.save', 'Ctrl+S'],
  ['file.save-as', 'Ctrl+Shift+S'],
  ['file.move-file', ''],
  ['file.rename-file', ''],
  ['file.print', ''],
  ['file.preferences', 'Ctrl+,'],
  ['file.close-tab', 'Ctrl+W'],
  ['file.close-window', 'Ctrl+Shift+W'],
  ['file.quit', 'Ctrl+Q'],

  // File > Export submenu
  ['file.export-file.pdf', 'Ctrl+Alt+E'],

  // Edit menu
  ['edit.undo', 'Ctrl+Z'],
  ['edit.redo', 'Ctrl+Shift+Z'],
  ['edit.cut', 'Ctrl+X'],
  ['edit.copy', 'Ctrl+C'],
  ['edit.paste', 'Ctrl+V'],
  ['edit.copy-as-markdown', 'Ctrl+Shift+C'],
  ['edit.copy-as-html', ''],
  ['edit.paste-as-plaintext', 'Ctrl+Shift+V'],
  ['edit.select-all', 'Ctrl+A'],
  ['edit.duplicate', 'Ctrl+Shift+P'],
  ['edit.create-paragraph', 'Ctrl+Shift+N'],
  ['edit.delete-paragraph', 'Ctrl+Shift+D'],
  ['edit.find', 'Ctrl+F'],
  ['edit.find-next', 'F3'],
  ['edit.find-previous', 'Shift+F3'],
  ['edit.replace', 'Ctrl+R'],
  ['edit.find-in-folder', 'Ctrl+Shift+F'],
  ['edit.open-in-browser', 'Ctrl+Shift+O'],
  ['edit.screenshot', ''], // macOS only

  // Paragraph menu
  ['paragraph.heading-1', 'Ctrl+1'],
  ['paragraph.heading-2', 'Ctrl+2'],
  ['paragraph.heading-3', 'Ctrl+3'],
  ['paragraph.heading-4', 'Ctrl+4'],
  ['paragraph.heading-5', 'Ctrl+5'],
  ['paragraph.heading-6', 'Ctrl+6'],
  // NOTE: rimosse (in conflitto con window.zoomIn/zoomOut Ctrl++ / Ctrl+-); zoom mantenuto.
  ['paragraph.upgrade-heading', ''],
  ['paragraph.degrade-heading', ''],
  ['paragraph.table', 'Ctrl+Shift+T'],
  ['paragraph.code-fence', 'Ctrl+Alt+C'],
  ['paragraph.quote-block', 'Ctrl+Alt+Q'],
  ['paragraph.math-formula', 'Ctrl+Alt+M'],
  ['paragraph.html-block', 'Ctrl+Alt+J'],
  ['paragraph.order-list', 'Ctrl+Alt+O'],
  ['paragraph.bullet-list', 'Ctrl+Alt+U'],
  ['paragraph.task-list', 'Ctrl+Shift+X'],
  ['paragraph.loose-list-item', 'Ctrl+Shift+L'],
  ['paragraph.paragraph', 'Ctrl+0'],
  ['paragraph.horizontal-line', 'Ctrl+_'], // Ctrl+Shift+-
  ['paragraph.front-matter', 'Ctrl+Shift+Y'],

  // Format menu
  ['format.strong', 'Ctrl+B'],
  ['format.emphasis', 'Ctrl+I'],
  ['format.underline', ''],
  ['format.superscript', ''],
  ['format.subscript', ''],
  ['format.highlight', 'Ctrl+Shift+H'],
  ['format.inline-code', 'Ctrl+Y'],
  ['format.inline-math', 'Ctrl+Shift+M'],
  ['format.strike', 'Ctrl+D'],
  ['format.hyperlink', 'Ctrl+L'],
  ['format.image', 'Ctrl+Shift+I'],
  ['format.clear-format', 'Ctrl+Shift+R'],

  // Window menu
  ['window.minimize', 'Ctrl+M'],
  ['window.toggle-always-on-top', ''],
  ['window.zoomIn', 'Ctrl+Plus'],
  ['window.zoomOut', 'Ctrl+-'],
  ['window.toggle-full-screen', 'F11'],

  // View menu
  ['view.command-palette', 'Ctrl+Shift+A'],
  ['view.source-code-mode', 'Ctrl+E'],
  ['view.typewriter-mode', 'Ctrl+Shift+G'],
  ['view.focus-mode', 'Ctrl+Shift+J'],
  ['view.toggle-sidebar', ''],
  ['view.toggle-toc', ''],
  ['view.toggle-tabbar', 'Ctrl+Shift+B'],
  ['view.toggle-dev-tools', 'Ctrl+Alt+I'],
  ['view.dev-reload', 'Ctrl+F5'],
  ['view.reload-images', 'F5'],

  // ======== Not included in application menu ========================
  ['tabs.cycleForward', 'Ctrl+Tab'],
  ['tabs.cycleBackward', 'Ctrl+Shift+Tab'],
  ['tabs.switchToLeft', 'Ctrl+PageUp'],
  ['tabs.switchToRight', 'Ctrl+PageDown'],
  ['tabs.switchToFirst', ''],
  ['tabs.switchToSecond', ''],
  ['tabs.switchToThird', ''],
  ['tabs.switchToFourth', ''],
  ['tabs.switchToFifth', ''],
  ['tabs.switchToSixth', ''],
  ['tabs.switchToSeventh', ''],
  ['tabs.switchToEighth', ''],
  ['tabs.switchToNinth', ''],
  ['tabs.switchToTenth', ''],
  // NOTE: rimossa Ctrl+P (era in conflitto con file.print); quick-open resta via command palette.
  ['file.quick-open', ''],

  // Case transform — globali in entrambe le viste
  ['edit.to-uppercase', 'Ctrl+Shift+U'],
  ['edit.to-lowercase', 'Ctrl+U']
])
