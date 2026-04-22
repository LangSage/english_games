# The Broken Supply Chain

`The Broken Supply Chain` is a phone-first static browser game for learning English through comprehensible input. Students move Emir around the map, inspect objects, talk to people, and solve a short workplace problem in simple spoken English.

## What Is Included

- A mobile-friendly browser game with touch controls and keyboard support
- A full story case with hints, two comprehension checks, and an end review
- Start vocabulary, in-game word support, and replayable dialogue audio
- Local pre-generated voice files plus a Python generator for regenerating speech
- A GitHub Pages friendly static site with no build step

## Lesson Focus

A phone-first English logistics game about a delayed shipment, missing cargo, and an urgent customer.

### Starter Vocabulary

- `shipment`: goods sent from one place to another
- `cargo`: the goods inside a truck or ship
- `delay`: something happens later than planned
- `warehouse`: a large place where goods are stored
- `route`: the road or path for a delivery
- `tracking number`: a code used to follow a shipment

### Key Review Phrases

- The truck has a mechanical problem.
- We sent 120 boxes, not 95.
- Send the urgent boxes in a smaller van.

## How To Run Locally

1. Open a terminal in this folder.
2. Run `python -m http.server 8000`
3. Open [http://localhost:8000](http://localhost:8000)

You can also run `serve_game.bat` on Windows.

## Files To Edit

- Story content: `assets/data/story.json`
- Browser logic: `src/`
- Dialogue generation: `tools/generate_audio.py`

If you change dialogue text, run:

```bash
python tools/generate_audio.py
```

## Publish On GitHub Pages

1. Upload this whole folder to a GitHub repository.
2. In GitHub, open `Settings` -> `Pages`.
3. Set the source to the main branch and the root folder.
4. Save and wait for the site to publish.

## Credits

See `CREDITS.md` for asset and library sources.
