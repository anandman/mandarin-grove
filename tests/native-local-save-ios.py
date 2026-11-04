"""Explicit synthetic iPad host restarts; preserve all app data and evidence."""
import json, os, pathlib, plistlib, shutil, signal, subprocess, time, uuid

root = pathlib.Path(__file__).resolve().parents[1]
output = pathlib.Path(os.environ['GROVE_NATIVE_EVIDENCE'])
sim = os.environ['GROVE_IOS_SIMULATOR']
derived = pathlib.Path(os.environ['GROVE_IOS_DERIVED_DATA'])
assert sim in ['9EFE4227-7925-437A-99B7-FBD467913AE2', 'F8FF1550-0D71-4718-AB66-9A037F9D720F']
bundle = 'io.github.anandman.mandaringrove'
def run(args):
    return subprocess.run(args, check=True, text=True, capture_output=True).stdout.strip()
def stop(proc):
    if proc.poll() is None:
        os.killpg(proc.pid, signal.SIGINT)
        try:
            proc.wait(timeout=30)
        except subprocess.TimeoutExpired:
            os.killpg(proc.pid, signal.SIGTERM)
            proc.wait(timeout=15)

output.mkdir(exist_ok=False)
app = derived / 'Build/Products/Debug-iphonesimulator/App.app'
assert app.is_dir()
run(['xcrun', 'simctl', 'install', sim, str(app)])  # In-place update; never uninstall/clear.
def documents():
    return pathlib.Path(run(['xcrun', 'simctl', 'get_app_container', sim, bundle, 'data'])) / 'Documents'
run_id = str(uuid.uuid4())
version = (root / 'version.txt').read_text().strip()
# Supported xctestrun EnvironmentVariables explicitly authorize this invocation.
# A normal AppTests run uses the original specification and skips this method.
products = derived / 'Build/Products'
candidates = list(products.glob('*.xctestrun'))
assert len(candidates) == 1
specification = plistlib.loads(candidates[0].read_bytes())
assert 'AppTests' in specification
specification['AppTests'].setdefault('EnvironmentVariables', {})['GROVE_LOCAL_SAVE_RUN_ID'] = run_id
def absolute_paths(value):
    if isinstance(value, str):
        return value.replace('__TESTROOT__', str(products))
    if isinstance(value, list):
        return [absolute_paths(item) for item in value]
    if isinstance(value, dict):
        return {key: absolute_paths(item) for key, item in value.items()}
    return value
spec = output / 'explicit-local-run.xctestrun'
spec.write_bytes(plistlib.dumps(absolute_paths(specification)))
command = ['xcodebuild', 'test-without-building', '-xctestrun', str(spec), '-destination', 'id='+sim, '-only-testing:AppTests/PackagedShellTests/testLocalSaveSpendingWithHostRestarts']
restore_path = os.environ.get('GROVE_LOCAL_RESTORE_CONTEXT')
context = json.loads(pathlib.Path(restore_path).read_text()) if restore_path else None
actions = ['restore'] if restore_path else ['begin', 'afterPurchase', 'finish']
killed, observations, receipt = [], [], None

def archive_control(reason, allow_prior=False):
    folder = documents()
    control = folder / 'GroveSyntheticLocalSaveControl.json'
    if not control.exists():
        return
    payload = json.loads(control.read_text())
    assert allow_prior or payload.get('runID') == run_id, 'Another invocation owns the control; do not alter it'
    destination = folder / ('GroveSyntheticLocalSaveControl-archived-'+run_id+'-'+reason+'.json')
    assert not destination.exists()
    shutil.copy2(control, output / ('control-'+reason+'.json'))
    control.rename(destination)  # Archive evidence, do not delete it.

archive_control('prior', allow_prior=True)
try:
    for action in actions:
        archive_control('before-'+action)
        payload = {'action': action, 'runID': run_id, 'version': version}
        if context is not None:
            payload['context'] = context
        text = json.dumps(payload, ensure_ascii=False)
        (documents()/'GroveSyntheticLocalSaveControl.json').write_text(text)
        (output/(action+'-control.json')).write_text(text)
        with (output/(action+'-xcodebuild.log')).open('w') as log:
            proc = subprocess.Popen(command, cwd=root, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
            try:
                deadline = time.monotonic()+180
                while True:
                    # XCTest may reinstall/move the container. Re-read its
                    # authoritative current path instead of watching the old one.
                    try:
                        folder = documents()
                        current = str(folder)
                        if not observations or observations[-1] != current:
                            observations.append(current)
                        stage = folder / ('GroveSyntheticLocalSave-'+run_id)
                        target = stage / (action+'.json')
                        if target.exists():
                            break
                    except subprocess.CalledProcessError:
                        pass  # A live installation may temporarily lack a container.
                    if proc.poll() is not None:
                        raise RuntimeError(f'{action}: test ended before its saved result; see preserved log')
                    if time.monotonic() > deadline:
                        raise RuntimeError(f'{action}: explicit stage deadline; cancel this known process, do not restart from an observation timeout')
                    time.sleep(.2)
                value = json.loads(target.read_text())
                for evidence in stage.glob('*.json'):
                    shutil.copy2(evidence, output/(action+'-'+evidence.name))
                if action not in ['finish', 'restore']:
                    matches = [line.split() for line in run(['xcrun', 'simctl', 'spawn', sim, 'launchctl', 'list']).splitlines() if 'UIKitApplication:'+bundle+'[' in line and line.split()[0].isdigit()]
                    assert len(matches) == 1, 'Actual live app PID required before OS kill'
                    pid = int(matches[0][0]);os.kill(pid, 0);os.kill(pid, signal.SIGKILL)
                    killed.append({'action': action, 'pid': pid, 'signal': 'SIGKILL'})
                    stop(proc)  # Stop XCTest before its automatic host relaunch.
                    context = value
                    print(action+': native save verified, live app killed', flush=True)
                else:
                    assert value['restoredOriginalBackupSemanticsExact' if action == 'restore' else 'passed'] is True
                    assert proc.wait(timeout=120) == 0, 'Final actual XCTest must pass'
                    if action == 'restore':
                        receipt = {**value, 'restorationOnly': True}
                    else:
                        assert len(killed) == 2
                        receipt = {**value, 'actualOSKills': killed, 'networkQualification': 'External web requests blocked; physical airplane-mode smoke remains separate'}
            finally:
                stop(proc)
finally:
    archive_control('disarmed')
    (output/'container-observations.json').write_text(json.dumps(observations, indent=2)+'\n')
if receipt is not None:
    receipt['controlDisarmed'] = not (documents()/'GroveSyntheticLocalSaveControl.json').exists()
    assert receipt['controlDisarmed']
    (output/('restoration-receipt.json' if restore_path else 'receipt.json')).write_text(json.dumps(receipt, indent=2)+'\n')
    print('Original fixture registry/backups/imports/reports restored; test control archived' if restore_path else 'PASS actual iPad local purchases/Undo/build and two OS kills; prior backups/imports/reports exact, control disarmed', flush=True)
