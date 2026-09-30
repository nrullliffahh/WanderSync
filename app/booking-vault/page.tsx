import { redirect } from "next/navigation";
import BookingVault from "./booking-vault";

const travelers = [
  "Iffah Afiqah",
  "Syahindah Batrisia",
  "Syauqina Qistina",
];

export default async function BookingVaultPage({
  searchParams,
}: {
  searchParams: Promise<{ traveler?: string }>;
}) {
  const { traveler } = await searchParams;

  if (!traveler || !travelers.includes(traveler)) {
    redirect("/");
  }

  return <BookingVault traveler={traveler} />;
}
