# Corner Store sounds

Every sound already has a synthesized placeholder, so the game works with this folder empty.
To use a real recording, drop the file here and add a line to `manifest.json`:

```json
{ "door-chime": "door-chime.m4a", "gunshot": "gunshot.wav" }
```

`.m4a` (AAC), `.mp3`, `.ogg` and `.wav` all work. Mono for one-shots, stereo for the `amb-` loops (cut them to loop cleanly).
No sound may contain intelligible words.

| Name | What it is |
| --- | --- |
| `door-chime` | Bell when the front door opens |
| `scanner-beep` | Barcode scanner |
| `drawer-open`, `drawer-close` | Register drawer |
| `coins` | Coins / change |
| `turntable` | Plexiglass lazy-susan spinning |
| `booth-lock` | Booth door lock clicking |
| `fridge-open` | Fridge door opening with the seal |
| `footstep` | One sneaker step on tile (the game varies pitch) |
| `grunt`, `laugh`, `sigh`, `scream`, `scoff`, `hmm`, `gasp`, `mumble` | NPC voice sounds, no words |
| `gunshot` | Handgun shot indoors |
| `gunshot-distant` | Shots from down the block |
| `casing` | Shell casing hitting tile |
| `dry-fire`, `reload` | Empty click, magazine change |
| `glass-break` | Bottle or plexi hit |
| `punch`, `body-fall`, `blood-splat`, `knife-out` | Fights and injuries |
| `siren` | Police siren arriving |
| `cuffs` | Handcuffs |
| `bus-brakes`, `bus-hiss`, `car-pass` | Street outside |
| `phone-dial` | Store phone |
| `ui-select`, `ui-hover`, `caption` | Interface |
| `shift-start`, `shift-end` | Night start and clock-out |
| `ringing` | Ears ringing after you get hit |
| `amb-traffic`, `amb-fluorescent`, `amb-fridge` | Ambience loops |
