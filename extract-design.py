import json
import re

with open(r'c:\Users\Mo82\Desktop\loghmeh\figma-data.json', 'r', encoding='utf-8') as f:
    content = f.read()

# Extract colors
color_pattern = r'"r":\s*([\d.]+),\s*"g":\s*([\d.]+),\s*"b":\s*([\d.]+)'
matches = re.findall(color_pattern, content)

colors = set()
for m in matches:
    r = round(float(m[0]) * 255)
    g = round(float(m[1]) * 255)
    b = round(float(m[2]) * 255)
    hex_color = f'#{r:02X}{g:02X}{b:02X}'
    colors.add(hex_color)

print('=== COLORS ===')
for c in sorted(colors):
    print(c)

# Extract fonts
font_pattern = r'"fontFamily":\s*"([^"]+)"'
font_matches = re.findall(font_pattern, content)
fonts = set(font_matches)
print('\n=== FONTS ===')
for f in sorted(fonts):
    print(f)

# Extract font sizes
size_pattern = r'"fontSize":\s*([\d.]+)'
size_matches = re.findall(size_pattern, content)
sizes = set()
for s in size_matches:
    sizes.add(round(float(s)))

print('\n=== FONT SIZES ===')
for s in sorted(sizes):
    print(s)

# Extract font weights
weight_pattern = r'"fontWeight":\s*(\d+)'
weight_matches = re.findall(weight_pattern, content)
weights = set(weight_matches)
print('\n=== FONT WEIGHTS ===')
for w in sorted(weights, key=int):
    print(w)
