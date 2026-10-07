export class GameError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export function errorResponse(err: unknown) {
  if (err instanceof GameError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  console.error(err);
  return Response.json({ error: "Something went wrong" }, { status: 500 });
}
