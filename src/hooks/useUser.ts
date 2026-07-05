"use client";

import { useState, useEffect, useCallback } from "react";

const USER_ID_KEY = "chosei_user_id";

type UserInfo = {
    id: string;
    calendarToken: string;
} | null;

export function useUser() {
    const [userId, setUserId] = useState<string | null>(null);
    const [userInfo, setUserInfo] = useState<UserInfo>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const storedUserId = localStorage.getItem(USER_ID_KEY);
        if (storedUserId) {
            setUserId(storedUserId);
        } else {
            const newUserId = crypto.randomUUID();
            localStorage.setItem(USER_ID_KEY, newUserId);
            setUserId(newUserId);
        }
    }, []);

    useEffect(() => {
        if (!userId) return;

        const registerUser = async () => {
            setIsLoading(true);
            try {
                const res = await fetch("/api/users/register", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userId }),
                });
                if (res.ok) {
                    const data = await res.json() as { id: string; calendarToken: string };
                    setUserInfo(data);
                }
            } catch (error) {
                console.error("Failed to register user:", error);
            } finally {
                setIsLoading(false);
            }
        };

        registerUser();
    }, [userId]);

    const regenerateCalendarToken = useCallback(async () => {
        if (!userId) return null;

        try {
            const res = await fetch(`/api/users/${userId}/regenerate-token`, {
                method: "POST",
            });
            if (res.ok) {
                const data = await res.json() as { calendarToken: string };
                setUserInfo((prev) => prev ? { ...prev, calendarToken: data.calendarToken } : null);
                return data.calendarToken;
            }
        } catch (error) {
            console.error("Failed to regenerate token:", error);
        }
        return null;
    }, [userId]);

    const getCalendarUrl = useCallback(() => {
        if (!userInfo?.calendarToken || typeof window === "undefined") return null;
        return `${window.location.origin}/api/calendar/${userInfo.calendarToken}`;
    }, [userInfo?.calendarToken]);

    return {
        userId,
        userInfo,
        isLoading,
        regenerateCalendarToken,
        getCalendarUrl,
    };
}
