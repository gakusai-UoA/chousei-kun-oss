import { Hono } from "hono";
import { sValidator } from "@hono/standard-validator";
import { eventsRoutes, googleRoutes, usersRoutes } from "./routes";
import { syncCalendarSchema } from "./schemas";
import { CampusSquareService } from "@/lib/campus-square";

type Bindings = {
    DB: D1Database;
};

export const apiApp = new Hono<{ Bindings: Bindings }>().basePath("/api");

apiApp.route("/events", eventsRoutes);
apiApp.route("/google", googleRoutes);
apiApp.route("/users", usersRoutes);

apiApp.post("/sync-calendar", sValidator("json", syncCalendarSchema), async (c) => {
    if (process.env.NEXT_PUBLIC_ENABLE_CAMPUS_SQUARE !== "true") {
        return c.json({ error: "Campus Square integration is disabled." }, 404);
    }

    const { uid, pass } = c.req.valid("json");
    const syncedEvents = await CampusSquareService.fetchCalendarEvents(uid, pass);
    return c.json({ events: syncedEvents });
});

apiApp.onError((error, c) => {
    console.error("[API Error]", error);
    return c.json({ error: error.message || "Internal Server Error" }, 500);
});
