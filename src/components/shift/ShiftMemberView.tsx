"use client";

import * as React from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
    Loader2,
    AlertCircle,
    CheckCircle2,
    CalendarClock,
    MapPin,
    Users,
    Ban,
    Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/hooks/useUser";
import {
    DAY_MS,
    boardDays,
    dayIndexOf,
    dayMinToMs,
    msToDayMin,
    formatMinutes,
    formatDay,
    type ShiftPublicView,
    type ShiftMemberDetail,
} from "@/lib/shift";
import { ShiftNgEditor, type DraftRange } from "./ShiftNgEditor";

function memberStorageKey(boardId: string) {
    return `chosei_shift_member_${boardId}`;
}

let loadKeyCounter = 0;

export function ShiftMemberView({ boardId }: { boardId: string }) {
    const { userId } = useUser();
    const [view, setView] = React.useState<ShiftPublicView | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [loadError, setLoadError] = React.useState<string | null>(null);

    const [memberId, setMemberId] = React.useState<string | null>(null);
    const [name, setName] = React.useState("");
    const [comment, setComment] = React.useState("");
    const [ranges, setRanges] = React.useState<DraftRange[]>([]);
    const [assignedSlotIds, setAssignedSlotIds] = React.useState<Set<string>>(new Set());

    const [submitting, setSubmitting] = React.useState(false);
    const [submitError, setSubmitError] = React.useState<string | null>(null);
    const [saved, setSaved] = React.useState(false);

    React.useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`/api/shifts/${boardId}`);
                if (res.status === 410) {
                    setLoadError("このシフト表は削除されました。");
                    return;
                }
                if (!res.ok) {
                    setLoadError("シフト表が見つかりませんでした。");
                    return;
                }
                setView((await res.json()) as ShiftPublicView);
            } catch {
                setLoadError("読み込みに失敗しました。");
            } finally {
                setLoading(false);
            }
        })();
    }, [boardId]);

    // 既存メンバーの復元（公開ビュー取得後に board.startDate で変換する）。
    React.useEffect(() => {
        if (!view) return;
        const stored = localStorage.getItem(memberStorageKey(boardId));
        if (!stored) return;
        setMemberId(stored);
        (async () => {
            try {
                const res = await fetch(`/api/shifts/${boardId}/member/${stored}`);
                if (!res.ok) {
                    localStorage.removeItem(memberStorageKey(boardId));
                    setMemberId(null);
                    return;
                }
                const m = (await res.json()) as ShiftMemberDetail;
                setName(m.name);
                setComment(m.comment ?? "");
                setAssignedSlotIds(new Set(m.assignedSlotIds));
                const sd = view.board.startDate;
                setRanges(
                    m.unavailableRanges.map((r) => {
                        loadKeyCounter += 1;
                        const di = dayIndexOf(r.startsAt, sd);
                        const mid = sd + di * DAY_MS;
                        return {
                            key: `load-${loadKeyCounter}`,
                            dayIndex: di,
                            startMin: msToDayMin(r.startsAt, mid),
                            endMin: msToDayMin(r.endsAt, mid),
                        } as DraftRange;
                    })
                );
            } catch {
                /* ignore */
            }
        })();
    }, [boardId, view]);

    const handleSubmit = async () => {
        setSubmitError(null);
        if (!name.trim()) return setSubmitError("名前を入力してください。");
        if (!view) return;
        const days = boardDays(view.board);
        const payloadRanges = ranges
            .filter((r) => r.dayIndex < days.length && r.endMin > r.startMin)
            .map((r) => {
                const mid = days[r.dayIndex];
                return { startsAt: dayMinToMs(mid, r.startMin), endsAt: dayMinToMs(mid, r.endMin) };
            });

        setSubmitting(true);
        try {
            const res = await fetch(`/api/shifts/${boardId}/members`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    comment,
                    memberId: memberId ?? undefined,
                    userId: userId ?? undefined,
                    unavailableRanges: payloadRanges,
                }),
            });
            if (!res.ok) {
                const data = (await res.json().catch(() => ({}))) as { error?: string };
                throw new Error(data.error ?? "送信に失敗しました。");
            }
            const data = (await res.json()) as { memberId: string };
            setMemberId(data.memberId);
            localStorage.setItem(memberStorageKey(boardId), data.memberId);
            setSaved(true);
        } catch (e) {
            setSubmitError(e instanceof Error ? e.message : "エラーが発生しました。");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-[40vh] items-center justify-center">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (loadError || !view) {
        return (
            <div className="mx-auto max-w-2xl px-4 py-16 text-center">
                <AlertCircle className="mx-auto size-10 text-muted-foreground" />
                <p className="mt-3 text-muted-foreground">{loadError ?? "見つかりませんでした。"}</p>
            </div>
        );
    }

    const { board, slots, assignments } = view;
    const days = boardDays(board);
    const isPublished = board.status === "published";

    // 参照用: 日ごとのシフト枠（背景表示）。
    const slotsByDay: Record<number, { startMin: number; endMin: number; label?: string }[]> = {};
    for (const s of slots) {
        const di = dayIndexOf(s.startsAt, board.startDate);
        const mid = board.startDate + di * DAY_MS;
        (slotsByDay[di] ??= []).push({
            startMin: msToDayMin(s.startsAt, mid),
            endMin: msToDayMin(s.endsAt, mid),
            label: s.role,
        });
    }

    const dateRangeLabel =
        board.startDate === board.endDate
            ? formatDay(board.startDate)
            : `${formatDay(board.startDate)} 〜 ${formatDay(board.endDate)}`;

    return (
        <div className="w-full space-y-6 px-6 py-10 lg:px-12">
            <header className="space-y-1">
                <h1 className="text-2xl font-bold">{board.title}</h1>
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <CalendarClock className="size-4" />
                    {dateRangeLabel} ・ {formatMinutes(board.dayStartMin)}–{formatMinutes(board.dayEndMin)}
                </p>
                {board.description && (
                    <p className="whitespace-pre-wrap pt-1 text-sm text-muted-foreground">
                        {board.description}
                    </p>
                )}
            </header>

            {isPublished ? (
                <PublishedRoster
                    board={board}
                    days={days}
                    slots={slots}
                    assignments={assignments}
                    myAssigned={assignedSlotIds}
                />
            ) : (
                <>
                    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
                        <Ban className="mr-1 inline size-4 text-destructive" />
                        参加できない時間帯を日付ごとに指定して送信してください。
                        指定しなかった時間は「参加できる」として扱われます。
                    </div>

                    <div className="space-y-4">
                        <Input
                            className="max-w-md"
                            placeholder="あなたの名前"
                            value={name}
                            onChange={(e) => {
                                setName(e.target.value);
                                setSaved(false);
                            }}
                            maxLength={100}
                        />

                        <ShiftNgEditor
                            days={days}
                            dayStartMin={board.dayStartMin}
                            dayEndMin={board.dayEndMin}
                            ranges={ranges}
                            onChange={(r) => {
                                setRanges(r);
                                setSaved(false);
                            }}
                            slotsByDay={slotsByDay}
                        />

                        <Textarea
                            className="max-w-2xl"
                            placeholder="連絡事項・コメント（任意）"
                            value={comment}
                            onChange={(e) => {
                                setComment(e.target.value);
                                setSaved(false);
                            }}
                            rows={2}
                            maxLength={1000}
                        />

                        {submitError && (
                            <p className="flex items-center gap-1.5 text-sm text-destructive">
                                <AlertCircle className="size-4" />
                                {submitError}
                            </p>
                        )}
                        {saved && (
                            <p className="flex items-center gap-1.5 text-sm text-emerald-600">
                                <CheckCircle2 className="size-4" />
                                送信しました。割当が公開されるとここで確認できます。
                            </p>
                        )}

                        <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
                            {submitting && <Loader2 className="size-4 animate-spin" />}
                            {memberId ? "回答を更新" : "送信"}
                        </Button>
                    </div>
                </>
            )}

            <footer className="border-t pt-4 text-center text-xs text-muted-foreground">
                <Link href={`/shifts/${boardId}/admin`} className="underline hover:text-foreground">
                    管理者の方はこちら
                </Link>
            </footer>
        </div>
    );
}

function PublishedRoster({
    board,
    days,
    slots,
    assignments,
    myAssigned,
}: {
    board: ShiftPublicView["board"];
    days: number[];
    slots: ShiftPublicView["slots"];
    assignments: ShiftPublicView["assignments"];
    myAssigned: Set<string>;
}) {
    const bySlot = new Map<string, string[]>();
    for (const a of assignments) {
        const arr = bySlot.get(a.slotId) ?? [];
        if (a.name) arr.push(a.name);
        bySlot.set(a.slotId, arr);
    }

    return (
        <div className="space-y-4">
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
                <CheckCircle2 className="mr-1 inline size-4 text-emerald-600" />
                シフトが公開されました。あなたの担当枠は強調表示されています。
            </div>
            {days.map((d, di) => {
                const daySlots = slots
                    .filter((s) => dayIndexOf(s.startsAt, board.startDate) === di)
                    .sort((a, b) => a.startsAt - b.startsAt);
                if (daySlots.length === 0) return null;
                return (
                    <div key={d} className="space-y-2">
                        <h3 className="text-sm font-semibold text-muted-foreground">{formatDay(d)}</h3>
                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                            {daySlots.map((s) => {
                                const names = bySlot.get(s.id) ?? [];
                                const mine = myAssigned.has(s.id);
                                const mid = board.startDate + di * DAY_MS;
                                return (
                                    <div
                                        key={s.id}
                                        className={cn(
                                            "rounded-lg border p-3",
                                            mine ? "border-primary bg-primary/5" : "border-border"
                                        )}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="font-medium">
                                                {s.role}
                                                {mine && (
                                                    <span className="ml-2 rounded bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
                                                        担当
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {formatMinutes(msToDayMin(s.startsAt, mid))}–
                                                {formatMinutes(msToDayMin(s.endsAt, mid))}
                                            </div>
                                        </div>
                                        {s.place && (
                                            <div className="mt-1 flex items-center gap-0.5 text-xs text-muted-foreground">
                                                <MapPin className="size-3" />
                                                {s.place}
                                            </div>
                                        )}
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                            {names.length > 0 ? (
                                                names.map((n, i) => (
                                                    <span
                                                        key={i}
                                                        className="rounded-full bg-muted px-2 py-0.5 text-xs"
                                                    >
                                                        {n}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="flex items-center gap-1 text-xs text-amber-600">
                                                    <Lock className="size-3" /> 未割当
                                                </span>
                                            )}
                                            <span className="ml-auto flex items-center gap-0.5 text-xs text-muted-foreground">
                                                <Users className="size-3" />
                                                {names.length}/{s.capacity}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
