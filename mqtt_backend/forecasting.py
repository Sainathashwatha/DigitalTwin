def predict_next(history: list, steps: int = 10):
    """
    Predict next points using moving average and linear extrapolation.
    Zero heavy dependencies (no Prophet or pandas required).
    """
    if not history or len(history) == 0:
        return [0.0] * steps

    clean_history = [float(x) for x in history]

    if len(clean_history) < 3:
        return [round(clean_history[-1], 3)] * steps

    # Rolling average and momentum trend
    window = min(len(clean_history), 5)
    recent = clean_history[-window:]
    last_val = clean_history[-1]
    avg_val = sum(recent) / float(window)
    
    # Calculate simple slope
    trend_delta = (last_val - recent[0]) / float(window)

    forecast = []
    for i in range(1, steps + 1):
        # Projected value with decayed trend
        projected = last_val + (trend_delta * (0.85 ** i) * i)
        forecast.append(round(max(0.0, projected), 3))

    return forecast