# infra/keepalived

RoadAEye 프로젝트의 MySQL 고가용성(HA) 구성을 위한 Keepalived 설정 예시입니다.

> **이 파일들은 실제 운영 환경의 Keepalived 설정을 익명화한 포트폴리오 예시입니다.**  
> 실제 IP, VIP, 인터페이스명, 인증 정보는 모두 플레이스홀더로 대체되었습니다.

## 구성 개요

두 DB 노드(MASTER / BACKUP)가 VRRP 프로토콜로 Virtual IP(VIP)를 공유합니다.  
MySQL 헬스체크 실패 시 VIP가 자동으로 BACKUP 노드로 이동하여 장애를 조치합니다.

```
[MASTER 노드] ─┐
               ├── VIP (<VIRTUAL_IP>) ── MySQL 클라이언트
[BACKUP 노드] ─┘
```

## 파일 목록

| 파일 | 설명 |
|---|---|
| `keepalived.example.conf` | Keepalived VRRP 설정 예시 |
| `check_mysql.example.sh` | MySQL 헬스체크 스크립트 예시 |
| `mysql-healthcheck.example.cnf` | MySQL 헬스체크용 인증 옵션 파일 예시 |

## 플레이스홀더 목록

실제 배포 전 아래 항목을 환경에 맞게 교체하세요.

| 플레이스홀더 | 설명 |
|---|---|
| `<NETWORK_INTERFACE>` | 네트워크 인터페이스명 (예: `eth0`, `ens3`) |
| `<LOCAL_NODE_IP>` | 이 노드의 실제 IP 주소 |
| `<PEER_NODE_IP>` | 상대 노드의 실제 IP 주소 |
| `<VIRTUAL_IP>` | MySQL 클라이언트가 접속할 가상 IP(VIP) |
| `<KEEPALIVED_AUTH_PASSWORD>` | VRRP 인증 비밀번호 (두 노드 동일 값) |
| `<MYSQL_HEALTHCHECK_PASSWORD>` | MySQL 헬스체크 전용 계정 비밀번호 |

## MASTER / BACKUP 노드 구분

| 설정 항목 | MASTER 노드 | BACKUP 노드 |
|---|---|---|
| `state` | `MASTER` | `BACKUP` |
| `priority` | `110` | `100` |

## 설치 예시

```bash
# 1. 설정 파일 배포
sudo cp keepalived.example.conf /etc/keepalived/keepalived.conf
sudo cp check_mysql.example.sh  /etc/keepalived/check_mysql.sh
sudo chmod 700 /etc/keepalived/check_mysql.sh

# 2. MySQL 인증 옵션 파일 배포 및 권한 설정
sudo cp mysql-healthcheck.example.cnf /etc/keepalived/mysql-healthcheck.cnf
sudo chmod 600 /etc/keepalived/mysql-healthcheck.cnf

# 3. 인증 파일 내 <MYSQL_HEALTHCHECK_PASSWORD>를 실제 값으로 교체
sudo nano /etc/keepalived/mysql-healthcheck.cnf

# 4. keepalived.conf 내 플레이스홀더 교체 후 서비스 시작
sudo systemctl enable --now keepalived
```

## 보안 주의사항

> **경고: 인증 정보(MYSQL_PASSWORD, auth_pass 등)를 저장소에 커밋하지 마세요.**

- `mysql-healthcheck.cnf`는 서버 로컬에서만 관리하고 권한을 `600`으로 설정하세요.
- `keepalived.conf`의 `auth_pass`에 실제 값을 입력한 뒤 저장소에 푸시하지 마세요.
- 헬스체크 MySQL 계정(`healthcheck`)은 `SELECT 1` 또는 `PING` 권한만 부여하세요.
