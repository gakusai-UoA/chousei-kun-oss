"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatMinutes, snap, SNAP_MINUTES } from "@/lib/shift";

export type TimelineBlock = {
    key: string;
    startMin: number;
    endMin: number;
    label?: string;
    tone?: "slot" | "ng";
};

const PX_PER_MIN = 1.4;
const ROW_H = 40;

type DragMode = "move" | "start" | "end";

/**
 * 1 日分の「収集時間帯(band)」を軸にしたタイムライン。ブロックは中央ドラッグで移動、
 * 左右端ドラッグで開始/終了を調整できる。背景ブロックは参照用（操作不可）。
 */
export function ShiftBandTimeline({
    axisStartMin,
    axisEndMin,
    blocks,
    onChange,
    selectedKey,
    onSelect,
    backgroundBlocks = [],
}: {
    axisStartMin: number;
    axisEndMin: number;
    blocks: TimelineBlock[];
    onChange: (key: string, startMin: number, endMin: number) => void;
    selectedKey?: string | null;
    onSelect?: (key: string) => void;
    backgroundBlocks?: { startMin: number; endMin: number; label?: string }[];
}) {
    const blocksRef = React.useRef(blocks);
    blocksRef.current = blocks;
    const span = Math.max(1, axisEndMin - axisStartMin);
    const trackW = span * PX_PER_MIN;
    const [dragging, setDragging] = React.useState(false);

    const beginDrag = (e: React.PointerEvent, key: string, mode: DragMode) => {
        e.preventDefault();
        e.stopPropagation();
        onSelect?.(key);
        setDragging(true);
        const startX = e.clientX;
        const orig = blocksRef.current.find((b) => b.key === key);
        if (!orig) return;
        const o = { s: orig.startMin, e: orig.endMin };
        const dur = o.e - o.s;
        const onMove = (ev: PointerEvent) => {
            const d = snap((ev.clientX - startX) / PX_PER_MIN);
            let s = o.s;
            let en = o.e;
            if (mode === "move") {
                s = o.s + d;
                en = o.e + d;
                if (s < axisStartMin) {
                    s = axisStartMin;
                    en = axisStartMin + dur;
                }
                if (en > axisEndMin) {
                    en = axisEndMin;
                    s = axisEndMin - dur;
                }
            } else if (mode === "start") {
                s = Math.min(Math.max(axisStartMin, o.s + d), o.e - SNAP_MINUTES);
            } else {
                en = Math.max(Math.min(axisEndMin, o.e + d), o.s + SNAP_MINUTES);
            }
            onChange(key, s, en);
        };
        const onUp = () => {
            setDragging(false);
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
        };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
    };

    const hourTicks: number[] = [];
    for (let m = Math.ceil(axisStartMin / 60) * 60; m <= axisEndMin; m += 60) hourTicks.push(m);

    return (
        <div className="overflow-x-auto rounded-lg border bg-muted/20">
            <div style={{ width: trackW + 16 }} className="relative px-2 pb-3 pt-6">
                <div className="pointer-events-none absolute inset-x-2 top-0 h-full">
                    {hourTicks.map((m) => (
                        <div
                            key={m}
                            className="absolute top-0 h-full border-l border-border/40"
                            style={{ left: (m - axisStartMin) * PX_PER_MIN }}
                        >
                            <span className="absolute left-1 text-[10px] text-muted-foreground">
                                {formatMinutes(m)}
                            </span>
                        </div>
                    ))}
                </div>

                {backgroundBlocks.map((b, i) => (
                    <div
                        key={i}
                        className="pointer-events-none absolute bottom-2 top-5 rounded border border-primary/20 bg-primary/5"
                        style={{
                            left: (b.startMin - axisStartMin) * PX_PER_MIN,
                            width: (b.endMin - b.startMin) * PX_PER_MIN,
                        }}
                    >
                        {b.label && (
                            <span className="absolute left-1 top-0.5 text-[9px] text-primary/60">{b.label}</span>
                        )}
                    </div>
                ))}

                <div className="relative" style={{ height: Math.max(1, blocks.length) * ROW_H }}>
                    {blocks.map((b, idx) => {
                        const left = (b.startMin - axisStartMin) * PX_PER_MIN;
                        const width = (b.endMin - b.startMin) * PX_PER_MIN;
                        const sel = selectedKey === b.key;
                        const ng = b.tone === "ng";
                        return (
                            <div
                                key={b.key}
                                className="absolute"
                                style={{ top: idx * ROW_H + 4, left, width, height: ROW_H - 12 }}
                            >
                                <div
                                    onPointerDown={(e) => beginDrag(e, b.key, "move")}
                                    className={cn(
                                        "group flex h-full w-full cursor-grab touch-none select-none items-center justify-between rounded-md border px-1 text-xs shadow-sm",
                                        ng
                                            ? "border-destructive/50 bg-destructive/15"
                                            : "border-primary/50 bg-primary/15",
                                        sel && "ring-1 ring-offset-1",
                                        sel && (ng ? "ring-destructive" : "ring-primary"),
                                        dragging && sel && "cursor-grabbing"
                                    )}
                                >
                                    <span
                                        onPointerDown={(e) => beginDrag(e, b.key, "start")}
                                        className={cn(
                                            "h-full w-2 shrink-0 cursor-ew-resize rounded-l",
                                            ng ? "bg-destructive/50" : "bg-primary/50"
                                        )}
                                    />
                                    <span className="pointer-events-none flex-1 truncate px-1 text-center font-medium text-foreground">
                                        {b.label ? `${b.label} ` : ""}
                                        <span className="font-normal text-muted-foreground">
                                            {formatMinutes(b.startMin)}–{formatMinutes(b.endMin)}
                                        </span>
                                    </span>
                                    <span
                                        onPointerDown={(e) => beginDrag(e, b.key, "end")}
                                        className={cn(
                                            "h-full w-2 shrink-0 cursor-ew-resize rounded-r",
                                            ng ? "bg-destructive/50" : "bg-primary/50"
                                        )}
                                    />
                                </div>
                            </div>
                        );
                    })}
                    {blocks.length === 0 && (
                        <div className="flex h-10 items-center px-2 text-xs text-muted-foreground">
                            この日の項目はありません。
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
