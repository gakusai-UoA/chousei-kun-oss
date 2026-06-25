/**
 * シフト調整のクライアント側ユーティリティと API レスポンス型。
 *
 * シフト表は「日付範囲（複数日）＋日々の収集時間帯」で定義される。
 * 枠(slot)・NG レンジ・割当はすべて絶対 ms epoch で保持し、
 * UI 描画では各日の 0:00 を基準に「分」へ変換して位置を決める（TZ 非依存の算術）。
 */

export const DAY_MS = 86_400_000;

export type ShiftSlot = {
    id: string;
    startsAt: number;
    endsAt: number;
    role: string;
    place: string | null;
    capacity: number;
    sortOrder: number;
};

export type TimeRange = { startsAt: number; endsAt: number };

export type ShiftBoardMeta = {
    id: string;
    title: string;
    description: string | null;
    startDate: number; // 開始日 JST 0:00 ms
    endDate: number; // 終了日 JST 0:00 ms（両端含む）
    dayStartMin: number; // 各日の収集帯 開始（0:00 からの分）
    dayEndMin: number; // 各日の収集帯 終了
    status: "collecting" | "published";
    submissionDeadline: number | null;
};

export type ShiftAssignment = { slotId: string; memberId: string; name?: string };

export type ShiftPublicView = {
    board: ShiftBoardMeta;
    slots: ShiftSlot[];
    assignments: ShiftAssignment[];
};

export type ShiftMemberDetail = {
    id: string;
    name: string;
    comment: string | null;
    unavailableRanges: TimeRange[];
    assignedSlotIds: string[];
};

export type ShiftAdminMember = {
    id: string;
    name: string;
    comment: string | null;
    unavailableRanges: TimeRange[];
};

export type ShiftAdminView = {
    board: ShiftBoardMeta;
    slots: ShiftSlot[];
    members: ShiftAdminMember[];
    assignments: { slotId: string; memberId: string }[];
    deleted: boolean;
};

/** 収集対象の各日（JST 0:00 ms）の配列。 */
export function boardDays(b: { startDate: number; endDate: number }): number[] {
    const days: number[] = [];
    for (let t = b.startDate; t <= b.endDate; t += DAY_MS) days.push(t);
    return days;
}

/** その日の 0:00 を基準にした「分」へ。TZ 非依存（ms 差の純算術）。 */
export function msToDayMin(ms: number, dayMidnight: number): number {
    return Math.round((ms - dayMidnight) / 60_000);
}

/** その日の 0:00 + 分 → 絶対 ms。 */
export function dayMinToMs(dayMidnight: number, min: number): number {
    return dayMidnight + min * 60_000;
}

/** 絶対 ms が startDate から数えて何日目か（0 始まり）。 */
export function dayIndexOf(ms: number, startDate: number): number {
    return Math.floor((ms - startDate) / DAY_MS);
}

/** 分（0..1440+）を "HH:MM" 表示に。 */
export function formatMinutes(min: number): string {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "HH:MM" を分に。失敗時は null。 */
export function parseHm(value: string): number | null {
    const m = value.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const h = Number(m[1]);
    const mm = Number(m[2]);
    if (mm > 59) return null;
    return h * 60 + mm;
}

/** 2 つのレンジ（数値）が重なるか。 */
export function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
    return aStart < bEnd && bStart < aEnd;
}

/** 枠が NG レンジのいずれかと重なる = その枠は本人 NG。 */
export function slotIsNg(slot: { startsAt: number; endsAt: number }, ranges: TimeRange[]): boolean {
    return ranges.some((r) => rangesOverlap(slot.startsAt, slot.endsAt, r.startsAt, r.endsAt));
}

export const SNAP_MINUTES = 5;

/** 分を SNAP 単位に丸める。 */
export function snap(min: number, snapTo = SNAP_MINUTES): number {
    return Math.round(min / snapTo) * snapTo;
}

/** ms epoch を "M/d (曜)" (JST) で表示。 */
const WEEKDAYS_JP = ["日", "月", "火", "水", "木", "金", "土"] as const;
export function formatDay(ms: number): string {
    const d = new Date(ms + 9 * 60 * 60_000);
    return `${d.getUTCMonth() + 1}/${d.getUTCDate()} (${WEEKDAYS_JP[d.getUTCDay()]})`;
}
