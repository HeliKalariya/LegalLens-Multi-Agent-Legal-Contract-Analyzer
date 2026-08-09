from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.document import Document
from app.models.document_analysis import DocumentAnalysis

# Change these imports only if your model class names are different
from app.models.clause import Clause
from app.models.report import Report


class DashboardRepository:

    def __init__(self, db: Session):

        self.db = db

    # -----------------------------------
    # TOTAL DOCUMENTS
    # -----------------------------------

    def get_total_documents(self, user_id: int):

        return (
            self.db.query(Document)
            .filter(Document.user_id == user_id)
            .count()
        )

    # -----------------------------------
    # ANALYZED DOCUMENTS
    # -----------------------------------

    def get_analyzed_documents(self, user_id: int):

        return (
            self.db.query(DocumentAnalysis)
            .join(
                Document,
                Document.id == DocumentAnalysis.document_id
            )
            .filter(Document.user_id == user_id)
            .count()
        )

    # -----------------------------------
    # TOTAL CLAUSES
    # -----------------------------------

    def get_total_clauses(self, user_id: int):

        return (
            self.db.query(Clause)
            .join(
                Document,
                Document.id == Clause.document_id
            )
            .filter(Document.user_id == user_id)
            .count()
        )

    # -----------------------------------
    # REPORTS GENERATED
    # -----------------------------------

    def get_reports_generated(self, user_id: int):

        return (
            self.db.query(Report)
            .join(
                Document,
                Document.id == Report.document_id
            )
            .filter(Document.user_id == user_id)
            .count()
        )

    # -----------------------------------
    # RISK SCORES
    # -----------------------------------

    def get_risk_scores(self, user_id: int):

        return (
            self.db.query(
                DocumentAnalysis.overall_risk_score
            )
            .join(
                Document,
                Document.id == DocumentAnalysis.document_id
            )
            .filter(
                Document.user_id == user_id,
                DocumentAnalysis.overall_risk_score.isnot(None)
            )
            .all()
        )

    # -----------------------------------
    # RISK DISTRIBUTION
    # -----------------------------------

    def get_risk_distribution(self, user_id: int):

        results = (
            self.db.query(
                Clause.risk_level
            )
            .join(
                Document,
                Document.id == Clause.document_id
            )
            .filter(
                Document.user_id == user_id
            )
            .all()
        )

        return results

    # -----------------------------------
    # ANALYSIS HISTORY
    # -----------------------------------

    def get_analysis_history(self, user_id: int):

       return (
            self.db.query(
                func.coalesce(Report.generated_at, Report.created_at),
                DocumentAnalysis.overall_risk_score
            )
            .join(
                Document,
                Document.id == Report.document_id
            )
            .join(
                DocumentAnalysis,
                DocumentAnalysis.id == Report.analysis_id
            )
            .filter(
                Document.user_id == user_id,
                func.coalesce(Report.generated_at, Report.created_at).isnot(None)
            )
            .order_by(
                func.coalesce(Report.generated_at, Report.created_at).asc()
            )
            .all()
        )
