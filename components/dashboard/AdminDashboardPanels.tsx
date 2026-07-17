"use client";

import { useState } from "react";
import { AdminQueue } from "./AdminQueue";
import { AdminTeam } from "./AdminTeam";
import { UserDetailModal } from "./AdminOverview";

// Interactive admin panels: the declarations queue (with reviewer assignment)
// and the review-team manager, sharing one client-detail modal.
export function AdminDashboardPanels() {
  const [openOid, setOpenOid] = useState<string | null>(null);
  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <AdminQueue onOpenUser={setOpenOid} />
      </div>
      <div>
        <AdminTeam />
      </div>
      {openOid && <UserDetailModal oid={openOid} onClose={() => setOpenOid(null)} />}
    </div>
  );
}
