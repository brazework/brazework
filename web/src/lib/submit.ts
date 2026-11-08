"use client";
import { startTransition, type SubmitEvent } from "react";

// React 19 resets a <form action={fn}> after every submission, wiping what people typed
// whenever the server returns a validation error. Submitting through a transition keeps
// useActionState's pending/result behaviour without the reset.
export function submitWithoutReset(dispatch: (form: FormData) => void) {
  return (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(() => dispatch(form));
  };
}
