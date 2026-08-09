"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Camera, LoaderCircle, X } from "lucide-react";
import { toast } from "sonner";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { API_URL, authenticatedFetch } from "@/lib/api";

type Profile = {
  full_name: string;
  email: string;
  organization: string | null;
  job_title: string | null;
  profile_image: string | null;
};

const emptyProfile: Profile = {
  full_name: "",
  email: "",
  organization: "",
  job_title: "",
  profile_image: null,
};

/** Shows a read-only profile until the user deliberately enters edit mode. */
export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [savedProfile, setSavedProfile] = useState<Profile>(emptyProfile);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        const response = await authenticatedFetch(`${API_URL}/api/auth/me`);
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail ?? "Could not load profile.");
        setProfile(result);
        setSavedProfile(result);
      } catch (error) {
        if (error instanceof Error && error.message !== "Not authenticated") {
          toast.error(error.message);
        }
      } finally {
        setIsLoading(false);
      }
    }
    void loadProfile();
  }, []);

  function updateField(field: keyof Profile, value: string) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  const hasChanges = JSON.stringify(profile) !== JSON.stringify(savedProfile);
  const initials = profile.full_name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "U";
  const avatarUrl = profile.profile_image ? `${API_URL}${profile.profile_image}` : null;

  function publishProfile(updatedProfile: Profile) {
    setProfile(updatedProfile);
    setSavedProfile(updatedProfile);
    window.dispatchEvent(new CustomEvent("profile-updated", { detail: updatedProfile }));
  }

  async function saveProfile() {
    setIsSaving(true);
    try {
      const response = await authenticatedFetch(`${API_URL}/api/auth/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: profile.full_name,
          email: profile.email,
          organization: profile.organization || null,
          job_title: profile.job_title || null,
        }),
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
      <main className="mx-auto w-full max-w-4xl py-6 sm:py-10">
        <h1 className="text-4xl font-bold tracking-tight text-gray-950">Profile</h1>
        <p className="mt-2 text-lg text-gray-600">Manage your account and preferences.</p>

        <section className="mt-8 rounded-3xl border border-black/15 bg-[#EAE6DB] p-6 shadow-sm sm:p-8">
          <h2 className="text-xl font-bold">Profile</h2>
          <p className="mt-1 text-gray-600">This is how others will see you.</p>

          {isLoading ? (
            <div className="flex h-64 items-center justify-center text-gray-500"><LoaderCircle className="mr-2 animate-spin" size={20} /> Loading profile...</div>
          ) : (
            <>
              <div className="mt-6 flex items-center gap-5">
                <div className="relative h-20 w-20 shrink-0">
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-[#171211] text-2xl font-bold text-white">
                    {avatarUrl ? <img src={avatarUrl} alt="Profile avatar" className="h-full w-full object-cover" /> : initials}
                  </div>
                  {avatarUrl && <button type="button" onClick={() => void deleteAvatar()} aria-label="Remove profile image" className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full border border-white bg-[#171211] text-white shadow-sm transition hover:bg-red-600"><X size={14} /></button>}
                </div>
                <div>
                  <button type="button" onClick={() => inputRef.current?.click()} disabled={isUploadingAvatar} className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60">
                    {isUploadingAvatar ? <LoaderCircle className="animate-spin" size={16} /> : <Camera size={16} />} {isUploadingAvatar ? "Uploading..." : "Change avatar"}
                  </button>
                  <p className="mt-2 text-sm text-gray-500">PNG or JPG, up to 2 MB.</p>
                  <input ref={inputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={chooseAvatar} />
                </div>
              </div>

              <div className="mt-7 grid gap-5 sm:grid-cols-2">
                <Field label="Name" value={profile.full_name} onChange={(value) => updateField("full_name", value)} disabled={!isEditing} />
                <Field label="Email" type="email" value={profile.email} onChange={(value) => updateField("email", value)} disabled={!isEditing} />
                <Field label="Organization" value={profile.organization ?? ""} onChange={(value) => updateField("organization", value)} disabled={!isEditing} className="sm:col-span-2" />
                <Field label="Job title" value={profile.job_title ?? ""} onChange={(value) => updateField("job_title", value)} disabled={!isEditing} className="sm:col-span-2" />
              </div>

              <div className="mt-7 flex justify-end gap-3">
                {isEditing ? <>
                  <button type="button" onClick={() => { setProfile(savedProfile); setIsEditing(false); }} disabled={isSaving} className="rounded-xl border border-gray-300 bg-white px-5 py-3 font-semibold transition hover:bg-gray-50 disabled:opacity-60">Cancel</button>
                  <button type="button" onClick={() => void saveProfile()} disabled={isSaving || !hasChanges} className="rounded-xl bg-[#171211] px-5 py-3 font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-gray-400">{isSaving ? "Saving..." : "Save changes"}</button>
                </> : <button type="button" onClick={() => setIsEditing(true)} className="rounded-xl bg-[#171211] px-5 py-3 font-semibold text-white transition hover:bg-black">Edit profile</button>}
              </div>
            </>
          )}
        </section>
      </main>
    </DashboardLayout>
  );
}

function Field({ label, value, onChange, type = "text", disabled = false, className = "" }: { label: string; value: string; onChange: (value: string) => void; type?: string; disabled?: boolean; className?: string }) {
  return (
    <label className={className}>
      <span className="mb-2 block font-semibold text-gray-900">{label}</span>
      <input type={type} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-gray-300 bg-[#F5F1E9] px-4 py-3 outline-none transition focus:border-black disabled:cursor-default disabled:opacity-75" />
    </label>
  );
}
