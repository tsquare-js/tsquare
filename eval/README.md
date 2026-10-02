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

| Valid, first try | Old prompt, stored | Old prompt, rerun | 0.3.0 prompt | 0.3.0 prompt, rerun |
|---|---|---|---|---|
| Sonnet | 100% | 90% | 90% | 95% |
| Haiku | 80% | 80% | 65% | 85% |

- **No measurable difference between the prompts.** The old prompt scored 100% and 90% for Sonnet; the new one 90% and 95%. For Haiku, 80% and 80% against 65% and 85%. The same request can pass in one run and fail in the next, so a single run of 20 moves by 10–20 points.
- **The rename works in practice.** With the new prompt, the models wrote 55 `leadingIcon`/`trailingIcon` and no old `icon=` on buttons or list items. With the old prompt, they wrote `icon=` 42 times, and every one still compiles: the backward compatibility holds on real model output.
- **Recurring mistakes, across both prompts:**
  - Sonnet's dashboard table fails in 3 of 4 runs with "unclosed [". Its order numbers (`[#1001, …]`) start a comment, because `#` after a space or `[` begins one. This is the parser's fault, not the model's.
  - Haiku puts `fullWidth` on inputs (3 of 4 runs, old prompt included). Inputs already fill their width.
  - Haiku occasionally guesses an icon (`call`, `compose`, `bag`), puts `grow`/`padding` on components that lack them, or nests a drawer in a stack.

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
