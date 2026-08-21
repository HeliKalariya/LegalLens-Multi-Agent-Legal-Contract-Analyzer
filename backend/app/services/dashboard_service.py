from app.repositories.dashboard_repository import DashboardRepository


class DashboardService:

    def __init__(self, db):

        self.repository = DashboardRepository(db)

    # ==========================================
    # DASHBOARD OVERVIEW
    # ==========================================

    def get_overview(self, user_id: int):

        total_documents = (
            self.repository.get_total_documents(user_id)
        )

        analyzed_documents = (
            self.repository.get_analyzed_documents(user_id)
        )

        total_clauses = (
            self.repository.get_total_clauses(user_id)
        )

        reports_generated = (
            self.repository.get_reports_generated(user_id)
        )

        average_risk_score = self.repository.get_average_risk_score(user_id)
        average_risk_score = round(float(average_risk_score), 2) if average_risk_score is not None else 0.0

        return {

            "total_documents": total_documents,

            "analyzed_documents": analyzed_documents,

            "total_clauses": total_clauses,

            "reports_generated": reports_generated,

            "average_risk_score": average_risk_score

        }

    # ==========================================
    # RISK DISTRIBUTION
    # ==========================================

    def get_risk_distribution(self, user_id: int):

        results = (
            self.repository.get_risk_distribution(user_id)
        )

        safe = 0
        moderate = 0
        high = 0

        for risk, count in results:

            if not risk:
                continue

            risk = risk.upper().strip()

            if risk in {"LOW RISK", "SAFE", "LOW"}:

                safe += count

            elif risk in {"MODERATE RISK", "MEDIUM", "MODERATE"}:

                moderate += count

            elif risk in {"HIGH RISK", "HIGH"}:

                high += count

        total = safe + moderate + high

        if total == 0:

            return {

                "safe": 0.0,

                "moderate": 0.0,

                "high": 0.0

            }

        return {
            "safe": round((safe / total) * 100, 2),
            "moderate": round((moderate / total) * 100, 2),
            "high": round((high / total) * 100, 2)
        }

    # ==========================================
    # ANALYSIS HISTORY
    # ==========================================

    def get_analysis_history(self, user_id: int):

        results = (
            self.repository.get_analysis_history(user_id)
        )

        return [
            {
                "month": month.strftime("%Y-%m"),
                "reports_generated": int(report_count),
                "average_risk_score": round(float(average_score), 2) if average_score is not None else 0.0,
            }
            for month, report_count, average_score in results
            if month is not None
        ]
