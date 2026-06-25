"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Loader2,
    AlertCircle,
    AlertTriangle,
    Users,
    Wand2,
    Save,
    Eye,
    EyeOff,
    Trash2,
    Link2,
    Check,
    Ban,
    Plus,
    Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    DAY_MS,
    boardDays,
    dayIndexOf,
    dayMinToMs,
    msToDayMin,
    formatMinutes,
    parseHm,
    formatDay,
    rangesOverlap,
    slotIsNg,
    SNAP_MINUTES,
    type ShiftAdminView as AdminView,
    type ShiftAdminMember,
} from "@/lib/shift";
import { ShiftBandTimeline, type TimelineBlock } from "./ShiftBandTimeline";

type Phase = "loading" | "auth" | "ready" | "error";

type AdminSlot = {
    id: string;
    dayIndex: number;
    startMin: number;
    endMin: number;
    role: string;
    place: string;
    capacity: number;
};

let keyCounter = 0;
const newId = () => {
    keyCounter += 1;
    return (
        (typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `tmp-${keyCounter}-${keyCounter * 2654435761}`) as string
    );
};

export function ShiftAdminView({ boardId }: { boardId: string }) {
    const [phase, setPhase] = React.useState<Phase>("loading");
    const [data, setData] = React.useState<AdminView | null>(null);
    const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

    const [slots, setSlots] = React.useState<AdminSlot[]>([]);
    const [assign, setAssign] = React.useState<Map<string, Set<string>>>(new Map());
    const [dirty, setDirty] = React.useState(false);

    const [password, setPassword] = React.useState("");
    const [authError, setAuthError] = React.useState<string | null>(null);
    const [authing, setAuthing] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [publishing, setPublishing] = React.useState(false);
    const [copied, setCopied] = React.useState(false);
    const [openSlotId, setOpenSlotId] = React.useState<string | null>(null);
    const [activeDay, setActiveDay] = React.useState(0);

    const hydrate = (view: AdminView) => {
        const ss: AdminSlot[] = view.slots.map((s) => {
            const di = dayIndexOf(s.startsAt, view.board.startDate);
            const mid = view.board.startDate + di * DAY_MS;
            return {
                id: s.id,
                dayIndex: di,
                startMin: msToDayMin(s.startsAt, mid),
                endMin: msToDayMin(s.endsAt, mid),
                role: s.role,
                place: s.place ?? "",
                capacity: s.capacity,
            };
        });
        const m = new Map<string, Set<string>>();
        for (const a of view.assignments) {
            const set = m.get(a.slotId) ?? new Set<string>();
            set.add(a.memberId);
            m.set(a.slotId, set);
        }
        setSlots(ss);
        setAssign(m);
        setDirty(false);
    };

    const load = React.useCallback(async () => {
        try {
            const res = await fetch(`/api/shifts/${boardId}/admin`);
            if (res.status === 401) {
                setPhase("auth");
                return;
            }
            if (!res.ok) {
                setErrorMsg("読み込みに失敗しました。");
                setPhase("error");
                return;
            }
            const view = (await res.json()) as AdminView;
            setData(view);
            hydrate(view);
            setPhase("ready");
        } catch {
            setErrorMsg("読み込みに失敗しました。");
            setPhase("error");
        }
    }, [boardId]);

    React.useEffect(() => {
        load();
    }, [load]);

    const handleAuth = async () => {
        setAuthError(null);
        setAuthing(true);
        try {
            const res = await fetch(`/api/shifts/${boardId}/admin-auth`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
            });
            if (!res.ok) {
                const d = (await res.json().catch(() => ({}))) as { error?: string };
                throw new Error(d.error === "Invalid password" ? "パスワードが違います。" : d.error ?? "失敗しました。");
            }
            setPassword("");
            setPhase("loading");
            await load();
        } catch (e) {
            setAuthError(e instanceof Error ? e.message : "エラーが発生しました。");
        } finally {
            setAuthing(false);
        }
    };

    // ---- slot / assignment mutation ----
    const patchSlot = (id: string, p: Partial<AdminSlot>) => {
        setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, ...p } : s)));
        setDirty(true);
    };
    const addSlot = (dayIndex: number, dayStartMin: number, dayEndMin: number) => {
        const start = dayStartMin;
        const end = Math.min(dayEndMin, start + 120);
        const s: AdminSlot = { id: newId(), dayIndex, startMin: start, endMin: end, role: "", place: "", capacity: 1 };
        setSlots((prev) => [...prev, s]);
        setDirty(true);
        setOpenSlotId(s.id);
    };
    const removeSlot = (id: string) => {
        setSlots((prev) => prev.filter((s) => s.id !== id));
        setAssign((prev) => {
            const next = new Map(prev);
            // eslint-disable-next-line drizzle/enforce-delete-with-where -- JS Map, not a Drizzle query
            next.delete(id);
            return next;
        });
        setDirty(true);
        setOpenSlotId(null);
    };
    const toggleAssign = (slotId: string, memberId: string) => {
        setAssign((prev) => {
            const next = new Map(prev);
            const set = new Set(next.get(slotId) ?? []);
            // eslint-disable-next-line drizzle/enforce-delete-with-where -- JS Set, not a Drizzle query
            if (set.has(memberId)) set.delete(memberId);
            else set.add(memberId);
            next.set(slotId, set);
            return next;
        });
        setDirty(true);
    };

    const save = React.useCallback(async () => {
        if (!data) return false;
        setSaving(true);
        try {
            const days = boardDays(data.board);
            const payloadSlots = slots
                .filter((s) => s.dayIndex < days.length)
                .map((s, i) => ({
                    id: s.id,
                    startsAt: dayMinToMs(days[s.dayIndex], s.startMin),
                    endsAt: dayMinToMs(days[s.dayIndex], s.endMin),
                    role: s.role.trim() || "シフト",
                    place: s.place.trim(),
                    capacity: s.capacity,
                    sortOrder: i,
                }));
            const slotRes = await fetch(`/api/shifts/${boardId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ slots: payloadSlots }),
            });
            if (!slotRes.ok) throw new Error();

            const liveIds = new Set(slots.map((s) => s.id));
            const pairs: { slotId: string; memberId: string }[] = [];
            for (const [slotId, set] of assign) {
                if (!liveIds.has(slotId)) continue;
                for (const memberId of set) pairs.push({ slotId, memberId });
            }
            const asgRes = await fetch(`/api/shifts/${boardId}/assignments`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ assignments: pairs }),
            });
            if (!asgRes.ok) throw new Error();
            setDirty(false);
            return true;
        } catch {
            setErrorMsg("保存に失敗しました。");
            return false;
        } finally {
            setSaving(false);
        }
    }, [data, slots, assign, boardId]);

    const togglePublish = async () => {
        if (!data) return;
        const next = data.board.status !== "published";
        if (next && dirty) {
            const ok = await save();
            if (!ok) return;
        }
        setPublishing(true);
        try {
            const res = await fetch(`/api/shifts/${boardId}/publish`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ published: next }),
            });
            if (!res.ok) throw new Error();
            setData({ ...data, board: { ...data.board, status: next ? "published" : "collecting" } });
        } catch {
            setErrorMsg("公開状態の変更に失敗しました。");
        } finally {
            setPublishing(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm("このシフト表を削除しますか？この操作は元に戻せません。")) return;
        const res = await fetch(`/api/shifts/${boardId}`, { method: "DELETE" });
        if (res.ok) window.location.href = "/shifts";
        else setErrorMsg("削除に失敗しました。");
    };

    const copyShareLink = async () => {
        try {
            await navigator.clipboard.writeText(`${window.location.origin}/shifts/${boardId}`);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            /* ignore */
        }
    };

    if (phase === "loading") {
        return (
            <div className="flex min-h-[40vh] items-center justify-center">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (phase === "auth") {
        return (
            <div className="mx-auto max-w-sm space-y-4 px-4 py-16">
                <h1 className="text-xl font-bold">管理者ログイン</h1>
                <Input
                    type="password"
                    placeholder="管理パスワード"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAuth()}
                />
                {authError && (
                    <p className="flex items-center gap-1.5 text-sm text-destructive">
                        <AlertCircle className="size-4" />
                        {authError}
                    </p>
                )}
                <Button onClick={handleAuth} disabled={authing} className="w-full gap-2">
                    {authing && <Loader2 className="size-4 animate-spin" />}
                    ログイン
                </Button>
            </div>
        );
    }

    if (phase === "error" || !data) {
        return (
            <div className="mx-auto max-w-2xl px-4 py-16 text-center">
                <AlertCircle className="mx-auto size-10 text-muted-foreground" />
                <p className="mt-3 text-muted-foreground">{errorMsg ?? "エラーが発生しました。"}</p>
            </div>
        );
    }

    const { board, members } = data;
    const days = boardDays(board);
    const isPublished = board.status === "published";

    const absOf = (s: AdminSlot) => {
        const mid = days[s.dayIndex];
        return { startsAt: dayMinToMs(mid, s.startMin), endsAt: dayMinToMs(mid, s.endMin) };
    };

    // メンバーの割当数・割当枠（時間重複検出と負荷バランス用）。
    const load_ = new Map<string, number>();
    const memberSlots = new Map<string, string[]>();
    for (const [slotId, set] of assign) {
        for (const mid of set) {
            load_.set(mid, (load_.get(mid) ?? 0) + 1);
            (memberSlots.get(mid) ?? memberSlots.set(mid, []).get(mid)!).push(slotId);
        }
    }
    const slotById = new Map(slots.map((s) => [s.id, s]));
    const hasTimeConflict = (slotId: string, memberId: string): boolean => {
        const s = slotById.get(slotId);
        if (!s) return false;
        const a = absOf(s);
        return (memberSlots.get(memberId) ?? []).some((other) => {
            if (other === slotId) return false;
            const o = slotById.get(other);
            if (!o) return false;
            const b = absOf(o);
            return rangesOverlap(a.startsAt, a.endsAt, b.startsAt, b.endsAt);
        });
    };

    // 自動割当（クライアント側・NGと時間重複を厳守、負荷の低い順に詰める）。
    const runAutoAssign = () => {
        const ld = new Map<string, number>(members.map((m) => [m.id, 0]));
        const spans = new Map<string, { s: number; e: number }[]>();
        const ordered = [...slots].sort((a, b) => absOf(a).startsAt - absOf(b).startsAt);
        const next = new Map<string, Set<string>>();
        for (const slot of ordered) {
            const a = absOf(slot);
            const cands = members
                .filter((m) => !slotIsNg({ startsAt: a.startsAt, endsAt: a.endsAt }, m.unavailableRanges))
                .filter((m) => !(spans.get(m.id) ?? []).some((sp) => rangesOverlap(a.startsAt, a.endsAt, sp.s, sp.e)))
                .sort((x, y) => (ld.get(x.id)! - ld.get(y.id)!));
            const set = new Set<string>();
            for (const m of cands.slice(0, slot.capacity)) {
                set.add(m.id);
                ld.set(m.id, ld.get(m.id)! + 1);
                (spans.get(m.id) ?? spans.set(m.id, []).get(m.id)!).push({ s: a.startsAt, e: a.endsAt });
            }
            next.set(slot.id, set);
        }
        setAssign(next);
        setDirty(true);
    };

    // 警告サマリ。
    const overlapWarnings: { member: string; a: AdminSlot; b: AdminSlot }[] = [];
    const ngWarnings: { member: string; slot: AdminSlot }[] = [];
    for (const m of members) {
        const ms = (memberSlots.get(m.id) ?? [])
            .map((id) => slotById.get(id))
            .filter((s): s is AdminSlot => !!s)
            .sort((a, b) => absOf(a).startsAt - absOf(b).startsAt);
        for (let i = 0; i < ms.length; i++) {
            const a = absOf(ms[i]);
            if (slotIsNg({ startsAt: a.startsAt, endsAt: a.endsAt }, m.unavailableRanges))
                ngWarnings.push({ member: m.name, slot: ms[i] });
            for (let j = i + 1; j < ms.length; j++) {
                const b = absOf(ms[j]);
                if (rangesOverlap(a.startsAt, a.endsAt, b.startsAt, b.endsAt))
                    overlapWarnings.push({ member: m.name, a: ms[i], b: ms[j] });
            }
        }
    }

    const slotTimeLabel = (s: AdminSlot) => `${formatMinutes(s.startMin)}–${formatMinutes(s.endMin)}`;
    const day = Math.min(activeDay, Math.max(0, days.length - 1));
    const daySlots = slots
        .filter((s) => s.dayIndex === day)
        .sort((a, b) => a.startMin - b.startMin);
    const blocks: TimelineBlock[] = daySlots.map((s) => {
        const assigned = assign.get(s.id)?.size ?? 0;
        return {
            key: s.id,
            startMin: s.startMin,
            endMin: s.endMin,
            label: `${s.role || "（未設定）"} ${assigned}/${s.capacity}`,
            tone: "slot",
        };
    });

    const openSlot = openSlotId ? slots.find((s) => s.id === openSlotId) ?? null : null;

    return (
        <div className="w-full space-y-6 px-6 py-10 lg:px-12">
            <header className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-bold">{board.title}</h1>
                    <span
                        className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium",
                            isPublished ? "bg-emerald-500/15 text-emerald-700" : "bg-amber-500/15 text-amber-700"
                        )}
                    >
                        {isPublished ? "公開済み" : "募集中"}
                    </span>
                </div>
                <p className="text-sm text-muted-foreground">
                    {board.startDate === board.endDate
                        ? formatDay(board.startDate)
                        : `${formatDay(board.startDate)} 〜 ${formatDay(board.endDate)}`}{" "}
                    ・ {formatMinutes(board.dayStartMin)}–{formatMinutes(board.dayEndMin)} ・ 回答 {members.length} 名
                </p>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={copyShareLink} className="gap-1">
                        {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
                        {copied ? "コピーしました" : "共有リンク"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDelete} className="gap-1 text-destructive">
                        <Trash2 className="size-4" /> 削除
                    </Button>
                </div>
            </header>

            {errorMsg && (
                <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertCircle className="size-4" />
                    {errorMsg}
                </div>
            )}

            {members.length === 0 && (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    まだ回答がありません。共有リンクをメンバーに配布してください（枠は今のうちに作成できます）。
                </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" size="sm" onClick={runAutoAssign} className="gap-1" disabled={slots.length === 0}>
                    <Wand2 className="size-4" /> 自動割当
                </Button>
                <Button size="sm" onClick={save} disabled={saving || !dirty} className="gap-1">
                    {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    {dirty ? "保存" : "保存済み"}
                </Button>
                <Button
                    variant={isPublished ? "outline" : "default"}
                    size="sm"
                    onClick={togglePublish}
                    disabled={publishing}
                    className="gap-1"
                >
                    {publishing ? (
                        <Loader2 className="size-4 animate-spin" />
                    ) : isPublished ? (
                        <EyeOff className="size-4" />
                    ) : (
                        <Eye className="size-4" />
                    )}
                    {isPublished ? "非公開に戻す" : "公開する"}
                </Button>
            </div>

            {(overlapWarnings.length > 0 || ngWarnings.length > 0) && (
                <div className="space-y-1 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800">
                    <div className="flex items-center gap-1.5 font-medium">
                        <AlertTriangle className="size-4" /> 割当の警告
                    </div>
                    {overlapWarnings.map((w, i) => (
                        <div key={`o${i}`}>
                            <b>{w.member}</b> が時間の重なる枠に二重割当: 「{w.a.role}」{slotTimeLabel(w.a)} と 「{w.b.role}」
                            {slotTimeLabel(w.b)}
                        </div>
                    ))}
                    {ngWarnings.map((w, i) => (
                        <div key={`n${i}`}>
                            <b>{w.member}</b> は NG 時間帯に割当: 「{w.slot.role}」{slotTimeLabel(w.slot)}
                        </div>
                    ))}
                </div>
            )}

            {/* 日タブ */}
            {days.length > 1 && (
                <div className="flex flex-wrap gap-1">
                    {days.map((d, i) => (
                        <button
                            type="button"
                            key={d}
                            onClick={() => setActiveDay(i)}
                            className={cn(
                                "rounded-md border px-2.5 py-1 text-xs",
                                i === day ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-accent"
                            )}
                        >
                            {formatDay(d)}
                            <span className="ml-1 opacity-70">({slots.filter((s) => s.dayIndex === i).length})</span>
                        </button>
                    ))}
                </div>
            )}

            <p className="text-xs text-muted-foreground">
                バーをドラッグで移動・端で時間調整、<b>クリックで割当ポップアップ</b>を開きます。
            </p>

            <ShiftBandTimeline
                axisStartMin={board.dayStartMin}
                axisEndMin={board.dayEndMin}
                blocks={blocks}
                onChange={(id, s, e) => patchSlot(id, { startMin: s, endMin: e })}
                onActivate={(id) => setOpenSlotId(id)}
            />

            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addSlot(day, board.dayStartMin, board.dayEndMin)}
                className="gap-1"
            >
                <Plus className="size-4" /> {formatDay(days[day])} に枠を追加
            </Button>

            <Dialog open={!!openSlot} onOpenChange={(o) => !o && setOpenSlotId(null)}>
                <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
                    {openSlot && (
                        <SlotAssignDialog
                            slot={openSlot}
                            members={members}
                            absRange={absOf(openSlot)}
                            assigned={assign.get(openSlot.id) ?? new Set()}
                            load={load_}
                            hasTimeConflict={(mid) => hasTimeConflict(openSlot.id, mid)}
                            onPatch={(p) => patchSlot(openSlot.id, p)}
                            onToggle={(mid) => toggleAssign(openSlot.id, mid)}
                            onDelete={() => removeSlot(openSlot.id)}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

function SlotAssignDialog({
    slot,
    members,
    absRange,
    assigned,
    load,
    hasTimeConflict,
    onPatch,
    onToggle,
    onDelete,
}: {
    slot: AdminSlot;
    members: ShiftAdminMember[];
    absRange: { startsAt: number; endsAt: number };
    assigned: Set<string>;
    load: Map<string, number>;
    hasTimeConflict: (memberId: string) => boolean;
    onPatch: (p: Partial<AdminSlot>) => void;
    onToggle: (memberId: string) => void;
    onDelete: () => void;
}) {
    const over = assigned.size > slot.capacity;

    // 部署別にグルーピング（NG でないメンバーを優先表示、NG は末尾に淡色で）。
    const byDept = new Map<string, ShiftAdminMember[]>();
    for (const m of members) {
        const key = m.department && m.department.length > 0 ? m.department : "（部署なし）";
        (byDept.get(key) ?? byDept.set(key, []).get(key)!).push(m);
    }
    const deptNames = [...byDept.keys()].sort((a, b) => a.localeCompare(b, "ja"));

    const isNg = (m: ShiftAdminMember) => slotIsNg(absRange, m.unavailableRanges);

    return (
        <>
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    <Clock className="size-4 text-primary" />
                    {slot.role || "シフト枠"}
                </DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                    <label className="col-span-2 space-y-1 text-xs">
                        <span className="text-muted-foreground">役割 / タスク名</span>
                        <Input value={slot.role} onChange={(e) => onPatch({ role: e.target.value })} placeholder="例: 受付" />
                    </label>
                    <label className="space-y-1 text-xs">
                        <span className="text-muted-foreground">場所</span>
                        <Input value={slot.place} onChange={(e) => onPatch({ place: e.target.value })} placeholder="場所" />
                    </label>
                    <label className="space-y-1 text-xs">
                        <span className="text-muted-foreground">定員</span>
                        <Input
                            type="number"
                            min={1}
                            max={1000}
                            value={slot.capacity}
                            onChange={(e) => onPatch({ capacity: Math.max(1, Math.min(1000, Number(e.target.value) || 1)) })}
                        />
                    </label>
                    <label className="space-y-1 text-xs">
                        <span className="text-muted-foreground">開始</span>
                        <Input
                            type="time"
                            step={SNAP_MINUTES * 60}
                            value={formatMinutes(Math.min(slot.startMin, 1439))}
                            onChange={(e) => {
                                const m = parseHm(e.target.value);
                                if (m !== null && m < slot.endMin) onPatch({ startMin: m });
                            }}
                        />
                    </label>
                    <label className="space-y-1 text-xs">
                        <span className="text-muted-foreground">終了</span>
                        <Input
                            type="time"
                            step={SNAP_MINUTES * 60}
                            value={formatMinutes(Math.min(slot.endMin, 1439))}
                            onChange={(e) => {
                                const m = parseHm(e.target.value);
                                if (m !== null && m > slot.startMin) onPatch({ endMin: m });
                            }}
                        />
                    </label>
                </div>

                <div className="flex items-center justify-between border-t pt-2 text-sm">
                    <span className="font-medium">この時間に割り当てるメンバー</span>
                    <span className={cn("flex items-center gap-1 text-xs", over ? "text-amber-600" : "text-muted-foreground")}>
                        <Users className="size-3" />
                        {assigned.size}/{slot.capacity}
                    </span>
                </div>

                <div className="space-y-2">
                    {members.length === 0 && <p className="text-xs text-muted-foreground">回答メンバーがいません。</p>}
                    {deptNames.map((dept) => {
                        const ms = byDept.get(dept)!.slice().sort((a, b) => Number(isNg(a)) - Number(isNg(b)));
                        return (
                            <div key={dept}>
                                <div className="mb-1 text-xs font-medium text-muted-foreground">{dept}</div>
                                <div className="flex flex-wrap gap-1.5">
                                    {ms.map((m) => {
                                        const ng = isNg(m);
                                        const on = assigned.has(m.id);
                                        const conflict = on && hasTimeConflict(m.id);
                                        return (
                                            <button
                                                type="button"
                                                key={m.id}
                                                disabled={ng && !on}
                                                onClick={() => onToggle(m.id)}
                                                title={ng ? "本人の NG 時間帯と重なる" : undefined}
                                                className={cn(
                                                    "flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
                                                    ng && !on && "cursor-not-allowed border-destructive/30 bg-destructive/5 text-destructive/60 line-through",
                                                    on && !conflict && "border-primary bg-primary text-primary-foreground",
                                                    on && conflict && "border-amber-500 bg-amber-400/80 text-amber-950",
                                                    !on && !ng && "border-border bg-background hover:border-primary/50 hover:bg-accent"
                                                )}
                                            >
                                                {ng && <Ban className="size-3" />}
                                                {m.name}
                                                <span className="opacity-60">({load.get(m.id) ?? 0})</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="flex justify-between border-t pt-3">
                    <Button variant="ghost" size="sm" onClick={onDelete} className="gap-1 text-destructive">
                        <Trash2 className="size-4" /> この枠を削除
                    </Button>
                    <span className="text-xs text-muted-foreground">変更は「保存」で確定します</span>
                </div>
            </div>
        </>
    );
}
