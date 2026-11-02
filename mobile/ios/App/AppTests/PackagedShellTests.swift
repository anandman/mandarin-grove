import XCTest
import UIKit
import WebKit
import Capacitor
import AVFoundation
@testable import App

final class PackagedShellTests: XCTestCase {
    func testFeedbackTextBoundsPreserveEveryUtf8Byte() throws {
        let exact = String(repeating: "保", count: 21845) + "a"
        XCTAssertEqual(try GroveFilesPlugin.validateFeedbackText(exact, sharing: true), exact)
        XCTAssertThrowsError(try GroveFilesPlugin.validateFeedbackText(exact + "a", sharing: true))
        XCTAssertThrowsError(try GroveFilesPlugin.validateFeedbackText(nil, sharing: true))
        let raw = "\u{feff}\n合成\r\n" + String(repeating: "保", count: 30000)
        XCTAssertEqual(try GroveFilesPlugin.validateFeedbackText(raw, sharing: false), raw)
        XCTAssertThrowsError(try GroveFilesPlugin.validateFeedbackText(String(repeating: "x", count: 64 * 1024 * 1024 + 1), sharing: false))
    }
    @MainActor func testShareAndFilePickersHaveOneCallbackOwner() throws {
        var requests = GrovePickerRequests()
        let first = UIActivityViewController(activityItems: ["Synthetic text"], applicationActivities: nil)
        let second = UIActivityViewController(activityItems: ["Synthetic replacement"], applicationActivities: nil)
        let file = UIDocumentPickerViewController(forOpeningContentTypes: [.plainText])
        let call = try XCTUnwrap(CAPPluginCall(callbackId: "synthetic-share-owner", methodName: "shareFeedback", options: [:], success: { _, _ in }, error: { _ in }))
        try requests.begin(first, request: GrovePickerRequest(call: call, exportFile: nil))
        XCTAssertThrowsError(try requests.begin(file, request: GrovePickerRequest(call: call, exportFile: nil)))
        XCTAssertNotNil(requests.finish(first)); XCTAssertNil(requests.finish(first))
        try requests.begin(second, request: GrovePickerRequest(call: call, exportFile: nil))
        XCTAssertNil(requests.finish(first)); XCTAssertNil(requests.finish(file)); XCTAssertTrue(requests.isPending)
        XCTAssertNotNil(requests.finish(second)); XCTAssertFalse(requests.isPending)
    }
    @MainActor func testNativeFeedbackDurabilityWithMockedDelivery() async throws {
        let allowed = ["9EFE4227-7925-437A-99B7-FBD467913AE2", "F8FF1550-0D71-4718-AB66-9A037F9D720F"]
        guard allowed.contains(ProcessInfo.processInfo.environment["SIMULATOR_UDID"] ?? "") else { throw XCTSkip("Dedicated synthetic simulators only") }
        var web = try await webView()
        _ = try await asyncJavaScript("await GROVE_STARTED; return true;", in: web)
        _ = try await web.evaluateJavaScript(resource("native-feedback-scenarios", extension: "js"))
        let output = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("GroveSyntheticFeedback-" + UUID().uuidString)
        try FileManager.default.createDirectory(at: output, withIntermediateDirectories: false)
        let refused = try await asyncJavaScript("return JSON.stringify(await GroveFeedbackScenarios.refusedPendingSave());", in: web) as? String
        try XCTUnwrap(refused).write(to: output.appendingPathComponent("refused-save.json"), atomically: true, encoding: .utf8)
        let pendingValue = try await asyncJavaScript("return JSON.stringify(await GroveFeedbackScenarios.beginPending());", in: web) as? String, pending = try XCTUnwrap(pendingValue)
        try pending.write(to: output.appendingPathComponent("pending.json"), atomically: true, encoding: .utf8)
        web = try await reload(web)
        _ = try await web.evaluateJavaScript(resource("native-feedback-scenarios", extension: "js"))
        let result = try await asyncJavaScript("return JSON.stringify(await GroveFeedbackScenarios.recoverAndRetry(\(pending)));", in: web) as? String
        try XCTUnwrap(result).write(to: output.appendingPathComponent("retry.json"), atomically: true, encoding: .utf8)
    }

    @MainActor func testNativeFeedbackOrdinaryPreviewAndReadonlyHTTP() async throws {
        let allowed = ["9EFE4227-7925-437A-99B7-FBD467913AE2", "F8FF1550-0D71-4718-AB66-9A037F9D720F"]
        guard allowed.contains(ProcessInfo.processInfo.environment["SIMULATOR_UDID"] ?? "") else { throw XCTSkip("Dedicated synthetic simulators only") }
        let web = try await webView()
        _ = try await asyncJavaScript("await GROVE_STARTED; if(window.GroveNativeTest)throw Error('Ordinary package required'); return true;", in: web)
        _ = try await web.evaluateJavaScript(resource("native-feedback-scenarios", extension: "js"))
        let preview = try await asyncJavaScript("return JSON.stringify(await GroveFeedbackScenarios.previewCancel());", in: web) as? String
        XCTAssertNotNil(preview)
        let result = try await asyncJavaScript("const endpoint='https://mandarin-grove.vercel.app/api/native-feedback', http=Capacitor.Plugins.CapacitorHttp, options={url:endpoint,method:'OPTIONS',headers:{Origin:'capacitor://localhost','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'},disableRedirects:true,connectTimeout:10000,readTimeout:10000}; const preflight=await http.request(options), get=await http.request({...options,method:'GET',headers:{Origin:'capacitor://localhost'}}); const foreign=await http.request({...options,headers:{Origin:'https://foreign.invalid','Access-Control-Request-Method':'POST'}}); if(preflight.status!==204||get.status!==405||foreign.status!==403||Object.entries(preflight.headers).find(([k])=>k.toLowerCase()==='access-control-allow-origin')?.[1]!=='capacitor://localhost')throw Error('Native readonly HTTP contract failed'); return JSON.stringify({preflight,get,foreign});", in: web) as? String
        let output = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("GroveSyntheticFeedbackReadonly-" + UUID().uuidString)
        try FileManager.default.createDirectory(at: output, withIntermediateDirectories: false)
        try XCTUnwrap(preview).write(to: output.appendingPathComponent("preview.json"), atomically: true, encoding: .utf8)
        try XCTUnwrap(result).write(to: output.appendingPathComponent("readonly-http.json"), atomically: true, encoding: .utf8)
    }

    @MainActor func testNativeBundledNoticesAndExternalRouting() async throws {
        let allowed = ["9EFE4227-7925-437A-99B7-FBD467913AE2", "F8FF1550-0D71-4718-AB66-9A037F9D720F"]
        guard allowed.contains(ProcessInfo.processInfo.environment["SIMULATOR_UDID"] ?? "") else { throw XCTSkip("Dedicated synthetic simulators only") }
        let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0], controlURL = documents.appendingPathComponent("GroveSyntheticNoticesControl.json")
        guard FileManager.default.fileExists(atPath: controlURL.path) else { throw XCTSkip("Requires explicit host resume orchestrator") }
        let control = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(contentsOf: controlURL)) as? [String: String]), run = try XCTUnwrap(control["run"])
        XCTAssertNotNil(UUID(uuidString: run)); let output = documents.appendingPathComponent("GroveSyntheticNotices-" + run)
        try FileManager.default.createDirectory(at: output, withIntermediateDirectories: false)
        let web = try await webView()
        _ = try await asyncJavaScript("await GROVE_STARTED; const r=await GROVE_REPOSITORY.peekRegistry(); if(!r.list.every(p=>p.id.startsWith('synthetic-')))throw Error('Synthetic only'); document.getElementById('gov')?.remove(); await grown('device'); return true;", in: web)
        let priorValue = try await asyncJavaScript("return await backup();", in: web) as? String, prior = try XCTUnwrap(priorValue)
        try prior.write(to: output.appendingPathComponent("prior-backup.txt"), atomically: true, encoding: .utf8)
        let appURL = try await web.evaluateJavaScript("location.href") as? String
        let files = ["audio-sources/LICENSE-MSU.txt", "audio-sources/MSU-VERIFICATION.json", "vendor/SOURCE-NOTICES.md", "vendor/cc-cedict/LICENSE", "content/online-reading-notices.txt", "vendor/writing-spark/LICENSE"]
        for file in files {
            let literal = String(decoding: try JSONSerialization.data(withJSONObject: file, options: [.fragmentsAllowed]), as: UTF8.self)
            let contents = try await asyncJavaScript("const a=document.createElement('a'); a.id='synthetic-notice-link'; a.href=\(literal); a.target='_blank'; a.textContent='Synthetic notice'; document.getElementById('gov').append(a); a.click(); const end=Date.now()+10000; while(Date.now()<end){const p=document.querySelector('#grove-native-notice pre'); if(p&&!p.hidden)return p.textContent; await new Promise(r=>setTimeout(r,20));} throw Error('Native notice did not open');", in: web) as? String
            let original = try String(contentsOf: Bundle.main.bundleURL.appendingPathComponent("public/" + file), encoding: .utf8)
            XCTAssertEqual(contents, original)
            let currentURL = try await web.evaluateJavaScript("location.href") as? String; XCTAssertEqual(currentURL, appURL)
            _ = try await asyncJavaScript("document.getElementById('grove-native-notice').close(); await new Promise(r=>setTimeout(r,0)); if(!document.getElementById('gov')||document.activeElement?.id!=='synthetic-notice-link')throw Error('Parent/focus lost'); document.getElementById('synthetic-notice-link').remove(); return true;", in: web)
        }
        var backgroundSeen = false, resumed = false; let center = NotificationCenter.default
        let bg = center.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { _ in backgroundSeen = true; try? "background".write(to: output.appendingPathComponent("external-background.txt"), atomically: true, encoding: .utf8) }
        let fg = center.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { _ in if backgroundSeen { resumed = true } }
        defer { center.removeObserver(bg); center.removeObserver(fg) }
        try "ready".write(to: output.appendingPathComponent("external-ready.txt"), atomically: true, encoding: .utf8)
        _ = try await web.evaluateJavaScript("const a=document.createElement('a');a.id='synthetic-external-link';a.href='https://example.invalid/grove-native-external-proof';a.target='_blank';a.textContent='Synthetic external link';document.getElementById('gov').append(a);a.click();true;")
        for _ in 0..<600 { if resumed { break }; try await Task.sleep(nanoseconds: 100_000_000) }
        XCTAssertTrue(backgroundSeen, "External site must leave the privileged app"); XCTAssertTrue(resumed, "Host must resume the same app")
        let finalURL = try await web.evaluateJavaScript("location.href") as? String; XCTAssertEqual(finalURL, appURL)
        _ = try await web.evaluateJavaScript("document.getElementById('synthetic-external-link')?.remove();true;")
        let afterValue = try await asyncJavaScript("return await backup();", in: web) as? String, after = try XCTUnwrap(afterValue); XCTAssertEqual(after, prior)
        try after.write(to: output.appendingPathComponent("after-backup.txt"), atomically: true, encoding: .utf8)
    }

    @MainActor func testSpeechFailedStopRetainsOwnerAndBlocksReplacement() async throws {
        let plugin = GroveSpeechPlugin(), engine = SyntheticStopSpeechSynthesizer(), utterance = AVSpeechUtterance(string: "Synthetic owned speech")
        plugin.synthesizer = engine
        var oldACK = 0, stopACK = 0, stopError = 0, replacementACK = 0
        var replacementReason: String?
        let old = try XCTUnwrap(CAPPluginCall(callbackId: "synthetic-failed-stop-old", methodName: "speak", options: [:], success: { _, _ in oldACK += 1 }, error: { _ in XCTFail("Unexpected old request error") }))
        let stop = try XCTUnwrap(CAPPluginCall(callbackId: "synthetic-failed-stop", methodName: "stop", options: [:], success: { _, _ in stopACK += 1 }, error: { _ in stopError += 1 }))
        let replacement = try XCTUnwrap(CAPPluginCall(callbackId: "synthetic-failed-stop-new", methodName: "speak", options: ["id": UUID().uuidString.lowercased(), "text": "Replacement", "lang": "en-US", "voiceURI": "synthetic-voice"], success: { result, _ in replacementACK += 1; replacementReason = result?.data?["reason"] as? String }, error: { _ in XCTFail("Expected structured replacement refusal") }))
        let id = UUID().uuidString.lowercased()
        plugin.pending = GroveSpeechRequest(id: id, utterance: utterance, call: old)
        plugin.stop(stop); plugin.speak(replacement)
        try await Task.sleep(nanoseconds: 100_000_000)
        XCTAssertEqual(stopACK, 0); XCTAssertEqual(stopError, 1); XCTAssertEqual(oldACK, 0); XCTAssertEqual(replacementACK, 1); XCTAssertEqual(plugin.pending?.id, id); XCTAssertEqual(replacementReason, "error")
        engine.stopSucceeds = true
        plugin.stop(stop)
        try await Task.sleep(nanoseconds: 100_000_000)
        XCTAssertEqual(stopACK, 1); XCTAssertEqual(stopError, 1); XCTAssertEqual(oldACK, 1); XCTAssertNil(plugin.pending)
    }

    @MainActor func testLateSpeechCallbacksCannotCompleteReplacement() async throws {
        let plugin = GroveSpeechPlugin(), firstUtterance = AVSpeechUtterance(string: "First"), secondUtterance = AVSpeechUtterance(string: "Second")
        let engine = SyntheticStopSpeechSynthesizer(); engine.stopSucceeds = true; plugin.synthesizer = engine
        var firstACK = 0, secondACK = 0
        let first = try XCTUnwrap(CAPPluginCall(callbackId: "synthetic-speech-first", methodName: "speak", options: [:], success: { _, _ in firstACK += 1 }, error: { _ in XCTFail("Unexpected first error") }))
        let second = try XCTUnwrap(CAPPluginCall(callbackId: "synthetic-speech-second", methodName: "speak", options: [:], success: { _, _ in secondACK += 1 }, error: { _ in XCTFail("Unexpected second error") }))
        plugin.pending = GroveSpeechRequest(id: UUID().uuidString.lowercased(), utterance: firstUtterance, call: first)
        plugin.cancelCurrent()
        XCTAssertEqual(firstACK, 1)
        plugin.pending = GroveSpeechRequest(id: UUID().uuidString.lowercased(), utterance: secondUtterance, call: second)
        plugin.speechSynthesizer(plugin.synthesizer, didFinish: firstUtterance)
        plugin.speechSynthesizer(plugin.synthesizer, didCancel: firstUtterance)
        try await Task.sleep(nanoseconds: 100_000_000)
        XCTAssertEqual(secondACK, 0); XCTAssertTrue(plugin.pending?.utterance === secondUtterance)
        plugin.speechSynthesizer(plugin.synthesizer, didFinish: secondUtterance)
        try await Task.sleep(nanoseconds: 100_000_000)
        XCTAssertEqual(secondACK, 1); XCTAssertNil(plugin.pending)
    }

    @MainActor func testNativeSpeechCompletionAndCancellation() async throws {
        let web = try await webView()
        _ = try await asyncJavaScript("await GROVE_STARTED; return true;", in: web)
        let prior = try await asyncJavaScript("return await backup();", in: web) as? String
        let english = try await asyncJavaScript("return await GrovePlatform.speech.speak({text:'Mandarin Grove offline voice test.',lang:'en-US'});", in: web) as? [String: Any]
        XCTAssertEqual(english?["spoken"] as? Bool, true, "Actual system speech must deliver a completion callback")
        let mandarin = try await asyncJavaScript("return await GrovePlatform.speech.speak({text:'你好',lang:'zh-CN'});", in: web) as? [String: Any]
        XCTAssertEqual(mandarin?["spoken"] as? Bool, true, "Installed Mandarin voice must complete; this is no pronunciation adjudication")
        let missing = try await asyncJavaScript("return await GrovePlatform.speech.speak({text:'No fallback.',lang:'en-US',voiceURI:'grove-synthetic-missing-voice'});", in: web) as? [String: Any]
        XCTAssertEqual(missing?["spoken"] as? Bool, false); XCTAssertEqual(missing?["reason"] as? String, "unavailable")
        let cancelled = try await asyncJavaScript("const p=GrovePlatform.speech.speak({text:'This is the deliberately long synthetic cancellation sample. '.repeat(25),lang:'en-US'}); await new Promise(r=>setTimeout(r,500)); const wasPending=GrovePlatform.speech.speaking; await GrovePlatform.speech.cancel(); return {wasPending,result:await p,replacement:await GrovePlatform.speech.speak({text:'Next sample.',lang:'en-US'})};", in: web) as? [String: Any]
        XCTAssertEqual(cancelled?["wasPending"] as? Bool, true)
        let result = cancelled?["result"] as? [String: Any], replacement = cancelled?["replacement"] as? [String: Any]
        XCTAssertEqual(result?["spoken"] as? Bool, false); XCTAssertEqual(result?["reason"] as? String, "cancelled"); XCTAssertEqual(replacement?["spoken"] as? Bool, true)
        let after = try await asyncJavaScript("return await backup();", in: web) as? String
        XCTAssertEqual(after, prior, "Speech never modifies learner progress or unknown fields")
    }

    @MainActor func testNativeAudioBackgroundAndResume() async throws {
        let allowed = ["9EFE4227-7925-437A-99B7-FBD467913AE2", "F8FF1550-0D71-4718-AB66-9A037F9D720F"]
        guard allowed.contains(ProcessInfo.processInfo.environment["SIMULATOR_UDID"] ?? "") else { throw XCTSkip("Dedicated synthetic simulators only") }
        let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let controlURL = documents.appendingPathComponent("GroveSyntheticAudioControl.json")
        guard FileManager.default.fileExists(atPath: controlURL.path) else { throw XCTSkip("Requires explicit Home/resume host orchestrator") }
        let control = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(contentsOf: controlURL)) as? [String: String])
        let run = try XCTUnwrap(control["run"]); XCTAssertNotNil(UUID(uuidString: run))
        let output = documents.appendingPathComponent("GroveSyntheticAudio-" + run)
        try FileManager.default.createDirectory(at: output, withIntermediateDirectories: false)
        let web = try await webView()
        _ = try await asyncJavaScript("await GROVE_STARTED; return true;", in: web)
        let priorValue = try await asyncJavaScript("return await backup();", in: web) as? String
        let prior = try XCTUnwrap(priorValue)
        try prior.write(to: output.appendingPathComponent("prior-backup.txt"), atomically: true, encoding: .utf8)
        _ = try await web.evaluateJavaScript("window.syntheticPriorVoiceCache=savedVoicePreference; savedVoicePreference='mainland'; true;")
        for stage in ["recording", "speech"] {
            var backgroundSeen = false, resumed = false
            let center = NotificationCenter.default
            let bg = center.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { _ in backgroundSeen = true }
            let fg = center.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { _ in if backgroundSeen { resumed = true } }
            if stage == "recording" {
                _ = try await asyncJavaScript("document.getElementById('gov')?.remove(); await grown('device'); document.getElementById('voice-preview').click(); return true;", in: web)
                var playing = false
                for _ in 0..<150 { playing = (try await web.evaluateJavaScript("!!activeAudio&&!activeAudio.paused") as? Bool) == true; if playing { break }; try await Task.sleep(nanoseconds: 20_000_000) }
                XCTAssertTrue(playing)
                _ = try await web.evaluateJavaScript("activeAudio.loop=true; window.syntheticSequenceBefore=speechSequence; true;")
            } else {
                _ = try await web.evaluateJavaScript("window.syntheticSpeechBackgroundResult=null; window.syntheticSpeechBackground=GrovePlatform.speech.speak({text:'This is the synthetic background cancellation sample. '.repeat(25),lang:'en-US'}).then(result=>window.syntheticSpeechBackgroundResult=result); true;")
                var speaking = false
                for _ in 0..<150 { speaking = (try await web.evaluateJavaScript("GrovePlatform.speech.speaking") as? Bool) == true; if speaking { break }; try await Task.sleep(nanoseconds: 20_000_000) }
                XCTAssertTrue(speaking)
            }
            try "ready".write(to: output.appendingPathComponent(stage + "-ready.txt"), atomically: true, encoding: .utf8)
            // Actual OS app switch. The simulator hardware-Home helper reported
            // success without changing this iPad's foreground app.
            let opened = await withCheckedContinuation { continuation in
                UIApplication.shared.open(URL(string: UIApplication.openSettingsURLString)!, options: [:]) { continuation.resume(returning: $0) }
            }
            XCTAssertTrue(opened, "System Settings must actually open")
            for _ in 0..<600 { if resumed { break }; try await Task.sleep(nanoseconds: 100_000_000) }
            center.removeObserver(bg); center.removeObserver(fg)
            XCTAssertTrue(backgroundSeen, "Actual OS background required"); XCTAssertTrue(resumed, "Actual OS resume required")
            let stateValue = try await web.evaluateJavaScript("JSON.stringify({stage:'\(stage)',sequenceAdvanced:speechSequence>window.syntheticSequenceBefore,activeAudioCleared:activeAudio===null,completionCleared:speechFinish===null,speechPending:GrovePlatform.speech.speaking,speechResult:window.syntheticSpeechBackgroundResult||null})") as? String
            let value = try XCTUnwrap(stateValue)
            try value.write(to: output.appendingPathComponent(stage + "-after-resume.json"), atomically: true, encoding: .utf8)
            let state = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(value.utf8)) as? [String: Any])
            XCTAssertEqual(state["activeAudioCleared"] as? Bool, true); XCTAssertEqual(state["completionCleared"] as? Bool, true); XCTAssertEqual(state["speechPending"] as? Bool, false)
            if stage == "recording" { XCTAssertEqual(state["sequenceAdvanced"] as? Bool, true) }
            else { let result = state["speechResult"] as? [String: Any]; XCTAssertEqual(result?["spoken"] as? Bool, false); XCTAssertEqual(result?["reason"] as? String, "cancelled") }
        }
        _ = try await web.evaluateJavaScript("stopSpeech(); savedVoicePreference=window.syntheticPriorVoiceCache; document.getElementById('gov')?.remove(); true;")
        let after = try await asyncJavaScript("return await backup();", in: web) as? String; XCTAssertEqual(after, prior)
        try XCTUnwrap(after).write(to: output.appendingPathComponent("after-backup.txt"), atomically: true, encoding: .utf8)
    }

    @MainActor func testLatePickerCallbacksCannotConsumeNewExport() throws {
        let plugin = GroveFilesPlugin(), files = GroveExportFiles()
        let oldPicker = UIDocumentPickerViewController(forOpeningContentTypes: [.plainText], asCopy: true)
        let newPicker = UIDocumentPickerViewController(forOpeningContentTypes: [.plainText], asCopy: true)
        var firstACK = 0, secondACK = 0, errors = 0
        let first = try XCTUnwrap(CAPPluginCall(callbackId: "synthetic-first", methodName: "saveText", options: [:], success: { _, _ in firstACK += 1 }, error: { _ in errors += 1 }))
        let second = try XCTUnwrap(CAPPluginCall(callbackId: "synthetic-second", methodName: "saveText", options: [:], success: { _, _ in secondACK += 1 }, error: { _ in errors += 1 }))
        let a = try files.stage(name: "a.txt", text: "synthetic A"), b = try files.stage(name: "b.txt", text: "synthetic B")
        try plugin.requests.begin(oldPicker, request: GrovePickerRequest(call: first, exportFile: a))
        plugin.documentPickerWasCancelled(oldPicker); XCTAssertEqual(firstACK, 1)
        try plugin.requests.begin(newPicker, request: GrovePickerRequest(call: second, exportFile: b))
        plugin.documentPickerWasCancelled(oldPicker); plugin.documentPicker(oldPicker, didPickDocumentsAt: [])
        XCTAssertTrue(plugin.requests.isPending); XCTAssertTrue(FileManager.default.fileExists(atPath: b.path)); XCTAssertEqual(secondACK, 0); XCTAssertEqual(errors, 0)
        plugin.documentPickerWasCancelled(newPicker); XCTAssertEqual(secondACK, 1); XCTAssertFalse(FileManager.default.fileExists(atPath: b.path))
    }
    @MainActor func testEmptyExportResultRemovesOnlyItsOwnCopy() throws {
        let plugin = GroveFilesPlugin(), file = try GroveExportFiles().stage(name: "empty-result.txt", text: "synthetic private copy")
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.plainText], asCopy: true)
        var ACK = 0, errors = 0
        let call = try XCTUnwrap(CAPPluginCall(callbackId: "synthetic-empty", methodName: "saveText", options: [:], success: { _, _ in ACK += 1 }, error: { _ in errors += 1 }))
        try plugin.requests.begin(picker, request: GrovePickerRequest(call: call, exportFile: file))
        plugin.documentPicker(picker, didPickDocumentsAt: [])
        XCTAssertEqual(ACK, 0); XCTAssertEqual(errors, 1); XCTAssertFalse(FileManager.default.fileExists(atPath: file.path)); XCTAssertFalse(plugin.requests.isPending)
    }
    func testPrivateExportStagingOwnership() throws {
        let base = FileManager.default.temporaryDirectory.appendingPathComponent("GroveStagingTests-" + UUID().uuidString)
        let files = GroveExportFiles(root: base.appendingPathComponent("private-staging"))
        let bytes = Data("\u{feff}\n合成 backup\r\n".utf8)
        let staged = try files.stage(name: "backup.txt", text: String(decoding: bytes, as: UTF8.self))
        XCTAssertEqual(try Data(contentsOf: staged), bytes)
        let selected = base.appendingPathComponent("selected-backup.txt")
        try FileManager.default.copyItem(at: staged, to: selected)
        try files.discard(staged); try files.discard(staged)
        XCTAssertFalse(FileManager.default.fileExists(atPath: staged.path))
        let second = try files.stage(name: "backup.txt", text: "synthetic abandoned copy")
        try files.clear(); XCTAssertFalse(FileManager.default.fileExists(atPath: second.path))
        XCTAssertEqual(try Data(contentsOf: selected), bytes)
        XCTAssertThrowsError(try files.discard(selected))
        XCTAssertEqual(try Data(contentsOf: selected), bytes)
    }
    func testPrivateExportStagingRejectsUnknownAndSymlinkPaths() throws {
        let manager = FileManager.default, base = manager.temporaryDirectory.appendingPathComponent("GroveStagingGuardTests-" + UUID().uuidString)
        let files = GroveExportFiles(root: base)
        _ = try files.stage(name: "backup.txt", text: "synthetic copy")
        let unknown = base.appendingPathComponent("GroveExport-unrecognized")
        try manager.createDirectory(at: unknown, withIntermediateDirectories: true)
        XCTAssertThrowsError(try files.clear()); XCTAssertTrue(manager.fileExists(atPath: unknown.path))
        let other = manager.temporaryDirectory.appendingPathComponent("GroveStagingLinkTests-" + UUID().uuidString)
        try manager.createDirectory(at: other, withIntermediateDirectories: true)
        let selected = other.appendingPathComponent("selected-backup.txt")
        try Data("keep selected original".utf8).write(to: selected)
        let link = other.appendingPathComponent("GroveExport-" + UUID().uuidString)
        try manager.createSymbolicLink(at: link, withDestinationURL: base)
        XCTAssertThrowsError(try GroveExportFiles(root: other).clear())
        XCTAssertEqual(try Data(contentsOf: selected), Data("keep selected original".utf8))
        XCTAssertTrue(manager.fileExists(atPath: link.path))
    }
    func testSelectedBackupUTF8Bytes() throws {
        let bytes = Data([0xef, 0xbb, 0xbf, 10, 65, 13, 10])
        XCTAssertEqual(Data(try GroveFilesPlugin.decodeBackupText(bytes).utf8), bytes, "Preserve the selected file's BOM and line endings")
        XCTAssertThrowsError(try GroveFilesPlugin.decodeBackupText(Data([0xff, 0xfe, 0x61])))
    }
    @MainActor func testNativeDatabasePrivateErasure() async throws {
        let allowed = ["9EFE4227-7925-437A-99B7-FBD467913AE2", "F8FF1550-0D71-4718-AB66-9A037F9D720F"]
        guard let id = ProcessInfo.processInfo.environment["SIMULATOR_UDID"], allowed.contains(id) else {
            throw XCTSkip("Erasure test is limited to dedicated synthetic simulators")
        }
        let web = try await webView()
        _ = try await web.evaluateJavaScript(resource("native-scenarios", extension: "js"))
        let original = try resource("original-v1", extension: "json")
        let preparedValue = try await asyncJavaScript("window.grovePreparedErase=await GroveNativeScenarios.prepareErasure(\(original)); return JSON.stringify(grovePreparedErase);", in: web)
        let preparedString = try XCTUnwrap(preparedValue as? String)
        let prepared = try XCTUnwrap(try JSONSerialization.jsonObject(with: Data(preparedString.utf8)) as? [String: Any])
        let priorCode = try XCTUnwrap(prepared["priorBackup"] as? String)
        let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let evidence = documents.appendingPathComponent("GroveSyntheticErase-" + UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: evidence, withIntermediateDirectories: true)
        try Data(preparedString.utf8).write(to: evidence.appendingPathComponent("before.json"), options: .atomic)
        let selectedBackup = evidence.appendingPathComponent("preserved-backup.txt")
        try Data(priorCode.utf8).write(to: selectedBackup, options: .atomic)
        let abandoned = try GroveExportFiles().stage(name: "synthetic-abandoned.txt", text: "synthetic private temporary copy")
        let temporaryOriginals = evidence.appendingPathComponent("temporary-originals", isDirectory: true)
        try FileManager.default.createDirectory(at: temporaryOriginals, withIntermediateDirectories: true)
        let stagedDirectories = try FileManager.default.contentsOfDirectory(at: FileManager.default.temporaryDirectory, includingPropertiesForKeys: [.isSymbolicLinkKey]).filter { $0.lastPathComponent.hasPrefix("GroveExport-") }
        for directory in stagedDirectories {
            XCTAssertFalse(try directory.resourceValues(forKeys: [.isSymbolicLinkKey]).isSymbolicLink == true)
            try FileManager.default.copyItem(at: directory, to: temporaryOriginals.appendingPathComponent(directory.lastPathComponent))
        }
        let afterValue = try await asyncJavaScript("return JSON.stringify(await GroveNativeScenarios.eraseAndVerify(grovePreparedErase));", in: web)
        let after = try XCTUnwrap(afterValue as? String)
        try Data(after.utf8).write(to: evidence.appendingPathComponent("after.json"), options: .atomic)
        XCTAssertEqual(try Data(contentsOf: selectedBackup), Data(priorCode.utf8))
        XCTAssertFalse(FileManager.default.fileExists(atPath: abandoned.path))
        XCTAssertEqual(try FileManager.default.contentsOfDirectory(at: FileManager.default.temporaryDirectory, includingPropertiesForKeys: nil).filter { $0.lastPathComponent.hasPrefix("GroveExport-") }.count, 0)
        // Preserve the dedicated simulator's previous synthetic progress too.
        let restored = try await asyncJavaScript("await GROVE_REPOSITORY.importBackup(grovePreparedErase.priorBackup); PR=await GROVE_REPOSITORY.readRegistry(); GROVE_SAVED_REGISTRY=groveCopy(PR); await loadS({persist:false}); await home(); return await backup();", in: web) as? String
        XCTAssertEqual(restored, priorCode)
    }
    @MainActor private func webView(requirePersistence: Bool = true) async throws -> WKWebView {
        func find(_ view: UIView) -> WKWebView? {
            if let web = view as? WKWebView { return web }
            for child in view.subviews { if let web = find(child) { return web } }
            return nil
        }
        for _ in 0..<150 {
            let windows = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.flatMap(\.windows)
            for window in windows {
                let condition = requirePersistence ? "GrovePlatform.persistenceReady === true" : "document.getElementById('app')?.textContent.includes('newer or unsupported schema') === true"
                if let web = find(window), let ready = try? await web.evaluateJavaScript("typeof GROVE_STARTED !== 'undefined' && (\(condition))"), ready as? Bool == true { return web }
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

    @MainActor private func reload(_ web: WKWebView, requirePersistence: Bool = true) async throws -> WKWebView {
        _ = try await web.evaluateJavaScript("window.groveTestOldDocument = true; true;")
        web.reload()
        for _ in 0..<200 {
            let replaced = (try? await web.evaluateJavaScript("typeof window.groveTestOldDocument === 'undefined' && document.readyState === 'complete' && typeof GROVE_STARTED !== 'undefined'")) as? Bool
            if replaced == true {
                _ = try await asyncJavaScript("await GROVE_STARTED; return true;", in: web)
                let condition = requirePersistence ? "GrovePlatform.persistenceReady === true" : "document.getElementById('app')?.textContent.includes('newer or unsupported schema') === true"
                if (try await web.evaluateJavaScript(condition) as? Bool) == true { return web }
            }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        throw NSError(domain: "GrovePackagedSmoke", code: 2, userInfo: [NSLocalizedDescriptionKey: "Replacement document did not finish native bootstrap"])
    }

    private func resource(_ name: String, extension suffix: String) throws -> String {
        let url = try XCTUnwrap(Bundle(for: Self.self).url(forResource: name, withExtension: suffix))
        return try String(contentsOf: url, encoding: .utf8)
    }

    @MainActor func testFutureSchemaRawRecoveryAndPrivateIdentity() async throws {
        var web = try await webView()
        _ = try await asyncJavaScript("await GROVE_STARTED; return true;", in: web)
        _ = try await web.evaluateJavaScript(resource("native-scenarios", extension: "js"))
        _ = try await asyncJavaScript("await GroveNativeScenarios.syntheticOnly(); return true;", in: web)
        let original = try resource("original-v1", extension: "json")
        _ = try await asyncJavaScript("await GroveNativeScenarios.importFrozen(\(original)); PR=await GROVE_REPOSITORY.readRegistry(); GROVE_SAVED_REGISTRY=groveCopy(PR); await loadS(); await home(); return true;", in: web)
        let identityValue = try await web.evaluateJavaScript("GrovePlatform.installationId")
        let identity = try XCTUnwrap(identityValue as? String)
        let manager = FileManager.default
        let support = try manager.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: false)
        let identityFile = support.appendingPathComponent("GroveInstallation/identity")
        XCTAssertEqual(try identityFile.resourceValues(forKeys: [.isExcludedFromBackupKey]).isExcludedFromBackup, true)
        let backup = try await asyncJavaScript("return await backup();", in: web) as? String
        var injected = false, failure: Error?
        do {
            injected = true
            let before = try await asyncJavaScript("await GroveNativeTest.connection.run('UPDATE grove_meta SET schema_version=99 WHERE id=1',[],false); await GroveNativeTest.connection.close(); return JSON.stringify(await GrovePlatform.files.rawRecovery());", in: web) as? String
            web = try await reload(web, requirePersistence: false)
            let raw = try await asyncJavaScript("await GROVE_STARTED; if(GrovePlatform.persistenceReady)throw Error('Future schema must fail closed'); if(Object.keys(localStorage).length)throw Error('Browser fallback is forbidden'); return JSON.stringify(await GrovePlatform.exportRecovery());", in: web) as? String
            let beforeObject = try XCTUnwrap(try JSONSerialization.jsonObject(with: Data(try XCTUnwrap(before).utf8)) as? [String: Any])
            let rawObject = try XCTUnwrap(try JSONSerialization.jsonObject(with: Data(try XCTUnwrap(raw).utf8)) as? [String: Any])
            let originalFiles = try XCTUnwrap(beforeObject["files"] as? [[String: String]])
            let recoveredFiles = try XCTUnwrap(rawObject["files"] as? [[String: String]])
            // SQLite may remove a zero-byte WAL and regenerate SHM read marks.
            // Require byte identity for the database and every data-bearing WAL.
            for file in originalFiles where file["name"] == "mandarin_groveSQLite.db" || (file["name"] == "mandarin_groveSQLite.db-wal" && file["base64"] != "") {
                let recovered = recoveredFiles.first { $0["name"] == file["name"] }
                XCTAssertEqual(recovered?["sha256"], file["sha256"], "Unsupported database/data-bearing WAL bytes must remain unchanged")
            }
            let documents = manager.urls(for: .documentDirectory, in: .userDomainMask)[0]
            try before?.write(to: documents.appendingPathComponent("GroveSyntheticFutureBefore.json"), atomically: true, encoding: .utf8)
            try raw?.write(to: documents.appendingPathComponent("GroveSyntheticFutureRecovered.json"), atomically: true, encoding: .utf8)
        } catch { failure = error }
        if injected {
            do {
                _ = try await asyncJavaScript("if(document.documentElement.dataset.nativeInternalTests!=='true')throw Error('Internal package only'); const c=Capacitor.Plugins.CapacitorSQLite,o={database:'mandarin_grove',readonly:false}; await c.createConnection({...o,encrypted:false,mode:'no-encryption',version:1}); await c.open(o); try{const r=(await c.query({...o,statement:'SELECT schema_version FROM grove_meta WHERE id=1',values:[]})).values.find(r=>typeof r.schema_version==='number');const p=(await c.query({...o,statement:'SELECT value FROM grove_entries WHERE key=?',values:['zh_profiles']})).values.find(r=>typeof r.value==='string');if(r.schema_version!==99||!JSON.parse(p.value).list.every(p=>p.id.startsWith('synthetic-')))throw Error('Refuse unrecognized or real schema');const version=(await c.query({...o,statement:'PRAGMA table_info(grove_meta)',values:[]})).values.some(column=>column.name==='erase_pending')?3:2;await c.run({...o,statement:'UPDATE grove_meta SET schema_version=? WHERE id=1',values:[version],transaction:false});}finally{await c.closeConnection(o);} return true;", in: web)
                web = try await reload(web)
                let restored = try await asyncJavaScript("await GROVE_STARTED; return await backup();", in: web) as? String
                XCTAssertEqual(restored, backup)
                let restoredIdentity = try await web.evaluateJavaScript("GrovePlatform.installationId") as? String
                XCTAssertEqual(restoredIdentity, identity)
            } catch { if failure == nil { failure = error } }
        }
        if let failure { throw failure }
    }

    @MainActor func testHardwareDataProtection() async throws {
        #if targetEnvironment(simulator)
        throw XCTSkip("Hardware Data Protection is not emulated; physical-device verification remains required before beta readiness")
        #else
        _ = try await webView()
        let library = try FileManager.default.url(for: .libraryDirectory, in: .userDomainMask, appropriateFor: nil, create: false)
        let attributes = try FileManager.default.attributesOfItem(atPath: library.appendingPathComponent("CapacitorDatabase/mandarin_groveSQLite.db").path)
        XCTAssertEqual(attributes[.protectionKey] as? String, FileProtectionType.completeUntilFirstUserAuthentication.rawValue)
        #endif
    }

    @MainActor func testNativeStorageOfflinePracticeAndRecovery() async throws {
        let web = try await webView()
        let rules = "[{\"trigger\":{\"url-filter\":\"^https?://\"},\"action\":{\"type\":\"block\"}}]"
        let rule = try await WKContentRuleListStore.default().compileContentRuleList(forIdentifier: "GroveTestBlockRemote", encodedContentRuleList: rules)
        web.configuration.userContentController.add(rule!)
        defer { web.configuration.userContentController.remove(rule!) }
        let reloaded = try await reload(web)
        _ = try await asyncJavaScript("await GROVE_STARTED; return true;", in: reloaded)
        let platform = try await reloaded.evaluateJavaScript("GrovePlatform.platform") as? String
        XCTAssertEqual(platform, "ios")
        let storage = try await reloaded.evaluateJavaScript("JSON.stringify(Object.keys(localStorage))") as? String
        XCTAssertEqual(storage, "[]", "Native learner data must use SQLite")
        let hasUnsafeBoot = try await reloaded.evaluateJavaScript("typeof window.chkVer !== 'undefined'") as? Bool
        XCTAssertEqual(hasUnsafeBoot, false)
        let blocked = try await asyncJavaScript("try { await fetch('https://example.invalid/grove-offline-probe'); return false; } catch { return true; }", in: reloaded) as? Bool
        XCTAssertEqual(blocked, true)
        let strokes = try await asyncJavaScript("const r=await fetch('strokes/'+encodeURIComponent('子')+'.json'); return (await r.json()).strokes.length;", in: reloaded) as? Int
        XCTAssertGreaterThan(strokes ?? 0, 0)
        let played = try await asyncJavaScript("const audio=new Audio('audio/msu-fu3-mv3-dda17bab9e51.mp3'); return await new Promise(resolve=>{const timer=setTimeout(()=>resolve(false),15000);audio.onended=()=>{clearTimeout(timer);resolve(true)};audio.onerror=()=>{clearTimeout(timer);resolve(false)};audio.play().catch(()=>{clearTimeout(timer);resolve(false)});});", in: reloaded) as? Bool
        XCTAssertEqual(played, true, "Exact packaged MSU recording must finish natively")
        _ = try await reloaded.evaluateJavaScript(resource("native-scenarios", extension: "js"))
        let original = try resource("original-v1", extension: "json")
        let current = try resource("grove-v1", extension: "json")
        for fixture in [original, current] {
            let result = try await asyncJavaScript("await GroveNativeScenarios.importFrozen(\(fixture)); return true;", in: reloaded) as? Bool
            XCTAssertEqual(result, true)
        }
        let practiced = try await asyncJavaScript("return await GroveNativeScenarios.practice(\(original));", in: reloaded) as? [String: Any]
        XCTAssertEqual((practiced?["after"] as? Int), (practiced?["before"] as? Int).map { $0 + 2 })
        let full = try await asyncJavaScript("return await GroveNativeScenarios.diskFull();", in: reloaded) as? String
        XCTAssertTrue(full?.lowercased().contains("full") == true)
        let code = try XCTUnwrap(practiced?["code"] as? String)
        let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        try code.write(to: documents.appendingPathComponent("GroveSyntheticPracticeBackup.txt"), atomically: true, encoding: .utf8)
        let originalCode = "\u{feff}\n" + Data(original.utf8).base64EncodedString() + "\r\n"
        try originalCode.write(to: documents.appendingPathComponent("GroveSyntheticOriginalBackup.txt"), atomically: true, encoding: .utf8)
        // Fresh WebView/connection recovery is also checked here. OS process kill
        // recovery is a separate host-orchestrated scenario, never inferred.
        let reopened = try await reload(reloaded)
        let recovered = try await asyncJavaScript("await GROVE_STARTED; return await backup();", in: reopened) as? String
        XCTAssertEqual(recovered, code)
    }

    // The host runner writes a synthetic-only control file, waits for the
    // native marker and terminates this app with simctl. A killed test runner
    // is expected to fail; only the subsequent independent recovery test and
    // copied physical DB/WAL evidence establish the scenario's result.
    @MainActor func testNativeInterruptedTransactionRecovery() async throws {
        let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let controlURL = documents.appendingPathComponent("GroveSyntheticKillControl.json")
        guard FileManager.default.fileExists(atPath: controlURL.path) else { throw XCTSkip("Requires the explicit host OS-kill orchestrator") }
        let control = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(contentsOf: controlURL)) as? [String: String])
        let mode = try XCTUnwrap(control["mode"]), stage = try XCTUnwrap(control["stage"])
        XCTAssertTrue(["practice", "before", "after", "erase"].contains(stage))
        let web = try await webView()
        _ = try await asyncJavaScript("await GROVE_STARTED; return true;", in: web)
        _ = try await web.evaluateJavaScript(resource("native-scenarios", extension: "js"))
        _ = try await asyncJavaScript("await GroveNativeScenarios.syntheticOnly(); return true;", in: web)
        let original = try resource("original-v1", extension: "json")
        let current = try resource("grove-v1", extension: "json")
        if mode == "hold" {
            if stage == "erase" {
                let preparedValue = try await asyncJavaScript("return JSON.stringify(await GroveNativeScenarios.prepareErasure(\(original)));", in: web)
                let prepared = try XCTUnwrap(preparedValue as? String)
                try prepared.write(to: documents.appendingPathComponent("GroveSyntheticEraseKillPrepared.json"), atomically: true, encoding: .utf8)
                let value = try XCTUnwrap(try JSONSerialization.jsonObject(with: Data(prepared.utf8)) as? [String: Any])
                try XCTUnwrap(value["priorBackup"] as? String).write(to: documents.appendingPathComponent("GroveSyntheticEraseKillSelected.txt"), atomically: true, encoding: .utf8)
                _ = try await web.evaluateJavaScript("GroveNativeTest.holdNextCommit('after'); window.syntheticPausedErase=GROVE_REPOSITORY.eraseLocal(); void window.syntheticPausedErase.catch(()=>{}); true;")
                var paused = false
                for _ in 0..<150 {
                    paused = (try await web.evaluateJavaScript("GroveNativeTest.phase === 'after'") as? Bool) == true
                    if paused { break }
                    try await Task.sleep(nanoseconds: 100_000_000)
                }
                XCTAssertTrue(paused, "Actual erasure COMMIT completed before physical cleanup or acknowledgement")
                guard paused else { return }
            } else if stage == "practice" {
                let practiced = try await asyncJavaScript("return await GroveNativeScenarios.practice(\(original));", in: web) as? [String: Any]
                let code = try XCTUnwrap(practiced?["code"] as? String)
                try code.write(to: documents.appendingPathComponent("GroveSyntheticPracticeBackup.txt"), atomically: true, encoding: .utf8)
            } else {
                _ = try await asyncJavaScript("await GroveNativeScenarios.importFrozen(\(original)); return true;", in: web)
                _ = try await web.evaluateJavaScript("GroveNativeTest.holdNextCommit('\(stage)'); window.syntheticPausedImport=GROVE_REPOSITORY.importBackup(GroveNativeScenarios.encode(\(current))); void window.syntheticPausedImport.catch(()=>{}); true;")
                var paused = false
                for _ in 0..<150 {
                    paused = (try await web.evaluateJavaScript("GroveNativeTest.phase === '\(stage)'") as? Bool) == true
                    if paused { break }
                    try await Task.sleep(nanoseconds: 100_000_000)
                }
                XCTAssertTrue(paused, "Actual SQLite transaction reached its requested COMMIT boundary")
                guard paused else { return }
            }
            try "ready".write(to: documents.appendingPathComponent("GroveSyntheticReady-\(stage).txt"), atomically: true, encoding: .utf8)
            for _ in 0..<600 { try await Task.sleep(nanoseconds: 100_000_000) }
            XCTFail("Host did not perform the requested OS kill")
        } else {
            XCTAssertEqual(mode, "recover")
            if stage == "erase" {
                let prepared = try String(contentsOf: documents.appendingPathComponent("GroveSyntheticEraseKillPrepared.json"), encoding: .utf8)
                let result = try await asyncJavaScript("const p=\(prepared),s=await GroveNativeTest.database.readSnapshot(); GroveNativeScenarios.equal(s.profiles,{},'No learner exposed before erasure recovery'); const m=(await GroveNativeTest.connection.query('SELECT erase_pending FROM grove_meta WHERE id=1')).values.find(r=>typeof r.erase_pending==='number'); GroveNativeScenarios.equal(m.erase_pending,0,'Pending erasure cleared before readiness'); const r=await GroveNativeTest.database.exportRecovery(); GroveNativeScenarios.equal(r.originals,[],'Original codes erased'); GroveNativeScenarios.check(r.revisions.every(r=>!r.before),'No learner recovery revisions'); const f=await GrovePlatform.files.rawRecovery(); for(const file of f.files) for(const marker of [p.retired,p.current,p.original])GroveNativeScenarios.check(!atob(file.base64).includes(marker),'No private marker after fresh-process cleanup'); return JSON.stringify(f);", in: web) as? String
                try XCTUnwrap(result).write(to: documents.appendingPathComponent("GroveSyntheticEraseKillCleaned.json"), atomically: true, encoding: .utf8)
                let value = try XCTUnwrap(try JSONSerialization.jsonObject(with: Data(prepared.utf8)) as? [String: Any])
                let expected = try XCTUnwrap(value["priorBackup"] as? String)
                XCTAssertEqual(try String(contentsOf: documents.appendingPathComponent("GroveSyntheticEraseKillSelected.txt"), encoding: .utf8), expected, "Selected backup is unchanged")
                let literal = String(decoding: try JSONSerialization.data(withJSONObject: expected, options: [.fragmentsAllowed]), as: UTF8.self)
                let restored = try await asyncJavaScript("await GROVE_REPOSITORY.importBackup(\(literal)); PR=await GROVE_REPOSITORY.readRegistry(); GROVE_SAVED_REGISTRY=groveCopy(PR); await loadS({persist:false}); await home(); return await backup();", in: web) as? String
                XCTAssertEqual(restored, expected, "Prior synthetic progress restored exactly")
            } else if stage == "practice" {
                let expected = try String(contentsOf: documents.appendingPathComponent("GroveSyntheticPracticeBackup.txt"), encoding: .utf8)
                let code = try await asyncJavaScript("return await backup();", in: web) as? String
                XCTAssertEqual(code, expected, "Full offline round survives actual OS kill and a fresh native process")
            } else {
                let fixture = stage == "before" ? original : current
                let verified = try await asyncJavaScript("const expected=\(fixture),actual=await GroveNativeTest.database.readSnapshot(); GroveNativeScenarios.check(JSON.parse(actual.profiles['synthetic-a']).stars===JSON.parse(expected.data['synthetic-a']).stars,'Expected atomic reward state'); GroveNativeScenarios.check(actual.profiles['synthetic-b']===expected.data['synthetic-b'],'Inactive original bytes'); GroveNativeScenarios.equal(JSON.parse(actual.profiles['synthetic-a']).futureState,JSON.parse(expected.data['synthetic-a']).futureState,'Unknown fields'); return true;", in: web) as? Bool
                XCTAssertEqual(verified, true)
            }
            let recovered = try await asyncJavaScript("return JSON.stringify(await GROVE_REPOSITORY.exportRecovery());", in: web) as? String
            try XCTUnwrap(recovered).write(to: documents.appendingPathComponent("GroveSyntheticRecovered-\(stage).json"), atomically: true, encoding: .utf8)
        }
    }
}

// Native SDK failure seam: no app/runtime test API is exposed.
private final class SyntheticStopSpeechSynthesizer: AVSpeechSynthesizer {
    var stopSucceeds = false
    override func stopSpeaking(at boundary: AVSpeechBoundary) -> Bool { stopSucceeds }
}
