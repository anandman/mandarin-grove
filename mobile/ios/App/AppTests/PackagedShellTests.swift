import XCTest
import UIKit
import WebKit
@testable import App

final class PackagedShellTests: XCTestCase {
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
        let afterValue = try await asyncJavaScript("return JSON.stringify(await GroveNativeScenarios.eraseAndVerify(grovePreparedErase));", in: web)
        let after = try XCTUnwrap(afterValue as? String)
        try Data(after.utf8).write(to: evidence.appendingPathComponent("after.json"), options: .atomic)
        XCTAssertEqual(try Data(contentsOf: selectedBackup), Data(priorCode.utf8))
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
        XCTAssertTrue(["practice", "before", "after"].contains(stage))
        let web = try await webView()
        _ = try await asyncJavaScript("await GROVE_STARTED; return true;", in: web)
        _ = try await web.evaluateJavaScript(resource("native-scenarios", extension: "js"))
        _ = try await asyncJavaScript("await GroveNativeScenarios.syntheticOnly(); return true;", in: web)
        let original = try resource("original-v1", extension: "json")
        let current = try resource("grove-v1", extension: "json")
        if mode == "hold" {
            if stage == "practice" {
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
            if stage == "practice" {
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
