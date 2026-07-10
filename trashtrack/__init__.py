"""TrashTrack: AI for city trash detection & reporting (MSDS 498 Capstone, Group 4)."""
__version__ = "0.1.0"

from .schema import Image, Detection, Report, ImageSource, GeoSource, Severity, ReportStatus  # noqa: F401
from .pipeline import TrashTrackPipeline, PipelineResult  # noqa: F401
