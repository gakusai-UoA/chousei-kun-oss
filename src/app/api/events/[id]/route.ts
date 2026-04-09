import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { env } = await getCloudflareContext();

        // Fetch event
        const event = await env.DB.prepare(
            "SELECT * FROM events WHERE id = ?"
        )
            .bind(id)
            .first();

        if (!event) {
            return NextResponse.json(
                { error: "Event not found" },
                { status: 404 }
            );
        }

        // Fetch participants
        const { results: participants } = await env.DB.prepare(
            "SELECT * FROM participants WHERE event_id = ?"
        )
            .bind(id)
            .all();

        // Fetch availabilities for all participants
        // We can do this in one query with a JOIN or separate. 
        // For simplicity/clarity, let's fetch all availabilities for this event's participants.
        // Actually, `participants` is small, so we can iterate or use a `IN` clause.
        // Or just fetch all availabilities that link to these participants.

        // Better query: JOIN participants and availabilities
        const { results: availabilities } = await env.DB.prepare(
            `SELECT a.* FROM availabilities a
       JOIN participants p ON a.participant_id = p.id
       WHERE p.event_id = ?`
        )
            .bind(id)
            .all();

        // Parse JSON fields
        const parsedEvent = {
            ...event,
            candidates: JSON.parse(event.candidates as string)
        };

        return NextResponse.json({
            event: parsedEvent,
            participants,
            availabilities
        });
    } catch (error) {
        console.error("Error fetching event:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
