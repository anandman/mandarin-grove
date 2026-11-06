import XCTest
import UIKit

final class NativeBackupUITests: XCTestCase {
    @MainActor func testNativeKeyboardRotationKeepsInputAndSettingsTouchable() throws {
        guard ["9EFE4227-7925-437A-99B7-FBD467913AE2", "BC062C51-505F-4C31-967F-28FED4039C62"].contains(ProcessInfo.processInfo.environment["SIMULATOR_UDID"] ?? "") else {
            throw XCTSkip("Owned synthetic iPad/iPhone required")
        }
        continueAfterFailure = false
        let app = XCUIApplication(bundleIdentifier: "design.highgain.mandaringrove")
        let device = XCUIDevice.shared, original = device.orientation
        defer { device.orientation = original == .unknown ? .portrait : original }
        device.orientation = .portrait
        app.launch()
        guard requireGroveContent(app, context: "before native keyboard and recovery") else { return }

        // Only an unsaved form is edited. A recovered fixture may use Add kid;
        // no existing learner is replaced and Let's go is never pressed.
        let name = app.webViews.textFields["Kid's name"]
        if !name.waitForExistence(timeout: 2) {
            XCTAssertTrue(app.webViews.buttons["🐼 合成 Learner A 2nd, Grade 2"].exists)
            app.webViews.buttons["＋ Add kid"].tap()
        }
        XCTAssertTrue(name.waitForExistence(timeout: 10))
        name.tap(); name.typeText("Grove_UI_QA")
        let keyboard = app.keyboards.firstMatch
        XCTAssertTrue(keyboard.waitForExistence(timeout: 5))
        XCTAssertGreaterThan(keyboard.frame.height, 200, "Require the real software keyboard")
        let next = app.webViews.buttons["Next: Grade"]
        XCTAssertTrue(next.waitForExistence(timeout: 5))
        XCTAssertTrue(next.isHittable)
        XCTAssertLessThanOrEqual(next.frame.maxY, keyboard.frame.minY + 2)
        let portrait = XCTAttachment(screenshot: app.screenshot())
        portrait.name = "Native onboarding controls above the real software keyboard"
        portrait.lifetime = .keepAlways; add(portrait)
        device.orientation = .landscapeLeft
        let wide = expectation(for: NSPredicate { _, _ in app.frame.width > app.frame.height }, evaluatedWith: app)
        wait(for: [wide], timeout: 10)
        XCTAssertEqual(name.value as? String, "Grove_UI_QA")
        XCTAssertTrue(next.isHittable)
        XCTAssertLessThanOrEqual(next.frame.maxY, keyboard.frame.minY + 2)
        device.orientation = .portrait
        let tall = expectation(for: NSPredicate { _, _ in app.frame.width < app.frame.height }, evaluatedWith: app)
        wait(for: [tall], timeout: 10)
        XCTAssertEqual(name.value as? String, "Grove_UI_QA")
        next.tap()
        XCTAssertTrue(app.webViews.switches["Kinder"].waitForExistence(timeout: 10), "Next must deliver a real touch and reveal grade choices")
        if !name.exists {
            app.webViews.buttons["Back"].tap()
            XCTAssertTrue(name.waitForExistence(timeout: 10))
        }
        XCTAssertEqual(name.value as? String, "Grove_UI_QA")
        let onboardingKeyboard = app.buttons["Hide keyboard"]
        if onboardingKeyboard.exists && onboardingKeyboard.isHittable { onboardingKeyboard.tap() }

        let gear = app.webViews.buttons["Grown-ups settings, press and hold or activate with keyboard"]
        XCTAssertTrue(gear.isHittable)
        gear.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).press(forDuration: 3)
        let backupSection = app.webViews.switches["Backup"]
        XCTAssertTrue(backupSection.waitForExistence(timeout: 10), app.debugDescription)
        backupSection.tap()
        let download = app.webViews.buttons["Download backup file"]
        XCTAssertTrue(download.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertTrue(download.isHittable)
        XCTAssertLessThanOrEqual(download.frame.maxY, app.frame.maxY)
    }

    @MainActor func testSyntheticBackupCodeRecoverySurvivesColdLaunch() throws {
        guard ["9EFE4227-7925-437A-99B7-FBD467913AE2", "BC062C51-505F-4C31-967F-28FED4039C62"].contains(ProcessInfo.processInfo.environment["SIMULATOR_UDID"] ?? ""),
              let fixture = ProcessInfo.processInfo.environment["GROVE_NATIVE_QA_BACKUP_CODE"], !fixture.isEmpty else {
            throw XCTSkip("Owned empty synthetic iPad and explicit synthetic backup required")
        }
        continueAfterFailure = false
        let app = XCUIApplication(bundleIdentifier: "design.highgain.mandaringrove")
        app.launch()
        guard requireGroveContent(app, context: "before compatible code recovery") else { return }
        XCTAssertTrue(app.webViews.textFields["Kid's name"].waitForExistence(timeout: 10), "Never replace existing learners automatically")
        let gear = app.webViews.buttons["Grown-ups settings, press and hold or activate with keyboard"]
        XCTAssertTrue(gear.isHittable); gear.press(forDuration: 3)
        let backupSection = app.webViews.switches["Backup"]
        XCTAssertTrue(backupSection.waitForExistence(timeout: 10), app.debugDescription)
        backupSection.tap()
        let restore = app.webViews.buttons["Restore from a backup code"]
        XCTAssertTrue(restore.waitForExistence(timeout: 10)); restore.tap()
        let code = app.webViews.textViews["Paste the backup code"]
        XCTAssertTrue(code.waitForExistence(timeout: 10))
        // Populate the simulator pasteboard after XCTest has launched the app;
        // fixture setup before the test runner starts can be cleared by it.
        let pasteboard = UIPasteboard.general, priorItems = UIPasteboard.general.items
        defer { pasteboard.items = priorItems }
        pasteboard.string = fixture
        code.tap(); code.press(forDuration: 1.2)
        let pasteMenu = app.menuItems["Paste"], pasteButton = app.buttons["Paste"].firstMatch
        if pasteMenu.waitForExistence(timeout: 3) { pasteMenu.tap() }
        else { XCTAssertTrue(pasteButton.waitForExistence(timeout: 3), app.debugDescription); pasteButton.tap() }
        let permission = app.alerts.buttons["Allow Paste"].firstMatch
        if permission.waitForExistence(timeout: 2) { permission.tap() }
        let systemPermission = XCUIApplication(bundleIdentifier: "com.apple.springboard").buttons["Allow Paste"].firstMatch
        if systemPermission.waitForExistence(timeout: 2) { systemPermission.tap() }
        let pasted = expectation(for: NSPredicate { _, _ in (code.value as? String) == fixture }, evaluatedWith: code)
        wait(for: [pasted], timeout: 10)
        let replace = app.webViews.buttons["Replace all device progress"]
        XCTAssertTrue(replace.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertTrue(app.webViews.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Synthetic Learner B")).firstMatch.exists)
        let hide = app.buttons["Hide keyboard"]
        if hide.exists && hide.isHittable { hide.tap() }
        XCTAssertTrue(replace.isHittable)
        replace.tap()
        XCTAssertTrue(app.webViews.buttons["Practice"].waitForExistence(timeout: 15), app.debugDescription)
        app.terminate(); app.launch()
        guard requireGroveContent(app, context: "after restored progress cold launch") else { return }
        let learner = app.webViews.buttons["🐼 合成 Learner A 2nd, Grade 2"]
        XCTAssertTrue(learner.waitForExistence(timeout: 10), "Restored two-learner registry must open the ordinary learner chooser")
        learner.tap()
        XCTAssertTrue(app.webViews.buttons["Practice"].waitForExistence(timeout: 10))
        let cold = XCTAttachment(screenshot: app.screenshot())
        cold.name = "Fresh native installation recovered from the compatible synthetic backup after process restart"
        cold.lifetime = .keepAlways; add(cold)
    }

    @MainActor func testIPhoneLandscapeHomeRemainsTouchable() throws {
        guard ProcessInfo.processInfo.environment["SIMULATOR_UDID"] == "BC062C51-505F-4C31-967F-28FED4039C62" else {
            throw XCTSkip("Dedicated synthetic iPhone required")
        }
        continueAfterFailure = false
        let device = XCUIDevice.shared, original = device.orientation
        defer { device.orientation = original == .unknown ? .portrait : original }
        device.orientation = .portrait
        let app = XCUIApplication(bundleIdentifier: "design.highgain.mandaringrove")
        app.launch()
        guard requireGroveContent(app, context: "before iPhone landscape navigation") else { return }
        app.webViews.buttons["🐼 合成 Learner A 2nd, Grade 2"].tap()
        let practice = app.webViews.buttons["Practice"]
        XCTAssertTrue(practice.waitForExistence(timeout: 10))
        app.webViews.buttons["Help"].tap()
        XCTAssertTrue(app.webViews.buttons["Back to Home"].waitForExistence(timeout: 10))
        device.orientation = .landscapeLeft
        let wide = expectation(for: NSPredicate { _, _ in app.frame.width > app.frame.height }, evaluatedWith: app)
        wait(for: [wide], timeout: 10)
        let home = app.webViews.buttons["Mandarin Grove, Home"]
        let view = XCTAttachment(screenshot: app.screenshot())
        view.name = "Actual iPhone landscape header and cutout"
        view.lifetime = .keepAlways; add(view)
        XCTAssertTrue(home.isHittable)
        home.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        XCTAssertTrue(practice.waitForExistence(timeout: 10), "Home must receive the real landscape touch")
    }

    @MainActor private func requireGroveContent(_ app: XCUIApplication, context: String,
                                               timeout: TimeInterval = 30,
                                               file: StaticString = #filePath, line: UInt = #line) -> Bool {
        // The report footer is intentionally hidden while compact text input
        // is focused. Require a real rendered app control available in every
        // launch state, rather than a WebView container or that hidden footer.
        guard app.webViews.buttons["Grown-ups settings, press and hold or activate with keyboard"].waitForExistence(timeout: timeout) else {
            let tree = XCTAttachment(string: app.debugDescription)
            tree.name = "Grove content unavailable " + context
            tree.lifetime = .keepAlways
            add(tree)
            if app.state == .runningForeground {
                let screenshot = XCTAttachment(screenshot: app.screenshot())
                screenshot.name = "Grove readiness failure " + context
                screenshot.lifetime = .keepAlways
                add(screenshot)
            }
            XCTFail("Grove content is not accessible \(context). A WebView container alone is not readiness.", file: file, line: line)
            return false
        }
        let keyboardTutorial = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "Speed up your typing by sliding")).firstMatch
        if app.webViews.textFields["Kid's name"].exists && keyboardTutorial.waitForExistence(timeout: 5) {
            // A fresh OS can show Apple's keyboard tutorial after Grove has
            // rendered. Dismiss only that identified tutorial, not app errors.
            app.buttons["Continue"].tap()
        }
        return true
    }

    @MainActor func testInstalledDeviceRotationPreservesVisibleApp() throws {
        let allowed = ["9EFE4227-7925-437A-99B7-FBD467913AE2", "F8FF1550-0D71-4718-AB66-9A037F9D720F"]
        guard allowed.contains(ProcessInfo.processInfo.environment["SIMULATOR_UDID"] ?? "") else { throw XCTSkip("Dedicated synthetic simulators only") }
        continueAfterFailure = false
        let device = XCUIDevice.shared, original = XCUIDevice.shared.orientation
        defer { device.orientation = original == .unknown ? .portrait : original }
        let app = XCUIApplication(bundleIdentifier: "design.highgain.mandaringrove")
        device.orientation = .portrait
        app.launch()
        let web = app.webViews.firstMatch
        XCTAssertTrue(web.waitForExistence(timeout: 20), app.debugDescription)
        guard requireGroveContent(app, context: "before rotation") else { return }
        let portrait = web.frame
        XCTAssertLessThan(portrait.width, portrait.height)
        device.orientation = .landscapeLeft
        let wide = expectation(for: NSPredicate { _, _ in web.frame.width > web.frame.height }, evaluatedWith: web)
        wait(for: [wide], timeout: 10)
        guard requireGroveContent(app, context: "after landscape rotation", timeout: 10) else { return }
        let landscape = XCTAttachment(screenshot: app.screenshot()); landscape.name = "Actual iPad device rotation at system text size"; landscape.lifetime = .keepAlways; add(landscape)
        let frames = XCTAttachment(string: "Portrait: \(portrait); landscape: \(web.frame)"); frames.name = "Actual installed viewport frames"; frames.lifetime = .keepAlways; add(frames)
        device.orientation = .portrait
        let tall = expectation(for: NSPredicate { _, _ in web.frame.width < web.frame.height }, evaluatedWith: web)
        wait(for: [tall], timeout: 10)
        guard requireGroveContent(app, context: "after returning to portrait", timeout: 10) else { return }
        XCTAssertEqual(web.frame.width, portrait.width, accuracy: 2)
        XCTAssertEqual(web.frame.height, portrait.height, accuracy: 2)
    }
    @MainActor func testFeedbackSystemFileAndShareCancellation() throws {
        let allowed = ["9EFE4227-7925-437A-99B7-FBD467913AE2", "F8FF1550-0D71-4718-AB66-9A037F9D720F"]
        guard allowed.contains(ProcessInfo.processInfo.environment["SIMULATOR_UDID"] ?? "") else { throw XCTSkip("Dedicated synthetic simulators only") }
        continueAfterFailure = false
        let app = XCUIApplication(bundleIdentifier: "design.highgain.mandaringrove")
        app.launch()
        let report = app.webViews.buttons["Report a problem"].firstMatch
        XCTAssertTrue(report.waitForExistence(timeout: 20), app.debugDescription); report.tap()
        let category = app.webViews.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "Something did not work")).firstMatch
        XCTAssertTrue(category.waitForExistence(timeout: 10), app.debugDescription); category.tap()
        let note = app.webViews.textViews.firstMatch
        XCTAssertTrue(note.waitForExistence(timeout: 10)); note.tap(); note.typeText("Synthetic native feedback manual proof")
        let hideKeyboard = app.buttons["Hide keyboard"]
        if hideKeyboard.waitForExistence(timeout: 2), hideKeyboard.isHittable, hideKeyboard.frame.minY < app.frame.maxY { hideKeyboard.tap() }
        let manual = app.webViews.buttons.matching(NSPredicate(format: "label == %@ AND value != nil", "Grown-ups: saved reports & manual sharing")).firstMatch
        XCTAssertTrue(manual.waitForExistence(timeout: 10), app.debugDescription); manual.tap()
        let details = app.webViews.buttons.matching(NSPredicate(format: "label == %@ AND value != nil", "Report details")).firstMatch
        XCTAssertTrue(details.waitForExistence(timeout: 10), app.debugDescription); details.tap()
        let output = app.webViews.textViews["Feedback report"]
        XCTAssertTrue(output.waitForExistence(timeout: 10), app.debugDescription)
        let expected = try XCTUnwrap(output.value as? String)
        XCTAssertTrue(expected.contains("Synthetic native feedback manual proof"))
        let raw = XCTAttachment(string: expected); raw.name = "Expected exact feedback file"; raw.lifetime = .keepAlways; add(raw)
        let download = app.webViews.buttons["Save report file"]
        download.tap()
        let cancel = app.buttons["Cancel"].firstMatch
        XCTAssertTrue(cancel.waitForExistence(timeout: 15), app.debugDescription); cancel.tap()
        XCTAssertTrue(app.webViews.staticTexts["Report file save cancelled. Your local reports were kept."].waitForExistence(timeout: 10), app.debugDescription)
        download.tap()
        let save = app.buttons["DOCPicker.actionButton"], filename = app.textFields["DOCPicker.filenameTextField"]
        XCTAssertTrue(save.waitForExistence(timeout: 15), app.debugDescription); XCTAssertEqual(save.label, "Save"); XCTAssertTrue(filename.exists)
        let local = app.cells["DOC.sidebar.item.On My iPad"]
        if local.exists { local.tap() }
        let oldName = filename.value as? String ?? "", unique = "grove-feedback-ios-" + UUID().uuidString.lowercased()
        filename.tap(); filename.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: oldName.count + 10)); filename.typeText(unique)
        XCTAssertTrue((filename.value as? String)?.contains(unique) == true, "Use a new unique filename; never overwrite an earlier file")
        print("GROVE_FEEDBACK_EXPORT_STEM:" + unique)
        save.tap()
        XCTAssertTrue(app.webViews.staticTexts["Report file saved. Keep its local details private."].waitForExistence(timeout: 15), app.debugDescription)
        app.webViews.buttons["Share report"].tap()
        let openShare = app.webViews.buttons["Open share sheet"]
        XCTAssertTrue(openShare.waitForExistence(timeout: 10), app.debugDescription); openShare.tap()
        let close = app.otherElements["PopoverDismissRegion"]
        XCTAssertTrue(close.waitForExistence(timeout: 15), app.debugDescription)
        let shared = XCTAttachment(screenshot: app.screenshot()); shared.name = "Actual iPad share sheet, no recipient selected"; shared.lifetime = .keepAlways; add(shared)
        close.coordinate(withNormalizedOffset: CGVector(dx: 0.1, dy: 0.1)).tap()
        XCTAssertTrue(app.webViews.staticTexts["Share sheet closed. Grove does not confirm delivery. Your local reports were kept."].waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertEqual(output.value as? String, expected, "File and share actions preserve the full raw local report")
    }
    @MainActor func testSystemBackupTransferAndCancel() throws {
        let syntheticDevices = ["9EFE4227-7925-437A-99B7-FBD467913AE2", "F8FF1550-0D71-4718-AB66-9A037F9D720F"]
        guard let simulator = ProcessInfo.processInfo.environment["SIMULATOR_UDID"], syntheticDevices.contains(simulator) else {
            throw XCTSkip("This file-replacement test is restricted to the dedicated synthetic simulators")
        }
        continueAfterFailure = false
        let app = XCUIApplication(bundleIdentifier: "design.highgain.mandaringrove")
        app.launch()
        guard requireGroveContent(app, context: "before backup transfer") else { return }
        let gear = app.webViews.buttons["Grown-ups settings, press and hold or activate with keyboard"]
        XCTAssertTrue(gear.waitForExistence(timeout: 20), app.debugDescription)
        gear.press(forDuration: 2.2)
        let backupSection = app.webViews.switches["Backup"]
        XCTAssertTrue(backupSection.waitForExistence(timeout: 10), app.debugDescription)
        backupSection.tap()
        let export = app.webViews.buttons["Download backup file"]
        XCTAssertTrue(export.waitForExistence(timeout: 10))
        export.tap()
        let cancel = app.buttons["Cancel"].firstMatch
        XCTAssertTrue(cancel.waitForExistence(timeout: 15), app.debugDescription)
        let screenshot = XCTAttachment(screenshot: app.screenshot()); screenshot.name = "Actual system backup export picker"; screenshot.lifetime = .keepAlways; add(screenshot)
        cancel.tap()
        XCTAssertTrue(app.webViews.staticTexts["Backup save cancelled. Your progress is unchanged."].waitForExistence(timeout: 10), app.debugDescription)
        app.webViews.buttons["Restore from backup file"].tap()
        XCTAssertTrue(cancel.waitForExistence(timeout: 15), app.debugDescription)
        let opened = XCTAttachment(screenshot: app.screenshot()); opened.name = "Actual system backup import picker"; opened.lifetime = .keepAlways; add(opened)
        cancel.tap()
        XCTAssertTrue(app.webViews.buttons["Download backup file"].waitForExistence(timeout: 10))

        // Save through the actual system Files UI. A previous file is never
        // replaced automatically; any unexpected overwrite prompt fails here.
        export.tap()
        let save = app.buttons["DOCPicker.actionButton"]
        XCTAssertTrue(save.waitForExistence(timeout: 15), app.debugDescription)
        XCTAssertEqual(save.label, "Save")
        let filename = app.textFields["DOCPicker.filenameTextField"]
        XCTAssertTrue(filename.exists)
        let localSave = app.cells["DOC.sidebar.item.On My iPad"]
        XCTAssertTrue(localSave.waitForExistence(timeout: 10), "Choose the local destination explicitly")
        localSave.tap()
        let oldName = filename.value as? String ?? ""
        let unique = "grove-native-ios-" + UUID().uuidString.lowercased()
        filename.tap(); filename.press(forDuration: 1.1)
        if app.menuItems["Select All"].exists { app.menuItems["Select All"].tap() }
        else if app.buttons["Select All"].exists { app.buttons["Select All"].tap() }
        filename.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: oldName.count + 10))
        filename.typeText(unique)
        XCTAssertTrue((filename.value as? String)?.contains(unique) == true, "Use a new unique filename; never overwrite a prior backup")
        print("GROVE_OS_EXPORT_STEM:" + unique)
        save.tap()
        XCTAssertTrue(app.webViews.staticTexts["Backup file saved. It includes every child’s progress and names."].waitForExistence(timeout: 15), app.debugDescription)

        // Import the file that Files just saved. This is the normal backup
        // round trip, without injecting a URL or calling the picker delegate.
        // The separate hosted test covers exact BOM/CRLF decoding.
        app.webViews.buttons["Restore from backup file"].tap()
        let local = app.cells["DOC.sidebar.item.On My iPad"]
        XCTAssertTrue(local.waitForExistence(timeout: 15), app.debugDescription)
        local.tap()
        let original = app.cells.matching(NSPredicate(format: "label BEGINSWITH %@", unique)).firstMatch
        XCTAssertTrue(original.waitForExistence(timeout: 10), app.debugDescription)
        original.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.25)).tap()
        let replace = app.webViews.buttons["Replace all device progress"]
        if !replace.waitForExistence(timeout: 3) {
            let open = app.buttons["DOCPicker.actionButton"]
            if open.exists && open.label == "Open" { open.tap() }
            else if original.exists { original.doubleTap() }
        }
        XCTAssertTrue(replace.waitForExistence(timeout: 15), app.debugDescription)
        XCTAssertTrue(app.webViews.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Synthetic Learner B")).firstMatch.exists)
        replace.tap()
        let closed = expectation(for: NSPredicate(format: "exists == false"), evaluatedWith: app.webViews.buttons["Close"])
        wait(for: [closed], timeout: 15)
        XCTAssertTrue(app.webViews.buttons["Practice"].waitForExistence(timeout: 10), app.debugDescription)
        let restored = XCTAttachment(screenshot: app.screenshot()); restored.name = "Restored OS-saved backup through actual Files picker"; restored.lifetime = .keepAlways; add(restored)
    }
}
