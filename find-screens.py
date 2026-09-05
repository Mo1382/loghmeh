import json

with open(r'c:\Users\Mo82\Desktop\loghmeh\figma-data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

def find_screens_with_buttons(obj, button_names):
    screens = []
    if isinstance(obj, dict):
        if 'name' in obj and 'type' in obj:
            # Check if this is a screen/page
            if obj['type'] in ['FRAME', 'COMPONENT', 'COMPONENT_SET']:
                # Check if it contains the buttons we're looking for
                if 'children' in obj:
                    children_names = [child.get('name', '') for child in obj['children']]
                    if any(btn_name in ' '.join(children_names).lower() for btn_name in button_names):
                        screens.append({
                            'name': obj.get('name', 'Unknown'),
                            'type': obj.get('type', 'Unknown'),
                            'id': obj.get('id', 'Unknown'),
                            'children': children_names
                        })
        for v in obj.values():
            screens.extend(find_screens_with_buttons(v, button_names))
    elif isinstance(obj, list):
        for item in obj:
            screens.extend(find_screens_with_buttons(item, button_names))
    return screens

screens = find_screens_with_buttons(data, ['right-in-list-btn', 'left-in-list-btn'])

print(f'Found {len(screens)} screens with arrow buttons:')
for i, screen in enumerate(screens, 1):
    print(f'\n{i}. {screen["name"]} ({screen["type"]})')
    print(f'   ID: {screen["id"]}')
    print(f'   Children: {screen["children"][:5]}...' if len(screen["children"]) > 5 else f'   Children: {screen["children"]}')
