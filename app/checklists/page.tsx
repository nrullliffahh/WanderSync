import { redirect } from "next/navigation";
import Checklists from "./checklists";

const travelers = [
  "Iffah Afiqah",
  "Syahindah Batrishia",
  "Syauqina Qistina",
];

export default async function ChecklistsPage({
  searchParams,
}: {
  searchParams: Promise<{ traveler?: string }>;
}) {
  const { traveler } = await searchParams;

  if (!traveler || !travelers.includes(traveler)) {
    redirect("/");
  }

  return <Checklists traveler={traveler} />;
}
