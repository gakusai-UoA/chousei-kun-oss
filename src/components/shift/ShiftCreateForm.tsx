"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, CalendarClock } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { parseDateInput, formatIsoDate } from "@/lib/officeHour";
import { formatMinutes, parseHm } from "@/lib/shift";

export type ShiftEditData = {
    id: string;
    title: string;
    description: string | null;
    startDate: number;
    endDate: number;
    dayStartMin: number;
    dayEndMin: number;
    submissionDeadline: number | null;
};

export function ShiftCreateForm({ editData }: { editData?: ShiftEditData } = {}) {
    const isEdit = !!editData;
    const router = useRouter();
    const { userId } = useUser();

    const [title, setTitle] = React.useState(editData?.title ?? "");
    const [description, setDescription] = React.useState(editData?.description ?? "");
    const [startStr, setStartStr] = React.useState(editData ? formatIsoDate(editData.startDate) : "");
    const [endStr, setEndStr] = React.useState(editData ? formatIsoDate(editData.endDate) : "");
    const [dayStartMin, setDayStartMin] = React.useState(editData?.dayStartMin ?? 9 * 60);
    const [dayEndMin, setDayEndMin] = React.useState(editData?.dayEndMin ?? 18 * 60);
    const [adminPassword, setAdminPassword] = React.useState("");

    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const setDayStart = (v: string) => {
        const m = parseHm(v);
        if (m !== null) setDayStartMin(m);
    };
    const setDayEnd = (v: string) => {
        const m = parseHm(v);
        if (m !== null) setDayEndMin(m);
    };

    const handleSubmit = async () => {
        setError(null);
        const trimmedTitle = title.trim();
        if (!trimmedTitle) return setError("タイトルを入力してください。");
        const startDate = parseDateInput(startStr);
        const endDate = parseDateInput(endStr);
        if (startDate === null || endDate === null) return setError("対象期間（開始日・終了日）を設定してください。");
        if (endDate < startDate) return setError("終了日は開始日以降にしてください。");
        if (dayEndMin <= dayStartMin) return setError("収集時間帯の終了は開始より後にしてください。");
        if (!isEdit && adminPassword.length < 8)
            return setError("管理パスワードは 8 文字以上で設定してください。");

        const common = { title: trimmedTitle, description, startDate, endDate, dayStartMin, dayEndMin };

        setSubmitting(true);
        try {
            if (isEdit) {
                const res = await fetch(`/api/shifts/${editData!.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(common),
                });
                if (!res.ok) {
                    const data = (await res.json().catch(() => ({}))) as { error?: string };
                    throw new Error(data.error ?? "更新に失敗しました。");
                }
                router.push(`/shifts/${editData!.id}/admin`);
            } else {
                const res = await fetch("/api/shifts", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...common, adminPassword, creatorUserId: userId ?? undefined }),
                });
                if (!res.ok) {
                    const data = (await res.json().catch(() => ({}))) as { error?: string };
                    throw new Error(data.error ?? "作成に失敗しました。");
                }
                const data = (await res.json()) as { id: string };
                router.push(`/shifts/${data.id}/admin`);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : "エラーが発生しました。");
            setSubmitting(false);
        }
    };

    return (
        <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-10">
            <div className="space-y-1">
                <h1 className="flex items-center gap-2 text-2xl font-bold">
                    <CalendarClock className="size-6 text-primary" />
                    {isEdit ? "シフト表を編集" : "シフト表を作成"}
                </h1>
                <p className="text-sm text-muted-foreground">
                    対象期間と「各日の収集時間帯」を決めると、メンバーはその範囲で「出られない時間帯」を申告します。
                    シフト枠（役割・時間区分）は作成後の管理画面で組み立てます。
                </p>
            </div>

            {error && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">タイトル</label>
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="例: 前日準備〜当日シフト"
                            maxLength={200}
                        />
                    </div>
                    {!isEdit && (
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">管理パスワード（8文字以上）</label>
                            <Input
                                type="password"
                                value={adminPassword}
                                onChange={(e) => setAdminPassword(e.target.value)}
                                placeholder="管理画面のログインに使用"
                                autoComplete="new-password"
                            />
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">開始日</label>
                        <Input type="date" value={startStr} onChange={(e) => setStartStr(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">終了日</label>
                        <Input type="date" value={endStr} onChange={(e) => setEndStr(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">収集時間帯（開始）</label>
                        <Input
                            type="time"
                            step={300}
                            value={formatMinutes(Math.min(dayStartMin, 1439))}
                            onChange={(e) => setDayStart(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">収集時間帯（終了）</label>
                        <Input
                            type="time"
                            step={300}
                            value={formatMinutes(Math.min(dayEndMin, 1439))}
                            onChange={(e) => setDayEnd(e.target.value)}
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium">説明（任意）</label>
                    <Textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="集合場所や持ち物など"
                        rows={2}
                        maxLength={2000}
                    />
                </div>
            </div>

            <div className="flex justify-end gap-2">
                <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
                    {submitting && <Loader2 className="size-4 animate-spin" />}
                    {isEdit ? "更新する" : "作成して枠を組む"}
                </Button>
            </div>
        </div>
    );
}
