import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: eventId } = await params;
        const { env } = await getCloudflareContext();
        const { name, comment, availabilities, participantId } = await request.json() as {
            name: string;
            comment: string;
            availabilities: number[];
            participantId?: string;
        };

        const trimmedName = name?.trim();

        if (!trimmedName || !availabilities) {
            return NextResponse.json(
                { error: "Name and availabilities are required" },
                { status: 400 }
            );
        }

        const newParticipantId = participantId || crypto.randomUUID();

        const batch: any[] = [];

        if (participantId) {
            // Update existing participant
            batch.push(
                env.DB.prepare("UPDATE participants SET name = ?, comment = ? WHERE id = ?")
                    .bind(trimmedName, comment || null, participantId)
            );
            // Delete old availabilities to replace
            batch.push(
                env.DB.prepare("DELETE FROM availabilities WHERE participant_id = ?")
                    .bind(participantId)
            );
        } else {
            // Insert new participant
            batch.push(
                env.DB.prepare("INSERT INTO participants (id, event_id, name, comment) VALUES (?, ?, ?, ?)")
                    .bind(newParticipantId, eventId, trimmedName, comment || null)
            );
        }

        // Insert availabilities
        availabilities.forEach((status, idx) => {
            const availId = crypto.randomUUID();
            batch.push(
                env.DB.prepare("INSERT INTO availabilities (id, participant_id, candidate_idx, status) VALUES (?, ?, ?, ?)")
                    .bind(availId, newParticipantId, idx, status)
            );
        });

        await env.DB.batch(batch);

        return NextResponse.json({ success: true, participantId: newParticipantId });

    } catch (error) {
        console.error("Error submitting response:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
