// Create an account: details, then a verification email.
import {
  auth, db, createUserWithEmailAndPassword, updateProfile, sendEmailVerification,
  doc, setDoc, serverTimestamp
} from "../firebase.js";
import { EMAIL_RE, ACADEMIC_RE, ageFrom, friendlyError } from "../util.js";

export function render({ view, navigate, state, refreshProfile }) {
  let type = "";
  view.innerHTML = `
    <div class="auth-wrap"><form class="auth-card rise" id="su-form" novalidate style="max-width:640px">
      <div class="stack" style="gap:6px">
        <div class="kicker">Create your account · step 1 of 3</div>
        <h1 style="font-size:28px">Join the STEM community</h1>
      </div>
      <fieldset style="border:none;margin:0;padding:0">
        <legend style="font-size:14px;font-weight:500;margin-bottom:10px">How will you use Forge?</legend>
        <div class="row">
          <button type="button" class="choice" data-type="student" aria-pressed="false"><strong>Student</strong><span class="small muted">Sign up with your university email.</span></button>
          <button type="button" class="choice" data-type="professional" aria-pressed="false"><strong>Professional</strong><span class="small muted">Working in STEM.</span></button>
        </div>
      </fieldset>
      <div class="row" style="align-items:flex-start">
        <div class="field" style="flex:1 1 220px"><label for="su-first">First name</label><input id="su-first" class="input" autocomplete="given-name"></div>
        <div class="field" style="flex:1 1 220px"><label for="su-last">Last name</label><input id="su-last" class="input" autocomplete="family-name"></div>
      </div>
      <div class="field"><label for="su-bday">Birthday</label><input id="su-bday" class="input" type="date" autocomplete="bday"></div>
      <div class="field"><label for="su-email" id="su-email-label">Email</label><input id="su-email" class="input" type="email" autocomplete="email"><span class="small faint" id="su-email-help"></span></div>
      <div class="field"><label for="su-pass">Password</label><input id="su-pass" class="input" type="password" autocomplete="new-password" minlength="8"><span class="small faint">At least 8 characters.</span></div>
      <div id="su-msg" role="alert"></div>
      <button class="btn primary" type="submit" id="su-submit">Create account</button>
      <p class="small muted">Forge is for people 18 and older. Already have an account? <a href="#/login">Log in</a></p>
    </form></div>`;

  const $ = s => view.querySelector(s);
  const msg = $("#su-msg");
  view.querySelectorAll(".choice").forEach(b => b.onclick = () => {
    type = b.dataset.type;
    view.querySelectorAll(".choice").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    $("#su-email-label").textContent = type === "student" ? "University email" : "Email";
    $("#su-email-help").textContent = type === "student" ? "Must be the address your school gave you (for example, ending in .edu)." : "We'll send a link to confirm it.";
  });

  $("#su-form").onsubmit = async (e) => {
    e.preventDefault();
    const fail = t => { msg.className = "error"; msg.textContent = t; };
    const first = $("#su-first").value.trim(), last = $("#su-last").value.trim();
    const bday = $("#su-bday").value, email = $("#su-email").value.trim(), pass = $("#su-pass").value;
    if (!type) return fail("Choose student or professional.");
    if (!first || !last) return fail("Enter your first and last name.");
    const age = ageFrom(bday);
    if (age < 0) return fail("Enter your birthday.");
    if (age < 18) return fail("You must be at least 18 to create an account.");
    if (!EMAIL_RE.test(email)) return fail("Enter a valid email address.");
    if (type === "student" && !ACADEMIC_RE.test(email)) return fail("Use your university email (for example, ending in .edu or .ac.uk).");
    if (pass.length < 8) return fail("Choose a password with at least 8 characters.");

    const btn = $("#su-submit");
    btn.disabled = true; btn.textContent = "Creating your account…"; msg.textContent = "";
    state.hold = true;
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(cred.user, { displayName: `${first} ${last}` });
      await setDoc(doc(db, "users", cred.user.uid), {
        firstName: first, lastName: last, birthday: bday, accountType: type, email,
        headline: "", bio: "", field: "", interests: [], onboarded: false, createdAt: serverTimestamp()
      });
      await sendEmailVerification(cred.user);
      state.user = cred.user;
      await refreshProfile();
      state.hold = false;
      navigate("verify");
    } catch (err) {
      state.hold = false;
      btn.disabled = false; btn.textContent = "Create account";
      fail(friendlyError(err));
    }
  };
}
