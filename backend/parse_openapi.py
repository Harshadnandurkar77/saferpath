import json

with open('openapi.json', encoding='utf-8') as f:
    spec = json.load(f)

markdown = ["# SaferPath Backend Endpoints\n"]
paths = spec.get("paths", {})
for path, methods in paths.items():
    for method, details in methods.items():
        summary = details.get("summary", "")
        req_body = details.get("requestBody", {})
        resp_schema = details.get("responses", {}).get("200", {}).get("content", {}).get("application/json", {}).get("schema", {})
        query_params = [p for p in details.get("parameters", []) if p["in"] == "query"]
        
        req_schema_ref = ""
        if req_body:
            content = req_body.get("content", {}).get("application/json", {}).get("schema", {})
            req_schema_ref = content.get("", content.get("title", "Inline Schema"))
        
        resp_schema_ref = resp_schema.get("", resp_schema.get("title", "Inline Schema")) if resp_schema else "No Body"
        
        auth = "No explicit auth documented"
        if details.get("security"):
            auth = str(details.get("security"))
        
        markdown.append(f"### {method.upper()} {path}")
        markdown.append(f"- **Summary**: {summary}")
        markdown.append(f"- **Auth Requirements**: {auth}")
        if query_params:
            markdown.append("- **Query Parameters**:")
            for qp in query_params:
                markdown.append(f"  - {qp['name']} (required: {qp.get('required', False)})")
        else:
            markdown.append("- **Query Parameters**: None")
        
        markdown.append(f"- **Request Body**: {req_schema_ref}")
        markdown.append(f"- **Response Body**: {resp_schema_ref}\n")

with open('endpoints.md', 'w', encoding='utf-8') as f:
    f.write("\n".join(markdown))
