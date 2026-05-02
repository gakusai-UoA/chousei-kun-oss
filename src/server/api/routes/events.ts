import { Hono } from "hono";
import { sValidator } from "@hono/standard-validator";
import { eq } from "drizzle-orm";
import { createPasswordHash, verifyPassword } from "@/lib/admin-auth";
import { createDb } from "@/server/db/client";
import { availabilities, events, participants } from "@/server/db/schema";
import {
    createEventSchema,
    eventIdParamSchema,
    participateSchema,
    adminAuthSchema,
    adminUpdateSchema,
    confirmCandidateSchema,
    addToCalendarSchema,
    updateNotificationSchema,
} from "../schemas";
import {
    parseCookieValue,
    refreshGoogleTokenIfNeeded,
    insertAvailabilitiesInBatches,
    parseCandidateWindow,
} from "../utils";

type Bindings = {
    DB: D1Database;
};

export const eventsRoutes = new Hono<{ Bindings: Bindings }>();

eventsRoutes.post("/", sValidator("json", createEventSchema), async (c) => {
    const db = createDb(c.env.DB);
    const { title, description, candidates, adminPassword } = c.req.valid("json");
    const id = crypto.randomUUID();
    const createdAt = Date.now();
    const adminPasswordHash = await createPasswordHash(adminPassword);
    const adminAccessToken = crypto.randomUUID();

    await db.insert(events).values({
        id,
        title,
        description: description || null,
        candidates: JSON.stringify(candidates),
        createdAt,
        adminPasswordHash,
        adminAccessToken,
    });

    return c.json({ id }, 201);
});

eventsRoutes.get("/:id", sValidator("param", eventIdParamSchema), async (c) => {
    const db = createDb(c.env.DB);
    const { id } = c.req.valid("param");

    const event = await db.query.events.findFirst({
        where: eq(events.id, id),
        columns: {
            id: true,
            title: true,
            description: true,
            candidates: true,
            confirmedCandidateIdx: true,
        },
    });

    if (!event) return c.json({ error: "Event not found" }, 404);

    const participantRows = await db.query.participants.findMany({
        where: eq(participants.eventId, id),
    });

    const availabilityRows = await db
        .select({
            id: availabilities.id,
            participantId: availabilities.participantId,
            candidateIdx: availabilities.candidateIdx,
            status: availabilities.status,
        })
        .from(availabilities)
        .innerJoin(participants, eq(availabilities.participantId, participants.id))
        .where(eq(participants.eventId, id));

    return c.json({
        event: {
            ...event,
            candidates: JSON.parse(event.candidates),
        },
        participants: participantRows,
        availabilities: availabilityRows,
    });
});

eventsRoutes.post(
    "/:id/participate",
    sValidator("param", eventIdParamSchema),
    sValidator("json", participateSchema),
    async (c) => {
        const db = createDb(c.env.DB);
        const { id: eventId } = c.req.valid("param");
        const { name, comment, availabilities: statuses, participantId, userId, notifyOnFinalize, notificationEmail } = c.req.valid("json");
        const cookieHeader = c.req.header("cookie") ?? "";
        const googleSessionId = parseCookieValue(cookieHeader, "chousei_google_session");
        const googleSession = googleSessionId ? await refreshGoogleTokenIfNeeded(db, googleSessionId) : null;

        const normalizedComment = comment || null;
        const normalizedNotificationEmail = notificationEmail?.trim() ? notificationEmail.trim() : (googleSession?.email ?? null);
        const effectiveNotifyOnFinalize = notifyOnFinalize || !!googleSession?.email;
        if (effectiveNotifyOnFinalize && !normalizedNotificationEmail) {
            return c.json({ error: "通知を受け取る場合はメールアドレスが必要です" }, 400);
        }
        const newParticipantId = participantId ?? crypto.randomUUID();

        if (participantId) {
            await db
                .update(participants)
                .set({
                    name,
                    comment: normalizedComment,
                    userId: userId ?? null,
                    notifyOnFinalize: effectiveNotifyOnFinalize ? 1 : 0,
                    notificationEmail: normalizedNotificationEmail,
                })
                .where(eq(participants.id, participantId));
            await db.delete(availabilities).where(eq(availabilities.participantId, participantId));
        } else {
            await db.insert(participants).values({
                id: newParticipantId,
                eventId,
                userId: userId ?? null,
                name,
                comment: normalizedComment,
                notifyOnFinalize: effectiveNotifyOnFinalize ? 1 : 0,
                notificationEmail: normalizedNotificationEmail,
            });
        }

        if (statuses.length > 0) {
            const availabilityValues = statuses.map((status, idx) => ({
                id: crypto.randomUUID(),
                participantId: newParticipantId,
                candidateIdx: idx,
                status,
            }));
            await insertAvailabilitiesInBatches(db, availabilityValues);
        }

        return c.json({ success: true, participantId: newParticipantId });
    }
);

eventsRoutes.post(
    "/:id/notification",
    sValidator("param", eventIdParamSchema),
    sValidator("json", updateNotificationSchema),
    async (c) => {
        const db = createDb(c.env.DB);
        const { id: eventId } = c.req.valid("param");
        const { participantId, notifyOnFinalize, notificationEmail } = c.req.valid("json");

        const participant = await db.query.participants.findFirst({
            where: eq(participants.id, participantId),
        });

        if (!participant || participant.eventId !== eventId) {
            return c.json({ error: "Participant not found" }, 404);
        }

        const normalizedEmail = notificationEmail?.trim() || null;
        if (notifyOnFinalize && !normalizedEmail) {
            return c.json({ error: "通知を受け取る場合はメールアドレスが必要です" }, 400);
        }

        await db
            .update(participants)
            .set({
                notifyOnFinalize: notifyOnFinalize ? 1 : 0,
                notificationEmail: normalizedEmail,
            })
            .where(eq(participants.id, participantId));

        return c.json({ success: true });
    }
);

eventsRoutes.post(
    "/:id/admin-auth",
    sValidator("param", eventIdParamSchema),
    sValidator("json", adminAuthSchema),
    async (c) => {
        const db = createDb(c.env.DB);
        const { id } = c.req.valid("param");
        const { password } = c.req.valid("json");

        const event = await db.query.events.findFirst({
            where: eq(events.id, id),
            columns: {
                adminPasswordHash: true,
                adminAccessToken: true,
            },
        });
        if (!event) return c.json({ error: "Event not found" }, 404);

        const ok = await verifyPassword(password, event.adminPasswordHash);
        if (!ok || !event.adminAccessToken) return c.json({ error: "Invalid password" }, 401);

        c.header(
            "Set-Cookie",
            `chousei_admin_${id}=${event.adminAccessToken}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=2592000`
        );
        return c.json({ ok: true });
    }
);

eventsRoutes.post(
    "/:id/admin-logout",
    sValidator("param", eventIdParamSchema),
    async (c) => {
        const { id } = c.req.valid("param");
        c.header(
            "Set-Cookie",
            `chousei_admin_${id}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`
        );
        return c.json({ ok: true });
    }
);

eventsRoutes.patch(
    "/:id/admin",
    sValidator("param", eventIdParamSchema),
    sValidator("json", adminUpdateSchema),
    async (c) => {
        const db = createDb(c.env.DB);
        const { id } = c.req.valid("param");
        const { title, description, candidates: nextCandidates } = c.req.valid("json");

        const cookie = c.req.header("cookie") ?? "";
        const tokenMatch = cookie.match(new RegExp(`(?:^|;\\s*)chousei_admin_${id}=([^;]+)`));
        const sessionToken = tokenMatch?.[1];

        const currentEvent = await db.query.events.findFirst({
            where: eq(events.id, id),
            columns: {
                id: true,
                candidates: true,
                adminAccessToken: true,
            },
        });

        if (!currentEvent) return c.json({ error: "Event not found" }, 404);
        if (!currentEvent.adminAccessToken || !sessionToken || sessionToken !== currentEvent.adminAccessToken) {
            return c.json({ error: "Unauthorized" }, 401);
        }

        const oldCandidates = JSON.parse(currentEvent.candidates) as string[];
        const indexMap = new Map<string, number>();
        nextCandidates.forEach((candidate, idx) => {
            indexMap.set(candidate, idx);
        });

        const availabilityRows = await c.env.DB.prepare(
            `SELECT a.id, a.participant_id, a.candidate_idx, a.status
             FROM availabilities a
             JOIN participants p ON p.id = a.participant_id
             WHERE p.event_id = ?`
        ).bind(id).all<{ id: string; participant_id: string; candidate_idx: number; status: number }>();

        await c.env.DB.prepare(
            `DELETE FROM availabilities
             WHERE participant_id IN (SELECT id FROM participants WHERE event_id = ?)`
        ).bind(id).run();

        const remappedValues: Array<{ id: string; participantId: string; candidateIdx: number; status: number }> = [];
        for (const row of availabilityRows.results) {
            const oldCandidate = oldCandidates[row.candidate_idx];
            if (!oldCandidate) continue;
            const newIdx = indexMap.get(oldCandidate);
            if (newIdx === undefined) continue;
            remappedValues.push({
                id: crypto.randomUUID(),
                participantId: row.participant_id,
                candidateIdx: newIdx,
                status: row.status,
            });
        }
        if (remappedValues.length > 0) {
            await insertAvailabilitiesInBatches(db, remappedValues);
        }

        await db
            .update(events)
            .set({
                title,
                description: description || null,
                candidates: JSON.stringify(nextCandidates),
            })
            .where(eq(events.id, id));

        return c.json({ ok: true });
    }
);

eventsRoutes.post(
    "/:id/admin/confirm",
    sValidator("param", eventIdParamSchema),
    sValidator("json", confirmCandidateSchema),
    async (c) => {
        const db = createDb(c.env.DB);
        const { id } = c.req.valid("param");
        const { confirmedCandidateIdx, skipCalendarInvite } = c.req.valid("json");

        const cookie = c.req.header("cookie") ?? "";
        const tokenMatch = cookie.match(new RegExp(`(?:^|;\\s*)chousei_admin_${id}=([^;]+)`));
        const sessionToken = tokenMatch?.[1];

        const currentEvent = await db.query.events.findFirst({
            where: eq(events.id, id),
            columns: {
                candidates: true,
                adminAccessToken: true,
            },
        });
        if (!currentEvent) return c.json({ error: "Event not found" }, 404);
        if (!currentEvent.adminAccessToken || !sessionToken || sessionToken !== currentEvent.adminAccessToken) {
            return c.json({ error: "Unauthorized" }, 401);
        }

        const candidates = JSON.parse(currentEvent.candidates) as string[];
        if (confirmedCandidateIdx !== null && confirmedCandidateIdx >= candidates.length) {
            return c.json({ error: "Invalid confirmed candidate index" }, 400);
        }

        await db
            .update(events)
            .set({ confirmedCandidateIdx })
            .where(eq(events.id, id));

        return c.json({ ok: true });
    }
);

eventsRoutes.post(
    "/:id/admin/add-to-calendar",
    sValidator("param", eventIdParamSchema),
    sValidator("json", addToCalendarSchema),
    async (c) => {
        const db = createDb(c.env.DB);
        const { id } = c.req.valid("param");
        const { confirmedCandidateIdx } = c.req.valid("json");

        const cookie = c.req.header("cookie") ?? "";
        const tokenMatch = cookie.match(new RegExp(`(?:^|;\\s*)chousei_admin_${id}=([^;]+)`));
        const sessionToken = tokenMatch?.[1];

        const currentEvent = await db.query.events.findFirst({
            where: eq(events.id, id),
            columns: {
                candidates: true,
                adminAccessToken: true,
                title: true,
                description: true,
            },
        });
        if (!currentEvent) return c.json({ error: "Event not found" }, 404);
        if (!currentEvent.adminAccessToken || !sessionToken || sessionToken !== currentEvent.adminAccessToken) {
            return c.json({ error: "Unauthorized" }, 401);
        }

        const candidates = JSON.parse(currentEvent.candidates) as string[];
        if (confirmedCandidateIdx >= candidates.length) {
            return c.json({ error: "Invalid confirmed candidate index" }, 400);
        }

        const googleSessionId = parseCookieValue(cookie, "chousei_google_session");
        if (!googleSessionId) {
            return c.json({ error: "Google session not found" }, 401);
        }
        const googleSession = await refreshGoogleTokenIfNeeded(db, googleSessionId);
        if (!googleSession) {
            return c.json({ error: "Google session not found" }, 401);
        }

        const selectedCandidate = candidates[confirmedCandidateIdx];
        const candidateWindow = selectedCandidate ? parseCandidateWindow(selectedCandidate) : null;
        if (!candidateWindow) {
            return c.json({ error: "Failed to parse confirmed schedule window" }, 400);
        }

        const recipients = await db.query.participants.findMany({
            where: eq(participants.eventId, id),
            columns: {
                name: true,
                notifyOnFinalize: true,
                notificationEmail: true,
            },
        });
        const inviteTargets = recipients
            .filter((p) => p.notifyOnFinalize === 1 && !!p.notificationEmail)
            .map((p) => ({ name: p.name, email: p.notificationEmail as string }));

        const dedupedAttendees = Array.from(
            new Map(inviteTargets.map((target) => [target.email, target])).values()
        );

        const insertRes = await fetch(
            "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${googleSession.accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    summary: `${currentEvent.title}（確定）`,
                    description: currentEvent.description ?? "調整くんで確定した日程です。",
                    start: {
                        dateTime: candidateWindow.startDateTime,
                        timeZone: "Asia/Tokyo",
                    },
                    end: {
                        dateTime: candidateWindow.endDateTime,
                        timeZone: "Asia/Tokyo",
                    },
                    attendees: dedupedAttendees.map((target) => ({
                        email: target.email,
                        displayName: target.name,
                    })),
                }),
            }
        );

        if (!insertRes.ok) {
            const errText = await insertRes.text();
            console.error("[GoogleInvite:error]", errText);
            return c.json({ error: "Failed to add to Google Calendar" }, 500);
        }

        return c.json({ ok: true });
    }
);
