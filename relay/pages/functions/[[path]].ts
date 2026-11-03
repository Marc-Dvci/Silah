// Every path goes to the relay Worker unchanged: CORS, limits and storage all live there.
interface Env { RELAY: { fetch(req: Request): Promise<Response> } }

export const onRequest = ({ request, env }: { request: Request; env: Env }): Promise<Response> => env.RELAY.fetch(request);
