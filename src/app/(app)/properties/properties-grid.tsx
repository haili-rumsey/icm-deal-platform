"use client";

import { Map as MapIcon } from "lucide-react";
import { DataGrid } from "@/components/data-grid";
import { PropertyMap } from "@/components/property-map";

/** The Properties list with its Map view (a client wrapper, since the view is drawn from a function). */
export function PropertiesGrid(props: Omit<React.ComponentProps<typeof DataGrid>, "altView">) {
  return <DataGrid {...props} altView={{ label: "Map", icon: MapIcon, render: (rows) => <PropertyMap rows={rows} /> }} />;
}
