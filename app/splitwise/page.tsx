import { redirect } from "next/navigation";
import Splitwise from "./splitwise";

const travelers = [
  "Iffah Afiqah",
  "Syahindah Batrishia",
  "Syauqina Qistina",
];

export default async function SplitwisePage({
  searchParams,
}: {
  searchParams: Promise<{ traveler?: string }>;
}) {
  const { traveler } = await searchParams;

  if (!traveler || !travelers.includes(traveler)) {
    redirect("/");
  }

  return <Splitwise traveler={traveler} />;
}
