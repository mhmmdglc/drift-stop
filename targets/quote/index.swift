import SwiftUI
import WidgetKit

// App Group, uygulama ile bu eklenti arasındaki tek veri yolu. Kimlik
// app.json'daki ios.entitlements ile birebir aynı olmak zorunda; eşleşmezse
// UserDefaults sessizce nil döner ve widget yedek söze düşer.
let APP_GROUP = "group.com.driftstop.app"

struct QuoteEntry: TimelineEntry {
  let date: Date
  let text: String
  let author: String
  let id: Int
}

// Uygulama hiç açılmadıysa (widget önce eklenebilir) gösterilecek yedek.
let fallbackEntry = QuoteEntry(
  date: Date(),
  text: "Sürüklenmeyi bırak. İşine dön.",
  author: "DriftStop",
  id: 0
)

func readQuote() -> QuoteEntry {
  guard let defaults = UserDefaults(suiteName: APP_GROUP),
        let raw = defaults.string(forKey: "lastQuote"),
        let data = raw.data(using: .utf8),
        let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
        let text = obj["text"] as? String,
        !text.isEmpty
  else { return fallbackEntry }

  return QuoteEntry(
    date: Date(),
    text: text,
    author: (obj["author"] as? String) ?? "",
    id: (obj["id"] as? Int) ?? 0
  )
}

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> QuoteEntry { fallbackEntry }

  func getSnapshot(in context: Context, completion: @escaping (QuoteEntry) -> Void) {
    completion(readQuote())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<QuoteEntry>) -> Void) {
    // Tek girişli zaman çizelgesi. Sözü uygulama değiştiriyor ve değiştirdiğinde
    // reloadAllTimelines çağırıyor; burada zamana bağlı bir dönüş yok, bu yüzden
    // .never — boşuna uyanıp pil harcamasın.
    completion(Timeline(entries: [readQuote()], policy: .never))
  }
}

/// Kilit ekranı (accessoryRectangular): tek renk, iki-üç kısa satır.
/// Yazar burada bilerek yok — yer sözün kendisine ayrıldı.
struct LockScreenView: View {
  let entry: QuoteEntry

  var body: some View {
    VStack(alignment: .leading, spacing: 1) {
      // accessoryRectangular ~72x160pt; uzun sözler kaçınılmaz olarak kesiliyor.
      // Sıkıştırma + ölçek küçültme ile satır başına belirgin şekilde daha çok
      // karakter sığıyor, kesilme noktası da o kadar geç geliyor.
      Text(entry.text)
        .font(.system(size: 12, weight: .medium, design: .serif))
        .lineLimit(3)
        .minimumScaleFactor(0.65)
        .allowsTightening(true)
        .lineSpacing(-1)
        .multilineTextAlignment(.leading)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .widgetAccentable()
  }
}

/// Ana ekran (systemSmall / systemMedium): Android widget'ının karşılığı.
struct HomeScreenView: View {
  let entry: QuoteEntry
  @Environment(\.widgetFamily) var family

  private var limit: Int { family == .systemSmall ? 5 : 4 }

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text("DriftStop")
        .font(.system(size: 11, weight: .semibold))
        .foregroundColor(Color("$accent"))
      Text(entry.text)
        .font(.system(size: family == .systemSmall ? 14 : 16, design: .serif))
        .lineLimit(limit)
        .minimumScaleFactor(0.7)
      if !entry.author.isEmpty {
        Text("— \(entry.author)")
          .font(.system(size: 11))
          .foregroundColor(Color("$accent"))
          .lineLimit(1)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
  }
}

struct DriftStopQuoteEntryView: View {
  var entry: QuoteEntry
  @Environment(\.widgetFamily) var family

  var body: some View {
    Group {
      switch family {
      case .accessoryRectangular:
        LockScreenView(entry: entry)
      case .accessoryInline:
        Text(entry.text).lineLimit(1)
      default:
        HomeScreenView(entry: entry)
      }
    }
    .widgetURL(URL(string: "driftstop://quote/\(entry.id)"))
  }
}

@main
struct DriftStopQuote: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "DriftStopQuote", provider: Provider()) { entry in
      if #available(iOS 17.0, *) {
        DriftStopQuoteEntryView(entry: entry)
          .containerBackground(Color("$widgetBackground"), for: .widget)
      } else {
        DriftStopQuoteEntryView(entry: entry)
          .padding()
          .background(Color("$widgetBackground"))
      }
    }
    .configurationDisplayName("DriftStop")
    .description("Son gelen söz.")
    .supportedFamilies([
      .accessoryRectangular,
      .accessoryInline,
      .systemSmall,
      .systemMedium,
    ])
  }
}
