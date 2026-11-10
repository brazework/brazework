import Foundation

// Fields and topics, the same list as web/src/lib/forge.ts (TOPICS). Profiles pick one field and
// at least 3 interests from these.
enum Topics {
  static let all: [(field: String, topics: [String])] = [
    ("Engineering", ["Mechanical Design", "Electrical & Power Systems", "Civil & Structural", "Aerospace", "Embedded Systems", "Manufacturing & 3D Printing", "Biomedical Devices", "Materials Engineering"]),
    ("Computer Science", ["Software Engineering", "Cybersecurity", "Distributed Systems", "Programming Languages", "Human-Computer Interaction", "Theory of Computation"]),
    ("Data & AI", ["Machine Learning", "Large Language Models", "Computer Vision", "Robotics & Autonomy", "Data Engineering", "AI Safety"]),
    ("Mathematics", ["Algebra", "Topology", "Number Theory", "Probability & Statistics", "Optimization", "Mathematical Logic"]),
    ("Physics", ["Quantum Computing", "Condensed Matter", "Particle Physics", "Optics & Photonics", "Fluid Dynamics", "Plasma Physics"]),
    ("Chemistry", ["Organic Chemistry", "Materials Chemistry", "Batteries & Electrochemistry", "Catalysis", "Polymers", "Analytical Chemistry"]),
    ("Biology & Life Sciences", ["Genomics", "Synthetic Biology", "Neuroscience", "Ecology", "Microbiology", "Bioinformatics"]),
    ("Earth & Environment", ["Climate Science", "Renewable Energy", "Geology", "Oceanography", "Hydrology", "Sustainability"]),
    ("Health & Medicine", ["Medical Imaging", "Epidemiology", "Pharmacology", "Public Health", "Biomechanics", "Health Tech"]),
    ("Space Science", ["Astrophysics", "Planetary Science", "Space Systems", "Cosmology"]),
  ]
  static let fields = all.map(\.field)
  static let topics = Set(all.flatMap(\.topics))
}

// What you can change on your profile here (as Settings → Profile on the web, plus your bio).
struct ProfileEdit: Equatable, Sendable {
  var firstName: String
  var lastName: String
  var headline: String
  var bio: String
  var field: String
  var interests: [String]

  init(_ p: Profile) {
    firstName = p.firstName; lastName = p.lastName; headline = p.headline; bio = p.bio; field = p.field
    interests = p.interests.filter { Topics.topics.contains($0) }
  }

  // The web's rules (web/src/lib/settings.ts), so both apps accept the same profiles.
  var problem: String? {
    let first = firstName.trimmingCharacters(in: .whitespaces), last = lastName.trimmingCharacters(in: .whitespaces)
    if first.isEmpty { return "Enter your first name." }
    if last.isEmpty { return "Enter your last name." }
    if first.count > 80 || last.count > 80 { return "Names can be up to 80 characters." }
    if headline.count > 200 { return "Headlines can be up to 200 characters." }
    if bio.count > 2000 { return "Your bio can be up to 2,000 characters." }
    if !Topics.fields.contains(field) { return "Pick your field." }
    if !interests.allSatisfy(Topics.topics.contains) { return "Pick topics from the list." }
    if Set(interests).count < 3 { return "Keep at least 3 interests." }
    return nil
  }
}

struct ProfileError: LocalizedError {
  let message: String
  var errorDescription: String? { message }
}
