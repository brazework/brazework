// swift-tools-version: 6.0
// Forge's data layer: the iPhone app compiles these same sources (project.yml), and `swift test`
// runs them on the Mac, including integration tests against the local test stack.
import PackageDescription

let package = Package(
  name: "ForgeKit",
  platforms: [.iOS(.v18), .macOS(.v15)],
  products: [.library(name: "ForgeKit", targets: ["ForgeKit"])],
  dependencies: [.package(url: "https://github.com/supabase/supabase-swift", from: "2.55.0")],
  targets: [
    .target(name: "ForgeKit", dependencies: [.product(name: "Supabase", package: "supabase-swift")]),
    .testTarget(name: "ForgeKitTests", dependencies: ["ForgeKit"]),
  ]
)
