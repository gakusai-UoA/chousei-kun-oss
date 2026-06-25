"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMinutes, parseHm, formatDay, SNAP_MINUTES } from "@/lib/shift";
import { ShiftBandTimeline, type TimelineBlock } from "./ShiftBandTimeline";

export type DraftRange = {
    key: string;
    dayIndex: number;
    startMin: number;
    endMin: number;
};

let keyCounter = 0;
export function newDraftRange(dayIndex: number, startMin: number, endMin: number): DraftRange {
    keyCounter += 1;
    return { key: `ng-${keyCounter}`, dayIndex, startMin, endMin };
}

/** メンバーが「出られない時間帯」を複数日にわたって指定するエディタ。 */
export function ShiftNgEditor({
    days,
    dayStartMin,
    dayEndMin,
    ranges,
    onChange,
    slotsByDay = {},
}: {
    days: number[];
    dayStartMin: number;
    dayEndMin: number;
    ranges: DraftRange[];
    onChange: (ranges: DraftRange[]) => void;
    /** 参照用: 日ごとのシフト枠 [{startMin,endMin,label}]。背景に薄く表示する。 */
    slotsByDay?: Record<number, { startMin: number; endMin: number; label?: string }[]>;
}) {
    const [activeDay, setActiveDay] = React.useState(0);
    const [selected, setSelected] = React.useState<string | null>(null);
    const day = Math.min(activeDay, Math.max(0, days.length - 1));

    const ref = React.useRef(ranges);
    ref.current = ranges;
    const patch = (key: string, p: Partial<DraftRange>) =>
        onChange(ref.current.map((r) => (r.key === key ? { ...r, ...p } : r)));

    const dayRanges = ranges.filter((r) => r.dayIndex === day);
    const blocks: TimelineBlock[] = dayRanges.map((r) => ({
        key: r.key,
        startMin: r.startMin,
        endMin: r.endMin,
        tone: "ng",
    }));

    const addRange = () => {
        const mid = Math.round((dayStartMin + dayEndMin) / 2 / SNAP_MINUTES) * SNAP_MINUTES;
        const start = Math.max(dayStartMin, mid - 60);
        const end = Math.min(dayEndMin, start + 120);
        const nr = newDraftRange(day, start, end);
        onChange([...ranges, nr]);
        setSelected(nr.key);
    };

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
                                    ? "border-destructive bg-destructive text-white"
                                    : "border-border hover:bg-accent"
                            )}
                        >
                            {formatDay(d)}
                            <span className="ml-1 opacity-70">
                                ({ranges.filter((r) => r.dayIndex === i).length})
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
                backgroundBlocks={slotsByDay[day] ?? []}
            />

            <div className="space-y-2">
                {dayRanges.map((r) => (
                    <div
                        key={r.key}
                        onClick={() => setSelected(r.key)}
                        className={cn(
                            "flex items-center gap-2 rounded-lg border p-2",
                            selected === r.key ? "border-destructive bg-destructive/5" : "border-border"
                        )}
                    >
                        <Ban className="size-4 shrink-0 text-destructive" />
                        <Input
                            className="w-28"
                            type="time"
                            step={SNAP_MINUTES * 60}
                            value={formatMinutes(Math.min(r.startMin, 1439))}
                            onChange={(e) => {
                                const m = parseHm(e.target.value);
                                if (m !== null && m < r.endMin) patch(r.key, { startMin: m });
                            }}
                        />
                        <span className="text-muted-foreground">–</span>
                        <Input
                            className="w-28"
                            type="time"
                            step={SNAP_MINUTES * 60}
                            value={formatMinutes(Math.min(r.endMin, 1439))}
                            onChange={(e) => {
                                const m = parseHm(e.target.value);
                                if (m !== null && m > r.startMin) patch(r.key, { endMin: m });
                            }}
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="ml-auto"
                            onClick={(e) => {
                                e.stopPropagation();
                                onChange(ranges.filter((x) => x.key !== r.key));
                            }}
                            aria-label="NGを削除"
                        >
                            <Trash2 className="size-4 text-destructive" />
                        </Button>
                    </div>
                ))}
                {dayRanges.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                        この日に出られない時間帯があれば「出られない時間帯を追加」で指定してください。
                    </p>
                )}
            </div>

            <Button type="button" variant="outline" size="sm" onClick={addRange} className="gap-1">
                <Plus className="size-4" /> 出られない時間帯を追加
            </Button>
        </div>
    );
}
