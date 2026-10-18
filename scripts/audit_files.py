"""Audit tracked source, every reachable commit and package members without printing matches."""
from pathlib import Path
import re, subprocess, sys, tarfile
root=Path(__file__).resolve().parent.parent
rules={
 'credential-like-token':re.compile(rb'(?:gh[pousr]_[A-Za-z0-9]{24,}|sk-[A-Za-z0-9_-]{24,})'),
 'private-key':re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),
 'personal-machine-path':re.compile(rb'/(?:Users|home)/[a-z][a-z0-9_-]+/|[a-z0-9-]+\.tail[a-z0-9]+\.ts\.net'),
 'credential-url':re.compile(rb'https?://[^\s"\x27<>]+[?&](?:token|api_key|access_token)=[A-Za-z0-9._~-]{16,}'),
}
blocked={'node_modules','.dsh','.credentials.yaml','profiles','sessions','evidence','baseline.json','production.py','maintain.py'}
failures=[];count=0

def check(path,data):
 global count
 count+=1
 if any(part in blocked or part.startswith('.dsh-test') for part in Path(path).parts):failures.append((path,'excluded-runtime-path'))
 for label,pattern in rules.items():
  if pattern.search(data):failures.append((path,label))

records=subprocess.check_output(['git','ls-files','--stage','-z'],cwd=root).split(b'\0')
for record in records:
 if not record:continue
 meta,rawpath=record.split(b'\t',1);path=rawpath.decode()
 if meta.split(b' ',1)[0]==b'160000':continue
 file=root/path
 if file.is_symlink():failures.append((path,'unexpected-symlink'));continue
 check(path,file.read_bytes())
commits=subprocess.run(['git','rev-list','--all'],cwd=root,capture_output=True,text=True).stdout.splitlines()
for commit in commits:
 metadata=subprocess.check_output(['git','show','-s','--format=%B%n%ae%n%ce',commit],cwd=root)
 check('commit/'+commit,metadata)
 if any(not line.endswith(b'@users.noreply.github.com') for line in metadata.splitlines()[-2:]):failures.append(('commit/'+commit,'non-public-author-email'))
 tree=subprocess.check_output(['git','ls-tree','-rz',commit],cwd=root).split(b'\0')
 for record in tree:
  if not record:continue
  meta,path=record.split(b'\t',1);mode,kind,oid=meta.split(b' ')
  if kind!=b'blob':continue
  check(commit+'/'+path.decode(),subprocess.check_output(['git','cat-file','blob',oid.decode()],cwd=root))
for package in (root/'artifacts').glob('*.tgz'):
 with tarfile.open(package,'r:gz') as archive:
  for member in archive.getmembers():
   if not member.isfile() or member.name.startswith('/') or '..' in Path(member.name).parts:
    failures.append((package.name,'unsafe-archive-member'));continue
   check(package.name+'/'+member.name,archive.extractfile(member).read())
for path,rule in failures:print(f'{rule}: {path}')
print(f'Audited {count} sources/history/package records across {len(commits)} commits; {len(failures)} findings')
sys.exit(bool(failures))
