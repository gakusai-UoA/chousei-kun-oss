import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const { env } = await getCloudflareContext();
        const { title, description, candidates } = await request.json() as {
            title: string;
            description: string;
            candidates: string[];
        };

        if (!title || !candidates || candidates.length === 0) {
            return NextResponse.json(
                { error: "Title and candidates are required" },
                { status: 400 }
            );
        }

        // Generate a simple ID (in production consider ULID or UUID)
        // Using random string for now to avoid external dependencies if possible, or crypto.randomUUID
        const id = crypto.randomUUID();
        const createdAt = Date.now();

        await env.DB.prepare(
            "INSERT INTO events (id, title, description, candidates, created_at) VALUES (?, ?, ?, ?, ?)"
        )
            .bind(id, title, description || null, JSON.stringify(candidates), createdAt)
            .run();

        return NextResponse.json({ id });
    } catch (error) {
        console.error("Error creating event:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
