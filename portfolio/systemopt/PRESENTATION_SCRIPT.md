# Presentation rehearsal script

Target length: 7–9 minutes in **Deck** mode. Use **Scroll** mode only if the evaluator wants to inspect equations, tables, or methodological detail after the talk.

## Presenter rule

In deck mode, do **not** narrate every object on the screen. Treat each slide as one idea:

1. Say the intuitive sentence.
2. Point to the one visual feature that proves it.
3. Move on before the audience starts reading the detailed material.

The detailed mathematical and empirical evidence remains in scroll mode for grading/review.

---

## Slide 1 — Title / thesis

Today I am presenting **Portfolio Allocation as Layered System Optimization**.

The thesis is that portfolio allocation is not just a static problem of choosing weights. A real portfolio system makes several linked choices: which universe is available, which names enter the active set, how weights are assigned, how much turnover is allowed, and whether a higher-level policy routes among candidate strategies.

I evaluate those choices as one layered control system using a 60-arm chronological walk-forward study.

## Slide 2 — Main result first

The main empirical result is that the best portfolio recipe changes with the size of the candidate universe.

For the Top-100 universe, the useful work is mostly screening: 21-day momentum plus equal weighting performs best. For the Top-250 universe, the best result shifts to a low-volatility screen plus equal weighting. For the Top-500 universe, the best stack uses volatility-adjusted momentum and a 21-day rank-and-hold controller.

So the conclusion is not “one strategy always wins.” The conclusion is that the binding optimization layer changes with universe breadth.

## Slide 3 — Markowitz baseline

The classical starting point is Markowitz. It gives a very clean risk-return dial: as risk aversion increases, the optimizer moves toward lower-volatility portfolios; as it decreases, the optimizer chases more expected return.

On the visual, the red point is the optimum and the slider is the risk-aversion knob.

The limitation is the important part: this formulation assumes the asset menu is already fixed. My project asks what happens when the menu itself, the screen, and the rebalancing controller are also decision variables.

## Slide 4 — Turnover as control effort

The second intuition is that trading is not just a fee at the end of the calculation. It is control effort.

The old portfolio is part of the state. The target portfolio pulls the system toward a new allocation, while transaction cost pulls it back toward the current allocation. When the cost knob increases, the new portfolio moves less.

This is why high-turnover rules need a higher burden of proof: they must earn enough extra return to pay for their own movement.

## Slide 5 — Layered formulation

This slide is the core modeling move.

I decompose the system into five layers: universe, screen, controller, friction, and router. The screen chooses the active list. The controller chooses weights on that list. Friction charges the system for moving. The router can choose among interpretable recipes over time.

Instead of claiming to solve the full mixed discrete-continuous problem exactly, the study samples it through named combinations: three universes, five screens, and four controllers, evaluated out of sample.

## Slide 6 — Screening is a decision

Screening is not preprocessing; it is a discrete optimization layer.

Use the buttons to show that the same set of candidates produces different active lists depending on the score. Momentum selects recent winners. Low volatility selects calmer names. Volatility-adjusted momentum selects names whose trend is strong relative to noise.

This matters because every downstream weighting rule is solving a different problem once the active list changes.

## Slide 7 — Walk-forward protocol

This slide explains how the backtest avoids peeking.

For each fold, the system computes screens and controller statistics using only information up to the training date. Then it evaluates the chosen arm on the next window. The blue part is what the strategy was allowed to know; the red part is the exam.

The important design choice is that every arm is stored in the ledger, not just the selected winner. That makes it possible to study the whole surface.

## Slide 8 — Full result surface

This is the central empirical figure.

Each cell is one screen/controller recipe. Darker means better risk-adjusted performance. The outlined cell is the winner within that universe.

The point is not to read all 60 cells. The point is to switch tabs and see the winning region move. That movement is the empirical evidence for the layered-control framing.

## Slide 9 — Winning stacks

Here are the three headline stacks.

Top-100: 21-day momentum plus equal weighting, Sharpe about 1.47. Interpretation: in the narrow universe, the screening layer does most of the useful work and equal weighting avoids overfitting.

Top-250: 63-day low-volatility plus equal weighting, Sharpe about 0.86. Interpretation: the middle universe adds noise, and filtering for stability beats chasing the strongest recent trends.

Top-500: volatility-adjusted momentum plus 21-day rank-and-hold, Sharpe about 1.76. Interpretation: the broad universe has enough cross-sectional dispersion for a second active ranking layer to pay for its turnover.

## Slide 10 — Layer ablations

The ablation slide asks which layer is doing useful work.

The left chart averages over controllers to isolate the screen layer. The right chart averages over screens to isolate the controller layer.

The operational lesson is that more optimization is not automatically better. Equal weighting is strong in the smaller universes. The active rank-and-hold controller becomes worthwhile only in the broadest universe, where the extra ranking has enough opportunity to overcome its trading cost.

## Slide 11 — Selection risk

This is the honesty slide.

Each universe reports the best of 20 recipes, so the winning Sharpe is a selected maximum. To check fragility, I resample the walk-forward folds and ask how often the same recipe still wins.

The exact winner is not extremely stable; bootstrap winner stability is roughly one-third across the scopes. Therefore I present the result as mechanism evidence — the surface shifts with universe breadth — not as proof that one exact trading rule is uniquely optimal.

## Slide 12 — Cost sensitivity

This slide tests whether the result depends on the 10 basis point trading-cost assumption.

The Top-100 and Top-250 winners barely trade, so their lines are almost flat. The Top-500 winner trades much more, so its Sharpe declines as costs rise. But it remains the winning family through 25 basis points.

That supports the control interpretation: active ranking can be worth it, but only when the signal benefit is large enough to pay the movement cost.

## Slide 13 — Adaptive router / reinforcement learning

The reinforcement-learning part is deliberately placed at the system level.

The router does not learn raw portfolio weights from scratch. It chooses among interpretable arms — the recipes already evaluated in the study. That makes the learned policy easier to compare against transparent baselines.

The result is disciplined: the learned router improves over a train-fixed recipe, but it does not beat the trailing-window rule that simply follows what worked recently. So RL is not presented as magic. It is a first-class component, but it needs more context or more independent episodes before it can justify the extra complexity.

## Slide 14 — What the study does not establish

This slide clarifies the limits.

The current universes are not fully point-in-time, so survivorship bias remains possible. The number of independent folds is limited, especially for the broad universe and the router. The winner is selected from many candidates, which creates model-selection risk. The cost model is proportional, while real market impact is nonlinear.

These are not cosmetic limitations. They define the next submission-quality extension: point-in-time membership, more walk-forward episodes, nonlinear costs, and richer contextual features for the router.

## Slide 15 — Related work

The project connects four research streams.

Markowitz supplies the risk-return baseline. Transaction-cost portfolio optimization explains why partial adjustment and turnover costs belong inside the objective. Online portfolio selection motivates chronological evaluation instead of hindsight comparison. Reinforcement-learning portfolio work motivates an adaptive policy layer.

My contribution is the decomposition and comparison standard: show which layer is binding, and require any learned layer to beat transparent online baselines.

## Slide 16 — Takeaways

There are three takeaways.

First, allocation is a stack, not a single optimization problem.

Second, the binding layer changes with universe breadth: screening in the narrow universe, stability filtering in the middle, and active ranking in the broad universe.

Third, complexity must beat simple honest baselines. A learned router that cannot beat recency is not yet deployable, even if it is more sophisticated.

The final framing is: instead of asking “which portfolio algorithm is best?”, ask “which layer is binding under the current market structure?”

---

# Submission checklist / changes to make before submitting

Submit or link the following as the clean final package:

1. **Final report PDF**: `proposal/final_submission/FINAL_PROJECT_REPORT.pdf`.
2. **Interactive presentation**: `presentation/index.html`, preferably served through a local/static web server rather than opened as a raw file.
3. **Rehearsal script**: this file, `PRESENTATION_SCRIPT.md`, if the submission asks for narration or presentation notes.
4. **Reproducibility guide**: `docs/REPRODUCIBILITY.md`.
5. **Canonical metrics/artifacts**: the files under `findings/2026-04-23-context-aware-grand-study/metrics/` referenced in the README.

Before submission:

- Use **Deck mode** for the live/recorded presentation; use **Scroll mode** as the detailed appendix.
- Do one full 7–9 minute rehearsal without reading the screen verbatim.
- Verify that the presentation opens, the next/previous controls work, and the browser console has no JavaScript errors.
- Confirm that the final report and presentation make the same claims: layered-control framing, three universe-specific winners, selection-risk caution, and RL router comparison against trailing-window routing.
- Do not submit local caches, raw market-data dumps, virtual environments, or exploratory folders not referenced by the final report.
