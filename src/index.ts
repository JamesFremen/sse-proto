import { error, createCors } from 'itty-router';
import { OpenAPIRouter, OpenAPIRoute } from '@cloudflare/itty-router-openapi';

export interface Env {
	MY_QUEUE: Queue;
}

const topic = 'item-added'

export class SSESubscribe extends OpenAPIRoute {
	static schema = {
		tags: ['Queues'],
		summary: 'Subscribe to server-sent events',
		parameters: {},
		responses: {
			'200': {
				description: 'Success',
				schema: {
					description: String,
				},
			},
		},
	};

	async handle(request: Request) {
		const { readable, writable } = new TransformStream();
		const writer = writable.getWriter();
		const encoder = new TextEncoder();

		// This works in the local wrangler dev environment, but not in the cloudflare worker environment
		setInterval(() => {
			console.log('sending message...');
			const msg = 'data: { "info": "some info", "source": "some source" }\n\n';
			writer.write(encoder.encode(msg));
		}, 5000);

		const headers = {
			'Access-Control-Allow-Origin': '*',
			'Content-Type': 'text/event-stream',
			Connection: 'keep-alive',
			'Cache-Control': 'no-cache, no-transform',
		};
		return new Response(readable, { headers });
	}
}

const router = OpenAPIRouter();
const { preflight, corsify } = createCors();

router
	.all('*', preflight)
	.get('/events', SSESubscribe)
	.all('*', () => error(404, 'Are you sure about that?'));

export default {
	fetch: async (request: Request, env: any, ctx: any) => {
		return router.handle(request, env, ctx).then(corsify);
	}
};
