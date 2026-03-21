from prophet import Prophet
import pandas as pd

def predict_next(history, steps=10):
    """
    history = list of kW values
    steps = how many future points to predict
    """

    if len(history) < 5:
        return [history[-1]] * steps if history else [0] * steps

    # Convert to dataframe
    df = pd.DataFrame({
        "ds": pd.date_range(start="2024-01-01", periods=len(history), freq="T"),
        "y": history
    })

    # Train model
    model = Prophet()
    model.fit(df)

    # Future timestamps
    future = model.make_future_dataframe(periods=steps, freq="T")
    forecast = model.predict(future)

    # Return only future predictions
    return forecast["yhat"].tail(steps).tolist()