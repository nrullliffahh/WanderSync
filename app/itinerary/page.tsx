import { redirect } from "next/navigation";
import Itinerary from "./itinerary";

const travelers = [
  "Iffah Afiqah",
  "Syahindah Batrisia",
  "Syauqina Qistina",
];

export default async function ItineraryPage({
  searchParams,
}: {
  searchParams: Promise<{ traveler?: string }>;
}) {
  const { traveler } = await searchParams;

  if (!traveler || !travelers.includes(traveler)) {
    redirect("/");
  }

  return <Itinerary traveler={traveler} />;
}
