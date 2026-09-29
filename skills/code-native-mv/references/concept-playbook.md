# Concept playbook — what a code-made MV should be about

## The one test

Every concept must lean on something code does and AI video models do not:

| Code is great at | AI video is weak at |
| --- | --- |
| frame-exact timing (a word lands on the frame it is sung) | timing to a beat grid |
| data as image (spectrum, beats, drum hits drive geometry) | 3-minute consistency, no style drift |
| perfect typography | legible text |
| accumulated state (frame N = everything before it) | anything that must "remember" |
| deterministic worlds you can re-render and re-angle | re-shooting the same world from a new angle |

If a pitch could be made by prompting a video model ("a couple in a car at night, neon rain"), drop it.

## Intake

1. Ask what they already picture. A formed picture ends the pitching.
2. If nothing: pitch **five** concepts along five paths — the subject's world, the emotion, the
   audience expectation (met or broken), the anti-pattern inverted, an unusual format. At least two
   should be tail ideas. Three lines each: concept, visual world (name the code capability it rides),
   opening hook. Recommend one only after showing all five.
3. A first-timer can't judge text. Build a **playable prototype** (song + section jump buttons) and
   let them pick by eye. Descriptions of style never worked in this project; live prototypes did.

## Rules learned the hard way

- **Build, don't bounce.** Audio-reactive geometry that jumps every frame reads as an equalizer — the
  most clichéd music visual there is. Use the music to *create* things that then persist: one
  building per beat whose height is that instant's spectrum; drum hits switch lights on
  (kick = a whole floor, snare = a scatter, hi-hat = one window). The world becomes a record of the song.
- **A world needs a protagonist.** Beautiful shots without a subject bored the viewer by 0:05.
  A chomping runner (Pac-Man homage) that eats one pellet per beat gave the whole film a through-line:
  the pellets ARE the beat grid laid out ahead of it, power pellets land on the hook line, and every
  camera move is "following it". Ask "who does the viewer follow?" in round one, not round four.
- **Give the ending a reveal that re-reads the whole piece.** Here: the dawn aerial shows the full
  gold route through the city — it reads as an arcade maze, and the whole night at once.
- **Energy arc by section.** Verse = sparse and slow, pre-chorus = held breath, chorus = density,
  bridge = everything stops/goes dark (one light survives), final chorus = relight brighter than ever,
  outro = dawn. Map build rate, lights, sky colour and cut density to this arc.
- **Homage, not trademark.** A Pac-Man-like runner is fine; never the name, logo or official art.

## Look that landed

Pure blueprint: navy massing models with blue wireframe edges and a roof grid (an architectural
"planning render"), windows in soft pale blue, the protagonist + its trail the only warm colour.
Lyrics in a condensed heavy face (Big Shoulders Display 800) top-left, the hook line centred large,
active word in the warm accent. HUD in a light mono (IBM Plex Mono 300): clock running 02:00 → dawn,
bar count, buildings built, arcade SCORE, tracking status. The user rejected glare twice — keep
emissives low (exposure ~0.8, bloom ~0.4, windows ~0.3–0.75 of colour) and check full-screen, not
in a small preview.
