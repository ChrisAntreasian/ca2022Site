import { error, type HttpError } from "@sveltejs/kit";
import { Effect, Result } from "effect";

export type HttpErrTE<A> = Effect.Effect<A, HttpError>;
export type HttpErrE<A> = Result.Result<A, HttpError>;

export const throwErrIO = (e: HttpError) => {
  throw e;
};

export const e500 = (msg: string) => error(500, msg);
export const e403 = (msg: string) => error(403, msg);
