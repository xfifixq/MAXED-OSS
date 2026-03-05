#!/bin/bash
# Add local development host entries for Maxed OpenCPA
# Run with: sudo bash setup-hosts.sh

HOSTS_ENTRY="127.0.0.1 app.maxed.dev portal.maxed.dev opencpa.maxed.dev api.maxed.dev books.maxed.dev docs.maxed.dev flow.maxed.dev reports.maxed.dev sign.maxed.dev billing.maxed.dev crm.maxed.dev chat.maxed.dev time.maxed.dev"

if grep -q "maxed.dev" /etc/hosts; then
    echo "Maxed host entries already exist in /etc/hosts"
else
    echo "$HOSTS_ENTRY" >> /etc/hosts
    echo "Added Maxed host entries to /etc/hosts"
fi

echo ""
echo "Current maxed.dev entries:"
grep "maxed.dev" /etc/hosts
