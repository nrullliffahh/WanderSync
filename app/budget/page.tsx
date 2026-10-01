import { redirect } from "next/navigation";
import Budget from "./budget";

const travelers = [
  "Iffah Afiqah",
  "Syahindah Batrishia",
  "Syauqina Qistina",
];

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ traveler?: string }>;
}) {
  const { traveler } = await searchParams;

  if (!traveler || !travelers.includes(traveler)) {
    redirect("/");
  }

  return <Budget traveler={traveler} />;
}
