"""
Mock civic endpoint (IT-05).

A stand-in for a municipality's report intake. Accepts a Report payload,
returns HTTP 200 with an acknowledgement id. Run on port 8001:

    uvicorn trashtrack.civic_api:app --port 8001
"""
from __future__ import annotations

import uuid
from typing import Dict

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Mock Civic Endpoint")
_store: Dict[str, dict] = {}


class Ack(BaseModel):
    civic_ack_id: str
    status: str = "acknowledged"


@app.post("/reports", response_model=Ack)
def receive_report(report: dict):
    ack_id = f"CIVIC-{uuid.uuid4().hex[:10]}"
    _store[ack_id] = report
    return Ack(civic_ack_id=ack_id)


@app.get("/reports/count")
def count():
    return {"received": len(_store)}
