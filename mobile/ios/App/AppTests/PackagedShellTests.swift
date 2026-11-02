import XCTest
import UIKit
import WebKit

final class PackagedShellTests: XCTestCase {
    @MainActor private func webView() async throws -> WKWebView {
        func find(_ view: UIView) -> WKWebView? {
            if let web = view as? WKWebView { return web }
            for child in view.subviews { if let web = find(child) { return web } }
            return nil
        }
        for _ in 0..<150 {
            let windows = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.flatMap(\.windows)
            for window in windows {
                if let web = find(window), let ready = try? await web.evaluateJavaScript("document.getElementById('native-status')?.textContent.startsWith('Packaged content ready') === true"), ready as? Bool == true { return web }
            }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        throw NSError(domain: "GrovePackagedSmoke", code: 1, userInfo: [NSLocalizedDescriptionKey: "Internal packaged WebView did not become ready"])
    }

    @MainActor private func asyncJavaScript(_ body: String, in web: WKWebView) async throws -> Any {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Any, Error>) in
            web.callAsyncJavaScript(body, arguments: [:], in: nil, in: .page) { result in
                continuation.resume(with: result)
            }
        }
    }

    @MainActor func testPackagedBootAndAudioWithRemoteWebRequestsBlocked() async throws {
        let web = try await webView()
        let rules = "[{\"trigger\":{\"url-filter\":\"^https?://\"},\"action\":{\"type\":\"block\"}}]"
        let rule = try await WKContentRuleListStore.default().compileContentRuleList(forIdentifier: "GroveTestBlockRemote", encodedContentRuleList: rules)
        web.configuration.userContentController.add(rule!)
        defer { web.configuration.userContentController.remove(rule!) }
        web.reload()
        // Reload the packaged shell with all HTTP/HTTPS WebView requests blocked.
        try await Task.sleep(nanoseconds: 500_000_000)
        let reloaded = try await webView()
        let platform = try await reloaded.evaluateJavaScript("GrovePlatform.platform") as? String
        XCTAssertEqual(platform, "ios")
        let storage = try await reloaded.evaluateJavaScript("JSON.stringify(Object.keys(localStorage))") as? String
        XCTAssertEqual(storage, "[]", "Internal build must never persist child state")
        let hasUnsafeBoot = try await reloaded.evaluateJavaScript("typeof window.GROVE_REPOSITORY !== 'undefined' || typeof window.chkVer !== 'undefined'") as? Bool
        XCTAssertEqual(hasUnsafeBoot, false)
        let blocked = try await asyncJavaScript("try { await fetch('https://example.invalid/grove-offline-probe'); return false; } catch { return true; }", in: reloaded) as? Bool
        XCTAssertEqual(blocked, true)
        _ = try await reloaded.evaluateJavaScript("document.getElementById('native-dictionary').click(); true")
        var definition = ""
        for _ in 0..<100 {
            definition = (try await reloaded.evaluateJavaScript("document.getElementById('native-definition').textContent") as? String) ?? ""
            if definition.contains("学校") { break }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        XCTAssertTrue(definition.contains("学校"), definition)
        let strokeCount = try await reloaded.evaluateJavaScript("document.querySelectorAll('#native-strokes svg path').length") as? Int
        XCTAssertGreaterThan(strokeCount ?? 0, 0)
        let played = try await asyncJavaScript("const audio=new Audio('audio/msu-fu3-mv3-dda17bab9e51.mp3'); return await new Promise(resolve=>{const timer=setTimeout(()=>resolve(false),15000);audio.onended=()=>{clearTimeout(timer);resolve(true)};audio.onerror=()=>{clearTimeout(timer);resolve(false)};audio.play().catch(()=>{clearTimeout(timer);resolve(false)});});", in: reloaded) as? Bool
        XCTAssertEqual(played, true, "Exact packaged MSU recording must finish natively")
    }
}
