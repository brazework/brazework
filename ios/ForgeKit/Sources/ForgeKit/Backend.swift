import Foundation
import Supabase

// Where the app connects (Config/*.xcconfig → Info.plist). Development defaults to the local test
// stack, so nothing here writes to production unless Local.xcconfig says so.
enum Env {
  static let supabaseURL = URL(string: info("ForgeSupabaseURL") ?? "") ?? URL(string: "http://localhost:54321")!
  static let anonKey = info("ForgeSupabaseAnonKey") ?? ""
  static let webURL = URL(string: info("ForgeWebURL") ?? "") ?? URL(string: "https://forge-preview-eight.vercel.app")!

  // Environment first (swift test on the Mac: FORGE_SUPABASE_URL, …), then the app's Info.plist.
  private static func info(_ key: String) -> String? {
    let envKey = ["ForgeSupabaseURL": "FORGE_SUPABASE_URL", "ForgeSupabaseAnonKey": "FORGE_SUPABASE_ANON_KEY", "ForgeWebURL": "FORGE_WEB_URL"][key] ?? key
    if let v = ProcessInfo.processInfo.environment[envKey], !v.isEmpty { return v }
    return (Bundle.main.object(forInfoDictionaryKey: key) as? String).flatMap { $0.isEmpty ? nil : $0 }
  }

  static func web(_ path: String) -> URL { webURL.appending(path: path) }
}

// Same tables, row-level security and rules as the web app: the database decides who sees what.
let supabase = SupabaseClient(
  supabaseURL: Env.supabaseURL,
  supabaseKey: Env.anonKey,
  options: SupabaseClientOptions(db: .init(encoder: ForgeJSON.encoder, decoder: ForgeJSON.decoder))
)

// A public file in the media bucket (same URL the web app builds).
func mediaURL(_ path: String) -> URL? {
  guard !path.isEmpty else { return nil }
  let encoded = path.split(separator: "/").map { $0.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed.subtracting(["/"])) ?? String($0) }.joined(separator: "/")
  return URL(string: "\(Env.supabaseURL.absoluteString)/storage/v1/object/public/media/\(encoded)")
}

// Database errors in words a member understands.
func friendly(_ error: Error) -> String {
  if let e = error as? MediaError { return e.errorDescription ?? "" }
  if let e = error as? ExtrasError { return e.errorDescription ?? "" }
  if let e = error as? PostError { return e.errorDescription ?? "" }
  if let e = error as? ProfileError { return e.errorDescription ?? "" }
  // The database's own message where there is one (the debug text escapes apostrophes).
  let text = ((error as? PostgrestError).map { "\($0.message) \($0.code ?? "")" } ?? "") + " \(error)"
  if text.contains("posts_media") { return "Something's wrong with those attachments. Remove them and try again." }
  if text.contains("column \"media\"") || text.contains("'media' column") { return "Photos and video aren't turned on yet." }
  if text.contains("row-level security") || text.contains("42501") { return "You don't have permission to do that." }
  if text.contains("NSURLErrorDomain") || text.contains("offline") || text.contains("Could not connect") { return "Can't reach Forge. Check your connection." }
  if text.contains("already registered") || text.contains("user_already_exists") || text.contains("already exists") { return "An account with this email already exists. Log in instead." }
  if text.contains("Invalid login credentials") { return "That email and password don't match." }
  if text.contains("Email not confirmed") { return "Confirm your email first (check your inbox)." }
  if text.contains("You can't report yourself") { return "You can't report yourself." }
  if text.contains("You can't block yourself") { return "You can't block yourself." }
  if text.contains("no longer there") { return "That's no longer there." }
  if text.contains("content_reports") || text.contains("block_user") { return "Reporting isn't switched on yet. Try again soon." }
  for m in ["Join the club to start a team chat.", "Give the chat a name (up to 60 characters).", "Team chats can have up to 50 people.",
            "You can only add people to a team chat you're in.", "They need to be in the club first."] where text.contains(m) { return m }
  if text.contains("check constraint") { return "That's too long or not allowed." }
  return "Something went wrong. Try again."
}
