#!/bin/bash
for i in $(seq 1 40); do
  if grep -q TOKEN_OK=1 /tmp/calendar-loopback.log 2>/dev/null; then
    echo READY
    grep -E 'TOKEN_OK|HAS_REFRESH|SCOPE|oauth error' /tmp/calendar-loopback.log
    exit 0
  fi
  if grep -q 'oauth error' /tmp/calendar-loopback.log 2>/dev/null; then
    echo FAILED
    cat /tmp/calendar-loopback.log
    exit 1
  fi
  sleep 3
done
echo TIMEOUT
cat /tmp/calendar-loopback.log
exit 2
