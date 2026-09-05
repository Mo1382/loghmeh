import requests
import json
import os

# Figma API configuration
FIGMA_ACCESS_TOKEN = os.getenv("FIGMA_ACCESS_TOKEN")
FILE_KEY = "nnJtIlwpvkncgQisbudJxs"
NODE_ID = "4003-26"

# Figma API endpoint
url = f"https://api.figma.com/v1/files/{FILE_KEY}/nodes?ids={NODE_ID}"

headers = {
    "X-Figma-Token": FIGMA_ACCESS_TOKEN
}

try:
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    data = response.json()
    
    # Save to figma-data.json
    with open(r'c:\Users\Mo82\Desktop\loghmeh\figma-data.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print("✅ Successfully fetched Figma data and saved to figma-data.json")
    print(f"📁 File key: {FILE_KEY}")
    print(f"🔗 Node ID: {NODE_ID}")
    
except requests.exceptions.RequestException as e:
    print(f"❌ Error fetching Figma data: {e}")
    if response.status_code == 403:
        print("⚠️  Access denied. Please check your Figma access token.")
    elif response.status_code == 404:
        print("⚠️  File or node not found. Please check the file key and node ID.")
