import json, subprocess, shlex
folders={
 '01 Original PPT':'1_dUBVHayS0OEnPHz3K5AkCUWXjh61hyr',
 '02 Single Slide PPTs':'1o6j-UiA8hhC-c0R1FOR7gSj7OOz-RZ7b',
 '03 Slide Images':'1DA3aJCK5sViXr0XlG-MhvVjXVf3CEBgm',
 '04 Template Index':'1UO2GUs4a71Q1TfcmIKDl-79-9vla6cUU',
 '05 Final Templates':'1UGqr1GfjficNygMZ2JM86xgaMZIkWr6Q',
}
archive='12tL2AFeYDKHS4QtwjOmMUakDRpKTD8Fv'

def run(args):
    return subprocess.check_output(args, text=True)

def folder_id_from_mkdir(raw):
    d=json.loads(raw)
    obj=d.get('folder') or d.get('file') or d
    return obj['id']

summary=[]
for name,src_id in folders.items():
    # create archive subfolder
    q=f"name = '{name}' and mimeType = 'application/vnd.google-apps.folder' and '{archive}' in parents and trashed = false"
    data=json.loads(run(['gog','drive','search',q,'--max','1','--json','--no-input']))
    if data.get('files'):
        dst_id=data['files'][0]['id']
    else:
        dst_id=folder_id_from_mkdir(run(['gog','drive','mkdir',name,'--parent',archive,'--json','--no-input']))
    # list current children in original folder
    q=f"'{src_id}' in parents and trashed = false"
    data=json.loads(run(['gog','drive','search',q,'--max','1000','--json','--no-input']))
    moved=0
    for f in data.get('files',[]):
        # move files only; no nested folders expected, but safe to move children too if present
        run(['gog','drive','move',f['id'],'--parent',dst_id,'--json','--no-input'])
        moved+=1
    summary.append((name,moved,dst_id))
print('\n'.join(f'{name}\t{moved}\t{dst}' for name,moved,dst in summary))
