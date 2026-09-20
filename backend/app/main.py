from fastapi import FastAPI

app = FastAPI(title="FisioMove API")


@app.get("/health")
def health() -> dict[str, str]:
    """Return the API readiness status."""
    return {"status": "ok"}
