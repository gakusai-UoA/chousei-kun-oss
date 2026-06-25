"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMinutes, parseHm, formatDay, SNAP_MINUTES } from "@/lib/shift";
import { ShiftBandTimeline, type TimelineBlock } from "./ShiftBandTimeline";

export type DraftSlot = {
    key: string;
    id?: string;
    dayIndex: number;
    startMin: number;
    endMin: number;
    role: string;
    place: string;
    capacity: number;
};

let keyCounter = 0;
export function newDraftSlot(dayIndex: number, startMin: number, endMin: number): DraftSlot {
    keyCounter += 1;
    return { key: `slot-${keyCounter}`, dayIndex, startMin, endMin, role: "", place: "", capacity: 1 };
}

export function ShiftSlotEditor({
    days,
    dayStartMin,
    dayEndMin,
    slots,
    onChange,
}: {
    days: number[]; // 各日の JST 0:00 ms
    dayStartMin: number;
    dayEndMin: number;
    slots: DraftSlot[];
    onChange: (slots: DraftSlot[]) => void;
}) {
    const [activeDay, setActiveDay] = React.useState(0);
    const [selected, setSelected] = React.useState<string | null>(null);
    const day = Math.min(activeDay, Math.max(0, days.length - 1));

    const slotsRef = React.useRef(slots);
    slotsRef.current = slots;

    const patch = (key: string, p: Partial<DraftSlot>) =>
        onChange(slotsRef.current.map((s) => (s.key === key ? { ...s, ...p } : s)));

    const daySlots = slots.filter((s) => s.dayIndex === day);

    const blocks: TimelineBlock[] = daySlots.map((s) => ({
        key: s.key,
        startMin: s.startMin,
        endMin: s.endMin,
        label: s.role || "（役割未設定）",
        tone: "slot",
    }));

    const addSlot = () => {
        const last = daySlots[daySlots.length - 1];
        const start = last ? Math.min(dayEndMin - 30, last.endMin) : dayStartMin;
        const end = Math.min(dayEndMin, start + 60);
        const ns = newDraftSlot(day, start, end);
        onChange([...slots, ns]);
        setSelected(ns.key);
    };

    if (days.length === 0) {
        return (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                先に対象期間（開始日・終了日）を設定すると、枠を追加できます。
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {days.length > 1 && (
                <div className="flex flex-wrap gap-1">
                    {days.map((d, i) => (
                        <button
                            type="button"
                            key={d}
                            onClick={() => setActiveDay(i)}
                            className={cn(
                                "rounded-md border px-2.5 py-1 text-xs",
                                i === day
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border hover:bg-accent"
                            )}
                        >
                            {formatDay(d)}
                            <span className="ml-1 opacity-70">
                                ({slots.filter((s) => s.dayIndex === i).length})
                            </span>
                        </button>
                    ))}
                </div>
            )}

            <ShiftBandTimeline
                axisStartMin={dayStartMin}
                axisEndMin={dayEndMin}
                blocks={blocks}
                selectedKey={selected}
                onSelect={setSelected}
                onChange={(key, s, e) => patch(key, { startMin: s, endMin: e })}
            />

            <div className="space-y-2">
                {daySlots.map((s) => (
                    <div
                        key={s.key}
                        onClick={() => setSelected(s.key)}
                        className={cn(
                            "grid grid-cols-12 items-center gap-2 rounded-lg border p-2",
                            selected === s.key ? "border-primary bg-primary/5" : "border-border"
                        )}
                    >
                        <Input
                            className="col-span-6 sm:col-span-3"
                            placeholder="役割 / タスク名"
                            value={s.role}
                            onChange={(e) => patch(s.key, { role: e.target.value })}
                        />
                        <Input
                            className="col-span-6 sm:col-span-3"
                            placeholder="場所"
                            value={s.place}
                            onChange={(e) => patch(s.key, { place: e.target.value })}
                        />
                        <Input
                            className="col-span-5 sm:col-span-2"
                            type="time"
                            step={SNAP_MINUTES * 60}
                            value={formatMinutes(Math.min(s.startMin, 1439))}
                            onChange={(e) => {
                                const m = parseHm(e.target.value);
                                if (m !== null && m < s.endMin) patch(s.key, { startMin: m });
                            }}
                        />
                        <Input
                            className="col-span-5 sm:col-span-2"
                            type="time"
                            step={SNAP_MINUTES * 60}
                            value={formatMinutes(Math.min(s.endMin, 1439))}
                            onChange={(e) => {
                                const m = parseHm(e.target.value);
                                if (m !== null && m > s.startMin) patch(s.key, { endMin: m });
                            }}
                        />
                        <div className="col-span-2 flex items-center gap-1">
                            <Input
                                className="w-14"
                                type="number"
                                min={1}
                                max={1000}
                                title="定員"
                                value={s.capacity}
                                onChange={(e) =>
                                    patch(s.key, {
                                        capacity: Math.max(1, Math.min(1000, Number(e.target.value) || 1)),
                                    })
                                }
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onChange(slots.filter((x) => x.key !== s.key));
                                }}
                                aria-label="枠を削除"
                            >
                                <Trash2 className="size-4 text-destructive" />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>

            <Button type="button" variant="outline" size="sm" onClick={addSlot} className="gap-1">
                <Plus className="size-4" /> この日に枠を追加
            </Button>
        </div>
    );
}
