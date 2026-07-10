import type { TimeSeries, TimeSeriesPoint, ForecastResult, ForecastPoint, ForecastMethod } from '../../types/analytics';

export class PredictiveAnalytics {
  forecast(ts: TimeSeries, horizon: number, method?: ForecastMethod): ForecastResult {
    const m = method ?? 'linear';
    const history = ts.points;
    const forecast = this.runForecast(history, horizon, m);
    const metrics = this.computeMetrics(history, forecast);
    return {
      method: m,
      seriesId: ts.id,
      horizon,
      history,
      forecast,
      metrics,
      generatedAt: new Date().toISOString(),
    };
  }

  private runForecast(history: TimeSeriesPoint[], horizon: number, method: ForecastMethod): ForecastPoint[] {
    switch (method) {
      case 'moving-avg': return this.movingAvgForecast(history, horizon);
      case 'exp-smoothing': return this.expSmoothingForecast(history, horizon);
      case 'seasonal-naive': return this.seasonalNaiveForecast(history, horizon);
      default: return this.linearForecast(history, horizon);
    }
  }

  private linearForecast(history: TimeSeriesPoint[], horizon: number): ForecastPoint[] {
    const n = history.length;
    const indices = history.map((_, i) => i);
    const xMean = (n - 1) / 2;
    const yMean = history.reduce((s, p) => s + p.v, 0) / n;
    const num = indices.reduce((s, i) => s + (i - xMean) * (history[i]!.v - yMean), 0);
    const den = indices.reduce((s, i) => s + (i - xMean) ** 2, 0);
    const slope = den ? num / den : 0;
    const intercept = yMean - slope * xMean;
    const residuals = history.map((p, i) => Math.abs(p.v - (intercept + slope * i)));
    const stdErr = residuals.reduce((s, r) => s + r * r, 0) / Math.max(1, n - 2);
    const se = Math.sqrt(stdErr);

    const lastT = new Date(history[n - 1]!.t).getTime();
    const interval = n > 1 ? (lastT - new Date(history[0]!.t).getTime()) / (n - 1) : 86400000;
    return Array.from({ length: horizon }, (_, i) => {
      const idx = n + i;
      const predicted = intercept + slope * idx;
      const t = new Date(lastT + (i + 1) * interval).toISOString();
      return {
        t,
        predicted: Math.round(predicted * 10) / 10,
        lower: Math.round((predicted - 1.96 * se) * 10) / 10,
        upper: Math.round((predicted + 1.96 * se) * 10) / 10,
      };
    });
  }

  private movingAvgForecast(history: TimeSeriesPoint[], horizon: number, window = 3): ForecastPoint[] {
    const vals = history.map(p => p.v);
    const lastT = new Date(history[history.length - 1]!.t).getTime();
    const interval = history.length > 1 ? (lastT - new Date(history[0]!.t).getTime()) / (history.length - 1) : 86400000;
    const std = this.std(vals);
    return Array.from({ length: horizon }, (_, i) => {
      const slice = vals.slice(vals.length - window);
      const predicted = slice.reduce((s, v) => s + v, 0) / slice.length;
      const t = new Date(lastT + (i + 1) * interval).toISOString();
      return {
        t,
        predicted: Math.round(predicted * 10) / 10,
        lower: Math.round((predicted - 1.96 * std) * 10) / 10,
        upper: Math.round((predicted + 1.96 * std) * 10) / 10,
      };
    });
  }

  private expSmoothingForecast(history: TimeSeriesPoint[], horizon: number, alpha = 0.3): ForecastPoint[] {
    const vals = history.map(p => p.v);
    let smoothed = vals[0] ?? 0;
    for (let i = 1; i < vals.length; i++) {
      smoothed = alpha * vals[i]! + (1 - alpha) * smoothed;
    }
    const lastT = new Date(history[history.length - 1]!.t).getTime();
    const interval = history.length > 1 ? (lastT - new Date(history[0]!.t).getTime()) / (history.length - 1) : 86400000;
    const std = this.std(vals);
    return Array.from({ length: horizon }, (_, i) => {
      const t = new Date(lastT + (i + 1) * interval).toISOString();
      return {
        t,
        predicted: Math.round(smoothed * 10) / 10,
        lower: Math.round((smoothed - 1.96 * std) * 10) / 10,
        upper: Math.round((smoothed + 1.96 * std) * 10) / 10,
      };
    });
  }

  private seasonalNaiveForecast(history: TimeSeriesPoint[], horizon: number, seasonLength = 7): ForecastPoint[] {
    const vals = history.map(p => p.v);
    const lastT = new Date(history[history.length - 1]!.t).getTime();
    const interval = history.length > 1 ? (lastT - new Date(history[0]!.t).getTime()) / (history.length - 1) : 86400000;
    const std = this.std(vals);
    return Array.from({ length: horizon }, (_, i) => {
      const seasonalIdx = Math.max(0, vals.length - seasonLength + (i % seasonLength));
      const predicted = vals[Math.min(seasonalIdx, vals.length - 1)] ?? vals[vals.length - 1]!;
      const t = new Date(lastT + (i + 1) * interval).toISOString();
      return {
        t,
        predicted: Math.round(predicted * 10) / 10,
        lower: Math.round((predicted - 1.96 * std) * 10) / 10,
        upper: Math.round((predicted + 1.96 * std) * 10) / 10,
      };
    });
  }

  private computeMetrics(history: TimeSeriesPoint[], forecast: ForecastPoint[]): { mae: number; mape: number; rmse: number } {
    if (!history.length || !forecast.length) return { mae: 0, mape: 0, rmse: 0 };
    const n = Math.min(history.length, forecast.length);
    let absErrSum = 0;
    let pctErrSum = 0;
    let sqErrSum = 0;
    let validPctCount = 0;
    for (let i = 0; i < n; i++) {
      const actual = history[i]!.v;
      const predicted = forecast[i]!.predicted;
      const err = actual - predicted;
      const absErr = Math.abs(err);
      absErrSum += absErr;
      sqErrSum += err * err;
      if (actual !== 0) {
        pctErrSum += absErr / Math.abs(actual);
        validPctCount++;
      }
    }
    const mae = absErrSum / n;
    const rmse = Math.sqrt(sqErrSum / n);
    const mape = validPctCount > 0 ? (pctErrSum / validPctCount) * 100 : 0;
    return {
      mae: Math.round(mae * 1000) / 1000,
      mape: Math.round(mape * 1000) / 1000,
      rmse: Math.round(rmse * 1000) / 1000,
    };
  }

  private std(vals: number[]): number {
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
    const sq = vals.reduce((s, v) => s + (v - mean) ** 2, 0);
    return Math.sqrt(sq / vals.length);
  }
}

export const predictiveAnalytics = new PredictiveAnalytics();
