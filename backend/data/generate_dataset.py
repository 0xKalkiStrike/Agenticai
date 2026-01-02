import json
import random

# Templates to generate synthetic data
actions = ["reset", "change", "update", "fix", "configure", "delete", "view"]
objects = ["password", "username", "email", "settings", "profile", "api key", "subscription", "billing", "notification"]
platforms = ["mobile app", "website", "dashboard", "desktop app"]

categories = {
    "account": ["password", "username", "email", "profile"],
    "technical": ["api key", "configuration", "integration"],
    "billing": ["subscription", "billing", "credit card", "invoice"],
    "general": ["notification", "settings"]
}

dataset = []

# 1. Add static base data
base_data = [
    {"keywords": ["login", "sign in", "cannot log in", "access account"], "answer": "To log in, please use your registered email and password. If you have forgotten your password, you can use the 'Forgot Password' link on the login page to reset it.", "category": "account"},
    {"keywords": ["pricing", "cost", "plans", "price"], "answer": "We offer three main plans: Free, Pro, and Enterprise. You can find detailed information on our pricing page.", "category": "general"},
    {"keywords": ["hello", "hi", "hey"], "answer": "Hello! How can I assist you today?", "category": "chat"},
    {
        "keywords": ["website slow", "slow loading", "performance issue", "site is slow", "lagging", "slowing down", "website slowing"],
        "answer": "I'm sorry to hear you're experiencing slowness. Here are a few steps you can try:\n1. Hard Refresh: Press Ctrl+Shift+R (or Cmd+Shift+R on Mac) in your browser to clear the cache and reload the page.\n2. Check your internet connection: Visit a site like fast.com to ensure your connection is stable.\n3. Try a different browser: This helps determine if the issue is specific to your current browser.\nIf the problem continues, please let us know and we will investigate further.",
        "category": "technical"
    },
    {
        "keywords": ["forgot password", "reset password", "can't remember password"],
        "answer": "To reset your password, please go to the login page and click the 'Forgot Password' link. You will receive an email with instructions to set a new password.",
        "category": "account"
    },
    {
        "keywords": ["find invoice", "download invoice", "where is my bill", "billing history"],
        "answer": "You can view, download, and print all your past invoices from the 'Billing' section in your account settings. Look for the 'Invoice History' tab.",
        "category": "billing"
    },
    {
        "keywords": ["update credit card", "change payment method", "new card"],
        "answer": "To update your payment information, please navigate to Account Settings > Billing > Payment Method and click 'Update Card'.",
        "category": "billing"
    },
    {
        "keywords": ["api key", "find api", "generate key", "developer key"],
        "answer": "Your API keys can be found in your Developer Settings page. You can generate new keys, revoke old ones, and set permissions there.",
        "category": "technical"
    }
]
dataset.extend(base_data)

# 2. Generate synthetic variations (aiming for 10,000+)
for i in range(10000):
    action = random.choice(actions)
    obj = random.choice(objects)
    platform = random.choice(platforms)
    
    # Determine category
    category = "general"
    for cat, keywords in categories.items():
        if obj in keywords:
            category = cat
            break
            
    # Create a synthetic question/keyword set
    keywords = [
        f"{action} {obj}",
        f"how to {action} {obj}",
        f"cannot {action} {obj}",
        f"{obj} not working on {platform}",
        action,
        obj
    ]
    
    # Create a synthetic answer
    answer = f"To {action} your {obj} on the {platform}, please go to Settings > {obj.title()} and click '{action.title()}'. If the issue persists, contact support."
    
    entry = {
        "id": i + 100,
        "keywords": keywords,
        "answer": answer,
        "category": category
    }
    dataset.append(entry)

output_path = "knowledge_base_large.json"
with open(output_path, "w") as f:
    json.dump(dataset, f, indent=2)

print(f"Successfully generated {len(dataset)} dataset entries in '{output_path}'")
print("You can now use this file to train/load your AI engine.")
