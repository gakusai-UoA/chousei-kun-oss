"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Loader2,
    AlertCircle,
    Eye,
    EyeOff,
    Save,
    Trash2,
    Link2,
    Check,
    Ban,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    DAY_MS,
    boardDays,
    dayIndexOf,
    dayMinToMs,
    msToDayMin,
    formatMinutes,
    formatDay,
    type ShiftAdminView as AdminView,
} from "@/lib/shift";
import { ShiftLaneGantt, type Lane } from "./ShiftLaneGantt";

type Phase = "loading" | "auth" | "ready" | "error";

const laneId = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `lane-${Math.random()}`;

export function ShiftAdminView({ boardId }: { boardId: string }) {
    const [phase, setPhase] = React.useState<Phase>("loading");
    const [data, setData] = React.useState<AdminView | null>(null);
    const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

    // 日ごとのレーン（役割）配列。
    const [dayLanes, setDayLanes] = React.useState<Record<number, Lane[]>>({});
    const [dirty, setDirty] = React.useState(false);

    const [password, setPassword] = React.useState("");
    const [authError, setAuthError] = React.useState<string | null>(null);
    const [authing, setAuthing] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [publishing, setPublishing] = React.useState(false);
    const [copied, setCopied] = React.useState(false);
    const [activeDay, setActiveDay] = React.useState(0);

    const hydrate = (view: AdminView) => {
        const byDay: Record<number, Map<string, Lane>> = {};
        const sorted = [...view.slots].sort((a, b) => a.sortOrder - b.sortOrder || a.startsAt - b.startsAt);
        for (const s of sorted) {
            const di = dayIndexOf(s.startsAt, view.board.startDate);
            const mid = view.board.startDate + di * DAY_MS;
            (byDay[di] ??= new Map<string, Lane>());
            const laneMap = byDay[di];
            if (!laneMap.has(s.role)) laneMap.set(s.role, { laneId: laneId(), role: s.role, segments: [] });
            laneMap.get(s.role)!.segments.push({
                id: s.id,
                startMin: msToDayMin(s.startsAt, mid),
                endMin: msToDayMin(s.endsAt, mid),
                place: s.place ?? "",
                capacity: s.capacity,
            });
        }
        const lanesByDay: Record<number, Lane[]> = {};
        for (const di of Object.keys(byDay)) lanesByDay[Number(di)] = [...byDay[Number(di)].values()];
        setDayLanes(lanesByDay);
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

    const setLanesForDay = (di: number, lanes: Lane[]) => {
        setDayLanes((prev) => ({ ...prev, [di]: lanes }));
        setDirty(true);
    };

    const save = React.useCallback(async () => {
        if (!data) return;
        setSaving(true);
        try {
            const days = boardDays(data.board);
            const payloadSlots: {
                id: string;
                startsAt: number;
                endsAt: number;
                role: string;
                place: string;
                capacity: number;
                sortOrder: number;
            }[] = [];
            let order = 0;
            for (const diStr of Object.keys(dayLanes)) {
                const di = Number(diStr);
                if (di >= days.length) continue;
                const mid = days[di];
                for (const lane of dayLanes[di]) {
                    for (const seg of lane.segments) {
                        payloadSlots.push({
                            id: seg.id,
                            startsAt: dayMinToMs(mid, seg.startMin),
                            endsAt: dayMinToMs(mid, seg.endMin),
                            role: lane.role.trim() || "シフト",
                            place: seg.place.trim(),
                            capacity: seg.capacity,
                            sortOrder: order++,
                        });
                    }
                }
            }
            const res = await fetch(`/api/shifts/${boardId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ slots: payloadSlots }),
            });
            if (!res.ok) throw new Error();
            setDirty(false);
        } catch {
            setErrorMsg("保存に失敗しました。");
        } finally {
            setSaving(false);
        }
    }, [data, dayLanes, boardId]);

    const togglePublish = async () => {
        if (!data) return;
        const next = data.board.status !== "published";
        if (next && dirty) await save();
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
    const day = Math.min(activeDay, Math.max(0, days.length - 1));

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
                            <span className="ml-1 opacity-70">({(dayLanes[i] ?? []).length}行)</span>
                        </button>
                    ))}
                </div>
            )}

            <p className="text-xs text-muted-foreground">
                1 行 = 役割。行に時間区分を横に並べます（例: 受付 = 10:00–11:00, 11:00–12:00…）。
                バーはドラッグで移動・端で時間調整、クリックで編集。
            </p>

            <ShiftLaneGantt
                axisStartMin={board.dayStartMin}
                axisEndMin={board.dayEndMin}
                lanes={dayLanes[day] ?? []}
                onChange={(lanes) => setLanesForDay(day, lanes)}
            />

            {/* 回答メンバー一覧（割当は別ステップ。ここでは参照のみ） */}
            <details className="rounded-lg border p-3">
                <summary className="cursor-pointer text-sm font-medium">回答メンバー {members.length} 名</summary>
                <div className="mt-2 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                    {members.map((m) => (
                        <div key={m.id} className="flex items-center justify-between gap-2 rounded border px-2 py-1 text-xs">
                            <span className="truncate">
                                {m.name}
                                {m.department && <span className="ml-1 text-muted-foreground">/ {m.department}</span>}
                            </span>
                            {m.unavailableRanges.length > 0 && (
                                <span className="flex shrink-0 items-center gap-0.5 text-destructive">
                                    <Ban className="size-3" />
                                    {m.unavailableRanges.length}
                                </span>
                            )}
                        </div>
                    ))}
                    {members.length === 0 && (
                        <p className="text-xs text-muted-foreground">まだ回答がありません。</p>
                    )}
                </div>
            </details>
        </div>
    );
}
