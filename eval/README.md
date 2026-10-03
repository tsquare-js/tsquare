# tsquare evals

Two evals of how well models write tsquare. Both score the models' first attempt: no self-checking and no repair round.

## Format eval: text vs JSON

Before settling on a text syntax, we compared three formats a model could write: flat JSON, nested JSON, and the text syntax. The eval uses 20 wireframe requests (`tasks.ts`), Sonnet and Haiku, and prompts that are identical apart from the format section (`prompts/`).

| | Valid, first try | Median tokens |
|---|---|---|
| Sonnet, text | 100% | 184 |
| Sonnet, flat JSON | 100% | 839 |
| Sonnet, nested JSON | 100% | 735 |
| Haiku, text | 80% | 210 |
| Haiku, flat JSON | 90% | 920 |
| Haiku, nested JSON | 90% | 853 |

Text used about 4× fewer tokens and scored the same on content checks and render quality. Validity is close: two tasks out of 20 separate text and JSON for Haiku, which is directional at this sample size.

These numbers use today's stricter checks. Unknown icon names (`call`, `person`) now fail in every format; they used to render as a silent placeholder. A list item that sets a value its kind wouldn't show (Haiku's `leading=avatar icon=star`, where the star was silently dropped) is now an error too. The eval also changed the language:

- List items are separated by commas only. Sonnet wrote table cells like `[Ana Torres, Admin]`, which used to split on the space.
- `off`/`unchecked` keywords, `width` on card/input/select, `padding` on grid, `grow` on list/input, sidebars stretching in rows, and bottom sheets growing to fit their content.

### Rerun with the 0.3.0 prompt (`text-v2`), and run-to-run variance

`prompts/text-v2.md` is the library's prompt as of 0.3.0 (`npm run prompt`): the `leadingIcon`/`trailingIcon` names, comma lists, colors, `width` on inputs and cards. To separate the prompt from chance, each prompt was also run a second time with fresh subagents (`text-rerun` uses the old `prompts/text.md`, `text-v2-rerun` uses the new one). All runs are scored with today's checks.

Scored with today's parser, where comments are whole lines only (so `[#1001, …]` no longer breaks a table):

| Valid, first try | Old prompt ×2 (stored, rerun) | `text-v2` ×2 | `text-v3` ×2 | `text-v4` ×2 (shipped) |
|---|---|---|---|---|
| Sonnet | 100%, 95% | 95%, 100% | 95%, 95% | 100%, 95% |
| Haiku | 80%, 80% | 65%, 85% | 70%, 65% | 85%, 55% |

- `text-v2` is the first 0.3.0 draft.
- `text-v3` adds the whole-line comment rule.
- `text-v4` lists each yes/no prop with the components that have it (`fullWidth (button)`), instead of `checked, fullWidth, grow, muted`.

- **Sonnet:** no difference between the prompts (95–100% in every run). The comment fix shows: the `[#1001, …]` order tables are valid in all 5 outputs that use them, and models wrote no comments at all.
- **Haiku may be a little lower on the new prompt:** 80% and 80% on the old one, against 65–85% (average 71%) over four runs on the new one. A single run of 20 moves 10–20 points, so this is directional. None of Haiku's failures involve the rename or comments. They are the same few guesses:
  - `fullWidth` on inputs: 4 of 6 runs, both prompts. The prompt's list of yes/no props (`checked, fullWidth, grow, muted`) doesn't say which component each belongs to.
  - `padding` on headings, and `align` on buttons.
  - Unknown icons: `call`, `compose`.
  - A drawer nested in a stack, and a table's rows wrapped across lines.
- **Listing which components have each yes/no prop (`text-v4`) didn't measurably help.** Haiku still put `fullWidth` on inputs in one of the two runs (before: 4 of 6). The line is kept because it's accurate.
- **Haiku's range is 55–85% across eight runs of the new prompts.** One run of 20 can't separate prompt versions for Haiku.
- **A new Haiku pattern:** a prop moved onto its own indented line under its element (`listitem "Password"` then `trailing=chevron` below it), or a table's `data=` on the next line.
- **Sonnet's only failure:** `grow` on a select (5 of 9 runs, same task). Since 0.3.2 selects have `grow`, so every stored Sonnet text output is now valid.
- **The rename works in practice.** With the new prompts, the models wrote `leadingIcon`/`trailingIcon` and never the old `icon=` on buttons or list items. With the old prompt, they wrote `icon=` 42 times, and every one still compiles.

### Repair round (`repair/`)

Every failed first try from the four 0.3.0-prompt runs (25 Haiku, 3 Sonnet) got one repair turn: the same conversation plus the library's `repairPrompt()` with the problems. Each was repaired twice, once with today's error messages and once with the messages from before the clearer errors (`repair/old-messages.json`, from commit cb30d71).

| Fixed by one repair | Today's messages | Old messages |
|---|---|---|
| Sonnet | 3/3 | 3/3 |
| Haiku | 24/25 | 24/25 |

- **After one repair, every run is 19–20 out of 20 for both models**, including the Haiku run that started at 11/20. The repair loop is what makes Haiku usable.
- **The clearer messages made no difference to whether a fix worked.** Both sets of messages name the line and the wrong word, which is apparently enough. Haiku's single miss is the same in both conditions: it wrote `trailingIcon=chevron` (not a Lucide name; `trailing=chevron` is the kind). The error now says exactly that: `chevron is a trailing kind, not an icon name: write trailing=chevron`.
- `npx tsx eval/repair/build.ts` writes the conversations, and `npx tsx eval/repair/score.ts` scores them.

The stored outputs keep the `.wf` extension and the ```` ```wireframe ```` fence from before the project was named. They're the exact outputs that were scored, so they aren't renamed.

```bash
npm run eval:score     # parse, validate, run the checks, count tokens, render
npm run eval:prompts   # rebuild the prompts (the committed ones are what was tested)
```

| Path | Contents |
|---|---|
| `tasks.ts` | the 20 requests and their checks |
| `prompts/` | the exact prompts tested, one per format |
| `out/<model>/<format>/` | every model output |
| `results.json` | scores per output |
| `renders/` | PNGs of every output (regenerated, not committed) |

## Component eval (0.4.0)

Do models reach for the 0.4.0 components (chart, calendar, date and code inputs, progress, slider, pagination, bullets) when a screen needs them, and write them correctly? It uses 7 requests (`components/tasks.ts`) that describe the screen without naming components, with two runs per model, using the 0.4.0 prompt (`components/prompt.md`).

| | Sonnet | Haiku |
|---|---|---|
| Valid, first try | 14/14 | 12/14 |
| Checks passed | 32/32 | 30/32 |

The first scoring found two problems in the language, not the models, and both were fixed before release:
- **Sonnet wrote `{label=Custom domain icon=x muted}`.** An unquoted value in `{…}` can now contain spaces.
- **Haiku wrote `slider range=[30, 200]` for prices.** The slider now accepts any amounts and scales its track.

Haiku's remaining misses: it wrote the dates as plain inputs once, and garbled one list of objects.

**0.4.1** added three requests (a ride app's map, an FAQ, a "saved" message), run with the 0.4.1 prompt (`components/prompt-0.4.1.md`, +195 tokens). All 12 outputs were valid, and they used `image map`, `accordion` and `toast` correctly, except one Haiku run that drew the map as a plain image labeled "Map".

**0.5.0** added four requests for open states and tooltips: a country select, a date picker, a row's "…" menu and a toolbar tooltip. They ran with the 0.5.0 prompt (`components/prompt-0.5.0.md`, +169 tokens). All 16 outputs were valid and passed their checks, and the date picker read an ISO date (`2026-11-20`) correctly. One gap showed: for the row menu, Sonnet put "…" on each list item's trailing icon, but only a Button can carry a menu, so it added a separate button for it.

The original 20 requests with the 0.4.0 prompt (`text-v5`): Sonnet 100%, Haiku 65%, within Haiku's usual 55–85%. None of its failures involve the new components, which also showed up unprompted in 6 of the 40 outputs (for example a chart on the dashboard).

```bash
npx tsx eval/components/score.ts            # score, render to components/renders/
npx tsx eval/components/score.ts --prompt   # rewrite components/prompt.md and components/tasks.md
```

## Color eval

Do models use the three color props (board `accent`, badge `tone`, input `error`) when asked, leave them out when not, and avoid inventing others? It uses 7 requests (`colors/tasks.ts`), including a named brand color, a hex brand color, "a purple theme" (not one of the named accents), colors the props can't express, and a request with no color at all. The prompt is today's model prompt, saved as `colors/prompt.md`.

| | Sonnet | Haiku |
|---|---|---|
| Color checks passed | 11/11 | 11/11 |
| All checks passed | 18/18 | 17/18 |
| Valid, first try | 7/7 | 4/7 |
| Invented color props | 0 | 0 |

Both models picked `violet` for purple, copied the hex exactly, and stayed grayscale when no color was asked for. Haiku's three invalid outputs weren't about color: a list wrapped across several lines, `checked` on a list item (not a prop), and `primary="Delete"`.

```bash
npx tsx eval/colors/score.ts            # score, render to colors/renders/
npx tsx eval/colors/score.ts --prompt   # rewrite colors/prompt.md and colors/tasks.md
```

## Caveats

- Small samples: 20 requests per format and 7 color requests. Treat the results as directional, not conclusive.
- Outputs were generated by Claude subagents given the prompt and the requests, one file per request, rather than by bare API calls.
- Token counts use an OpenAI tokenizer (`gpt-tokenizer`) as a stand-in for Claude's.
