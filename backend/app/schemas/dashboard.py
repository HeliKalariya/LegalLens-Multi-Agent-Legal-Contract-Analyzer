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
    documents_analyzed: int
    average_risk_score: float


class AnalysisHistoryResponse(BaseModel):

    history: List[AnalysisHistoryItem]