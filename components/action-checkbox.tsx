"use client";
import { toggleAction } from "@/app/(app)/actions-list/actions";

export function ActionCheckbox({ id, done }: { id: string; done: boolean }) {
  return (
    <input
      type="checkbox"
      defaultChecked={done}
      onChange={(e) => toggleAction(id, e.target.checked)}
    />
  );
}
