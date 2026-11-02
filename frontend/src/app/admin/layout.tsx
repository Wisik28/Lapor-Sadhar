"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { authApi } from "@/lib/api";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const isPublicPage = pathname === "/admin/login" || pathname === "/admin/forgot-password";
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    if (isPublicPage) return;

    let isCurrent = true;
    authApi.getAdminSession().then((result) => {
      if (!isCurrent) return;
      if (result.status === "success") {
        setIsAuthenticated(true);
      } else {
        router.replace("/admin/login");
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [isPublicPage, pathname, router]);

  if (isPublicPage) return children;

  if (!isAuthenticated) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5f3ef] text-sm text-slate-600">
        Memeriksa sesi admin...
      </main>
    );
  }

  return children;
}