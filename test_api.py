import os
from dotenv import load_dotenv
from youtube_client import fetch_channel_data

load_dotenv()

# Test different URLs
tests = [
    "https://www.youtube.com/@MrBeast",
    "@mkbhd",
    "UCX6OQ3DkcsbYNE6H8uQQuVA"
]

for t in tests:
    print(f"Testing: {t}")
    try:
        res = fetch_channel_data(t)
        if res:
            print("Success:", res["snippet"]["title"])
        else:
            print("Not found")
    except Exception as e:
        print("Error:", e)
