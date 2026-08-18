#!/usr/bin/env bash
set -euo pipefail
echo '==== public resolvers ===='
for r in 8.8.8.8 1.1.1.1 9.9.9.9; do
  echo "-- @$r A"
  dig +short A huly.aneeverse.com @$r
  echo "-- @$r AAAA"
  dig +short AAAA huly.aneeverse.com @$r
  echo "-- @$r CNAME"
  dig +short CNAME huly.aneeverse.com @$r
  echo "-- @$r NS"
  dig +short NS aneeverse.com @$r
done
echo
echo '==== full A query ===='
dig A huly.aneeverse.com @8.8.8.8 +noall +answer +authority
echo
echo '==== local resolv ===='
cat /etc/resolv.conf
echo
echo '==== wildcard? ===='
dig +short A foo-random-xyz.aneeverse.com @8.8.8.8
dig +short CNAME '*.aneeverse.com' @8.8.8.8
dig +short A '*.aneeverse.com' @8.8.8.8
