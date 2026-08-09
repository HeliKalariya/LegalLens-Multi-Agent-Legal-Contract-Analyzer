from collections import defaultdict

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

        risk_scores = (
            self.repository.get_risk_scores(user_id)
        )

        scores = [
            float(row[0])
            for row in risk_scores
            if row[0] is not None
        ]

        if scores:

            average_risk_score = round(
                sum(scores) / len(scores),
                2
            )

        else:

            average_risk_score = 0.0

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

        for row in results:

            risk = row[0]

            if not risk:
                continue

            risk = risk.upper().strip()

            if risk in {"LOW RISK", "SAFE", "LOW"}:

                safe += 1

            elif risk in {"MODERATE RISK", "MEDIUM", "MODERATE"}:

                moderate += 1

            elif risk in {"HIGH RISK", "HIGH"}:

                high += 1

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

        monthly_data = defaultdict(
            lambda: {
                "reports": 0,
                "scores": []
            }
        )

        for generated_at, risk_score in results:

            if generated_at is None:
                continue

            month_key = generated_at.strftime("%Y-%m")

            monthly_data[month_key]["reports"] += 1

            if risk_score is not None:

                monthly_data[month_key]["scores"].append(
                    float(risk_score)
                )

        history = []

        for month in sorted(monthly_data.keys()):

            data = monthly_data[month]

            scores = data["scores"]

            if scores:

                average_score = round(
                    sum(scores) / len(scores),
                    2
                )

            else:

                average_score = 0.0

            history.append({

                "month": month,

                "reports_generated":
                    data["reports"],

                "average_risk_score":
                    average_score

            })

        return history
