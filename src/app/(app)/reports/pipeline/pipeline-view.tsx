"use client";

import { useState } from "react";
import { DataGrid } from "@/components/data-grid";
import type { Option } from "@/components/search-select";
import { QuickEditPanel } from "./quick-edit-panel";

/** The Pipeline report's list plus its quick-edit panel: click a row to edit that deal in place. */
export function PipelineView({ companies, ...grid }: React.ComponentProps<typeof DataGrid> & { companies: Option[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const version = openId ? ((grid.rows.find((r) => r.id === openId)?.version as string | undefined) ?? null) : null;
  return (
    <>
      <DataGrid {...grid} onRowClick={(r) => setOpenId(String(r.id))} selectedId={openId} />
      {openId && <QuickEditPanel id={openId} version={version} companies={companies} onClose={() => setOpenId(null)} />}
    </>
  );
}
