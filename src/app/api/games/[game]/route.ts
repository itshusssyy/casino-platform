import { errorResponse } from "@/lib/errors";
import { gameHandlers } from "@/lib/games";
import { rateLimit } from "@/lib/rate-limit";
import { getCurrentUser, PAUSED_MESSAGE } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { isGameEnabled } from "@/lib/settings-shared";

// Actions that start a new round. Finishing an open round (cashout, stand…) stays allowed
// even if the admin disables the game mid-round.
const START_ACTIONS = new Set(["deal", "start", "spin", "roll", "play", "flip", "drop", "buy"]);

export async function POST(req: Request, ctx: RouteContext<"/api/games/[game]">) {
  const { game } = await ctx.params;
  const handler = gameHandlers[game];
  if (!handler) return Response.json({ error: "Unknown game" }, { status: 404 });

  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Please log in" }, { status: 401 });
  if (!rateLimit(`game:${user.id}`, 20, 1000)) return Response.json({ error: "Slow down" }, { status: 429 });

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");
    if (START_ACTIONS.has(action) && user.status === "PAUSED") return Response.json({ error: PAUSED_MESSAGE }, { status: 403 });
    const settings = await getSettings();
    if (START_ACTIONS.has(action) && !isGameEnabled(settings, game))
      return Response.json({ error: "This game is temporarily unavailable" }, { status: 403 });
    const result = await handler(user.id, action, body, settings, user.lossMode);
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
