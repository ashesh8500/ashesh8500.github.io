"""Runner: execute all three game-theoretic experiments.

Experiment A: Strategy arms as players (single date, 6 players on top-500)
Experiment B: Crowding sensitivity sweep (γ ∈ {0, ..., 1.0})
Experiment C: Temporal stability (equilibrium at each walk-forward window)
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

from .data_loader import load_price_panel
from .equilibrium import (
    EquilibriumResult,
    compute_nash_equilibrium,
    compute_single_agent_optimum,
)
from .payoff import player_utility
from .players import CANONICAL_PLAYERS, PlayerConfig, compute_expected_return_proxy
from .crowding import concentration_report, aggregate_overlap, strategy_composition

# Paths relative to this file
RUN_DIR = Path(__file__).resolve().parents[2]
METRICS_DIR = RUN_DIR / "metrics"
FIGURES_DIR = RUN_DIR / "figures"


def ensure_dirs():
    METRICS_DIR.mkdir(parents=True, exist_ok=True)
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Experiment A: Strategy Arms as Players
# ---------------------------------------------------------------------------

def run_experiment_a(
    prices: pd.DataFrame,
    date: pd.Timestamp,
    gamma: float = 0.05,
) -> dict:
    """Compute equilibrium and compare to single-agent optima."""
    players = CANONICAL_PLAYERS[:6]
    n = len(prices.columns)

    # Single-agent optima (γ = 0)
    single_agent = {}
    for p in players:
        w, u = compute_single_agent_optimum(p, prices, date)
        single_agent[p.name] = {"weights": w.tolist(), "utility": float(u)}

    # Nash equilibrium
    eq = compute_nash_equilibrium(players, prices, date, gamma=gamma)
    eq_conc = concentration_report(eq.weights)
    overlap = aggregate_overlap(eq.weights)
    composition = strategy_composition(eq.weights)

    return {
        "date": str(date),
        "n_assets": n,
        "gamma": gamma,
        "converged": eq.converged,
        "iterations": eq.iterations,
        "max_weight_change": eq.max_weight_change,
        "total_utility": eq.total_utility,
        "equilibrium": {
            name: {"weights": w.tolist(), "utility": eq.utilities[name]}
            for name, w in eq.weights.items()
        },
        "single_agent": single_agent,
        "concentration": eq_conc,
        "aggregate_overlap": overlap,
        "strategy_composition": composition,
    }


# ---------------------------------------------------------------------------
# Experiment B: Crowding Sensitivity
# ---------------------------------------------------------------------------

def run_experiment_b(
    prices: pd.DataFrame,
    date: pd.Timestamp,
    gamma_values: list[float] | None = None,
) -> list[dict]:
    """Run equilibrium for a sweep of crowding coefficients."""
    if gamma_values is None:
        gamma_values = [0.0, 0.01, 0.05, 0.1, 0.25, 0.5, 1.0]

    players = CANONICAL_PLAYERS[:6]
    results = []

    for gamma in gamma_values:
        eq = compute_nash_equilibrium(players, prices, date, gamma=gamma)
        composition = strategy_composition(eq.weights)
        overlap = aggregate_overlap(eq.weights)
        conc = concentration_report(eq.weights)

        results.append({
            "gamma": gamma,
            "converged": eq.converged,
            "iterations": eq.iterations,
            "total_utility": eq.total_utility,
            "utilities": eq.utilities,
            "strategy_composition": composition,
            "aggregate_overlap": overlap,
            "concentration": conc,
        })

    return results


# ---------------------------------------------------------------------------
# Experiment C: Temporal Stability
# ---------------------------------------------------------------------------

def run_experiment_c(
    prices: pd.DataFrame,
    dates: list[pd.Timestamp],
    gamma: float = 0.05,
) -> list[dict]:
    """Compute equilibrium at each walk-forward rebalance date."""
    players = CANONICAL_PLAYERS[:6]
    results = []
    prev_weights = None  # first period: equal-weight init

    for date in dates:
        eq = compute_nash_equilibrium(
            players, prices, date, prev_weights=prev_weights, gamma=gamma
        )
        composition = strategy_composition(eq.weights)
        overlap = aggregate_overlap(eq.weights)

        results.append({
            "date": str(date),
            "converged": eq.converged,
            "iterations": eq.iterations,
            "total_utility": eq.total_utility,
            "strategy_composition": composition,
            "aggregate_overlap": overlap,
        })

        # Carry forward weights for turnover calculation next period
        prev_weights = eq.weights

    return results


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def main():
    ensure_dirs()

    # Load data
    print("Loading price data...")
    prices = load_price_panel(
        universe="top500",
        data_dir=RUN_DIR.parent
        / "findings/2026-04-23-context-aware-grand-study/data",
    )
    print(f"  Loaded {len(prices.columns)} assets, {len(prices)} dates")

    # Pick representative dates
    mid_date = prices.index[len(prices.index) // 2]
    recent_date = prices.index[-63]

    # --- Experiment A ---
    print(f"\n=== Experiment A: Strategy Arms as Players (γ=0.05) ===")
    result_a_mid = run_experiment_a(prices, mid_date, gamma=0.05)
    result_a_recent = run_experiment_a(prices, recent_date, gamma=0.05)

    with open(METRICS_DIR / "experiment_a_mid.json", "w") as f:
        json.dump(result_a_mid, f, indent=2, default=str)
    with open(METRICS_DIR / "experiment_a_recent.json", "w") as f:
        json.dump(result_a_recent, f, indent=2, default=str)
    print(f"  Mid-date: converged={result_a_mid['converged']}, "
          f"iterations={result_a_mid['iterations']}, "
          f"total_util={result_a_mid['total_utility']:.6f}")
    print(f"  Recent: converged={result_a_recent['converged']}, "
          f"iterations={result_a_recent['iterations']}, "
          f"total_util={result_a_recent['total_utility']:.6f}")

    # --- Experiment B ---
    print(f"\n=== Experiment B: Crowding Sensitivity ===")
    gamma_sweep = [0.0, 0.01, 0.05, 0.1, 0.25, 0.5, 1.0]
    results_b = run_experiment_b(prices, recent_date, gamma_values=gamma_sweep)

    with open(METRICS_DIR / "experiment_b_gamma_sweep.json", "w") as f:
        json.dump(results_b, f, indent=2, default=str)
    for r in results_b:
        print(f"  γ={r['gamma']:.2f}: total_util={r['total_utility']:.6f}, "
              f"overlap={r['aggregate_overlap']:.4f}, "
              f"converged={r['converged']}")

    # --- Experiment C ---
    print(f"\n=== Experiment C: Temporal Stability ===")
    # Sample every ~63 trading days (quarterly)
    sample_dates = prices.index[::63][:20]  # up to 20 windows
    results_c = run_experiment_c(prices, list(sample_dates), gamma=0.05)

    with open(METRICS_DIR / "experiment_c_temporal.json", "w") as f:
        json.dump(results_c, f, indent=2, default=str)
    print(f"  Computed equilibrium at {len(results_c)} windows")
    print(f"  Converged rate: {sum(1 for r in results_c if r['converged'])}/{len(results_c)}")

    print("\nDone. Results saved to game_theoretic/metrics/")


if __name__ == "__main__":
    main()
