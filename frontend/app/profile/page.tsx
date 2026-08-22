"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Camera, LoaderCircle, X } from "lucide-react";
import { toast } from "sonner";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { API_URL, authenticatedFetch } from "@/lib/api";
import { readPageCache, writePageCache } from "@/lib/client-cache";

type Profile = {
  full_name: string;
  email: string;
  organization: string | null;
  job_title: string | null;
  profile_image: string | null;
};

const emptyProfile: Profile = { full_name: "", email: "", organization: "", job_title: "", profile_image: null };

/** Lets the user update their account details and profile picture. */
export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [savedProfile, setSavedProfile] = useState<Profile>(emptyProfile);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const cachedProfile = readPageCache<Profile>("profile", 5 * 60_000);
    if (cachedProfile) {
      setProfile(cachedProfile);
      setSavedProfile(cachedProfile);
      setIsLoading(false);
    }

    async function loadProfile() {
      try {
        const response = await authenticatedFetch(`${API_URL}/api/auth/me`);
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail ?? "Could not load profile.");
        setProfile(result);
        setSavedProfile(result);
        writePageCache<Profile>("profile", result);
      } catch (error) {
        if (error instanceof Error) toast.error(error.message);
      } finally {
        setIsLoading(false);
      }
    }
    void loadProfile();
  }, []);

  const initials = profile.full_name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "U";
  const avatarUrl = profile.profile_image ? `${API_URL}${profile.profile_image}` : null;
  const hasChanges = JSON.stringify(profile) !== JSON.stringify(savedProfile);

  function updateField(field: keyof Profile, value: string) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  function publishProfile(updatedProfile: Profile) {
    setProfile(updatedProfile);
    setSavedProfile(updatedProfile);
    writePageCache<Profile>("profile", updatedProfile);
    window.dispatchEvent(new CustomEvent("profile-updated", { detail: updatedProfile }));
  }

  async function saveProfile() {
    setIsSaving(true);
    try {
      const response = await authenticatedFetch(`${API_URL}/api/auth/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...profile, organization: profile.organization || null, job_title: profile.job_title || null }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail ?? "Could not save changes.");
      localStorage.setItem("access_token", result.access_token);
      publishProfile(result.user);
      setIsEditing(false);
      toast.success("Profile changes saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save changes.");
    } finally {
      setIsSaving(false);
    }
  }

  async function chooseAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      toast.error("Choose a PNG or JPG image no larger than 2 MB.");
      event.target.value = "";
      return;
    }
    setIsUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await authenticatedFetch(`${API_URL}/api/auth/me/avatar`, { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail ?? "Could not upload profile photo.");
      publishProfile({ ...profile, profile_image: result.profile_image });
      toast.success("Profile photo updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not upload profile photo.");
    } finally {
      setIsUploadingAvatar(false);
      event.target.value = "";
    }
  }

  async function deleteAvatar() {
    if (!profile.profile_image) return;
    try {
      const response = await authenticatedFetch(`${API_URL}/api/auth/me/avatar`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail ?? "Could not remove profile photo.");
      publishProfile({ ...profile, profile_image: null });
      toast.success("Profile photo removed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove profile photo.");
    }
  }

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-6xl text-[#181211]">
        <header>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Profile</h1>
          <p className="mt-2 text-sm text-[#67758A] sm:text-base">Manage your account details and profile image.</p>
        </header>

        <section className="mt-6 rounded-2xl border border-black/15 bg-[#EAE6DB] p-5 shadow-sm sm:mt-8 sm:p-7">
          <div className="flex flex-col gap-5 border-b border-black/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold">Your profile</h2>
              <p className="mt-1 text-sm text-[#67758A]">Update the information shown across LegalLens.</p>
            </div>
            {!isLoading && !isEditing && <button type="button" onClick={() => setIsEditing(true)} className="rounded-xl bg-[#181211] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black">Edit profile</button>}
          </div>

          {isLoading ? <div className="flex h-56 items-center justify-center text-sm text-[#67758A]"><LoaderCircle className="mr-2 animate-spin" size={18} /> Loading profile...</div> : <>
            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative h-20 w-20 shrink-0">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-[#181211] text-xl font-bold text-white">{avatarUrl ? <img src={avatarUrl} alt="Profile avatar" className="h-full w-full object-cover" /> : initials}</div>
                {avatarUrl && <button type="button" onClick={() => void deleteAvatar()} aria-label="Remove profile image" className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full border border-white bg-[#181211] text-white shadow-sm hover:bg-red-600"><X size={14} /></button>}
              </div>
              <div>
                <button type="button" onClick={() => inputRef.current?.click()} disabled={isUploadingAvatar} className="inline-flex items-center gap-2 rounded-xl border border-black/15 bg-[#F7F3EA] px-4 py-2.5 text-sm font-semibold transition hover:bg-white disabled:opacity-60">{isUploadingAvatar ? <LoaderCircle className="animate-spin" size={16} /> : <Camera size={16} />}{isUploadingAvatar ? "Uploading..." : "Change image"}</button>
                <p className="mt-2 text-xs text-[#67758A]">PNG or JPG, up to 2 MB.</p>
                <input ref={inputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={chooseAvatar} />
              </div>
            </div>

            <div className="mt-7 grid gap-5 sm:grid-cols-2">
              <ProfileField label="Name" value={profile.full_name} disabled={!isEditing} onChange={(value) => updateField("full_name", value)} />
              <ProfileField label="Email" type="email" value={profile.email} disabled={!isEditing} onChange={(value) => updateField("email", value)} />
              <ProfileField label="Organization" value={profile.organization ?? ""} disabled={!isEditing} onChange={(value) => updateField("organization", value)} />
              <ProfileField label="Job title" value={profile.job_title ?? ""} disabled={!isEditing} onChange={(value) => updateField("job_title", value)} />
            </div>

            {isEditing && <div className="mt-7 flex flex-col-reverse gap-3 border-t border-black/10 pt-5 sm:flex-row sm:justify-end"><button type="button" onClick={() => { setProfile(savedProfile); setIsEditing(false); }} disabled={isSaving} className="rounded-xl border border-black/15 bg-[#F7F3EA] px-5 py-2.5 text-sm font-semibold transition hover:bg-white disabled:opacity-60">Cancel</button><button type="button" onClick={() => void saveProfile()} disabled={isSaving || !hasChanges} className="rounded-xl bg-[#181211] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50">{isSaving ? "Saving..." : "Save changes"}</button></div>}
          </>}
        </section>
      </div>
    </DashboardLayout>
  );
}

function ProfileField({ label, value, onChange, type = "text", disabled }: { label: string; value: string; onChange: (value: string) => void; type?: string; disabled: boolean }) {
  return <label><span className="mb-2 block text-sm font-semibold">{label}</span><input type={type} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-black/15 bg-[#F7F3EA] px-4 py-3 text-sm outline-none transition focus:border-[#181211] disabled:cursor-default disabled:opacity-75" /></label>;
}
