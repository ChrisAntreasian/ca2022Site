import { error, type HttpError } from "@sveltejs/kit";
import { type taskEither as TE, type either as E, io as IO } from "fp-ts";

export type HttpErrTE<A> = TE.TaskEither<HttpError, A>
export type HttpErrE<A> = E.Either<HttpError, A>

export const throwErrIO = IO.of((e: HttpError) => { throw e });

export const e500 = (_: string) => error(500, _);
export const e403 = (_: string) => error(500, _);