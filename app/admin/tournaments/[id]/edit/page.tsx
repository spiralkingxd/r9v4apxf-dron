import { EventForm } from "@/components/admin/event-form";
import { getEventForForm } from "@/app/admin/tournaments/_data";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminEditTournamentPage({ params }: Props) {
  const { id } = await params;
  const event = await getEventForForm(id, "tournament");

  return <EventForm mode="edit" eventId={id} initialValues={event} fixedKind="tournament" />;
}
