name: Hourly Cron

on:
  schedule:
    # Every hour at minute 0 (UTC)
    - cron: '0 * * * *'
  workflow_dispatch: # allow manual trigger

jobs:
  trigger-cron:
    runs-on: ubuntu-latest
    steps:
      - name: Call /api/cron
        run: |
          HTTP_STATUS=$(curl -s -o /tmp/response.txt -w "%{http_code}" \
            -X GET \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            "https://app-chadizarkals-projects.vercel.app/api/cron")
          echo "HTTP status: $HTTP_STATUS"
          cat /tmp/response.txt
          if [ "$HTTP_STATUS" -lt 200 ] || [ "$HTTP_STATUS" -ge 300 ]; then
            echo "❌ Cron failed with status $HTTP_STATUS"
            exit 1
          fi
          echo "✅ Cron succeeded"
