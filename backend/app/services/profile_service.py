from sqlalchemy.orm import Session
from fastapi import UploadFile

from app.repositories.profile_repository import ProfileRepository

from app.security.hashing import (
    verify_password,
    hash_password
)

import os
import shutil
from uuid import uuid4




class ProfileService:

    def __init__(self, db: Session):

        self.repository = ProfileRepository(db)


    
    
    # ==========================
    # Get Profile
    # ==========================
    def get_profile(self, user_id: int):

        user = self.repository.get_profile(user_id)

        if not user:
            raise ValueError("User not found")

        return user

    # ==========================
    # Update Profile
    # ==========================
    def update_profile(
        self,
        user_id: int,
        full_name: str,
        organization: str,
        job_title: str
    ):

        user = self.repository.get_profile(user_id)

        if not user:
            raise ValueError("User not found")

        return self.repository.update_profile(
            user,
            full_name,
            organization,
            job_title
        )

    # ==========================
    # Change Password
    # ==========================
    def change_password(
        self,
        user_id: int,
        current_password: str,
        new_password: str
    ):

        user = self.repository.get_profile(user_id)

        if not user:
            raise ValueError("User not found")

        if not verify_password(
            current_password,
            user.hashed_password
        ):
            raise ValueError("Current password is incorrect")

        hashed_password = hash_password(new_password)

        self.repository.update_password(
            user,
            hashed_password
        )

        return {
            "success": True,
            "message": "Password changed successfully."
        }

    # ==========================
    # Update Profile Image
    # ==========================
    def update_profile_image(
        self,
        user_id: int,
        image_path: str
    ):

        user = self.repository.get_profile(user_id)

        if not user:
            raise ValueError("User not found")

        self.repository.update_profile_image(
            user,
            image_path
        )

        return {
            "success": True,
            "message": "Profile image uploaded successfully."
        }

    # ==========================
    # Delete Profile Image
    # ==========================
    def delete_profile_image(
        self,
        user_id: int
    ):

        user = self.repository.get_profile(user_id)

        if not user:
            raise ValueError("User not found")

        self.repository.delete_profile_image(user)

        return {
            "success": True,
            "message": "Profile image deleted successfully."
        }
    
    def upload_profile_image(
        self,
        user_id: int,
        file: UploadFile
    ):
        user = self.repository.get_profile(user_id)

        if not user:
            raise ValueError("User not found")

        # Allowed image types
        allowed_extensions = [
            ".jpg",
            ".jpeg",
            ".png"
        ]

        extension = os.path.splitext(file.filename)[1].lower()

        if extension not in allowed_extensions:
            raise ValueError(
                "Only JPG, JPEG and PNG images are allowed."
            )

        # Create unique filename
        filename = f"{uuid4()}{extension}"

        upload_dir = "uploads/profile"

        os.makedirs(upload_dir, exist_ok=True)

        file_path = os.path.join(upload_dir, filename)

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        image_path = f"/uploads/profile/{filename}"

        self.repository.update_profile_image(
            user,
            image_path
        )

        return {
            "success": True,
            "message": "Profile image uploaded successfully.",
            "image_url": image_path
        }