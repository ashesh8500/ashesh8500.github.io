# Game-Theoretic Extension: Multi-Agent Nash Equilibrium

**Run ID:** `2026-04-30-game-theoretic-nash`
**Date:** 2026-04-30

## Objective
Extend the layered single-agent portfolio optimization study with a game-theoretic multi-agent equilibrium. Model strategy arms as players in a non-cooperative game with crowding externalities, compute Nash equilibrium via iterative best-response, and study how crowding changes the allocation landscape.

## Setup
- **Universe:** Top-500 U.S. equities, 254 assets, 2015–2024 daily prices (reuses grand-study data)
- **Players:** 6 strategy arms (21d mom/EW, 63d mom/EW, 63d lowvol/EW, 63d VAM/RH21, 63d mom/RH21, cluster-capped mom/EW)
- **Parameters:** λ=1.0, κ=0.001, γ swept [0, 0.01, 0.05, 0.1, 0.25, 0.5, 1.0]
- **Convergence:** ε=1e-4, max 50 iterations

## Method
- **Game formulation:** Each player maximizes U_a = α_a^T w − λ w^T Σ w − κ||Δw||_1 − γ w^T Σ_{j≠a} w_j
- **Solver:** Gauss-Seidel iterative best-response with cvxpy/OSQP convex QP
- **Nash equilibrium:** Converged within 4–8 iterations, 20/20 windows stable

## Results

### Experiment A: Strategy Arms as Players (γ=0.05)
- Convergence: 4–6 iterations at both mid-sample (Jan 2020) and recent (Dec 2024) dates
- Efficiency loss under 2% for most players at moderate crowding
- Low-vol player improves in equilibrium (reduced competition for low-vol assets)
- HHI 0.057–0.178 across players → diversified allocations
- Aggregate pairwise overlap: 0.19–0.25

### Experiment B: Crowding Sensitivity Sweep
| γ | Total utility | Aggregate overlap |
|---|---------------|-------------------|
| 0.00 | 3.021 | 0.246 |
| 0.01 | 3.002 | 0.141 |
| 0.05 | 2.954 | 0.103 |
| 0.10 | 2.933 | 0.067 |
| 0.25 | 2.920 | 0.024 |
| 0.50 | 2.933 | 0.000 |
| 1.00 | 2.933 | 0.000 |

Three regimes: independent (γ=0, 25% overlap), partial separation (0<γ≤0.10), full separation (γ≥0.25). Total system utility declines only ~3% across the sweep.

### Experiment C: Temporal Stability
- 20 quarterly-spaced windows, all converged (4–8 iterations each)
- No single strategy arm dominates persistently
- Utility share of dominant player: 28–36% across windows
- Strategy dominance is regime-dependent, not structural

## Key Findings
1. Moderate crowding (γ≈0.05) induces modest efficiency losses — single-agent optima are reasonable approximations when crowding is low
2. As crowding increases, players diversify away from each other smoothly — the equilibrium is well-behaved
3. No single strategy family eliminates the others — the equilibrium preserves a diversified ecology
4. Strategy dominance varies temporally with market conditions, consistent with the single-agent finding that the optimal stack changes with universe breadth

## Artifacts
- Code: `game_theoretic/src/game_study/`
- Metrics: `game_theoretic/metrics/experiment_a_mid.json`, `experiment_a_recent.json`, `experiment_b_gamma_sweep.json`, `experiment_c_temporal.json`
- Integrated into: `proposal/final_submission/FINAL_PROJECT_REPORT.tex` (Section IX–X)
- Presentation: 3 new slides in `presentation/index.html` (slides 13–15)

## Interpretation
The game-theoretic results complement but do not displace the single-agent layered study. The single-agent analysis identifies which stack performs best; the multi-agent analysis asks which strategies survive when they compete. For the parameter range tested, the answer is that moderate crowding does not substantially alter the efficiency ordering, but the framework provides the language and computational machinery to study interaction effects that the single-agent view cannot capture.

## Next Steps
- Asymmetric impact matrix calibrated to position size and liquidity
- Player-specific risk models (beyond shared Σ)
- Point-in-time universe membership for temporal stability experiment
- Larger player set (full 15 strategy families)
