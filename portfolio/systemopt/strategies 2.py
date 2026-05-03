"""Strategy definitions for the improved Snapshot 2 study."""

from __future__ import annotations

from dataclasses import dataclass, field

import cvxpy as cp
import numpy as np
import pandas as pd

from snapshot_research.universe import DEFENSIVE, RISKY, UNIVERSE


def rebalance_dates(index: pd.DatetimeIndex, frequency: str = "ME") -> set[pd.Timestamp]:
    return set(pd.Series(index, index=index).resample(frequency).last().dropna().tolist())


def zscore(series: pd.Series) -> pd.Series:
    std = series.std(ddof=0)
    if std <= 1e-12 or np.isnan(std):
        return pd.Series(0.0, index=series.index)
    return (series - series.mean()) / std


def simple_shrinkage_cov(returns: pd.DataFrame, shrink: float = 0.35) -> pd.DataFrame:
    sample = returns.cov()
    diag = pd.DataFrame(np.diag(np.diag(sample)), index=sample.index, columns=sample.columns)
    return (1 - shrink) * sample + shrink * diag + np.eye(len(sample)) * 1e-6


def inverse_vol_weights(returns: pd.DataFrame, assets: list[str], lookback: int = 63, cap: float = 0.35) -> pd.Series:
    vol = returns[assets].tail(lookback).std() * np.sqrt(252)
    raw = 1.0 / vol.replace(0, np.nan)
    raw = raw.replace([np.inf, -np.inf], np.nan).fillna(0.0)
    if raw.sum() <= 0:
        return pd.Series(1 / len(assets), index=assets)
    weights = raw / raw.sum()
    weights = weights.clip(upper=cap)
    return weights / weights.sum()


def optimize_risky_weights(
    score: pd.Series,
    cov: pd.DataFrame,
    prev_weights: pd.Series,
    target_sum: float,
    max_weight: float = 0.22,
    risk_aversion: float = 7.0,
    turnover_penalty: float = 12.0,
) -> pd.Series:
    if target_sum <= 0 or score.sum() <= 0:
        return pd.Series(0.0, index=score.index)

    assets = list(score.index)
    n_assets = len(assets)
    w = cp.Variable(n_assets)
    objective = (
        score.values @ w
        - risk_aversion * cp.quad_form(w, cov.values)
        - turnover_penalty * cp.sum_squares(w - prev_weights.values)
    )
    constraints = [
        cp.sum(w) == target_sum,
        w >= 0.0,
        w <= max_weight,
    ]
    problem = cp.Problem(cp.Maximize(objective), constraints)
    for solver in [cp.OSQP, cp.ECOS, cp.SCS]:
        try:
            problem.solve(solver=solver, verbose=False)
        except Exception:
            continue
        if w.value is not None:
            solution = pd.Series(np.maximum(w.value, 0.0), index=assets)
            total = solution.sum()
            return solution / total * target_sum if total > 0 else pd.Series(0.0, index=assets)

    fallback = score.clip(lower=0.0)
    if fallback.sum() <= 0:
        return pd.Series(0.0, index=assets)
    fallback = fallback / fallback.sum() * target_sum
    return fallback


@dataclass
class StrategyState:
    current_weights: pd.Series = field(default_factory=lambda: pd.Series(0.0, index=UNIVERSE))
    equity_peak: float = 1.0
    current_drawdown: float = 0.0


def benchmark_spy(_: pd.DataFrame, __: pd.DataFrame, ___: StrategyState) -> pd.Series:
    weights = pd.Series(0.0, index=UNIVERSE)
    weights["SPY"] = 1.0
    return weights


def benchmark_6040(_: pd.DataFrame, __: pd.DataFrame, ___: StrategyState) -> pd.Series:
    weights = pd.Series(0.0, index=UNIVERSE)
    weights["SPY"] = 0.6
    weights["IEF"] = 0.4
    return weights


def benchmark_equal_weight(_: pd.DataFrame, __: pd.DataFrame, ___: StrategyState) -> pd.Series:
    weights = pd.Series(0.0, index=UNIVERSE)
    assets = RISKY + ["IEF", "GLD"]
    weights.loc[assets] = 1.0 / len(assets)
    return weights


def benchmark_inverse_vol(prices: pd.DataFrame, returns: pd.DataFrame, _: StrategyState) -> pd.Series:
    weights = pd.Series(0.0, index=UNIVERSE)
    assets = RISKY + ["IEF", "GLD"]
    weights.loc[assets] = inverse_vol_weights(returns, assets, lookback=63)
    return weights


def benchmark_dual_momentum(prices: pd.DataFrame, returns: pd.DataFrame, _: StrategyState) -> pd.Series:
    weights = pd.Series(0.0, index=UNIVERSE)
    lookback = 252
    momentum = prices[RISKY].iloc[-1] / prices[RISKY].iloc[-lookback] - 1.0
    top_assets = momentum.sort_values(ascending=False).index[:3]
    absolute_filter = momentum[top_assets] > prices["BIL"].iloc[-1] / prices["BIL"].iloc[-lookback] - 1.0
    selected = list(top_assets[absolute_filter])
    if selected:
        weights.loc[selected] = inverse_vol_weights(returns, selected, lookback=63)
    else:
        defensive = ["IEF", "GLD", "BIL"]
        weights.loc[defensive] = inverse_vol_weights(returns, defensive, lookback=63)
    return weights


def improved_snapshot2(prices: pd.DataFrame, returns: pd.DataFrame, state: StrategyState) -> pd.Series:
    weights = pd.Series(0.0, index=UNIVERSE)
    cfg = IMPROVED_CONFIG

    ret_21 = prices[RISKY].iloc[-1] / prices[RISKY].iloc[-22] - 1.0
    ret_126 = prices[RISKY].iloc[-1] / prices[RISKY].iloc[-127] - 1.0
    ret_252 = prices[RISKY].iloc[-1] / prices[RISKY].iloc[-253] - 1.0
    ma_200 = prices[RISKY].tail(200).mean()
    vol_63 = returns[RISKY].tail(63).std() * np.sqrt(252)

    score = 0.5 * zscore(ret_126) + 0.35 * zscore(ret_252) - 0.1 * zscore(ret_21) - 0.05 * zscore(vol_63)
    eligible = (ret_252 > 0) & (prices[RISKY].iloc[-1] > ma_200)
    positive_score = score.clip(lower=0.0)
    positive_score[~eligible] = 0.0

    breadth = float(eligible.mean())
    if breadth >= 0.6:
        risky_budget = cfg["risk_budget_high"]
    elif breadth >= 0.4:
        risky_budget = cfg["risk_budget_mid"]
    elif breadth >= 0.2:
        risky_budget = cfg["risk_budget_low"]
    else:
        risky_budget = cfg["risk_budget_floor"]

    if state.current_drawdown <= cfg["drawdown_hard"]:
        risky_budget *= cfg["drawdown_hard_scale"]
    elif state.current_drawdown <= cfg["drawdown_soft"]:
        risky_budget *= cfg["drawdown_soft_scale"]

    if positive_score.sum() > 0:
        selected = list(positive_score[positive_score > 0].index)
        cov = simple_shrinkage_cov(returns[selected].tail(126))
        prev_risky = state.current_weights.reindex(selected).fillna(0.0)
        raw_risky = optimize_risky_weights(
            score=positive_score[selected],
            cov=cov,
            prev_weights=prev_risky,
            target_sum=risky_budget,
            max_weight=cfg["max_weight"],
            risk_aversion=cfg["risk_aversion"],
            turnover_penalty=cfg["turnover_penalty"],
        )
        ex_ante_vol = float(np.sqrt(max(raw_risky.values @ cov.values @ raw_risky.values, 0.0)) * np.sqrt(252))
        if ex_ante_vol > 1e-8:
            vol_scale = np.clip(cfg["target_vol"] / ex_ante_vol, cfg["vol_floor"], cfg["vol_cap"])
        else:
            vol_scale = 1.0
        risky_budget *= float(vol_scale)
        risky_weights = optimize_risky_weights(
            score=positive_score[selected],
            cov=cov,
            prev_weights=prev_risky,
            target_sum=risky_budget,
            max_weight=cfg["max_weight"],
            risk_aversion=cfg["risk_aversion"],
            turnover_penalty=cfg["turnover_penalty"],
        )
        weights.loc[selected] = risky_weights

    defensive_budget = 1.0 - weights.sum()
    defensive_mom = prices[DEFENSIVE].iloc[-1] / prices[DEFENSIVE].iloc[-127] - 1.0
    defensive_candidates = defensive_mom[defensive_mom > -0.02].index.tolist() or ["BIL"]
    defensive_weights = inverse_vol_weights(returns, defensive_candidates, lookback=63, cap=0.7)
    weights.loc[defensive_candidates] += defensive_budget * defensive_weights

    total = weights.sum()
    if total <= 0:
        weights["BIL"] = 1.0
        return weights
    weights = weights / total
    return weights


STRATEGIES = {
    "SPY": benchmark_spy,
    "60_40": benchmark_6040,
    "equal_weight": benchmark_equal_weight,
    "inverse_vol": benchmark_inverse_vol,
    "dual_momentum": benchmark_dual_momentum,
    "improved_snapshot2": improved_snapshot2,
}


IMPROVED_CONFIG = {
    "risk_budget_high": 1.0,
    "risk_budget_mid": 1.0,
    "risk_budget_low": 0.6,
    "risk_budget_floor": 0.2,
    "drawdown_soft": -0.10,
    "drawdown_hard": -0.15,
    "drawdown_soft_scale": 0.8,
    "drawdown_hard_scale": 0.5,
    "target_vol": 0.18,
    "vol_floor": 0.35,
    "vol_cap": 1.0,
    "max_weight": 0.30,
    "risk_aversion": 4.0,
    "turnover_penalty": 8.0,
}
