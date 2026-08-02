from sqlalchemy.orm import Session

from app.models.user import User


class ProfileRepository:

    def __init__(self, db: Session):

        self.db = db


    # ==========================
    # Get Current User
    # ==========================
    def get_profile(
        self,
        user_id: int
    ):

        return (
            self.db.query(User)
            .filter(User.id == user_id)
            .first()
        )


    # ==========================
    # Update Profile
    # ==========================
    def update_profile(
        self,
        user: User,
        full_name: str,
        organization: str,
        job_title: str
    ):

        user.full_name = full_name
        user.organization = organization
        user.job_title = job_title

        self.db.commit()

        self.db.refresh(user)

        return user


    # ==========================
    # Update Password
    # ==========================
    def update_password(
        self,
        user: User,
        hashed_password: str
    ):

        user.hashed_password = hashed_password

        self.db.commit()

        self.db.refresh(user)

        return user


    # ==========================
    # Update Profile Image
    # ==========================
    def update_profile_image(
        self,
        user: User,
        image_path: str
    ):

        user.profile_image = image_path

        self.db.commit()

        self.db.refresh(user)

        return user


    # ==========================
    # Delete Profile Image
    # ==========================
    def delete_profile_image(
        self,
        user: User
    ):

        user.profile_image = None

        self.db.commit()

        self.db.refresh(user)

        return user