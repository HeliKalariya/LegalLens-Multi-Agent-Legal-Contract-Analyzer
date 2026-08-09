from fastapi import APIRouter
from fastapi import Depends

from sqlalchemy.orm import Session

from app.database.session import get_db

from app.security.oauth import get_current_user

from app.models.user import User

from app.services.dashboard_service import DashboardService

from app.schemas.dashboard import (
    DashboardOverviewResponse,
    RiskDistributionResponse,
    AnalysisHistoryResponse
)


router = APIRouter(

    prefix="/api/dashboard",

    tags=["Dashboard"]

)


# ==========================================
# DASHBOARD OVERVIEW
# ==========================================

@router.get(
    "/overview",
    response_model=DashboardOverviewResponse
)
def get_dashboard_overview(

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user)

):

    service = DashboardService(db)

    return service.get_overview(
        current_user.id
    )


# ==========================================
# RISK DISTRIBUTION
# ==========================================

@router.get(
    "/risk-distribution",
    response_model=RiskDistributionResponse
)
def get_risk_distribution(

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user)

):

    service = DashboardService(db)

    return service.get_risk_distribution(
        current_user.id
    )


# ==========================================
# ANALYSIS HISTORY
# ==========================================

@router.get(
    "/analysis-history",
    response_model=AnalysisHistoryResponse
)
def get_analysis_history(

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user)

):

    service = DashboardService(db)

    history = service.get_analysis_history(
        current_user.id
    )

    return {

        "history": history

    }