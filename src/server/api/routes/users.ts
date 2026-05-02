import { Hono } from "hono";
import { sValidator } from "@hono/standard-validator";
import { z } from "zod";
import { createDb } from "@/server/db/client";
import { createUserService } from "@/server/services";

type Bindings = {
    DB: D1Database;
};

export const usersRoutes = new Hono<{ Bindings: Bindings }>();

const userIdSchema = z.object({
    userId: z.string().uuid(),
});

const regenerateTokenSchema = z.object({
    userId: z.string().uuid(),
});

usersRoutes.post("/register", sValidator("json", userIdSchema), async (c) => {
    const db = createDb(c.env.DB);
    const userService = createUserService(db);
    const { userId } = c.req.valid("json");

    const user = await userService.getOrCreate(userId);

    return c.json({
        id: user.id,
        calendarToken: user.calendarToken,
    });
});

usersRoutes.get("/:userId", async (c) => {
    const db = createDb(c.env.DB);
    const userService = createUserService(db);
    const userId = c.req.param("userId");

    const user = await userService.findById(userId);
    if (!user) {
        return c.json({ error: "User not found" }, 404);
    }

    return c.json({
        id: user.id,
        calendarToken: user.calendarToken,
    });
});

usersRoutes.post(
    "/:userId/regenerate-token",
    async (c) => {
        const db = createDb(c.env.DB);
        const userService = createUserService(db);
        const userId = c.req.param("userId");

        const user = await userService.findById(userId);
        if (!user) {
            return c.json({ error: "User not found" }, 404);
        }

        const newToken = await userService.regenerateCalendarToken(userId);

        return c.json({
            calendarToken: newToken,
        });
    }
);
