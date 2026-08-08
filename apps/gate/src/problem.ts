import type { FastifyReply } from 'fastify';

export const errorBase = 'https://github.com/vaibhav/oncegate/blob/main/docs/errors.md#';

export function problem(reply: FastifyReply, status: number, type: string, title: string, detail: string, extra: Record<string, unknown> = {}) {
  return reply.code(status).type('application/problem+json').send({ type: `${errorBase}${type}`, title, status, detail, ...extra });
}
