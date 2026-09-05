import json

with open(r'c:\Users\Mo82\Desktop\loghmeh\figma-data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

def find_instances(obj, component_id):
    instances = []
    if isinstance(obj, dict):
        if obj.get('type') == 'INSTANCE' and obj.get('componentId') == component_id:
            instances.append(obj)
        for v in obj.values():
            instances.extend(find_instances(v, component_id))
    elif isinstance(obj, list):
        for item in obj:
            instances.extend(find_instances(item, component_id))
    return instances

# Find instances of the right and left button components
right_instances = find_instances(data, '4015:3421')
left_instances = find_instances(data, '4023:3829')

print(f'Right button instances found: {len(right_instances)}')
print(f'Left button instances found: {len(left_instances)}')

# Also search for any component with these names
def find_components_by_name(obj, name):
    components = []
    if isinstance(obj, dict):
        if obj.get('name', '').lower() == name.lower():
            components.append(obj)
        for v in obj.values():
            components.extend(find_components_by_name(v, name))
    elif isinstance(obj, list):
        for item in obj:
            components.extend(find_components_by_name(item, name))
    return components

all_right = find_components_by_name(data, 'right-in-list-btn')
all_left = find_components_by_name(data, 'left-in-list-btn')

print(f'\nAll right button components: {len(all_right)}')
print(f'All left button components: {len(all_left)}')

# Find parent frames that contain these buttons
def find_parent_frames(obj, button_names, path=""):
    frames = []
    if isinstance(obj, dict):
        if obj.get('type') == 'FRAME':
            if 'children' in obj:
                children_names = [child.get('name', '') for child in obj['children']]
                if any(btn in children_names for btn in button_names):
                    frames.append({
                        'name': obj.get('name', 'Unknown'),
                        'path': path,
                        'children': children_names
                    })
        new_path = f"{path}/{obj.get('name', '')}" if obj.get('name') else path
        for v in obj.values():
            frames.extend(find_parent_frames(v, button_names, new_path))
    elif isinstance(obj, list):
        for item in obj:
            frames.extend(find_parent_frames(item, button_names, path))
    return frames

frames = find_parent_frames(data, ['right-in-list-btn', 'left-in-list-btn'])
print(f'\nFrames containing these buttons: {len(frames)}')
for frame in frames[:10]:
    print(f"  - {frame['name']}")
