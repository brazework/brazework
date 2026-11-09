import Foundation

// Decoding rows as the database sends them: snake_case keys, Postgres timestamps.
enum ForgeJSON {
  static let decoder: JSONDecoder = {
    let d = JSONDecoder()
    d.keyDecodingStrategy = .convertFromSnakeCase
    d.dateDecodingStrategy = .custom { dec in
      let s = try dec.singleValueContainer().decode(String.self)
      guard let date = parseDate(s) else { throw DecodingError.dataCorrupted(.init(codingPath: dec.codingPath, debugDescription: "Bad date \(s)")) }
      return date
    }
    return d
  }()

  static let encoder: JSONEncoder = {
    let e = JSONEncoder()
    e.keyEncodingStrategy = .convertToSnakeCase
    e.dateEncodingStrategy = .iso8601
    return e
  }()

  // Postgres sends microseconds ("2026-11-09T21:35:48.123456+00:00"); ISO8601 parsing wants at
  // most milliseconds, so trim the fraction first.
  static func parseDate(_ raw: String) -> Date? {
    var s = raw.replacingOccurrences(of: " ", with: "T")
    if let dot = s.firstIndex(of: ".") {
      let rest = s[s.index(after: dot)...]
      let digits = rest.prefix { $0.isNumber }
      let tail = rest.dropFirst(digits.count)
      s = String(s[..<dot]) + "." + String(digits.prefix(3)).padding(toLength: 3, withPad: "0", startingAt: 0) + tail
    }
    if s.hasSuffix("+00") { s += ":00" }
    let withFraction = ISO8601DateFormatter()
    withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let d = withFraction.date(from: s) { return d }
    let plain = ISO8601DateFormatter()
    plain.formatOptions = [.withInternetDateTime]
    return plain.date(from: s)
  }
}
