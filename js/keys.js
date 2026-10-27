/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button.
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
Kit.help.setup({
  title: IC.TITLE, // the name lives in js/title.js
  cols: ['1 player', '2 players: Teddy', '2 players: Tommy'],
  keys: [
    ['walk', '← → or A D', 'A D', '← →'],
    ['jump: the mallet bonks the ice over your head', 'Space or ↑ W', 'W or Space', '↑'],
    ['swing the mallet at a seal or a bird', 'X or ↓ S', 'S or F', '↓'],
    ['call your brother: he smashes the row above (2 players: high five)', 'T', 'T', 'T'],
    ['pause · sound', 'P or Esc · M', 'P · M', 'P · M'],
    ['title: 1 or 2 players · easy · normal · climber · mountain', '1 2 · E · N · C · ← →', '', ''],
  ],
  note: 'Jump under the ice to bonk the block over your head, then jump again to hop up through the hole. Ride the drifting clouds. Bonk seals and birds with the mallet and they float away. At the top, hop up the clouds and grab the giant vegetable before the timer runs out! Call your brother as often as you like.',
  touch: '◀ ▶ walk, ⤴️ jumps, 🔨 swings the mallet, and your brother\'s face calls him. 2 players: a pad each.',
});
