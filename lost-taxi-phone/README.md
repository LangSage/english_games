# The Lost Taxi Phone

`The Lost Taxi Phone` is a phone-first static browser game for learning English through comprehensible input. Students move Adam around the map, inspect objects, talk to people, and solve a short workplace problem in simple spoken English.

## What Is Included

- A mobile-friendly browser game with touch controls and keyboard support
- A full story case with hints, 6 comprehension checks, and an end review
- Start vocabulary, in-game word support, and replayable dialogue audio
- Local pre-generated voice files plus a Python generator for regenerating speech
- A GitHub Pages friendly static site with no build step

## Lesson Focus

A phone-first English city mystery about a phone lost after a taxi ride, a public phone call, the cleaning department, and the police desk.

### Starter Vocabulary

- `taxi`: a car you pay to ride in
- `phone`: a small thing you use to call and text
- `receipt`: a small paper with payment information
- `lobby`: the front area inside a building
- `police`: people who protect the city and help with problems
- `charger`: something that gives power to a phone

### Key Review Phrases

- Use the lobby phone. It is free.
- I sent the phone to the police desk.
- Get a charger, then come back.

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
