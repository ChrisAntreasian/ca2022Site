import type { HttpError } from "@sveltejs/kit";
import type { 
  taskEither as TE,
  either as E
} from "fp-ts";

export type HttpErrTE<A> = TE.TaskEither<HttpError, A>
export type HttpErrE<A> = E.Either<HttpError, A>