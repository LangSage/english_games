# The Lost Shopping List

`The Lost Shopping List` is a phone-first static browser game for learning English through comprehensible input. Students move Nadia around the map, inspect objects, talk to people, and solve a short workplace problem in simple spoken English.

## What Is Included

- A mobile-friendly browser game with touch controls and keyboard support
- A full story case with hints, 6 comprehension checks, and an end review
- Start vocabulary, in-game word support, and replayable dialogue audio
- Local pre-generated voice files plus a Python generator for regenerating speech
- A GitHub Pages friendly static site with no build step

## Lesson Focus

A phone-first English supermarket game about starting at home, rebuilding a lost shopping list, and fixing two checkout problems.

### Starter Vocabulary

- `supermarket`: a big food shop
- `basket`: something you carry food in
- `shelf`: a place in the shop for products
- `cashier`: the person who takes payment
- `customer`: a person who buys something
- `shopping list`: a list of things to buy

### Key Review Phrases

- You need a loaf of bread and a carton of milk first.
- There are tomatoes on the left and potatoes on the right.
- You need more money. Go home, then come back to pay.

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
