import json
p = json.load(open(r"C:\Users\Koj1\.cursor\projects\c-code-Arenda\agent-tools\41d35563-c733-48a0-9fbc-f125b091c520.txt", encoding="utf-8"))
print("version", p["info"]["version"])
print("--- AUTH PATHS ---")
for path, methods in sorted(p["paths"].items()):
    if "auth" in path or "verify" in path or "email" in path:
        for m, spec in methods.items():
            if m.startswith("x"):
                continue
            print(m.upper(), path, spec.get("summary"), spec.get("operationId"))
print("--- USER ---")
print(json.dumps(p["components"]["schemas"].get("UserPublic"), ensure_ascii=False, indent=2)[:2000])
print("--- REGISTER ---")
print(json.dumps(p["paths"]["/auth/register"], ensure_ascii=False)[:2500])
print("--- LOGIN ---")
print(json.dumps(p["paths"]["/auth/login"], ensure_ascii=False)[:2000])
print("--- schemas names ---")
for n in sorted(p["components"]["schemas"]):
    if any(x in n.lower() for x in ("verif", "email", "code", "register", "login", "auth")):
        print(n)
