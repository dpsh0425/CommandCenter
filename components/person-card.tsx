"use client";
import { deletePerson } from "@/app/(app)/people/actions";

type Person = { id: string; name: string; role: string | null; area: string | null; color: string; openTaskCount: number };

export function PersonCard({ person }: { person: Person }) {
  function handleDelete() {
    if (!confirm(`Permanently remove ${person.name}? Their tasks will fall back to Unassigned. This cannot be undone.`)) return;
    deletePerson(person.id);
  }
  return (
    <div className="border rounded p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white" style={{ background: person.color }}>
          {person.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
        </span>
        <div>
          <div className="font-medium text-sm">{person.name}</div>
          <div className="text-xs text-gray-500">{person.role}</div>
        </div>
      </div>
      <div className="text-xs text-gray-500">{person.openTaskCount} open task{person.openTaskCount === 1 ? "" : "s"}</div>
      <button onClick={handleDelete} className="text-xs text-red-600 border border-red-600 rounded px-2 py-1 self-start">Remove permanently</button>
    </div>
  );
}
