from sqlalchemy import func, literal_column
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

    def get_average_risk_score(self, user_id: int):

        return (
            self.db.query(func.avg(DocumentAnalysis.overall_risk_score))
            .join(
                Document,
                Document.id == DocumentAnalysis.document_id
            )
            .filter(
                Document.user_id == user_id,
                DocumentAnalysis.overall_risk_score.isnot(None)
            )
            .scalar()
        )

    # -----------------------------------
    # RISK DISTRIBUTION
    # -----------------------------------

    def get_risk_distribution(self, user_id: int):

        results = (
            self.db.query(
                Clause.risk_level,
                func.count(Clause.id),
            )
            .join(
                Document,
                Document.id == Clause.document_id
            )
            .filter(Document.user_id == user_id)
            .group_by(Clause.risk_level)
            .all()
        )

        return results

    # -----------------------------------
    # ANALYSIS HISTORY
    # -----------------------------------

    def get_analysis_history(self, user_id: int):
        # Keep the same literal expression in SELECT/GROUP BY/ORDER BY. PostgreSQL
        # cannot prove that separately-bound "month" parameters are equivalent.
        report_timestamp = func.coalesce(Report.generated_at, Report.created_at)
        report_month = func.date_trunc(literal_column("'month'"), report_timestamp)

        return (
            self.db.query(
                report_month.label("month"),
                func.count(Report.id).label("reports_generated"),
                func.avg(DocumentAnalysis.overall_risk_score).label("average_risk_score"),
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
                report_timestamp.isnot(None)
            )
            .group_by(report_month)
            .order_by(report_month.asc())
            .all()
        )
