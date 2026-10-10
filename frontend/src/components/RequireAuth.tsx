import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const location = useLocation();
  if (!token) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  return <>{children}</>;
}
