import { getCloudflareContext } from "@opennextjs/cloudflare";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { createDb } from "@/server/db/client";
import { createEventService } from "@/server/services";
import { ResponseCompleteForm } from "@/components/ResponseCompleteForm";

export default async function CompletePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { env } = await getCloudflareContext();
    const db = createDb(env.DB);
    const eventService = createEventService(db);

    const event = await eventService.findByIdPublic(id);

    if (!event) notFound();

    return (
        <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 md:p-8">
            <div className="max-w-2xl mx-auto space-y-8">
                <div className="text-center space-y-4">
                    <div className="flex justify-center">
                        <div className="rounded-full bg-emerald-100 p-4 dark:bg-emerald-900/30">
                            <CheckCircle className="h-12 w-12 text-emerald-600 dark:text-emerald-400" />
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold">回答を送信しました</h1>
                    <p className="text-muted-foreground">
                        {event.title} への回答が完了しました
                    </p>
                </div>

                <ResponseCompleteForm eventId={id} eventTitle={event.title} />

                <div className="border-t pt-6 space-y-4">
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Link href={`/${id}/results`}>
                            <Button variant="outline" className="w-full sm:w-auto">
                                回答結果を確認する
                            </Button>
                        </Link>
                        <Link href={`/${id}`}>
                            <Button variant="ghost" className="w-full sm:w-auto gap-2">
                                <ArrowLeft className="h-4 w-4" />
                                回答を編集する
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
