#!/bin/bash
# check_mysql.example.sh
#
# Keepalived MySQL 헬스체크 스크립트 예시
# MySQL이 응답하면 0, 응답하지 않으면 1을 반환합니다.
#
# 인증 정보는 서버 로컬의 보호된 MySQL 옵션 파일에서 읽습니다.
# 비밀번호를 이 스크립트나 프로세스 인자에 직접 입력하지 마세요.
#
# 사전 준비:
#   sudo cp mysql-healthcheck.example.cnf /etc/keepalived/mysql-healthcheck.cnf
#   sudo chmod 600 /etc/keepalived/mysql-healthcheck.cnf
#   # mysql-healthcheck.cnf 내 <MYSQL_HEALTHCHECK_PASSWORD>를 실제 값으로 교체

set -eu

MYSQL_DEFAULTS_FILE="${MYSQL_DEFAULTS_FILE:-/etc/keepalived/mysql-healthcheck.cnf}"
MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"

if [ ! -r "$MYSQL_DEFAULTS_FILE" ]; then
    echo "ERROR: MySQL defaults file is missing or unreadable: $MYSQL_DEFAULTS_FILE" >&2
    exit 1
fi

mysqladmin \
    --defaults-extra-file="$MYSQL_DEFAULTS_FILE" \
    --host="$MYSQL_HOST" \
    --connect-timeout=3 \
    ping > /dev/null 2>&1

exit $?
