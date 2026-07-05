"use client";

import { memo, useMemo } from "react";
import { MessageSquare } from "lucide-react";
import { budouxify } from "@/lib/budoux";

type Participant = {
    id: string;
    name: string;
    comment: string | null;
};

type Props = {
    participants: Participant[];
};

export const ParticipantComments = memo(function ParticipantComments({ participants }: Props) {
    const participantsWithComments = useMemo(
        () => participants.filter((p) => p.comment && p.comment.trim()),
        [participants]
    );

    if (participantsWithComments.length === 0) {
        return null;
    }

    return (
        <div className="rounded-lg border bg-card p-4 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                参加者のコメント
            </h3>
            <ul className="space-y-2">
                {participantsWithComments.map((p) => (
                    <li key={p.id} className="text-sm border-l-2 border-primary/30 pl-3 py-1">
                        <span className="font-medium text-foreground" style={{ wordBreak: "keep-all", overflowWrap: "anywhere" }}>{budouxify(p.name)}</span>
                        <p className="text-muted-foreground mt-0.5" style={{ wordBreak: "keep-all", overflowWrap: "anywhere" }}>{budouxify(p.comment || "")}</p>
                    </li>
                ))}
            </ul>
        </div>
    );
});
