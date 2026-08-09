import { redirect } from "next/navigation";

/** Profile settings now live on the dedicated profile route. */
export default function SettingsPage() {
  redirect("/profile");
}
