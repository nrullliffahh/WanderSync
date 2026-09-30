import { redirect } from "next/navigation";
import Transit from "./transit";

const travelers = [
  "Iffah Afiqah",
  "Syahindah Batrisia",
  "Syauqina Qistina",
];

export default async function TransitPage({
  searchParams,
}: {
  searchParams: Promise<{ traveler?: string }>;
}) {
  const { traveler } = await searchParams;

  if (!traveler || !travelers.includes(traveler)) {
    redirect("/");
  }

  return <Transit traveler={traveler} />;
}
