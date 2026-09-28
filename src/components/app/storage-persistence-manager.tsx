"use client";

import { useEffect } from "react";

import { ensureLocalStorageProtection } from "@/lib/storage-persistence";

export function StoragePersistenceManager() {
  useEffect(() => {
    void ensureLocalStorageProtection();
  }, []);

  return null;
}
