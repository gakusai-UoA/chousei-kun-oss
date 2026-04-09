import { NextRequest, NextResponse } from "next/server";
import { CampusSquareService } from "@/lib/campus-square";

// export const runtime = 'edge';


export async function POST(req: NextRequest) {
    if (process.env.NEXT_PUBLIC_ENABLE_CAMPUS_SQUARE !== 'true') {
        return NextResponse.json({ error: "Campus Square integration is disabled." }, { status: 404 });
    }

    try {
        console.log("[SyncCalendar] POST request received");
        const body = await req.json() as { uid?: string, pass?: string };
        console.log("[SyncCalendar] Body parsed:", { hasUid: !!body.uid, hasPass: !!body.pass });
        const { uid, pass } = body;


        if (!uid || !pass) {
            console.log("[SyncCalendar] Missing credentials");
            return NextResponse.json({ error: "認証情報が不足しています" }, { status: 400 });
        }

        console.log("[SyncCalendar] Calling fetchCalendarEvents");
        const events = await CampusSquareService.fetchCalendarEvents(uid, pass);
        console.log("[SyncCalendar] Success, events found:", events.length);
        return NextResponse.json({ events });
    } catch (error: any) {
        console.error("[SyncCalendar] Sync failed error:", error);
        console.error("[SyncCalendar] Error stack:", error?.stack);
        return NextResponse.json(
            { error: error.message || "同期に失敗しました" },
            { status: 500 }
        );
    }
}

