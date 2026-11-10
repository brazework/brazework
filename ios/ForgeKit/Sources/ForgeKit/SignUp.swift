import Foundation
import Supabase

// Creating an account and finishing your profile, with the web's rules (web/src/app/(auth)/actions.ts
// and web/src/app/onboarding/actions.ts): 18 or older; students use a university email; 8+ character
// passwords. The database makes the profile from the sign-up details (handle_new_user).
struct SignUpForm: Equatable, Sendable {
  var accountType = "student"
  var firstName = ""
  var lastName = ""
  var birthday = Calendar.current.date(byAdding: .year, value: -20, to: .now) ?? .now
  var email = ""
  var password = ""

  static let emailPattern = #"^[^\s@]+@[^\s@]+\.[^\s@]+$"#
  static let academicPattern = #"@([a-z0-9-]+\.)*([a-z0-9-]+\.edu(\.[a-z]{2})?|[a-z0-9-]+\.ac\.[a-z]{2})$"#

  static func age(_ birthday: Date, now: Date = .now) -> Int {
    Calendar.current.dateComponents([.year], from: birthday, to: now).year ?? 0
  }

  var problem: String? {
    let first = firstName.trimmingCharacters(in: .whitespaces), last = lastName.trimmingCharacters(in: .whitespaces)
    let mail = email.trimmingCharacters(in: .whitespaces)
    if !["student", "professional"].contains(accountType) { return "Choose student or professional." }
    if first.isEmpty || last.isEmpty { return "Enter your first and last name." }
    if first.count > 80 || last.count > 80 { return "Names can be up to 80 characters." }
    if Self.age(birthday) < 18 { return "You must be at least 18 to create an account." }
    if mail.range(of: Self.emailPattern, options: .regularExpression) == nil { return "Enter a valid email address." }
    if accountType == "student" && mail.range(of: Self.academicPattern, options: [.regularExpression, .caseInsensitive]) == nil {
      return "Use your university email (for example, ending in .edu or .ac.uk)."
    }
    if password.count < 8 { return "Choose a password with at least 8 characters." }
    return nil
  }
}

struct OnboardingForm: Equatable, Sendable {
  var headline = ""
  var field = ""
  var interests: [String] = []
  var problem: String? {
    let h = headline.trimmingCharacters(in: .whitespaces)
    if h.isEmpty { return "Add your major or profession." }
    if h.count > 200 { return "Headlines can be up to 200 characters." }
    if !Topics.fields.contains(field) { return "Pick your field." }
    if Set(interests).count < 3 || !interests.allSatisfy(Topics.topics.contains) { return "Pick at least 3 interests." }
    return nil
  }
}

enum SignUpResult: Equatable, Sendable { case signedIn, confirmEmail(String) }

extension API {
  static func signUp(_ f: SignUpForm) async throws -> SignUpResult {
    if let problem = f.problem { throw ProfileError(message: problem) }
    let email = f.email.trimmingCharacters(in: .whitespaces).lowercased()
    let day = f.birthday.formatted(.iso8601.year().month().day())
    let res = try await supabase.auth.signUp(
      email: email, password: f.password,
      data: ["firstName": .string(f.firstName.trimmingCharacters(in: .whitespaces)), "lastName": .string(f.lastName.trimmingCharacters(in: .whitespaces)),
             "birthday": .string(day), "accountType": .string(f.accountType)],
      redirectTo: Env.web("auth/callback"))
    // An address that's already taken comes back as a user with no identities.
    if res.user.identities?.isEmpty == true { throw ProfileError(message: "An account with this email already exists. Log in instead.") }
    return res.session != nil ? .signedIn : .confirmEmail(email)
  }

  static func resendConfirmation(_ email: String) async throws {
    try await supabase.auth.resend(email: email, type: .signup, emailRedirectTo: Env.web("auth/callback"))
  }

  // Always the same answer, so it can't be used to find out who has an account.
  static func requestPasswordReset(_ email: String) async throws {
    let mail = email.trimmingCharacters(in: .whitespaces)
    guard mail.range(of: SignUpForm.emailPattern, options: .regularExpression) != nil else { throw ProfileError(message: "Enter a valid email address.") }
    try? await supabase.auth.resetPasswordForEmail(mail, redirectTo: Env.web("auth/callback").appending(queryItems: [URLQueryItem(name: "next", value: "/reset")]))
  }

  static func completeOnboarding(_ f: OnboardingForm, me: UUID) async throws {
    if let problem = f.problem { throw ProfileError(message: problem) }
    struct Row: Encodable { let headline: String; let field: String; let interests: [String]; let onboarded: Bool }
    var seen = Set<String>()
    try await supabase.from("profiles").update(Row(headline: f.headline.trimmingCharacters(in: .whitespaces), field: f.field,
      interests: f.interests.filter { seen.insert($0).inserted }, onboarded: true), returning: .minimal).eq("id", value: me).execute()
  }
}
