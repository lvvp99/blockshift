# Blockshift

A responsive Bloxorz-inspired puzzle game, built with dependency-free HTML, CSS, and JavaScript. Nine levels introduce rolling, gaps, fragile tiles, and switch-controlled bridges. Progress and personal bests are saved in the browser.

## Play locally

With XAMPP Apache running, open **http://localhost/blockgame/**.

Alternatively, use Node.js 20.11 or newer:

```sh
npm start
```

Open **http://localhost:4173**. To play on a phone connected to the same Wi-Fi, use the computer's LAN IP with the same path or port. The server must be reachable through the computer's firewall.

## Controls

- Arrow keys or WASD: roll
- Z or Backspace: undo
- R: restart
- Phone/tablet: swipe the board or tap the directional buttons
- A little nudge: a solver-backed hint from the current position

Stand upright in the green goal. Both halves need support. Copper tiles only support the block while flat. Stand upright on a round switch to toggle the dotted bridges. Falling returns the block to the previous safe position.

## Tests

```sh
npm test
```

Tests cover rolling in every orientation, edge support, goal alignment, fragile tiles, switch and bridge behavior, hints, and a complete valid solution for every level.
