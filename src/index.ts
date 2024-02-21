import { error, createCors } from 'itty-router';
import { OpenAPIRouter, OpenAPIRoute } from '@cloudflare/itty-router-openapi';
import { EventEmitter, on } from 'node:events'

export interface Env {
	MY_QUEUE: Queue;
}

const eventEmitter = new EventEmitter({ captureRejections: true });

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

		/* 
		// This works in the local wrangler dev environment, but not in the cloudflare worker environment,
		// probably because it uses setInterval.
		setInterval(() => {
			console.log('sending message...');
			const msg = 'data: { "info": "some info", "source": "some source" }\n\n';
			writer.write(encoder.encode(msg));
		}, 5000);		
		*/
		
		const asyncIterator = on(eventEmitter, topic)
		console.log(`awaiting '${topic}'...`)
		for await (const [value] of asyncIterator) {
			for (const v of value) {
				console.log(`received ${topic} with payload ${v}. Writing to encoder...`);
				writer.write(encoder.encode(v));
			}
		}

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
	},
	async queue(batch: MessageBatch<any>, env: Env): Promise<void> {
		console.log('queue received a message batch')
		for (let message of batch.messages) {
			console.log(`publishing message ${message.id} processed: ${JSON.stringify(message.body)}`);
			const msg = 'data: { "info": "some info", "source": "some source" }\n\n';
			eventEmitter.emit('item-added', msg);
		}
	},
};
