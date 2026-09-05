import json

with open(r'c:\Users\Mo82\Desktop\loghmeh\figma-data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

def find_all_frames(obj):
    frames = []
    if isinstance(obj, dict):
        if obj.get('type') == 'FRAME':
            frames.append(obj)
        for v in obj.values():
            frames.extend(find_all_frames(v))
    elif isinstance(obj, list):
        for item in obj:
            frames.extend(find_all_frames(item))
    return frames

frames = find_all_frames(data)
print(f'Total frames found: {len(frames)}')

# Look for frames that might be screens (large frames)
screen_frames = [f for f in frames if f.get('absoluteBoundingBox') and 
                 (f['absoluteBoundingBox'].get('width', 0) > 300 or 
                  f['absoluteBoundingBox'].get('height', 0) > 300)]

print(f'Screen-sized frames: {len(screen_frames)}')

# Print screen names
for i, frame in enumerate(screen_frames[:20], 1):
    bbox = frame.get('absoluteBoundingBox', {})
    print(f"{i}. {frame.get('name', 'Unknown')} - {bbox.get('width', 0)}x{bbox.get('height', 0)}")
