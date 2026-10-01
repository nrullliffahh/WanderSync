import { redirect } from "next/navigation";
import Roles from "./roles";

const travelers = [
  "Iffah Afiqah",
  "Syahindah Batrishia",
  "Syauqina Qistina",
];

export default async function RolesPage({
  searchParams,
}: {
  searchParams: Promise<{ traveler?: string }>;
}) {
  const { traveler } = await searchParams;

  if (!traveler || !travelers.includes(traveler)) {
    redirect("/");
  }

  return <Roles traveler={traveler} />;
}
