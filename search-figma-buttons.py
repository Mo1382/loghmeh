import json

with open(r'c:\Users\Mo82\Desktop\loghmeh\figma-data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

def find_nodes(obj, name):
    results = []
    if isinstance(obj, dict):
        if 'name' in obj and name.lower() in obj['name'].lower():
            results.append(obj)
        for v in obj.values():
            results.extend(find_nodes(v, name))
    elif isinstance(obj, list):
        for item in obj:
            results.extend(find_nodes(item, name))
    return results

right_btns = find_nodes(data, 'right-in-list-btn')
left_btns = find_nodes(data, 'left-in-list-btn')

print('Right buttons found:', len(right_btns))
print('Left buttons found:', len(left_btns))

if right_btns:
    print('\n=== RIGHT BUTTON SAMPLE ===')
    print(json.dumps(right_btns[0], indent=2, ensure_ascii=False)[:3000])

if left_btns:
    print('\n=== LEFT BUTTON SAMPLE ===')
    print(json.dumps(left_btns[0], indent=2, ensure_ascii=False)[:3000])
