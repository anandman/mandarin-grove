"""Ordinary iPad app: actual fresh-install manual restore, SIGKILL and relaunch.

Creates and retains a dedicated simulator. Never clears an existing app/device.
"""
import hashlib, json, os, pathlib, plistlib, shutil, signal, subprocess, uuid

root = pathlib.Path(__file__).resolve().parents[1]
output = pathlib.Path(os.environ['GROVE_NATIVE_EVIDENCE'])
source = pathlib.Path(os.environ['GROVE_RECOVERY_SOURCE'])
derived = pathlib.Path(os.environ['GROVE_IOS_DERIVED_DATA'])
bundle = 'design.highgain.mandaringrove'
run_id = str(uuid.uuid4())

def run(args, **kwargs):
    return subprocess.run(args, check=True, text=True, capture_output=True, **kwargs).stdout.strip()

output.mkdir(exist_ok=False)
source_receipt = json.loads((source/'receipt.json').read_text())
portable = json.loads((source/'portable-backup-receipt.json').read_text())
code = (source/'current-native-backup.txt').read_bytes()
assert source_receipt['passed'] and source_receipt['platform'] == 'ios'
assert hashlib.sha256(code).hexdigest() == portable['portableCodeSha256']
assert len(code) == portable['bytes']
(output/'incoming-native-backup.txt').write_bytes(code)
# XcodeMCP exports the supported manifest into its .xctestproducts/Tests/0
# directory. Validate that product root before creating any simulator.
explicit = os.environ.get('GROVE_IOS_XCTESTRUN')
specs = [pathlib.Path(explicit).expanduser()] if explicit else list((derived/'Build/Products').glob('*.xctestrun'))
assert len(specs) == 1 and specs[0].is_file(), 'Pass the xctestrun path returned by the successful build tool'
products = specs[0].parent
spec = plistlib.loads(specs[0].read_bytes())
assert 'AppTests' in spec
app = pathlib.Path(spec['AppTests']['TestHostPath'].replace('__TESTROOT__',str(products)))
assert app.is_dir() and (app/'PlugIns/AppTests.xctest').is_dir()
assert 'data-native-internal-tests="false"' in (app/'public/index.html').read_text()
assert 'GroveNativeTest' not in (app/'public/native/bridge.js').read_text()
resume = os.environ.get('GROVE_IOS_RESUME_CREATED_SIMULATOR')
if resume:
    previous = pathlib.Path(resume)
    created = json.loads(previous.read_text())
    assert created['retained'] is True
    assert (previous.parent/'incoming-native-backup.txt').read_bytes() == code
    assert not (previous.parent/'restore-control.json').exists(), 'Only a setup failure before testing may resume as fresh'
    sim, creator_run_id = created['simulator'], created['runID']
    assert str(uuid.UUID(creator_run_id)) == creator_run_id
    devices = json.loads(run(['xcrun','simctl','list','devices','available','-j']))
    match = [d for group in devices['devices'].values() for d in group if d['udid'] == sim]
    assert len(match) == 1 and match[0]['name'] == 'Grove local restore '+creator_run_id[:8]
    assert match[0]['state'] == 'Booted', 'Do not reboot a possibly active or unavailable test device'
    assert shutil.disk_usage(root).free >= 128*1024*1024, 'Need room for bounded test logs; preserve all data'
else:
    # First boot consumed about 3.7GiB on mi5. Keep additional working room.
    assert shutil.disk_usage(root).free >= 6000*1024*1024, 'Fresh simulator boot needs at least 6GiB free; preserve all existing data'
    sim = run(['xcrun','simctl','create','Grove local restore '+run_id[:8],
               'com.apple.CoreSimulator.SimDeviceType.iPad-A16',
               'com.apple.CoreSimulator.SimRuntime.iOS-27-2'])
    assert str(uuid.UUID(sim)).upper() == sim.upper()
    created = {'simulator':sim,'runID':run_id,'retained':True}
    (output/'created-simulator.json').write_text(json.dumps(created,indent=2)+'\n')
    run(['xcrun','simctl','boot',sim])
    run(['xcrun','simctl','bootstatus',sim,'-b'],timeout=240)
    absent = subprocess.run(['xcrun','simctl','get_app_container',sim,bundle,'data'],capture_output=True,text=True)
    assert absent.returncode != 0 and 'No such file or directory' in absent.stderr, absent.stderr
    created['appAbsentBeforeInstall'] = True
run(['xcrun','simctl','install',sim,str(app)])  # Fresh install or in-place update after the owned setup failure.
(output/'created-simulator.json').write_text(json.dumps(created,indent=2)+'\n')

def documents():
    return pathlib.Path(run(['xcrun','simctl','get_app_container',sim,bundle,'data']))/'Documents'

spec['AppTests'].setdefault('EnvironmentVariables',{}).update({
    'GROVE_FRESH_RESTORE_RUN_ID':run_id,'GROVE_FRESH_RESTORE_SIMULATOR_ID':sim})

def absolute_paths(value):
    if isinstance(value,str):return value.replace('__TESTROOT__',str(products))
    if isinstance(value,list):return [absolute_paths(v) for v in value]
    if isinstance(value,dict):return {k:absolute_paths(v) for k,v in value.items()}
    return value

invocation = output/'explicit-fresh-restore.xctestrun'
invocation.write_bytes(plistlib.dumps(absolute_paths(spec)))
command = ['xcodebuild','test-without-building','-xctestrun',str(invocation),
           '-destination','id='+sim,'-only-testing:AppTests/PackagedShellTests/testFreshLocalBackupRestore']
receipt = {'passed':False,'platform':'ios','simulator':sim,'createdFreshDevice':True,
           'sourceSHA256':hashlib.sha256(code).hexdigest(),'ordinaryBuild':True,'retainedFreshSimulator':True}
if resume:receipt['resumedOwnedSetupFailure'] = str(pathlib.Path(resume).resolve())
else:receipt['appAbsentBeforeInstall'] = True
controls = []
try:
    restored = None
    for action in ['restore','verify']:
        folder = documents();folder.mkdir(exist_ok=True)
        control = folder/'GroveSyntheticFreshRestoreControl.json'
        if control.exists():
            previous = json.loads(control.read_text());assert previous['runID'] == run_id
            archived = folder/('GroveSyntheticFreshRestoreControl-'+run_id+'-before-'+action+'.json')
            assert not archived.exists();control.rename(archived)
        payload = {'runID':run_id,'action':action,'code':code.decode('utf8'),
                   'syntheticProfileID':source_receipt['retainedSyntheticProfileId']}
        if restored is not None:payload['expectedIdentity'] = restored['installationIdentity']
        control.write_text(json.dumps(payload,ensure_ascii=False))
        (output/(action+'-control.json')).write_text(control.read_text())
        controls.append(action)
        with (output/(action+'-xcodebuild.log')).open('w') as log:
            subprocess.run(command,cwd=root,stdout=log,stderr=subprocess.STDOUT,check=True,timeout=210)
        result = documents()/('GroveSyntheticFreshRestore-'+run_id)/(action+'.json')
        data = result.read_bytes();(output/(action+'.json')).write_bytes(data)
        actual = json.loads(data);assert actual['passed'] and actual['ordinaryBuild']
        if action == 'restore':
            restored = actual
            launch = run(['xcrun','simctl','launch',sim,bundle])
            pid = int(launch.rsplit(':',1)[1].strip())
            process = run(['ps','-p',str(pid),'-o','command='])
            assert '/'+sim+'/' in process and '/App.app/App' in process, process
            os.kill(pid,signal.SIGKILL)
            receipt['actualOSKill'] = {'pid':pid,'signal':'SIGKILL'}
        else:
            assert actual['installationIdentity'] == restored['installationIdentity']
            receipt.update({'freshEmptySandbox':restored['freshEmptySandbox'],
                            'previewReadOnly':restored['previewReadOnly'],
                            'rawProfileAndEnvelopeValuesExact':actual['rawProfileAndEnvelopeValuesExact'],
                            'exactOriginalRetained':actual['exactOriginalRetained'],
                            'nativeSQLite':actual['nativeSQLite'],'noBrowserStorage':actual['noBrowserStorage'],
                            'relaunchVerified':True})
except BaseException as error:
    receipt['error'] = str(error)
    if isinstance(error, subprocess.TimeoutExpired):
        receipt['runtimeQuiescenceVerified'] = False
        receipt['retryRequirement'] = 'The simulator XCTest/app session may still run. Cancel the owned session and verify it is terminal before any retry.'
    raise
finally:
    try:
        control = documents()/'GroveSyntheticFreshRestoreControl.json'
        if control.exists():
            assert json.loads(control.read_text())['runID'] == run_id
            archived = control.with_name('GroveSyntheticFreshRestoreControl-'+run_id+'-archived.json')
            assert not archived.exists();shutil.copy2(control,output/'control-before-disarm.json');control.rename(archived)
        receipt['controlDisarmed'] = True
    except BaseException as error:
        receipt['teardownError'] = str(error)
    receipt['passed'] = bool(receipt.get('relaunchVerified') and receipt.get('controlDisarmed') and not receipt.get('error') and not receipt.get('teardownError'))
    receipt['networkQualification'] = 'External fetch blocked after startup; physical airplane-mode smoke separate'
    (output/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
assert receipt['passed']
print('PASS ordinary iPad actual fresh-install manual recovery, exact raw profiles/original code, SIGKILL/relaunch and disarmed control',flush=True)
