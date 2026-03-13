"use client";

import { useMemo } from "react";

export type UserRole = "user" | "admin" | "owner" | null | undefined;

export function useUserRole(role: UserRole) {
  return useMemo(() => {
    const isOwner = role === "owner";
    const isAdmin = role === "admin" || isOwner;

    return {
      isAdmin,
      isOwner,
      isLoading: role === undefined,
    };
  }, [role]);
}
