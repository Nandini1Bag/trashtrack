"""
C5 -- Reporting.

Turn detections into schema-valid `Report` records, assign severity, and route
to a civic endpoint (real mock API or an in-process stub).

Validated by: UT-05 (schema), UT-06 (severity rule), IT-04, IT-05, IT-07.
"""
from __future__ import annotations

from typing import List, Optional

from .config import settings
from .schema import Detection, Report, ReportStatus, Severity


# ---- UT-06: severity rule --------------------------------------------------
def assign_severity(detection: Detection) -> Severity:
    """Deterministic severity from confidence and object class.

    Rule (documented so tests can assert it):
      * high   : confidence >= 0.80, OR class in {broken glass, battery}
      * medium : 0.50 <= confidence < 0.80
      * low    : confidence < 0.50
    Hazardous classes are escalated one level (min 'medium').
    """
    hazardous = {"broken glass", "battery"}
    c = detection.confidence
    if c >= 0.80:
        base = Severity.high
    elif c >= 0.50:
        base = Severity.medium
    else:
        base = Severity.low

    if detection.class_label.lower() in hazardous and base == Severity.low:
        base = Severity.medium
    return base


def build_report(detection: Detection) -> Report:
    """UT-05: emit a schema-valid Report carrying class/confidence/time/location."""
    return Report(
        detection_id=detection.detection_id,
        latitude=detection.latitude,
        longitude=detection.longitude,
        severity=assign_severity(detection),
        status=ReportStatus.generated,
    )


# ---- civic routing ---------------------------------------------------------
class CivicRouter:
    """Routes reports to a civic endpoint over HTTP (IT-05)."""

    def __init__(self, endpoint: Optional[str] = None, timeout: Optional[float] = None):
        self.endpoint = endpoint or settings.civic_endpoint
        self.timeout = timeout or settings.civic_timeout_s

    def submit(self, report: Report) -> Report:
        import httpx  # lazy import
        report.status = ReportStatus.submitted
        resp = httpx.post(self.endpoint, json=report.model_dump(mode="json"),
                          timeout=self.timeout)
        resp.raise_for_status()
        ack = resp.json().get("civic_ack_id")
        report.civic_ack_id = ack
        report.status = ReportStatus.acknowledged
        return report


class InProcessCivicRouter:
    """No-network router for tests/demos. Mimics a civic API acknowledgement."""

    def __init__(self):
        self.received: List[Report] = []

    def submit(self, report: Report) -> Report:
        import uuid
        report.status = ReportStatus.submitted
        report.civic_ack_id = f"ACK-{uuid.uuid4().hex[:8]}"
        report.status = ReportStatus.acknowledged
        self.received.append(report)
        return report
