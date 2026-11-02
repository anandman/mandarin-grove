"""Hosted XCTest + actual SIGKILL; synthetic dedicated simulator only.

The ordinary build/test plugin cannot orchestrate the intentional death of its
test host. Use its prepared xctestrun with the official xcodebuild CLI here.
Intentionally interrupted hold runs are never counted as passing tests.
"""
import base64
import hashlib
import json
import os
from pathlib import Path
import signal
import sqlite3
import subprocess
import time

SIM = os.environ["GROVE_IOS_SIMULATOR"]
NAMES = {"9EFE4227-7925-437A-99B7-FBD467913AE2": "Mandarin Grove mi5 A16",
         "F8FF1550-0D71-4718-AB66-9A037F9D720F": "Mandarin Grove mi5 recovery"}
assert SIM in NAMES, "Dedicated Grove synthetic simulators only"
OUTPUT = Path(os.environ["GROVE_NATIVE_EVIDENCE"]).resolve()
OUTPUT.mkdir()  # Refuse to overwrite any previous evidence.
RUN = Path(os.environ["GROVE_XCTESTRUN"]).resolve()
APP = "io.github.anandman.mandaringrove"
ROOT = Path(__file__).resolve().parent.parent
receipt = {"platform": "ios", "syntheticOnly": True, "checks": [], "passed": False}


def simctl(*args):
    return subprocess.check_output(["xcrun", "simctl", *args], text=True).strip()


def container(kind="data"):
    return Path(simctl("get_app_container", SIM, APP, kind))


def runner(label):
    return ["xcodebuild", "-xctestrun", str(RUN), "-destination", "platform=iOS Simulator,id=" + SIM,
            "-only-testing:AppTests/PackagedShellTests/testNativeInterruptedTransactionRecovery",
            "-parallel-testing-enabled", "NO", "-test-timeouts-enabled", "YES",
            "-default-test-execution-time-allowance", "180", "-maximum-test-execution-time-allowance", "180",
            "-resultBundlePath", str(OUTPUT / (label + ".xcresult")), "test-without-building"]


def app_pid():
    executable = str(container("app") / "App")
    matches = []
    for row in subprocess.check_output(["ps", "-axo", "pid,comm"], text=True).splitlines():
        fields = row.strip().split(None, 1)
        if len(fields) == 2 and fields[1] == executable:
            matches.append(int(fields[0]))
    assert len(matches) <= 1, "Exactly one owned test app process"
    return matches[0] if matches else None


def preserve_and_verify(stage, expected):
    source = container() / "Library/CapacitorDatabase"
    target = OUTPUT / (stage + "-killed")
    target.mkdir()
    rows = []
    for suffix in ["", "-wal", "-shm"]:
        name = "mandarin_groveSQLite.db" + suffix
        file = source / name
        if file.exists():
            data = file.read_bytes()
            (target / name).write_bytes(data)
            rows.append({"name": name, "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data)})
    (target / "manifest.json").write_text(json.dumps(rows, indent=2) + "\n")
    db = sqlite3.connect((target / "mandarin_groveSQLite.db").as_uri() + "?mode=ro", uri=True)
    try:
        values = dict(db.execute("SELECT key,value FROM grove_entries"))
        assert json.loads(values["zh_profiles"]) == expected["PR"]
        for key, raw in expected["data"].items():
            assert values["zh_p_" + key] == raw, "Raw child differs at actual OS-kill boundary: " + key
        encoded = any(row[1] == "code_json" for row in db.execute("PRAGMA table_info(grove_originals)"))
        for sha, stored, payload_hash in db.execute("SELECT sha256," + ("code_json" if encoded else "code") + ",payload_hash FROM grove_originals"):
            code = json.loads(stored) if encoded else stored
            assert hashlib.sha256(code.encode()).hexdigest() == sha
            compact = "".join(c for c in code if not (c.isspace() or c == "\ufeff"))
            assert hashlib.sha256(base64.b64decode(compact, validate=True)).hexdigest() == payload_hash
    finally:
        db.close()


try:
    device = next(d for devices in json.loads(simctl("list", "devices", "--json"))["devices"].values() for d in devices if d["udid"] == SIM)
    assert device["name"] == NAMES[SIM]
    for stage in ["practice", "before", "after"]:
        documents = container() / "Documents"
        control = documents / "GroveSyntheticKillControl.json"
        marker = documents / ("GroveSyntheticReady-" + stage + ".txt")
        if marker.exists():
            preserved = marker.with_name(marker.name + ".preserved-" + OUTPUT.name)
            assert not preserved.exists()
            preserved.write_bytes(marker.read_bytes())
            (OUTPUT / ("prior-" + marker.name)).write_bytes(marker.read_bytes())
            marker.rename(marker.with_name(marker.name + ".archived-" + OUTPUT.name))
        config = {"mode": "hold", "stage": stage}
        control.write_text(json.dumps(config))
        (OUTPUT / (stage + "-hold-control.json")).write_text(json.dumps(config))
        with (OUTPUT / (stage + "-hold.log")).open("w") as log:
            process = subprocess.Popen(runner(stage + "-hold-intentionally-killed"), stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
            deadline = time.monotonic() + 240
            while True:
                # Xcode may replace the app container UUID while retaining its
                # data. Re-resolve the supported simulator path after install.
                documents = container() / "Documents"
                control = documents / "GroveSyntheticKillControl.json"
                marker = documents / ("GroveSyntheticReady-" + stage + ".txt")
                if marker.exists():
                    break
                assert process.poll() is None, "Hosted hold test exited before reaching native marker: " + stage
                assert time.monotonic() < deadline, "Hosted hold test did not reach native marker: " + stage
                time.sleep(0.25)
            pid = app_pid()
            assert pid is not None, "Actual owned app process is present at kill boundary"
            os.kill(pid, signal.SIGKILL)
            # Stop this owned Xcode job so it cannot automatically restart the
            # intentionally killed host before physical evidence is copied.
            os.killpg(process.pid, signal.SIGINT)
            try:
                hold_exit = process.wait(timeout=30)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGTERM)
                hold_exit = process.wait(timeout=15)
            assert app_pid() is None, "Killed app must not be restarted by the test runner"
        if stage == "practice":
            code = (documents / "GroveSyntheticPracticeBackup.txt").read_text()
            (OUTPUT / "ios-after-practice.txt").write_text(code)
            expected = json.loads(base64.b64decode(code))
        else:
            name = "original-v1" if stage == "before" else "grove-v1"
            expected = json.loads((ROOT / ("tests/fixtures/backups/" + name + ".json")).read_text())
        preserve_and_verify(stage, expected)
        receipt["checks"].append({"stage": stage, "killedPid": pid, "signal": "SIGKILL", "holdExit": hold_exit,
                                  "holdIsPassingTest": False, "physicalDatabaseVerified": True})
        control.write_text(json.dumps({"mode": "recover", "stage": stage}))
        with (OUTPUT / (stage + "-recover.log")).open("w") as log:
            result = subprocess.run(runner(stage + "-recover"), stdout=log, stderr=subprocess.STDOUT, timeout=300)
        assert result.returncode == 0, "Fresh-process hosted recovery test failed: " + stage
        documents = container() / "Documents"
        control = documents / "GroveSyntheticKillControl.json"
        recovered_file = documents / ("GroveSyntheticRecovered-" + stage + ".json")
        (OUTPUT / recovered_file.name).write_bytes(recovered_file.read_bytes())
        receipt["checks"][-1]["freshProcessRecoveryPassed"] = True
        print("PASS iOS actual SIGKILL and physical/fresh-process recovery:", stage, flush=True)
    # Keep the completed control in the container without enabling later tests.
    control.rename(documents / "GroveSyntheticKillControl.completed.json")
    receipt["passed"] = True
finally:
    (OUTPUT / "receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
