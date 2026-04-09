import { getCloudflareContext } from "@opennextjs/cloudflare";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { siteConfig } from "@/config/site";
import dynamic from "next/dynamic";

const EventView = dynamic(() => import('@/components/EventView').then(mod => mod.EventView), {
    loading: () => (
        <div className="flex flex-col items-center justify-center p-20 gap-4">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <p className="text-muted-foreground font-medium text-sm">イベントデータを読み込み中...</p>
        </div>
    )
});

export default async function AdminPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { env } = await getCloudflareContext();

    const event = await env.DB.prepare("SELECT * FROM events WHERE id = ?").bind(id).first();

    if (!event) {
        notFound();
    }

    // Parse candidates
    const parsedEvent = {
        ...event,
        candidates: JSON.parse(event.candidates as string) as string[]
    };

    const { results: participants } = await env.DB.prepare("SELECT * FROM participants WHERE event_id = ?").bind(id).all();

    // Get availabilities
    const { results: availabilities } = await env.DB.prepare(
        `SELECT a.* FROM availabilities a
       JOIN participants p ON a.participant_id = p.id
       WHERE p.event_id = ?`
    ).bind(id).all();

    return (
        <div className="min-h-screen bg-background text-foreground p-2 sm:p-4 md:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href={`/${id}`}>
                            <Button variant="ghost" size="icon">
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold">{siteConfig.ui.admin.title}</h1>
                            <p className="text-muted-foreground text-sm">{(parsedEvent as any).title} の回答状況</p>
                        </div>
                    </div>
                </div>

                <div className="bg-card rounded-lg border shadow-sm p-4 overflow-hidden">
                    <EventView
                        event={parsedEvent as any}
                        participants={participants as any}
                        availabilities={availabilities as any}
                    />
                </div>
            </div>
        </div>
    );
}
