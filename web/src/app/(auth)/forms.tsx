"use client";
import { AnimatePresence, motion } from "motion/react";
import { Eye, EyeOff, Hammer, KeyRound, Loader2, MailCheck } from "lucide-react";
import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { Button, Field, inputCls } from "@/components/ui";
import { cn } from "@/lib/forge";
import { confirmWithCode, logIn, requestPasswordReset, resendConfirmation, signUp, updatePassword, type AuthState } from "./actions";
import { SignupSteps } from "@/components/signup-steps";
import { submitWithoutReset } from "@/lib/submit";
import { oauthMessage, type ProviderId } from "@/lib/oauth";
import { ProviderButtons } from "./provider-buttons";

function ErrorLine({ message }: { message: string }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.p role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

// How strong a new password is: 8+ characters is the rule; length and variety earn the rest.
function strength(pw: string) {
  if (pw.length < 8) return { score: pw ? 1 : 0, label: pw ? `${8 - pw.length} more character${8 - pw.length === 1 ? "" : "s"}` : "" };
  const score = 1 + (pw.length >= 12 ? 1 : 0) + (/[a-z]/.test(pw) && /[A-Z]/.test(pw) ? 1 : 0) + (/[\d\W_]/.test(pw) ? 1 : 0);
  return { score, label: ["", "Okay", "Good", "Strong", "Very strong"][score] };
}

function PasswordInput({ id, name, autoComplete, autoFocus, meter = false }: { id?: string; name: string; autoComplete: string; autoFocus?: boolean; meter?: boolean }) {
  const [show, setShow] = useState(false);
  const [value, setValue] = useState("");
  const s = strength(value);
  return (
    <div>
    <div className="relative">
      <input id={id} name={name} type={show ? "text" : "password"} autoComplete={autoComplete} autoFocus={autoFocus} value={value} onChange={(e) => setValue(e.target.value)} className={cn(inputCls, "pr-11")} />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        className="absolute inset-y-0 right-0 grid w-11 place-items-center text-faint transition hover:text-text"
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
    {meter && value && (
      <div className="mt-2 flex items-center gap-2" aria-live="polite">
        <span className="flex flex-1 gap-1" aria-hidden="true">{[1, 2, 3, 4].map((i) => <span key={i} className={cn("h-1 flex-1 rounded-full transition-colors", i <= s.score ? (value.length < 8 ? "bg-danger" : s.score >= 3 ? "bg-ok" : "bg-amber-500") : "bg-raised")} />)}</span>
        <span className={cn("w-28 text-right text-xs", value.length < 8 ? "text-danger" : "text-muted")}>{s.label}</span>
      </div>
    )}
    </div>
  );
}

function Notice({ tone, children }: { tone: "ok" | "danger"; children: React.ReactNode }) {
  return (
    <p className={cn("flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm", tone === "ok" ? "border-ok/30 bg-ok/10 text-ok" : "border-danger/30 bg-danger/10 text-danger")}>
      {children}
    </p>
  );
}

export function LoginForm({ next, confirmed, resetExpired, linkExpired, providers = [], oauth }: { next?: string; confirmed?: boolean; resetExpired?: boolean; linkExpired?: boolean; providers?: ProviderId[]; oauth?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(logIn, { message: "" });
  const [email, setEmail] = useState("");
  const [resent, setResent] = useState("");
  const [resending, resend] = useTransition();
  return (
    <form onSubmit={submitWithoutReset(action)} className="rise-in flex flex-col gap-5">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-2 text-muted">Log in to see what your field is building.</p>
      </div>
      {confirmed && <Notice tone="ok"><MailCheck className="size-4 shrink-0" /> Your email is confirmed. Log in to continue.</Notice>}
      {linkExpired && <Notice tone="danger">That link was already used or has expired. Log in below; if your email isn&apos;t confirmed yet, you can send a new link.</Notice>}
      {resetExpired && <Notice tone="danger">Open the reset link in the same browser where you asked for it, or <Link href="/forgot" className="underline">ask for a new one</Link>.</Notice>}
      {oauthMessage(oauth) && <Notice tone="danger">{oauthMessage(oauth)}</Notice>}
      <ProviderButtons providers={providers} from="login" next={next} />
      <input type="hidden" name="next" value={next ?? "/feed"} />
      <Field label="Email"><input name="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} required autoFocus /></Field>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <label htmlFor="login-password" className="text-sm font-medium text-text-2">Password</label>
          <Link href="/forgot" className="text-xs text-accent hover:underline">Forgot password?</Link>
        </div>
        <PasswordInput id="login-password" name="password" autoComplete="current-password" />
      </div>
      <ErrorLine message={state.message} />
      {/Confirm your email/.test(state.message) && (
        <div className="-mt-2 flex flex-wrap items-center gap-3 text-sm">
          <Button type="button" variant="outline" disabled={resending || !email} onClick={() => resend(async () => setResent((await resendConfirmation(email)).message))}>
            {resending && <Loader2 className="size-4 animate-spin" />} Send a new link
          </Button>
          {resent && <span role="status" className="text-muted">{resent}</span>}
        </div>
      )}
      {providers.length > 0 && /don't match/.test(state.message) && <p className="-mt-2 text-sm text-muted">Signed up with a button above? Use it again: that account has no password here unless you <Link href="/forgot" className="text-accent hover:underline">set one</Link>.</p>}
      <Button type="submit" size="lg" disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" />} Log in</Button>
      <p className="text-sm text-muted">New to Brazework? <Link href="/signup" className="text-accent hover:underline">Create an account</Link></p>
    </form>
  );
}

export function SignupForm({ invite, clubName, providers = [], oauth, build }: { invite?: string; clubName?: string; providers?: ProviderId[]; oauth?: string; build?: string } = {}) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signUp, { message: "" });
  return (
    <form onSubmit={submitWithoutReset(action)} className="rise-in flex flex-col gap-5">
      <SignupSteps at="account" />
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Create your account</h1>
        <p className="mt-2 text-muted">Free. Your work, signed by the people who saw it.</p>
      </div>
      {invite && <input type="hidden" name="invite" value={invite} />}
      {clubName && <p className="rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm">You&apos;re joining <strong className="font-medium">{clubName}</strong>. Create your account and you&apos;ll land in the club once you&apos;re set up.</p>}
      {build && (
        <p className="flex items-start gap-2.5 rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm">
          <Hammer className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
          <span><span className="text-muted">Starting with</span> <strong className="font-medium">{build}</strong><span className="block text-xs text-faint">It&apos;ll be waiting as your first build once you&apos;re in.</span></span>
        </p>
      )}
      {oauthMessage(oauth) && <Notice tone="danger">{oauthMessage(oauth)}</Notice>}
      <ProviderButtons providers={providers} from="signup" invite={invite} />
      <Field label="Email" hint="Student? Use your university email: it's how we know you're at your school.">
        <input name="email" type="email" autoComplete="email" className={inputCls} required />
      </Field>
      <Field label="Password" hint="At least 8 characters. Longer, with a mix of letters and numbers, is stronger."><PasswordInput name="password" autoComplete="new-password" meter /></Field>
      <ErrorLine message={state.message} />
      <Button type="submit" size="lg" disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" />} {pending ? "Creating your account…" : "Create account"}</Button>
      <p className="text-xs text-faint">Next: a confirmation email, then a minute about you and your work. <Link href="/privacy" className="underline hover:text-text">How we handle your data</Link></p>
      <p className="text-sm text-muted">Already have an account? <Link href="/login" className="text-accent hover:underline">Log in</Link></p>
    </form>
  );
}

export function VerifyPanel({ email }: { email: string }) {
  const [msg, setMsg] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const [checking, check] = useTransition();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    check(async () => setErr((await confirmWithCode(email, code)).message));
  };
  return (
    <div className="rise-in flex flex-col items-start gap-5">
      <SignupSteps at="account" className="w-full" />
      <div className="relative grid size-14 place-items-center rounded-2xl bg-accent/10">
        <span className="absolute inset-0 animate-pulse-ring rounded-2xl bg-accent/20" />
        <MailCheck className="relative size-7 text-accent" />
      </div>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Check your inbox</h1>
        <p className="mt-2 text-muted">
          We sent a confirmation email to <span className="text-text">{email || "your email"}</span>. Open its link, on this device or any other, and you&apos;ll carry on from there.
        </p>
      </div>
      {email && (
        <form onSubmit={submit} className="flex w-full flex-col gap-2">
          <label htmlFor="verify-code" className="text-sm font-medium text-text-2">Or enter the 6-digit code from the email</label>
          <div className="flex gap-2">
            <input
              id="verify-code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]*"
              maxLength={7}
              value={code}
              onChange={(e) => { setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6)); setErr(""); }}
              placeholder="123456"
              aria-invalid={err ? true : undefined}
              className={cn(inputCls, "font-mono text-lg tracking-[0.3em]")}
            />
            <Button type="submit" size="lg" className="h-auto" disabled={checking || code.length !== 6}>{checking && <Loader2 className="size-4 animate-spin" />} Confirm</Button>
          </div>
          {err && <p role="alert" className="text-sm text-danger">{err}</p>}
        </form>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" disabled={pending || !email} onClick={() => start(async () => setMsg((await resendConfirmation(email)).message))}>
          {pending && <Loader2 className="size-4 animate-spin" />} Send it again
        </Button>
        {msg && <p role="status" className="text-sm text-muted">{msg}</p>}
      </div>
      <p className="text-sm text-faint">Wrong address? <Link href="/signup" className="text-accent hover:underline">Start over</Link></p>
    </div>
  );
}

export function ForgotForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(requestPasswordReset, { message: "" });
  if (state.sent)
    return (
      <div className="rise-in flex flex-col items-start gap-5">
        <div className="grid size-14 place-items-center rounded-2xl bg-accent/10"><MailCheck className="size-7 text-accent" /></div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Check your inbox</h1>
          <p className="mt-2 text-muted">If an account uses that address, a reset link is on its way. Open it in this browser.</p>
        </div>
        <Link href="/login" className="text-sm text-accent hover:underline">Back to log in</Link>
      </div>
    );
  return (
    <form onSubmit={submitWithoutReset(action)} className="rise-in flex flex-col gap-5">
      <div className="grid size-14 place-items-center rounded-2xl bg-accent/10"><KeyRound className="size-7 text-accent" /></div>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Forgot your password?</h1>
        <p className="mt-2 text-muted">Enter your email and we&apos;ll send you a link to choose a new one.</p>
      </div>
      <Field label="Email"><input name="email" type="email" autoComplete="email" className={inputCls} autoFocus /></Field>
      <ErrorLine message={state.message} />
      <Button type="submit" size="lg" disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" />} Send reset link</Button>
      <p className="text-sm text-muted">Remembered it? <Link href="/login" className="text-accent hover:underline">Log in</Link></p>
    </form>
  );
}

export function ResetForm({ signedIn }: { signedIn: boolean }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(updatePassword, { message: "" });
  if (!signedIn)
    return (
      <div className="rise-in flex flex-col items-start gap-5">
        <h1 className="text-3xl font-semibold tracking-tight">This link has expired</h1>
        <p className="text-muted">Reset links work once, in the browser where you asked for them.</p>
        <Button href="/forgot">Send a new link</Button>
      </div>
    );
  return (
    <form onSubmit={submitWithoutReset(action)} className="rise-in flex flex-col gap-5">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="mt-2 text-muted">At least 8 characters. You&apos;ll stay signed in.</p>
      </div>
      <Field label="New password"><PasswordInput name="password" autoComplete="new-password" autoFocus /></Field>
      <Field label="Confirm new password"><PasswordInput name="confirm" autoComplete="new-password" /></Field>
      <ErrorLine message={state.message} />
      <Button type="submit" size="lg" disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" />} Save password</Button>
    </form>
  );
}
