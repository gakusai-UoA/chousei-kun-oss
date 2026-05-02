import { z } from "zod";

export const createEventSchema = z.object({
    title: z.string().trim().min(1),
    description: z.string().optional().default(""),
    candidates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}_(P|H)\d+$/)).min(1),
    adminPassword: z.string().min(6),
});

export const eventIdParamSchema = z.object({
    id: z.string().uuid(),
});

export const participateSchema = z.object({
    name: z.string().trim().min(1),
    comment: z.string().optional().default(""),
    availabilities: z.array(z.number().int().min(0).max(2)),
    participantId: z.string().uuid().optional(),
    userId: z.string().uuid().optional(),
    notifyOnFinalize: z.boolean().optional().default(false),
    notificationEmail: z.string().email().optional().or(z.literal("")).default(""),
});

export const adminAuthSchema = z.object({
    password: z.string().min(1),
});

export const adminUpdateSchema = z.object({
    title: z.string().trim().min(1),
    description: z.string().optional().default(""),
    candidates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}_(P|H)\d+$/)).min(1),
});

export const confirmCandidateSchema = z.object({
    confirmedCandidateIdx: z.number().int().min(0).nullable(),
    skipCalendarInvite: z.boolean().optional().default(false),
});

export const addToCalendarSchema = z.object({
    confirmedCandidateIdx: z.number().int().min(0),
});

export const syncCalendarSchema = z.object({
    uid: z.string().min(1),
    pass: z.string().min(1),
});

export const updateNotificationSchema = z.object({
    participantId: z.string().uuid(),
    notifyOnFinalize: z.boolean(),
    notificationEmail: z.string().email().optional().or(z.literal("")).default(""),
});

export const googleStartQuerySchema = z.object({
    returnTo: z.string().optional().default("/"),
});
