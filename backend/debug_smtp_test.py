import os
import smtplib
from dotenv import load_dotenv

# Force reload of .env
env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(env_path, override=True)

server = os.getenv("SMTP_SERVER")
port = int(os.getenv("SMTP_PORT"))
username = os.getenv("SMTP_USERNAME")
password = os.getenv("SMTP_PASSWORD")

print(f"Testing connection to {server}:{port} as {username}...")

try:
    s = smtplib.SMTP(server, port)
    s.starttls()
    s.login(username, password)
    print("SUCCESS: Login successful!")
    s.quit()
except Exception as e:
    print(f"ERROR: {e}")
