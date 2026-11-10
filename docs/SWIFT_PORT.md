# Porting to macOS (SwiftUI)

The web app is laid out so a native macOS version can reuse its architecture almost file for file. Everything under `src/core` has no DOM or React dependency, and design values live in one JSON file.

## Layer mapping

| Web | Swift |
| --- | --- |
| `core/models.ts` interfaces | `struct Title: Identifiable, Codable, Hashable` and friends. Field names are already camelCase. |
| `core/tmdb/raw.ts` + `mappers.ts` | `Decodable` DTOs with `CodingKeys` (snake_case), plus `extension Title { init(_ dto: TitleDTO) }` |
| `core/tmdb/client.ts` `TmdbClient` | `actor TMDBClient` with `func detail(_ type: MediaType, id: Int) async throws -> TitleDetail`. The in-flight dedupe and TTL cache map to a `[URL: Task<Data, Error>]` dictionary inside the actor. |
| `TmdbError.kind` | `enum TMDBError: Error { case auth, notFound, rateLimit, network, unknown(Int) }` |
| `core/storage.ts` `KeyValueStore` | `UserDefaults` for settings and watchlist; **Keychain** for the API key |
| `core/watchlist.ts` | `@Observable final class Watchlist` |
| `app-context.tsx` | `@Environment` values injected at the `App` scene |
| `hooks/useQuery.ts` | `.task(id:)` modifiers, which cancel automatically like the `AbortSignal` here |
| `hooks/useInfinite.ts` | `LazyVGrid` with `.onAppear` on the last item |
| React Router routes | `NavigationSplitView` sidebar (Home, Films, Series, Watchlist, Search) + `NavigationStack` with `navigationDestination(for:)` |
| Player route | separate `Window` scene or `.fullScreenCover`, with `AVPlayerView` replacing the iframe when a licensed source exists |

## Design tokens

`src/design/tokens.json` becomes a `Theme` namespace:

```swift
enum Theme {
  static let accent = Color("Accent")            // asset catalogue: dark #F2B33D, light #E09A1A
  static let cardRadius: CGFloat = 12
  static let panelRadius: CGFloat = 20
  enum Motion {
    static let `default` = Animation.spring(duration: 0.4, bounce: 0)
    static let snappy    = Animation.spring(duration: 0.28, bounce: 0)
    static let momentum  = Animation.spring(duration: 0.45, bounce: 0.18)
  }
}
```

Anime.js `spring({ duration, bounce })` uses the same perceived-duration model as SwiftUI's `.spring(duration:bounce:)`, so the values carry over unchanged.

- **Glass** (`.glass`, `.glass-dark`) maps to `.background(.regularMaterial)` / `.ultraThinMaterial`, or Liquid Glass (`.glassEffect()`) on current macOS. Drop the CSS approximation entirely.
- **Type:** use SF Pro (system font) on macOS. The display / title1 / title2 / body / caption scale maps to `.largeTitle`, `.title`, `.title2`, `.body`, `.caption`, so Dynamic Type works for free.
- **Reduced motion / transparency:** read `@Environment(\.accessibilityReduceMotion)` and `\.accessibilityReduceTransparency`, mirroring the CSS media queries.

## Player controls

Each control in `src/routes/Player.tsx` has a native counterpart:

| Web control | macOS |
| --- | --- |
| Scrubber with hover preview | custom `Slider` + `.onContinuousHover` popover |
| Subtitles / settings popovers | `Menu` or `.popover(attachmentAnchor:)` from the button |
| Episode sheet | `.inspector` panel on the trailing edge |
| Keyboard shortcuts | `.keyboardShortcut` and `.onKeyPress` |
| Fullscreen | the window's native fullscreen (`toggleFullScreen`) |
| Picture in picture | `AVPictureInPictureController` |
