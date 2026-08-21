from pydantic import BaseModel
from typing import List


class DashboardOverviewResponse(BaseModel):

    total_documents: int
    analyzed_documents: int
    total_clauses: int
    reports_generated: int
    average_risk_score: float


class RiskDistributionResponse(BaseModel):

    safe: float
    moderate: float
    high: float


class AnalysisHistoryItem(BaseModel):

    month: str
    reports_generated: int
    average_risk_score: float


class AnalysisHistoryResponse(BaseModel):

    history: List[AnalysisHistoryItem]


class DashboardPageResponse(BaseModel):
    """Single payload used by the dashboard cards and charts."""

    overview: DashboardOverviewResponse
    risk_distribution: RiskDistributionResponse
    history: List[AnalysisHistoryItem]
