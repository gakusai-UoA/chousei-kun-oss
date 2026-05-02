import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * ユーザーテーブル
 * 端末固有の識別子とカレンダー購読トークンを管理
 */
export const users = sqliteTable("users", {
    id: text("id").primaryKey(),
    calendarToken: text("calendar_token").notNull().unique(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
});

/**
 * イベントテーブル
 * 日程調整イベントの基本情報
 */
export const events = sqliteTable("events", {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    candidates: text("candidates").notNull(),
    createdAt: integer("created_at").notNull(),
    adminPasswordHash: text("admin_password_hash"),
    adminAccessToken: text("admin_access_token"),
    confirmedCandidateIdx: integer("confirmed_candidate_idx"),
});

/**
 * 参加者テーブル
 * イベントへの参加者情報と通知設定
 */
export const participants = sqliteTable("participants", {
    id: text("id").primaryKey(),
    eventId: text("event_id").notNull(),
    userId: text("user_id"),
    name: text("name").notNull(),
    comment: text("comment"),
    notifyOnFinalize: integer("notify_on_finalize").notNull().default(0),
    notificationEmail: text("notification_email"),
});

/**
 * 回答テーブル
 * 各参加者の候補日時に対する回答
 */
export const availabilities = sqliteTable("availabilities", {
    id: text("id").primaryKey(),
    participantId: text("participant_id").notNull(),
    candidateIdx: integer("candidate_idx").notNull(),
    status: integer("status").notNull(),
});

/**
 * Google OAuth セッションテーブル
 * Googleアカウント連携情報
 */
export const googleOauthSessions = sqliteTable("google_oauth_sessions", {
    sessionId: text("session_id").primaryKey(),
    userId: text("user_id"),
    email: text("email").notNull(),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token"),
    expiresAt: integer("expires_at").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
});
