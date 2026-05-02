import { getCloudflareContext } from "@opennextjs/cloudflare";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EventResultsView } from "@/components/EventResultsView";
import { createDb } from "@/server/db/client";
import { createEventService } from "@/server/services";

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { env } = await getCloudflareContext();
    const db = createDb(env.DB);
    const eventService = createEventService(db);

    const { event, participants, availabilities } = await eventService.getEventWithParticipantsAndAvailabilities(id);

    if (!event) notFound();

    return (
        <div className="min-h-screen bg-background text-foreground p-2 sm:p-4 md:p-6 lg:p-8">
            <div className="w-full space-y-6">
                <div className="flex items-center gap-4">
                    <Link href={`/${id}`}>
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold">回答結果</h1>
                        <p className="text-muted-foreground text-sm">{event.title} の回答状況</p>
                    </div>
                </div>

                <EventResultsView
                    eventId={id}
                    eventTitle={event.title}
                    eventDescription={event.description}
                    candidates={event.candidates}
                    confirmedCandidateIdx={event.confirmedCandidateIdx}
                    participants={participants}
                    availabilities={availabilities}
                />
            </div>
        </div>
    );
}
