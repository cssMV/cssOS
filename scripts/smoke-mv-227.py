import sys, json
d = json.load(sys.stdin)
items = d.get("data", {}).get("items", [])
print(f"items: {len(items)}")
if items:
    keys = sorted(items[0].keys())
    print("fields:", keys)
    print("---")
    for it in items[:4]:
        rid = str(it.get("root_work_id") or "")[:8]
        sib = str(it.get("sibling_work_id") or "")[:8]
        seq = it.get("sequence_index")
        take = it.get("take_index")
        own = it.get("is_own")
        title = (it.get("title") or "")[:24]
        print(f"  {it['id'][:8]}.. root={rid:>8}.. seq={seq} take={take} sib={sib:>8}.. own={own} | {title}")
