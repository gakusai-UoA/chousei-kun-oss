"use client";

import * as React from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Loader2,
    AlertCircle,
    AlertTriangle,
    Users,
    MapPin,
    Wand2,
    Save,
    Eye,
    EyeOff,
    Pencil,
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
    msToDayMin,
    formatMinutes,
    formatDay,
    rangesOverlap,
    slotIsNg,
    type ShiftAdminView as AdminView,
    type ShiftSlot,
} from "@/lib/shift";

type Phase = "loading" | "auth" | "ready" | "error";

export function ShiftAdminView({ boardId }: { boardId: string }) {
    const [phase, setPhase] = React.useState<Phase>("loading");
    const [data, setData] = React.useState<AdminView | null>(null);
    const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

    const [assign, setAssign] = React.useState<Map<string, Set<string>>>(new Map());
    const [dirty, setDirty] = React.useState(false);

    const [password, setPassword] = React.useState("");
    const [authError, setAuthError] = React.useState<string | null>(null);
    const [authing, setAuthing] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [publishing, setPublishing] = React.useState(false);
    const [autoLoading, setAutoLoading] = React.useState(false);
    const [copied, setCopied] = React.useState(false);

    const buildAssignMap = (view: AdminView) => {
        const m = new Map<string, Set<string>>();
        for (const a of view.assignments) {
            const set = m.get(a.slotId) ?? new Set<string>();
            set.add(a.memberId);
            m.set(a.slotId, set);
        }
        return m;
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
            setAssign(buildAssignMap(view));
            setDirty(false);
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

    const runAutoAssign = async () => {
        setAutoLoading(true);
        try {
            const res = await fetch(`/api/shifts/${boardId}/auto-assign`, { method: "POST" });
            if (!res.ok) throw new Error();
            const { assignments } = (await res.json()) as {
                assignments: { slotId: string; memberId: string }[];
            };
            const m = new Map<string, Set<string>>();
            for (const a of assignments) {
                const set = m.get(a.slotId) ?? new Set<string>();
                set.add(a.memberId);
                m.set(a.slotId, set);
            }
            setAssign(m);
            setDirty(true);
        } catch {
            setErrorMsg("自動割当に失敗しました。");
        } finally {
            setAutoLoading(false);
        }
    };

    const save = async () => {
        setSaving(true);
        try {
            const pairs: { slotId: string; memberId: string }[] = [];
            for (const [slotId, set] of assign) {
                for (const memberId of set) pairs.push({ slotId, memberId });
            }
            const res = await fetch(`/api/shifts/${boardId}/assignments`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ assignments: pairs }),
            });
            if (!res.ok) throw new Error();
            setDirty(false);
        } catch {
            setErrorMsg("保存に失敗しました。");
        } finally {
            setSaving(false);
        }
    };

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

    const { board, slots, members } = data;
    const days = boardDays(board);
    const isPublished = board.status === "published";
    const slotById = new Map(slots.map((s) => [s.id, s]));

    const slotTime = (s: ShiftSlot) => {
        const di = dayIndexOf(s.startsAt, board.startDate);
        const mid = board.startDate + di * DAY_MS;
        return `${formatMinutes(msToDayMin(s.startsAt, mid))}–${formatMinutes(msToDayMin(s.endsAt, mid))}`;
    };

    // メンバーごとの割当数（負荷バランスの目安）と割当枠。
    const load_ = new Map<string, number>();
    const memberSlots = new Map<string, string[]>();
    for (const [slotId, set] of assign) {
        for (const mid of set) {
            load_.set(mid, (load_.get(mid) ?? 0) + 1);
            const arr = memberSlots.get(mid) ?? [];
            arr.push(slotId);
            memberSlots.set(mid, arr);
        }
    }

    const hasTimeConflict = (slotId: string, memberId: string): boolean => {
        const s = slotById.get(slotId);
        if (!s) return false;
        return (memberSlots.get(memberId) ?? []).some((other) => {
            if (other === slotId) return false;
            const o = slotById.get(other);
            return o ? rangesOverlap(s.startsAt, s.endsAt, o.startsAt, o.endsAt) : false;
        });
    };

    // 警告サマリ: ①時間重複の二重割当 ②本人 NG 時間帯への割当。
    const overlapWarnings: { member: string; a: ShiftSlot; b: ShiftSlot }[] = [];
    const ngWarnings: { member: string; slot: ShiftSlot }[] = [];
    for (const m of members) {
        const sids = (memberSlots.get(m.id) ?? [])
            .map((id) => slotById.get(id))
            .filter((s): s is ShiftSlot => !!s)
            .sort((a, b) => a.startsAt - b.startsAt);
        for (let i = 0; i < sids.length; i++) {
            if (slotIsNg(sids[i], m.unavailableRanges)) ngWarnings.push({ member: m.name, slot: sids[i] });
            for (let j = i + 1; j < sids.length; j++) {
                if (rangesOverlap(sids[i].startsAt, sids[i].endsAt, sids[j].startsAt, sids[j].endsAt))
                    overlapWarnings.push({ member: m.name, a: sids[i], b: sids[j] });
            }
        }
    }

    return (
        <div className="w-full space-y-6 px-6 py-10 lg:px-12">
            <header className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-bold">{board.title}</h1>
                    <span
                        className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium",
                            isPublished
                                ? "bg-emerald-500/15 text-emerald-700"
                                : "bg-amber-500/15 text-amber-700"
                        )}
                    >
                        {isPublished ? "公開済み" : "募集中"}
                    </span>
                </div>
                <p className="text-sm text-muted-foreground">
                    {board.startDate === board.endDate
                        ? formatDay(board.startDate)
                        : `${formatDay(board.startDate)} 〜 ${formatDay(board.endDate)}`}{" "}
                    ・ 回答 {members.length} 名
                </p>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={copyShareLink} className="gap-1">
                        {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
                        {copied ? "コピーしました" : "共有リンク"}
                    </Button>
                    <Button variant="outline" size="sm" asChild className="gap-1">
                        <Link href={`/shifts/${boardId}/edit`}>
                            <Pencil className="size-4" /> 枠を作成・編集
                        </Link>
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

            {members.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                    まだ回答がありません。共有リンクをメンバーに配布してください。
                </div>
            ) : slots.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                    回答が {members.length} 名分集まっています。
                    <Link href={`/shifts/${boardId}/edit`} className="mx-1 text-primary underline">
                        枠を作成
                    </Link>
                    すると、ここで NG・定員を見ながら割り当てられます。
                </div>
            ) : (
                <>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={runAutoAssign}
                            disabled={autoLoading}
                            className="gap-1"
                        >
                            {autoLoading ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
                            自動割当（提案）
                        </Button>
                        <Button size="sm" onClick={save} disabled={saving || !dirty} className="gap-1">
                            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                            {dirty ? "割当を保存" : "保存済み"}
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
                                    <b>{w.member}</b> が時間の重なる枠に二重割当: 「{w.a.role}」{slotTime(w.a)} と 「
                                    {w.b.role}」{slotTime(w.b)}
                                </div>
                            ))}
                            {ngWarnings.map((w, i) => (
                                <div key={`n${i}`}>
                                    <b>{w.member}</b> は NG 時間帯に割当: 「{w.slot.role}」{slotTime(w.slot)}
                                </div>
                            ))}
                        </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                        各枠でメンバーをタップして割当します。
                        <Ban className="mx-1 inline size-3 text-destructive" />
                        は本人の NG 時間帯と重なる枠で、割当できません。背景が黄色は時間が重複している警告です。
                    </p>

                    {days.map((d, di) => {
                        const daySlots = slots
                            .filter((s) => dayIndexOf(s.startsAt, board.startDate) === di)
                            .sort((a, b) => a.startsAt - b.startsAt);
                        if (daySlots.length === 0) return null;
                        return (
                            <div key={d} className="space-y-2">
                                <h3 className="text-sm font-semibold text-muted-foreground">{formatDay(d)}</h3>
                                <div className="grid gap-3 xl:grid-cols-2">
                                    {daySlots.map((s) => {
                                        const assigned = assign.get(s.id) ?? new Set<string>();
                                        const over = assigned.size > s.capacity;
                                        return (
                                            <div key={s.id} className="rounded-lg border p-3">
                                                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                                    <div className="font-medium">
                                                        {s.role}
                                                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                                                            {slotTime(s)}
                                                            {s.place && (
                                                                <>
                                                                    {" ・ "}
                                                                    <MapPin className="inline size-3" /> {s.place}
                                                                </>
                                                            )}
                                                        </span>
                                                    </div>
                                                    <span
                                                        className={cn(
                                                            "flex items-center gap-1 rounded px-1.5 py-0.5 text-xs",
                                                            over
                                                                ? "bg-amber-500/15 text-amber-700"
                                                                : "bg-muted text-muted-foreground"
                                                        )}
                                                    >
                                                        <Users className="size-3" />
                                                        {assigned.size}/{s.capacity}
                                                    </span>
                                                </div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {members.map((m) => {
                                                        const ng = slotIsNg(s, m.unavailableRanges);
                                                        const on = assigned.has(m.id);
                                                        const conflict = on && hasTimeConflict(s.id, m.id);
                                                        return (
                                                            <button
                                                                type="button"
                                                                key={m.id}
                                                                disabled={ng && !on}
                                                                onClick={() => toggleAssign(s.id, m.id)}
                                                                title={ng ? "本人の NG 時間帯と重なる" : undefined}
                                                                className={cn(
                                                                    "flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
                                                                    ng &&
                                                                        !on &&
                                                                        "cursor-not-allowed border-destructive/30 bg-destructive/5 text-destructive/60 line-through",
                                                                    on &&
                                                                        !conflict &&
                                                                        "border-primary bg-primary text-primary-foreground",
                                                                    on &&
                                                                        conflict &&
                                                                        "border-amber-500 bg-amber-400/80 text-amber-950",
                                                                    !on &&
                                                                        !ng &&
                                                                        "border-border bg-background hover:border-primary/50 hover:bg-accent"
                                                                )}
                                                            >
                                                                {ng && <Ban className="size-3" />}
                                                                {m.name}
                                                                <span className="opacity-60">
                                                                    ({load_.get(m.id) ?? 0})
                                                                </span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </>
            )}
        </div>
    );
}
