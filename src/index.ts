import { error } from 'itty-router';
import { OpenAPIRouter, OpenAPIRoute } from '@cloudflare/itty-router-openapi';
import { createCors } from 'itty-router';

export interface Env {
	MY_QUEUE: Queue;
}

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

		setInterval(() => {
			console.log('sending message...');
			const msg = 'data: { "info": "some info", "source": "some source" }\n\n';
			writer.write(encoder.encode(msg));
		}, 5000);

		const headers = {
			'Content-Type': 'text/event-stream',
			Connection: 'keep-alive',
			'Cache-Control': 'no-cache, no-transform',
		};
		return new Response(readable, { headers });
	}
}

/*
const eventEmitter = new EventEmitter({ captureRejections: true });

const createPubSub = <TTopicPayload extends { [key: string]: unknown }>() => {
	return {
		publish: <TTopic extends Extract<keyof TTopicPayload, string>>(
			topic: TTopic,
			payload: TTopicPayload[TTopic]
		) => {
			console.log(`emitting topic '${topic}' with payload '${JSON.stringify(payload)}'`)
			const hasSubscribers = eventEmitter.emit(topic as string, payload)
			console.log(`emitted topic '${topic}' with payload '${JSON.stringify(payload)}' hasSubscribers: ${hasSubscribers}`)
		},
		subscribe: async function* <TTopic extends Extract<keyof TTopicPayload, string>>(
			topic: TTopic
		): AsyncIterableIterator<TTopicPayload[TTopic]> {
			console.log(`getting async iterator for topic '${topic}'`)
			const asyncIterator = on(eventEmitter, topic)
			console.log(`awaiting '${topic}'...`)
			for await (const [value] of asyncIterator) {
				console.log(`received ${topic} with payload ${JSON.stringify(value)}`);
				yield value
			}
		}
	}
}
const pubsub = createPubSub();
*/

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
		for (let message of batch.messages) {
			console.log(`publishing message ${message.id} processed: ${JSON.stringify(message.body)}`);
			//await pubsub.publish('item-added', message.body);
		}
	},
};
