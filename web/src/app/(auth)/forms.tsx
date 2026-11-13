"use client";
import { AnimatePresence, motion } from "motion/react";
import { Briefcase, Eye, EyeOff, GraduationCap, KeyRound, Loader2, MailCheck } from "lucide-react";
import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { Button, Field, inputCls } from "@/components/ui";
import { cn } from "@/lib/forge";
import { logIn, requestPasswordReset, resendConfirmation, signUp, updatePassword, type AuthState } from "./actions";
import { submitWithoutReset } from "@/lib/submit";

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

export function LoginForm({ next, confirmed, resetExpired }: { next?: string; confirmed?: boolean; resetExpired?: boolean }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(logIn, { message: "" });
  return (
    <form onSubmit={submitWithoutReset(action)} className="rise-in flex flex-col gap-5">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-2 text-muted">Log in to see what your field is building.</p>
      </div>
      {confirmed && <Notice tone="ok"><MailCheck className="size-4 shrink-0" /> Your email is confirmed. Log in to continue.</Notice>}
      {resetExpired && <Notice tone="danger">Open the reset link in the same browser where you asked for it, or <Link href="/forgot" className="underline">ask for a new one</Link>.</Notice>}
      <input type="hidden" name="next" value={next ?? "/feed"} />
      <Field label="Email"><input name="email" type="email" autoComplete="email" className={inputCls} required autoFocus /></Field>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <label htmlFor="login-password" className="text-sm font-medium text-text-2">Password</label>
          <Link href="/forgot" className="text-xs text-accent hover:underline">Forgot password?</Link>
        </div>
        <PasswordInput id="login-password" name="password" autoComplete="current-password" />
      </div>
      <ErrorLine message={state.message} />
      <Button type="submit" size="lg" disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" />} Log in</Button>
      <p className="text-sm text-muted">New to Brazework? <Link href="/signup" className="text-accent hover:underline">Create an account</Link></p>
    </form>
  );
}

export function SignupForm({ invite, clubName }: { invite?: string; clubName?: string } = {}) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signUp, { message: "" });
  const [type, setType] = useState<"student" | "professional" | "">("");
  const [emailValue, setEmailValue] = useState("");
  const choices = [
    { id: "student", label: "Student", hint: "Verify with your university email.", icon: GraduationCap },
    { id: "professional", label: "Professional", hint: "Working in STEM.", icon: Briefcase },
  ] as const;

  return (
    <form onSubmit={submitWithoutReset(action)} className="rise-in flex flex-col gap-5">
      <div>
        <div className="text-[11px] font-medium tracking-[0.06em] text-accent uppercase">Step 1 of 4</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Create your account</h1>
      </div>
      <input type="hidden" name="accountType" value={type} />
      {invite && <input type="hidden" name="invite" value={invite} />}
      {clubName && <p className="rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm">You&apos;re joining <strong className="font-medium">{clubName}</strong>. Create your account and you&apos;ll land in the club once you&apos;re set up.</p>}
      <fieldset className="grid grid-cols-2 gap-3">
        <legend className="mb-2 text-sm font-medium text-text-2">How will you use Brazework?</legend>
        {choices.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={type === c.id}
            onClick={() => setType(c.id)}
            className={cn("relative flex flex-col items-start gap-1 rounded-2xl border p-4 text-left transition", type === c.id ? "border-accent bg-accent/[0.07]" : "border-line hover:border-line-strong")}
          >
            <c.icon className={cn("size-5", type === c.id ? "text-accent" : "text-faint")} />
            <span className="mt-1 font-medium">{c.label}</span>
            <span className="text-xs text-muted">{c.hint}</span>
          </button>
        ))}
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name"><input name="firstName" autoComplete="given-name" maxLength={80} className={inputCls} /></Field>
        <Field label="Last name"><input name="lastName" autoComplete="family-name" maxLength={80} className={inputCls} /></Field>
      </div>
      <Field label="Birthday" hint="Private, never shown. Brazework is for people 18 and older."><input name="birthday" type="date" autoComplete="bday" className={inputCls} /></Field>
      <Field label={type === "student" ? "University email" : "Email"} hint={type === "student" ? "The address your school gave you, e.g. ending in .edu." : "We'll send a link to confirm it."}>
        <input name="email" type="email" autoComplete="email" onChange={(e) => setEmailValue(e.target.value)} className={inputCls} />
      </Field>
      <Field label="Password" hint="At least 8 characters. Longer, with a mix of letters and numbers, is stronger."><PasswordInput name="password" autoComplete="new-password" meter /></Field>
      <ErrorLine message={state.message} />
      {/university email/.test(state.message) && <p className="-mt-2 text-sm text-muted">Is your school&apos;s email not recognized? <Link id="request-school" href={`/request-school?email=${encodeURIComponent(emailValue)}`} className="text-accent hover:underline">Request your school</Link></p>}
      {!type && <p className="-mb-2 text-xs text-muted">Choose <b className="font-medium text-text-2">Student</b> or <b className="font-medium text-text-2">Professional</b> above to continue.</p>}
      <Button type="submit" size="lg" disabled={pending || !type}>{pending && <Loader2 className="size-4 animate-spin" />} {pending ? "Creating your account…" : "Create account"}</Button>
      <p className="text-sm text-muted">Already have an account? <Link href="/login" className="text-accent hover:underline">Log in</Link></p>
    </form>
  );
}

export function VerifyPanel({ email }: { email: string }) {
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="rise-in flex flex-col items-start gap-5">
      <div className="relative grid size-14 place-items-center rounded-2xl bg-accent/10">
        <span className="absolute inset-0 animate-pulse-ring rounded-2xl bg-accent/20" />
        <MailCheck className="relative size-7 text-accent" />
      </div>
      <div>
        <div className="text-[11px] font-medium tracking-[0.06em] text-accent uppercase">Step 2 of 4</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Check your inbox</h1>
        <p className="mt-2 text-muted">
          We sent a confirmation link to <span className="text-text">{email || "your email"}</span>. Open it in this browser to continue.
        </p>
      </div>
      <Button variant="outline" disabled={pending || !email} onClick={() => start(async () => setMsg((await resendConfirmation(email)).message))}>
        {pending && <Loader2 className="size-4 animate-spin" />} Resend the email
      </Button>
      {msg && <p role="status" className="text-sm text-muted">{msg}</p>}
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
