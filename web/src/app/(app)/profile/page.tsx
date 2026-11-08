import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/app/page-ui";
import { getViewer } from "@/lib/supabase/server";

// "Profile" in the menu: your own profile page.
export default function MyProfile() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-72 max-w-3xl" />}>
      <Go />
    </Suspense>
  );
}

async function Go(): Promise<never> {
  const { user } = await getViewer();
  redirect(user ? `/u/${user.id}` : "/login");
}
