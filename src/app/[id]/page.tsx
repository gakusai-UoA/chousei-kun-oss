import { getCloudflareContext } from "@opennextjs/cloudflare";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronRight, Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { createDb } from "@/server/db/client";
import { createEventService } from "@/server/services";

const ResponseForm = dynamic(() => import('@/components/ResponseForm').then(mod => mod.ResponseForm), {
    loading: () => (
        <div className="flex flex-col items-center justify-center p-20 gap-4">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <p className="text-muted-foreground font-medium text-sm">回答フォームを読み込み中...</p>
        </div>
    )
});

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { env } = await getCloudflareContext();
    const db = createDb(env.DB);
    const eventService = createEventService(db);

    const { event, participants, availabilities } = await eventService.getEventWithParticipantsAndAvailabilities(id);

    if (!event) {
        notFound();
    }

    async function revalidateEvent() {
        "use server";
        revalidatePath(`/${id}`);
    }

    return (
        <div className="min-h-screen bg-background text-foreground p-2 sm:p-4 md:p-6 lg:p-8">
            <div className="w-full space-y-8">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div>
                        <h1 className="text-4xl font-extrabold tracking-tight">{event.title}</h1>
                        <p className="text-muted-foreground mt-2 text-lg">{event.description ?? ""}</p>
                    </div>
                    <Link href={`/${id}/results`}>
                        <Button variant="outline" className="gap-2 group">
                            結果を確認する
                            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </Button>
                    </Link>
                </div>

                <ResponseForm
                    eventId={id}
                    candidates={event.candidates}
                    participants={participants}
                    allAvailabilities={availabilities}
                    onSuccess={revalidateEvent}
                />
            </div>
        </div>
    );
}
