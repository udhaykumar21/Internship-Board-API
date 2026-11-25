#!/usr/bin/env bash
# Usage: BASE=http://localhost:3000 bash docs/curl-examples.sh
BASE="${BASE:-http://localhost:3000}/api/v1/internships"
H='Content-Type: application/json'

echo "== List (page 1, 2 per page) =="
curl -s "$BASE?page=1&limit=2"; echo

echo "== Filter: remote + skill SQL, newest openings first =="
curl -s "$BASE?mode=Remote&skill=SQL&sort=-openings"; echo

echo "== Search =="
curl -s "$BASE?q=pune"; echo

echo "== Detail =="
curl -s "$BASE/INT-101"; echo

echo "== Create (201) =="
curl -s -i -X POST "$BASE" -H "$H" -d '{
  "title": "QA Automation Intern",
  "domain": "Testing",
  "mode": "Hybrid",
  "location": "Chennai",
  "skills": ["Jest", "Playwright"],
  "openings": 2,
  "duration_weeks": 6,
  "apply_url": "https://example.com/apply/qa"
}'; echo

echo "== Create with invalid data (400) =="
curl -s -X POST "$BASE" -H "$H" -d '{"title":"","mode":"Moon","openings":"two","apply_url":"javascript:alert(1)"}'; echo

echo "== Full update, PUT (200) =="
curl -s -X PUT "$BASE/INT-103" -H "$H" -d '{
  "title": "UI/UX Intern", "domain": "UI/UX", "mode": "Remote",
  "location": "India", "skills": ["Figma","Research"], "openings": 4
}'; echo

echo "== Partial update, PATCH (200) =="
curl -s -X PATCH "$BASE/INT-103" -H "$H" -d '{"openings": 5}'; echo

echo "== Apply (201), then duplicate (409) =="
APPLY='{"applicant_name":"Asha K","applicant_email":"asha@example.com","portfolio_url":"https://example.com/asha"}'
curl -s -X POST "$BASE/INT-102/applications" -H "$H" -d "$APPLY"; echo
curl -s -X POST "$BASE/INT-102/applications" -H "$H" -d "$APPLY"; echo

echo "== Delete (204), then detail (404) =="
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE "$BASE/INT-105"
curl -s "$BASE/INT-105"; echo
