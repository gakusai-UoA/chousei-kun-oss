import { CUSTOM_PERIODS } from "@/config/periods";

type ICalEventOptions = {
    title: string;
    description?: string;
    startDateTime: Date;
    endDateTime: Date;
    location?: string;
};

function formatICalDate(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return (
        date.getUTCFullYear().toString() +
        pad(date.getUTCMonth() + 1) +
        pad(date.getUTCDate()) +
        "T" +
        pad(date.getUTCHours()) +
        pad(date.getUTCMinutes()) +
        pad(date.getUTCSeconds()) +
        "Z"
    );
}

function generateUID(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}@chousei-kun`;
}

function escapeICalText(text: string): string {
    return text
        .replace(/\\/g, "\\\\")
        .replace(/;/g, "\\;")
        .replace(/,/g, "\\,")
        .replace(/\n/g, "\\n");
}

export function generateICalEvent(options: ICalEventOptions): string {
    const { title, description, startDateTime, endDateTime, location } = options;
    const now = new Date();

    const lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Chousei-kun//Schedule App//JA",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        `UID:${generateUID()}`,
        `DTSTAMP:${formatICalDate(now)}`,
        `DTSTART:${formatICalDate(startDateTime)}`,
        `DTEND:${formatICalDate(endDateTime)}`,
        `SUMMARY:${escapeICalText(title)}`,
    ];

    if (description) {
        lines.push(`DESCRIPTION:${escapeICalText(description)}`);
    }

    if (location) {
        lines.push(`LOCATION:${escapeICalText(location)}`);
    }

    lines.push("END:VEVENT", "END:VCALENDAR");

    return lines.join("\r\n");
}

export function parseCandidateToDateTime(candidate: string): { start: Date; end: Date } | null {
    const [datePart, slotRaw] = candidate.split("_");
    if (!datePart || !slotRaw) return null;

    const slotType = slotRaw.charAt(0);
    const slotId = Number.parseInt(slotRaw.slice(1), 10);
    if (Number.isNaN(slotId)) return null;

    const baseDate = new Date(datePart);
    if (Number.isNaN(baseDate.getTime())) return null;

    let startHour = 0;
    let startMinute = 0;
    let endHour = 0;
    let endMinute = 0;

    if (slotType === "P") {
        const period = CUSTOM_PERIODS.find((p) => p.id === slotId);
        if (!period) return null;
        const [startHm, endHm] = period.time.split("-");
        [startHour, startMinute] = startHm.split(":").map(Number);
        [endHour, endMinute] = endHm.split(":").map(Number);
    } else if (slotType === "H") {
        startHour = Math.max(0, Math.min(23, slotId));
        endHour = Math.min(24, startHour + 1);
        startMinute = 0;
        endMinute = 0;
    } else {
        return null;
    }

    const start = new Date(baseDate);
    start.setHours(startHour, startMinute, 0, 0);

    const end = new Date(baseDate);
    end.setHours(endHour, endMinute, 0, 0);

    return { start, end };
}

export function downloadICalFile(content: string, filename: string): void {
    const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
