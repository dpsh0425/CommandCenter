"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type TaskStatus = "todo" | "in_progress" | "blocked" | "done" | "cancelled";

export async function createTask(data: {
  title: string; description?: string; schoolId?: string; researchMilestoneId?: string;
  assigneeId?: string; priority?: "low" | "medium" | "high"; dueDate?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  const { error } = await supabase.from("tasks").insert({
    owner_id: user.id, title: data.title, description: data.description,
    school_id: data.schoolId, research_milestone_id: data.researchMilestoneId,
    assignee_id: data.assigneeId, priority: data.priority ?? "medium", due_date: data.dueDate,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/tasks");
  revalidatePath("/");
  revalidatePath("/today");
  if (data.researchMilestoneId) {
    revalidatePath("/research");
    revalidatePath(`/research/${data.researchMilestoneId}`);
  }
  if (data.schoolId) revalidatePath(`/schools/${data.schoolId}`);
}

export async function updateTaskStatus(taskId: string, status: TaskStatus) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  const { data: task } = await supabase.from("tasks").select("owner_id").eq("id", taskId).single();
  if (!task) throw new Error("task not found");
  const { error } = await supabase.from("tasks").update({ status }).eq("id", taskId);
  if (error) throw new Error(error.message);
  await supabase.from("task_updates").insert({
    owner_id: task.owner_id, task_id: taskId, type: "status_change",
    content: `Status changed to ${status.replace("_", " ")}`, is_win: status === "done",
  });
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/");
  revalidatePath("/today");
  revalidatePath("/wins");
  revalidatePath("/research", "layout");
}

export async function reassignTask(taskId: string, newAssigneeId: string | null) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");

  const { data: task } = await supabase.from("tasks").select("assignee_id, owner_id").eq("id", taskId).single();
  if (!task) throw new Error("task not found");
  const [{ data: oldPerson }, { data: newPerson }] = await Promise.all([
    task.assignee_id ? supabase.from("people").select("name").eq("id", task.assignee_id).single() : Promise.resolve({ data: null }),
    newAssigneeId ? supabase.from("people").select("name").eq("id", newAssigneeId).single() : Promise.resolve({ data: null }),
  ]);

  const { error } = await supabase.from("tasks").update({ assignee_id: newAssigneeId }).eq("id", taskId);
  if (error) throw new Error(error.message);

  await supabase.from("task_updates").insert({
    owner_id: task.owner_id, task_id: taskId, type: "reassignment",
    content: `Reassigned from ${oldPerson?.name ?? "Unassigned"} to ${newPerson?.name ?? "Unassigned"}`,
  });
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
}

export async function addTaskUpdate(taskId: string, type: "note" | "result", content: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  const { data: task } = await supabase.from("tasks").select("owner_id").eq("id", taskId).single();
  if (!task) throw new Error("task not found");
  const { error } = await supabase.from("task_updates").insert({
    owner_id: task.owner_id, task_id: taskId, type, content, is_win: type === "result",
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/tasks/${taskId}`);
}

export async function updateTask(taskId: string, fields: {
  title: string; description: string | null; priority: "low" | "medium" | "high"; dueDate: string | null;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  const { error } = await supabase.from("tasks").update({
    title: fields.title, description: fields.description, priority: fields.priority, due_date: fields.dueDate,
  }).eq("id", taskId);
  if (error) throw new Error(error.message);
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/");
  revalidatePath("/today");
  revalidatePath("/research", "layout");
}

export async function deleteTask(taskId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) throw new Error(error.message);
  revalidatePath("/tasks");
  revalidatePath("/");
  revalidatePath("/today");
  revalidatePath("/research", "layout");
  redirect("/tasks");
}

export async function removeTaskDependency(taskId: string, dependsOnTaskId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("task_dependencies").delete().eq("task_id", taskId).eq("depends_on_task_id", dependsOnTaskId);
  if (error) throw new Error(error.message);
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/tasks");
}

export async function addTaskDependency(taskId: string, dependsOnTaskId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  const { error } = await supabase.from("task_dependencies").insert({
    owner_id: user.id, task_id: taskId, depends_on_task_id: dependsOnTaskId,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/tasks");
}
