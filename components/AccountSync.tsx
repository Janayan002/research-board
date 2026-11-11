"use client";

// Mounted once in the layout: starts keeping boards in step with the signed-in account.

import { useEffect } from "react";
import { startSync } from "@/lib/sync";

export default function AccountSync() {
  useEffect(() => { startSync(); }, []);
  return null;
}
